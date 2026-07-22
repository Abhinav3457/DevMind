import { Request, Response } from 'express';
import { projectService } from '../services/project.service';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

export class ProjectController {
  async create(req: Request, res: Response): Promise<void> {
    const { name, description, workspace } = req.body;
    const project = await projectService.create({
      name,
      description,
      workspaceId: workspace,
      ownerId: req.user!.userId,
    });
    sendCreated(res, { message: 'Project created successfully', data: { project } });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const project = await projectService.getById(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Project retrieved successfully', data: { project } });
  }

  async listMyProjects(req: Request, res: Response): Promise<void> {
    const { page, limit, search, status, workspace } = req.query;
    const pageNum = page ? parseInt(page as string, 10) : undefined;
    const limitNum = limit ? parseInt(limit as string, 10) : undefined;
    const result = await projectService.listByUser(req.user!.userId, {
      page: pageNum && !isNaN(pageNum) ? pageNum : undefined,
      limit: limitNum && !isNaN(limitNum) ? limitNum : undefined,
      search: search as string,
      status: status as string,
      workspaceId: workspace as string,
    });
    sendSuccess(res, {
      statusCode: 200,
      message: 'Projects retrieved successfully',
      data: { projects: result.projects },
      meta: {
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      },
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const { name, description, status } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    const project = await projectService.update(req.params.id, req.user!.userId, updates);
    sendSuccess(res, { statusCode: 200, message: 'Project updated successfully', data: { project } });
  }

  async archive(req: Request, res: Response): Promise<void> {
    await projectService.archive(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Project archived successfully' });
  }

  async delete(req: Request, res: Response): Promise<void> {
    await projectService.delete(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Project deleted successfully' });
  }

  async hardDelete(req: Request, res: Response): Promise<void> {
    await projectService.hardDelete(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Project permanently deleted' });
  }

  async addCollaborator(req: Request, res: Response): Promise<void> {
    const { userId } = req.body;
    const project = await projectService.addCollaborator(req.params.id, req.user!.userId, userId);
    sendSuccess(res, { statusCode: 200, message: 'Collaborator added successfully', data: { project } });
  }

  async removeCollaborator(req: Request, res: Response): Promise<void> {
    const project = await projectService.removeCollaborator(
      req.params.id,
      req.user!.userId,
      req.params.userId,
    );
    sendSuccess(res, { statusCode: 200, message: 'Collaborator removed successfully', data: { project } });
  }

  async getFileTree(req: Request, res: Response): Promise<void> {
    const files = await projectService.getFileTree(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'File tree retrieved successfully', data: { files } });
  }
}

export const projectController = new ProjectController();
