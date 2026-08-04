import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';

const MAX_READ_CHARS = 8000;
const MAX_SEARCH_RESULTS = 6;
const MAX_LIST_FILES = 30;

export interface SearchHit {
  filePath: string;
  startLine: number;
  endLine: number;
  type: string;
  snippet: string;
}

export interface FileReadResult {
  found: boolean;
  path: string;
  language: string;
  content: string;
  closeMatches: string[];
}

export interface RepoInfo {
  summary: string;
  techStack: string;
  folderStructure: string;
  fileCount: number;
}

const REGEX_SPECIALS = new Set(['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', String.fromCharCode(92)]);

function escapeRegex(value: string): string {
  return [...value].map((ch) => (REGEX_SPECIALS.has(ch) ? String.fromCharCode(92) + ch : ch)).join('');
}

function newline(): string {
  return String.fromCharCode(10);
}

export class CodebaseToolsService {
  async getRepoInfo(reportId: string): Promise<RepoInfo> {
    const report = await IndexReport.findById(reportId).lean();
    return {
      summary: (report?.summary || '').slice(0, 600),
      techStack: JSON.stringify(report?.techStack || {}).slice(0, 600),
      folderStructure: JSON.stringify(report?.folderStructure || []).slice(0, 600),
      fileCount: report?.fileCount || 0,
    };
  }

  async search(reportId: string, query: string): Promise<SearchHit[]> {
    const terms = query
      .split(' ')
      .map((t) => escapeRegex(t.trim()))
      .filter((t) => t.length > 1);
    if (terms.length === 0) return [];

    const regex = new RegExp(terms.join('|'), 'i');
    const chunks = await IndexedChunk.find({ reportId, content: regex })
      .sort({ tokenCount: -1 })
      .limit(MAX_SEARCH_RESULTS)
      .lean();
    if (chunks.length === 0) return [];

    const fileIds = [...new Set(chunks.map((c) => c.fileId.toString()))];
    const files = await IndexedFile.find({ _id: { $in: fileIds } }).select('_id path').lean();
    const filePathMap = new Map(files.map((f) => [f._id.toString(), f.path]));

    return chunks.map((c) => ({
      filePath: filePathMap.get(c.fileId.toString()) || 'unknown',
      startLine: c.startLine,
      endLine: c.endLine,
      type: c.type,
      snippet: c.content.length > 400 ? c.content.slice(0, 400) + newline() + '// ... [truncated]' : c.content,
    }));
  }

  async readFile(reportId: string, pathQuery: string): Promise<FileReadResult> {
    const clean = pathQuery.trim();
    if (!clean) {
      return { found: false, path: '', language: '', content: '', closeMatches: [] };
    }

    const escaped = escapeRegex(clean);
    let file = await IndexedFile.findOne({ reportId, path: { $regex: '^' + escaped + '$', $options: 'i' } }).lean();
    if (!file) {
      file = await IndexedFile.findOne({ reportId, path: { $regex: escaped, $options: 'i' } }).lean();
    }
    if (!file) {
      const close = await IndexedFile.find({ reportId, path: { $regex: escaped, $options: 'i' } })
        .select('path')
        .limit(5)
        .lean();
      return {
        found: false,
        path: clean,
        language: '',
        content: '',
        closeMatches: close.map((c) => c.path),
      };
    }

    // Reconstruct the full file from its chunks (sorted by index, skipping
    // overlapped lines between adjacent chunks).
    const chunks = await IndexedChunk.find({ reportId, fileId: file._id }).sort({ index: 1 }).lean();
    const merged: string[] = [];
    let lastEnd = 0;
    for (const c of chunks) {
      const lines = c.content.split(newline());
      const overlap = Math.max(0, lastEnd - c.startLine + 1);
      merged.push(...lines.slice(overlap));
      lastEnd = Math.max(lastEnd, c.endLine);
    }
    let content = merged.join(newline());
    if (content.length > MAX_READ_CHARS) {
      content = content.slice(0, MAX_READ_CHARS) + newline() + '// ... [truncated]';
    }

    return { found: true, path: file.path, language: file.language, content, closeMatches: [] };
  }

  async listFiles(reportId: string, pattern?: string): Promise<string[]> {
    const filter: Record<string, unknown> = { reportId };
    if (pattern && pattern.trim()) {
      filter.path = { $regex: escapeRegex(pattern.trim()), $options: 'i' };
    }
    const files = await IndexedFile.find(filter)
      .select('path language')
      .sort({ path: 1 })
      .limit(MAX_LIST_FILES)
      .lean();
    return files.map((f) => f.path + (f.language ? ' [' + f.language + ']' : ''));
  }
}

export const codebaseToolsService = new CodebaseToolsService();
