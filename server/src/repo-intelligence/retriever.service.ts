import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import { QuestionType } from './classifier.service';

const MAX_CHUNKS = 4;
const MAX_FILES = 3;
const MAX_CHUNK_CONTENT_LENGTH = 800;
const MAX_TOTAL_CONTENT_LENGTH = 3000;

export interface RetrievedContext {
  reportSummary: string;
  techStack: string;
  folderStructure: string;
  fileCount: number;
  relevantFiles: {
    path: string;
    language: string;
    functions: string;
    classes: string;
    imports: string;
    dependencies: string;
  }[];
  relevantChunks: {
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
    type: string;
    tokenCount: number;
  }[];
}

export class ContextRetrieverService {
  async retrieve(
    reportId: string,
    questionType: QuestionType,
    keywords: string[],
    targetFile?: string,
    targetFunction?: string,
  ): Promise<RetrievedContext> {
    const report = await IndexReport.findById(reportId);
    if (!report) {
      throw new Error('Index report not found');
    }

    const base: RetrievedContext = {
      reportSummary: (report.summary || '').slice(0, 500),
      techStack: JSON.stringify(report.techStack).slice(0, 500),
      folderStructure: JSON.stringify(report.folderStructure).slice(0, 500),
      fileCount: report.fileCount,
      relevantFiles: [],
      relevantChunks: [],
    };

    switch (questionType) {
      case 'project_overview':
        return this.retrieveForOverview(base, reportId);
      case 'architecture':
        return this.retrieveForArchitecture(base, reportId);
      case 'tech_stack':
        return this.retrieveForTechStack(base, reportId, keywords);
      case 'code_location':
        return this.retrieveForCodeLocation(base, reportId, keywords);
      case 'file_explain':
        return this.retrieveForFile(base, reportId, targetFile || '');
      case 'function_explain':
        return this.retrieveForFunction(base, reportId, targetFunction || '');
      case 'middleware':
        return this.retrieveForMiddleware(base, reportId);
      default:
        return this.retrieveGeneral(base, reportId, keywords);
    }
  }

  private async retrieveForOverview(
    base: RetrievedContext,
    reportId: string,
  ): Promise<RetrievedContext> {
    const files = await IndexedFile.find({ reportId })
      .limit(MAX_FILES)
      .sort({ size: -1 })
      .lean();
    base.relevantFiles = this.formatFiles(files);
    return base;
  }

  private async retrieveForArchitecture(
    base: RetrievedContext,
    reportId: string,
  ): Promise<RetrievedContext> {
    const files = await IndexedFile.find({
      reportId,
      $or: [
        { path: { $regex: 'routes|app\\.|index\\.|server\\.|main\\.' } },
        { name: { $regex: 'router|app|server|main|index' } },
      ],
    })
      .limit(MAX_FILES)
      .sort({ size: -1 })
      .lean();

    base.relevantFiles = this.formatFiles(files);

    const fileIds = files.map((f) => f._id);
    const chunks = await IndexedChunk.find({ reportId, fileId: { $in: fileIds } })
      .limit(MAX_CHUNKS)
      .sort({ tokenCount: -1 })
      .lean();

    base.relevantChunks = await this.resolveChunkFilePaths(chunks);
    return base;
  }

  private async retrieveForTechStack(
    base: RetrievedContext,
    reportId: string,
    keywords: string[],
  ): Promise<RetrievedContext> {
    const terms = keywords.length > 0
      ? keywords
      : ['express', 'react', 'vue', 'angular', 'mongodb', 'postgres', 'jwt', 'passport', 'prisma', 'typeorm'];

    const importConditions = terms.map((term) => ({
      imports: { $regex: term, $options: 'i' },
    }));

    const files = await IndexedFile.find({
      reportId,
      $or: importConditions,
    })
      .limit(MAX_FILES)
      .lean();

    base.relevantFiles = this.formatFiles(files);

    const contentConditions = terms.map((term) => ({
      content: { $regex: term, $options: 'i' },
    }));

    const chunks = await IndexedChunk.find({
      reportId,
      $or: contentConditions,
    })
      .limit(MAX_CHUNKS)
      .lean();

    base.relevantChunks = await this.resolveChunkFilePaths(chunks);
    return base;
  }

  private async retrieveForCodeLocation(
    base: RetrievedContext,
    reportId: string,
    keywords: string[],
  ): Promise<RetrievedContext> {
    const searchTerms = keywords.length > 0
      ? keywords
      : ['generate', 'create', 'connect', 'init', 'config', 'setup', 'sign', 'token'];

    const conditions = searchTerms.map((term) => ({
      content: { $regex: term, $options: 'i' },
    }));

    const chunks = await IndexedChunk.find({
      reportId,
      $or: conditions,
    })
      .limit(MAX_CHUNKS)
      .sort({ tokenCount: -1 })
      .lean();

    base.relevantChunks = await this.resolveChunkFilePaths(chunks);

    const fileIds = [...new Set(chunks.map((c) => c.fileId.toString()))];
    const files = await IndexedFile.find({ _id: { $in: fileIds } }).lean();
    base.relevantFiles = this.formatFiles(files);

    return base;
  }

