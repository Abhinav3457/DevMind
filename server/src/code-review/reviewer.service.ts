import { IIndexedFile } from '../models/IndexedFile';
import { generateFromAI } from '../config/ai';
import logger from '../utils/logger';

export interface ReviewIssue {
  type: 'bug' | 'security' | 'performance' | 'code_smell' | 'solid_violation';
  severity: 'critical' | 'major' | 'minor' | 'info';
  file: string;
  line: number;
  message: string;
  explanation: string;
  recommendation: string;
}

export interface ReviewCategory {
  issues: ReviewIssue[];
  score: number;
  summary: string;
}

export interface RefactoringSuggestion {
  priority: 'high' | 'medium' | 'low';
  file: string;
  line: number;
  title: string;
  description: string;
  estimatedEffort: string;
}

export interface ReviewResult {
  score: number;
  summary: string;
  categories: {
    bugs: ReviewCategory;
    security: ReviewCategory;
    performance: ReviewCategory;
    codeSmells: ReviewCategory;
    solidViolations: ReviewCategory;
  };
  refactoringSuggestions: RefactoringSuggestion[];
  fixedVersion: string;
  totalIssues: number;
}

export class ReviewerService {
  async reviewFiles(files: { file: IIndexedFile; content: string }[]): Promise<ReviewResult> {
    const totalLines = files.reduce((acc, f) => acc + f.content.split('\n').length, 0);

    const codeBlock = files
      .map((f) => '--- File: ' + f.file.path + ' (' + f.file.language + ', ' + f.content.split('\n').length + ' lines) ---\n' + f.content)
      .join('\n\n');

    const prompt = this.buildReviewPrompt(codeBlock, files.length, totalLines);
    const systemInstruction = this.buildSystemInstruction();

    try {
      const response = await generateFromAI({
        systemInstruction,
        prompt,
        temperature: 0.2,
        maxTokens: 8192,
      });
      return this.parseReviewResponse(response, files);
    } catch (error) {
      logger.error('Reviewer: AI review failed', error);
      return this.fallbackReview();
    }
  }

  private buildSystemInstruction(): string {
    return [
      'You are an expert code reviewer AI. Your role is to analyze code thoroughly and provide structured, actionable feedback.',
      '',
      'Analysis categories:',
      '1. BUGS: Logic errors, edge cases not handled, null/undefined issues, race conditions',
      '2. SECURITY: Injection vulnerabilities, auth bypasses, exposed secrets, input validation issues',
      '3. PERFORMANCE: Inefficient algorithms, unnecessary allocations, blocking operations, N+1 queries',
      '4. CODE SMELLS: Duplicated code, long methods, too many parameters, poor naming, deep nesting',
      '5. SOLID VIOLATIONS: Single responsibility breaks, tight coupling, interface segregation issues',
      '',
      'For each issue found, provide:',
      '- The exact file path and line number',
      '- Severity: critical / major / minor / info',
      '- A clear explanation of why it is a problem',
      '- A specific recommendation on how to fix it',
      '',
      'Always provide:',
      '- An overall review score from 0-100',
      '- A summary paragraph describing the code quality',
      '- A refactored/fixed version of the MOST critical issue found',
      '- Priority suggestions for improvements',
      '',
      'Respond with structured markdown using the exact format specified.',
    ].join('\n');
  }

