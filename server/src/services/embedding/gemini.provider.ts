import { getGeminiClient } from '../../config/gemini';
import { env } from '../../config/environment';
import logger from '../../utils/logger';
import { EmbeddingInputType, EmbeddingProvider } from './embedding-provider';

/**
 * Gemini embedding provider (text-embedding-004, 768 dimensions).
 *
 * Kept as an alternative to the NVIDIA Nemotron provider so existing
 * deployments that only have a GEMINI_API_KEY can still run semantic
 * search. Selected with EMBEDDING_PROVIDER=gemini.
 */
const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
export const GEMINI_EMBEDDING_DIMENSIONS = 768;

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'gemini';
  readonly model = GEMINI_EMBEDDING_MODEL;
  readonly dimensions = GEMINI_EMBEDDING_DIMENSIONS;
  readonly modelKey = this.name + ':' + this.model;

  async embed(inputs: string[], _inputType: EmbeddingInputType): Promise<number[][]> {
    if (!env.GEMINI_API_KEY) {
      throw new Error(
        'GEMINI_API_KEY is not set. Add it to your .env file to use the Gemini embedding provider.',
      );
    }

    const model = getGeminiClient().getGenerativeModel({ model: this.model });
    const result = await model.batchEmbedContents({
      requests: inputs.map((text) => ({
        model: 'models/' + this.model,
        content: { role: 'user', parts: [{ text }] },
      })),
    });

    const embeddings = result.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length !== inputs.length) {
      throw new Error(
        'Invalid embedding response: expected ' + inputs.length +
        ' vectors, received ' + (embeddings?.length ?? 0),
      );
    }

    return embeddings.map((item, i) => {
      const values = item.values;
      if (!Array.isArray(values) || values.length !== this.dimensions) {
        logger.warn('Embedding: Gemini vector at index ' + i + ' has unexpected dimension ' + (values?.length ?? 0));
      }
      if (!Array.isArray(values) || values.length === 0 || !values.every((n) => typeof n === 'number' && Number.isFinite(n))) {
        throw new Error('Invalid embedding response: vector at index ' + i + ' is not a numeric array');
      }
      return values;
    });
  }
}
