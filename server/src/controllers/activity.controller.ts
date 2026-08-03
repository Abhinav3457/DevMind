import { Request, Response } from 'express';
import { activityService } from '../services/activity.service';
import { sendSuccess } from '../utils/apiResponse';

export class ActivityController {
  async listMyActivity(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const result = await activityService.listForUser(req.user!.userId, { page, limit });
    sendSuccess(res, { statusCode: 200, message: 'Activity retrieved', data: result });
  }
}

export const activityController = new ActivityController();
