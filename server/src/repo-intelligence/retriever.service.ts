import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import { embeddingService } from '../services/embedding';
import logger from '../utils/logger';
import { QuestionType } from './classifier.service';

const MAX_CHUNKS = 4;
const MAX_FILES = 3;
const MAX_CHUNK_CONTENT_LENGTH = 800;
const MAX_TOTAL_CONTENT_LENGTH = 3000;

/**
 * Stored vectors scored per query — bounds the work done for one question.
 *
 * Must be at least as large as a realistic repository's embedded-chunk count:
 * vectors beyond this limit are simply never scored, so on a larger repo the
 * best answer can be invisible to semantic search and a question silently
 * degrades to keyword-only. This matches EmbeddingService.fetchEmbeddedChunks'
 * own default (2000), which is the intended upper bound for a single report.
 */
const SEMANTIC_CANDIDATE_LIMIT = 2000;
/** Rerank weight for a regex/content match from the keyword branch. */
const KEYWORD_BOOST_CONTENT = 0.1;
/** Rerank weight for an exact symbol match (named file, function, class). */
const KEYWORD_BOOST_SYMBOL = 0.25;

interface CandidateChunk {
  id: string;
  fileId: string;
  content: string;
  startLine: number;
  endLine: number;
  type: string;
  tokenCount: number;
}

interface KeywordCandidate {
  chunk: CandidateChunk;
  boost: number;
}

interface MergedChunk {
  chunk: CandidateChunk;
  semanticScore: number | null;
  keywordBoost: number;
  score: number;
  sources: ('semantic' | 'keyword')[];
}

/** Per-chunk scoring detail for one retrieval pass (server-side only). */
export interface RetrievedChunkScore {
  chunkId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  type: string;
  semanticScore: number | null;
  keywordBoost: number;
  score: number;
  sources: ('semantic' | 'keyword')[];
}

export interface RetrievalDiagnostics {
  /** A provider is configured AND its key is present. */
  semanticAvailable: boolean;
  /** The semantic branch actually ran for this query. */
  semanticExecuted: boolean;
  /** The branch's regex/symbol lookup ran for this query. */
  keywordExecuted: boolean;
  /** Distinct chunks considered across both signals. */
  candidatesConsidered: number;
  /** Chunks ultimately handed to the context builder, best first. */
  selected: RetrievedChunkScore[];
}

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
  /** How the chunks above were selected (diagnostics; never sent to the client). */
  retrieval: RetrievalDiagnostics;
}

interface LeanChunk {
  _id: unknown;
  fileId: { toString(): string };
  content: string;
  startLine: number;
  endLine: number;
  type: string;
  tokenCount: number;
}

const toCandidate = (doc: LeanChunk): CandidateChunk => ({
  id: String(doc._id),
  fileId: doc.fileId.toString(),
  content: doc.content,
  startLine: doc.startLine,
  endLine: doc.endLine,
  type: doc.type,
  tokenCount: doc.tokenCount,
});

export class ContextRetrieverService {
  async retrieve(
    reportId: string,
    questionType: QuestionType,
    keywords: string[],
    targetFile?: string,
    targetFunction?: string,
    /** Raw user question — embedded and used for semantic vector search when available. */
    rawQuery?: string,
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
      retrieval: {
        semanticAvailable: embeddingService.isConfigured(),
        semanticExecuted: false,
        keywordExecuted: false,
        candidatesConsidered: 0,
        selected: [],
      },
    };

