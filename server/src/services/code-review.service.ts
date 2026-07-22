import IndexReport from '../models/IndexReport';
import IndexedFile, { IIndexedFile } from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import { complexityService, ComplexityReport } from '../code-review/complexity.service';
import { duplicateService, DuplicateBlock } from '../code-review/duplicate.service';
import { reviewerService, ReviewResult } from '../code-review/reviewer.service';
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

    // 3. Fetch actual content from chunks for Gemini review
    const chunks = await IndexedChunk.find({
      reportId,
      fileId: { $in: indexedFiles.map((f) => f._id) },
    })
      .sort({ index: 1 })
      .limit(200)
      .lean();

    const fileContentMap = new Map<string, string[]>();
    for (const chunk of chunks) {
      const fileId = chunk.fileId.toString();
      if (!fileContentMap.has(fileId)) {
        fileContentMap.set(fileId, []);
      }
      fileContentMap.get(fileId)!.push(chunk.content);
    }

    const filesWithContent = indexedFiles
      .map((f) => ({
        file: f,
        content: (fileContentMap.get(f._id.toString()) || []).join('\n\n'),
      }))
      .filter((f) => f.content.length > 0);

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

    return {
      score: reviewResult.score,
      summary: reviewResult.summary,
      categories: reviewResult.categories,
      complexity,
      duplicateCode,
      refactoringSuggestions: reviewResult.refactoringSuggestions,
      fixedVersion: reviewResult.fixedVersion,
      filesReviewed: indexedFiles.length,
      totalIssues: reviewResult.totalIssues,
    };
  }
}

export const codeReviewService = new CodeReviewService();
