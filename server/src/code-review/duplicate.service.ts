import IndexedChunk from '../models/IndexedChunk';
import IndexedFile from '../models/IndexedFile';
import logger from '../utils/logger';

const SIMILARITY_THRESHOLD = 0.7;
const MIN_DUPLICATE_LINES = 5;
const MAX_CHUNKS_TO_COMPARE = 500;

export interface DuplicateBlock {
  similarity: number;
  file1: { path: string; startLine: number; endLine: number };
  file2: { path: string; startLine: number; endLine: number };
  content: string;
}

export class DuplicateService {
  async findDuplicates(reportId: string): Promise<DuplicateBlock[]> {
    const totalChunks = await IndexedChunk.countDocuments({ reportId });
    if (totalChunks > MAX_CHUNKS_TO_COMPARE) {
      logger.info('Duplicate: Too many chunks (' + totalChunks + '), sampling function chunks only');
    }

    const chunks = await IndexedChunk.find({
      reportId,
      type: { $in: ['function', 'class'] },
    })
      .limit(MAX_CHUNKS_TO_COMPARE)
      .sort({ tokenCount: -1 })
      .lean();

    if (chunks.length < 2) return [];

    const fileMap = await this.buildFilePathMap(chunks);
    const duplicates: DuplicateBlock[] = [];
    const compared = new Set<string>();

    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const key = [chunks[i]!._id.toString(), chunks[j]!._id.toString()].sort().join(':');
        if (compared.has(key)) continue;
        compared.add(key);

        const similarity = this.jaccardSimilarity(chunks[i]!.content, chunks[j]!.content);
        if (similarity >= SIMILARITY_THRESHOLD) {
          const content = chunks[i]!.content.length <= chunks[j]!.content.length
            ? chunks[i]!.content
            : chunks[j]!.content;

          duplicates.push({
            similarity: Math.round(similarity * 100) / 100,
            file1: {
              path: fileMap.get(chunks[i]!.fileId.toString()) || 'unknown',
              startLine: chunks[i]!.startLine,
              endLine: chunks[i]!.endLine,
            },
            file2: {
              path: fileMap.get(chunks[j]!.fileId.toString()) || 'unknown',
              startLine: chunks[j]!.startLine,
              endLine: chunks[j]!.endLine,
            },
            content: content.length > 200 ? content.substring(0, 200) + '...' : content,
          });
        }
      }
    }

    duplicates.sort((a, b) => b.similarity - a.similarity);
    return duplicates.slice(0, 20);
  }

  private jaccardSimilarity(a: string, b: string): number {
    const tokensA = this.tokenize(a);
    const tokensB = this.tokenize(b);

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
    const union = new Set([...tokensA, ...tokensB]);

    return intersection.size / union.size;
  }

  private tokenize(text: string): Set<string> {
    const lines = text.split('\n').filter((l) => {
      const trimmed = l.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
    });

    if (lines.length < MIN_DUPLICATE_LINES) return new Set();

    const tokens = new Set<string>();
    for (let i = 0; i <= lines.length - 3; i++) {
      tokens.add(lines.slice(i, i + 3).join('\n').replace(/\s+/g, ' ').trim());
    }
    return tokens;
  }

  private async buildFilePathMap(chunks: Array<{ _id: { toString(): string }; fileId: { toString(): string } }>): Promise<Map<string, string>> {
    const fileIds = [...new Set(chunks.map((c) => c.fileId.toString()))];
    const files = await IndexedFile.find({ _id: { $in: fileIds } }).select('path').lean();
    const map = new Map<string, string>();
    for (const f of files) {
      map.set(f._id.toString(), f.path);
    }
    return map;
  }
}

export const duplicateService = new DuplicateService();
