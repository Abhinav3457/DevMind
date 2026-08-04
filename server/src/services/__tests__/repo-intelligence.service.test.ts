import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoIntelligenceService } from '../repo-intelligence.service';

const { mockGenerateFromAI, mockClassify, mockRetrieve, mockBuildPrompt, mockIndexReport } = vi.hoisted(() => ({
  mockGenerateFromAI: vi.fn().mockResolvedValue('AI response'),
  mockClassify: vi.fn().mockReturnValue({ type: 'general', keywords: ['test'], targetFile: undefined, targetFunction: undefined }),
  mockRetrieve: vi.fn().mockResolvedValue({ relevantFiles: [], relevantChunks: [], techStack: '{}', folderStructure: '[]', reportSummary: 'Test summary', fileCount: 0 }),
  mockBuildPrompt: vi.fn().mockReturnValue({ systemInstruction: 'Be helpful', userPrompt: 'Question?' }),
  mockIndexReport: { findOne: vi.fn(), find: vi.fn() },
}));

vi.mock('../../config/ai', () => ({ generateFromAI: mockGenerateFromAI }));
vi.mock('../../repo-intelligence/classifier.service', () => ({ queryClassifierService: { classify: mockClassify } }));
vi.mock('../../repo-intelligence/retriever.service', () => ({ contextRetrieverService: { retrieve: mockRetrieve } }));
vi.mock('../../repo-intelligence/prompt-builder.service', () => ({ promptBuilderService: { build: mockBuildPrompt } }));
vi.mock('../../models/ImportedRepository', () => ({ default: { find: vi.fn() } }));
vi.mock('../../models/IndexReport', () => ({ default: mockIndexReport }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function chainMockResult(result: unknown) {
  return {
    sort: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

describe('RepoIntelligenceService', () => {
  let service: RepoIntelligenceService;

  beforeEach(() => {
    service = new RepoIntelligenceService();
    vi.clearAllMocks();
  });

  describe('getIndexStatus', () => {
    it('should return completed status when report exists', async () => {
      mockIndexReport.findOne.mockReturnValue(chainMockResult({
        _id: 'report-123', status: 'completed', fileCount: 42,
      }));
      const result = await service.getIndexStatus('user-123');
      expect(result.hasReport).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.fileCount).toBe(42);
    });

    it('should return null when no reports exist', async () => {
      mockIndexReport.findOne.mockReturnValue(chainMockResult(null));
      const result = await service.getIndexStatus('user-123');
      expect(result.hasReport).toBe(false);
    });
  });

  describe('ask', () => {
    it('should throw 404 if report not found', async () => {
      mockIndexReport.findOne.mockResolvedValue(null);
      await expect(service.ask('rep-1', 'user-1', 'Question?')).rejects.toThrow('Index report not found');
    });

    it('should throw 400 if report not completed', async () => {
      mockIndexReport.findOne.mockResolvedValue({ status: 'processing' } as never);
      await expect(service.ask('rep-1', 'user-1', 'Question?')).rejects.toThrow('not completed');
    });

    it('should resolve latest report', async () => {
      const completedReport = { _id: 'report-latest', status: 'completed' };
      // First findOne in ask('latest') path chains .sort({ createdAt: -1 })
      mockIndexReport.findOne.mockReturnValueOnce({
        sort: vi.fn().mockResolvedValue(completedReport),
      } as never);
      // Second findOne fetches the report directly
      mockIndexReport.findOne.mockResolvedValueOnce(completedReport);
      const result = await service.ask('latest', 'user-1', 'Question?');
      expect(result.answer).toBe('AI response');
    });
  });

  describe('listReports', () => {
    it('should return empty array when no reports', async () => {
      mockIndexReport.find.mockReturnValue(chainMockResult([]));
      const result = await service.listReports('user-123');
      expect(result).toHaveLength(0);
    });
  });

  describe('getQuestionTemplates', () => {
    it('should return templates', () => {
      expect(service.getQuestionTemplates().length).toBeGreaterThan(0);
    });
  });
});
