import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CACHE_LIMITS, LeetCodeService } from '../leetcode.service';

vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const DAY = 86400;
const today = Math.floor(Date.now() / 86400000);

const CALENDAR = JSON.stringify({
  [today * DAY]: 2,
  [(today - 1) * DAY]: 1,
  [(today - 5) * DAY]: 3,
});

function makeResponse(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(payload),
  };
}

function validPayload() {
  return {
    data: {
      matchedUser: {
        username: 'devmind',
        profile: { ranking: 123456, reputation: 42, realName: 'Dev Mind', userAvatar: 'https://x/a.png' },
        submitStats: {
          acSubmissionNum: [
            { difficulty: 'All', count: 300 },
            { difficulty: 'Easy', count: 150 },
            { difficulty: 'Medium', count: 120 },
            { difficulty: 'Hard', count: 30 },
          ],
        },
        submissionCalendar: CALENDAR,
      },
      userContestRanking: { attendedContestsCount: 12, rating: 1789.456, globalRanking: 9876, topPercentage: 4.2 },
    },
  };
}

describe('LeetCodeService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shapes solved counts, contest info and streak from a valid response', async () => {
    fetchMock.mockResolvedValue(makeResponse(validPayload()));
    const service = new LeetCodeService();

    const stats = await service.getStats('devmind');

    expect(stats.username).toBe('devmind');
    expect(stats.solved).toEqual({ easy: 150, medium: 120, hard: 30, total: 300 });
    expect(stats.contest.rating).toBe(1789.46);
    expect(stats.contest.attended).toBe(12);
    expect(stats.streak.current).toBe(2);
    expect(stats.streak.activeDaysLastYear).toBe(3);
    expect(stats.ranking).toBe(123456);
  });

  it('throws 404 when the user does not exist', async () => {
    fetchMock.mockResolvedValue(makeResponse({ data: { matchedUser: null } }));
    const service = new LeetCodeService();

    await expect(service.getStats('nobody')).rejects.toThrow('was not found');
  });

  it('rejects an invalid username without calling the network', async () => {
    const service = new LeetCodeService();

    await expect(service.getStats('../etc/passwd')).rejects.toThrow('Invalid LeetCode username');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches results so a repeated lookup does not refetch', async () => {
    fetchMock.mockResolvedValue(makeResponse(validPayload()));
    const service = new LeetCodeService();

    await service.getStats('devmind');
    await service.getStats('devmind');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps a non-ok HTTP status to a service error', async () => {
    fetchMock.mockResolvedValue(makeResponse({}, false, 403));
    const service = new LeetCodeService();

    await expect(service.getStats('devmind')).rejects.toThrow('HTTP 403');
  });

  it('shapes a LeetCode problem list, normalizing difficulty and acceptance rate', async () => {
    fetchMock.mockResolvedValue(makeResponse({
      data: {
        questionList: {
          totalNum: 2,
          data: [
            { questionFrontendId: '1', title: 'Two Sum', titleSlug: 'two-sum', difficulty: 'Easy', acRate: 57.957, isPaidOnly: false, topicTags: [{ name: 'Array' }] },
            { questionFrontendId: '2', title: 'Premium Thing', titleSlug: 'premium-thing', difficulty: 'Medium', acRate: 12.34, isPaidOnly: true, topicTags: [] },
          ],
        },
      },
    }));
    const service = new LeetCodeService();

    const list = await service.listProblems({ page: 1, limit: 30 });

    expect(list.total).toBe(2);
    expect(list.problems[0]).toMatchObject({ slug: 'two-sum', difficulty: 'easy', acRate: 58, paidOnly: false, tags: ['Array'] });
    expect(list.problems[1]).toMatchObject({ difficulty: 'medium', paidOnly: true });
  });

  it('shapes a question and groups example test cases by parameter count', async () => {
    fetchMock.mockResolvedValue(makeResponse({
      data: {
        question: {
          questionFrontendId: '1',
          title: 'Two Sum',
          titleSlug: 'two-sum',
          difficulty: 'Easy',
          content: '<p>Return <code>indices</code>.</p><pre>nums = [2,7]\ntarget = 9</pre>',
          exampleTestcases: '[2,7,11,15]\n9\n[3,2,4]\n6',
          hints: ['Use a hash map'],
          isPaidOnly: false,
          topicTags: [{ name: 'Array' }],
          codeSnippets: [{ lang: 'Python3', langSlug: 'python3', code: 'class Solution: pass' }],
          metaData: JSON.stringify({ name: 'twoSum', params: [{ name: 'nums' }, { name: 'target' }] }),
        },
      },
    }));
    const service = new LeetCodeService();

    const q = await service.getQuestion('two-sum');

    expect(q.functionName).toBe('twoSum');
    expect(q.difficulty).toBe('easy');
    expect(q.exampleTestcases).toEqual(['[2,7,11,15]\n9', '[3,2,4]\n6']);
    expect(q.hints).toEqual(['Use a hash map']);
    expect(q.description).toContain('indices');
    expect(q.description).toContain('```');
    expect(q.codeSnippets[0]).toEqual({ lang: 'Python3', langSlug: 'python3', code: 'class Solution: pass' });
  });

  it('throws 404 when a question slug is unknown', async () => {
    fetchMock.mockResolvedValue(makeResponse({ data: { question: null } }));
    const service = new LeetCodeService();

    await expect(service.getQuestion('does-not-exist')).rejects.toThrow('was not found');
  });

  it('converts statement HTML to markdown', () => {
    const service = new LeetCodeService();
    const md = service.htmlToMarkdown('<p>Use <strong>fast</strong> code &amp; win</p>');

    expect(md).toContain('**fast**');
    expect(md).toContain('&');
    expect(md).not.toContain('<p>');
  });

  // ── Example grouping (regression: metadata absent) ────────

  function questionPayload(overrides: Record<string, unknown>) {
    return makeResponse({
      data: {
        question: {
          questionFrontendId: '1',
          title: 'Sample',
          titleSlug: 'sample',
          difficulty: 'Easy',
          content: '<p>x</p>',
          hints: [],
          isPaidOnly: false,
          topicTags: [],
          codeSnippets: [],
          ...overrides,
        },
      },
    });
  }

  it('groups four example lines into two examples when metadata is missing', async () => {
    fetchMock.mockResolvedValue(questionPayload({ exampleTestcases: '[2,7,11,15]\n9\n[3,2,4]\n6' }));
    const service = new LeetCodeService();

    const q = await service.getQuestion('sample');

    expect(q.exampleTestcases).toEqual(['[2,7,11,15]\n9', '[3,2,4]\n6']);
  });

  it('keeps one example per line for a single-parameter problem', async () => {
    fetchMock.mockResolvedValue(questionPayload({
      exampleTestcases: '[1,2,3]\n[4,5]\n[6]',
      metaData: JSON.stringify({ name: 'solve', params: [{ name: 'nums' }] }),
    }));
    const service = new LeetCodeService();

    const q = await service.getQuestion('sample');

    expect(q.exampleTestcases).toEqual(['[1,2,3]', '[4,5]', '[6]']);
  });

  it('infers the parameter count from the starter signature when metadata is missing', async () => {
    // Every line is the same shape, so only the signature can disambiguate.
    fetchMock.mockResolvedValue(questionPayload({
      exampleTestcases: '1\n2\n3\n4',
      codeSnippets: [
        {
          lang: 'TypeScript',
          langSlug: 'typescript',
          code: 'function solve(a: number, b: number): number {\n  return a + b;\n}\n',
        },
      ],
    }));
    const service = new LeetCodeService();

    const q = await service.getQuestion('sample');

    expect(q.exampleTestcases).toEqual(['1\n2', '3\n4']);
  });

  it('returns no test cases rather than guessing when grouping is ambiguous', async () => {
    fetchMock.mockResolvedValue(questionPayload({ exampleTestcases: '1\n2\n3\n4' }));
    const service = new LeetCodeService();

    const q = await service.getQuestion('sample');

    expect(q.exampleTestcases).toEqual([]);
  });

  it('treats a missing exampleTestcases field as no test cases instead of crashing', async () => {
    fetchMock.mockResolvedValue(questionPayload({}));
    const service = new LeetCodeService();

    const q = await service.getQuestion('sample');

    expect(q.exampleTestcases).toEqual([]);
  });

  // ── Response-shape robustness ─────────────────────────────

  it('surfaces a clear error when the question response shape changes', async () => {
    fetchMock.mockResolvedValue(makeResponse({ data: { somethingElse: {} } }));
    const service = new LeetCodeService();

    await expect(service.getQuestion('two-sum')).rejects.toThrow('unexpected question response');
  });

  it('surfaces a clear error when the problem-list response shape changes', async () => {
    fetchMock.mockResolvedValue(makeResponse({ data: { somethingElse: {} } }));
    const service = new LeetCodeService();

    await expect(service.listProblems({ page: 1, limit: 30 })).rejects.toThrow(
      'unexpected problem-list response',
    );
  });

  it('surfaces a clear error when the profile response shape changes', async () => {
    fetchMock.mockResolvedValue(makeResponse({ data: { somethingElse: {} } }));
    const service = new LeetCodeService();

    await expect(service.getStats('devmind')).rejects.toThrow('unexpected profile response');
  });

  // ── Cache bounds ──────────────────────────────────────────

  it('bounds the problem-list cache so distinct searches cannot grow it forever', async () => {
    fetchMock.mockResolvedValue(makeResponse({ data: { questionList: { totalNum: 0, data: [] } } }));
    const service = new LeetCodeService();

    for (let i = 0; i < CACHE_LIMITS.list + 25; i++) {
      await service.listProblems({ search: 'query-' + i, page: 1, limit: 30 });
    }

    const cache = (service as unknown as { listCache: Map<string, unknown> }).listCache;
    expect(cache.size).toBeLessThanOrEqual(CACHE_LIMITS.list);
  });
});
