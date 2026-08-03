import { Request, Response } from 'express';
import { repoIntelligenceService } from '../services/repo-intelligence.service';
import { sendSuccess } from '../utils/apiResponse';

export class RepoIntelligenceController {
  async listReports(req: Request, res: Response): Promise<void> {
    const reports = await repoIntelligenceService.listReports(req.user!.userId);
    sendSuccess(res, {
      statusCode: 200,
      message: 'Index reports retrieved',
      data: { reports },
    });
  }

  async getIndexStatus(req: Request, res: Response): Promise<void> {
    const status = await repoIntelligenceService.getIndexStatus(req.user!.userId);
    sendSuccess(res, {
      statusCode: 200,
      message: 'Index status retrieved',
      data: status,
    });
  }

  async ask(req: Request, res: Response): Promise<void> {
    const { question } = req.body;
    const { reportId } = req.params;

    const result = await repoIntelligenceService.ask(reportId, req.user!.userId, question);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Question answered successfully',
      data: result,
    });
  }

  async query(req: Request, res: Response): Promise<void> {
    const { question, reportId } = req.body;

    const result = await repoIntelligenceService.ask(reportId, req.user!.userId, question);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Question answered successfully',
      data: result,
    });
  }

  async getQuestionTemplates(_req: Request, res: Response): Promise<void> {
    const templates = repoIntelligenceService.getQuestionTemplates();

    sendSuccess(res, {
      statusCode: 200,
      message: 'Question templates retrieved',
      data: { templates },
    });
  }

}

export const repoIntelligenceController = new RepoIntelligenceController();
