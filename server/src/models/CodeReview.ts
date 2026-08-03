import mongoose, { Document, Schema } from 'mongoose';

export interface ICodeReview extends Document {
  userId: mongoose.Types.ObjectId;
  reportId?: mongoose.Types.ObjectId | null;
  repositoryId?: mongoose.Types.ObjectId | null;
  repoName?: string;
  fileName?: string;
  language?: string;
  score: number;
  summary: string;
  filesReviewed: number;
  totalIssues: number;
  details: Record<string, unknown>;
  createdAt: Date;
}

const codeReviewSchema = new Schema<ICodeReview>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportId: { type: Schema.Types.ObjectId, ref: 'IndexReport', default: null },
    repositoryId: { type: Schema.Types.ObjectId, ref: 'ImportedRepository', default: null },
    repoName: { type: String, default: '' },
    fileName: { type: String, default: '' },
    language: { type: String, default: '' },
    score: { type: Number, default: 0 },
    summary: { type: String, default: '' },
    filesReviewed: { type: Number, default: 0 },
    totalIssues: { type: Number, default: 0 },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

codeReviewSchema.index({ userId: 1, createdAt: -1 });

const CodeReview = mongoose.model<ICodeReview>('CodeReview', codeReviewSchema);
export default CodeReview;
