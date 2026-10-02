import mongoose from 'mongoose';
import PracticeProblem, { IPracticeProblem, PracticeDifficulty } from '../models/PracticeProblem';
import PracticeSubmission from '../models/PracticeSubmission';
import { PROBLEM_BANK } from '../practice/problem-bank';
import { judgeService, JudgeResult, JudgeProblem } from '../practice/judge.service';
import { leetcodeService, LeetCodeProblemList, LeetCodeQuestion } from '../practice/leetcode.service';
import { logActivity } from './activity.service';
import { notificationService } from './notification.service';
import { ApiError } from '../utils/apiResponse';
import logger from '../utils/logger';

const SUPPORTED_LANGUAGES = [
  'typescript', 'javascript', 'python', 'python3', 'java', 'cpp', 'c', 'csharp',
  'go', 'golang', 'rust', 'ruby', 'kotlin', 'swift', 'php', 'dart', 'scala', 'elixir', 'erlang', 'racket',
];

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

export interface PracticeStats {
  totalProblems: number;
  solved: { easy: number; medium: number; hard: number; total: number };
  totals: { easy: number; medium: number; hard: number };
  totalSubmissions: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
}

export class PracticeService {
  /** Upsert the curated problem bank. Idempotent — safe to run on every boot. */
  async seedProblems(): Promise<number> {
    let count = 0;
    for (const problem of PROBLEM_BANK) {
      await PracticeProblem.updateOne(
        { slug: problem.slug },
        { $set: problem },
        { upsert: true },
      );
      count += 1;
    }
    logger.info('Practice: seeded ' + count + ' problems');
    return count;
  }

  async listProblems(
    userId: string,
    filters: { difficulty?: string; category?: string; search?: string } = {},
  ): Promise<ProblemListItem[]> {
    await this.ensureSeeded();

    const query: Record<string, unknown> = {};
    if (filters.difficulty) query.difficulty = filters.difficulty;
    if (filters.category) query.category = filters.category;
    if (filters.search) {
      const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [problems, submissions] = await Promise.all([
      PracticeProblem.find(query).sort({ order: 1, title: 1 }).lean(),
      PracticeSubmission.find({ userId, source: 'devmind' }).select('problemSlug status score').lean(),
    ]);

    const byProblem = new Map<string, { solved: boolean; bestScore: number; attempts: number }>();
    for (const s of submissions) {
      const key = s.problemSlug;
      const entry = byProblem.get(key) || { solved: false, bestScore: 0, attempts: 0 };
      entry.attempts += 1;
      entry.bestScore = Math.max(entry.bestScore, s.score);
      if (s.status === 'accepted') entry.solved = true;
      byProblem.set(key, entry);
    }

    return problems.map((p) => {
      const entry = byProblem.get(p.slug);
      return {
        id: (p._id as mongoose.Types.ObjectId).toString(),
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        category: p.category,
        tags: p.tags,
        solved: entry?.solved || false,
        bestScore: entry?.bestScore || 0,
        attempts: entry?.attempts || 0,
      };
    });
  }

  async getProblem(
    slug: string,
    userId: string,
  ): Promise<{ problem: Record<string, unknown>; lastSubmission: Record<string, unknown> | null }> {
    await this.ensureSeeded();

    const problem = await PracticeProblem.findOne({ slug }).lean();
    if (!problem) {
      throw new ApiError(404, 'Problem not found');
    }

    const lastSubmission = await PracticeSubmission.findOne({ userId, problemSlug: slug })
      .sort({ createdAt: -1 })
      .lean();

    return {
      problem: {
        id: (problem._id as mongoose.Types.ObjectId).toString(),
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
        category: problem.category,
        description: problem.description,
        examples: problem.examples,
        constraints: problem.constraints,
        hints: problem.hints,
        functionName: problem.functionName,
        starterCode: problem.starterCode,
        tags: problem.tags,
        // Never leak hidden expectations to the client — only the visible ones.
        testCases: problem.testCases.filter((t) => !t.hidden).map((t) => ({ input: t.input, expectedOutput: t.expectedOutput })),
      },
      lastSubmission: lastSubmission
        ? {
            id: (lastSubmission._id as mongoose.Types.ObjectId).toString(),
            language: lastSubmission.language,
            code: lastSubmission.code,
            status: lastSubmission.status,
            score: lastSubmission.score,
            passedTests: lastSubmission.passedTests,
            totalTests: lastSubmission.totalTests,
            timeComplexity: lastSubmission.timeComplexity,
            spaceComplexity: lastSubmission.spaceComplexity,
            feedback: lastSubmission.feedback,
            issues: lastSubmission.issues,
            betterApproach: lastSubmission.betterApproach,
            improvedCode: lastSubmission.improvedCode,
            createdAt: lastSubmission.createdAt,
          }
        : null,
    };
  }

  async submit(
    userId: string,
    slug: string,
    code: string,
    language: string,
  ): Promise<JudgeResult & { submissionId: string }> {
    await this.ensureSeeded();

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      throw new ApiError(400, 'Unsupported language. Use one of: ' + SUPPORTED_LANGUAGES.join(', '));
    }

    const problem = await PracticeProblem.findOne({ slug });
    if (!problem) {
      throw new ApiError(404, 'Problem not found');
    }

    const verdict = await judgeService.judge(problem, code, language);

    const submission = await PracticeSubmission.create({
      userId,
      problemId: problem._id,
      source: 'devmind',
      problemSlug: problem.slug,
      problemTitle: problem.title,
      difficulty: problem.difficulty,
      language,
      code,
      status: verdict.status,
      score: verdict.score,
      passedTests: verdict.passedTests,
      totalTests: verdict.totalTests,
      timeComplexity: verdict.timeComplexity,
      spaceComplexity: verdict.spaceComplexity,
      feedback: verdict.feedback,
      issues: verdict.issues,
      betterApproach: verdict.betterApproach,
      improvedCode: verdict.improvedCode,
      durationMs: verdict.durationMs,
    });

    if (verdict.status === 'accepted') {
      const firstSolve = (await PracticeSubmission.countDocuments({
        userId,
        problemSlug: slug,
        source: 'devmind',
        status: 'accepted',
        _id: { $ne: submission._id },
      })) === 0;

      if (firstSolve) {
        void logActivity({
          userId,
          type: 'practice_solved',
          description: 'Solved "' + problem.title + '" (' + problem.difficulty + ')',
          metadata: { slug: problem.slug, difficulty: problem.difficulty, score: verdict.score },
        });
        void notificationService.create({
          userId,
          type: 'practice_solved',
          title: 'Problem solved',
          message: 'You solved "' + problem.title + '" with a score of ' + verdict.score + '/100',
          data: { slug: problem.slug, score: verdict.score },
        });
      }
    }

    return { ...verdict, submissionId: submission._id.toString() };
  }

