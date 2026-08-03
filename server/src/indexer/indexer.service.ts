import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { fileReaderService } from './file-reader.service';
import { codeParserService } from './code-parser.service';
import { chunkerService } from './chunker.service';
import { analyzerService } from './analyzer.service';
import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import ImportedRepository from '../models/ImportedRepository';
import GitHubAccount from '../models/GitHubAccount';
import { logActivity } from '../services/activity.service';
import { notificationService } from '../services/notification.service';
import logger from '../utils/logger';
import { ApiError } from '../utils/apiResponse';
import AdmZip from 'adm-zip';

export class IndexerService {
  async indexRepository(
    userId: string,
    repositoryId: string,
    repoDir?: string,
  ): Promise<{ reportId: string; summary: string }> {
    const startTime = Date.now();

    const report = await IndexReport.create({
      repositoryId,
      userId,
      status: 'processing',
      startedAt: new Date(),
    });

    let tempDir: string | null = null;

    try {
      // If no local path is given, clone the repo from GitHub
      if (!repoDir) {
        repoDir = await this.cloneFromGitHub(userId, repositoryId);
        tempDir = repoDir;
      }

      const files = await fileReaderService.readDirectory(repoDir);

      if (files.length === 0) {
        report.status = 'failed';
        report.error = 'No readable files found in the repository';
        report.completedAt = new Date();
        await report.save();
        return { reportId: report._id.toString(), summary: '' };
      }

      const parsedFiles: { file: import('../models/IndexedFile').IIndexedFile; content: string; path: string }[] = [];
      let totalTokens = 0;

      for (const entry of files) {
        const parseResult = codeParserService.parse(entry.content, entry.language);
        const dependencies = codeParserService.extractDependencies(parseResult.imports);

        const indexedFile = await IndexedFile.create({
          reportId: report._id,
          path: entry.path,
          name: entry.name,
          language: entry.language,
          size: entry.size,
          functions: parseResult.functions,
          classes: parseResult.classes,
          imports: parseResult.imports,
          exports: parseResult.exports,
          dependencies,
        });

        parsedFiles.push({ file: indexedFile, content: entry.content, path: entry.path });

        const { chunks } = chunkerService.chunkFile({
          reportId: report._id.toString(),
          fileId: indexedFile._id.toString(),
          file: indexedFile,
          content: entry.content,
        });

        await chunkerService.saveChunks(report._id.toString(), indexedFile._id.toString(), chunks);
        totalTokens += chunks.reduce((acc, c) => acc + c.tokenCount, 0);
      }

      const analysis = analyzerService.analyze({ files: parsedFiles, rootPath: repoDir });

      report.status = 'completed';
      report.summary = analysis.summary;
      report.techStack = analysis.techStack;
      report.folderStructure = analysis.folderStructure;
      report.fileCount = analysis.fileCount;
      report.chunkCount = await IndexedChunk.countDocuments({ reportId: report._id });
      report.totalTokens = totalTokens;
      report.completedAt = new Date();
      await report.save();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info('Indexer: Repository indexed successfully - ' + report._id.toString() +
        ' (' + files.length + ' files, ' + report.chunkCount + ' chunks, ' + duration + 's)');

      // Activity feed + in-app notification for the user (best-effort — a
      // logging failure must never turn a successful index into a failed one)
      try {
        const importedRepo = await ImportedRepository.findOne({ _id: repositoryId, userId })
          .select('workspaceId fullName')
          .lean();
        const repoLabel = importedRepo?.fullName || 'a repository';
        void logActivity({
          userId,
          workspaceId: importedRepo?.workspaceId ? importedRepo.workspaceId.toString() : undefined,
          type: 'repo_indexed',
          description: 'Indexed ' + repoLabel + ' (' + report.fileCount + ' files, ' + report.chunkCount + ' chunks)',
          metadata: { reportId: report._id.toString(), fileCount: report.fileCount, chunkCount: report.chunkCount },
        });
        await notificationService.create({
          userId,
          type: 'index_complete',
          title: 'Indexing complete',
          message: repoLabel + ' finished indexing — ' + report.fileCount + ' files, ' + report.chunkCount + ' chunks',
          data: { reportId: report._id.toString() },
        });
      } catch (logError) {
        logger.error('Indexer: Failed to record activity/notification after indexing', logError);
      }

      return { reportId: report._id.toString(), summary: analysis.summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.status = 'failed';
      report.error = message;
      report.completedAt = new Date();
      await report.save();
      logger.error('Indexer: Indexing failed - ' + message);
      throw error;
    } finally {
      // Clean up temp directory if we cloned from GitHub
      if (tempDir) {
        fs.rm(tempDir, { recursive: true, force: true }).catch((err) =>
          logger.error('Indexer: Failed to clean up temp directory - ' + err),
        );
      }
    }
  }

  /**
   * Download a repository from GitHub as a zipball, extract it to a temp directory,
   * and return the path to the extracted repo contents.
   */
  private async cloneFromGitHub(userId: string, repositoryId: string): Promise<string> {
    // Look up the imported repository metadata
    const importedRepo = await ImportedRepository.findOne({ _id: repositoryId, userId });
    if (!importedRepo) {
      throw new ApiError(404, 'Imported repository not found. Please import it from GitHub first.');
    }

    // Look up the user's GitHub account to get an access token
    const gitHubAccount = await GitHubAccount.findOne({ userId, isConnected: true });
    if (!gitHubAccount) {
      throw new ApiError(400, 'GitHub account not connected. Please connect your GitHub account first.');
    }

    const [owner, repo] = importedRepo.fullName.split('/');
    if (!owner || !repo) {
      throw new ApiError(400, 'Invalid repository name: ' + importedRepo.fullName);
    }

    const branch = importedRepo.defaultBranch || 'main';
    const archiveUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`;

    logger.info(`Indexer: Downloading ${importedRepo.fullName} (${branch}) from GitHub...`);

    // Download the zipball from GitHub using the user's access token
    const response = await fetch(archiveUrl, {
      headers: {
        Authorization: `Bearer ${gitHubAccount.accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'DevMindAI',
      },
    });

