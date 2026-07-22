import { IIndexedFile } from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import logger from '../utils/logger';

const CHUNK_MAX_LINES = 100;
const CHUNK_OVERLAP_LINES = 10;

interface ChunkInput {
  reportId: string;
  fileId: string;
  file: IIndexedFile;
  content: string;
}

export class ChunkerService {
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private extractLines(content: string, startLine: number, endLine: number): string {
    const lines = content.split('\n');
    return lines.slice(startLine - 1, endLine).join('\n');
  }

  chunkFile(input: ChunkInput): {
    chunks: {
      index: number;
      content: string;
      startLine: number;
      endLine: number;
      type: 'function' | 'class' | 'section' | 'import_block' | 'exports_block';
      metadata: Record<string, unknown>;
      tokenCount: number;
    }[];
  } {
    const { file, content } = input;
    const chunks: {
      index: number;
      content: string;
      startLine: number;
      endLine: number;
      type: 'function' | 'class' | 'section' | 'import_block' | 'exports_block';
      metadata: Record<string, unknown>;
      tokenCount: number;
    }[] = [];
    const lines = content.split('\n');
    let chunkIndex = 0;

    if (file.imports.length > 0) {
      const importEndLine = this.findImportBlockEnd(lines);
      if (importEndLine > 0) {
        const importContent = lines.slice(0, importEndLine).join('\n');
        chunks.push({
          index: chunkIndex++,
          content: importContent,
          startLine: 1,
          endLine: importEndLine,
          type: 'import_block',
          metadata: { importCount: file.imports.length },
          tokenCount: this.estimateTokens(importContent),
        });
      }
    }

    for (const func of file.functions) {
      const funcContent = this.extractLines(content, func.startLine, func.endLine);
      chunks.push({
        index: chunkIndex++,
        content: funcContent,
        startLine: func.startLine,
        endLine: func.endLine,
        type: 'function',
        metadata: { functionName: func.name },
        tokenCount: this.estimateTokens(funcContent),
      });
    }

    for (const cls of file.classes) {
      const classContent = this.extractLines(content, cls.startLine, cls.endLine);
      chunks.push({
        index: chunkIndex++,
        content: classContent,
        startLine: cls.startLine,
        endLine: cls.endLine,
        type: 'class',
        metadata: { className: cls.name },
        tokenCount: this.estimateTokens(classContent),
      });
    }

    if (file.exports.length > 0) {
      const exportLines = this.findExportBlockLines(lines, file);
      if (exportLines.length > 0) {
        const exportContent = exportLines.map((l) => lines[l - 1]!).join('\n');
        chunks.push({
          index: chunkIndex++,
          content: exportContent,
          startLine: exportLines[0]!,
          endLine: exportLines[exportLines.length - 1]!,
          type: 'exports_block',
          metadata: { exportCount: file.exports.length },
          tokenCount: this.estimateTokens(exportContent),
        });
      }
    }

    const processedLines = new Set<number>();
    for (const chunk of chunks) {
      for (let i = chunk.startLine; i <= chunk.endLine; i++) {
        processedLines.add(i);
      }
    }

    const remainingBlocks = this.findUnprocessedBlocks(lines, processedLines);
    for (const block of remainingBlocks) {
      const blockContent = this.extractLines(content, block.start, block.end);
      chunks.push({
        index: chunkIndex++,
        content: blockContent,
        startLine: block.start,
        endLine: block.end,
        type: 'section',
        metadata: {},
        tokenCount: this.estimateTokens(blockContent),
      });
    }

    chunks.sort((a, b) => a.startLine - b.startLine);
    chunks.forEach((chunk, i) => { chunk.index = i; });

    return { chunks };
  }

  async saveChunks(
    reportId: string,
    fileId: string,
    chunks: {
      index: number;
      content: string;
      startLine: number;
      endLine: number;
      type: 'function' | 'class' | 'section' | 'import_block' | 'exports_block';
      metadata: Record<string, unknown>;
      tokenCount: number;
    }[],
  ): Promise<void> {
    const docs = chunks.map((chunk) => ({
      reportId,
      fileId,
      index: chunk.index,
      content: chunk.content,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      type: chunk.type,
      metadata: chunk.metadata,
      embedding: null,
      tokenCount: chunk.tokenCount,
    }));

    await IndexedChunk.insertMany(docs, { ordered: false }).catch((err) => {
      logger.warn('Chunker: Some chunks may have duplicate keys - ' + (err instanceof Error ? err.message : String(err)));
    });
  }

  private findImportBlockEnd(lines: string[]): number {
    let lastImportLine = 0;
    for (let i = 0; i < Math.min(lines.length, 200); i++) {
      const trimmed = lines[i]!.trim();
      if (
        trimmed.startsWith('import ') ||
        trimmed.startsWith('const ') ||
        trimmed.startsWith('require(') ||
        trimmed.startsWith('#include') ||
        trimmed.startsWith('using ') ||
        trimmed.startsWith('package ') ||
        trimmed.startsWith('from ')
      ) {
        lastImportLine = i + 1;
      } else if (trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
        break;
      }
    }
    return lastImportLine;
  }

  private findExportBlockLines(lines: string[], file: IIndexedFile): number[] {
    const capturedNames = new Set<string>();
    for (const func of file.functions) capturedNames.add(func.name);
    for (const cls of file.classes) capturedNames.add(cls.name);

    const exportLines: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();
      if (trimmed.startsWith('export ')) {
        const isCaptured = [...capturedNames].some((name) => trimmed.includes(name));
        if (!isCaptured) {
          exportLines.push(i + 1);
        }
      }
    }
    return exportLines;
  }

  private findUnprocessedBlocks(
    lines: string[],
    processedLines: Set<number>,
  ): { start: number; end: number }[] {
    const blocks: { start: number; end: number }[] = [];
    let blockStart: number | null = null;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (!processedLines.has(lineNum) && lines[i]!.trim()) {
        if (blockStart === null) blockStart = lineNum;
      } else {
        if (blockStart !== null) {
          blocks.push({ start: blockStart, end: lineNum - 1 });
          blockStart = null;
        }
      }
    }
    if (blockStart !== null) {
      blocks.push({ start: blockStart, end: lines.length });
    }

    const splitBlocks: { start: number; end: number }[] = [];
    for (const block of blocks) {
      const size = block.end - block.start + 1;
      if (size <= CHUNK_MAX_LINES) {
        splitBlocks.push(block);
      } else {
        for (let s = block.start; s <= block.end; s += CHUNK_MAX_LINES - CHUNK_OVERLAP_LINES) {
          const e = Math.min(s + CHUNK_MAX_LINES - 1, block.end);
          splitBlocks.push({ start: s, end: e });
          if (e >= block.end) break;
        }
      }
    }

    return splitBlocks;
  }
}

export const chunkerService = new ChunkerService();
