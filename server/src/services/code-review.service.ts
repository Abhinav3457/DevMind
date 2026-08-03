import crypto from 'crypto';
import mongoose from 'mongoose';
import IndexReport from '../models/IndexReport';
import IndexedFile, { IIndexedFile } from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import ImportedRepository from '../models/ImportedRepository';
import CodeReview from '../models/CodeReview';
import User from '../models/User';
import { sendReviewCompleteEmail } from '../helpers/email.helper';
import { complexityService, ComplexityReport } from '../code-review/complexity.service';
import { duplicateService, DuplicateBlock } from '../code-review/duplicate.service';
import { reviewerService, ReviewResult } from '../code-review/reviewer.service';
import { logActivity } from './activity.service';
import { notificationService } from './notification.service';
import { ApiError } from '../utils/apiResponse';
import logger from '../utils/logger';

const MAX_REVIEW_FILES = 10;

export interface CodeReviewResult {
  score: number;
  summary: string;
  categories: ReviewResult['categories'];
  complexity: ComplexityReport;
  duplicateCode: DuplicateBlock[];
  refactoringSuggestions: ReviewResult['refactoringSuggestions'];
  fixedVersion: string;
  filesReviewed: number;
  totalIssues: number;
  shareToken: string;
}

export class CodeReviewService {
  async reviewRepository(
    reportId: string,
    userId: string,
    filePaths?: string[],
  ): Promise<CodeReviewResult> {
    const startTime = Date.now();

    const report = await IndexReport.findOne({ _id: reportId, userId });
    if (!report) {
      throw new ApiError(404, 'Index report not found or access denied');
    }
    if (report.status !== 'completed') {
      throw new ApiError(400, 'Indexing has not completed yet. Status: ' + report.status);
    }

    let indexedFiles: IIndexedFile[];
    if (filePaths && filePaths.length > 0) {
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pathConditions = filePaths.map((filePath) => ({
        path: { $regex: escapeRegex(filePath), $options: 'i' },
      }));
      indexedFiles = await IndexedFile.find({ reportId, $or: pathConditions })
        .limit(MAX_REVIEW_FILES)
        .lean() as unknown as IIndexedFile[];
    } else {
      indexedFiles = await IndexedFile.find({ reportId })
        .limit(MAX_REVIEW_FILES)
        .sort({ size: -1 })
        .lean() as unknown as IIndexedFile[];
    }

    if (indexedFiles.length === 0) {
      throw new ApiError(404, 'No files found to review');
    }

    logger.info('CodeReview: Reviewing ' + indexedFiles.length + ' files');

    // 1. Complexity analysis (local, no AI)
    const complexity = complexityService.analyze(indexedFiles);

    // 2. Duplicate code detection (local, no AI)
    const duplicateCode = await duplicateService.findDuplicates(reportId);

    // 3. Fetch actual content from chunks for the AI review.
    //    Chunks carry startLine/endLine metadata, so we reconstruct each file's
    //    content line-by-line. This keeps the line numbers shown to the AI
    //    identical to the real files (a naive join of disjoint chunks with
    //    '\n\n' shifts every line and corrupts syntax context, causing
    //    hallucinated issues and wrong line references).
    // Cap the file count to MAX_REVIEW_FILES (10) so a generous chunk limit
    // guarantees every selected file gets enough content for reconstruction.
    const chunks = await IndexedChunk.find({
      reportId,
      fileId: { $in: indexedFiles.map((f) => f._id) },
    })
      .sort({ fileId: 1, index: 1 })
      .limit(2000)
      .lean();

    const fileLineMap = new Map<string, Map<number, string>>();
    for (const chunk of chunks) {
      const fileId = chunk.fileId.toString();
      if (!fileLineMap.has(fileId)) {
        fileLineMap.set(fileId, new Map());
      }
      const lineMap = fileLineMap.get(fileId)!;
      const chunkLines = chunk.content.split('\n');
      for (let i = 0; i < chunkLines.length; i++) {
        // Overlapping chunks write the same source lines, so last-write wins.
        lineMap.set(chunk.startLine + i, chunkLines[i]!);
      }
    }

    const filesWithContent = indexedFiles
      .map((f) => {
        const lineMap = fileLineMap.get(f._id.toString());
        if (!lineMap || lineMap.size === 0) {
          return { file: f, content: '' };
        }
        // Rebuild from line 1 so every line's position matches the real file.
        // Lines with no chunk coverage become blank placeholders.
        // Loop instead of Math.max(...keys) to stay safe on very large files.
        let maxLine = 0;
        for (const line of lineMap.keys()) {
          if (line > maxLine) maxLine = line;
        }
        const lines: string[] = [];
        for (let i = 1; i <= maxLine; i++) {
          lines.push(lineMap.get(i) ?? '');
        }
        return { file: f, content: lines.join('\n') };
      })
      .filter((f) => f.content.trim().length > 0);

    // 4. Gemini code review
    let reviewResult: ReviewResult;
    if (filesWithContent.length > 0) {
      reviewResult = await reviewerService.reviewFiles(filesWithContent);
    } else {
      // Fallback: use at least the metadata
      reviewResult = await reviewerService.reviewFiles(
        indexedFiles.map((f) => ({
          file: f,
          content: f.imports.join('\n'),
        })),
      );
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('CodeReview: Completed review of ' + indexedFiles.length +
      ' files in ' + duration + 's. Score: ' + reviewResult.score);

    const result: CodeReviewResult = {
      score: reviewResult.score,
      summary: reviewResult.summary,
      categories: reviewResult.categories,
      complexity,
      duplicateCode,
      refactoringSuggestions: reviewResult.refactoringSuggestions,
      fixedVersion: reviewResult.fixedVersion,
      filesReviewed: indexedFiles.length,
      totalIssues: reviewResult.totalIssues,
      shareToken: '',
    };

    // Persist to review history + notify (best-effort — never break the review response)
    try {
      const importedRepo = await ImportedRepository.findById(report.repositoryId).select('fullName').lean();
      const shareToken = crypto.randomBytes(16).toString('hex');
      await CodeReview.create({
        userId,
        reportId,
        repositoryId: report.repositoryId,
        repoName: importedRepo?.fullName || '',
        score: result.score,
        summary: result.summary,
        filesReviewed: result.filesReviewed,
        totalIssues: result.totalIssues,
        shareToken,
        details: result,
      });
      result.shareToken = shareToken;

      void logActivity({
        userId,
        type: 'review_completed',
        description: 'Reviewed ' + (importedRepo?.fullName || 'a repository') + ' — score ' + result.score + '/100',
        metadata: { score: result.score, totalIssues: result.totalIssues },
      });

      await notificationService.create({
        userId,
        type: 'review_complete',
        title: 'Code review finished',
        message: 'Review of "' + (importedRepo?.fullName || 'your repository') + '" scored ' + result.score + '/100 with ' + result.totalIssues + ' issues',
        data: { score: result.score, totalIssues: result.totalIssues },
      });

      // Best-effort email notification
      const user = await User.findById(userId).select('email name').lean();
      if (user?.email) {
        void sendReviewCompleteEmail(user.email, user.name, {
          repoName: importedRepo?.fullName || 'your repository',
          score: result.score,
          totalIssues: result.totalIssues,
        });
      }
    } catch (error) {
      logger.error('CodeReview: Failed to persist review history', error);
    }

    return result;
  }

  // ─── Review History ───────────────────────────────────────

  async listHistory(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{
    reviews: {
      id: string;
      repoName: string;
      fileName: string;
      language: string;
      score: number;
      summary: string;
      filesReviewed: number;
      totalIssues: number;
      createdAt: Date | undefined;
    }[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 50);
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      CodeReview.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CodeReview.countDocuments({ userId }),
    ]);

    return {
      reviews: reviews.map((r) => ({
        id: (r._id as mongoose.Types.ObjectId).toString(),
        repoName: r.repoName || '',
        fileName: r.fileName || '',
        language: r.language || '',
        score: r.score,
        summary: r.summary || '',
        filesReviewed: r.filesReviewed,
        totalIssues: r.totalIssues,
        shareToken: r.shareToken || null,
        createdAt: r.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getHistoryDetail(
    userId: string,
    reviewId: string,
  ): Promise<{ id: string; repoName: string; fileName: string; score: number; summary: string; shareToken: string | null; createdAt: Date | undefined; details: Record<string, unknown> }> {
    const review = await CodeReview.findOne({ _id: reviewId, userId }).lean();
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    return {
      id: (review._id as mongoose.Types.ObjectId).toString(),
      repoName: review.repoName || '',
      fileName: review.fileName || '',
      score: review.score,
      summary: review.summary || '',
      shareToken: review.shareToken || null,
      createdAt: review.createdAt,
      details: (review.details as Record<string, unknown>) || {},
    };
  }

  async deleteHistory(userId: string, reviewId: string): Promise<void> {
    await CodeReview.deleteOne({ _id: reviewId, userId });
  }

  /** Public share lookup — no auth, keyed by unguessable share token. */
  async getSharedReview(
    token: string,
  ): Promise<{ id: string; repoName: string; fileName: string; score: number; summary: string; createdAt: Date | undefined; details: Record<string, unknown> }> {
    const review = await CodeReview.findOne({ shareToken: token }).lean();
    if (!review) {
      throw new ApiError(404, 'Shared review not found');
    }
    return {
      id: (review._id as mongoose.Types.ObjectId).toString(),
      repoName: review.repoName || '',
      fileName: review.fileName || '',
      score: review.score,
      summary: review.summary || '',
      createdAt: review.createdAt,
      details: (review.details as Record<string, unknown>) || {},
    };
  }
}

export const codeReviewService = new CodeReviewService();
