import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeReviewService } from '../code-review.service';
import { reviewerService } from '../../code-review/reviewer.service';
import { ApiError } from '../../utils/apiResponse';
import IndexReport from '../../models/IndexReport';
import IndexedFile from '../../models/IndexedFile';
import IndexedChunk from '../../models/IndexedChunk';

vi.mock('../../models/IndexReport', () => ({
  default: { findOne: vi.fn(), countDocuments: vi.fn() },
}));
vi.mock('../../models/IndexedFile', () => ({
  default: { find: vi.fn() },
}));
vi.mock('../../models/IndexedChunk', () => ({
  default: { find: vi.fn(), countDocuments: vi.fn() },
}));

vi.mock('../../config/ai', () => ({
  generateFromAI: vi.fn().mockResolvedValue('Test review output'),
}));

vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function createQueryMock(result: unknown) {
  return {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

describe('CodeReviewService', () => {
  let service: CodeReviewService;

  beforeEach(() => {
    service = new CodeReviewService();
    vi.clearAllMocks();
    // Chainable defaults for models used by nested services (duplicateService)
    vi.mocked(IndexedChunk.countDocuments).mockResolvedValue(0);
    vi.mocked(IndexedChunk.find).mockReturnValue(createQueryMock([]) as never);
    vi.mocked(IndexedFile.find).mockReturnValue(createQueryMock([]) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });



  it('should throw 404 if report not found', async () => {
    vi.mocked(IndexReport.findOne).mockResolvedValue(null);
    await expect(service.reviewRepository('rep-1', 'user-1')).rejects.toThrow(ApiError);
  });

  it('should throw 400 if report not completed', async () => {
    vi.mocked(IndexReport.findOne).mockResolvedValue({ status: 'processing' } as never);
    await expect(service.reviewRepository('rep-1', 'user-1')).rejects.toThrow('not completed');
  });

  it('should throw 404 if no files found', async () => {
    vi.mocked(IndexReport.findOne).mockResolvedValue({ status: 'completed' } as never);
    vi.mocked(IndexedFile.find).mockReturnValue(createQueryMock([]) as never);
    await expect(service.reviewRepository('rep-1', 'user-1')).rejects.toThrow('No files found');
  });

  it('should return review result for files with content', async () => {
    vi.mocked(IndexReport.findOne).mockResolvedValue({ status: 'completed' } as never);
    
    const mockFiles = [
      { _id: 'file-1', path: 'src/test.ts', functions: [], classes: [], imports: [], exports: [], dependencies: [], name: 'test.ts', language: 'typescript', size: 100 },
      { _id: 'file-2', path: 'src/index.ts', functions: [], classes: [], imports: [], exports: [], dependencies: [], name: 'index.ts', language: 'typescript', size: 200 },
    ];
    vi.mocked(IndexedFile.find).mockReturnValue(createQueryMock(mockFiles) as never);
    
    const mockChunks = [
      { _id: { toString: () => 'chunk-1' }, fileId: { toString: () => 'file-1' }, content: 'const x = 1;', index: 0, startLine: 1, endLine: 1, type: 'function', tokenCount: 5 },
      { _id: { toString: () => 'chunk-2' }, fileId: { toString: () => 'file-2' }, content: 'const y = 2;', index: 0, startLine: 1, endLine: 1, type: 'function', tokenCount: 5 },
    ];
    vi.mocked(IndexedChunk.find).mockReturnValue(createQueryMock(mockChunks) as never);

    const result = await service.reviewRepository('rep-1', 'user-1');

    expect(result.filesReviewed).toBe(2);
    expect(result.totalIssues).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('should handle file path filtering', async () => {
    vi.mocked(IndexReport.findOne).mockResolvedValue({ status: 'completed' } as never);
    vi.mocked(IndexedFile.find).mockReturnValue(createQueryMock([]) as never);
    await expect(service.reviewRepository('rep-1', 'user-1', ['src/app.ts'])).rejects.toThrow('No files found');
  });

  it('should reconstruct file content with accurate line numbers from chunk start/end lines', async () => {
    vi.mocked(IndexReport.findOne).mockResolvedValue({ status: 'completed' } as never);

    const mockFiles = [
      { _id: 'file-1', path: 'src/test.ts', functions: [], classes: [], imports: [], exports: [], dependencies: [], name: 'test.ts', language: 'typescript', size: 100 },
    ];
    vi.mocked(IndexedFile.find).mockReturnValue(createQueryMock(mockFiles) as never);

    // Chunks start mid-file: lines 1-4 uncovered, line 5 is a section,
    // lines 7-8 another section (line 6 uncovered).
    const mockChunks = [
      { _id: { toString: () => 'chunk-1' }, fileId: { toString: () => 'file-1' }, content: 'const five = 5;', startLine: 5, endLine: 5, index: 0, type: 'section', tokenCount: 1 },
      { _id: { toString: () => 'chunk-2' }, fileId: { toString: () => 'file-1' }, content: 'const seven = 7;\nconst eight = 8;', startLine: 7, endLine: 8, index: 1, type: 'section', tokenCount: 1 },
    ];
    vi.mocked(IndexedChunk.find).mockReturnValue(createQueryMock(mockChunks) as never);

    const reviewSpy = vi.spyOn(reviewerService, 'reviewFiles').mockResolvedValue({
      score: 80,
      summary: 'ok',
      categories: {
        bugs: { issues: [], score: 100, summary: '' },
        security: { issues: [], score: 100, summary: '' },
        performance: { issues: [], score: 100, summary: '' },
        codeSmells: { issues: [], score: 100, summary: '' },
        solidViolations: { issues: [], score: 100, summary: '' },
      },
      refactoringSuggestions: [],
      fixedVersion: '',
      totalIssues: 0,
    });

    await service.reviewRepository('rep-1', 'user-1');

    expect(reviewSpy).toHaveBeenCalledTimes(1);
    const filesArg = reviewSpy.mock.calls[0]![0];
    expect(filesArg).toHaveLength(1);
    // Blank placeholders keep every line aligned with the real file.
    expect(filesArg[0]!.content.split('\n')).toEqual([
      '', '', '', '',
      'const five = 5;',
      '',
      'const seven = 7;',
      'const eight = 8;',
    ]);
  });
});
