import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JudgeService, JudgeProblem } from '../judge.service';

const { mockGenerateFromAI } = vi.hoisted(() => ({
  mockGenerateFromAI: vi.fn(),
}));

vi.mock('../../config/ai', () => ({ generateFromAI: mockGenerateFromAI }));
vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const problem = {
  title: 'Two Sum',
  difficulty: 'easy',
  category: 'Arrays & Hashing',
  description: 'Return two indices.',
  examples: [{ input: '[2,7], 9', output: '[0,1]' }],
  testCases: [
    { input: '[2,7], 9', expectedOutput: '[0,1]' },
    { input: '[3,3], 6', expectedOutput: '[0,1]' },
  ],
  functionName: 'twoSum',
} as unknown as JudgeProblem;

const VALID_CODE = 'function twoSum(nums, target) { return [0, 1]; }';

describe('JudgeService', () => {
  let service: JudgeService;

  beforeEach(() => {
    service = new JudgeService();
    vi.clearAllMocks();
  });

  it('parses an accepted verdict out of fenced JSON with surrounding prose', async () => {
    mockGenerateFromAI.mockResolvedValue(
      'Here is my evaluation:\n```json\n' +
        JSON.stringify({
          status: 'accepted',
          passedTests: 2,
          totalTests: 2,
          score: 95,
          timeComplexity: 'O(n)',
          spaceComplexity: 'O(n)',
          feedback: 'Clean solution.',
          issues: [],
          betterApproach: 'Use a hash map.',
          improvedCode: 'function twoSum() {}',
        }) +
        '\n```\nHope that helps!',
    );

    const result = await service.judge(problem, VALID_CODE, 'javascript');

    expect(result.status).toBe('accepted');
    expect(result.score).toBe(95);
    expect(result.passedTests).toBe(2);
    expect(result.totalTests).toBe(2);
    expect(result.timeComplexity).toBe('O(n)');
    expect(result.improvedCode).toBe('function twoSum() {}');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('clamps an inflated passedTests count to the real test count', async () => {
    mockGenerateFromAI.mockResolvedValue(
      JSON.stringify({ status: 'accepted', passedTests: 99, score: 500, feedback: 'ok' }),
    );

    const result = await service.judge(problem, VALID_CODE, 'javascript');

    expect(result.passedTests).toBe(2);
    expect(result.score).toBe(100);
    expect(result.totalTests).toBe(2);
  });

  it('normalizes issues and drops unknown severities', async () => {
    mockGenerateFromAI.mockResolvedValue(
      JSON.stringify({
        status: 'wrong_answer',
        passedTests: 1,
        score: 40,
        issues: [
          { severity: 'critical', message: 'Off-by-one', suggestion: 'Fix the bound' },
          { severity: 'weird', message: 'Style', suggestion: 'Prefer const' },
          { severity: 'minor', suggestion: 'no message here' },
        ],
      }),
    );

    const result = await service.judge(problem, VALID_CODE, 'javascript');

    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toEqual({ severity: 'critical', message: 'Off-by-one', suggestion: 'Fix the bound' });
    expect(result.issues[1]!.severity).toBe('minor');
  });

  it('falls back to needs_review when the AI output is not valid JSON', async () => {
    mockGenerateFromAI.mockResolvedValue('I could not evaluate this.');

    const result = await service.judge(problem, VALID_CODE, 'javascript');

    expect(result.status).toBe('needs_review');
    expect(result.score).toBe(50);
    expect(result.totalTests).toBe(2);
  });

  it('rejects an empty submission without calling the AI', async () => {
    const result = await service.judge(problem, '   ', 'javascript');

    expect(result.status).toBe('wrong_answer');
    expect(result.score).toBe(0);
    expect(mockGenerateFromAI).not.toHaveBeenCalled();
  });

  it('returns error status when the AI provider fails', async () => {
    mockGenerateFromAI.mockRejectedValue(new Error('All AI providers failed'));

    const result = await service.judge(problem, VALID_CODE, 'javascript');

    expect(result.status).toBe('error');
    expect(result.feedback).toContain('unavailable');
  });

  it('retries once when the first AI response is empty', async () => {
    mockGenerateFromAI
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce(JSON.stringify({ status: 'accepted', passedTests: 2, score: 100, feedback: 'ok' }));

    const result = await service.judge(problem, VALID_CODE, 'javascript');

    expect(result.status).toBe('accepted');
    expect(mockGenerateFromAI).toHaveBeenCalledTimes(2);
  });
});
