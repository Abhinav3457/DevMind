import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService } from '../analytics.service';
import ImportedRepository from '../../models/ImportedRepository';
import IndexReport from '../../models/IndexReport';
import IndexedFile from '../../models/IndexedFile';
import IndexedChunk from '../../models/IndexedChunk';
import ActivityLog from '../../models/ActivityLog';
import CodeReview from '../../models/CodeReview';

vi.mock('../../models/ImportedRepository', () => ({ default: { countDocuments: vi.fn(), aggregate: vi.fn() } }));
vi.mock('../../models/IndexReport', () => ({ default: { find: vi.fn(), countDocuments: vi.fn() } }));
vi.mock('../../models/IndexedFile', () => ({ default: { aggregate: vi.fn() } }));
vi.mock('../../models/IndexedChunk', () => ({ default: { aggregate: vi.fn() } }));
vi.mock('../../models/ActivityLog', () => ({ default: { aggregate: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../models/CodeReview', () => ({ default: { aggregate: vi.fn().mockResolvedValue([]) } }));
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

  it('should build a 14-day activity trend and operation breakdown', async () => {
    vi.mocked(IndexReport.find).mockReturnValue(makeFindMock([]) as never);
    vi.mocked(ImportedRepository.countDocuments).mockResolvedValue(0);
    vi.mocked(IndexReport.countDocuments).mockResolvedValue(0);
    vi.mocked(ImportedRepository.aggregate).mockResolvedValue([]);

    // Day key is produced the same way the service does (local midnight → ISO date).
    const keyDate = new Date();
    keyDate.setHours(0, 0, 0, 0);
    const dayKey = keyDate.toISOString().slice(0, 10);

    vi.mocked(ActivityLog.aggregate)
      .mockResolvedValueOnce([{ _id: { day: dayKey, type: 'practice_solved' }, count: 2 }] as never)
      .mockResolvedValueOnce([
        { _id: 'practice_solved', count: 2 },
        { _id: 'repo_indexed', count: 1 },
      ] as never);

    const result = await service.getAnalytics(VALID_USER_ID);

    expect(result.trend.days).toHaveLength(14);
    expect(result.trend.practice.reduce((a, b) => a + b, 0)).toBe(2);
    expect(result.trend.operations.reduce((a, b) => a + b, 0)).toBe(2);
    expect(result.operationBreakdown).toEqual([
      { type: 'practice_solved', count: 2 },
      { type: 'repo_indexed', count: 1 },
    ]);
  });

  // ─── Quality metrics derived from persisted Code Reviews ────────

  describe('quality metrics (securityIssues / bugCount)', () => {
    function mockBaseAggregates() {
      vi.mocked(IndexReport.find).mockReturnValue(makeFindMock([]) as never);
      vi.mocked(ImportedRepository.countDocuments).mockResolvedValue(0);
      vi.mocked(IndexReport.countDocuments).mockResolvedValue(0);
      vi.mocked(ImportedRepository.aggregate).mockResolvedValue([]);
    }

    it('returns 0 for both values when the user has no reviews', async () => {
      mockBaseAggregates();
      vi.mocked(CodeReview.aggregate).mockResolvedValue([]);

      const result = await service.getAnalytics(VALID_USER_ID);

      expect(result.quality.securityIssues).toBe(0);
      expect(result.quality.bugCount).toBe(0);
    });

    it('increases securityIssues from a review with security findings', async () => {
      mockBaseAggregates();
      vi.mocked(CodeReview.aggregate).mockResolvedValue([{ securityIssues: 3, bugCount: 0 }] as never);

      const result = await service.getAnalytics(VALID_USER_ID);

      expect(result.quality.securityIssues).toBe(3);
      expect(result.quality.bugCount).toBe(0);
    });

    it('increases bugCount from a review with bug findings', async () => {
      mockBaseAggregates();
      vi.mocked(CodeReview.aggregate).mockResolvedValue([{ securityIssues: 0, bugCount: 4 }] as never);

      const result = await service.getAnalytics(VALID_USER_ID);

      expect(result.quality.bugCount).toBe(4);
      expect(result.quality.securityIssues).toBe(0);
    });

    it('aggregates findings across multiple reviews', async () => {
      mockBaseAggregates();
      // The aggregation sums every review's findings into one row.
      vi.mocked(CodeReview.aggregate).mockResolvedValue([{ securityIssues: 3, bugCount: 5 }] as never);

      const result = await service.getAnalytics(VALID_USER_ID);

      expect(result.quality.securityIssues).toBe(3);
      expect(result.quality.bugCount).toBe(5);
    });

    it('scopes the review aggregation to the authenticated user only', async () => {
      mockBaseAggregates();

      await service.getAnalytics(VALID_USER_ID);

      const pipeline = vi.mocked(CodeReview.aggregate).mock.calls[0]?.[0] as Array<{ $match?: { userId?: unknown } }>;
      expect(pipeline[0]?.$match?.userId).toBeDefined();
      // Another user's reviews can never be included.
      expect(String(pipeline[0]?.$match?.userId)).toBe(VALID_USER_ID);
    });
  });
});
