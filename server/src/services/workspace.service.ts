import crypto from 'crypto';
import mongoose from 'mongoose';
import Workspace, { IWorkspace } from '../models/Workspace';
import WorkspaceMember, { IWorkspaceMember, WorkspaceRole, hasMinimumRole } from '../models/WorkspaceMember';
import WorkspaceInvite from '../models/WorkspaceInvite';
import User from '../models/User';
import ImportedRepository from '../models/ImportedRepository';
import IndexReport from '../models/IndexReport';
import Notification from '../models/Notification';
import { sendWorkspaceInviteEmail } from '../helpers/email.helper';
import { ApiError } from '../utils/apiResponse';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

interface CreateWorkspaceParams {
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
}

interface MemberResult {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: WorkspaceRole;
  joinedAt: Date;
}

interface WorkspaceWithRole extends IWorkspace {
  userRole: WorkspaceRole;
  memberCount: number;
  repoCount?: number;
}

interface InviteResult {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: string;
  token: string;
  expiresAt: Date;
  inviterName?: string;
  workspaceName?: string;
  createdAt?: Date;
}

interface InviteDetail {
  id: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  email: string;
  role: WorkspaceRole;
  status: string;
  expiresAt: Date;
}

export class WorkspaceService {
  // ─── Permission Helpers ──────────────────────────────────────

  private async assertMinimumRole(workspaceId: string, userId: string, minimumRole: WorkspaceRole): Promise<IWorkspaceMember> {
    const member = await WorkspaceMember.findOne({ workspaceId, userId });
    if (!member) {
      throw new ApiError(403, 'You are not a member of this workspace');
    }
    if (!hasMinimumRole(member.role as WorkspaceRole, minimumRole)) {
      throw new ApiError(403, `You need at least "${minimumRole}" role to perform this action`);
    }
    return member;
  }

  private async assertExactRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<IWorkspaceMember> {
    const member = await WorkspaceMember.findOne({ workspaceId, userId });
    if (!member) {
      throw new ApiError(403, 'You are not a member of this workspace');
    }
    if (member.role !== role) {
      throw new ApiError(403, `You need exactly "${role}" role to perform this action`);
    }
    return member;
  }

  // ─── Core Operations ─────────────────────────────────────────

  async create(params: CreateWorkspaceParams): Promise<WorkspaceWithRole> {
    const { name, slug, description, ownerId } = params;

    const existingSlug = await Workspace.findOne({ slug });
    if (existingSlug) {
      throw new ApiError(409, 'A workspace with this slug already exists');
    }

    const workspace = await Workspace.create({
      name,
      slug,
      description: description || '',
      ownerId: new mongoose.Types.ObjectId(ownerId),
    });

    await WorkspaceMember.create({
      workspaceId: workspace._id,
      userId: new mongoose.Types.ObjectId(ownerId),
      role: 'owner',
      invitedBy: new mongoose.Types.ObjectId(ownerId),
      joinedAt: new Date(),
    });

    const result = workspace.toJSON() as unknown as WorkspaceWithRole;
    result.userRole = 'owner';
    result.memberCount = 1;
    return result;
  }

