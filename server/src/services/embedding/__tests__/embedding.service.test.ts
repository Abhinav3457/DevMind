import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockEnv, mockFind, mockBulkWrite } = vi.hoisted(() => ({
  mockEnv: {
    EMBEDDING_PROVIDER: 'nvidia',
    NVIDIA_API_KEY: '',
    GEMINI_API_KEY: 'test-gemini-key',
    NVIDIA_EMBEDDING_MODEL: 'nvidia/nemotron-3-embed-1b',
  },
  mockFind: vi.fn(),
  mockBulkWrite: vi.fn(),
}));

vi.mock('../../../config/environment', () => ({ env: mockEnv }));

// The service imports IndexedChunk only for chunk persistence paths.
vi.mock('../../../models/IndexedChunk', () => ({
  default: { find: (...args: unknown[]) => mockFind(...args), bulkWrite: mockBulkWrite },
}));

import { embeddingService } from '../embedding.service';
import { NEMOTRON_EMBEDDING_DIMENSIONS } from '../nvidia-nemotron.provider';

function nvidiaResponse(vectors: number[][]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: vectors.map((embedding, index) => ({ index, embedding })),
      model: 'nvidia/nemotron-3-embed-1b',
    }),
    text: async () => '',
  };
}

function makeVector(dims: number, fill = 0.5): number[] {
  return Array.from({ length: dims }, () => fill);
}

describe('EmbeddingService (NVIDIA Nemotron)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFind.mockReset();
    mockBulkWrite.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('isConfigured() is false when no API key is set', () => {
    mockEnv.EMBEDDING_PROVIDER = 'nvidia';
    mockEnv.NVIDIA_API_KEY = '';
    expect(embeddingService.isConfigured()).toBe(false);
  });

  it('isConfigured() is true when provider and key are set', () => {
    mockEnv.EMBEDDING_PROVIDER = 'nvidia';
    mockEnv.NVIDIA_API_KEY = 'nvapi-test';
    expect(embeddingService.isConfigured()).toBe(true);
  });

  it('throws a useful error for embedQuery when NVIDIA_API_KEY is missing', async () => {
    mockEnv.EMBEDDING_PROVIDER = 'nvidia';
    mockEnv.NVIDIA_API_KEY = '';

    await expect(embeddingService.embedQuery('Where is JWT implemented?')).rejects.toThrow(/NVIDIA_API_KEY/);
  });

  it('throws for an unknown EMBEDDING_PROVIDER value', async () => {
    mockEnv.EMBEDDING_PROVIDER = 'openai';
    await expect(embeddingService.embedQuery('test')).rejects.toThrow(/Unknown EMBEDDING_PROVIDER/);
    mockEnv.EMBEDDING_PROVIDER = 'nvidia';
  });

  it('generates a 2048-dimension query embedding and sends input_type=query', async () => {
    mockEnv.NVIDIA_API_KEY = 'nvapi-test';
    const mockFetch = vi.fn().mockResolvedValue(nvidiaResponse([makeVector(NEMOTRON_EMBEDDING_DIMENSIONS)]));
    vi.stubGlobal('fetch', mockFetch);

    const vector = await embeddingService.embedQuery('Where is JWT implemented?');

    expect(vector).toHaveLength(NEMOTRON_EMBEDDING_DIMENSIONS);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/embeddings');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('nvidia/nemotron-3-embed-1b');
    expect(body.input_type).toBe('query');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer nvapi-test');
  });

  it('retries rate limits (429) and succeeds on a later attempt', async () => {
    vi.useFakeTimers();
    mockEnv.NVIDIA_API_KEY = 'nvapi-test';
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests', text: async () => 'rate limited' })
      .mockResolvedValueOnce(nvidiaResponse([makeVector(NEMOTRON_EMBEDDING_DIMENSIONS)]));
    vi.stubGlobal('fetch', mockFetch);

    const pending = embeddingService.embedQuery('test query');
    await vi.advanceTimersByTimeAsync(3100); // first retry backoff

    const vector = await pending;
    expect(vector).toHaveLength(NEMOTRON_EMBEDDING_DIMENSIONS);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('fails permanently on non-transient errors without retrying', async () => {
    mockEnv.NVIDIA_API_KEY = 'nvapi-bad';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'invalid api key',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(embeddingService.embedQuery('test')).rejects.toThrow(/HTTP 401/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('validates embedding dimensions and rejects wrong-length vectors', async () => {
    mockEnv.NVIDIA_API_KEY = 'nvapi-test';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(nvidiaResponse([makeVector(768)])), // e.g. wrong model served
    );

    await expect(embeddingService.embedQuery('test')).rejects.toThrow(
      /expected 2048 dimensions, got 768/,
    );
  });

  it('rejects malformed embedding responses (non-numeric vectors)', async () => {
    mockEnv.NVIDIA_API_KEY = 'nvapi-test';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [{ index: 0, embedding: 'nope' }] }) }),
    );

    await expect(embeddingService.embedQuery('test')).rejects.toThrow(/not a numeric array|vectors, received/);
  });

  it('embeds repository chunks as passages and tags them with the model key', async () => {
    mockEnv.NVIDIA_API_KEY = 'nvapi-test';
    mockFind.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            { _id: 'c1', content: 'function signJwt() {...}' },
            { _id: 'c2', content: 'mongoose.connect(...)' },
          ]),
      }),
    });
    mockBulkWrite.mockResolvedValue({});
    const mockFetch = vi.fn().mockResolvedValue(nvidiaResponse([
      makeVector(NEMOTRON_EMBEDDING_DIMENSIONS, 0.1),
      makeVector(NEMOTRON_EMBEDDING_DIMENSIONS, 0.2),
    ]));
    vi.stubGlobal('fetch', mockFetch);

    const count = await embeddingService.embedChunksForReport('report123');

    expect(count).toBe(2);
    // Chunks must be embedded as passages, not queries
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).input_type).toBe('passage');

    const ops = mockBulkWrite.mock.calls[0][0];
    expect(ops[0].updateOne.update.$set.embeddingModel).toBe('nvidia:nvidia/nemotron-3-embed-1b');
    expect(ops[0].updateOne.update.$set.embedding).toHaveLength(NEMOTRON_EMBEDDING_DIMENSIONS);
  });

  it('only compares chunks embedded with the current provider model', async () => {
    mockEnv.NVIDIA_API_KEY = 'nvapi-test';
    mockFind.mockImplementation((filter: { embeddingModel?: string }) => {
      // Capture the filter so we can assert vectors from other models are excluded
      mockFind.lastFilter = filter;
      return { select: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) };
    });

    const chunks = await embeddingService.fetchEmbeddedChunks('report123');
    expect(chunks).toEqual([]);
    expect((mockFind as unknown as { lastFilter: { embeddingModel: string } }).lastFilter.embeddingModel).toBe(
      'nvidia:nvidia/nemotron-3-embed-1b',
    );
  });

  it('computes cosine similarity correctly', () => {
    expect(embeddingService.cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(embeddingService.cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(embeddingService.cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(embeddingService.cosineSimilarity([], [])).toBe(0);
    expect(embeddingService.cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});
