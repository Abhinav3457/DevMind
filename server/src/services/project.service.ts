import mongoose from 'mongoose';
import Project, { IProject } from '../models/Project';
import WorkspaceMember from '../models/WorkspaceMember';
import { ApiError } from '../utils/apiResponse';

interface CreateProjectParams {
  name: string;
  description?: string;
  workspaceId: string;
  ownerId: string;
}

interface UpdateProjectParams {
  name?: string;
  description?: string;
  status?: 'active' | 'archived' | 'deleted';
}

interface ListProjectsOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  workspaceId?: string;
}

export class ProjectService {
  private async assertWorkspaceAccess(workspaceId: string, userId: string): Promise<void> {
    const member = await WorkspaceMember.findOne({ workspaceId, userId });
    if (!member) {
      throw new ApiError(403, 'You are not a member of this workspace');
    }
  }

  private async assertProjectAccess(projectId: string, userId: string): Promise<IProject> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    const isOwner = project.owner.toString() === userId;
    const isCollaborator = project.collaborators.some(
      (c) => c.toString() === userId,
    );

    if (!isOwner && !isCollaborator) {
      await this.assertWorkspaceAccess(project.workspace.toString(), userId);
    }

    return project;
  }

  async create(params: CreateProjectParams): Promise<IProject> {
    const { name, description, workspaceId, ownerId } = params;

    await this.assertWorkspaceAccess(workspaceId, ownerId);

    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Project.findOne({
      workspace: new mongoose.Types.ObjectId(workspaceId),
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      status: { $ne: 'deleted' },
    });
    if (existing) {
      throw new ApiError(409, 'A project with this name already exists in this workspace');
    }

    const project = await Project.create({
      name,
      description: description || '',
      owner: new mongoose.Types.ObjectId(ownerId),
      workspace: new mongoose.Types.ObjectId(workspaceId),
    });

    return project;
  }

  async getById(projectId: string, userId: string): Promise<IProject> {
    return this.assertProjectAccess(projectId, userId);
  }

  async listByUser(
    userId: string,
    options: ListProjectsOptions = {},
  ): Promise<{ projects: IProject[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 10, 50);
    const skip = (page - 1) * limit;

    // Build query based on user's accessible workspaces
    const memberships = await WorkspaceMember.find({ userId }).select('workspaceId');
    const workspaceIds = memberships.map((m) => m.workspaceId);

    if (workspaceIds.length === 0) {
      return { projects: [], total: 0, page, limit };
    }

    const query: Record<string, unknown> = {
      $or: [
        { owner: new mongoose.Types.ObjectId(userId) },
        { workspace: { $in: workspaceIds } },
      ],
      status: { $ne: 'deleted' },
    };

    if (options.status) {
      query.status = options.status;
    }
    if (options.workspaceId) {
      query.workspace = new mongoose.Types.ObjectId(options.workspaceId);
    }
    if (options.search) {
      query.name = { $regex: options.search, $options: 'i' };
    }

    const [projects, total] = await Promise.all([
      Project.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', 'name email avatar'),
      Project.countDocuments(query),
    ]);

    return { projects, total, page, limit };
  }

  async update(
    projectId: string,
    userId: string,
    updates: UpdateProjectParams,
  ): Promise<IProject> {
    const project = await this.assertProjectAccess(projectId, userId);

    // Only owner or workspace admin can update
    if (project.owner.toString() !== userId) {
      // Check if user is workspace admin
      const member = await WorkspaceMember.findOne({
        workspaceId: project.workspace.toString(),
        userId,
      });
      if (!member || !['owner', 'admin'].includes(member.role as string)) {
        throw new ApiError(403, 'Only the project owner or workspace admin can update this project');
      }
    }

    const updated = await Project.findByIdAndUpdate(
      projectId,
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!updated) {
      throw new ApiError(404, 'Project not found');
    }

    return updated;
  }

  async archive(projectId: string, userId: string): Promise<void> {
    await this.update(projectId, userId, { status: 'archived' });
  }

  async delete(projectId: string, userId: string): Promise<void> {
    await this.update(projectId, userId, { status: 'deleted' });
  }

  async hardDelete(projectId: string, userId: string): Promise<void> {
    const project = await this.assertProjectAccess(projectId, userId);

    // Only owner can hard delete
    if (project.owner.toString() !== userId) {
      throw new ApiError(403, 'Only the project owner can permanently delete this project');
    }

    await Project.findByIdAndDelete(projectId);
  }

  async addCollaborator(
    projectId: string,
    userId: string,
    targetUserId: string,
  ): Promise<IProject> {
    const project = await this.assertProjectAccess(projectId, userId);

    if (project.owner.toString() !== userId) {
      throw new ApiError(403, 'Only the project owner can add collaborators');
    }

    const isAlreadyCollaborator = project.collaborators.some(
      (c) => c.toString() === targetUserId,
    );
    if (isAlreadyCollaborator) {
      throw new ApiError(409, 'User is already a collaborator on this project');
    }

    project.collaborators.push(new mongoose.Types.ObjectId(targetUserId));
    await project.save();
    return project;
  }

  async removeCollaborator(
    projectId: string,
    userId: string,
    targetUserId: string,
  ): Promise<IProject> {
    const project = await this.assertProjectAccess(projectId, userId);

    if (project.owner.toString() !== userId) {
      throw new ApiError(403, 'Only the project owner can remove collaborators');
    }

    project.collaborators = project.collaborators.filter(
      (c) => c.toString() !== targetUserId,
    );
    await project.save();
    return project;
  }

  async getFileTree(projectId: string, userId: string): Promise<{ name: string; path: string; language: string }[]> {
    const project = await this.assertProjectAccess(projectId, userId);
    return project.files.map((f) => ({
      name: f.name,
      path: f.path,
      language: f.language,
    }));
  }
}

export const projectService = new ProjectService();
