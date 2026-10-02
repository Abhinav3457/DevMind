import { Request, Response } from 'express';
import { practiceService } from '../services/practice.service';
import { leetcodeService } from '../practice/leetcode.service';
import { sendSuccess } from '../utils/apiResponse';

export class PracticeController {
  async listProblems(req: Request, res: Response): Promise<void> {
    const problems = await practiceService.listProblems(req.user!.userId, {
      difficulty: req.query.difficulty as string | undefined,
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
    });

    sendSuccess(res, {
      statusCode: 200,
      message: 'Practice problems retrieved',
      data: problems,
    });
  }

  async getProblem(req: Request, res: Response): Promise<void> {
    const result = await practiceService.getProblem(req.params.slug, req.user!.userId);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Problem retrieved',
      data: result,
    });
  }

  async submit(req: Request, res: Response): Promise<void> {
    const { code, language } = req.body;
    const result = await practiceService.submit(req.user!.userId, req.params.slug, code, language);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Submission evaluated',
      data: result,
    });
  }

  async listSubmissions(req: Request, res: Response): Promise<void> {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const submissions = await practiceService.listSubmissions(req.user!.userId, {
      limit,
      problemSlug: req.query.problemSlug as string | undefined,
    });

    sendSuccess(res, {
      statusCode: 200,
      message: 'Submissions retrieved',
      data: submissions,
    });
  }

  async getStats(req: Request, res: Response): Promise<void> {
    const stats = await practiceService.getStats(req.user!.userId);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Practice stats retrieved',
      data: stats,
    });
  }

  async listLeetcodeProblems(req: Request, res: Response): Promise<void> {
    const tagsParam = req.query.tags as string | undefined;
    const result = await practiceService.listLeetcodeProblems({
      difficulty: req.query.difficulty as string | undefined,
      tags: tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      search: req.query.search as string | undefined,
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 30,
    });

    sendSuccess(res, {
      statusCode: 200,
      message: 'LeetCode problems retrieved',
      data: result,
    });
  }

  async getLeetcodeProblem(req: Request, res: Response): Promise<void> {
    const result = await practiceService.getLeetcodeProblem(req.params.slug, req.user!.userId);

    sendSuccess(res, {
      statusCode: 200,
      message: 'LeetCode problem retrieved',
      data: result,
    });
  }

  async submitLeetcode(req: Request, res: Response): Promise<void> {
    const { code, language } = req.body;
    const result = await practiceService.submitLeetcode(req.user!.userId, req.params.slug, code, language);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Submission evaluated',
      data: result,
    });
  }

  async getLeetcodeStats(req: Request, res: Response): Promise<void> {
    const stats = await leetcodeService.getStats(req.params.username);

    sendSuccess(res, {
      statusCode: 200,
      message: 'LeetCode stats retrieved',
      data: stats,
    });
  }
}

export const practiceController = new PracticeController();
