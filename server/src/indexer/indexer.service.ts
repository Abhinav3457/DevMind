import { fileReaderService } from './file-reader.service';
import { codeParserService } from './code-parser.service';
import { chunkerService } from './chunker.service';
import { analyzerService } from './analyzer.service';
import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import logger from '../utils/logger';

export class IndexerService {
  async indexRepository(
    userId: string,
    repositoryId: string,
    repoDir: string,
  ): Promise<{ reportId: string; summary: string }> {
    const startTime = Date.now();

    const report = await IndexReport.create({
      repositoryId,
      userId,
      status: 'processing',
      startedAt: new Date(),
    });

    try {
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

      return { reportId: report._id.toString(), summary: analysis.summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.status = 'failed';
      report.error = message;
      report.completedAt = new Date();
      await report.save();
      logger.error('Indexer: Indexing failed - ' + message);
      throw error;
    }
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
