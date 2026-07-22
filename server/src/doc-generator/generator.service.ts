import { generateFromAI } from '../config/ai';
import logger from '../utils/logger';

export type DocType =
  | 'readme'
  | 'installation'
  | 'folder-structure'
  | 'architecture'
  | 'api-docs'
  | 'env-vars'
  | 'deployment'
  | 'contributing'
  | 'license';

export const DOC_TYPES: DocType[] = [
  'readme', 'installation', 'folder-structure', 'architecture',
  'api-docs', 'env-vars', 'deployment', 'contributing', 'license',
];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  'readme': 'README.md',
  'installation': 'INSTALLATION.md',
  'folder-structure': 'FOLDER_STRUCTURE.md',
  'architecture': 'ARCHITECTURE.md',
  'api-docs': 'API.md',
  'env-vars': 'ENVIRONMENT.md',
  'deployment': 'DEPLOYMENT.md',
  'contributing': 'CONTRIBUTING.md',
  'license': 'LICENSE.md',
};

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

interface DocResult {
  content: string;
  documentType: DocType;
  fileName: string;
}

export class GeneratorService {
  async generate(type: DocType, context: ContextInput): Promise<DocResult> {
    const systemInstruction = this.buildSystemInstruction(type);
    const prompt = this.buildPrompt(type, context);

    try {
      const content = await generateFromAI({
        systemInstruction,
        prompt,
        temperature: 0.4,
        maxTokens: 8192,
      });
      return { content, documentType: type, fileName: DOC_TYPE_LABELS[type] };
    } catch (error) {
      logger.error('DocGenerator: Generation failed for ' + type, error);
      return this.fallbackDoc(type, context);
    }
  }

  private buildSystemInstruction(type: DocType): string {
    const instructions: Record<DocType, string> = {
      'readme': [
        'You are a technical documentation writer. Generate a comprehensive README.md file for the project.',
        'Include: project title, description, key features, tech stack badges, quick start, folder structure overview, and links to other docs.',
        'Use proper Markdown formatting with headings, code blocks, tables, and badges where appropriate.',
        'Keep it professional and concise. Aim for 300-500 lines of well-structured Markdown.',
      ].join('\n'),
      'installation': [
        'You are a technical documentation writer. Generate an INSTALLATION.md guide.',
        'Include: prerequisites, step-by-step setup instructions for both frontend and backend,',
        'environment variable configuration, running in development mode, building for production.',
        'Use code blocks for commands. List all required tools and versions.',
      ].join('\n'),
      'folder-structure': [
        'You are a technical documentation writer. Generate a FOLDER_STRUCTURE.md file.',
        'Render the folder structure as a markdown tree diagram using indentation and dashes.',
        'For each folder, provide a brief description of its purpose.',
        'For important files, provide a one-line description of their role.',
      ].join('\n'),
      'architecture': [
        'You are a software architect documenting system design. Generate an ARCHITECTURE.md file.',
        'Include: high-level architecture diagram (ASCII), folder structure explanation,',
        'data flow description, key design patterns used, technology decisions and rationale,',
        'module interaction explanation, and API layer description.',
        'Use the provided code samples to illustrate architecture patterns.',
        'Be thorough but clear. Use Mermaid.js or ASCII diagrams where helpful.',
      ].join('\n'),
      'api-docs': [
        'You are an API documentation writer. Generate an API.md file.',
        'For each endpoint or route found, document: HTTP method, URL path, authentication requirements,',
        'request body/parameters format, response format, error codes, and example requests.',
        'Use the provided code samples and route files to extract actual endpoint definitions.',
        'Use proper Markdown tables for parameters and response fields.',
        'Include curl examples for each major endpoint.',
      ].join('\n'),
      'env-vars': [
        'You are a technical documentation writer. Generate an ENVIRONMENT.md file.',
        'List every environment variable used in the project.',
        'For each variable, provide: name, description, whether it is required, default value, and example value.',
        'Group variables by category (e.g., Server, Database, Auth, External Services).',
        'Use a Markdown table format.',
      ].join('\n'),
      'deployment': [
        'You are a DevOps documentation writer. Generate a DEPLOYMENT.md file.',
        'Include: deployment prerequisites, build steps, environment configuration,',
        'Docker instructions (if applicable), platform-specific guides (e.g., Vercel, Heroku, AWS),',
        'monitoring and logging setup, and health check endpoints.',
        'Provide clear, copy-paste ready commands.',
      ].join('\n'),
      'contributing': [
        'You are a community manager creating a CONTRIBUTING.md file.',
        'Include: how to report bugs, feature request process, development setup,',
        'coding standards and conventions, pull request process, code review guidelines,',
        'testing requirements, and commit message conventions.',
        'Be welcoming and clear about expectations.',
      ].join('\n'),
      'license': [
        'You are generating a LICENSE.md file. Generate a standard MIT License.',
        'Use the project name from the context. Keep it to the standard MIT License template.',
      ].join('\n'),
    };

    return instructions[type];
  }