    if (!response.ok) {
      throw new ApiError(
        response.status,
        `Failed to download repository from GitHub: ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract to a temp directory
    const tempRoot = path.join(os.tmpdir(), 'devmind-index-' + crypto.randomBytes(8).toString('hex'));
    await fs.mkdir(tempRoot, { recursive: true });

    const zip = new AdmZip(buffer);
    zip.extractAllTo(tempRoot, true);

    // GitHub wraps archives in a folder like "owner-repo-branch/" — find the actual root
    const entries = await fs.readdir(tempRoot);
    const rootFolder = entries.find((e) => {
      // The inner folder from GitHub zipball is typically "<owner>-<repo>-<sha>/"
      return e.startsWith(owner + '-' + repo) || e.startsWith(owner + '_' + repo);
    });

    if (!rootFolder) {
      // If we can't find the expected folder, the repo files might be at the root
      return tempRoot;
    }

    const repoContentDir = path.join(tempRoot, rootFolder);
    logger.info(`Indexer: Extracted ${importedRepo.fullName} to ${repoContentDir}`);
    return repoContentDir;
  }

  async getReport(reportId: string, userId: string): Promise<import('../models/IndexReport').IIndexReport | null> {
    return IndexReport.findOne({ _id: reportId, userId });
  }

  async getFiles(
    reportId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ files: import('../models/IndexedFile').IIndexedFile[]; total: number }> {
    const report = await IndexReport.findOne({ _id: reportId, userId });
    if (!report) return { files: [], total: 0 };

    const [files, total] = await Promise.all([
      IndexedFile.find({ reportId }).skip((page - 1) * limit).limit(limit).sort({ path: 1 }),
      IndexedFile.countDocuments({ reportId }),
    ]);

    return { files, total };
  }

  async getFile(reportId: string, fileId: string, userId: string): Promise<import('../models/IndexedFile').IIndexedFile | null> {
    const report = await IndexReport.findOne({ _id: reportId, userId });
    if (!report) return null;
    return IndexedFile.findOne({ _id: fileId, reportId });
  }

  async getChunks(
    reportId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ chunks: import('../models/IndexedChunk').IIndexedChunk[]; total: number }> {
    const report = await IndexReport.findOne({ _id: reportId, userId });
    if (!report) return { chunks: [], total: 0 };

    const [chunks, total] = await Promise.all([
      IndexedChunk.find({ reportId })
        .skip((page - 1) * limit).limit(limit).sort({ fileId: 1, index: 1 }),
      IndexedChunk.countDocuments({ reportId }),
    ]);

    return { chunks, total };
  }

  async deleteReport(reportId: string, userId: string): Promise<boolean> {
    const report = await IndexReport.findOne({ _id: reportId, userId });
    if (!report) return false;

    await Promise.all([
      IndexedFile.deleteMany({ reportId }),
      IndexedChunk.deleteMany({ reportId }),
      IndexReport.deleteOne({ _id: reportId }),
    ]);

    return true;
  }
}

export const indexerService = new IndexerService();
