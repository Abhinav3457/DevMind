import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';
import { sendSuccess } from '../utils/apiResponse';

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
}

export const analyticsController = new AnalyticsController();
