import mongoose, { Document, Schema } from 'mongoose';

export type ActivityType =
  | 'workspace_created'
  | 'member_joined'
  | 'invite_sent'
  | 'repo_imported'
  | 'repo_indexed'
  | 'review_completed'
  | 'doc_generated';

export interface IActivityLog extends Document {
  userId: mongoose.Types.ObjectId;
  workspaceId?: mongoose.Types.ObjectId | null;
  type: ActivityType;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
    type: {
      type: String,
      enum: ['workspace_created', 'member_joined', 'invite_sent', 'repo_imported', 'repo_indexed', 'review_completed', 'doc_generated'],
      required: true,
    },
    description: { type: String, required: true, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ workspaceId: 1, createdAt: -1 });

const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
export default ActivityLog;
