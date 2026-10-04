import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocGeneratorService } from '../doc-generator.service';
import { ApiError } from '../../utils/apiResponse';
import IndexReport from '../../models/IndexReport';
import IndexedFile from '../../models/IndexedFile';
import GeneratedDoc from '../../models/GeneratedDoc';

vi.mock('../../config/ai', () => ({
  generateFromAI: vi.fn().mockResolvedValue('# Generated README\n\nContent'),
}));
vi.mock('../../doc-generator/generator.service', () => ({
  generatorService: {
    generate: vi.fn().mockResolvedValue({
      content: '# Generated README\n\nContent',
      documentType: 'readme',
      fileName: 'README.md',
    }),
  },
  DocType: {},
}));
vi.mock('../../models/IndexReport', () => ({ default: { findOne: vi.fn() } }));
vi.mock('../../models/IndexedFile', () => ({ default: { find: vi.fn() } }));
vi.mock('../../models/IndexedChunk', () => ({ default: { find: vi.fn() } }));
vi.mock('../../models/GeneratedDoc', () => ({
  default: { create: vi.fn().mockResolvedValue({}), find: vi.fn(), findOne: vi.fn(), deleteOne: vi.fn(), countDocuments: vi.fn() },
}));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function createQueryMock(result: unknown) {
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

describe('DocGeneratorService', () => {
  let service: DocGeneratorService;

  beforeEach(() => {
    service = new DocGeneratorService();
    vi.clearAllMocks();
  });

  describe('generate', () => {
    it('should throw 404 if report not found', async () => {
      vi.mocked(IndexReport.findOne).mockResolvedValue(null);
      await expect(service.generate('rep-1', 'user-1', 'readme')).rejects.toThrow(ApiError);
    });

    it('should throw 400 if report not completed', async () => {
      vi.mocked(IndexReport.findOne).mockResolvedValue({ status: 'processing' } as never);
      await expect(service.generate('rep-1', 'user-1', 'readme')).rejects.toThrow('not completed');
    });

    it('should generate README successfully with file data', async () => {
      vi.mocked(IndexReport.findOne).mockResolvedValue({
        _id: 'rep-1',
        status: 'completed',
        summary: 'Test project',
        fileCount: 5,
        chunkCount: 20,
        techStack: { authentication: [], databases: [], frameworks: [], libraries: [], envVars: ['PORT'] },
        folderStructure: [{ name: 'src', type: 'folder', children: [] }],
      } as never);
      
      const mockFiles = [
        { _id: 'f1', path: 'src/index.ts', name: 'index.ts', language: 'typescript', size: 100, functions: [], classes: [], imports: ['express'], exports: [], dependencies: ['express'] },
      ];
      vi.mocked(IndexedFile.find).mockReturnValue({
        limit: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockFiles),
      } as never);

      const result = await service.generate('rep-1', 'user-1', 'readme');
      expect(result.documentType).toBe('readme');
      expect(result.fileName).toBe('README.md');
      expect(result.content).toBeTruthy();
    });
  });

  describe('getAvailableTypes', () => {
    it('should return all 9 document types', () => {
      const types = service.getAvailableTypes();
      expect(types).toHaveLength(9);
      expect(types[0]?.type).toBe('readme');
      expect(types.find((t) => t.type === 'license')).toBeDefined();
    });
  });

  describe('history', () => {
    it('saveHistory persists the generated document', async () => {
      await service.saveHistory({
        userId: 'user-1',
        type: 'readme',
        fileName: 'README.md',
        content: '# Hello',
        context: 'a project',
      });

      expect(GeneratedDoc.create).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'readme',
        fileName: 'README.md',
        content: '# Hello',
        context: 'a project',
        reportId: null,
      });
    });

    it('saveHistory never throws when persistence fails', async () => {
      vi.mocked(GeneratedDoc.create).mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.saveHistory({ userId: 'user-1', type: 'readme', fileName: 'README.md', content: '# x' }),
      ).resolves.toBeUndefined();
    });

    it('listHistory returns mapped documents and total', async () => {
      const docs = [
        { _id: { toString: () => 'doc-1' }, type: 'readme', fileName: 'README.md', context: 'ctx', content: '# x', createdAt: new Date('2026-01-01') },
      ];
      vi.mocked(GeneratedDoc.find).mockReturnValue(createQueryMock(docs) as never);
      vi.mocked(GeneratedDoc.countDocuments).mockResolvedValue(1);

      const result = await service.listHistory('user-1', { page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.documents[0]?.id).toBe('doc-1');
      expect(result.documents[0]?.fileName).toBe('README.md');
      // The list payload must not ship the full document body.
      expect(result.documents[0]).not.toHaveProperty('content');
    });

    it('getHistoryDetail returns the stored content', async () => {
      vi.mocked(GeneratedDoc.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: { toString: () => 'doc-1' },
          type: 'readme',
          fileName: 'README.md',
          context: 'ctx',
          content: '# Stored content',
          createdAt: new Date('2026-01-01'),
        }),
      } as never);

      const result = await service.getHistoryDetail('user-1', 'doc-1');

      expect(result.content).toBe('# Stored content');
    });

    it('getHistoryDetail throws 404 when the document is missing', async () => {
      vi.mocked(GeneratedDoc.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      await expect(service.getHistoryDetail('user-1', 'nope')).rejects.toThrow(ApiError);
    });

    it('deleteHistory removes only the owner document', async () => {
      vi.mocked(GeneratedDoc.deleteOne).mockResolvedValue({} as never);
      await service.deleteHistory('user-1', 'doc-1');
      expect(GeneratedDoc.deleteOne).toHaveBeenCalledWith({ _id: 'doc-1', userId: 'user-1' });
    });
  });
});
