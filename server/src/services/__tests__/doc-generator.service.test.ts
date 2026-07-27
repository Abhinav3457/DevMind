import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocGeneratorService } from '../doc-generator.service';
import { ApiError } from '../../utils/apiResponse';
import IndexReport from '../../models/IndexReport';
import IndexedFile from '../../models/IndexedFile';

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
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

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
});
