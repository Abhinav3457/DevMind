import mongoose, { Document, Schema } from 'mongoose';

export type ActivityType =
  | 'repo_imported'
  | 'repo_indexed'
  | 'review_completed'
  | 'doc_generated';

export interface IActivityLog extends Document {
  userId: mongoose.Types.ObjectId;
  type: ActivityType;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['repo_imported', 'repo_indexed', 'review_completed', 'doc_generated'],
      required: true,
    },
    description: { type: String, required: true, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activityLogSchema.index({ userId: 1, createdAt: -1 });

const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
export default ActivityLog;
