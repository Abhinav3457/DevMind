import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService } from '../analytics.service';
import ImportedRepository from '../../models/ImportedRepository';
import IndexReport from '../../models/IndexReport';
import IndexedFile from '../../models/IndexedFile';
import IndexedChunk from '../../models/IndexedChunk';

vi.mock('../../models/ImportedRepository', () => ({ default: { countDocuments: vi.fn(), aggregate: vi.fn() } }));
vi.mock('../../models/IndexReport', () => ({ default: { find: vi.fn(), countDocuments: vi.fn() } }));
vi.mock('../../models/IndexedFile', () => ({ default: { aggregate: vi.fn() } }));
vi.mock('../../models/IndexedChunk', () => ({ default: { aggregate: vi.fn() } }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const VALID_USER_ID = '507f191e810c19729de860ea';

// Mongoose query chain: find → select → sort → limit → lean
function makeFindMock(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    service = new AnalyticsService();
    vi.clearAllMocks();
  });

  it('should return defaults when no data exists', async () => {
    vi.mocked(IndexReport.find).mockReturnValue(makeFindMock([]) as never);
    vi.mocked(ImportedRepository.countDocuments).mockResolvedValue(0);
    vi.mocked(IndexReport.countDocuments).mockResolvedValue(0);
    vi.mocked(ImportedRepository.aggregate).mockResolvedValue([]);

    const result = await service.getAnalytics(VALID_USER_ID);

    expect(result.overview.repositories).toBe(0);
    expect(result.overview.totalFiles).toBe(0);
    expect(result.languages).toHaveLength(0);
  });

  it('should compute repository count', async () => {
    vi.mocked(IndexReport.find).mockReturnValue(makeFindMock([]) as never);
    vi.mocked(ImportedRepository.countDocuments).mockResolvedValue(2);
    vi.mocked(IndexReport.countDocuments).mockResolvedValue(0);
    vi.mocked(ImportedRepository.aggregate).mockResolvedValue([]);

    const result = await service.getAnalytics(VALID_USER_ID);
    expect(result.overview.repositories).toBe(2);
  });

  it('should compute language breakdown', async () => {
    // IndexReport.find is called twice: first for userReports (select + lean), second for health reports (select + sort + limit + lean)
    // Use mockReturnValueOnce for the first call so it returns the userReports shape
    vi.mocked(IndexReport.find).mockReturnValueOnce(makeFindMock([{ _id: 'report-1' }]) as never);
    vi.mocked(IndexReport.find).mockReturnValue(makeFindMock([{ _id: 'rep-1', fileCount: 10, chunkCount: 20, totalTokens: 5000, summary: 'test', techStack: { frameworks: ['express'], libraries: ['react'], authentication: [], databases: [] }, folderStructure: [{ name: 'src', type: 'folder' }] }]) as never);
    
    vi.mocked(ImportedRepository.countDocuments).mockResolvedValue(0);
    vi.mocked(IndexReport.countDocuments).mockResolvedValue(1);
    
    // IndexedFile.aggregate is called twice with different pipelines:
    // 1. $count pipeline for total files count → expects [{ total: N }]
    // 2. $group pipeline for language breakdown → expects [{ _id, files }]
    vi.mocked(IndexedFile.aggregate).mockImplementation((pipeline: object[]) => {
      const str = JSON.stringify(pipeline);
      if (str.includes('$count')) {
        return Promise.resolve([{ total: 15 }]);
      }
      return Promise.resolve([{ _id: 'typescript', files: 10 }, { _id: 'javascript', files: 5 }]);
    });
    
    vi.mocked(IndexedChunk.aggregate).mockResolvedValue([{ totalTokens: 5000 }]);
    vi.mocked(ImportedRepository.aggregate).mockResolvedValue([]);

    const result = await service.getAnalytics(VALID_USER_ID);

    expect(result.languages).toHaveLength(2);
    expect(result.languages[0]?.name).toBe('typescript');
    expect(result.languages[0]?.files).toBe(10);
    expect(result.linesOfCode.total).toBeGreaterThan(0);
  });
});
