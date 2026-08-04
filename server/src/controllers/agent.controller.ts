import { Request, Response } from 'express';
import { agentService } from '../services/agent.service';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

export class AgentController {
  async createRun(req: Request, res: Response): Promise<void> {
    const { reportId, task } = req.body;
    const run = await agentService.createRun(req.user!.userId, reportId, task);
    sendCreated(res, { message: 'Agent run created', data: { run } });
  }

  async getRun(req: Request, res: Response): Promise<void> {
    const run = await agentService.getRun(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Agent run retrieved', data: { run } });
  }

  async listRuns(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const runs = await agentService.listRuns(req.user!.userId, limit);
    sendSuccess(res, { statusCode: 200, message: 'Agent runs retrieved', data: { runs } });
  }

  async deleteRun(req: Request, res: Response): Promise<void> {
    const deleted = await agentService.deleteRun(req.params.id, req.user!.userId);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Agent run not found' });
      return;
    }
    sendSuccess(res, { statusCode: 200, message: 'Agent run deleted', data: {} });
  }
}

export const agentController = new AgentController();
