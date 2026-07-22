import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';

const IGNORE_PATTERNS = [
  'node_modules', 'dist', 'build', 'coverage', '.git', '.next', '.nuxt',
  '.cache', '__pycache__', 'venv', '.venv', 'env', '.env',
  '*.min.js', '*.bundle.js', '*.chunk.js',
  '*.min.css',
  '*.map',
  '*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.ico', '*.woff', '*.woff2', '*.eot', '*.ttf',
  '*.mp4', '*.mp3', '*.pdf', '*.zip', '*.tar', '*.gz',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store',
];

const MAX_FILE_SIZE = 1024 * 1024;

interface FileEntry {
  path: string;
  name: string;
  content: string;
  language: string;
  size: number;
}

export class FileReaderService {
  private shouldIgnore(filePath: string): boolean {
    const relative = path.basename(filePath);
    for (const pattern of IGNORE_PATTERNS) {
      if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1);
        if (relative.endsWith(ext)) return true;
      } else if (relative === pattern || filePath.includes(`/${pattern}/`) || filePath.includes(`\${pattern}\\`)) {
        return true;
      }
    }
    return false;
  }

  private getLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
      '.py': 'python', '.java': 'java', '.go': 'go', '.rs': 'rust',
      '.rb': 'ruby', '.php': 'php', '.cs': 'csharp', '.swift': 'swift',
      '.kt': 'kotlin', '.scala': 'scala', '.html': 'html', '.css': 'css',
      '.scss': 'scss', '.less': 'less', '.json': 'json', '.xml': 'xml',
      '.yaml': 'yaml', '.yml': 'yaml', '.md': 'markdown', '.sql': 'sql',
      '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash', '.dockerfile': 'dockerfile',
      '.graphql': 'graphql', '.proto': 'protobuf', '.toml': 'toml',
    };
    return langMap[ext] || 'plaintext';
  }

  async readDirectory(dirPath: string): Promise<FileEntry[]> {
    const files: FileEntry[] = [];

    async function walk(currentPath: string, reader: FileReaderService) {
      if (reader.shouldIgnore(currentPath)) return;

      const stats = await fs.stat(currentPath).catch(() => null);
      if (!stats) return;

      if (stats.isDirectory()) {
        const entries = await fs.readdir(currentPath).catch(() => []);
        for (const entry of entries) {
          await walk(path.join(currentPath, entry), reader);
        }
      } else if (stats.isFile() && stats.size <= MAX_FILE_SIZE) {
        const content = await fs.readFile(currentPath, 'utf-8').catch(() => null);
        if (content === null) return;

        files.push({
          path: currentPath,
          name: path.basename(currentPath),
          content,
          language: reader.getLanguage(currentPath),
          size: stats.size,
        });
      }
    }

    await walk(dirPath, this);
    logger.info(`FileReader: Read ${files.length} files from ${dirPath}`);
    return files;
  }

  async readFiles(filePaths: string[]): Promise<FileEntry[]> {
    const files: FileEntry[] = [];
    for (const filePath of filePaths) {
      if (this.shouldIgnore(filePath)) continue;
      const stats = await fs.stat(filePath).catch(() => null);
      if (!stats || stats.size > MAX_FILE_SIZE) continue;
      const content = await fs.readFile(filePath, 'utf-8').catch(() => null);
      if (content === null) continue;
      files.push({
        path: filePath,
        name: path.basename(filePath),
        content,
        language: this.getLanguage(filePath),
        size: stats.size,
      });
    }
    return files;
  }
}

export const fileReaderService = new FileReaderService();
