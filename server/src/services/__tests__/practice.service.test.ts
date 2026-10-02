import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PracticeService } from '../practice.service';

const {
  mockProblemFindOne,
  mockProblemEstimatedCount,
  mockSubmissionCreate,
  mockSubmissionCountDocuments,
  mockJudge,
  mockLogActivity,
  mockNotificationCreate,
} = vi.hoisted(() => ({
  mockProblemFindOne: vi.fn(),
  mockProblemEstimatedCount: vi.fn().mockResolvedValue(8),
  mockSubmissionCreate: vi.fn(),
  mockSubmissionCountDocuments: vi.fn().mockResolvedValue(0),
  mockJudge: vi.fn(),
  mockLogActivity: vi.fn().mockResolvedValue(undefined),
  mockNotificationCreate: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../models/PracticeProblem', () => ({
  default: {
    findOne: mockProblemFindOne,
    estimatedDocumentCount: mockProblemEstimatedCount,
    updateOne: vi.fn(),
    find: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock('../../models/PracticeSubmission', () => ({
  default: {
    create: mockSubmissionCreate,
    countDocuments: mockSubmissionCountDocuments,
    find: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock('../../practice/judge.service', () => ({
  judgeService: { judge: mockJudge },
}));

vi.mock('../activity.service', () => ({ logActivity: mockLogActivity }));
vi.mock('../notification.service', () => ({ notificationService: { create: mockNotificationCreate } }));
vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const problemDoc = {
  _id: 'prob-1',
  slug: 'two-sum',
  title: 'Two Sum',
  difficulty: 'easy',
  testCases: [{ input: 'a', expectedOutput: 'b' }],
};

const acceptedVerdict = {
  status: 'accepted' as const,
  score: 92,
  passedTests: 1,
  totalTests: 1,
  timeComplexity: 'O(n)',
  spaceComplexity: 'O(n)',
  feedback: 'Good.',
  issues: [],
  betterApproach: '',
  improvedCode: '',
  durationMs: 1200,
};

describe('PracticeService', () => {
  let service: PracticeService;

  beforeEach(() => {
    service = new PracticeService();
    vi.clearAllMocks();
    mockProblemEstimatedCount.mockResolvedValue(8);
    mockSubmissionCountDocuments.mockResolvedValue(0);
  });

  describe('submit', () => {
    it('rejects an unsupported language before touching the database', async () => {
      await expect(service.submit('user-1', 'two-sum', 'solution', 'cobol')).rejects.toThrow(
        'Unsupported language',
      );
      expect(mockProblemFindOne).not.toHaveBeenCalled();
    });

    it('throws 404 when the problem does not exist', async () => {
      mockProblemFindOne.mockResolvedValue(null);
      await expect(service.submit('user-1', 'missing', 'solution', 'javascript')).rejects.toThrow(
        'Problem not found',
      );
    });

    it('persists the submission and returns the verdict with an id', async () => {
      mockProblemFindOne.mockResolvedValue(problemDoc);
      mockJudge.mockResolvedValue(acceptedVerdict);
      mockSubmissionCreate.mockResolvedValue({ _id: { toString: () => 'sub-1' } });

      const result = await service.submit('user-1', 'two-sum', 'function twoSum() {}', 'javascript');

      expect(mockJudge).toHaveBeenCalledWith(problemDoc, 'function twoSum() {}', 'javascript');
      expect(mockSubmissionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          problemSlug: 'two-sum',
          status: 'accepted',
          score: 92,
        }),
      );
      expect(result.submissionId).toBe('sub-1');
      expect(result.status).toBe('accepted');
    });

    it('logs activity and notifies only on the first accepted solve', async () => {
      mockProblemFindOne.mockResolvedValue(problemDoc);
      mockJudge.mockResolvedValue(acceptedVerdict);
      mockSubmissionCreate.mockResolvedValue({ _id: { toString: () => 'sub-1' } });
      mockSubmissionCountDocuments.mockResolvedValue(0);

      await service.submit('user-1', 'two-sum', 'code', 'javascript');

      expect(mockLogActivity).toHaveBeenCalledTimes(1);
      expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    });

    it('does not log or notify on a repeat solve', async () => {
      mockProblemFindOne.mockResolvedValue(problemDoc);
      mockJudge.mockResolvedValue(acceptedVerdict);
      mockSubmissionCreate.mockResolvedValue({ _id: { toString: () => 'sub-2' } });
      mockSubmissionCountDocuments.mockResolvedValue(1);

      await service.submit('user-1', 'two-sum', 'code', 'javascript');

      expect(mockLogActivity).not.toHaveBeenCalled();
      expect(mockNotificationCreate).not.toHaveBeenCalled();
    });
  });
});
