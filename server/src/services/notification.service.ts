import mongoose from 'mongoose';
import Notification, { INotification } from '../models/Notification';
import { getIO } from '../config/socket';
import logger from '../utils/logger';

interface CreateNotificationParams {
  userId: string;
  type: INotification['type'];
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export class NotificationService {
  async create(params: CreateNotificationParams): Promise<INotification | null> {
    try {
      const notification = await Notification.create({
        userId: new mongoose.Types.ObjectId(params.userId),
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data || {},
      });

      // Best-effort real-time push to the user's socket room
      try {
        getIO().to('user:' + params.userId).emit('notification:new', notification);
      } catch {
        // Socket not initialized yet — notification is still persisted
      }

      return notification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      return null;
    }
  }

  async listForUser(
    userId: string,
    options: { limit?: number } = {},
  ): Promise<{ notifications: INotification[]; unreadCount: number }> {
    const limit = Math.min(options.limit || 20, 50);
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ userId, read: false }),
    ]);
    return { notifications, unreadCount };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await Notification.updateOne({ _id: notificationId, userId }, { read: true, readAt: new Date() });
  }

  async markAllRead(userId: string): Promise<void> {
    await Notification.updateMany({ userId, read: false }, { read: true, readAt: new Date() });
  }
}

export const notificationService = new NotificationService();
