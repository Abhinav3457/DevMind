import crypto from 'crypto';
import { Request, Response } from 'express';
import { codeReviewService } from '../services/code-review.service';
import { reviewerService } from '../code-review/reviewer.service';
import { IIndexedFile } from '../models/IndexedFile';
import CodeReview from '../models/CodeReview';
import User from '../models/User';
import { sendReviewCompleteEmail } from '../helpers/email.helper';
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

    // Save to review history (best-effort, non-blocking)
    const shareToken = crypto.randomBytes(16).toString('hex');
    CodeReview.create({
      userId: req.user!.userId,
      fileName: name,
      language: language || 'typescript',
      score: result.score,
      summary: result.summary,
      filesReviewed: 1,
      totalIssues: result.totalIssues,
      shareToken,
      details: {
        score: result.score,
        summary: result.summary,
        categories: result.categories,
        refactoringSuggestions: result.refactoringSuggestions,
        fixedVersion: result.fixedVersion,
        totalIssues: result.totalIssues,
        filesReviewed: 1,
      },
    }).catch(() => undefined);

    // Best-effort email notification (matches repo reviews)
    User.findById(req.user!.userId).select('email name').lean()
      .then((user) => {
        if (user?.email) {
          void sendReviewCompleteEmail(user.email, user.name, {
            repoName: fileName || 'your code snippet',
            score: result.score,
            totalIssues: result.totalIssues,
          });
        }
      })
      .catch(() => undefined);

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
        shareToken,
      },
    });
  }

  async getSharedReview(req: Request, res: Response): Promise<void> {
    const result = await codeReviewService.getSharedReview(req.params.token);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Shared review retrieved',
      data: result,
    });
  }

  async listHistory(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const result = await codeReviewService.listHistory(req.user!.userId, { page, limit });

    sendSuccess(res, {
      statusCode: 200,
      message: 'Review history retrieved',
      data: result,
    });
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    const result = await codeReviewService.getHistoryDetail(req.user!.userId, req.params.id);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Review retrieved',
      data: result,
    });
  }

  async deleteHistory(req: Request, res: Response): Promise<void> {
    await codeReviewService.deleteHistory(req.user!.userId, req.params.id);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Review deleted',
    });
  }
}

export const codeReviewController = new CodeReviewController();
