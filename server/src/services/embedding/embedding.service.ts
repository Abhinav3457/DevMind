import { env } from '../../config/environment';
import logger from '../../utils/logger';
import IndexedChunk from '../../models/IndexedChunk';
import { EmbeddingProvider } from './embedding-provider';
import { NvidiaNemotronEmbeddingProvider } from './nvidia-nemotron.provider';
import { GeminiEmbeddingProvider } from './gemini.provider';

export { NEMOTRON_EMBEDDING_DIMENSIONS } from './nvidia-nemotron.provider';
export type { EmbeddingProvider, EmbeddingInputType } from './embedding-provider';

/** A chunk carrying a vector produced by the current provider model. */
export interface EmbeddedChunk {
  _id: unknown;
  fileId: { toString(): string };
  content: string;
  startLine: number;
  endLine: number;
  type: string;
  tokenCount: number;
  embedding: number[];
}

/**
 * Facade over the configured embedding provider.
 *
 * - Selected through EMBEDDING_PROVIDER ('nvidia' | 'gemini'; empty = disabled).
 * - Chunks are embedded as 'passage', user queries as 'query'.
 * - Every stored vector is tagged with provider.modelKey so vectors produced
 *   by different models/dimensions are never mixed during vector search.
 * - Failures throw descriptive errors; callers (indexer, retriever) decide
 *   whether to degrade gracefully — this service never crashes the server.
 */
export class EmbeddingService {
  private cachedProvider: EmbeddingProvider | null = null;
  private cachedProviderName: string | null = null;

  /** True when a known provider is selected AND its API key is present. */
  isConfigured(): boolean {
    const name = env.EMBEDDING_PROVIDER.trim().toLowerCase();
    if (name === 'nvidia') return !!env.NVIDIA_API_KEY;
    if (name === 'gemini') return !!env.GEMINI_API_KEY;
    return false;
  }

  getProvider(): EmbeddingProvider {
    const name = env.EMBEDDING_PROVIDER.trim().toLowerCase();

    if (!name) {
      throw new Error(
        'No embedding provider configured. Set EMBEDDING_PROVIDER=nvidia (plus NVIDIA_API_KEY) in your .env file.',
      );
    }
    if (name !== 'nvidia' && name !== 'gemini') {
      throw new Error("Unknown EMBEDDING_PROVIDER '" + env.EMBEDDING_PROVIDER + "'. Supported values: nvidia, gemini.");
    }
    if (name === 'nvidia' && !env.NVIDIA_API_KEY) {
      throw new Error('NVIDIA_API_KEY is not set. Add it to your .env file to use the NVIDIA Nemotron embedding provider.');
    }
    if (name === 'gemini' && !env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set. Add it to your .env file to use the Gemini embedding provider.');
    }

    // Re-create only when the selection changes so the model key stays stable per process.
    if (!this.cachedProvider || this.cachedProviderName !== name) {
      this.cachedProvider = name === 'nvidia' ? new NvidiaNemotronEmbeddingProvider() : new GeminiEmbeddingProvider();
      this.cachedProviderName = name;
      logger.info('Embedding: Using provider ' + this.cachedProvider.modelKey +
        ' (' + this.cachedProvider.dimensions + ' dimensions)');
    }
    return this.cachedProvider;
  }

  async embedQuery(text: string): Promise<number[]> {
    const provider = this.getProvider();
    const [vector] = await provider.embed([text], 'query');
    if (!vector) {
      throw new Error('Invalid embedding response: no vector returned for query');
    }
    return vector;
  }

  /**
   * Generate and persist embeddings for all chunks of an index report that
   * do not yet carry a vector from the CURRENT provider/model.
   *
   * Re-indexing after changing EMBEDDING_PROVIDER simply re-embeds every
   * chunk (their modelKey no longer matches) — a safe migration path that
   * never mixes incompatible vectors.
   *
   * Returns the number of chunks embedded.
   */
  async embedChunksForReport(reportId: string): Promise<number> {
    const provider = this.getProvider();

    const chunks = await IndexedChunk.find({
      reportId,
      $or: [{ embeddingModel: null }, { embeddingModel: { $ne: provider.modelKey } }],
    })
      .select('_id content')
      .lean();

    if (chunks.length === 0) return 0;

    logger.info('Embedding: Generating embeddings for ' + chunks.length + ' chunks (' + provider.modelKey + ')');

    let embedded = 0;
    const PASSAGE_BATCH = 32;
    for (let i = 0; i < chunks.length; i += PASSAGE_BATCH) {
      const batch = chunks.slice(i, i + PASSAGE_BATCH);
      const vectors = await provider.embed(
        batch.map((c) => c.content),
        'passage',
      );

      const ops = batch.map((chunk, j) => ({
        updateOne: {
          filter: { _id: chunk._id },
          update: { $set: { embedding: vectors[j]!, embeddingModel: provider.modelKey } },
        },
      }));
      await IndexedChunk.bulkWrite(ops, { ordered: false });
      embedded += batch.length;
    }

    logger.info('Embedding: Stored ' + embedded + ' chunk embeddings for report ' + reportId);
    return embedded;
  }

  /**
   * Fetch embeddable chunks of a report for semantic search. Only vectors
   * produced by the current provider model are returned — vectors from any
   * other model have a different dimension space and must not be compared.
   */
  async fetchEmbeddedChunks(
    reportId: string,
    limit = 2000,
  ): Promise<EmbeddedChunk[]> {
    const provider = this.getProvider();
    const docs = (await IndexedChunk.find({
      reportId,
      embeddingModel: provider.modelKey,
      embedding: { $ne: null },
    })
      .select('fileId content startLine endLine type tokenCount embedding')
      .limit(limit)
      .lean()) as unknown as Array<Omit<EmbeddedChunk, 'embedding'> & { embedding: number[] | null }>;

    // Defensive: skip any doc whose stored vector is not a usable numeric array.
    return docs.filter((d): d is EmbeddedChunk => Array.isArray(d.embedding) && d.embedding.length > 0);
  }

  /** Cosine similarity between two equal-length vectors. Returns 0 for zero/degenerate vectors. */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /** Best-effort wrapper used by the indexer: logs failures instead of throwing. */
  async embedReportSafely(reportId: string): Promise<void> {
    try {
      if (!this.isConfigured()) {
        logger.warn('Embedding: Skipped — set EMBEDDING_PROVIDER and NVIDIA_API_KEY to enable semantic search.');
        return;
      }
      const count = await this.embedChunksForReport(reportId);
      if (count > 0) {
        logger.info('Embedding: Report ' + reportId + ' has ' + count + ' semantically searchable chunks');
      }
    } catch (error) {
      // An embedding outage must never turn a successful index into a failed one.
      logger.error('Embedding: Failed to embed chunks for report ' + reportId + ' — ' +
        (error instanceof Error ? error.message : String(error)));
    }
  }
}

export const embeddingService = new EmbeddingService();