    switch (questionType) {
      case 'project_overview':
        return this.retrieveForOverview(base, reportId, rawQuery);
      case 'architecture':
        return this.retrieveForArchitecture(base, reportId, rawQuery);
      case 'tech_stack':
        return this.retrieveForTechStack(base, reportId, keywords, rawQuery);
      case 'code_location':
        return this.retrieveForCodeLocation(base, reportId, keywords, rawQuery);
      case 'file_explain':
        return this.retrieveForFile(base, reportId, targetFile || '', rawQuery);
      case 'function_explain':
        return this.retrieveForFunction(base, reportId, targetFunction || '', rawQuery);
      case 'middleware':
        return this.retrieveForMiddleware(base, reportId, rawQuery);
      default:
        return this.retrieveGeneral(base, reportId, keywords, rawQuery);
    }
  }

  // ── hybrid core ────────────────────────────────────────────

  /**
   * Semantic candidates for the raw query. Returns `executed: false` (and no
   * candidates) when embeddings are unconfigured, when there is no query to
   * embed, or when the provider fails — callers then fall back to keyword
   * retrieval alone, which is why an embedding outage never breaks a question.
   */
  private async semanticCandidates(
    reportId: string,
    rawQuery?: string,
  ): Promise<{ executed: boolean; candidates: CandidateChunk[]; scores: Map<string, number> }> {
    const scores = new Map<string, number>();
    if (!rawQuery || !rawQuery.trim() || !embeddingService.isConfigured()) {
      return { executed: false, candidates: [], scores };
    }

    try {
      // Never compare the raw query against stored vectors without embedding it
      // with the SAME model that produced them (fetchEmbeddedChunks enforces the
      // modelKey filter, so vectors from another model/dimension are excluded).
      const queryVector = await embeddingService.embedQuery(rawQuery);
      const docs = await embeddingService.fetchEmbeddedChunks(reportId, SEMANTIC_CANDIDATE_LIMIT);
      if (docs.length === 0) return { executed: true, candidates: [], scores };

      const candidates = docs.map((doc) =>
        toCandidate(doc as unknown as LeanChunk),
      );
      for (const doc of docs) {
        // Cosine can be negative for opposed vectors; clamp so a negative
        // similarity can never rank below "no signal at all".
        scores.set(String(doc._id), Math.max(0, embeddingService.cosineSimilarity(queryVector, doc.embedding)));
      }

      logger.info(
        'Retriever: Semantic search scored ' + candidates.length + ' candidate chunks (top score ' +
        Math.max(...scores.values()).toFixed(3) + ')',
      );
      return { executed: true, candidates, scores };
    } catch (error) {
      // A provider outage degrades to keyword search — never fails the request.
      logger.warn('Retriever: Semantic search failed (' +
        (error instanceof Error ? error.message : String(error)).slice(0, 160) +
        ') — falling back to keyword search');
      return { executed: false, candidates: [], scores };
    }
  }

  /**
   * Merge semantic + keyword candidates, deduplicate by chunk id, rerank and
   * take the top MAX_CHUNKS.
   *
   * Ranking is `semantic cosine + keyword boost`, so a stronger semantic match
   * outranks a weaker one while an exact symbol/file match still gets promoted.
   * The best keyword-sourced chunk is guaranteed a slot so explicit
   * file/function questions never lose their exact match to a fuzzy vector hit.
   * With no embeddings available every semantic score is 0 and the order is
   * decided purely by keyword boost (the preserved fallback).
   */
  private async selectChunks(
    reportId: string,
    rawQuery: string | undefined,
    keyword: KeywordCandidate[],
    keywordExecuted: boolean,
  ): Promise<{ picked: CandidateChunk[]; diagnostics: RetrievalDiagnostics }> {
    const semantic = await this.semanticCandidates(reportId, rawQuery);

    const merged = new Map<string, MergedChunk>();
    for (const chunk of semantic.candidates) {
      merged.set(chunk.id, {
        chunk,
        semanticScore: semantic.scores.get(chunk.id) ?? 0,
        keywordBoost: 0,
        score: 0,
        sources: ['semantic'],
      });
    }
    for (const { chunk, boost } of keyword) {
      const existing = merged.get(chunk.id);
      if (existing) {
        existing.keywordBoost = Math.max(existing.keywordBoost, boost);
        if (!existing.sources.includes('keyword')) existing.sources.push('keyword');
      } else {
        merged.set(chunk.id, {
          chunk,
          semanticScore: null,
          keywordBoost: boost,
          score: 0,
          sources: ['keyword'],
        });
      }
    }

    for (const entry of merged.values()) {
      entry.score = (entry.semanticScore ?? 0) + entry.keywordBoost;
    }

    const ranked = [...merged.values()].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.semanticScore ?? -1) !== (a.semanticScore ?? -1)) {
        return (b.semanticScore ?? -1) - (a.semanticScore ?? -1);
      }
      if (b.chunk.tokenCount !== a.chunk.tokenCount) return b.chunk.tokenCount - a.chunk.tokenCount;
      return a.chunk.startLine - b.chunk.startLine;
    });

    const picked = ranked.slice(0, MAX_CHUNKS).map((entry) => entry.chunk);

    // Guarantee one exact keyword/symbol match survives, unless the picked set
    // already contains one. Explicit "explain file X" / symbol questions must
    // not be displaced entirely by fuzzy matches.
    const bestKeyword = ranked.find((entry) => entry.sources.includes('keyword'));
    if (bestKeyword && !picked.includes(bestKeyword.chunk)) {
      if (picked.length < MAX_CHUNKS) picked.push(bestKeyword.chunk);
      else picked[picked.length - 1] = bestKeyword.chunk;
    }

    const diagnostics: RetrievalDiagnostics = {
      semanticAvailable: embeddingService.isConfigured(),
      semanticExecuted: semantic.executed,
      keywordExecuted,
      candidatesConsidered: merged.size,
      selected: ranked
        .filter((entry) => picked.includes(entry.chunk))
        .map((entry) => ({
          chunkId: entry.chunk.id,
          filePath: '',
          startLine: entry.chunk.startLine,
          endLine: entry.chunk.endLine,
          type: entry.chunk.type,
          semanticScore: entry.semanticScore,
          keywordBoost: entry.keywordBoost,
          score: entry.score,
          sources: entry.sources,
        })),
    };

    return { picked, diagnostics };
  }

  /**
   * Run the hybrid selection for one branch, then resolve chunk content and
   * files, keeping the existing context limits.
   */
  private async applyHybrid(
    base: RetrievedContext,
    reportId: string,
    rawQuery: string | undefined,
    keyword: KeywordCandidate[],
    keywordExecuted: boolean,
    deriveFiles = true,
  ): Promise<RetrievedContext> {
    const { picked, diagnostics } = await this.selectChunks(reportId, rawQuery, keyword, keywordExecuted);

    const resolved = await this.resolveChunkFilePaths(picked);
    base.relevantChunks = resolved.chunks;

    // Report only what actually survived the context limits, with real paths.
    diagnostics.selected = diagnostics.selected
      .filter((s) => resolved.paths.has(s.chunkId))
      .map((s) => ({ ...s, filePath: resolved.paths.get(s.chunkId) || 'unknown' }));
    base.retrieval = diagnostics;

    if (deriveFiles && picked.length > 0) {
      const fileIds = [...new Set(picked.map((c) => c.fileId))];
      const files = await IndexedFile.find({ _id: { $in: fileIds } }).lean();
      base.relevantFiles = this.mergeFiles(base.relevantFiles, this.formatFiles(files));
    }

    return base;
  }

  /** Keep the branch's own matches first, then fill from chunk-derived files. */
  private mergeFiles(
    primary: RetrievedContext['relevantFiles'],
    extra: RetrievedContext['relevantFiles'],
  ): RetrievedContext['relevantFiles'] {
    const seen = new Set<string>();
    const merged: RetrievedContext['relevantFiles'] = [];
    for (const file of [...primary, ...extra]) {
      if (seen.has(file.path)) continue;
      seen.add(file.path);
      merged.push(file);
      if (merged.length >= MAX_FILES) break;
    }
    return merged;
  }

  /** Keyword candidates from chunk documents, ordered for stable comparison. */
  private async keywordChunks(
    reportId: string,
    filter: Record<string, unknown>,
    boost: number,
  ): Promise<KeywordCandidate[]> {
    const docs = (await IndexedChunk.find({ reportId, ...filter })
      .limit(MAX_CHUNKS * 5)
      .sort({ tokenCount: -1, _id: 1 })
      .lean()) as unknown as LeanChunk[];
    return docs.map((doc) => ({ chunk: toCandidate(doc), boost }));
  }

  // ── branches ───────────────────────────────────────────────

  private async retrieveForOverview(
    base: RetrievedContext,
    reportId: string,
    rawQuery?: string,
  ): Promise<RetrievedContext> {
    const files = await IndexedFile.find({ reportId })
      .limit(MAX_FILES)
      .sort({ size: -1 })
      .lean();
    base.relevantFiles = this.formatFiles(files);

    // No keyword/symbol lookup for an overview question, but semantic retrieval
    // is still available so the question text can steer what is shown.
    return this.applyHybrid(base, reportId, rawQuery, [], false, false);
  }

  private async retrieveForArchitecture(
    base: RetrievedContext,
    reportId: string,
    rawQuery?: string,
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
    const keyword = fileIds.length > 0
      ? await this.keywordChunks(reportId, { fileId: { $in: fileIds } }, KEYWORD_BOOST_CONTENT)
      : [];

    return this.applyHybrid(base, reportId, rawQuery, keyword, true);
  }

  private async retrieveForTechStack(
    base: RetrievedContext,
    reportId: string,
    keywords: string[],
    rawQuery?: string,
  ): Promise<RetrievedContext> {
    const terms = keywords.length > 0
      ? keywords
      : ['express', 'react', 'vue', 'angular', 'mongodb', 'postgres', 'jwt', 'passport', 'prisma', 'typeorm'];

    const files = await IndexedFile.find({
      reportId,
      $or: terms.map((term) => ({ imports: { $regex: term, $options: 'i' } })),
    })
      .limit(MAX_FILES)
      .lean();

    base.relevantFiles = this.formatFiles(files);

    const keyword = await this.keywordChunks(
      reportId,
      { $or: terms.map((term) => ({ content: { $regex: term, $options: 'i' } })) },
      KEYWORD_BOOST_CONTENT,
    );

    return this.applyHybrid(base, reportId, rawQuery, keyword, true);
  }

  private async retrieveForCodeLocation(
    base: RetrievedContext,
    reportId: string,
    keywords: string[],
    rawQuery?: string,
  ): Promise<RetrievedContext> {
    const searchTerms = keywords.length > 0
      ? keywords
      : ['generate', 'create', 'connect', 'init', 'config', 'setup', 'sign', 'token'];

    const keyword = await this.keywordChunks(
      reportId,
      { $or: searchTerms.map((term) => ({ content: { $regex: term, $options: 'i' } })) },
      KEYWORD_BOOST_CONTENT,
    );

    return this.applyHybrid(base, reportId, rawQuery, keyword, true);
  }

  private async retrieveForFile(
    base: RetrievedContext,
    reportId: string,
    targetFile: string,
    rawQuery?: string,
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
    // A named file is an exact match, so its chunks carry the symbol boost.
    const keyword = fileIds.length > 0
      ? await this.keywordChunks(reportId, { fileId: { $in: fileIds } }, KEYWORD_BOOST_SYMBOL)
      : [];

    return this.applyHybrid(base, reportId, rawQuery, keyword, true);
  }

  private async retrieveForFunction(
    base: RetrievedContext,
    reportId: string,
    targetFunction: string,
    rawQuery?: string,
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
    const docs = fileIds.length > 0
      ? ((await IndexedChunk.find({ reportId, fileId: { $in: fileIds } })
          .limit(MAX_CHUNKS * 5)
          .sort({ index: 1, _id: 1 })
          .lean()) as unknown as LeanChunk[])
      : [];

    const keyword: KeywordCandidate[] = docs.map((doc) => {
      const meta = (doc as unknown as { metadata?: Record<string, unknown> }).metadata || {};
      const name = (meta.functionName as string) || '';
      const exact = funcRegex.test(name) || funcRegex.test(doc.content);
      return { chunk: toCandidate(doc), boost: exact ? KEYWORD_BOOST_SYMBOL : KEYWORD_BOOST_CONTENT };
    });

    return this.applyHybrid(base, reportId, rawQuery, keyword, true);
  }

  private async retrieveForMiddleware(
    base: RetrievedContext,
    reportId: string,
    rawQuery?: string,
  ): Promise<RetrievedContext> {
    const searchTerms = ['middleware', 'app.use', 'router.use'];

    const keyword = await this.keywordChunks(
      reportId,
      { $or: searchTerms.map((term) => ({ content: { $regex: term, $options: 'i' } })) },
      KEYWORD_BOOST_CONTENT,
    );

    return this.applyHybrid(base, reportId, rawQuery, keyword, true);
  }

  private async retrieveGeneral(
    base: RetrievedContext,
    reportId: string,
    keywords: string[],
    rawQuery?: string,
  ): Promise<RetrievedContext> {
    let keyword: KeywordCandidate[] = [];
    if (keywords.length > 0) {
      keyword = await this.keywordChunks(
        reportId,
        { $or: keywords.map((term) => ({ content: { $regex: term, $options: 'i' } })) },
        KEYWORD_BOOST_CONTENT,
      );
    } else {
      const files = await IndexedFile.find({ reportId })
        .limit(MAX_FILES)
        .sort({ size: -1 })
        .lean();
      base.relevantFiles = this.formatFiles(files);
    }

    return this.applyHybrid(base, reportId, rawQuery, keyword, keywords.length > 0, keywords.length > 0);
  }

  // ── formatting ─────────────────────────────────────────────

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

  private async resolveChunkFilePaths(
    chunks: CandidateChunk[],
  ): Promise<{ chunks: RetrievedContext['relevantChunks']; paths: Map<string, string> }> {
    const paths = new Map<string, string>();
    if (chunks.length === 0) return { chunks: [], paths };

    const fileIds = [...new Set(chunks.map((c) => c.fileId))];
    const files = await IndexedFile.find({ _id: { $in: fileIds } })
      .select('_id path')
      .lean();

    const filePathMap = new Map(files.map((f) => [f._id.toString(), f.path]));

    // Deduplicate by file+range: the same code can be reached through both
    // signals, and sending it to the LLM twice only wastes context.
    const seen = new Set<string>();
    const unique = chunks.filter((c) => {
      const key = c.fileId + ':' + c.startLine + '-' + c.endLine;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const truncated = unique.map((c) => {
      const filePath = filePathMap.get(c.fileId) || 'unknown';
      paths.set(c.id, filePath);
      return {
        filePath,
        content: c.content.length > MAX_CHUNK_CONTENT_LENGTH
          ? c.content.slice(0, MAX_CHUNK_CONTENT_LENGTH) + '\n// ... [truncated]'
          : c.content,
        startLine: c.startLine,
        endLine: c.endLine,
        type: c.type,
        tokenCount: c.tokenCount,
      };
    });

    // If total content still exceeds limit, keep only the most relevant chunks
    let totalLen = truncated.reduce((sum, c) => sum + c.content.length, 0);
    while (totalLen > MAX_TOTAL_CONTENT_LENGTH && truncated.length > 1) {
      const removed = truncated.pop()!;
      totalLen -= removed.content.length;
    }

    // Drop paths for anything trimmed away so diagnostics match the payload.
    const keptIds = new Set(unique.slice(0, truncated.length).map((c) => c.id));
    for (const id of [...paths.keys()]) {
      if (!keptIds.has(id)) paths.delete(id);
    }

    return { chunks: truncated, paths };
  }
}

export const contextRetrieverService = new ContextRetrieverService();