  private async retrieveForFile(
    base: RetrievedContext,
    reportId: string,
    targetFile: string,
  ): Promise<RetrievedContext> {
    const escaped = targetFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const files = await IndexedFile.find({
      reportId,
      $or: [
        { path: { $regex: escaped, $options: 'i' } },
        { name: { $regex: escaped, $options: 'i' } },
      ],
    })
      .limit(5)
      .lean();

    base.relevantFiles = this.formatFiles(files);

    const fileIds = files.map((f) => f._id);
    const chunks = await IndexedChunk.find({ reportId, fileId: { $in: fileIds } })
      .sort({ index: 1 })
      .lean();

    base.relevantChunks = await this.resolveChunkFilePaths(chunks);
    return base;
  }

  private async retrieveForFunction(
    base: RetrievedContext,
    reportId: string,
    targetFunction: string,
  ): Promise<RetrievedContext> {
    const escaped = targetFunction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const funcRegex = new RegExp(escaped, 'i');

    const files = await IndexedFile.find({
      reportId,
      'functions.name': { $regex: funcRegex.source, $options: 'i' },
    })
      .limit(5)
      .lean();

    base.relevantFiles = this.formatFiles(files);

    const fileIds = files.map((f) => f._id);
    const chunks = await IndexedChunk.find({
      reportId,
      fileId: { $in: fileIds },
      type: 'function',
    })
      .limit(MAX_CHUNKS)
      .sort({ index: 1 })
      .lean();

    const matchingChunks = chunks.filter((c) => {
      const meta = c.metadata as Record<string, unknown>;
      const name = (meta?.functionName as string) || '';
      return funcRegex.test(name) || funcRegex.test(c.content);
    });

    base.relevantChunks = await this.resolveChunkFilePaths(
      matchingChunks.length > 0 ? matchingChunks : chunks,
    );
    return base;
  }

  private async retrieveForMiddleware(
    base: RetrievedContext,
    reportId: string,
  ): Promise<RetrievedContext> {
    const searchTerms = ['middleware', 'app.use', 'router.use'];
    const conditions = searchTerms.map((term) => ({
      content: { $regex: term, $options: 'i' },
    }));

    const chunks = await IndexedChunk.find({
      reportId,
      $or: conditions,
    })
      .limit(MAX_CHUNKS)
      .sort({ tokenCount: -1 })
      .lean();

    base.relevantChunks = await this.resolveChunkFilePaths(chunks);

    const fileIds = [...new Set(chunks.map((c) => c.fileId.toString()))];
    const files = await IndexedFile.find({ _id: { $in: fileIds } }).lean();
    base.relevantFiles = this.formatFiles(files);

    return base;
  }

  private async retrieveGeneral(
    base: RetrievedContext,
    reportId: string,
    keywords: string[],
  ): Promise<RetrievedContext> {
    if (keywords.length > 0) {
      const conditions = keywords.map((term) => ({
        content: { $regex: term, $options: 'i' },
      }));

      const chunks = await IndexedChunk.find({
        reportId,
        $or: conditions,
      })
        .limit(MAX_CHUNKS)
        .sort({ tokenCount: -1 })
        .lean();

      base.relevantChunks = await this.resolveChunkFilePaths(chunks);

      const fileIds = [...new Set(chunks.map((c) => c.fileId.toString()))];
      const files = await IndexedFile.find({ _id: { $in: fileIds } }).lean();
      base.relevantFiles = this.formatFiles(files);
    } else {
      const files = await IndexedFile.find({ reportId })
        .limit(MAX_FILES)
        .sort({ size: -1 })
        .lean();
      base.relevantFiles = this.formatFiles(files);
    }

    return base;
  }

  private formatFiles(files: Array<{ path: string; language: string; functions: Array<{ name: string; startLine: number; endLine: number }>; classes: Array<{ name: string; startLine: number; endLine: number }>; imports: string[]; dependencies: string[] }>): RetrievedContext['relevantFiles'] {
    return files.map((f) => ({
      path: f.path,
      language: f.language,
      functions: f.functions.map((fn) => fn.name + ':' + fn.startLine + '-' + fn.endLine).join(', '),
      classes: f.classes.map((cls) => cls.name + ':' + cls.startLine + '-' + cls.endLine).join(', '),
      imports: f.imports.slice(0, 5).join(', '),
      dependencies: f.dependencies.slice(0, 3).join(', '),
    }));
  }

  private async resolveChunkFilePaths(chunks: Array<{ fileId: { toString(): string }; content: string; startLine: number; endLine: number; type: string; tokenCount: number }>): Promise<RetrievedContext['relevantChunks']> {
    if (chunks.length === 0) return [];

    const fileIds = [...new Set(chunks.map((c) => c.fileId.toString()))];
    const files = await IndexedFile.find({ _id: { $in: fileIds } })
      .select('_id path')
      .lean();

    const filePathMap = new Map(files.map((f) => [f._id.toString(), f.path]));

    const truncated = chunks.map((c) => ({
      filePath: filePathMap.get(c.fileId.toString()) || 'unknown',
      content: c.content.length > MAX_CHUNK_CONTENT_LENGTH
        ? c.content.slice(0, MAX_CHUNK_CONTENT_LENGTH) + '\n// ... [truncated]'
        : c.content,
      startLine: c.startLine,
      endLine: c.endLine,
      type: c.type,
      tokenCount: c.tokenCount,
    }));

    // If total content still exceeds limit, keep only the most relevant chunks
    let totalLen = truncated.reduce((sum, c) => sum + c.content.length, 0);
    while (totalLen > MAX_TOTAL_CONTENT_LENGTH && truncated.length > 1) {
      const removed = truncated.pop()!;
      totalLen -= removed.content.length;
    }

    return truncated;
  }
}

export const contextRetrieverService = new ContextRetrieverService();
