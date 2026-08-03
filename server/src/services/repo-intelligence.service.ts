import { queryClassifierService, QuestionType } from '../repo-intelligence/classifier.service';
import { contextRetrieverService } from '../repo-intelligence/retriever.service';
import { promptBuilderService } from '../repo-intelligence/prompt-builder.service';
import { generateFromAI } from '../config/ai';
import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import ImportedRepository from '../models/ImportedRepository';
import { ApiError } from '../utils/apiResponse';
import logger from '../utils/logger';

interface SourceRef {
  filePath: string;
  startLine: number;
  endLine: number;
  type: string;
}

interface AskResult {
  answer: string;
  questionType: QuestionType;
  sources: SourceRef[];
  contextSummary: {
    filesUsed: number;
    chunksUsed: number;
    hasTechStack: boolean;
    hasFolderStructure: boolean;
  };
}

interface CodeSearchResult {
  id: string;
  reportId: string;
  repositoryId: string;
  repoName: string;
  filePath: string;
  line: number;
  snippet: string;
}

interface QuestionTemplate {
  question: string;
  type: QuestionType;
  description: string;
}

export class RepoIntelligenceService {
  async getIndexStatus(userId: string): Promise<{ hasReport: boolean; status: string | null; fileCount: number; reportId: string | null }> {
    const latest = await IndexReport.findOne({ userId, status: 'completed' })
      .sort({ createdAt: -1 })
      .select('status fileCount')
      .lean();

    if (latest) {
      return {
        hasReport: true,
        status: 'completed',
        fileCount: latest.fileCount,
        reportId: (latest._id as unknown as string).toString(),
      };
    }

    // Check if there's any report at all (maybe still processing)
    const anyReport = await IndexReport.findOne({ userId })
      .sort({ createdAt: -1 })
      .select('status')
      .lean();

    if (anyReport) {
      return {
        hasReport: false,
        status: anyReport.status,
        fileCount: 0,
        reportId: null,
      };
    }

    return {
      hasReport: false,
      status: null,
      fileCount: 0,
      reportId: null,
    };
  }

