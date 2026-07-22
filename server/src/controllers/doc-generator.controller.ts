import { Request, Response } from 'express';
import { docGeneratorService } from '../services/doc-generator.service';
import { generatorService } from '../doc-generator/generator.service';
import { sendSuccess } from '../utils/apiResponse';

export class DocGeneratorController {
  async generate(req: Request, res: Response): Promise<void> {
    const { reportId } = req.params;
    const { type } = req.body;

    const result = await docGeneratorService.generate(reportId, req.user!.userId, type);

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
}

export const docGeneratorController = new DocGeneratorController();