  async getById(workspaceId: string, userId: string): Promise<WorkspaceWithRole> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new ApiError(404, 'Workspace not found');
    }
    if (!workspace.isActive) {
      throw new ApiError(404, 'Workspace not found');
    }

    const member = await WorkspaceMember.findOne({ workspaceId, userId });
    if (!member) {
      throw new ApiError(403, 'You are not a member of this workspace');
    }

    const memberCount = await WorkspaceMember.countDocuments({ workspaceId });
    const result = workspace.toJSON() as unknown as WorkspaceWithRole;
    result.userRole = member.role as WorkspaceRole;
    result.memberCount = memberCount;
    return result;
  }

  async listByUser(userId: string, options: { page?: number; limit?: number; search?: string } = {}): Promise<{ workspaces: WorkspaceWithRole[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 10, 50);
    const skip = (page - 1) * limit;

    // Optimized: single aggregation pipeline to get workspaces + member counts + user role
    const membershipQuery: Record<string, unknown> = { userId };
    const memberships = await WorkspaceMember.find(membershipQuery).sort({ createdAt: -1 });
    const workspaceIds = memberships.map((m) => m.workspaceId.toString());

    if (workspaceIds.length === 0) {
      return { workspaces: [], total: 0, page, limit };
    }

    const workspaceQuery: Record<string, unknown> = {
      _id: { $in: workspaceIds },
      isActive: true,
    };
    if (options.search) {
      workspaceQuery.name = { $regex: options.search, $options: 'i' };
    }

    // Fetch workspaces with pagination
    const [workspaces, total] = await Promise.all([
      Workspace.find(workspaceQuery).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      Workspace.countDocuments(workspaceQuery),
    ]);

    // Batch fetch member counts for only the returned workspaces (2 queries instead of N+1)
    const memberCounts = workspaces.length > 0
      ? await WorkspaceMember.aggregate([
          { $match: { workspaceId: { $in: workspaces.map((w) => w._id) } } },
          { $group: { _id: '$workspaceId', count: { $sum: 1 } } },
        ])
      : [];

    // Batch fetch repo counts
    const repoCounts = workspaces.length > 0
      ? await ImportedRepository.aggregate([
          { $match: { workspaceId: { $in: workspaces.map((w) => w._id) } } },
          { $group: { _id: '$workspaceId', count: { $sum: 1 } } },
        ])
      : [];

    const roleMap = new Map(memberships.map((m) => [m.workspaceId.toString(), m.role]));
    const countMap = new Map(memberCounts.map((c) => [c._id.toString(), c.count]));
    const repoCountMap = new Map(repoCounts.map((c) => [c._id.toString(), c.count]));

    const results: WorkspaceWithRole[] = workspaces.map((w) => {
      const r = w.toJSON() as unknown as WorkspaceWithRole;
      r.userRole = (roleMap.get(w._id.toString()) || 'guest') as WorkspaceRole;
      r.memberCount = countMap.get(w._id.toString()) || 0;
      r.repoCount = repoCountMap.get(w._id.toString()) || 0;
      return r;
    });

    return { workspaces: results, total, page, limit };
  }

  async update(workspaceId: string, userId: string, updates: Partial<IWorkspace>): Promise<IWorkspace> {
    await this.assertMinimumRole(workspaceId, userId, 'admin');

    const disallowedFields = ['ownerId', 'slug', 'isActive'];
    for (const field of disallowedFields) {
      if (field in updates) {
        throw new ApiError(400, `Cannot update "${field}" through this endpoint`);
      }
    }

    const workspace = await Workspace.findByIdAndUpdate(workspaceId, { $set: updates }, { new: true, runValidators: true });
    if (!workspace) {
      throw new ApiError(404, 'Workspace not found');
    }
    return workspace;
  }

  async archive(workspaceId: string, userId: string): Promise<void> {
    await this.assertMinimumRole(workspaceId, userId, 'admin');
    await Workspace.findByIdAndUpdate(workspaceId, { isActive: false });
  }

  async unarchive(workspaceId: string, userId: string): Promise<void> {
    await this.assertExactRole(workspaceId, userId, 'owner');
    await Workspace.findByIdAndUpdate(workspaceId, { isActive: true });
  }

  async delete(workspaceId: string, userId: string): Promise<void> {
    await this.assertExactRole(workspaceId, userId, 'owner');
    await Promise.all([
      Workspace.findByIdAndDelete(workspaceId),
      WorkspaceMember.deleteMany({ workspaceId }),
    ]);
  }

  // ─── Member Management ───────────────────────────────────────

  async listMembers(workspaceId: string, userId: string): Promise<MemberResult[]> {
    await this.assertMinimumRole(workspaceId, userId, 'member');

    const members = await WorkspaceMember.find({ workspaceId })
      .populate('userId', 'name email avatar')
      .sort({ role: -1, joinedAt: 1 });

    return members.map((m) => {
      const user = m.userId as unknown as { _id?: mongoose.Types.ObjectId | string; name?: string; email?: string; avatar?: string | null } | null;
      // m.userId is populated (User doc), so its _id is the real user id.
      // It can be null when the referenced user no longer exists — don't crash.
      const rawUserId = user?._id ?? m.userId;
      return {
        id: m._id.toString(),
        userId: rawUserId?.toString() || '',
        name: user?.name || 'Unknown',
        email: user?.email || '',
        avatar: user?.avatar || null,
        role: m.role as WorkspaceRole,
        joinedAt: m.joinedAt,
      };
    });
  }

  // ─── Invitations ──────────────────────────────────────────────

  private generateInviteToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Send a workspace invitation by email. Works for both registered users
   * (who get an in-app notification + email) and new signups (who get an
   * email with an accept link). Membership is only granted once the invite
   * is accepted.
   */
  async sendInvitation(workspaceId: string, inviterId: string, email: string, role: WorkspaceRole = 'member'): Promise<InviteResult> {
    await this.assertMinimumRole(workspaceId, inviterId, 'admin');

    if (role === 'owner') {
      throw new ApiError(400, 'Cannot invite someone as owner. Transfer ownership instead.');
    }

    const normalizedEmail = email.trim().toLowerCase();

    const invitedUser = await User.findOne({ email: normalizedEmail });

    // Registered users who are already members cannot be invited again
    if (invitedUser) {
      const existingMember = await WorkspaceMember.findOne({
        workspaceId,
        userId: invitedUser._id,
      });
      if (existingMember) {
        throw new ApiError(409, 'This user is already a member of the workspace');
      }
    }

    // No duplicate pending invitations for the same email (expired invites
    // don't block re-invites — the TTL index may not have cleaned them yet)
    const existingInvite = await WorkspaceInvite.findOne({
      workspaceId,
      email: normalizedEmail,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });
    if (existingInvite) {
      throw new ApiError(409, 'An invitation has already been sent to this email');
    }

    const invite = await WorkspaceInvite.create({
      workspaceId,
      inviterId: new mongoose.Types.ObjectId(inviterId),
      email: normalizedEmail,
      role,
      status: 'pending',
      token: this.generateInviteToken(),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });

    const [workspace, inviter] = await Promise.all([
      Workspace.findById(workspaceId).select('name'),
      User.findById(inviterId).select('name'),
    ]);
    const workspaceName = workspace?.name || 'the workspace';
    const inviterName = inviter?.name || 'Someone';

    const acceptUrl = `${CLIENT_URL}/invitations/${invite.token}`;
    const declineUrl = `${CLIENT_URL}/invitations/${invite.token}?action=decline`;

    // In-app notification for registered users
    if (invitedUser) {
      await Notification.create({
        userId: invitedUser._id,
        type: 'workspace_invite',
        title: `Invitation to "${workspaceName}"`,
        message: `${inviterName} invited you to join the workspace "${workspaceName}"`,
        data: { workspaceId, inviteId: invite._id.toString(), token: invite.token, role },
      });
    }

    // Always send the email so the request actually reaches the friend,
    // even if they haven't created an account yet.
    await sendWorkspaceInviteEmail(normalizedEmail, inviterName, workspaceName, acceptUrl, declineUrl);

    return {
      id: invite._id.toString(),
      workspaceId,
      email: normalizedEmail,
      role,
      status: invite.status,
      token: invite.token,
      expiresAt: invite.expiresAt,
    };
  }

  async listPendingInvitations(workspaceId: string, userId: string): Promise<InviteResult[]> {
    await this.assertMinimumRole(workspaceId, userId, 'member');

    const invites = await WorkspaceInvite.find({ workspaceId, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('inviterId', 'name')
      .lean();

    return invites.map((i) => ({
      id: (i._id as mongoose.Types.ObjectId).toString(),
      workspaceId,
      email: i.email,
      role: i.role as WorkspaceRole,
      status: i.status,
      token: i.token,
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
      inviterName: (i.inviterId as unknown as { name?: string })?.name || 'Someone',
    }));
  }

  async revokeInvitation(workspaceId: string, userId: string, inviteId: string): Promise<void> {
    await this.assertMinimumRole(workspaceId, userId, 'admin');

    const invite = await WorkspaceInvite.findOne({ _id: inviteId, workspaceId, status: 'pending' });
    if (!invite) {
      throw new ApiError(404, 'Pending invitation not found');
    }
    await WorkspaceInvite.deleteOne({ _id: invite._id });
  }

  /**
   * List pending invitations received by the current user (matched by email).
   */
  async listMyInvitations(userId: string, email: string): Promise<InviteResult[]> {
    const invites = await WorkspaceInvite.find({ email: email.trim().toLowerCase(), status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('inviterId', 'name')
      .lean();

    const workspaceIds = Array.from(new Set(invites.map((i) => (i.workspaceId as mongoose.Types.ObjectId).toString())));
    const workspaces = workspaceIds.length > 0
      ? await Workspace.find({ _id: { $in: workspaceIds }, isActive: true }).select('name').lean()
      : [];
    const workspaceNameMap = new Map(workspaces.map((w) => [(w._id as mongoose.Types.ObjectId).toString(), w.name]));

    return invites
      .filter((i) => workspaceNameMap.has((i.workspaceId as mongoose.Types.ObjectId).toString()))
      .map((i) => ({
        id: (i._id as mongoose.Types.ObjectId).toString(),
        workspaceId: (i.workspaceId as mongoose.Types.ObjectId).toString(),
        workspaceName: workspaceNameMap.get((i.workspaceId as mongoose.Types.ObjectId).toString()) || 'Workspace',
        email: i.email,
        role: i.role as WorkspaceRole,
        status: i.status,
        token: i.token,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
        inviterName: (i.inviterId as unknown as { name?: string })?.name || 'Someone',
      }));
  }

  /**
   * Fetch a single invitation by its token (used by the invite link page).
   */
  async getInvitationByToken(token: string): Promise<InviteDetail> {
    const invite = await WorkspaceInvite.findOne({ token })
      .populate('inviterId', 'name')
      .lean();
    if (!invite) {
      throw new ApiError(404, 'Invitation not found');
    }

    const workspace = await Workspace.findById(invite.workspaceId).select('name isActive').lean();
    if (!workspace || !workspace.isActive) {
      throw new ApiError(404, 'Workspace not found');
    }

    const expired = invite.expiresAt.getTime() < Date.now();
    return {
      id: (invite._id as mongoose.Types.ObjectId).toString(),
      workspaceId: (invite.workspaceId as mongoose.Types.ObjectId).toString(),
      workspaceName: workspace.name,
      inviterName: (invite.inviterId as unknown as { name?: string })?.name || 'Someone',
      email: invite.email,
      role: invite.role as WorkspaceRole,
      status: expired ? 'expired' : invite.status,
      expiresAt: invite.expiresAt,
    };
  }

  /**
   * Accept an invitation. The logged-in user's email must match the invite.
   */
  async acceptInvitation(token: string, userId: string, email: string): Promise<MemberResult> {
    const invite = await WorkspaceInvite.findOne({ token, status: 'pending' });
    if (!invite) {
      throw new ApiError(404, 'Invitation not found or already responded to');
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      invite.status = 'expired';
      await invite.save();
      throw new ApiError(410, 'This invitation has expired');
    }

    if (invite.email !== email.trim().toLowerCase()) {
      throw new ApiError(403, 'This invitation was sent to a different email address');
    }

    const workspace = await Workspace.findById(invite.workspaceId);
    if (!workspace || !workspace.isActive) {
      throw new ApiError(404, 'Workspace not found');
    }

    const existingMember = await WorkspaceMember.findOne({ workspaceId: invite.workspaceId, userId });
    if (existingMember) {
      invite.status = 'accepted';
      invite.acceptedAt = new Date();
      await invite.save();
      throw new ApiError(409, 'You are already a member of this workspace');
    }

    const member = await WorkspaceMember.create({
      workspaceId: invite.workspaceId,
      userId: new mongoose.Types.ObjectId(userId),
      role: invite.role as WorkspaceRole,
      invitedBy: invite.inviterId,
      joinedAt: new Date(),
    });

    invite.status = 'accepted';
    invite.acceptedAt = new Date();
    await invite.save();

    const user = await User.findById(userId);
    return {
      id: member._id.toString(),
      userId,
      name: user?.name || 'Member',
      email: user?.email || invite.email,
      avatar: user?.avatar || null,
      role: invite.role as WorkspaceRole,
      joinedAt: member.joinedAt,
    };
  }

  async declineInvitation(token: string, userId: string, email: string): Promise<void> {
    const invite = await WorkspaceInvite.findOne({ token, status: 'pending' });
    if (!invite) {
      throw new ApiError(404, 'Invitation not found or already responded to');
    }

    if (invite.email !== email.trim().toLowerCase()) {
      throw new ApiError(403, 'This invitation was sent to a different email address');
    }

    invite.status = 'declined';
    invite.declinedAt = new Date();
    await invite.save();
  }

  async changeMemberRole(
    workspaceId: string,
    userId: string,
    targetUserId: string,
    newRole: WorkspaceRole,
  ): Promise<void> {
    await this.assertMinimumRole(workspaceId, userId, 'admin');

    if (newRole === 'owner') {
      throw new ApiError(400, 'Cannot change role to owner. Transfer ownership instead.');
    }

    const member = await WorkspaceMember.findOne({ workspaceId, userId: targetUserId });
    if (!member) {
      throw new ApiError(404, 'Member not found');
    }

    if (member.role === 'owner') {
      throw new ApiError(400, 'Cannot change the role of the workspace owner');
    }

    member.role = newRole;
    await member.save();
  }

  async removeMember(
    workspaceId: string,
    userId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.assertMinimumRole(workspaceId, userId, 'admin');

    const member = await WorkspaceMember.findOne({ workspaceId, userId: targetUserId });
    if (!member) {
      throw new ApiError(404, 'Member not found');
    }

    if (member.role === 'owner') {
      throw new ApiError(400, 'Cannot remove the workspace owner. Transfer ownership first.');
    }

    await WorkspaceMember.deleteOne({ _id: member._id });
  }

  async transferOwnership(
    workspaceId: string,
    userId: string,
    newOwnerId: string,
  ): Promise<void> {
    await this.assertExactRole(workspaceId, userId, 'owner');

    const newOwner = await WorkspaceMember.findOne({ workspaceId, userId: newOwnerId });
    if (!newOwner) {
      throw new ApiError(404, 'New owner must be an existing workspace member');
    }

    const currentOwner = await WorkspaceMember.findOne({ workspaceId, userId });
    if (!currentOwner) {
      throw new ApiError(403, 'You are not a member of this workspace');
    }

    currentOwner.role = 'admin';
    newOwner.role = 'owner';

    await Promise.all([currentOwner.save(), newOwner.save()]);

    await Workspace.findByIdAndUpdate(workspaceId, { ownerId: newOwnerId });
  }

  // ─── Repository Management ────────────────────────────────────

  async listRepos(workspaceId: string, userId: string): Promise<Record<string, unknown>[]> {
    await this.assertMinimumRole(workspaceId, userId, 'member');

    const repos = await ImportedRepository.find({ workspaceId })
      .sort({ updatedAt: -1 })
      .lean();

    // Attach index status for each repo
    const reposWithStatus = await Promise.all(repos.map(async (repo) => {
      const report = await IndexReport.findOne({ repositoryId: repo._id })
        .sort({ createdAt: -1 })
        .select('status summary fileCount chunkCount completedAt')
        .lean();
      return {
        id: repo._id.toString(),
        name: repo.name,
        fullName: repo.fullName,
        language: repo.language,
        description: repo.description,
        url: repo.url,
        isPrivate: repo.isPrivate,
        defaultBranch: repo.defaultBranch,
        stars: repo.stars,
        forks: repo.forks,
        indexStatus: report ? report.status : 'not_indexed',
        indexedFiles: report?.fileCount || 0,
        indexedChunks: report?.chunkCount || 0,
        indexedAt: report?.completedAt || null,
      };
    }));

    return reposWithStatus;
  }

  async getActivityTimeline(
    workspaceId: string,
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ activities: Record<string, unknown>[]; total: number; page: number; limit: number }> {
    await this.assertMinimumRole(workspaceId, userId, 'member');

    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    // For now, return member join dates as activity
    const members = await WorkspaceMember.find({ workspaceId })
      .populate('userId', 'name email')
      .sort({ joinedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await WorkspaceMember.countDocuments({ workspaceId });

    const activities = members.map((m) => {
      const user = m.userId as unknown as { _id?: mongoose.Types.ObjectId | string; name?: string; email?: string } | null;
      // m.userId is populated (User doc), so its _id is the real user id.
      // Calling .toString() on the populated doc would yield "[object Object]"
      const rawUserId = user?._id ?? m.userId;
      const userId = rawUserId?.toString() || '';
      return {
        type: 'member_joined',
        description: user?.name || 'A user',
        timestamp: m.joinedAt,
        userId,
      };
    });

    return { activities, total, page, limit };
  }
}

export const workspaceService = new WorkspaceService();
