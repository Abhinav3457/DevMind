import { ApiError } from '../utils/apiResponse';
import logger from '../utils/logger';

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';
const REQUEST_TIMEOUT_MS = 12000;
const USER_AGENT = 'Mozilla/5.0 (compatible; DevMindAI/1.0; +https://devmind.ai)';

const STATS_CACHE_TTL_MS = 10 * 60 * 1000;
const LIST_CACHE_TTL_MS = 5 * 60 * 1000;
const QUESTION_CACHE_TTL_MS = 30 * 60 * 1000;

export type LeetCodeDifficulty = 'easy' | 'medium' | 'hard';

export interface LeetCodeStats {
  username: string;
  realName: string;
  avatar: string;
  ranking: number | null;
  reputation: number | null;
  solved: { easy: number; medium: number; hard: number; total: number };
  contest: {
    attended: number;
    rating: number | null;
    globalRanking: number | null;
    topPercentage: number | null;
  };
  streak: { current: number; activeDaysLastYear: number };
  fetchedAt: string;
}

export interface LeetCodeProblemSummary {
  id: string;
  slug: string;
  title: string;
  difficulty: LeetCodeDifficulty;
  acRate: number;
  paidOnly: boolean;
  tags: string[];
}

export interface LeetCodeProblemList {
  total: number;
  problems: LeetCodeProblemSummary[];
}

export interface LeetCodeCodeSnippet {
  lang: string;
  langSlug: string;
  code: string;
}

export interface LeetCodeQuestion {
  id: string;
  slug: string;
  title: string;
  difficulty: LeetCodeDifficulty;
  description: string;
  exampleTestcases: string[];
  hints: string[];
  tags: string[];
  functionName: string;
  codeSnippets: LeetCodeCodeSnippet[];
  paidOnly: boolean;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const LIST_QUERY = `
  query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
    questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
      totalNum
      data {
        questionFrontendId
        title
        titleSlug
        difficulty
        acRate
        isPaidOnly
        topicTags { name slug }
      }
    }
  }
`;

const QUESTION_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionFrontendId
      title
      titleSlug
      difficulty
      content
      exampleTestcases
      hints
      isPaidOnly
      topicTags { name slug }
      codeSnippets { lang langSlug code }
      metaData
    }
  }
`;

const STATS_QUERY = `
  query getStats($username: String!) {
    matchedUser(username: $username) {
      username
      profile { ranking reputation realName userAvatar }
      submitStats { acSubmissionNum { difficulty count } }
      submissionCalendar
    }
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
      topPercentage
    }
  }
