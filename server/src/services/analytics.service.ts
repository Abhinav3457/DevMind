import mongoose from 'mongoose';
import ImportedRepository from '../models/ImportedRepository';
import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
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
    ]);

    const totalFiles = indexedFiles.length > 0 ? (indexedFiles[0] as { total: number })!.total : 0;
    const totalChunks = indexedChunks.length > 0 ? (indexedChunks[0] as { total: number })!.total : 0;
    const totalTokens = chunkAgg.length > 0 ? (chunkAgg[0] as { totalTokens: number })!.totalTokens : 0;
    const totalActivityScore = activityScore.length > 0 ? (activityScore[0] as { total: number })!.total : 0;

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
        securityIssues: 0,
        bugCount: 0,
        reviewScore: avgReviewScore,
        documentationCoverage,
      },
      activity: {
        recentIndexes: indexedCount,
        totalAiQueries: aiOperations,
        avgReviewScore,
        activityScore: totalActivityScore,
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
