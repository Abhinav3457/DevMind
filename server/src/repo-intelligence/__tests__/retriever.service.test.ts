import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * The embedding *provider* is stubbed at the network boundary (global fetch), so
 * the real embedding.service (modelKey filtering, cosine similarity) and the
 * real retriever/merge/rerank logic all run against a real MongoDB.
 */
const DIM = 2048;
function vectorFor(text: string): number[] {
  const vector = new Array<number>(DIM).fill(0);
  const t = text.toLowerCase();
  if (t.includes('auth-topic')) vector[0] = 1;
  else if (t.includes('db-topic')) vector[1] = 1;
  else vector[2] = 1;
  return vector;
}

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    NODE_ENV: 'test',
    PORT: 0,
    MONGODB_URI: '',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '7d',
    JWT_REFRESH_SECRET: 'test-refresh',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CLIENT_URL: 'http://localhost:5173',
    CLOUDINARY_CLOUD_NAME: '',
    CLOUDINARY_API_KEY: '',
    CLOUDINARY_API_SECRET: '',
    SMTP_HOST: '',
    SMTP_PORT: 0,
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM: '',
    GEMINI_API_KEY: '',
    GROQ_API_KEY: '',
    NVIDIA_API_KEY: 'test-key',
    NVIDIA_EMBEDDING_MODEL: 'test/model',
    EMBEDDING_PROVIDER: 'nvidia',
    GITHUB_TOKEN: '',
    GITHUB_CLIENT_ID: '',
    GITHUB_CLIENT_SECRET: '',
    GITHUB_CALLBACK_URL: '',
    SOCKET_CORS_ORIGIN: 'http://localhost:5173',
  },
}));

vi.mock('../../config/environment', () => ({ env: mockEnv }));
vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { contextRetrieverService } from '../retriever.service';
import { promptBuilderService } from '../prompt-builder.service';
import { embeddingService } from '../../services/embedding';
import IndexReport from '../../models/IndexReport';
import IndexedFile from '../../models/IndexedFile';
import IndexedChunk from '../../models/IndexedChunk';

const EMBEDDING_MODEL_KEY = 'nvidia:test/model';
const QUERY = 'where is auth-topic used';
/** Comfortably more chunks than a single semantic candidate page. */
const NOISE_CHUNKS = 260;

let mongo: MongoMemoryServer;

const AUTH_MARKER = 'auth-topic';
const DB_MARKER = 'db-topic';

async function seedReport(options: {
  path: string;
  chunks: Array<{
    content: string;
    startLine: number;
    endLine: number;
    type: string;
    metadata?: Record<string, unknown>;
    /** false = chunk exists but has no vector yet (e.g. embedded after indexing failed). */
    embedded?: boolean;
  }>;
}): Promise<{ reportId: string; userId: string; fileId: string }> {
  const report = await IndexReport.create({
    repositoryId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    status: 'completed',
    summary: 'fixture repo',
    techStack: { authentication: ['jwt'], databases: ['mongodb'], frameworks: [], libraries: [], envVars: [] },
    folderStructure: [],
    fileCount: 1,
    chunkCount: options.chunks.length,
  });

  const file = await IndexedFile.create({
    reportId: report._id,
    path: options.path,
    name: options.path.split('/').pop(),
    language: 'typescript',
    size: 100,
    functions: [{ name: 'verifyToken', startLine: 1, endLine: 3 }],
    classes: [],
    imports: ['jsonwebtoken', 'mongoose'],
    exports: [],
    dependencies: ['jsonwebtoken', 'mongoose'],
  });

  for (const [index, chunk] of options.chunks.entries()) {
    await IndexedChunk.create({
      reportId: report._id,
      fileId: file._id,
      index,
      content: chunk.content,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      type: chunk.type,
      metadata: chunk.metadata || {},
      embedding: chunk.embedded === false ? null : vectorFor(chunk.content),
      embeddingModel: chunk.embedded === false ? null : EMBEDDING_MODEL_KEY,
      tokenCount: 10,
    });
  }

  return {
    reportId: report._id.toString(),
    userId: report.userId.toString(),
    fileId: file._id.toString(),
  };
}