`;

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

export class LeetCodeService {
  private statsCache = new Map<string, CacheEntry<LeetCodeStats>>();
  private listCache = new Map<string, CacheEntry<LeetCodeProblemList>>();
  private questionCache = new Map<string, CacheEntry<LeetCodeQuestion>>();

  // ── Problem list ───────────────────────────────────────────

  async listProblems(filters: {
    difficulty?: string;
    tags?: string[];
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<LeetCodeProblemList> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(Math.max(1, filters.limit || 30), 50);
    const skip = (page - 1) * limit;

    const gqlFilters: Record<string, unknown> = {};
    if (filters.difficulty) gqlFilters.difficulty = filters.difficulty.toUpperCase();
    if (filters.tags && filters.tags.length > 0) gqlFilters.tags = filters.tags;
    if (filters.search) gqlFilters.searchKeywords = filters.search;

    const cacheKey = JSON.stringify({ skip, limit, gqlFilters });
    const cached = this.listCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const body = await this.post<{
      questionList?: {
        totalNum?: number;
        data?: Array<{
          questionFrontendId?: string;
          title?: string;
          titleSlug?: string;
          difficulty?: string;
          acRate?: number;
          isPaidOnly?: boolean;
          topicTags?: Array<{ name?: string }>;
        }>;
      };
    }>(LIST_QUERY, { categorySlug: 'all-code-essentials', limit, skip, filters: gqlFilters });

    const raw = body.questionList?.data || [];
    const result: LeetCodeProblemList = {
      total: body.questionList?.totalNum || 0,
      problems: raw.map((q) => ({
        id: q.questionFrontendId || '',
        slug: q.titleSlug || '',
        title: q.title || '',
        difficulty: this.normalizeDifficulty(q.difficulty),
        acRate: typeof q.acRate === 'number' ? Math.round(q.acRate * 10) / 10 : 0,
        paidOnly: !!q.isPaidOnly,
        tags: (q.topicTags || []).map((t) => t.name || '').filter(Boolean),
      })),
    };

    this.listCache.set(cacheKey, { data: result, expiresAt: Date.now() + LIST_CACHE_TTL_MS });
    return result;
  }

  // ── Question detail ────────────────────────────────────────

  async getQuestion(titleSlug: string): Promise<LeetCodeQuestion> {
    if (!/^[a-z0-9-]{1,120}$/.test(titleSlug)) {
      throw new ApiError(400, 'Invalid LeetCode problem slug');
    }

    const cached = this.questionCache.get(titleSlug);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const body = await this.post<{
      question?: {
        questionFrontendId?: string;
        title?: string;
        titleSlug?: string;
        difficulty?: string;
        content?: string | null;
        exampleTestcases?: string;
        hints?: string[];
        isPaidOnly?: boolean;
        topicTags?: Array<{ name?: string }>;
        codeSnippets?: Array<{ lang?: string; langSlug?: string; code?: string }>;
        metaData?: string;
      } | null;
    }>(QUESTION_QUERY, { titleSlug }, titleSlug);

    const q = body.question;
    if (!q) {
      throw new ApiError(404, 'LeetCode problem "' + titleSlug + '" was not found');
    }

    const meta = this.parseMeta(q.metaData);
    const question: LeetCodeQuestion = {
      id: q.questionFrontendId || '',
      slug: q.titleSlug || titleSlug,
      title: q.title || titleSlug,
      difficulty: this.normalizeDifficulty(q.difficulty),
      description: this.htmlToMarkdown(q.content || '') || 'No description available (this may be a premium problem).',
      exampleTestcases: this.splitTestCases(q.exampleTestcases || '', meta.params.length),
      hints: (q.hints || []).filter(Boolean),
      tags: (q.topicTags || []).map((t) => t.name || '').filter(Boolean),
      functionName: meta.name,
      codeSnippets: (q.codeSnippets || [])
        .filter((s) => s.langSlug && s.code)
        .map((s) => ({ lang: s.lang || s.langSlug!, langSlug: s.langSlug!, code: s.code! })),
      paidOnly: !!q.isPaidOnly,
    };

    this.questionCache.set(titleSlug, { data: question, expiresAt: Date.now() + QUESTION_CACHE_TTL_MS });
    return question;
  }

  // ── Profile stats ──────────────────────────────────────────

  async getStats(rawUsername: string): Promise<LeetCodeStats> {
    const username = rawUsername.trim();
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(username)) {
      throw new ApiError(400, 'Invalid LeetCode username');
    }

    const cacheKey = username.toLowerCase();
    const cached = this.statsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const body = await this.post<{
      matchedUser?: {
        username?: string;
        profile?: { ranking?: number; reputation?: number; realName?: string; userAvatar?: string };
        submitStats?: { acSubmissionNum?: Array<{ difficulty?: string; count?: number }> };
        submissionCalendar?: string;
      } | null;
      userContestRanking?: {
        attendedContestsCount?: number;
        rating?: number;
        globalRanking?: number;
        topPercentage?: number;
      } | null;
    }>(STATS_QUERY, { username }, username);

    const user = body.matchedUser;
    if (!user) {
      throw new ApiError(404, 'LeetCode user "' + username + '" was not found');
    }

    const counts: Record<string, number> = {};
    for (const row of user.submitStats?.acSubmissionNum || []) {
      if (row.difficulty) counts[row.difficulty.toLowerCase()] = row.count || 0;
    }

    const contest = body.userContestRanking;
    const stats: LeetCodeStats = {
      username: user.username || username,
      realName: user.profile?.realName || '',
      avatar: user.profile?.userAvatar || '',
      ranking: this.num(user.profile?.ranking),
      reputation: this.num(user.profile?.reputation),
      solved: {
        easy: counts.easy || 0,
        medium: counts.medium || 0,
        hard: counts.hard || 0,
        total: counts.all || 0,
      },
      contest: {
        attended: contest?.attendedContestsCount || 0,
        rating: this.round(contest?.rating),
        globalRanking: this.num(contest?.globalRanking),
        topPercentage: this.round(contest?.topPercentage),
      },
      streak: this.computeStreak(this.parseCalendar(user.submissionCalendar)),
      fetchedAt: new Date().toISOString(),
    };

    this.statsCache.set(cacheKey, { data: stats, expiresAt: Date.now() + STATS_CACHE_TTL_MS });
    return stats;
  }

  // ── GraphQL transport ──────────────────────────────────────

  private async post<T>(query: string, variables: Record<string, unknown>, refererSlug?: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(LEETCODE_GRAPHQL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
          Referer: refererSlug ? 'https://leetcode.com/problems/' + refererSlug + '/' : 'https://leetcode.com/',
          Origin: 'https://leetcode.com',
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ApiError(
          response.status === 429 ? 429 : 502,
          'LeetCode rejected the request (HTTP ' + response.status + '). Try again shortly.',
        );
      }

      const json = (await response.json()) as GraphQLResponse<T>;
      if (json.errors && json.errors.length > 0) {
        const message = json.errors[0]?.message || 'LeetCode returned an error';
        logger.warn('LeetCode: GraphQL error — ' + message.slice(0, 200));
        // A null user/question is expected for 404s; surface others as upstream errors.
        if (!json.data) {
          throw new ApiError(502, 'LeetCode could not answer that request. Try again shortly.');
        }
      }
      return (json.data || {}) as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(504, 'LeetCode took too long to respond. Try again.');
      }
      logger.error('LeetCode: request failed', error);
      throw new ApiError(502, 'Could not reach LeetCode. Try again shortly.');
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  private normalizeDifficulty(value?: string): LeetCodeDifficulty {
    const lower = (value || '').toLowerCase();
    if (lower === 'medium' || lower === 'hard') return lower;
    return 'easy';
  }

  private parseMeta(raw?: string): { name: string; params: unknown[] } {
    if (!raw) return { name: '', params: [] };
    try {
      const parsed = JSON.parse(raw) as { name?: string; params?: unknown[] };
      return { name: parsed.name || '', params: Array.isArray(parsed.params) ? parsed.params : [] };
    } catch {
      return { name: '', params: [] };
    }
  }

  /**
   * exampleTestcases is newline-separated, one line per parameter. Grouping by
   * the parameter count turns it back into one entry per example.
   */
  private splitTestCases(raw: string, paramCount: number): string[] {
    const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return [];
    const size = paramCount > 0 ? paramCount : 1;
    if (lines.length <= size) return [lines.join('\n')];

    const groups: string[] = [];
    for (let i = 0; i < lines.length; i += size) {
      groups.push(lines.slice(i, i + size).join('\n'));
    }
    return groups;
  }

  private parseCalendar(raw?: string): Map<number, number> {
    const map = new Map<number, number>();
    if (!raw) return map;
    try {
      const parsed = JSON.parse(raw) as Record<string, number>;
      for (const [ts, count] of Object.entries(parsed)) {
        const day = Math.floor(Number(ts) / 86400);
        if (!isNaN(day)) map.set(day, count);
      }
    } catch {
      /* ignore malformed calendars */
    }
    return map;
  }

  private computeStreak(calendar: Map<number, number>): { current: number; activeDaysLastYear: number } {
    if (calendar.size === 0) return { current: 0, activeDaysLastYear: 0 };

    const today = Math.floor(Date.now() / 86400000);
    let current = 0;
    let cursor = calendar.has(today) ? today : today - 1;
    if (calendar.has(today) || calendar.has(today - 1)) {
      while (calendar.has(cursor)) {
        current += 1;
        cursor -= 1;
      }
    }

    let activeDaysLastYear = 0;
    for (const [day] of calendar) {
      if (today - day <= 365) activeDaysLastYear += 1;
    }
    return { current, activeDaysLastYear };
  }

  private num(value: unknown): number | null {
    return typeof value === 'number' && isFinite(value) ? value : null;
  }

  private round(value: unknown): number | null {
    return typeof value === 'number' && isFinite(value) ? Math.round(value * 100) / 100 : null;
  }

  /** Minimal HTML → Markdown so the client can render statements with its Markdown component. */
  htmlToMarkdown(html: string): string {
    if (!html) return '';
    let text = html;

    // Preserve <pre> blocks (examples) as fenced code.
    text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_m, inner: string) => {
      const decoded = this.decodeEntities(inner.replace(/<[^>]+>/g, ''));
      return '\n```\n' + decoded.trim() + '\n```\n';
    });

    text = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|ul|ol|h[1-6])>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<strong[^>]*>|<b[^>]*>/gi, '**')
      .replace(/<\/strong>|<\/b>/gi, '**')
      .replace(/<em[^>]*>|<i[^>]*>/gi, '*')
      .replace(/<\/em>|<\/i>/gi, '*')
      .replace(/<code[^>]*>/gi, '`')
      .replace(/<\/code>/gi, '`')
      .replace(/<sup[^>]*>/gi, '^')
      .replace(/<\/sup>/gi, '')
      .replace(/<sub[^>]*>/gi, '_')
      .replace(/<\/sub>/gi, '')
      .replace(/<[^>]+>/g, '');

    text = this.decodeEntities(text);
    return text
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private decodeEntities(text: string): string {
    return text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }
}

export const leetcodeService = new LeetCodeService();
