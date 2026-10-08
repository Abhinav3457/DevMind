import mongoose from 'mongoose';
import ImportedRepository from '../models/ImportedRepository';
import ActivityLog from '../models/ActivityLog';
import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import PracticeSubmission from '../models/PracticeSubmission';
import CodeReview from '../models/CodeReview';
import logger from '../utils/logger';

export interface AnalyticsData {
  overview: {
    repositories: number;
    indexedRepos: number;
    totalFiles: number;
    totalChunks: number;
    aiOperations: number;
  };
  languages: {
    name: string;
    files: number;
    percentage: number;
    color: string;
  }[];
  linesOfCode: {
    total: number;
    byLanguage: { language: string; lines: number; files: number }[];
  };
  repositoryHealth: {
    score: number;
    level: 'excellent' | 'good' | 'fair' | 'poor';
    metrics: {
      indexed: { value: number; max: number };
      documented: { value: number; max: number };
      analyzed: { value: number; max: number };
      chunks: { value: number; max: number };
    };
  };
  quality: {
    securityIssues: number;
    bugCount: number;
    reviewScore: number;
    documentationCoverage: number;
  };
  activity: {
    recentIndexes: number;
    totalAiQueries: number;
    avgReviewScore: number;
    activityScore: number;
  };
  trend: {
    days: string[];
    operations: number[];
    indexes: number[];
    reviews: number[];
    documents: number[];
    practice: number[];
  };
  operationBreakdown: { type: string; count: number }[];
}

export type ChartGranularity = 'daily' | 'weekly' | 'monthly';

