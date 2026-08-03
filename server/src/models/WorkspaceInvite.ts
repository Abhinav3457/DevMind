import mongoose, { Document, Schema } from 'mongoose';
import { WORKSPACE_ROLES, WorkspaceRole } from './WorkspaceMember';

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface IWorkspaceInvite extends Document {
  workspaceId: mongoose.Types.ObjectId;
  inviterId: mongoose.Types.ObjectId;
  email: string;
  role: WorkspaceRole;
  status: InviteStatus;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceInviteSchema = new Schema<IWorkspaceInvite>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: [true, 'Workspace ID is required'], index: true },
    inviterId: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'Inviter is required'] },
    email: { type: String, required: [true, 'Email is required'], lowercase: true, trim: true, maxlength: [255, 'Email cannot exceed 255 characters'] },
    role: {
      type: String,
      enum: { values: WORKSPACE_ROLES, message: 'Role must be one of: owner, admin, member, guest' },
      required: [true, 'Role is required'],
      default: 'member',
    },
    status: {
      type: String,
      enum: { values: ['pending', 'accepted', 'declined', 'expired'], message: 'Status must be one of: pending, accepted, declined, expired' },
      default: 'pending',
    },
    token: { type: String, required: [true, 'Token is required'], unique: true, index: true },
    expiresAt: { type: Date, required: [true, 'Expiry date is required'] },
    acceptedAt: { type: Date },
    declinedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc: Document, ret: Record<string, unknown>) {
        ret.id = (ret._id as string).toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

workspaceInviteSchema.index({ workspaceId: 1, email: 1 });
workspaceInviteSchema.index({ email: 1, status: 1 });

// Auto-remove invites once they expire
workspaceInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const WorkspaceInvite = mongoose.model<IWorkspaceInvite>('WorkspaceInvite', workspaceInviteSchema);
export default WorkspaceInvite;
