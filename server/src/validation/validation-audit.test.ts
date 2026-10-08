import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

/**
 * End-to-end RAG validation that runs offline and deterministically.
 *
 * The embedding *provider* is stubbed at the network boundary (global fetch),
 * so the real embedding service (dimension validation, modelKey tagging,
 * cosine similarity) and the real indexer / chunker / retriever all run
 * against a real MongoDB. A synthetic multi-module repository is generated on
 * disk, indexed, then queried; everything is written to a temp directory and
 * removed again in afterAll.
 */

const DIM = 2048;

/** Deterministic lexical vector: token counts hashed into the first DIM slots. */
function vectorFor(text: string): number[] {
  const vector = new Array<number>(DIM).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9_]+/g) || [];
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) % DIM;
    vector[h] += 1;
  }
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

vi.mock('../config/environment', () => ({ env: mockEnv }));
vi.mock('../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { indexerService } from '../indexer/indexer.service';
import { contextRetrieverService } from '../repo-intelligence/retriever.service';
import { queryClassifierService } from '../repo-intelligence/classifier.service';
import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import ImportedRepository from '../models/ImportedRepository';
import User from '../models/User';

const EMBEDDING_MODEL_KEY = 'nvidia:test/model';

// ── synthetic repo (kept small for a fast offline run) ────────────

interface Mod {
  path: string;
  purpose: string;
  imports?: { name: string; from: string }[];
  functions: { name: string; doc: string; body: string[] }[];
  cls?: { name: string; methods: { name: string; body: string }[] };
}

const MODULES: Mod[] = [
  {
    path: 'src/app.ts',
    purpose: 'Express application wiring.',
    imports: [{ name: 'createRouter', from: './routes' }],
    functions: [
      { name: 'createApp', doc: 'Build the Express application.', body: ['const app = express();', 'registerRoutes(app);', 'return app;'] },
      { name: 'registerRoutes', doc: 'Mount the API router.', body: ['app.use(createRouter());'] },
      { name: 'startServer', doc: 'Listen on the configured port.', body: ['return createApp().listen(5000);'] },
    ],
  },
  {
    path: 'src/db/mongo.service.ts',
    purpose: 'Primary MongoDB persistence layer.',
    imports: [{ name: 'MongoClient', from: 'mongodb' }],
    functions: [
      { name: 'connectMongo', doc: 'Open the persistent MongoDB connection.', body: ['const client = new MongoClient(uri);', 'return client.connect();'] },
      { name: 'getMongoClient', doc: 'Return the cached MongoClient.', body: ['return sharedClient;'] },
      { name: 'disconnectMongo', doc: 'Close the MongoDB connection.', body: ['return client.close();'] },
    ],
  },
  {
    path: 'src/auth/jwt.service.ts',
    purpose: 'JWT creation and validation.',
    imports: [{ name: 'jwt', from: 'jsonwebtoken' }],
    functions: [
      { name: 'generateAccessToken', doc: 'Sign a short-lived access token.', body: ['return jwt.sign(user, ACCESS_SECRET);'] },
      { name: 'verifyAccessToken', doc: 'Validate an access token.', body: ['return jwt.verify(token, ACCESS_SECRET);'] },
      { name: 'generateRefreshToken', doc: 'Sign a long-lived refresh token.', body: ['return jwt.sign(user, REFRESH_SECRET);'] },
    ],
  },
  {
    path: 'src/auth/oauth.service.ts',
    purpose: 'Google OAuth2 sign-in.',
    imports: [{ name: 'OAuth2Client', from: 'google-auth-library' }],
    functions: [
      { name: 'verifyGoogleToken', doc: 'Verify a Google ID token so a user can sign in without a password.', body: ['return verifyIdToken(idToken);'] },
      { name: 'exchangeOAuthCode', doc: 'Exchange an OAuth authorization code.', body: ['return exchangeCode(code);'] },
      { name: 'createOAuth2Client', doc: 'Create the Google OAuth2Client.', body: ['return new OAuth2Client(id);'] },
    ],
  },
  {
    path: 'src/api/users.controller.ts',
    purpose: 'User HTTP handlers.',
    imports: [{ name: 'generateAccessToken', from: '../auth/jwt.service' }],
    functions: [
      { name: 'registerUser', doc: 'Create a new account and issue tokens.', body: ['return createAccount(body);'] },
      { name: 'loginUser', doc: 'Authenticate credentials and return tokens.', body: ['return authenticate(body);'] },
      { name: 'getUserProfile', doc: 'Return the current profile.', body: ['return loadProfile(userId);'] },
    ],
  },
];

function render(mod: Mod): string {
  const out: string[] = [`// ${mod.purpose}`, ''];
  for (const imp of mod.imports || []) out.push(`import { ${imp.name} } from '${imp.from}';`);
  if (mod.imports?.length) out.push('');
  for (const f of mod.functions) {
    out.push(`// ${f.doc}`);
    out.push(`export function ${f.name}(input: unknown): unknown {`);
    for (const line of f.body) out.push('  ' + line);
    out.push('}');
    out.push('');
  }
  if (mod.cls) {
    out.push(`// ${mod.cls.name} helper.`);
    out.push(`export class ${mod.cls.name} {`);
    for (const m of mod.cls.methods) {
      out.push(`  ${m.name}(input: unknown): unknown {`);
      out.push(`    ${m.body}`);
      out.push('  }');
      out.push('');
    }
    out.push('}');
    out.push('');
  }
  return out.join('\n');
}

const FILLER_DOMAINS = Array.from({ length: 12 }, (_, i) => `domain${i}`);
function fillerModule(domain: string): Mod {
  return {
    path: `src/modules/${domain}/${domain}.service.ts`,
    purpose: `${domain} domain service.`,
    imports: [{ name: 'logger', from: '../../utils/logger' }],
    functions: Array.from({ length: 6 }, (_, i) => ({
      name: `handle${domain}Operation${i}`,
      doc: `Handle ${domain} operation ${i}.`,
      body: [`return execute(${i});`],
    })),
    cls: {
      name: `${domain}Repository`,
      methods: [{ name: 'find', body: 'return lookup();' }],
    },
  };
}

const ALL_MODULES = [...MODULES, ...FILLER_DOMAINS.map(fillerModule)];

async function generateRepository(root: string): Promise<void> {
  for (const mod of ALL_MODULES) {
    const full = path.join(root, mod.path);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, render(mod), 'utf-8');
  }
}

