import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import ImportedRepository from '../models/ImportedRepository';
import { generatorService } from '../doc-generator/generator.service';
import { DocType } from '../doc-generator/generator.service';
import { logActivity } from './activity.service';
import { ApiError } from '../utils/apiResponse';
import logger from '../utils/logger';

const MAX_TOP_FILES = 15;
const MAX_CODE_SAMPLES = 10;

interface ContextInput {
  summary: string;
  techStack: string;
  folderStructure: string;
  fileCount: number;
  languageCounts: string;
  topFiles: string;
  routes: string;
  functions: string;
  envVars: string;
  dependencies: string;
  classes: string;
  codeSamples: string;
}

interface GenerateResult {
  content: string;
  documentType: DocType;
  fileName: string;
}

export class DocGeneratorService {
  async generate(
    reportId: string,
    userId: string,
    docType: DocType,
  ): Promise<GenerateResult> {
    const startTime = Date.now();

    const report = await IndexReport.findOne({ _id: reportId, userId });
    if (!report) {
      throw new ApiError(404, 'Index report not found or access denied');
    }
    if (report.status !== 'completed') {
      throw new ApiError(400, 'Indexing has not completed yet. Status: ' + report.status);
    }

    const files = await IndexedFile.find({ reportId })
      .limit(MAX_TOP_FILES)
      .sort({ size: -1 })
      .lean();

    // Language counts
    const langCounts = new Map<string, number>();
    for (const f of files) {
      langCounts.set(f.language, (langCounts.get(f.language) || 0) + 1);
    }
    const languageCounts = [...langCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([lang, count]) => lang + ': ' + count + ' files')
      .join(', ');

    // Top files
    const topFiles = files
      .slice(0, 10)
      .map((f) => '- ' + f.path + ' (' + f.language + ', ' + f.functions.length + ' functions, ' + f.classes.length + ' classes)')
      .join('\n');

    // Routes
    const routeFiles = files
      .filter((f) => f.path.includes('routes') || f.name.includes('route'))
      .map((f) => '- ' + f.path + ': exports [' + f.exports.join(', ') + ']')
      .join('\n');

    // Functions
    const allFunctions = files
      .flatMap((f) => f.functions.map((fn) => fn.name + ' (' + f.path + ':' + fn.startLine + '-' + fn.endLine + ')'))
      .slice(0, 50);
    const functionsStr = allFunctions.length > 0
      ? allFunctions.join(', ')
      : 'No function metadata available';

    // Classes
    const allClasses = files
      .flatMap((f) => f.classes.map((cls) => cls.name + ' (' + f.path + ':' + cls.startLine + '-' + cls.endLine + ')'))
      .slice(0, 30);
    const classesStr = allClasses.length > 0
      ? allClasses.join(', ')
      : 'No class metadata available';

    // Env vars
    const envVars = report.techStack.envVars.length > 0
      ? report.techStack.envVars.join(', ')
      : 'None detected from source code';

    // Dependencies
    const allDeps = new Set<string>();
    for (const f of files) {
      for (const d of f.dependencies) allDeps.add(d);
    }
    const dependencies = [...allDeps].slice(0, 40).join(', ');

    // Folder structure
    const folderStructure = JSON.stringify(report.folderStructure, null, 2);

    // Tech stack
    const techStack = [
      'Authentication: ' + (report.techStack.authentication.join(', ') || 'None'),
      'Databases: ' + (report.techStack.databases.join(', ') || 'None'),
      'Frameworks: ' + (report.techStack.frameworks.join(', ') || 'None'),
      'Libraries: ' + (report.techStack.libraries.join(', ') || 'None'),
    ].join('\n');

    // Code samples from chunks (for route files + config files)
    const targetFiles = docType === 'api-docs' || docType === 'architecture'
      ? files.filter((f) =>
          f.path.includes('routes') || f.path.includes('controller') ||
          f.path.includes('config') || f.path.includes('app.') ||
          f.path.includes('server') || f.name.includes('index')
        )
      : [];

    let codeSamples = '';
    if (targetFiles.length > 0) {
      const chunks = await IndexedChunk.find({
        reportId,
        fileId: { $in: targetFiles.map((f) => f._id) },
      })
        .sort({ index: 1 })
        .limit(MAX_CODE_SAMPLES)
        .lean();

      const filePathMap = new Map(targetFiles.map((f) => [f._id.toString(), f.path]));
      codeSamples = chunks
        .slice(0, 5)
        .map((c) => {
          const path = filePathMap.get(c.fileId.toString()) || 'unknown';
          return '--- ' + path + ' (lines ' + c.startLine + '-' + c.endLine + ') ---\n' + c.content;
        })
        .join('\n\n');
    }

    const context: ContextInput = {
      summary: report.summary,
      techStack,
      folderStructure,
      fileCount: report.fileCount,
      languageCounts,
      topFiles,
      routes: routeFiles || 'No route files detected',
      functions: functionsStr,
      envVars,
      dependencies,
      classes: classesStr,
      codeSamples,
    };

    const result = await generatorService.generate(docType, context);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('DocGenerator: Generated ' + result.fileName + ' in ' + duration + 's');

    // Log to the activity feed (best-effort)
    try {
      const importedRepo = await ImportedRepository.findById(report.repositoryId).select('fullName').lean();
      void logActivity({
        userId,
        type: 'doc_generated',
        description: 'Generated ' + result.fileName + (importedRepo?.fullName ? ' for ' + importedRepo.fullName : ''),
        metadata: { docType, fileName: result.fileName },
      });
    } catch (error) {
      logger.error('DocGenerator: Failed to log activity', error);
    }

    return result;
  }

  getAvailableTypes(): { type: DocType; label: string; description: string }[] {
    return [
      { type: 'readme', label: 'README.md', description: 'Project overview with features, tech stack, and quick start' },
      { type: 'installation', label: 'INSTALLATION.md', description: 'Step-by-step setup and configuration guide' },
      { type: 'folder-structure', label: 'FOLDER_STRUCTURE.md', description: 'Directory tree with folder descriptions' },
      { type: 'architecture', label: 'ARCHITECTURE.md', description: 'System design, data flow, and design patterns' },
      { type: 'api-docs', label: 'API.md', description: 'Complete API endpoint documentation with examples' },
      { type: 'env-vars', label: 'ENVIRONMENT.md', description: 'All environment variables with descriptions' },
      { type: 'deployment', label: 'DEPLOYMENT.md', description: 'Deployment guide for various platforms' },
      { type: 'contributing', label: 'CONTRIBUTING.md', description: 'Contribution guidelines and standards' },
      { type: 'license', label: 'LICENSE.md', description: 'Open source license file' },
    ];
  }
}

export const docGeneratorService = new DocGeneratorService();
