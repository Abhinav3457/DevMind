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
        'You are a senior technical documentation writer. Generate a comprehensive, production-quality README.md.',
        '',
        'STRUCTURE YOUR OUTPUT WITH THESE SECTIONS:',
        '1. # Project Title — Clear, descriptive project name with a one-line tagline.',
        '2. ## Features — Bullet list of key features with brief descriptions.',
        '3. ## Tech Stack — Categorized table of technologies (Frontend, Backend, Database, DevOps).',
        '4. ## Quick Start — Numbered, copy-paste ready setup steps with code blocks.',
        '5. ## Project Structure — Tree view of the folder structure with descriptions.',
        '6. ## Available Scripts — Table of npm/yarn commands with descriptions.',
        '7. ## Environment Variables — Table with variable name, description, default, required.',
        '8. ## Deployment — Brief deployment instructions.',
        '9. ## Contributing — Link to CONTRIBUTING.md.',
        '10. ## License — License information.',
        '',
        'Use proper Markdown: fenced code blocks with language tags, tables, badges (![Node](https://img.shields.io/...)).',
        'Aim for 200-400 lines of well-structured, professional Markdown.',
      ].join('\n'),
      'installation': [
        'You are a DevOps documentation writer. Generate a comprehensive INSTALLATION.md.',
        '',
        'STRUCTURE:',
        '1. ## Prerequisites — List required tools with minimum versions in a table.',
        '2. ## Clone Repository — Git clone command.',
        '3. ## Backend Setup — Step-by-step with code blocks for each command:',
        '   - Install dependencies: ```bash npm install```',
        '   - Environment: Copy .env.example to .env, explain each variable',
        '   - Database: Setup instructions',
        '   - Run migrations/seeds if applicable',
        '4. ## Frontend Setup — Step-by-step with code blocks.',
        '5. ## Running the App — Development mode, production build, Docker.',
        '6. ## Troubleshooting — Common issues and solutions.',
      ].join('\n'),
      'folder-structure': [
        'You are a technical writer documenting project structure. Generate FOLDER_STRUCTURE.md.',
        '',
        'STRUCTURE:',
        'Render the folder tree using indentation and dashes:',
        '```',
        'project-root/',
        '├── src/',
        '│   ├── components/    # Reusable UI components',
        '│   └── pages/         # Page-level components',
        '└── ...',
        '```',
        'For EACH folder, provide a one-line description in a comment or next to the folder name.',
        'For key files (index.ts, app.ts, config files), provide a brief description of their role.',
        'Group related folders and explain the overall architecture pattern (layered, feature-based, etc.).',
      ].join('\n'),
      'architecture': [
        'You are a senior software architect. Generate a detailed ARCHITECTURE.md.',
        '',
        'STRUCTURE:',
        '1. ## System Overview — High-level description of the system architecture.',
        '2. ## Architecture Diagram — ASCII or Mermaid.js diagram showing component interactions.',
        '3. ## Layer Breakdown — Explain each layer (Presentation, Business Logic, Data Access).',
        '4. ## Data Flow — Describe how a request flows through the system (client → server → database → response).',
        '5. ## Key Design Patterns — List and explain patterns used (MVC, Repository, Singleton, etc.).',
        '6. ## Module Interaction — How modules/features communicate.',
        '7. ## Middleware Pipeline — List middleware order and purpose.',
        '8. ## Routing Structure — API route organization.',
        '9. ## Security — Authentication, authorization, input validation approach.',
        '10. ## Performance — Caching, indexing, optimization strategies.',
      ].join('\n'),
      'api-docs': [
        'You are an API documentation specialist. Generate a complete API.md.',
        '',
        'STRUCTURE:',
        '1. ## Overview — Base URL, authentication method, content type.',
        '2. For EACH endpoint, document with this format:',
        '   ### `METHOD /api/v1/path`',
        '   - **Authentication:** Required/Optional',
        '   - **Request Body:** (table of parameters)',
        '   - **Response:** Success/Error formats',
        '   - **Example:** curl command and response',
        '',
        'Use tables for:',
        '| Parameter | Type | Required | Description |',
        '|-----------|------|----------|-------------|',
        '',
        'Group endpoints by resource (Auth, Users, Projects, etc.).',
      ].join('\n'),
      'env-vars': [
        'You are a documentation writer. Generate an ENVIRONMENT.md file.',
        '',
        'STRUCTURE:',
        '1. ## Overview — Brief explanation of environment variable management.',
        '2. Group variables by category with ### subheadings:',
        '   - ### Server Configuration',
        '   - ### Database',
        '   - ### Authentication',
        '   - ### External Services',
        '   - ### Optional',
        '3. For each variable, use this table format:',
        '| Variable | Description | Required | Default |',
        '|----------|-------------|----------|--------|',
        '| `PORT` | Server port | No | `5000` |',
        '| `JWT_SECRET` | JWT signing key | Yes | — |',
      ].join('\n'),
      'deployment': [
        'You are a DevOps engineer. Generate a comprehensive DEPLOYMENT.md.',
        '',
        'STRUCTURE:',
        '1. ## Prerequisites — Required accounts, tools, and access.',
        '2. ## Build Steps — How to build the application for production.',
        '3. ## Environment — Required environment variables in production.',
        '4. ## Docker (if applicable) — Dockerfile and docker-compose instructions.',
        '5. ## Platform Guide — Step-by-step for each platform (e.g., Render, Vercel, Railway).',
        '6. ## Database — Migration and backup strategies.',
        '7. ## Monitoring — Health checks, logging, alerting.',
        '8. ## Rollback — How to revert a deployment.',
        '',
        'Use code blocks for all commands. Include file references like `render.yaml`.',
      ].join('\n'),
      'contributing': [
        'You are a community manager. Create a welcoming CONTRIBUTING.md.',
        '',
        'STRUCTURE:',
        '1. ## Welcome — Friendly introduction.',
        '2. ## Getting Started — How to set up the project for development.',
        '3. ## Coding Standards — Linting, formatting, naming conventions.',
        '4. ## Pull Request Process — Step-by-step from fork to merge.',
        '5. ## Commit Messages — Conventional commits format.',
        '6. ## Code Review Guidelines — What reviewers look for.',
        '7. ## Testing Requirements — How to run tests, what coverage is expected.',
        '8. ## Reporting Issues — Bug report template, feature request process.',
        '9. ## Code of Conduct — Brief note linking to standard code of conduct.',
      ].join('\n'),
      'license': [
        'You are generating a LICENSE.md file.',
        'Generate a standard MIT License using the project name from the context.',
        'Use the exact MIT License template format.',
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
