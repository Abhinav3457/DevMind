import { Request, Response } from 'express';
import { analyticsService, ChartGranularity } from '../services/analytics.service';
import { sendSuccess } from '../utils/apiResponse';

const GRANULARITIES: ChartGranularity[] = ['daily', 'weekly', 'monthly'];

export class AnalyticsController {
  async getAnalytics(req: Request, res: Response): Promise<void> {
    const reportId = req.query.reportId as string | undefined;
    const data = await analyticsService.getAnalytics(req.user!.userId, reportId);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Analytics retrieved successfully',
      data,
    });
  }

  async getProblemsSolved(req: Request, res: Response): Promise<void> {
    const requested = req.query.granularity as ChartGranularity | undefined;
    const granularity = requested && GRANULARITIES.includes(requested) ? requested : 'daily';
    const data = await analyticsService.getProblemsSolved(req.user!.userId, granularity);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Problems solved analytics retrieved',
      data,
    });
  }

  async getReposIndexed(req: Request, res: Response): Promise<void> {
    const requested = req.query.granularity as ChartGranularity | undefined;
    const granularity = requested && GRANULARITIES.includes(requested) ? requested : undefined;
    const data = await analyticsService.getReposIndexed(req.user!.userId, granularity);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Repositories indexed analytics retrieved',
      data,
    });
  }
}

export const analyticsController = new AnalyticsController();