  private buildReviewPrompt(codeBlock: string, fileCount: number, totalLines: number): string {
    return [
      '## Code to Review',
      '',
      'Files: ' + fileCount + ' | Total Lines: ' + totalLines,
      '',
      codeBlock,
      '',
      '## Response Format',
      '',
      'Provide your review in the following structure:',
      '',
      '### REVIEW SCORE',
      '[Score: 0-100]',
      '',
      '### SUMMARY',
      '[Brief summary of code quality]',
      '',
      '### BUGS',
      '| Severity | File | Line | Issue | Explanation | Recommendation |',
      '|----------|------|------|-------|-------------|----------------|',
      '[Table rows]',
      '',
      '### SECURITY',
      '| Severity | File | Line | Issue | Explanation | Recommendation |',
      '|----------|------|------|-------|-------------|----------------|',
      '[Table rows]',
      '',
      '### PERFORMANCE',
      '| Severity | File | Line | Issue | Explanation | Recommendation |',
      '|----------|------|------|-------|-------------|----------------|',
      '[Table rows]',
      '',
      '### CODE SMELLS',
      '| Severity | File | Line | Issue | Explanation | Recommendation |',
      '|----------|------|------|-------|-------------|----------------|',
      '[Table rows]',
      '',
      '### SOLID VIOLATIONS',
      '| Severity | File | Line | Issue | Explanation | Recommendation |',
      '|----------|------|------|-------|-------------|----------------|',
      '[Table rows]',
      '',
      '### REFACTORING SUGGESTIONS',
      '| Priority | File | Line | Title | Description | Effort |',
      '|----------|------|------|-------|-------------|--------|',
      '[Table rows]',
      '',
      '### FIXED VERSION',
      '```',
      '[Fixed code for the most critical issue]',
      '```',
      '',
      "Start your response with '### REVIEW SCORE' and use the exact section headers above.",
    ].join('\n');
  }

  private parseReviewResponse(response: string, files: { file: IIndexedFile; content: string }[]): ReviewResult {
    const defaultCategory = (): ReviewCategory => ({ issues: [], score: 100, summary: 'No issues detected' });

    const parseCategory = (sectionName: string, type: ReviewIssue['type']): ReviewCategory => {
      const section = this.extractSection(response, sectionName);
      if (!section) return defaultCategory();

      const issues = this.parseIssuesTable(section, type, files);
      const score = this.calculateCategoryScore(issues);
      const summary = issues.length > 0
        ? 'Found ' + issues.length + ' ' + type.replace('_', ' ') + ' issue(s)'
        : 'No issues detected';

      return { issues, score, summary };
    };

    const bugs = parseCategory('BUGS', 'bug');
    const security = parseCategory('SECURITY', 'security');
    const performance = parseCategory('PERFORMANCE', 'performance');
    const codeSmells = parseCategory('CODE SMELLS', 'code_smell');
    const solidViolations = parseCategory('SOLID VIOLATIONS', 'solid_violation');

    const totalIssues = bugs.issues.length + security.issues.length +
      performance.issues.length + codeSmells.issues.length + solidViolations.issues.length;

    const scoreMatch = response.match(/(?:Score|score)[:\s]+(\d+)/);
    const parsedScore = scoreMatch ? parseInt(scoreMatch[1]!, 10) : null;
    const score = parsedScore !== null ? Math.max(0, Math.min(100, parsedScore)) : Math.round(
      (bugs.score + security.score + performance.score + codeSmells.score + solidViolations.score) / 5
    );

    const summarySection = this.extractSection(response, 'SUMMARY');
    const summary = summarySection || 'Code review completed with ' + totalIssues + ' issues found.';

    const suggestions = this.parseSuggestions(response, files);
    const fixedVersion = this.extractFixedCode(response);

    return {
      score,
      summary,
      categories: { bugs, security, performance, codeSmells, solidViolations },
      refactoringSuggestions: suggestions,
      fixedVersion,
      totalIssues,
    };
  }

  private extractSection(text: string, sectionName: string): string {
    const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('###\\s*' + escaped + '\\s*([\\s\\S]*?)(?=###|$)', 'i');
    const match = text.match(pattern);
    return match ? match[1]!.trim() : '';
  }

