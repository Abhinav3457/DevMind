import { Request, Response } from 'express';
import { docGeneratorService } from '../services/doc-generator.service';
import { generatorService } from '../doc-generator/generator.service';
import { sendSuccess } from '../utils/apiResponse';

export class DocGeneratorController {
  async generate(req: Request, res: Response): Promise<void> {
    const { reportId } = req.params;
    const { type } = req.body;

    const userId = req.user!.userId;
    const result = await docGeneratorService.generate(reportId, userId, type);

    await docGeneratorService.saveHistory({
      userId,
      type: result.documentType,
      fileName: result.fileName,
      content: result.content,
      reportId,
    });

    sendSuccess(res, {
      statusCode: 200,
      message: result.fileName + ' generated successfully',
      data: {
        content: result.content,
        documentType: result.documentType,
        fileName: result.fileName,
      },
    });
  }

  async generateDirect(req: Request, res: Response): Promise<void> {
    const { type, context } = req.body;

    // Create a basic context input from the user's description for direct AI generation
    const contextInput = {
      summary: context,
      techStack: 'Provided in user context above',
      folderStructure: 'Provided in user context above',
      fileCount: 0,
      languageCounts: 'See context',
      topFiles: '',
      routes: '',
      functions: '',
      envVars: '',
      dependencies: '',
      classes: '',
      codeSamples: '',
    };

    const result = await generatorService.generate(type, contextInput);

    await docGeneratorService.saveHistory({
      userId: req.user!.userId,
      type: result.documentType,
      fileName: result.fileName,
      content: result.content,
      context,
    });

    sendSuccess(res, {
      statusCode: 200,
      message: result.fileName + ' generated successfully',
      data: {
        content: result.content,
        documentType: result.documentType,
        fileName: result.fileName,
      },
    });
  }

  async getAvailableTypes(_req: Request, res: Response): Promise<void> {
    const types = docGeneratorService.getAvailableTypes();

    sendSuccess(res, {
      statusCode: 200,
      message: 'Document types retrieved',
      data: { types },
    });
  }

  async listHistory(req: Request, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const result = await docGeneratorService.listHistory(req.user!.userId, { page, limit });

    sendSuccess(res, {
      statusCode: 200,
      message: 'Document history retrieved',
      data: result,
    });
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    const result = await docGeneratorService.getHistoryDetail(req.user!.userId, req.params.id);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Generated document retrieved',
      data: result,
    });
  }

  async deleteHistory(req: Request, res: Response): Promise<void> {
    await docGeneratorService.deleteHistory(req.user!.userId, req.params.id);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Generated document deleted',
    });
  }
}

export const docGeneratorController = new DocGeneratorController();
