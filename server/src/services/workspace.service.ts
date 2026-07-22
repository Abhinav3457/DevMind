import mongoose from 'mongoose';
import Workspace, { IWorkspace } from '../models/Workspace';
import WorkspaceMember, { IWorkspaceMember, WorkspaceRole, hasMinimumRole } from '../models/WorkspaceMember';
import User from '../models/User';
import ImportedRepository from '../models/ImportedRepository';
import IndexReport from '../models/IndexReport';
import { ApiError } from '../utils/apiResponse';

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
      const user = m.userId as unknown as { _id: string; name: string; email: string; avatar: string | null };
      return {
        id: m._id.toString(),
        userId: user._id?.toString() || m.userId.toString(),
        name: user.name || 'Unknown',
        email: user.email || '',
        avatar: user.avatar || null,
        role: m.role as WorkspaceRole,
        joinedAt: m.joinedAt,
      };
    });
  }

  async inviteMember(workspaceId: string, inviterId: string, email: string, role: WorkspaceRole = 'member'): Promise<MemberResult> {
    await this.assertMinimumRole(workspaceId, inviterId, 'admin');

    if (role === 'owner') {
      throw new ApiError(400, 'Cannot invite someone as owner. Transfer ownership instead.');
    }

    const invitedUser = await User.findOne({ email });
    if (!invitedUser) {
      throw new ApiError(404, 'No user found with this email address');
    }

    const existingMember = await WorkspaceMember.findOne({
      workspaceId,
      userId: invitedUser._id,
    });

    if (existingMember) {
      throw new ApiError(409, 'This user is already a member of the workspace');
    }

    const member = await WorkspaceMember.create({
      workspaceId,
      userId: invitedUser._id,
      role,
      invitedBy: new mongoose.Types.ObjectId(inviterId),
      joinedAt: new Date(),
    });

    return {
      id: member._id.toString(),
      userId: invitedUser._id.toString(),
      name: invitedUser.name,
      email: invitedUser.email,
      avatar: invitedUser.avatar || null,
      role,
      joinedAt: member.joinedAt,
    };
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
      const user = m.userId as unknown as { name?: string; email?: string };
      return {
        type: 'member_joined',
        description: user?.name || 'A user',
        timestamp: m.joinedAt,
        userId: m.userId?.toString() || '',
      };
    });

    return { activities, total, page, limit };
  }
}

export const workspaceService = new WorkspaceService();
