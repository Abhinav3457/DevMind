import { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';
import { sendSuccess } from '../utils/apiResponse';

export class NotificationController {
  async list(req: Request, res: Response): Promise<void> {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const result = await notificationService.listForUser(req.user!.userId, { limit });
    sendSuccess(res, { statusCode: 200, message: 'Notifications retrieved', data: result });
  }

  async markRead(req: Request, res: Response): Promise<void> {
    await notificationService.markRead(req.user!.userId, req.params.id);
    sendSuccess(res, { statusCode: 200, message: 'Notification marked as read' });
  }

  async markAllRead(req: Request, res: Response): Promise<void> {
    await notificationService.markAllRead(req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'All notifications marked as read' });
  }
}

export const notificationController = new NotificationController();
