import mongoose, { Document, Schema } from 'mongoose';

export interface IImportedRepository extends Document {
  userId: mongoose.Types.ObjectId;
  workspaceId?: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  githubId: number;
  name: string;
  fullName: string;
  owner: { id: number; login: string; avatarUrl: string };
  description: string;
  url: string;
  isPrivate: boolean;
  defaultBranch: string;
  language: string;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  permissions: { admin: boolean; push: boolean; pull: boolean };
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const importedRepoSchema = new Schema<IImportedRepository>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace' },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    githubId: { type: Number, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    owner: {
      id: { type: Number, required: true },
      login: { type: String, required: true },
      avatarUrl: { type: String, default: '' },
    },
    description: { type: String, default: '' },
    url: { type: String, default: '' },
    isPrivate: { type: Boolean, default: false },
    defaultBranch: { type: String, default: 'main' },
    language: { type: String, default: '' },
    topics: { type: [String], default: [] },
    stars: { type: Number, default: 0 },
    forks: { type: Number, default: 0 },
    openIssues: { type: Number, default: 0 },
    permissions: {
      admin: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
      pull: { type: Boolean, default: false },
    },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { transform(_doc: Document, ret: Record<string, unknown>) { ret.id = (ret._id as string).toString(); delete ret._id; delete ret.__v; return ret; } } },
);

// Compound unique index: same repo can be imported by different users
importedRepoSchema.index({ userId: 1, githubId: 1 }, { unique: true });
importedRepoSchema.index({ fullName: 1 });
importedRepoSchema.index({ lastSyncedAt: 1 });

const ImportedRepository = mongoose.model<IImportedRepository>('ImportedRepository', importedRepoSchema);
export default ImportedRepository;
