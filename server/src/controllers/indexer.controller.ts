import { Request, Response } from 'express';
import { indexerService } from '../indexer/indexer.service';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

export class IndexerController {
  async indexRepository(req: Request, res: Response): Promise<void> {
    const { repoDir } = req.body;
    const { repositoryId } = req.params;

    const result = await indexerService.indexRepository(
      req.user!.userId,
      repositoryId,
      repoDir,
    );
    sendCreated(res, { message: 'Repository indexing started', data: result });
  }

  async getReport(req: Request, res: Response): Promise<void> {
    const report = await indexerService.getReport(req.params.reportId, req.user!.userId);
    if (!report) {
      res.status(404).json({ success: false, message: 'Index report not found' });
      return;
    }
    sendSuccess(res, { statusCode: 200, message: 'Index report retrieved', data: { report } });
  }

  async getFiles(req: Request, res: Response): Promise<void> {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const result = await indexerService.getFiles(req.params.reportId, req.user!.userId, page, limit);
    sendSuccess(res, {
      statusCode: 200,
      message: 'Indexed files retrieved',
      data: { files: result.files },
      meta: { total: result.total, page, limit },
    });
  }

  async getFile(req: Request, res: Response): Promise<void> {
    const file = await indexerService.getFile(req.params.reportId, req.params.fileId, req.user!.userId);
    if (!file) {
      res.status(404).json({ success: false, message: 'Indexed file not found' });
      return;
    }
    sendSuccess(res, { statusCode: 200, message: 'Indexed file retrieved', data: { file } });
  }

  async getChunks(req: Request, res: Response): Promise<void> {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const result = await indexerService.getChunks(req.params.reportId, req.user!.userId, page, limit);
    sendSuccess(res, {
      statusCode: 200,
      message: 'Indexed chunks retrieved',
      data: { chunks: result.chunks },
      meta: { total: result.total, page, limit },
    });
  }

  async deleteReport(req: Request, res: Response): Promise<void> {
    const deleted = await indexerService.deleteReport(req.params.reportId, req.user!.userId);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Index report not found' });
      return;
    }
    sendSuccess(res, { statusCode: 200, message: 'Index report deleted', data: {} });
  }
}

export const indexerController = new IndexerController();