  async ask(reportId: string, userId: string, question: string): Promise<AskResult> {
    const startTime = Date.now();

    // Support 'latest' as a special reportId value — get the most recent completed report
    if (reportId === 'latest') {
      const latestReport = await IndexReport.findOne({ userId, status: 'completed' }).sort({ createdAt: -1 });
      if (!latestReport) {
        throw new ApiError(404, 'No completed index report found. Please index a repository first.');
      }
      reportId = latestReport._id.toString();
    }

    const report = await IndexReport.findOne({ _id: reportId, userId });
    if (!report) {
      throw new ApiError(404, 'Index report not found or access denied');
    }
    if (report.status !== 'completed') {
      throw new ApiError(400, 'Indexing has not completed yet. Status: ' + report.status);
    }

    const classification = queryClassifierService.classify(question);
    logger.info('RepoIntelligence: Question classified as ' + classification.type +
      (classification.targetFile ? ' (file: ' + classification.targetFile + ')' : '') +
      (classification.targetFunction ? ' (function: ' + classification.targetFunction + ')' : ''));

    const context = await contextRetrieverService.retrieve(
      reportId,
      classification.type,
      classification.keywords,
      classification.targetFile,
      classification.targetFunction,
    );

    logger.info('RepoIntelligence: Retrieved ' + context.relevantFiles.length +
      ' files and ' + context.relevantChunks.length + ' chunks');

    const { systemInstruction, userPrompt } = promptBuilderService.build({
      question,
      questionType: classification.type,
      context,
      targetFile: classification.targetFile,
      targetFunction: classification.targetFunction,
    });

    let answer: string;
    try {
      answer = await generateFromAI({
        systemInstruction,
        prompt: userPrompt,
        temperature: 0.3,
        maxTokens: 4096,
      });
    } catch (aiError: unknown) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Too Many Requests')) {
        throw new ApiError(429, 'AI service quota exceeded. Please wait a moment and try again.');
      }
      if (errMsg.includes('413') || errMsg.includes('Request too large') || errMsg.includes('too large')) {
        throw new ApiError(413, 'The context is too large for the AI model. Try asking a more specific question to reduce the context size.');
      }
      if (errMsg.includes('403') || errMsg.includes('Forbidden') || errMsg.includes('not enabled') || errMsg.includes('API key')) {
        throw new ApiError(403, 'AI service authentication failed. Check that your GEMINI_API_KEY or GROQ_API_KEY in the .env file is valid and the API is enabled in your Google Cloud / Groq console.');
      }
      logger.error('RepoIntelligence: AI generation failed', aiError);
      throw new ApiError(500, 'AI service is temporarily unavailable. Please try again later.');
    }
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info('RepoIntelligence: Answered question (' + classification.type +
      ') in ' + duration + 's');

    // Build precise citations from the retrieved chunks (deduped by file)
    const sources: SourceRef[] = [];
    const seenFiles = new Set<string>();
    for (const chunk of context.relevantChunks) {
      if (seenFiles.has(chunk.filePath)) continue;
      seenFiles.add(chunk.filePath);
      sources.push({
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        type: chunk.type,
      });
    }

    return {
      answer,
      questionType: classification.type,
      sources,
      contextSummary: {
        filesUsed: context.relevantFiles.length,
        chunksUsed: context.relevantChunks.length,
        hasTechStack: context.techStack !== '{}' && context.techStack !== '',
        hasFolderStructure: context.folderStructure !== '[]' && context.folderStructure !== '',
      },
    };
  }

  /**
   * Grep-style search across the user's indexed repositories.
   * Returns matching chunks with file path, line number, and a snippet.
   */
  async searchCode(userId: string, query: string, options: { limit?: number } = {}): Promise<{ results: CodeSearchResult[]; total: number }> {
    const q = query.trim();
    if (!q) return { results: [], total: 0 };
    const limit = Math.min(options.limit || 30, 50);

    const reports = await IndexReport.find({ userId, status: 'completed' }).select('_id repositoryId').lean();
    if (reports.length === 0) return { results: [], total: 0 };

    const reportIds = reports.map((r) => r._id);
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const chunks = await IndexedChunk.find({
      reportId: { $in: reportIds },
      content: { $regex: escaped, $options: 'i' },
    })
      .sort({ tokenCount: -1 })
      .limit(limit * 4)
      .lean();

    if (chunks.length === 0) return { results: [], total: 0 };

    const fileIds = [...new Set(chunks.map((c) => c.fileId.toString()))];
    const files = await IndexedFile.find({ _id: { $in: fileIds } }).select('_id path reportId').lean();
    const fileMap = new Map(files.map((f) => [f._id.toString(), f]));

    const repoIds = [...new Set(reports.map((r) => r.repositoryId.toString()))];
    const repos = await ImportedRepository.find({ _id: { $in: repoIds } }).select('_id fullName').lean();
    const repoNameMap = new Map(repos.map((r) => [r._id.toString(), r.fullName]));
    const repoIdByReport = new Map(reports.map((r) => [r._id.toString(), r.repositoryId.toString()]));

    const results: CodeSearchResult[] = [];
    for (const chunk of chunks) {
      if (results.length >= limit) break;
      const file = fileMap.get(chunk.fileId.toString());
      if (!file) continue;
      const reportId = chunk.reportId.toString();
      const repositoryId = repoIdByReport.get(reportId) || '';
      const lines = chunk.content.split('\n');

      // Find the first line that contains the query
      let matchLine = chunk.startLine;
      let matchIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.toLowerCase().includes(q.toLowerCase())) {
          matchLine = chunk.startLine + i;
          matchIdx = i;
          break;
        }
      }

      // Build a snippet: 2 lines above and below the match
      const from = Math.max(0, matchIdx - 2);
      const to = Math.min(lines.length, matchIdx + 3);
      const snippet = lines.slice(from, to).join('\n');

      results.push({
        id: (chunk._id as unknown as string).toString(),
        reportId,
        repositoryId,
        repoName: repoNameMap.get(repositoryId) || 'Unknown repository',
        filePath: file.path,
        line: matchLine,
        snippet,
      });
    }

    return { results, total: results.length };
  }

  async listReports(userId: string): Promise<{ id: string; repoName: string; fileCount: number; chunkCount: number; createdAt: string }[]> {
    const reports = await IndexReport.find({ userId, status: 'completed' })
      .sort({ createdAt: -1 })
      .select('repositoryId fileCount chunkCount createdAt')
      .lean();

    if (reports.length === 0) return [];

    // Fetch repo names from ImportedRepository
    const repoIds = reports.map((r) => r.repositoryId);
    const repos = await ImportedRepository.find({ _id: { $in: repoIds } })
      .select('fullName')
      .lean();

    const repoMap = new Map(repos.map((r) => [r._id.toString(), r.fullName]));

    return reports.map((r) => ({
      id: (r._id as unknown as string).toString(),
      repoName: repoMap.get(r.repositoryId.toString()) || 'Unknown repository',
      fileCount: r.fileCount,
      chunkCount: r.chunkCount,
      createdAt: r.createdAt?.toISOString() || '',
    }));
  }

  getQuestionTemplates(): QuestionTemplate[] {
    return [
      { question: 'Explain the project', type: 'project_overview', description: 'Get a high-level overview of what the project does' },
      { question: 'Explain authentication', type: 'tech_stack', description: 'Learn how authentication is implemented' },
      { question: 'Explain database', type: 'tech_stack', description: 'Learn which databases are used and how they are configured' },
      { question: 'Where is JWT generated?', type: 'code_location', description: 'Find the exact location of JWT generation code' },
      { question: 'Where is MongoDB connected?', type: 'code_location', description: 'Find the database connection code' },
      { question: 'Explain API flow', type: 'architecture', description: 'Understand the request/response flow through the API' },
      { question: 'Explain middleware', type: 'middleware', description: 'See what middleware is configured and in what order' },
      { question: 'Explain project architecture', type: 'architecture', description: 'Get a detailed breakdown of the project structure' },
      { question: 'Explain this file src/app.ts', type: 'file_explain', description: 'Get details about a specific file (replace with your file path)' },
      { question: 'Explain this function generateToken', type: 'function_explain', description: 'Understand a specific function (replace with your function name)' },
    ];
  }
}

export const repoIntelligenceService = new RepoIntelligenceService();