  private parseIssuesTable(
    section: string,
    type: ReviewIssue['type'],
    files: { file: IIndexedFile; content: string }[],
  ): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const lines = section.split('\n');
    let inTable = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('|') && trimmed.includes('---')) {
        inTable = true;
        continue;
      }

      if (!inTable || !trimmed.startsWith('|')) continue;

      const cells = trimmed.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      if (cells.length < 6) continue;

      const severity = cells[0]!.toLowerCase() as ReviewIssue['severity'];
      const fileHint = cells[1]!;
      const lineStr = cells[2]!;
      const message = cells[3]!;
      const explanation = cells[4]!;
      const recommendation = cells[5]!;

      const matchedFile = files.find((f) =>
        f.file.path.toLowerCase().includes(fileHint.toLowerCase()) ||
        fileHint.toLowerCase().includes(f.file.name.toLowerCase())
      );
      const filePath = matchedFile ? matchedFile.file.path : fileHint;
      const lineNum = parseInt(lineStr, 10);

      if (['critical', 'major', 'minor', 'info'].includes(severity)) {
        issues.push({
          type,
          severity: severity as ReviewIssue['severity'],
          file: filePath,
          line: isNaN(lineNum) ? 0 : lineNum,
          message,
          explanation,
          recommendation,
        });
      }
    }

    return issues;
  }

  private calculateCategoryScore(issues: ReviewIssue[]): number {
    if (issues.length === 0) return 100;

    const severityWeights: Record<string, number> = {
      critical: 15,
      major: 8,
      minor: 3,
      info: 1,
    };

    let totalDeduction = 0;
    for (const issue of issues) {
      totalDeduction += severityWeights[issue.severity] || 1;
    }

    return Math.max(0, Math.min(100, 100 - totalDeduction));
  }

  private parseSuggestions(
    response: string,
    files: { file: IIndexedFile; content: string }[],
  ): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    const section = this.extractSection(response, 'REFACTORING SUGGESTIONS');
    if (!section) return suggestions;

    const lines = section.split('\n');
    let inTable = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.includes('---')) {
        inTable = true;
        continue;
      }
      if (!inTable || !trimmed.startsWith('|')) continue;

      const cells = trimmed.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      if (cells.length < 6) continue;

      const priority = cells[0]!.toLowerCase() as RefactoringSuggestion['priority'];
      const fileHint = cells[1]!;
      const lineStr = cells[2]!;
      const title = cells[3]!;
      const description = cells[4]!;
      const effort = cells[5]!;

      const matchedFile = files.find((f) =>
        f.file.path.toLowerCase().includes(fileHint.toLowerCase()) ||
        fileHint.toLowerCase().includes(f.file.name.toLowerCase())
      );
      const filePath = matchedFile ? matchedFile.file.path : fileHint;
      const lineNum = parseInt(lineStr, 10);

      if (['high', 'medium', 'low'].includes(priority)) {
        suggestions.push({
          priority: priority as RefactoringSuggestion['priority'],
          file: filePath,
          line: isNaN(lineNum) ? 0 : lineNum,
          title,
          description,
          estimatedEffort: effort,
        });
      }
    }

    return suggestions;
  }

  private extractFixedCode(response: string): string {
    const section = this.extractSection(response, 'FIXED VERSION');
    if (!section) return '';

    const codeMatch = section.match(/```[\s\S]*?```/);
    return codeMatch ? codeMatch[0] : section;
  }

  private fallbackReview(): ReviewResult {
    return {
      score: 50,
      summary: 'AI review was unavailable. Returning a neutral score. Please try again later.',
      categories: {
        bugs: { issues: [], score: 100, summary: 'Review unavailable' },
        security: { issues: [], score: 100, summary: 'Review unavailable' },
        performance: { issues: [], score: 100, summary: 'Review unavailable' },
        codeSmells: { issues: [], score: 100, summary: 'Review unavailable' },
        solidViolations: { issues: [], score: 100, summary: 'Review unavailable' },
      },
      refactoringSuggestions: [],
      fixedVersion: '',
      totalIssues: 0,
    };
  }
}

export const reviewerService = new ReviewerService();
