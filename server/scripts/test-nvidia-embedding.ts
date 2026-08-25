/**
 * Manual end-to-end check for the NVIDIA Nemotron embedding integration:
 *
 *   text → NVIDIA Nemotron-3-Embed-1B → embedding vector → MongoDB
 *
 * Usage (from the server/ directory):
 *   npx ts-node scripts/test-nvidia-embedding.ts
 *
 * Requires NVIDIA_API_KEY and MONGODB_URI in server/.env.
 * Creates one temporary document in the `indexedchunks` collection, verifies
 * it round-trips through Mongo and is semantically comparable, then deletes it.
 */
import mongoose from 'mongoose';
import { env } from '../src/config/environment';
import IndexedChunk from '../src/models/IndexedChunk';
import IndexReport from '../src/models/IndexReport';
import IndexedFile from '../src/models/IndexedFile';
import { embeddingService } from '../src/services/embedding';
import logger from '../src/utils/logger';

const SAMPLE_CHUNK =
  'export function signJwt(payload: UserPayload): string {\n' +
  '  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });\n' +
  '}';

async function main(): Promise<void> {
  if (!env.NVIDIA_API_KEY) {
    console.error('✗ NVIDIA_API_KEY is not set. Add it to server/.env and retry.');
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const provider = embeddingService.getProvider();
  console.log('✓ Provider:', provider.modelKey, '(' + provider.dimensions + ' dimensions)');

  // 1. Passage embedding (what indexing stores for code chunks)
  const [passageVector] = await provider.embed([SAMPLE_CHUNK], 'passage');
  console.log('✓ Generated chunk embedding with', passageVector!.length, 'dimensions');
  if (passageVector!.length !== provider.dimensions) {
    throw new Error('Dimension mismatch: expected ' + provider.dimensions + ', got ' + passageVector!.length);
  }

  // 2. Round-trip through MongoDB (temporary docs — cleaned up below)
  const report = await IndexReport.create({
    userId: new mongoose.Types.ObjectId(),
    repositoryId: new mongoose.Types.ObjectId(),
    status: 'completed',
    startedAt: new Date(),
    completedAt: new Date(),
    summary: 'embedding smoke test',
    fileCount: 0,
    chunkCount: 1,
    totalTokens: 0,
    techStack: {},
    folderStructure: [],
  } as never);
  const file = await IndexedFile.create({
    reportId: report._id,
    path: 'smoke-test.ts',
    name: 'smoke-test.ts',
    language: 'typescript',
    size: SAMPLE_CHUNK.length,
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    dependencies: [],
  });
  const chunk = await IndexedChunk.create({
    reportId: report._id,
    fileId: file._id,
    index: 0,
    content: SAMPLE_CHUNK,
    startLine: 1,
    endLine: 3,
    type: 'function',
    metadata: { functionName: 'signJwt' },
    embedding: passageVector!,
    embeddingModel: provider.modelKey,
    tokenCount: Math.ceil(SAMPLE_CHUNK.length / 4),
  });

  const fromDb = await IndexedChunk.findById(chunk._id).lean();
  console.log('✓ Stored and read back chunk', fromDb!._id.toString());
  if (!Array.isArray(fromDb!.embedding) || fromDb!.embedding.length !== provider.dimensions) {
    throw new Error('Stored embedding did not survive a MongoDB round-trip intact');
  }
  if (fromDb!.embeddingModel !== provider.modelKey) {
    throw new Error('embeddingModel tag mismatch after read-back');
  }

  // 3. Query embedding against the SAME model, then semantic comparison —
  //    this mirrors exactly what the retriever does at question time.
  const queryVector = await embeddingService.embedQuery('Where is JWT signing implemented?');
  const score = embeddingService.cosineSimilarity(queryVector, fromDb!.embedding);
  console.log('✓ Query embedding generated (' + queryVector.length + ' dimensions)');
  console.log('  cosine similarity(query, jwt-chunk) =', score.toFixed(4));

  await IndexedChunk.deleteOne({ _id: chunk._id });
  await IndexedFile.deleteOne({ _id: file._id });
  await IndexReport.deleteOne({ _id: report._id });
  console.log('✓ Cleaned up temporary test documents');

  if (score < 0.3) {
    throw new Error('Similarity between a JWT query and JWT code unexpectedly low — check model/input_type handling');
  }

  console.log('\n✓ End-to-end NVIDIA Nemotron → MongoDB embedding flow works correctly.');
}

main()
  .catch((err) => {
    logger.error('Smoke test failed: ' + (err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
