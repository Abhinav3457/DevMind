import mongoose from 'mongoose';
import ActivityLog, { ActivityType } from '../models/ActivityLog';
import logger from '../utils/logger';

interface LogActivityParams {
  userId: string;
  workspaceId?: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget activity logger. Never throws — a failed log must not
 * break the operation that triggered it.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await ActivityLog.create({
      userId: new mongoose.Types.ObjectId(params.userId),
      workspaceId: params.workspaceId ? new mongoose.Types.ObjectId(params.workspaceId) : undefined,
      type: params.type,
      description: params.description,
      metadata: params.metadata || {},
    });
  } catch (error) {
    logger.error('Failed to log activity:', error);
  }
}

export class ActivityService {
  async listForUser(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ activities: Record<string, unknown>[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 50);
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      ActivityLog.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments({ userId }),
    ]);

    return {
      activities: activities.map((a) => ({
        id: (a._id as mongoose.Types.ObjectId).toString(),
        type: a.type,
        description: a.description,
        workspaceId: a.workspaceId ? (a.workspaceId as mongoose.Types.ObjectId).toString() : null,
        metadata: a.metadata,
        timestamp: a.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async listForWorkspace(
    workspaceId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ activities: Record<string, unknown>[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 50);
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      ActivityLog.find({ workspaceId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments({ workspaceId }),
    ]);

    return {
      activities: activities.map((a) => ({
        id: (a._id as mongoose.Types.ObjectId).toString(),
        type: a.type,
        description: a.description,
        userId: (a.userId as mongoose.Types.ObjectId).toString(),
        workspaceId,
        metadata: a.metadata,
        timestamp: a.createdAt,
      })),
      total,
      page,
      limit,
    };
  }
}

export const activityService = new ActivityService();
