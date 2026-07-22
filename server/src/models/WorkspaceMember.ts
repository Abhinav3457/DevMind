import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkspaceMember extends Document {
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: 'owner' | 'admin' | 'member' | 'guest';
  invitedBy: mongoose.Types.ObjectId;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'guest'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner: 100,
  admin: 80,
  member: 50,
  guest: 20,
};

export function hasMinimumRole(userRole: WorkspaceRole, minimumRole: WorkspaceRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

const workspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: [true, 'Workspace ID is required'] },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'User ID is required'] },
    role: { type: String, enum: { values: WORKSPACE_ROLES, message: 'Role must be one of: owner, admin, member, guest' }, required: [true, 'Role is required'], default: 'member' },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'Inviter is required'] },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_doc: Document, ret: Record<string, unknown>) { ret.id = (ret._id as string).toString(); delete ret._id; delete ret.__v; return ret; } } },
);

workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
workspaceMemberSchema.index({ workspaceId: 1, role: 1 });
workspaceMemberSchema.index({ userId: 1 });

const WorkspaceMember = mongoose.model<IWorkspaceMember>('WorkspaceMember', workspaceMemberSchema);
export default WorkspaceMember;
