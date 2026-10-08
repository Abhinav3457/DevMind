import { describe, it, expect, vi } from 'vitest';
import os from 'os';
import path from 'path';
import { isRepoDirWithinTempRoot, IndexerService } from '../indexer.service';
import { indexRepoSchema } from '../../validators/indexer.validator';

// Keep the unit under test isolated from the database and external services —
// the path guard runs before any of them are touched.
vi.mock('../../models/IndexReport', () => ({ default: { create: vi.fn() } }));
vi.mock('../../models/IndexedFile', () => ({ default: { create: vi.fn() } }));
vi.mock('../../models/IndexedChunk', () => ({ default: { create: vi.fn(), countDocuments: vi.fn() } }));
vi.mock('../../models/ImportedRepository', () => ({ default: { findOne: vi.fn() } }));
vi.mock('../../models/GitHubAccount', () => ({ default: { findOne: vi.fn() } }));
vi.mock('../../models/User', () => ({ default: { findById: vi.fn() } }));
vi.mock('../../services/activity.service', () => ({ logActivity: vi.fn() }));
vi.mock('../../services/notification.service', () => ({ notificationService: { create: vi.fn() } }));
vi.mock('../../helpers/email.helper', () => ({ sendIndexCompleteEmail: vi.fn() }));
vi.mock('../../services/embedding', () => ({ embeddingService: { embedReportSafely: vi.fn() } }));
vi.mock('../file-reader.service', () => ({ fileReaderService: { readDirectory: vi.fn() } }));
vi.mock('../code-parser.service', () => ({ codeParserService: { parse: vi.fn(), extractDependencies: vi.fn() } }));
vi.mock('../chunker.service', () => ({ chunkerService: { chunkFile: vi.fn(), saveChunks: vi.fn() } }));
vi.mock('../analyzer.service', () => ({ analyzerService: { analyze: vi.fn() } }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

describe('isRepoDirWithinTempRoot', () => {
  it('rejects the temp root itself (it is not strictly inside)', () => {
    expect(isRepoDirWithinTempRoot(os.tmpdir())).toBe(false);
  });

  it('accepts a server-created working copy inside the temp root', () => {
    expect(isRepoDirWithinTempRoot(path.join(os.tmpdir(), 'devmind-index-abc123'))).toBe(true);
  });

  it('rejects the POSIX system path /etc', () => {
    expect(isRepoDirWithinTempRoot('/etc')).toBe(false);
  });

  it('rejects the bare POSIX temp path /tmp', () => {
    expect(isRepoDirWithinTempRoot('/tmp')).toBe(false);
  });

  it('rejects the Windows system path C:\\Windows', () => {
    expect(isRepoDirWithinTempRoot('C:\\Windows')).toBe(false);
  });

  it('rejects traversal that escapes the temp root', () => {
    expect(isRepoDirWithinTempRoot(path.join(os.tmpdir(), '..', 'etc'))).toBe(false);
  });

  it('rejects empty and relative junk', () => {
    expect(isRepoDirWithinTempRoot('')).toBe(false);
    expect(isRepoDirWithinTempRoot('   ')).toBe(false);
    expect(isRepoDirWithinTempRoot('relative/dir')).toBe(false);
  });
});

describe('indexRepoSchema (HTTP layer)', () => {
  it('rejects a client-supplied POSIX repoDir', () => {
    const { error } = indexRepoSchema.validate({ repoDir: '/etc' });
    expect(error).toBeDefined();
  });

  it('rejects a client-supplied Windows repoDir', () => {
    const { error } = indexRepoSchema.validate({ repoDir: 'C:\\Windows' });
    expect(error).toBeDefined();
  });

  it('accepts an empty body (server clones the repo itself)', () => {
    const { error } = indexRepoSchema.validate({});
    expect(error).toBeUndefined();
  });
});

describe('IndexerService.indexRepository repoDir guard', () => {
  it('rejects a POSIX system path before creating any report', async () => {
    const service = new IndexerService();
    await expect(service.indexRepository('user-1', 'repo-1', '/etc')).rejects.toThrow(
      /restricted to server-managed temporary directories/,
    );
  });

  it('rejects a Windows system path', async () => {
    const service = new IndexerService();
    await expect(service.indexRepository('user-1', 'repo-1', 'C:\\Windows')).rejects.toThrow(
      /restricted to server-managed temporary directories/,
    );
  });

  it('rejects a path that escapes the temp root via traversal', async () => {
    const service = new IndexerService();
    await expect(
      service.indexRepository('user-1', 'repo-1', path.join(os.tmpdir(), '..', 'etc')),
    ).rejects.toThrow(/restricted to server-managed temporary directories/);
  });
});