const markerOf = (content: string) => {
  if (content.includes(AUTH_MARKER) && content.includes(DB_MARKER)) return 'BOTH';
  if (content.includes(AUTH_MARKER)) return 'SEMANTIC_ONLY';
  if (content.includes(DB_MARKER)) return 'KEYWORD_ONLY';
  return 'UNRELATED';
};

describe('ContextRetrieverService (hybrid retrieval)', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      IndexReport.deleteMany({}),
      IndexedFile.deleteMany({}),
      IndexedChunk.deleteMany({}),
    ]);
    mockEnv.EMBEDDING_PROVIDER = 'nvidia';
    mockEnv.NVIDIA_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: { body?: string }) => {
        const parsed = JSON.parse(String(init?.body || '{}')) as { input?: string[] };
        const input = parsed.input || [];
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: input.map((text, index) => ({ index, embedding: vectorFor(text) })),
          }),
        } as unknown as Response;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * A: semantically near, not matched by the keyword query.
   * B: matched by the keyword query, orthogonal to the query vector.
   * C: matched by both signals.
   * D: matched by the keyword query but has no vector yet.
   */
  async function seedHybridFixture() {
    return seedReport({
      path: 'src/auth.ts',
      chunks: [
        { content: `// ${AUTH_MARKER}\nexport function verifyToken() { return true; }`, startLine: 1, endLine: 3, type: 'function', metadata: { functionName: 'verifyToken' } },
        { content: `// ${DB_MARKER}\nreturn mongoose.connection;`, startLine: 5, endLine: 6, type: 'section' },
        { content: `// ${AUTH_MARKER} and ${DB_MARKER}\nreturn mongoose.connection;`, startLine: 8, endLine: 9, type: 'section' },
        { content: `// ${DB_MARKER}\nreturn mongoose.connection; // not embedded yet`, startLine: 11, endLine: 12, type: 'section', embedded: false },
      ],
    });
  }

  it('uses semantic retrieval for question types that used to be regex-only', async () => {
    const { reportId } = await seedHybridFixture();

    const types = ['tech_stack', 'architecture', 'file_explain', 'function_explain', 'middleware', 'project_overview'] as const;

    for (const type of types) {
      const ctx = await contextRetrieverService.retrieve(reportId, type, [], undefined, undefined, QUERY);
      expect(ctx.retrieval.semanticAvailable).toBe(true);
      expect(ctx.retrieval.semanticExecuted, `semantic should run for ${type}`).toBe(true);
    }
  });

  it('retrieves a semantically-near chunk that the keyword query does not match', async () => {
    const { reportId } = await seedHybridFixture();

    // Keyword terms deliberately match nothing in the fixture.
    const ctx = await contextRetrieverService.retrieve(reportId, 'tech_stack', ['zzz-no-match'], undefined, undefined, QUERY);

    expect(ctx.retrieval.semanticExecuted).toBe(true);
    expect(ctx.relevantChunks.map((c) => markerOf(c.content))).toContain('SEMANTIC_ONLY');
    expect(ctx.retrieval.selected[0]!.sources).toEqual(['semantic']);
    expect(ctx.retrieval.selected[0]!.semanticScore).toBeCloseTo(1, 6);
  });

  it('merges both signals, deduplicates and prefers the stronger semantic match', async () => {
    const { reportId } = await seedHybridFixture();

    const ctx = await contextRetrieverService.retrieve(reportId, 'tech_stack', ['connection'], undefined, undefined, QUERY);
    const markers = ctx.relevantChunks.map((c) => markerOf(c.content));

    // Both signals contributed, and the answer is reranked semantic-first.
    expect(markers).toContain('SEMANTIC_ONLY');
    expect(markers).toContain('KEYWORD_ONLY');
    expect(markers[0]).toBe('BOTH');

    const both = ctx.retrieval.selected.find((s) => s.filePath.endsWith('src/auth.ts') && s.sources.length === 2);
    expect(both, 'a chunk matched by both signals is reported once with both sources').toBeDefined();
    expect(both!.sources.sort()).toEqual(['keyword', 'semantic']);
    expect(both!.keywordBoost).toBeCloseTo(0.1, 6);
    expect(both!.score).toBeCloseTo(1.1, 6);

    const semanticOnly = ctx.retrieval.selected.find((s) => s.sources.length === 1 && s.sources[0] === 'semantic')!;
    const keywordOnly = ctx.retrieval.selected.find((s) => s.sources.length === 1 && s.sources[0] === 'keyword')!;
    expect(semanticOnly.semanticScore).toBeCloseTo(1, 6);
    expect(semanticOnly.keywordBoost).toBe(0);
    // A chunk with no vector yet is still reachable through the keyword signal.
    expect(keywordOnly.semanticScore).toBeNull();
    expect(keywordOnly.keywordBoost).toBeCloseTo(0.1, 6);
    expect(semanticOnly.score).toBeCloseTo(1, 6);
    expect(keywordOnly.score).toBeCloseTo(0.1, 6);
    // Semantic similarity is the dominant signal; the keyword hit still ranks.
    expect(semanticOnly.score).toBeGreaterThan(keywordOnly.score);

    // No duplicates reach the LLM.
    const keys = ctx.relevantChunks.map((c) => `${c.filePath}:${c.startLine}-${c.endLine}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('collapses duplicate chunks with the same file and line range', async () => {
    const { reportId } = await seedReport({
      path: 'src/auth.ts',
      chunks: [
        { content: `// ${AUTH_MARKER}\nfirst copy`, startLine: 1, endLine: 3, type: 'function' },
        { content: `// ${AUTH_MARKER}\nsecond copy`, startLine: 1, endLine: 3, type: 'function' },
      ],
    });

    const ctx = await contextRetrieverService.retrieve(reportId, 'tech_stack', [], undefined, undefined, QUERY);

    expect(ctx.relevantChunks).toHaveLength(1);
    expect(ctx.relevantChunks[0]!.startLine).toBe(1);
  });

  it('keeps repositories isolated', async () => {
    const other = await seedReport({
      path: 'src/other.ts',
      chunks: [{ content: `// ${AUTH_MARKER} leaked from another report`, startLine: 1, endLine: 2, type: 'section' }],
    });
    const mine = await seedHybridFixture();

    const ctx = await contextRetrieverService.retrieve(mine.reportId, 'tech_stack', [], undefined, undefined, QUERY);

    expect(ctx.relevantChunks.length).toBeGreaterThan(0);
    expect(ctx.relevantChunks.every((c) => !c.content.includes('leaked'))).toBe(true);
    expect(ctx.relevantFiles.every((f) => !f.path.includes('other.ts'))).toBe(true);
    expect(ctx.retrieval.selected.every((s) => !s.filePath.includes('other.ts'))).toBe(true);

    // The other report is still retrievable on its own.
    const otherCtx = await contextRetrieverService.retrieve(other.reportId, 'tech_stack', [], undefined, undefined, QUERY);
    expect(otherCtx.relevantChunks.some((c) => c.content.includes('leaked'))).toBe(true);
  });

  it('falls back to keyword retrieval when embeddings are unavailable', async () => {
    const { reportId } = await seedHybridFixture();
    mockEnv.EMBEDDING_PROVIDER = '';

    const ctx = await contextRetrieverService.retrieve(reportId, 'tech_stack', ['connection'], undefined, undefined, QUERY);
    const markers = ctx.relevantChunks.map((c) => markerOf(c.content));

    expect(ctx.retrieval.semanticAvailable).toBe(false);
    expect(ctx.retrieval.semanticExecuted).toBe(false);
    expect(ctx.retrieval.keywordExecuted).toBe(true);
    // Keyword hits still reach the context; the semantic-only chunk cannot.
    expect(markers).toContain('KEYWORD_ONLY');
    expect(markers).not.toContain('SEMANTIC_ONLY');
    expect(ctx.retrieval.selected.every((s) => s.semanticScore === null)).toBe(true);
  });

  it('falls back to keyword retrieval when the embedding provider errors', async () => {
    const { reportId } = await seedHybridFixture();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, statusText: 'boom', text: async () => 'boom' }) as unknown as Response),
    );

    const ctx = await contextRetrieverService.retrieve(reportId, 'code_location', ['connection'], undefined, undefined, QUERY);

    expect(ctx.retrieval.semanticExecuted).toBe(false);
    expect(ctx.relevantChunks.map((c) => markerOf(c.content))).toContain('KEYWORD_ONLY');
  }, 30000);

  it('gives an exact file match weight and keeps it even when embeddings are on', async () => {
    const { reportId } = await seedHybridFixture();

    const ctx = await contextRetrieverService.retrieve(reportId, 'file_explain', [], 'auth', undefined, QUERY);

    expect(ctx.retrieval.keywordExecuted).toBe(true);
    const boosted = ctx.retrieval.selected.find((s) => s.keywordBoost > 0.2);
    expect(boosted, 'named file chunks carry the symbol boost').toBeDefined();
    expect(ctx.relevantFiles.some((f) => f.path.endsWith('src/auth.ts'))).toBe(true);
  });

  it('places the selected chunks into the LLM prompt', async () => {
    const { reportId } = await seedHybridFixture();

    const ctx = await contextRetrieverService.retrieve(reportId, 'tech_stack', ['connection'], undefined, undefined, QUERY);
    const { userPrompt } = promptBuilderService.build({
      question: QUERY,
      questionType: 'tech_stack',
      context: ctx,
      targetFile: undefined,
      targetFunction: undefined,
    });

    expect(ctx.relevantChunks.length).toBeGreaterThan(0);
    for (const chunk of ctx.relevantChunks) {
      const marker = chunk.content.split('\n')[0]!.trim();
      expect(userPrompt, `prompt should include ${marker}`).toContain(marker.slice(0, 20));
    }
  });

  it('reports the embedding model key the vectors are compared against', async () => {
    expect(embeddingService.getProvider().modelKey).toBe(EMBEDDING_MODEL_KEY);
  });

  /**
   * Regression guard for large repositories: semantic search must score every
   * embedded chunk of a report, not just an arbitrary first page. The best
   * match here is inserted last, so a candidate cap would leave it unscored and
   * force the question onto the keyword path.
   */
  it('finds the best semantic match in a report larger than one candidate page', async () => {
    const report = await IndexReport.create({
      repositoryId: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      status: 'completed',
      summary: 'large fixture repo',
      techStack: { authentication: [], databases: [], frameworks: [], libraries: [], envVars: [] },
      folderStructure: [],
      fileCount: 1,
      chunkCount: NOISE_CHUNKS + 1,
    });

    const file = await IndexedFile.create({
      reportId: report._id,
      path: 'src/big/noise.ts',
      name: 'noise.ts',
      language: 'typescript',
      size: 1000,
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      dependencies: [],
    });

    const docs: Record<string, unknown>[] = [];
    for (let i = 0; i < NOISE_CHUNKS; i++) {
      const content = `// filler block ${i}\nreturn call(${i});`;
      docs.push({
        reportId: report._id,
        fileId: file._id,
        index: i,
        content,
        startLine: i * 2 + 1,
        endLine: i * 2 + 2,
        type: 'section',
        metadata: {},
        embedding: vectorFor(content),
        embeddingModel: EMBEDDING_MODEL_KEY,
        tokenCount: 10,
      });
    }

    // Inserted last: invisible to any "first N" page of candidates.
    const targetLine = NOISE_CHUNKS * 2 + 1;
    docs.push({
      reportId: report._id,
      fileId: file._id,
      index: NOISE_CHUNKS,
      content: `// ${AUTH_MARKER}\nexport function verifyToken() { return true; }`,
      startLine: targetLine,
      endLine: targetLine + 1,
      type: 'function',
      metadata: { functionName: 'verifyToken' },
      embedding: vectorFor(AUTH_MARKER),
      embeddingModel: EMBEDDING_MODEL_KEY,
      tokenCount: 10,
    });
    await IndexedChunk.insertMany(docs);

    // Keyword terms deliberately match nothing: the answer can only come from vectors.
    const ctx = await contextRetrieverService.retrieve(
      report._id.toString(),
      'tech_stack',
      ['zzz-no-match'],
      undefined,
      undefined,
      QUERY,
    );

    expect(ctx.retrieval.semanticExecuted).toBe(true);
    expect(ctx.retrieval.candidatesConsidered).toBe(NOISE_CHUNKS + 1);
    expect(ctx.relevantChunks[0]!.content).toContain(AUTH_MARKER);
    expect(ctx.retrieval.selected[0]!.semanticScore).toBeCloseTo(1, 6);
    expect(ctx.relevantChunks[0]!.content).not.toContain('filler block');
  });
});