export interface ProblemsSolvedPoint {
  label: string;
  date: string;
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface ProblemsSolvedData {
  granularity: ChartGranularity;
  total: number;
  thisWeek: number;
  byDifficulty: { easy: number; medium: number; hard: number };
  points: ProblemsSolvedPoint[];
}

export interface RepoIndexedPoint {
  label: string;
  date: string;
  count: number;
  cumulative: number;
}

export interface ReposIndexedData {
  total: number;
  latest: { name: string; fullName: string; indexedAt: string } | null;
  points: RepoIndexedPoint[];
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** UTC start of the day containing `d`. */
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** UTC start of the ISO week (Monday) containing `d`. */
function startOfUtcWeek(d: Date): Date {
  const day = startOfUtcDay(d);
  const mondayOffset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - mondayOffset);
  return day;
}

/** UTC start of the month containing `d`. */
function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function periodStart(d: Date, granularity: ChartGranularity): Date {
  if (granularity === 'daily') return startOfUtcDay(d);
  if (granularity === 'weekly') return startOfUtcWeek(d);
  return startOfUtcMonth(d);
}

/** Move a bucket start `delta` periods forward (or backward when negative). */
function shiftPeriod(d: Date, granularity: ChartGranularity, delta: number): Date {
  const next = new Date(d.getTime());
  if (granularity === 'daily') next.setUTCDate(next.getUTCDate() + delta);
  else if (granularity === 'weekly') next.setUTCDate(next.getUTCDate() + delta * 7);
  else next.setUTCMonth(next.getUTCMonth() + delta);
  return next;
}

function bucketLabel(d: Date, granularity: ChartGranularity): string {
  if (granularity === 'monthly') {
    return MONTH_ABBR[d.getUTCMonth()] + " '" + String(d.getUTCFullYear()).slice(2);
  }
  return String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + String(d.getUTCDate()).padStart(2, '0');
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const LANGUAGE_COLORS: Record<string, string> = {
  typescript: '#3178c6', javascript: '#f7df1e', tsx: '#3178c6',
  jsx: '#61dafb', python: '#3572a5', html: '#e34c26',
  css: '#563d7c', scss: '#c6538c', json: '#292929',
  markdown: '#083fa1', sql: '#e38c00', bash: '#89e051',
  yaml: '#cb171e', go: '#00add8', rust: '#dea584',
  java: '#b07219', plaintext: '#8e8e8e',
};

export class AnalyticsService {
  async getAnalytics(userId: string, reportId?: string): Promise<AnalyticsData> {
    const startTime = Date.now();

    // 14-day window for the activity trend charts
    const trendDays = 14;
    const trendStart = new Date();
    trendStart.setHours(0, 0, 0, 0);
    trendStart.setDate(trendStart.getDate() - (trendDays - 1));

    // If a specific reportId is given, scope all queries to that report
    let reportFilter: Record<string, unknown> = { userId };
    if (reportId) {
      reportFilter = { _id: reportId, userId };
    }

    // Pre-fetch user's report IDs once to optimize all subsequent IndexedFile/IndexedChunk queries
    const userReports = await IndexReport.find(reportFilter).select('_id').lean();
    const userReportIds = userReports.map((r) => r._id);

    const [
      repositories,
      indexedRepos,
      indexedFiles,
      indexedChunks,
      languageAgg,
      chunkAgg,
      activityScore,
      activityTrendAgg,
      activityTotalsAgg,
      codeReviewQualityAgg,
    ] = await Promise.all([
      reportId ? 1 : ImportedRepository.countDocuments({ userId }),
      IndexReport.countDocuments(reportFilter),
      // Use $in with pre-fetched IDs instead of $lookup + $unwind
      userReportIds.length > 0
        ? IndexedFile.aggregate([
            { $match: { reportId: { $in: userReportIds } } },
            { $count: 'total' },
          ])
        : Promise.resolve([]),
      userReportIds.length > 0
        ? IndexedChunk.aggregate([
            { $match: { reportId: { $in: userReportIds } } },
            { $count: 'total' },
          ])
        : Promise.resolve([]),
      userReportIds.length > 0
        ? IndexedFile.aggregate([
            { $match: { reportId: { $in: userReportIds } } },
            { $group: { _id: '$language', files: { $sum: 1 } } },
            { $sort: { files: -1 } },
          ])
        : Promise.resolve([]),
      userReportIds.length > 0
        ? IndexedChunk.aggregate([
            { $match: { reportId: { $in: userReportIds } } },
            { $group: { _id: null, totalTokens: { $sum: '$tokenCount' } } },
          ])
        : Promise.resolve([]),
      // Activity score from ImportedRepositories — uses stars+forks+openIssues as a social activity metric
      // Full commit tracking requires a separate Commit model populated during GitHub sync
      ImportedRepository.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: null, total: { $sum: { $add: ['$stars', '$forks', '$openIssues'] } } } },
      ]),
      ActivityLog.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              type: '$type',
            },
            count: { $sum: 1 },
          },
        },
      ]),
      ActivityLog.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Security/bug findings from the user's persisted Code Reviews.
      // The $match on userId guarantees another user's reviews are never
      // counted, and each finding (issue) is counted exactly once per review.
      CodeReview.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            securityIssues: { $sum: { $size: { $ifNull: ['$details.categories.security.issues', []] } } },
            bugCount: { $sum: { $size: { $ifNull: ['$details.categories.bugs.issues', []] } } },
          },
        },
      ]),
    ]);

    const totalFiles = indexedFiles.length > 0 ? (indexedFiles[0] as { total: number })!.total : 0;
    const totalChunks = indexedChunks.length > 0 ? (indexedChunks[0] as { total: number })!.total : 0;
    const totalTokens = chunkAgg.length > 0 ? (chunkAgg[0] as { totalTokens: number })!.totalTokens : 0;
    const totalActivityScore = activityScore.length > 0 ? (activityScore[0] as { total: number })!.total : 0;

    // Quality metrics derived from persisted Code Review findings.
    // No reviews (or no findings in a category) → 0, never a fabricated value.
    const codeReviewQuality = codeReviewQualityAgg.length > 0
      ? (codeReviewQualityAgg[0] as { securityIssues: number; bugCount: number })
      : null;
    const securityIssues = codeReviewQuality ? codeReviewQuality.securityIssues : 0;
    const bugCount = codeReviewQuality ? codeReviewQuality.bugCount : 0;

    // Languages breakdown
    const totalLangFiles = languageAgg.reduce((sum: number, l: { files: number }) => sum + l.files, 0);
    const languages = languageAgg.map((l: { _id: string; files: number }) => ({
      name: l._id || 'unknown',
      files: l.files,
      percentage: totalLangFiles > 0 ? Math.round((l.files / totalLangFiles) * 100) : 0,
      color: LANGUAGE_COLORS[l._id?.toLowerCase()] || '#8e8e8e',
    }));

    // LOC estimation from token count (~4 tokens per line of code)
    const locFromTokens = Math.round(totalTokens / 4);
    const locFallback = totalFiles * 30;
    const estimatedLoc = Math.max(locFromTokens, locFallback);

    // LOC by language (proportional by file count, not byte size)
    const linesByLanguage = languageAgg
      .filter((l: { files: number }) => l.files > 0)
      .map((l: { _id: string; files: number }) => ({
        language: l._id || 'unknown',
        files: l.files,
        lines: totalLangFiles > 0 ? Math.round((l.files / totalLangFiles) * estimatedLoc) : 0,
      }));

    // Repository health score (last 100 completed reports for performance)
    const reports = await IndexReport.find({ ...reportFilter, status: 'completed' })
      .select('fileCount chunkCount totalTokens summary techStack folderStructure')
      .sort({ completedAt: -1 })
      .limit(100)
      .lean();

    let totalHealthScore = 0;
    let indexedCount = 0;
    let documentedCount = 0;

    for (const report of reports) {
      const fileScore = Math.min((report.fileCount / 50) * 25, 25);
      const chunkScore = Math.min((report.chunkCount / 200) * 25, 25);
      const tokenScore = Math.min((report.totalTokens / 10000) * 25, 25);
      const docScore = ((report.summary ? 1 : 0) +
        (report.techStack?.frameworks?.length > 0 ? 1 : 0) +
        (report.techStack?.libraries?.length > 0 ? 1 : 0) +
        (report.folderStructure?.length > 0 ? 1 : 0)) * 6.25;

      totalHealthScore += Math.round(fileScore + chunkScore + tokenScore + docScore);
      if (report.summary) documentedCount++;
      indexedCount++;
    }

    const avgHealthScore = indexedCount > 0 ? Math.round(totalHealthScore / indexedCount) : 0;
    const documentationCoverage = indexedCount > 0 ? Math.round((documentedCount / indexedCount) * 100) : 0;

    let healthLevel: AnalyticsData['repositoryHealth']['level'] = 'poor';
    if (avgHealthScore >= 80) healthLevel = 'excellent';
    else if (avgHealthScore >= 60) healthLevel = 'good';
    else if (avgHealthScore >= 40) healthLevel = 'fair';

    const aiOperations = indexedRepos;
    const avgReviewScore = indexedCount > 0 ? avgHealthScore : 0;

    // Build the 14-day series from the activity log so every point is real.
    const dayKeys: string[] = [];
    for (let i = 0; i < trendDays; i++) {
      const d = new Date(trendStart);
      d.setDate(d.getDate() + i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const dayLabels = dayKeys.map((k) => {
      const parts = k.split('-');
      return (parts[1] || '') + '/' + (parts[2] || '');
    });

    const trendByDay = new Map<string, Record<string, number>>();
    for (const row of activityTrendAgg as Array<{ _id: { day: string; type: string }; count: number }>) {
      const entry = trendByDay.get(row._id.day) || {};
      entry[row._id.type] = row.count;
      trendByDay.set(row._id.day, entry);
    }

    const seriesFor = (type: string) => dayKeys.map((k) => trendByDay.get(k)?.[type] || 0);
    const operations = dayKeys.map((k) =>
      Object.values(trendByDay.get(k) || {}).reduce((sum, n) => sum + n, 0),
    );

    const operationBreakdown = (activityTotalsAgg as Array<{ _id: string; count: number }>).map((r) => ({
      type: r._id || 'other',
      count: r.count,
    }));

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('Analytics: Computed for user ' + userId + ' in ' + duration + 's');

    return {
      overview: {
        repositories,
        indexedRepos,
        totalFiles,
        totalChunks,
        aiOperations,
      },
      languages,
      linesOfCode: {
        total: estimatedLoc,
        byLanguage: linesByLanguage.slice(0, 10),
      },
      repositoryHealth: {
        score: avgHealthScore,
        level: healthLevel,
        metrics: {
          indexed: { value: indexedCount, max: Math.max(indexedCount, 10) },
          documented: { value: documentedCount, max: Math.max(indexedCount, 10) },
          analyzed: { value: indexedCount, max: Math.max(indexedCount, 10) },
          chunks: { value: totalChunks, max: Math.max(totalChunks, 500) },
        },
      },
      quality: {
        securityIssues,
        bugCount,
        reviewScore: avgReviewScore,
        documentationCoverage,
      },
      activity: {
        recentIndexes: indexedCount,
        totalAiQueries: aiOperations,
        avgReviewScore,
        activityScore: totalActivityScore,
      },
      trend: {
        days: dayLabels,
        operations,
        indexes: seriesFor('repo_indexed'),
        reviews: seriesFor('review_completed'),
        documents: seriesFor('doc_generated'),
        practice: seriesFor('practice_solved'),
      },
      operationBreakdown,
    };
  }

  /**
   * Problems solved over time. A problem counts once — on the day of its
   * first accepted submission — so totals match the "solved" badge on the
   * dashboard. Supports daily / weekly / monthly buckets and a difficulty split.
   */
  async getProblemsSolved(
    userId: string,
    granularity: ChartGranularity = 'daily',
  ): Promise<ProblemsSolvedData> {
    const now = new Date();
    const windowSize = granularity === 'daily' ? 14 : 12;
    const currentStart = periodStart(now, granularity);

    const bucketStarts: Date[] = [];
    for (let i = windowSize - 1; i >= 0; i--) {
      bucketStarts.push(shiftPeriod(currentStart, granularity, -i));
    }

    const accepted = await PracticeSubmission.find({ userId, status: 'accepted' })
      .select('problemSlug difficulty createdAt')
      .sort({ createdAt: 1 })
      .lean();

    // Collapse to one entry per problem, keeping the earliest acceptance date.
    const solved = new Map<string, { difficulty: string; solvedAt: Date }>();
    for (const submission of accepted) {
      if (!submission.problemSlug || solved.has(submission.problemSlug)) continue;
      solved.set(submission.problemSlug, {
        difficulty: submission.difficulty,
        solvedAt: submission.createdAt,
      });
    }

    const byDifficulty = { easy: 0, medium: 0, hard: 0 };
    for (const entry of solved.values()) {
      if (entry.difficulty === 'easy' || entry.difficulty === 'medium' || entry.difficulty === 'hard') {
        byDifficulty[entry.difficulty] += 1;
      }
    }

    const weekStart = startOfUtcWeek(now);
    let thisWeek = 0;

    const points = bucketStarts.map<ProblemsSolvedPoint>((start) => ({
      label: bucketLabel(start, granularity),
      date: isoDay(start),
      total: 0,
      easy: 0,
      medium: 0,
      hard: 0,
    }));
    const byDate = new Map(points.map((p) => [p.date, p]));

    for (const entry of solved.values()) {
      if (entry.solvedAt >= weekStart) thisWeek += 1;
      const bucket = byDate.get(isoDay(periodStart(entry.solvedAt, granularity)));
      if (!bucket) continue; // solved before the visible window
      bucket.total += 1;
      if (entry.difficulty === 'easy' || entry.difficulty === 'medium' || entry.difficulty === 'hard') {
        bucket[entry.difficulty] += 1;
      }
    }

    return {
      granularity,
      total: solved.size,
      thisWeek,
      byDifficulty,
      points,
    };
  }

  /**
   * Repositories indexed over time, built from completed IndexReports.
   * Returns per-bucket counts plus a running cumulative, and the most
   * recently indexed repository for the summary line.
   */
  async getReposIndexed(userId: string, requestedGranularity?: ChartGranularity): Promise<ReposIndexedData> {
    const reports = await IndexReport.find({ userId, status: 'completed' })
      .select('repositoryId completedAt createdAt')
      .sort({ completedAt: 1, createdAt: 1 })
      .lean();

    const events = reports
      .map((report) => ({
        repositoryId: report.repositoryId as mongoose.Types.ObjectId,
        indexedAt: (report.completedAt || report.createdAt) as Date,
      }))
      .filter((event) => event.indexedAt instanceof Date && !Number.isNaN(event.indexedAt.getTime()));

    if (events.length === 0) {
      return { total: 0, latest: null, points: [] };
    }

    const granularity: ChartGranularity = requestedGranularity ?? 'daily';

    // Fixed-width window (14 days / 12 weeks / 12 months) ending at the latest
    // indexed repo — or now if that is more recent. Mirroring the Problems
    // Solved window keeps day-wise charts readable with real date context, even
    // when every repository was indexed on the same day.
    const now = new Date();
    const latestIndexedAt = events[events.length - 1].indexedAt;
    const anchor = latestIndexedAt > now ? latestIndexedAt : now;
    const windowEnd = periodStart(anchor, granularity);
    const windowSize = granularity === 'daily' ? 14 : 12;
    const windowStart = shiftPeriod(windowEnd, granularity, -(windowSize - 1));

    const bucketStarts: Date[] = [];
    let cursor = windowStart;
    for (let i = 0; i < windowSize; i++) {
      bucketStarts.push(cursor);
      cursor = shiftPeriod(cursor, granularity, 1);
    }

    const counts = new Map<string, number>();
    for (const event of events) {
      const key = isoDay(periodStart(event.indexedAt, granularity));
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    // Seed the running total with everything indexed before the visible window.
    let cumulative = events.filter((event) => periodStart(event.indexedAt, granularity) < windowStart).length;
    const points = bucketStarts.map<RepoIndexedPoint>((start) => {
      const date = isoDay(start);
      const count = counts.get(date) || 0;
      cumulative += count;
      return { label: bucketLabel(start, granularity), date, count, cumulative };
    });

    const latestEvent = events[events.length - 1];
    const latestRepo = await ImportedRepository.findOne({ _id: latestEvent.repositoryId, userId })
      .select('name fullName')
      .lean();

    return {
      total: events.length,
      latest: latestRepo
        ? { name: latestRepo.name, fullName: latestRepo.fullName, indexedAt: latestEvent.indexedAt.toISOString() }
        : null,
      points,
    };
  }
}

export const analyticsService = new AnalyticsService();
