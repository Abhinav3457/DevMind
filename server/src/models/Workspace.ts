import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkspace extends Document {
  name: string;
  slug: string;
  description: string;
  ownerId: mongoose.Types.ObjectId;
  logo?: string;
  plan: 'free' | 'pro' | 'enterprise';
  settings: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: [true, 'Workspace name is required'], trim: true, minlength: [1, 'Name must be at least 1 character'], maxlength: [100, 'Name cannot exceed 100 characters'] },
    slug: { type: String, required: [true, 'Slug is required'], unique: true, trim: true, lowercase: true, minlength: [3, 'Slug must be at least 3 characters'], maxlength: [50, 'Slug cannot exceed 50 characters'], match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'] },
    description: { type: String, default: '', maxlength: [500, 'Description cannot exceed 500 characters'] },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'Owner is required'], index: true },
    logo: { type: String, default: null },
    plan: { type: String, enum: { values: ['free', 'pro', 'enterprise'], message: 'Plan must be free, pro, or enterprise' }, default: 'free' },
    settings: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_doc: Document, ret: Record<string, unknown>) { ret.id = (ret._id as string).toString(); delete ret._id; delete ret.__v; return ret; } } },
);

workspaceSchema.index({ isActive: 1, createdAt: -1 });

const Workspace = mongoose.model<IWorkspace>('Workspace', workspaceSchema);
export default Workspace;
