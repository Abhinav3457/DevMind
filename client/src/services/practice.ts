import apiClient from '../api/axios';

export type PracticeDifficulty = 'easy' | 'medium' | 'hard';
export type SubmissionStatus = 'accepted' | 'wrong_answer' | 'needs_review' | 'error';

export interface ProblemListItem {
  id: string;
  slug: string;
  title: string;
  difficulty: PracticeDifficulty;
  category: string;
  tags: string[];
  solved: boolean;
  bestScore: number;
  attempts: number;
}

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface ProblemTestCase {
  input: string;
  expectedOutput: string;
}

export interface PracticeProblemDetail {
  id: string;
  slug: string;
  title: string;
  difficulty: PracticeDifficulty;
  category: string;
  description: string;
  examples: ProblemExample[];
  constraints: string[];
  hints: string[];
  functionName: string;
  starterCode: Record<string, string>;
  tags: string[];
  testCases: ProblemTestCase[];
}

export interface JudgeIssue {
  severity: 'critical' | 'major' | 'minor';
  message: string;
  suggestion: string;
}

export interface SubmissionResult {
  submissionId: string;
  status: SubmissionStatus;
  score: number;
  passedTests: number;
  totalTests: number;
  timeComplexity: string;
  spaceComplexity: string;
  feedback: string;
  issues: JudgeIssue[];
  betterApproach: string;
  improvedCode: string;
  durationMs: number;
}

export interface StoredSubmission extends SubmissionResult {
  id: string;
  problemSlug: string;
  language: string;
  code: string;
  createdAt: string;
}

export interface ProblemDetailResponse {
  problem: PracticeProblemDetail;
  lastSubmission: StoredSubmission | null;
}

export interface PracticeStats {
  totalProblems: number;
  solved: { easy: number; medium: number; hard: number; total: number };
  totals: { easy: number; medium: number; hard: number };
  totalSubmissions: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
}

export interface ProblemFilters {
  difficulty?: PracticeDifficulty | '';
  category?: string;
  search?: string;
}

export async function fetchProblems(filters: ProblemFilters = {}): Promise<ProblemListItem[]> {
  const params: Record<string, string> = {};
  if (filters.difficulty) params.difficulty = filters.difficulty;
  if (filters.category) params.category = filters.category;
  if (filters.search) params.search = filters.search;

  const response = await apiClient.get('/practice/problems', { params });
  return response.data.data;
}

export async function fetchProblem(slug: string): Promise<ProblemDetailResponse> {
  const response = await apiClient.get(`/practice/problems/${slug}`);
  return response.data.data;
}

export async function submitSolution(
  slug: string,
  code: string,
  language: string,
): Promise<SubmissionResult> {
  const response = await apiClient.post(`/practice/problems/${slug}/submit`, { code, language });
  return response.data.data;
}

export async function fetchPracticeStats(): Promise<PracticeStats> {
  const response = await apiClient.get('/practice/stats');
  return response.data.data;
}

export async function fetchSubmissions(limit = 20): Promise<StoredSubmission[]> {
  const response = await apiClient.get('/practice/submissions', { params: { limit } });
  return response.data.data;
}

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

export async function fetchLeetcodeStats(username: string): Promise<LeetCodeStats> {
  const response = await apiClient.get('/practice/leetcode/' + encodeURIComponent(username));
  return response.data.data;
}

export interface LeetCodeProblemSummary {
  id: string;
  slug: string;
  title: string;
  difficulty: PracticeDifficulty;
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
  difficulty: PracticeDifficulty;
  description: string;
  exampleTestcases: string[];
  hints: string[];
  tags: string[];
  functionName: string;
  codeSnippets: LeetCodeCodeSnippet[];
  paidOnly: boolean;
}

export interface LeetCodeProblemDetail {
  problem: LeetCodeQuestion;
  lastSubmission: StoredSubmission | null;
}

export interface LeetCodeFilters {
  difficulty?: PracticeDifficulty | '';
  search?: string;
  tags?: string;
  page?: number;
  limit?: number;
}

export async function fetchLeetcodeProblems(filters: LeetCodeFilters = {}): Promise<LeetCodeProblemList> {
  const params: Record<string, string | number> = {};
  if (filters.difficulty) params.difficulty = filters.difficulty;
  if (filters.search) params.search = filters.search;
  if (filters.tags) params.tags = filters.tags;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  const response = await apiClient.get('/practice/leetcode/problems', { params });
  return response.data.data;
}

export async function fetchLeetcodeProblem(slug: string): Promise<LeetCodeProblemDetail> {
  const response = await apiClient.get('/practice/leetcode/questions/' + slug);
  return response.data.data;
}

export async function submitLeetcodeSolution(
  slug: string,
  code: string,
  language: string,
): Promise<SubmissionResult> {
  const response = await apiClient.post('/practice/leetcode/questions/' + slug + '/submit', { code, language });
  return response.data.data;
}
