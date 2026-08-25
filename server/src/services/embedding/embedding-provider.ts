/**
 * Common contract for embedding providers.
 *
 * A provider turns text (code chunks or user queries) into fixed-length
 * numeric vectors. Providers are selected through the EMBEDDING_PROVIDER
 * environment variable — see embedding.service.ts.
 *
 * `inputType` matters for asymmetric models like NVIDIA Nemotron embeddings:
 * documents are embedded as 'passage' while user questions are embedded as
 * 'query' — mixing them degrades retrieval quality.
 */
export type EmbeddingInputType = 'query' | 'passage';

export interface EmbeddingProvider {
  /** Short provider key used in logs and stored alongside each chunk. */
  readonly name: string;
  /** Full model ID sent to the provider API. */
  readonly model: string;
  /** Fixed output dimensionality of the model — validated on every response. */
  readonly dimensions: number;
  /**
   * Stable identifier written to IndexedChunk.embeddingModel so vectors from
   * different providers/dimensions are never mixed during vector search.
   */
  readonly modelKey: string;
  embed(inputs: string[], inputType: EmbeddingInputType): Promise<number[][]>;
}
