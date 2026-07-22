import mongoose, { Document, Schema } from 'mongoose';

export interface ITechStack {
  authentication: string[];
  databases: string[];
  frameworks: string[];
  libraries: string[];
  envVars: string[];
}

export interface IFolderNode {
  path: string;
  name: string;
  type: 'folder' | 'file';
  children?: IFolderNode[];
}

export interface IIndexReport extends Document {
  repositoryId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  summary: string;
  techStack: ITechStack;
  folderStructure: IFolderNode[];
  fileCount: number;
  chunkCount: number;
  totalTokens: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const indexReportSchema = new Schema<IIndexReport>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'ImportedRepository', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    summary: { type: String, default: '' },
    techStack: {
      authentication: { type: [String], default: [] },
      databases: { type: [String], default: [] },
      frameworks: { type: [String], default: [] },
      libraries: { type: [String], default: [] },
      envVars: { type: [String], default: [] },
    },
    folderStructure: [{ type: Schema.Types.Mixed }],
    fileCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    error: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true, toJSON: { transform(_doc: Document, ret: Record<string, unknown>) { ret.id = (ret._id as string).toString(); delete ret._id; delete ret.__v; return ret; } } },
);

indexReportSchema.index({ repositoryId: 1 });
indexReportSchema.index({ userId: 1 });
indexReportSchema.index({ status: 1 });

const IndexReport = mongoose.model<IIndexReport>('IndexReport', indexReportSchema);
export default IndexReport;
