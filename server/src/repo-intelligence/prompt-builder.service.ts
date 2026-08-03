import { QuestionType } from './classifier.service';
import { RetrievedContext } from './retriever.service';

interface PromptInput {
  question: string;
  questionType: QuestionType;
  context: RetrievedContext;
  targetFile?: string;
  targetFunction?: string;
}

interface BuiltPrompt {
  systemInstruction: string;
  userPrompt: string;
}

export class PromptBuilderService {
  build(input: PromptInput): BuiltPrompt {
    const { question, questionType, context, targetFile: _targetFile, targetFunction: _targetFunction } = input;

    const systemInstruction = this.buildSystemInstruction(questionType, _targetFile, _targetFunction);
    const contextBlock = this.buildContextBlock(context);
    const userPrompt = this.buildUserPrompt(question, questionType, contextBlock, _targetFile, _targetFunction);

    return { systemInstruction, userPrompt };
  }

  private buildSystemInstruction(
    type: QuestionType,
    _targetFile?: string,
    _targetFunction?: string,
  ): string {
    const base = [
      'You are DevMind AI, an expert software engineering assistant.',
      'You analyze codebases and answer questions about repository structure, architecture, and implementation details.',
      'Use the provided repository context to answer accurately.',
      '',
      'Guidelines:',
      '- Answer based ONLY on the context provided. Do not make up information.',
      '- If the context does not contain enough information, say so clearly.',
      '- Reference specific file paths and line numbers from the context.',
      '- Provide code snippets when relevant, with proper syntax highlighting.',
      '- Be concise but thorough. Use bullet points for lists.',
      '- Keep responses well-structured with sections where appropriate.',
    ];

    switch (type) {
      case 'project_overview':
        base.push(
          '',
          'Focus: Provide a high-level overview of the project.',
          'Include the main purpose, tech stack, architecture pattern, and key features.',
          'The user wants to understand what this project is and how it works at a glance.',
        );
        break;

      case 'architecture':
        base.push(
          '',
          'Focus: Explain the project architecture and design patterns.',
          'Describe the folder structure, key modules, data flow, and how components interact.',
          'Include information about the API layer, service layer, and data layer.',
        );
        break;

      case 'tech_stack':
        base.push(
          '',
          'Focus: Explain specific technologies used in the project.',
          'Describe how each technology is used, where it is configured, and how it integrates.',
          'If the question is about authentication, focus on auth-related code.',
          'If the question is about databases, focus on database connections and models.',
        );
        break;

      case 'code_location':
        base.push(
          '',
          'Focus: Find where specific code or logic is located.',
          'Show the exact file path, function name, and line numbers.',
          'Explain what the code does and how it fits into the larger system.',
          'Include the relevant code snippet from the context.',
        );
        break;

      case 'file_explain':
        base.push(
          '',
          'Focus: Explain the purpose and contents of a specific file.',
          'Describe what the file does, its exports, key functions/classes, and dependencies.',
          'Explain how this file connects to other parts of the system.',
        );
        break;

      case 'function_explain':
        base.push(
          '',
          'Focus: Explain a specific function or method in detail.',
          'Describe what the function does, its parameters, return value, and logic.',
          'Explain the algorithm, error handling, and any side effects.',
          'Show the full function code from the context.',
        );
        break;

      case 'middleware':
        base.push(
          '',
          'Focus: Explain the middleware configuration and flow.',
          'List all middleware used, the order they are applied, and their purpose.',
          'Explain how authentication, validation, error handling, and logging middleware work.',
        );
        break;

      default:
        base.push(
          '',
          'Focus: Answer the user question using the provided context.',
          'Search the chunks for relevant code and explain how it works.',
        );
        break;
    }

    return base.join('\n');
  }

  buildContextBlock(context: RetrievedContext): string {
    const parts: string[] = [];

    // Repository overview
    if (context.reportSummary) {
      parts.push('=== REPOSITORY OVERVIEW ===');
      parts.push(context.reportSummary);
    }

    // Tech stack
    if (context.techStack && context.techStack !== '{}') {
      parts.push('\n=== TECHNOLOGY STACK ===');
      parts.push(context.techStack);
    }

    // Folder structure
    if (context.folderStructure && context.folderStructure !== '[]') {
      parts.push('\n=== FOLDER STRUCTURE ===');
      parts.push(context.folderStructure);
    }

    // Relevant files
    if (context.relevantFiles.length > 0) {
      parts.push('\n=== RELEVANT FILES ===');
      for (const file of context.relevantFiles) {
        parts.push(`File: ${file.path}`);
        parts.push(`  Language: ${file.language}`);
        if (file.functions) parts.push(`  Functions: ${file.functions}`);
        if (file.classes) parts.push(`  Classes: ${file.classes}`);
        if (file.imports) parts.push(`  Imports: ${file.imports}`);
        if (file.dependencies) parts.push(`  Dependencies: ${file.dependencies}`);
        parts.push('');
      }
    }

    // Relevant code chunks
    if (context.relevantChunks.length > 0) {
      parts.push('=== RELEVANT CODE CHUNKS ===');
      for (let i = 0; i < context.relevantChunks.length; i++) {
        const chunk = context.relevantChunks[i]!;
        parts.push(`[Chunk ${i + 1}] File: ${chunk.filePath} (Lines ${chunk.startLine}-${chunk.endLine})`);
        parts.push(`Type: ${chunk.type}`);
        parts.push('```');
        parts.push(chunk.content);
        parts.push('```');
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  private buildUserPrompt(
    question: string,
    _type: QuestionType,
    contextBlock: string,
    _targetFile?: string,
    _targetFunction?: string,
  ): string {
    return [
      'Use the following repository context to answer the user question.',
      '',
      contextBlock,
      '',
      '=== USER QUESTION ===',
      question,
      '',
      'Provide a clear, well-structured answer based on the context above.',
    ].join('\n');
  }
}

export const promptBuilderService = new PromptBuilderService();