  async listSubmissions(
    userId: string,
    options: { limit?: number; problemSlug?: string } = {},
  ): Promise<Record<string, unknown>[]> {
    const limit = Math.min(options.limit || 20, 50);
    const query: Record<string, unknown> = { userId };
    if (options.problemSlug) query.problemSlug = options.problemSlug;

    const submissions = await PracticeSubmission.find(query).sort({ createdAt: -1 }).limit(limit).lean();

    return submissions.map((s) => ({
      id: (s._id as mongoose.Types.ObjectId).toString(),
      problemSlug: s.problemSlug,
      problemTitle: s.problemTitle,
      difficulty: s.difficulty,
      language: s.language,
      status: s.status,
      score: s.score,
      passedTests: s.passedTests,
      totalTests: s.totalTests,
      createdAt: s.createdAt,
    }));
  }

  // ─── LeetCode (live problems) ────────────────────────────────

  async listLeetcodeProblems(filters: {
    difficulty?: string;
    tags?: string[];
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<LeetCodeProblemList> {
    return leetcodeService.listProblems(filters);
  }

  async getLeetcodeProblem(
    slug: string,
    userId: string,
  ): Promise<{ problem: LeetCodeQuestion; lastSubmission: Record<string, unknown> | null }> {
    const [problem, lastSubmission] = await Promise.all([
      leetcodeService.getQuestion(slug),
      PracticeSubmission.findOne({ userId, problemSlug: slug, source: 'leetcode' })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return {
      problem,
      lastSubmission: lastSubmission
        ? {
            id: (lastSubmission._id as mongoose.Types.ObjectId).toString(),
            language: lastSubmission.language,
            code: lastSubmission.code,
            status: lastSubmission.status,
            score: lastSubmission.score,
            passedTests: lastSubmission.passedTests,
            totalTests: lastSubmission.totalTests,
            timeComplexity: lastSubmission.timeComplexity,
            spaceComplexity: lastSubmission.spaceComplexity,
            feedback: lastSubmission.feedback,
            issues: lastSubmission.issues,
            betterApproach: lastSubmission.betterApproach,
            improvedCode: lastSubmission.improvedCode,
            createdAt: lastSubmission.createdAt,
          }
        : null,
    };
  }

  async submitLeetcode(
    userId: string,
    slug: string,
    code: string,
    language: string,
  ): Promise<JudgeResult & { submissionId: string }> {
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      throw new ApiError(400, 'Unsupported language. Use one of: ' + SUPPORTED_LANGUAGES.join(', '));
    }

    const question = await leetcodeService.getQuestion(slug);

    // LeetCode only exposes example *inputs*; the judge derives the expected
    // outputs from the statement (which includes the worked examples).
    const spec: JudgeProblem = {
      title: question.title,
      difficulty: question.difficulty,
      category: question.tags[0] || 'LeetCode',
      description: question.description,
      examples: [],
      testCases: question.exampleTestcases.map((input) => ({ input })),
      functionName: question.functionName,
    };

    const verdict = await judgeService.judge(spec, code, language);

    const submission = await PracticeSubmission.create({
      userId,
      source: 'leetcode',
      problemSlug: question.slug,
      problemTitle: question.title,
      difficulty: question.difficulty,
      language,
      code,
      status: verdict.status,
      score: verdict.score,
      passedTests: verdict.passedTests,
      totalTests: verdict.totalTests,
      timeComplexity: verdict.timeComplexity,
      spaceComplexity: verdict.spaceComplexity,
      feedback: verdict.feedback,
      issues: verdict.issues,
      betterApproach: verdict.betterApproach,
      improvedCode: verdict.improvedCode,
      durationMs: verdict.durationMs,
    });

    if (verdict.status === 'accepted') {
      const firstSolve = (await PracticeSubmission.countDocuments({
        userId,
        problemSlug: question.slug,
        source: 'leetcode',
        status: 'accepted',
        _id: { $ne: submission._id },
      })) === 0;

      if (firstSolve) {
        void logActivity({
          userId,
          type: 'practice_solved',
          description: 'Solved LeetCode "' + question.title + '" (' + question.difficulty + ')',
          metadata: { slug: question.slug, difficulty: question.difficulty, source: 'leetcode', score: verdict.score },
        });
        void notificationService.create({
          userId,
          type: 'practice_solved',
          title: 'LeetCode problem solved',
          message: 'You solved "' + question.title + '" with a score of ' + verdict.score + '/100',
          data: { slug: question.slug, score: verdict.score, source: 'leetcode' },
        });
      }
    }

    return { ...verdict, submissionId: submission._id.toString() };
  }

  async getStats(userId: string): Promise<PracticeStats> {
    await this.ensureSeeded();

    const [totalsByDifficulty, solvedRows, totalSubmissions, acceptedSubmissions] = await Promise.all([
      PracticeProblem.aggregate<{ _id: PracticeDifficulty; count: number }>([
        { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      ]),
      // Derive solved-by-difficulty straight from submissions so both DevMind
      // and LeetCode solves are counted without a cross-collection lookup.
      PracticeSubmission.aggregate<{ _id: string; difficulty: string }>([
        { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'accepted' } },
        { $group: { _id: '$problemSlug', difficulty: { $first: '$difficulty' } } },
      ]),
      PracticeSubmission.countDocuments({ userId }),
      PracticeSubmission.countDocuments({ userId, status: 'accepted' }),
    ]);

    const totals = { easy: 0, medium: 0, hard: 0 };
    for (const row of totalsByDifficulty) {
      if (row._id === 'easy' || row._id === 'medium' || row._id === 'hard') {
        totals[row._id] = row.count;
      }
    }

    const solved = { easy: 0, medium: 0, hard: 0, total: 0 };
    for (const row of solvedRows) {
      const d = row.difficulty;
      if (d === 'easy' || d === 'medium' || d === 'hard') {
        solved[d] += 1;
      }
    }
    solved.total = solved.easy + solved.medium + solved.hard;

    return {
      totalProblems: totals.easy + totals.medium + totals.hard,
      solved,
      totals,
      totalSubmissions,
      acceptedSubmissions,
      acceptanceRate: totalSubmissions > 0 ? Math.round((acceptedSubmissions / totalSubmissions) * 100) : 0,
    };
  }

  /** Seed on first use so a fresh database has problems without a manual step. */
  private async ensureSeeded(): Promise<void> {
    const count = await PracticeProblem.estimatedDocumentCount();
    if (count === 0) {
      await this.seedProblems();
    }
  }
}

export const practiceService = new PracticeService();

// Re-exported so consumers (controllers/tests) share one problem type.
export type { IPracticeProblem };
