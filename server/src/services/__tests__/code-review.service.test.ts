import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeReviewService } from '../code-review.service';
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
});
