import { Request, Response } from 'express';
import { codeReviewService } from '../services/code-review.service';
import { reviewerService } from '../code-review/reviewer.service';
import { IIndexedFile } from '../models/IndexedFile';
import { sendSuccess } from '../utils/apiResponse';

export class CodeReviewController {
  async reviewRepository(req: Request, res: Response): Promise<void> {
    const { reportId } = req.params;
    const { files: filePaths } = req.body;

    const result = await codeReviewService.reviewRepository(
      reportId,
      req.user!.userId,
      filePaths,
    );

    sendSuccess(res, {
      statusCode: 200,
      message: 'Code review completed successfully',
      data: result,
    });
  }

  async reviewCode(req: Request, res: Response): Promise<void> {
    const { code, language, fileName } = req.body;

    // Create a virtual file entry for the reviewer service
    const name = fileName || 'input.' + language;
    const virtualFile = {
      file: {
        _id: 'direct-review',
        reportId: 'direct-review',
        path: name,
        name,
        language: language || 'typescript',
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        dependencies: [],
        size: code.length,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as IIndexedFile,
      content: code,
    };

    const result = await reviewerService.reviewFiles([virtualFile]);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Code review completed',
      data: {
        score: result.score,
        summary: result.summary,
        categories: result.categories,
        refactoringSuggestions: result.refactoringSuggestions,
        fixedVersion: result.fixedVersion,
        totalIssues: result.totalIssues,
        filesReviewed: 1,
      },
    });
  }
}

export const codeReviewController = new CodeReviewController();
