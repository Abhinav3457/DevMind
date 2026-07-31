import mongoose, { Document, Schema } from 'mongoose';

export interface IGitHubAccount extends Document {
  userId: mongoose.Types.ObjectId;
  githubId: number;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes: string[];
  isConnected: boolean;
  rateLimitRemaining: number;
  rateLimitReset: Date;
  createdAt: Date;
  updatedAt: Date;
}

const gitHubAccountSchema = new Schema<IGitHubAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    githubId: { type: Number, required: true },
    login: { type: String, required: true, trim: true },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    tokenExpiresAt: { type: Date },
    scopes: { type: [String], default: [] },
    isConnected: { type: Boolean, default: true },
    rateLimitRemaining: { type: Number, default: 5000 },
    rateLimitReset: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { transform(_doc: Document, ret: Record<string, unknown>) { ret.id = (ret._id as string).toString(); delete ret._id; delete ret.__v; return ret; } } },
);

const GitHubAccount = mongoose.model<IGitHubAccount>('GitHubAccount', gitHubAccountSchema);
export default GitHubAccount;
