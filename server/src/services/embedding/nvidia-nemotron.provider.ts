import { env } from '../../config/environment';
import logger from '../../utils/logger';
import { EmbeddingInputType, EmbeddingProvider } from './embedding-provider';

/**
 * NVIDIA hosted Nemotron embedding provider (build.nvidia.com free endpoint).
 *
 * API reference: https://docs.nvidia.com/nim/nemo-retriever/text-embedding/
 * The hosted integrate.api.nvidia.com/v1/embeddings endpoint follows the
 * OpenAI embeddings request shape with NVIDIA-specific extras:
 * - `input_type`: 'query' for user questions, 'passage' for documents/chunks.
 * - `truncate`: 'END' so over-long code chunks are truncated server-side
 *   instead of failing the whole request.
 *
 * nemotron-3-embed-1b outputs a native 2048-dimensional float vector and
 * does NOT support reduced dimensions — every response is validated against
 * that fixed size before it is trusted.
 */
const NVIDIA_EMBEDDINGS_URL = 'https://integrate.api.nvidia.com/v1/embeddings';

/** Native output dimensions of nemotron-3-embed-1b (not configurable). */
export const NEMOTRON_EMBEDDING_DIMENSIONS = 2048;

// Matches config/ai.ts conventions: retry transient failures (429/5xx/network)
// a few times with linear backoff before giving up and surfacing the error.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;
const REQUEST_TIMEOUT_MS = 20000;
// Number of texts per embeddings request. Keeps individual payloads well
// under free-tier request-size limits while still batching efficiently.
const BATCH_SIZE = 16;

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class NvidiaNemotronEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'nvidia';
  readonly model = env.NVIDIA_EMBEDDING_MODEL;
  readonly dimensions = NEMOTRON_EMBEDDING_DIMENSIONS;
  readonly modelKey = this.name + ':' + this.model;

  async embed(inputs: string[], inputType: EmbeddingInputType): Promise<number[][]> {
    if (!env.NVIDIA_API_KEY) {
      throw new Error(
        'NVIDIA_API_KEY is not set. Add it to your .env file to use the NVIDIA Nemotron embedding provider.',
      );
    }

    const vectors: number[][] = [];
    for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
      const batch = inputs.slice(i, i + BATCH_SIZE);
      vectors.push(...(await this.embedBatch(batch, inputType)));
    }
    return vectors;
  }

  private async embedBatch(batch: string[], inputType: EmbeddingInputType): Promise<number[][]> {
    let lastError = 'NVIDIA embeddings request failed';

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        return await this.request(batch, inputType);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        const retryable =
          isTransientStatus(this.extractStatus(lastError)) ||
          /timeout|abort|network|fetch failed|econn/i.test(lastError);

        logger.warn(
          'Embedding: NVIDIA request attempt ' + (attempt + 1) + '/' + MAX_ATTEMPTS +
          ' failed (' + lastError.slice(0, 160) + ')',
        );

        if (!retryable || attempt === MAX_ATTEMPTS - 1) break;
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }

    throw new Error('NVIDIA embedding request failed: ' + lastError);
  }

  private async request(batch: string[], inputType: EmbeddingInputType): Promise<number[][]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(NVIDIA_EMBEDDINGS_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: 'Bearer ' + env.NVIDIA_API_KEY,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: batch,
          input_type: inputType,
          encoding_format: 'float',
          truncate: 'END',
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          'HTTP ' + response.status + ' ' + response.statusText +
          (body ? ' - ' + body.slice(0, 200) : ''),
        );
      }

      const payload = (await response.json()) as {
        data?: Array<{ index?: number; embedding?: unknown }>;
      };

      if (!Array.isArray(payload.data) || payload.data.length !== batch.length) {
        throw new Error(
          'Invalid embedding response: expected ' + batch.length +
          ' vectors, received ' + (payload.data?.length ?? 0),
        );
      }

      // The OpenAI shape returns items in order, but sort by index when present
      // to be defensive against reordered responses.
      const sorted = [...payload.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

      return sorted.map((item, i) => this.validateVector(item.embedding, i));
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Validate one raw embedding value into a numeric vector of the exact expected dimension. */
  private validateVector(raw: unknown, position: number): number[] {
    if (!Array.isArray(raw) || raw.length === 0 || !raw.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      throw new Error('Invalid embedding response: vector at index ' + position + ' is not a numeric array');
    }
    if (raw.length !== this.dimensions) {
      throw new Error(
        'Invalid embedding response: expected ' + this.dimensions + ' dimensions, got ' +
        raw.length + ' at index ' + position,
      );
    }
    return raw as number[];
  }

  private extractStatus(message: string): number {
    const match = /HTTP (\d{3})/.exec(message);
    return match ? parseInt(match[1]!, 10) : 0;
  }
}