// ── state ────────────────────────────────────────────────────────

let mongo: MongoMemoryServer;
let tmpRoot: string;
let repoDir: string;
let userId: mongoose.Types.ObjectId;
let reportId: string;

/** Stub the embedding provider at the network boundary with deterministic vectors. */
function stubEmbeddingFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: { body?: string }) => {
      const parsed = JSON.parse(String(init?.body || '{}')) as { input?: string[] };
      const input = parsed.input || [];
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: input.map((text, index) => ({ index, embedding: vectorFor(text) })) }),
      } as unknown as Response;
    }),
  );
}

describe('RAG validation audit (offline)', () => {
  beforeAll(async () => {
    // Stub the embedding network boundary before indexing runs.
    stubEmbeddingFetch();
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    tmpRoot = path.join(os.tmpdir(), `devmind-validation-${Date.now()}`);
    repoDir = path.join(tmpRoot, 'repo');
    await fs.mkdir(repoDir, { recursive: true });
    await generateRepository(repoDir);

    const user = await User.create({
      email: `validation-${Date.now()}@example.com`,
      username: `validation${Date.now()}`.slice(0, 30),
      name: 'Validation User',
      password: 'ValidationPass123!',
    });
    userId = user._id;

    const repo = await ImportedRepository.create({
      userId,
      githubId: 1,
      fullName: 'validation/synthetic-repo',
      name: 'synthetic-repo',
      owner: { id: 1, login: 'validation', avatarUrl: '' },
      description: 'synthetic validation repo',
      url: 'https://github.com/validation/synthetic-repo',
      isPrivate: false,
      defaultBranch: 'main',
      language: 'typescript',
      topics: [],
      stars: 0,
      forks: 0,
      openIssues: 0,
      permissions: { admin: true, push: true, pull: true },
    });

    const result = await indexerService.indexRepository(userId.toString(), repo._id.toString(), repoDir);
    reportId = result.reportId;
  }, 120_000);

  afterAll(async () => {
    try {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    } finally {
      await mongo.stop();
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  }, 60_000);

  beforeEach(() => stubEmbeddingFetch());

  afterEach(() => vi.unstubAllGlobals());

  it('indexes every file and embeds every chunk with the configured model', async () => {
    const report = await IndexReport.findById(reportId);
    expect(report!.status).toBe('completed');
    expect(report!.fileCount).toBe(ALL_MODULES.length);

    const chunks = await IndexedChunk.find({ reportId });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.reportId.toString() === reportId)).toBe(true);
    expect(chunks.every((c) => Array.isArray(c.embedding) && c.embedding!.length === DIM)).toBe(true);
    expect(chunks.every((c) => c.embeddingModel === EMBEDDING_MODEL_KEY)).toBe(true);
  });

  it('captures all functions in a file (parser regression: not just the first)', async () => {
    const jwt = await IndexedFile.findOne({ reportId, path: /jwt\.service\.ts$/ });
    expect(jwt).toBeTruthy();
    const names = jwt!.functions.map((f) => f.name);
    expect(names).toEqual(
      expect.arrayContaining(['generateAccessToken', 'verifyAccessToken', 'generateRefreshToken']),
    );
    // Each function's range must cover more than its declaration line.
    expect(jwt!.functions.every((f) => f.endLine > f.startLine)).toBe(true);
  });

  it('folds a symbol\u2019s leading doc comment into its chunk', async () => {
    const chunk = await IndexedChunk.findOne({
      reportId,
      'metadata.functionName': 'connectMongo',
    });
    expect(chunk).toBeTruthy();
    expect(chunk!.content).toContain('Open the persistent MongoDB connection');
    expect(chunk!.content).toContain('new MongoClient(uri)');
  });

  it('retrieves the right chunk for keyword, semantic and file queries within the context limits', async () => {
    const queries = [
      { query: 'Where is the MongoDB connection established?', expectPath: 'mongo.service.ts', expectText: 'connectMongo' },
      { query: 'How does the system sign a user in without a password?', expectPath: 'oauth.service.ts', expectText: 'verifyGoogleToken' },
      { query: 'Explain the file jwt.service.ts', expectPath: 'jwt.service.ts', expectText: 'verifyAccessToken' },
    ];

    for (const q of queries) {
      const classification = queryClassifierService.classify(q.query);
      const ctx = await contextRetrieverService.retrieve(
        reportId, classification.type, classification.keywords,
        classification.targetFile, classification.targetFunction, q.query,
      );

      expect(ctx.relevantChunks.length).toBeGreaterThan(0);
      expect(ctx.relevantChunks.length).toBeLessThanOrEqual(4);
      expect(ctx.relevantFiles.length).toBeLessThanOrEqual(3);
      const total = ctx.relevantChunks.reduce((s, c) => s + c.content.length, 0);
      expect(total).toBeLessThanOrEqual(3000);
      expect(ctx.relevantChunks.every((c) => c.content.length <= 820)).toBe(true);

      // Deduplication: no chunk appears twice.
      const keys = ctx.relevantChunks.map((c) => `${c.filePath}:${c.startLine}-${c.endLine}`);
      expect(new Set(keys).size).toBe(keys.length);

      // The correct file's chunk is present with its answer text.
      const hits = ctx.relevantChunks.filter(
        (c) => c.filePath.replace(/\\/g, '/').endsWith(q.expectPath) && c.content.includes(q.expectText),
      );
      expect(hits.length, `${q.query} should surface ${q.expectText}`).toBeGreaterThan(0);
    }
  });

  it('keeps reports isolated at query time', async () => {
    const foreignReport = await IndexReport.create({
      repositoryId: new mongoose.Types.ObjectId(),
      userId,
      status: 'completed',
      summary: 'foreign',
      folderStructure: [],
      fileCount: 1,
      chunkCount: 1,
    });
    const foreignFile = await IndexedFile.create({
      reportId: foreignReport._id,
      path: 'src/foreign/secret.ts',
      name: 'secret.ts',
      language: 'typescript',
      size: 50,
      functions: [{ name: 'FOREIGN_ONLY', startLine: 1, endLine: 2 }],
      classes: [],
      imports: [],
      exports: [],
      dependencies: [],
    });
    await IndexedChunk.create({
      reportId: foreignReport._id,
      fileId: foreignFile._id,
      index: 0,
      content: 'export function FOREIGN_ONLY() {}',
      startLine: 1,
      endLine: 2,
      type: 'function',
      metadata: { functionName: 'FOREIGN_ONLY' },
      embedding: vectorFor('FOREIGN_ONLY'),
      embeddingModel: EMBEDDING_MODEL_KEY,
      tokenCount: 5,
    });

    const ctx = await contextRetrieverService.retrieve(
      reportId, 'general', ['foreign'], undefined, undefined, 'Where is FOREIGN_ONLY defined?',
    );
    expect(ctx.relevantChunks.every((c) => !c.content.includes('FOREIGN_ONLY'))).toBe(true);
    expect(ctx.relevantFiles.every((f) => !f.path.includes('secret.ts'))).toBe(true);

    // indexerService.getReport scopes by user.
    const otherUser = await User.create({
      email: `other-${Date.now()}@example.com`,
      username: `other${Date.now()}`.slice(0, 30),
      name: 'Other',
      password: 'ValidationPass123!',
    });
    expect(await indexerService.getReport(reportId, otherUser._id.toString())).toBeNull();
  });
});