  private fallbackDoc(type: DocType, context: ContextInput): DocResult {
    const fileName = DOC_TYPE_LABELS[type];
    const title = fileName.replace('.md', '');
    return {
      content: [
        '# ' + title,
        '',
        '> This document was auto-generated by DevMind AI.',
        '> AI generation was temporarily unavailable, so a template is provided.',
        '',
        '## Project Overview',
        '',
        context.summary || 'No project summary available.',
        '',
        '## Technology Stack',
        '',
        context.techStack || 'No tech stack data available.',
        '',
        '## Getting Started',
        '',
        '### Prerequisites',
        '',
        'List the required tools and dependencies here.',
        '',
        '### Installation',
        '',
        '1. Clone the repository',
        '2. Install dependencies',
        '3. Configure environment variables',
        '4. Start the development server',
        '',
        '## Project Structure',
        '',
        '```',
        context.folderStructure || 'No folder structure data available.',
        '```',
        '',
        '## Available Scripts',
        '',
        '- `npm run dev` - Start development server',
        '- `npm run build` - Build for production',
        '- `npm test` - Run tests',
        '',
        '---',
        '',
        '*This is a template. Run the generation again when the AI service is available for a fully AI-generated document.*',
      ].join('\n'),
      documentType: type,
      fileName,
    };
  }

  private buildPrompt(type: DocType, context: ContextInput): string {
    const contextBlock = [
      '=== REPOSITORY CONTEXT ===',
      '',
      'Summary:',
      context.summary || 'No summary available.',
      '',
      'Technology Stack:',
      context.techStack || 'No tech stack data.',
      '',
      'Folder Structure:',
      context.folderStructure || 'No folder structure data.',
      '',
      'Files Analyzed: ' + context.fileCount,
      'Languages: ' + context.languageCounts,
      '',
      'Key Files:',
      context.topFiles || 'N/A',
      '',
      'Route Files:',
      context.routes || 'N/A',
      '',
      'Functions:',
      context.functions || 'N/A',
      '',
      'Classes:',
      context.classes || 'N/A',
      '',
      'Environment Variables:',
      context.envVars || 'N/A',
      '',
      'Dependencies:',
      context.dependencies || 'N/A',
    ].join('\n');

    const codeSamplesBlock = context.codeSamples
      ? '\n=== CODE SAMPLES FROM KEY FILES ===\n\n' + context.codeSamples
      : '';

    const promptTemplates: Record<DocType, string> = {
      'readme': [
        'Generate a complete README.md file for this project.',
        contextBlock,
        codeSamplesBlock,
        '\nOutput ONLY the README.md content. Start with the project title as an H1 heading.',
      ].join('\n'),
      'installation': [
        'Generate a complete INSTALLATION.md file for setting up this project.',
        contextBlock,
        codeSamplesBlock,
        '\nOutput ONLY the INSTALLATION.md content. Start with "# Installation Guide".',
      ].join('\n'),
      'folder-structure': [
        'Generate a FOLDER_STRUCTURE.md file describing the project directory layout.',
        contextBlock,
        codeSamplesBlock,
        '\nOutput ONLY the FOLDER_STRUCTURE.md content. Start with "# Folder Structure".',
      ].join('\n'),
      'architecture': [
        'Generate a detailed ARCHITECTURE.md file explaining the system architecture.',
        contextBlock,
        codeSamplesBlock,
        '\nOutput ONLY the ARCHITECTURE.md content. Start with "# Architecture".',
      ].join('\n'),
      'api-docs': [
        'Generate a complete API.md file documenting all API endpoints.',
        contextBlock,
        codeSamplesBlock,
        '\nOutput ONLY the API.md content. Start with "# API Documentation".',
      ].join('\n'),
      'env-vars': [
        'Generate an ENVIRONMENT.md file listing all environment variables.',
        contextBlock,
        codeSamplesBlock,
        '\nOutput ONLY the ENVIRONMENT.md content. Start with "# Environment Variables".',
      ].join('\n'),
      'deployment': [
        'Generate a DEPLOYMENT.md guide for deploying this project.',
        contextBlock,
        codeSamplesBlock,
        '\nOutput ONLY the DEPLOYMENT.md content. Start with "# Deployment Guide".',
      ].join('\n'),
      'contributing': [
        'Generate a CONTRIBUTING.md file for contributing to this project.',
        contextBlock,
        codeSamplesBlock,
        '\nOutput ONLY the CONTRIBUTING.md content. Start with "# Contributing".',
      ].join('\n'),
      'license': [
        'Generate a LICENSE.md file with the MIT License for this project.',
        contextBlock,
        codeSamplesBlock,
        '\nOutput ONLY the LICENSE.md content. Start with "# MIT License".',
      ].join('\n'),
    };

    return promptTemplates[type];
  }
}

export const generatorService = new GeneratorService();
