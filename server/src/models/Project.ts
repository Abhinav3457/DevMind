import mongoose, { Document, Schema } from 'mongoose';

export interface IProjectFile {
  name: string;
  path: string;
  content: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProject extends Document {
  name: string;
  description: string;
  owner: mongoose.Types.ObjectId;
  workspace: mongoose.Types.ObjectId;
  collaborators: mongoose.Types.ObjectId[];
  files: IProjectFile[];
  status: 'active' | 'archived' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

const projectFileSchema = new Schema<IProjectFile>(
  {
    name: { type: String, required: true },
    path: { type: String, required: true },
    content: { type: String, default: '' },
    language: { type: String, default: 'plaintext' },
  },
  { timestamps: true },
);

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: [true, 'Project name is required'], trim: true, minlength: [1, 'Name must be at least 1 character'], maxlength: [100, 'Name cannot exceed 100 characters'] },
    description: { type: String, default: '', maxlength: [1000, 'Description cannot exceed 1000 characters'] },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'Owner is required'], index: true },
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: [true, 'Workspace is required'], index: true },
    collaborators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    files: [projectFileSchema],
    status: { type: String, enum: { values: ['active', 'archived', 'deleted'], message: 'Status must be active, archived, or deleted' }, default: 'active' },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_doc: Document, ret: Record<string, unknown>) { ret.id = (ret._id as string).toString(); delete ret._id; delete ret.__v; return ret; } } },
);

projectSchema.index({ owner: 1, status: 1 });
projectSchema.index({ workspace: 1, status: 1 });
projectSchema.index({ workspace: 1, name: 1 }, { unique: true });

const Project = mongoose.model<IProject>('Project', projectSchema);
export default Project;
