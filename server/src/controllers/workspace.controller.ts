import { Request, Response } from 'express';
import { workspaceService } from '../services/workspace.service';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

export class WorkspaceController {
  async create(req: Request, res: Response): Promise<void> {
    const { name, slug, description } = req.body;
    const workspace = await workspaceService.create({ name, slug, description, ownerId: req.user!.userId });
    sendCreated(res, { message: 'Workspace created successfully', data: { workspace } });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const workspace = await workspaceService.getById(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Workspace retrieved successfully', data: { workspace } });
  }

  async listMyWorkspaces(req: Request, res: Response): Promise<void> {
    const { page, limit, search } = req.query;
    const pageNum = page ? parseInt(page as string, 10) : undefined;
    const limitNum = limit ? parseInt(limit as string, 10) : undefined;
    const result = await workspaceService.listByUser(req.user!.userId, {
      page: pageNum && !isNaN(pageNum) ? pageNum : undefined,
      limit: limitNum && !isNaN(limitNum) ? limitNum : undefined,
      search: search as string,
    });
    sendSuccess(res, {
      statusCode: 200,
      message: 'Workspaces retrieved successfully',
      data: { workspaces: result.workspaces },
      meta: { pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: Math.ceil(result.total / result.limit) } },
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const { name, description, settings } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (settings !== undefined) updates.settings = settings;
    const workspace = await workspaceService.update(req.params.id, req.user!.userId, updates);
    sendSuccess(res, { statusCode: 200, message: 'Workspace updated successfully', data: { workspace } });
  }

  async archive(req: Request, res: Response): Promise<void> {
    await workspaceService.archive(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Workspace archived successfully' });
  }

  async unarchive(req: Request, res: Response): Promise<void> {
    await workspaceService.unarchive(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Workspace restored successfully' });
  }

  async delete(req: Request, res: Response): Promise<void> {
    await workspaceService.delete(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Workspace deleted successfully' });
  }

  async listMembers(req: Request, res: Response): Promise<void> {
    const members = await workspaceService.listMembers(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Members retrieved successfully', data: { members } });
  }

  async sendInvitation(req: Request, res: Response): Promise<void> {
    const { email, role } = req.body;
    const invite = await workspaceService.sendInvitation(req.params.id, req.user!.userId, email, role);
    sendSuccess(res, { statusCode: 200, message: 'Invitation sent successfully', data: { invite } });
  }

  async listPendingInvitations(req: Request, res: Response): Promise<void> {
    const invitations = await workspaceService.listPendingInvitations(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Invitations retrieved successfully', data: { invitations } });
  }

  async revokeInvitation(req: Request, res: Response): Promise<void> {
    await workspaceService.revokeInvitation(req.params.id, req.user!.userId, req.params.inviteId);
    sendSuccess(res, { statusCode: 200, message: 'Invitation revoked successfully' });
  }

  async listMyInvitations(req: Request, res: Response): Promise<void> {
    const invitations = await workspaceService.listMyInvitations(req.user!.userId, req.user!.email);
    sendSuccess(res, { statusCode: 200, message: 'Invitations retrieved successfully', data: { invitations } });
  }

  async getInvitationByToken(req: Request, res: Response): Promise<void> {
    const invitation = await workspaceService.getInvitationByToken(req.params.token);
    sendSuccess(res, { statusCode: 200, message: 'Invitation retrieved successfully', data: { invitation } });
  }

  async acceptInvitation(req: Request, res: Response): Promise<void> {
    const member = await workspaceService.acceptInvitation(req.params.token, req.user!.userId, req.user!.email);
    sendSuccess(res, { statusCode: 200, message: 'Invitation accepted — welcome to the workspace!', data: { member } });
  }

  async declineInvitation(req: Request, res: Response): Promise<void> {
    await workspaceService.declineInvitation(req.params.token, req.user!.userId, req.user!.email);
    sendSuccess(res, { statusCode: 200, message: 'Invitation declined' });
  }

  async changeMemberRole(req: Request, res: Response): Promise<void> {
    const { role } = req.body;
    await workspaceService.changeMemberRole(req.params.id, req.user!.userId, req.params.userId, role);
    sendSuccess(res, { statusCode: 200, message: 'Member role updated successfully' });
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    await workspaceService.removeMember(req.params.id, req.user!.userId, req.params.userId);
    sendSuccess(res, { statusCode: 200, message: 'Member removed successfully' });
  }

  async transferOwnership(req: Request, res: Response): Promise<void> {
    const { newOwnerId } = req.body;
    await workspaceService.transferOwnership(req.params.id, req.user!.userId, newOwnerId);
    sendSuccess(res, { statusCode: 200, message: 'Ownership transferred successfully' });
  }

  async listRepos(req: Request, res: Response): Promise<void> {
    const repos = await workspaceService.listRepos(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Workspace repos retrieved', data: { repos } });
  }

  async getActivityTimeline(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query;
    const pageNum = page ? parseInt(page as string, 10) : undefined;
    const limitNum = limit ? parseInt(limit as string, 10) : undefined;
    const result = await workspaceService.getActivityTimeline(req.params.id, req.user!.userId, {
      page: pageNum && !isNaN(pageNum) ? pageNum : undefined,
      limit: limitNum && !isNaN(limitNum) ? limitNum : undefined,
    });
    sendSuccess(res, { statusCode: 200, message: 'Activity timeline retrieved', data: { activities: result.activities }, meta: { pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: Math.ceil(result.total / result.limit) } } });
  }
}

export const workspaceController = new WorkspaceController();
