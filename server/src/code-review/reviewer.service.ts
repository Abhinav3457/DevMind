import { IIndexedFile } from '../models/IndexedFile';
import { generateFromAI } from '../config/ai';
import logger from '../utils/logger';

// Maximum total prompt characters to avoid exceeding AI context windows
// (~32k tokens for Groq, estimate ~4 chars per token = ~120k chars)
const MAX_PROMPT_CHARS = 80000;

// Maximum lines of code to include per file (truncated at the end)
const MAX_LINES_PER_FILE = 100;

// Maximum number of files to include in the AI prompt
const MAX_FILES_IN_PROMPT = 5;

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

interface SectionMapping {
  sectionName: string;
  type: ReviewIssue['type'];
}

const SECTION_MAPPINGS: SectionMapping[] = [
  { sectionName: 'CORRECTNESS & BUGS', type: 'bug' },
  { sectionName: 'CORRECTNESS', type: 'bug' },
  { sectionName: 'BUGS', type: 'bug' },
  { sectionName: 'SECURITY', type: 'security' },
  { sectionName: 'PERFORMANCE', type: 'performance' },
  { sectionName: 'MAINTAINABILITY & CODE QUALITY', type: 'code_smell' },
  { sectionName: 'MAINTAINABILITY', type: 'code_smell' },
  { sectionName: 'CODE SMELLS', type: 'code_smell' },
  { sectionName: 'CODE QUALITY', type: 'code_smell' },
  { sectionName: 'ARCHITECTURE & DESIGN', type: 'solid_violation' },
  { sectionName: 'ARCHITECTURE', type: 'solid_violation' },
  { sectionName: 'SOLID VIOLATIONS', type: 'solid_violation' },
  { sectionName: 'DESIGN', type: 'solid_violation' },
  { sectionName: 'TYPE SAFETY & ERROR HANDLING', type: 'bug' },
  { sectionName: 'TYPE SAFETY', type: 'bug' },
  { sectionName: 'TESTABILITY & DOCUMENTATION', type: 'code_smell' },
];

export class ReviewerService {
  async reviewFiles(files: { file: IIndexedFile; content: string }[]): Promise<ReviewResult> {
    // Limit to MAX_FILES_IN_PROMPT, sorted by size (largest first, most relevant)
    const sortedFiles = [...files].sort((a, b) => b.content.length - a.content.length);
    const limitedFiles = sortedFiles.slice(0, MAX_FILES_IN_PROMPT);

    // Truncate each file's content to MAX_LINES_PER_FILE
    const truncatedFiles = limitedFiles.map((f) => {
      const lines = f.content.split('\n');
      const truncated = lines.slice(0, MAX_LINES_PER_FILE).join('\n');
      const truncatedMessage = lines.length > MAX_LINES_PER_FILE
        ? '\n// ... [truncated, ' + lines.length + ' total lines in file]'
        : '';
      return {
        file: f.file,
        content: truncated + truncatedMessage,
      };
    });

    const totalLines = truncatedFiles.reduce((acc, f) => acc + f.content.split('\n').length, 0);

    let codeBlock = truncatedFiles
      .map((f) => '--- File: ' + f.file.path + ' (' + f.file.language + ', ' + f.content.split('\n').length + ' lines shown) ---\n' + f.content)
      .join('\n\n');

    // If the code block is still too large, truncate further
    if (codeBlock.length > MAX_PROMPT_CHARS) {
      codeBlock = codeBlock.substring(0, MAX_PROMPT_CHARS) +
        '\n\n// ... [code truncated to fit within AI context window]';
    }

    const prompt = this.buildReviewPrompt(codeBlock, truncatedFiles.length, totalLines);
    const systemInstruction = this.buildSystemInstruction();

    try {
      const response = await generateFromAI({
        systemInstruction,
        prompt,
        temperature: 0.2,
        maxTokens: 8192,
      });
      return this.parseReviewResponse(response, truncatedFiles);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Reviewer: AI review failed', error);
      return this.fallbackReview(errMsg);
    }
  }

  private buildSystemInstruction(): string {
    return [
      'You are a world-class senior software engineer conducting a **deep, thorough, line-by-line code review**.',
      'Your analysis must be detailed, specific, and actionable — this is a production code review, not a quick scan.',
      '',
      '=== ANALYSIS DIMENSIONS ===',
      'Analyze the code across ALL of these dimensions:',
      '',
      '1. **CORRECTNESS & BUGS**',
      '   - Logic errors, off-by-one, race conditions, type coercion issues',
      '   - Null/undefined access, missing error boundaries, async/await mistakes',
      '   - Incorrect API usage, mutation of function arguments, floating point precision',
      '',
      '2. **SECURITY**',
      '   - Injection (SQL, NoSQL, command, XSS), CSRF, SSRF vulnerabilities',
      '   - Authentication/authorization bypasses, insecure direct object references',
      '   - Hardcoded secrets, weak encryption, improper input validation, path traversal',
      '',
      '3. **PERFORMANCE**',
      '   - Inefficient algorithms (O(n^2) when O(n) is possible), unnecessary loops',
      '   - Memory leaks, excessive allocations, closure retention, large object copies',
      '   - N+1 database queries, missing indexes, blocking I/O in event loop',
      '   - Bundle size concerns, unnecessary dependencies, large payload transfers',
      '',
      '4. **MAINTAINABILITY & CODE QUALITY**',
      '   - Duplicated code (DRY violations), long methods (>20 lines), deep nesting (>3 levels)',
      '   - Poor naming, magic numbers/strings, overcomplicated logic, dead code',
      '   - Missing or insufficient error handling, inconsistent patterns across the codebase',
      '   - Over-engineering (YAGNI violations), premature abstractions',
      '',
      '5. **ARCHITECTURE & DESIGN**',
      '   - Single Responsibility Principle violations, tight coupling, low cohesion',
      '   - Missing interfaces/abstractions where appropriate, dependency injection patterns',
      '   - Layer violations (UI logic in services, business logic in controllers)',
      '   - Missing separation of concerns, God objects/classes, feature envy',
      '',
      '6. **TYPE SAFETY & ERROR HANDLING**',
      '   - Overuse of `any`, missing type guards, unsafe type assertions',
      '   - Unhandled promise rejections, missing try/catch around risky operations',
      '   - Silent error swallowing, improper error propagation, missing input validation',
      '',
      '7. **TESTABILITY & DOCUMENTATION**',
      '   - Hard-to-test code (tight coupling, side effects in constructors, static methods)',
      '   - Missing or misleading comments, missing JSDoc for public APIs',
      '   - Functions with too many responsibilities (hard to unit test)',
      '',
      '=== OUTPUT REQUIREMENTS ===',
      'For EVERY issue you find, provide ALL of the following:',
      '',
      '**1. Issue Title** — Clear, specific, one-line summary (e.g. "Potential null reference when user session is missing")',
      '',
      '**2. Location** — Exact file path and line number(s)',
      '',
      '**3. Severity** — `CRITICAL` (will cause production failure) / `MAJOR` (significant quality or security concern) / `MINOR` (best practice violation) / `INFO` (suggestion for improvement)',
      '',
      '**4. Detailed Explanation** — 3-5 sentences explaining:',
      '   - What the code is doing',
      '   - Why it is a problem (with specific scenario or edge case)',
      '   - What the potential impact is (crash, security breach, performance degradation, maintenance burden)',
      '',
      '**5. Current Code** — Show the problematic code snippet (with line numbers)',
      '',
      '**6. Recommended Fix** — Show the corrected code with clear before/after diff. Include imports and surrounding context if needed.',
      '',
      '**7. Effort Estimate** — `Minutes` / `Hours` / `Days`',
      '',
      'If NO issues are found in a dimension, write a brief statement confirming the code looks solid in that area.',
      '',
      '=== LANGUAGE-SPECIFIC GUIDELINES ===',
      '- **TypeScript/JavaScript**: Prefer `const` over `let`, avoid `any`, use explicit return types on public functions, prefer async/await over raw promises, use optional chaining and nullish coalescing',
      '- **Python**: Use type hints, prefer list comprehensions over map/filter, use context managers for resources, avoid mutable default arguments',
      '- **React/JSX**: Use hooks correctly (dependency arrays, rules of hooks), avoid inline functions in render where possible, use React.memo strategically',
      '- **CSS/Tailwind**: Avoid !important, prefer utility classes over custom CSS, keep specificity low',
      '',
      '=== RESPONSE FORMAT ===',
      'Use this EXACT structure (with these exact ### headers):',
      '',
      '### REVIEW SCORE',
      '[Score: 0-100 with rationale]',
      '',
      '### EXECUTIVE SUMMARY',
      '[A 5-7 sentence overview covering: overall quality, most critical findings, codebase strengths, key risks, and recommended immediate actions]',
      '',
      '### CORRECTNESS & BUGS',
      '#### Issue 1: [Title]',
      '- **Location**: File:line',
      '- **Severity**: CRITICAL/MAJOR/MINOR/INFO',
      '- **Explanation**: [3-5 sentence detailed analysis]',
      '- **Current Code**:',
      '  ```typescript',
      '  [problematic code]',
      '  ```',
      '- **Recommended Fix**:',
      '  ```typescript',
      '  [fixed code]',
      '  ```',
      '- **Effort**: Minutes/Hours/Days',
      '',
      '#### Issue 2: [Title]',
      '...',
      '',
      '### SECURITY',
      '[Same format as above]',
      '',
      '### PERFORMANCE',
      '[Same format as above]',
      '',
      '### MAINTAINABILITY & CODE QUALITY',
      '[Same format as above]',
      '',
      '### ARCHITECTURE & DESIGN',
      '[Same format as above]',
      '',
      '### TYPE SAFETY & ERROR HANDLING',
      '[Same format as above]',
      '',
      '### TESTABILITY & DOCUMENTATION',
      '[Same format as above]',
      '',
      '### TOP RECOMMENDATIONS',
      '[Top 3-5 most important actions ranked by impact]',
      '',
      '### FIXED VERSION (Most Critical File)',
      '```typescript',
      '[Complete refactored file for the file with the most critical issues, showing all fixes applied]',
      '```',
      '',
      '---',
      'IMPORTANT:',
      '- ALWAYS wrap code in language-annotated fenced blocks (```language)',
      '- Be thorough — a good review finds 5-15 issues per file',
      '- Be specific — reference exact variable names, function names, and line numbers',
      '- Show actual code fixes, not just descriptions',
      '- If a dimension truly has no issues, write "No significant issues found in this category"',
      '- Focus on what matters — prioritize correctness, security, and performance over style',
    ].join('\n');
  }

  private buildReviewPrompt(codeBlock: string, fileCount: number, totalLines: number): string {
    return [
      '## Code to Review',
      '',
      '**Files:** ' + fileCount + ' | **Total Lines:** ' + totalLines,
      '',
      codeBlock,
      '',
      '---',
      '',
      'Please provide a **deep, detailed, line-by-line code review** following the EXACT structure specified in the system instructions.',
      '',
      'For EVERY issue you find, include:',
      '1. The problematic code snippet (with line numbers)',
      '2. A detailed explanation of WHY it is a problem (3-5 sentences)',
      '3. The exact corrected code as a before/after diff',
      '4. Severity and effort estimate',
      '',
      'Focus on issues that matter — bugs, security holes, performance bottlenecks, and maintainability problems.',
      'Show actual fixed code, not just descriptions.',
      '',
      'Start your response with "### REVIEW SCORE".',
    ].join('\n');
  }

  private parseReviewResponse(response: string, files: { file: IIndexedFile; content: string }[]): ReviewResult {
    const defaultCategory = (): ReviewCategory => ({ issues: [], score: 100, summary: 'No issues detected' });

    const parseCategory = (sectionName: string, type: ReviewIssue['type']): ReviewCategory => {
      const section = this.extractSection(response, sectionName);
      if (!section) return defaultCategory();

      // Try parsing the new detailed format first (#### Issue N: ...)
      let issues = this.parseIssuesDetailed(section, type, files);

      // Fall back to old table format if no issues found via detailed parsing
      if (issues.length === 0) {
        issues = this.parseIssuesTable(section, type, files);
      }

      const score = this.calculateCategoryScore(issues);
      const summary = issues.length > 0
        ? 'Found ' + issues.length + ' ' + type.replace('_', ' ') + ' issue(s)'
        : this.extractSection(section, '')?.split('\n')[0]?.trim() || 'No issues detected';

      return { issues, score, summary };
    };

    // Map section names to types, ACCUMULATING issues from all matching sections
    const categoryIssues: Record<string, ReviewIssue[]> = { bug: [], security: [], performance: [], code_smell: [], solid_violation: [] };

    for (const mapping of SECTION_MAPPINGS) {
      const section = this.extractSection(response, mapping.sectionName);
      if (!section) continue;

      // Try parsing the new detailed format first, fall back to old table format
      let issues = this.parseIssuesDetailed(section, mapping.type, files);
      if (issues.length === 0) {
        issues = this.parseIssuesTable(section, mapping.type, files);
      }

      if (issues.length > 0) {
        categoryIssues[mapping.type].push(...issues);
      }
    }

    const buildCategory = (type: ReviewIssue['type'], issues: ReviewIssue[]): ReviewCategory => {
      const score = this.calculateCategoryScore(issues);
      const summary = issues.length > 0
        ? 'Found ' + issues.length + ' ' + type.replace('_', ' ') + ' issue(s)'
        : 'No issues detected';
      return { issues, score, summary };
    };

    const bugs = buildCategory('bug', categoryIssues['bug']);
    const security = buildCategory('security', categoryIssues['security']);
    const performance = buildCategory('performance', categoryIssues['performance']);
    const codeSmells = buildCategory('code_smell', categoryIssues['code_smell']);
    const solidViolations = buildCategory('solid_violation', categoryIssues['solid_violation']);

    const allIssues = [...bugs.issues, ...security.issues, ...performance.issues, ...codeSmells.issues, ...solidViolations.issues];
    const totalIssues = allIssues.length;

    const scoreMatch = response.match(/(?:Score|score)[:\s]+(\d+)/);
    const parsedScore = scoreMatch ? parseInt(scoreMatch[1]!, 10) : null;
    const score = parsedScore !== null ? Math.max(0, Math.min(100, parsedScore)) : Math.round(
      (bugs.score + security.score + performance.score + codeSmells.score + solidViolations.score) / 5
    );

    const summarySection = this.extractSection(response, 'EXECUTIVE SUMMARY') ||
      this.extractSection(response, 'SUMMARY');
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
    if (!sectionName) return text;
    const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('###\\s*' + escaped + '\\s*([\\s\\S]*?)(?=###\\s|$)', 'i');
    const match = text.match(pattern);
    return match ? match[1]!.trim() : '';
  }

  /**
   * Parse issues from the new detailed format:
   * #### Issue 1: Title
   * - **Location**: File:line
   * - **Severity**: CRITICAL
   * - **Explanation**: ...
   * - **Current Code**: ```...```
   * - **Recommended Fix**: ```...```
   * - **Effort**: ...
   */
  private parseIssuesDetailed(
    section: string,
    type: ReviewIssue['type'],
    files: { file: IIndexedFile; content: string }[],
  ): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    // Split by "#### Issue" headers (handles both "Issue 1:" and "Issue #1:")
    const issueBlocks = section.split(/(?=####\s+Issue\s+#?\d+)/i);

    for (const block of issueBlocks) {
      const trimmed = block.trim();
      if (!trimmed || !trimmed.match(/####\s+Issue\s+#?\d+/i)) continue;

      // Extract title from "#### Issue 1: Title" or "#### Issue #1: Title"
      const titleMatch = trimmed.match(/####\s+Issue\s+#?\d+:\s*(.+)/i);
      const message = titleMatch ? titleMatch[1]!.trim() : '';

      // Extract location
      const locationMatch = trimmed.match(/-\s*\*\*Location\*\*:\s*([^\n]+)/i);
      const locationStr = locationMatch ? locationMatch[1]!.trim() : '';

      let filePath = '';
      let lineNum = 0;
      if (locationStr) {
        // Try "File:line" or "File (line N)" or just "File"
        const fileLineMatch = locationStr.match(/([^:]+)(?::(\d+))?/);
        if (fileLineMatch) {
          filePath = fileLineMatch[1]!.trim();
          if (fileLineMatch[2]) {
            lineNum = parseInt(fileLineMatch[2]!, 10);
          }
        }
      }

      // Match file to known files
      const matchedFile = files.find((f) =>
        f.file.path.toLowerCase().includes(filePath.toLowerCase()) ||
        filePath.toLowerCase().includes(f.file.name?.toLowerCase() || '')
      );
      const resolvedPath = matchedFile ? matchedFile.file.path : filePath;

      // Extract severity
      const severityMatch = trimmed.match(/-\s*\*\*Severity\*\*:\s*(\w+)/i);
      const severityStr = severityMatch ? severityMatch[1]!.toLowerCase() : 'minor';
      if (!['critical', 'major', 'minor', 'info'].includes(severityStr)) continue;

      // Extract explanation (everything between "**Explanation**:" and the next field or code block)
      const explanationMatch = trimmed.match(/-\s*\*\*Explanation\*\*:\s*([\s\S]*?)(?=-\s*\*\*(Current Code|Recommended Fix|Effort)\*\*)/i);
      const explanation = explanationMatch ? explanationMatch[1]!.trim() : '';

      // Extract current code block (from code block after "Current Code")
      let currentCodeBlock = '';
      const currentCodeMatch = trimmed.match(/-\s*\*\*Current Code\*\*:\s*\n*```[\s\S]*?```/i);
      if (currentCodeMatch) {
        currentCodeBlock = currentCodeMatch[0]!.trim();
      }

      // Extract recommended fix code block (from code block after "Recommended Fix")
      let recommendation = '';
      const fixCodeMatch = trimmed.match(/-\s*\*\*Recommended Fix\*\*:\s*\n*```[\s\S]*?```/i);
      if (fixCodeMatch) {
        recommendation = fixCodeMatch[0]!.trim();
      }

      // Fallback to all code blocks if specific extraction failed
      if (!recommendation) {
        const allCodeBlocks = trimmed.match(/```[\s\S]*?```/g);
        if (allCodeBlocks && allCodeBlocks.length >= 2) {
          recommendation = '**Current:**\n' + allCodeBlocks[0]! + '\n**Fixed:**\n' + allCodeBlocks[1]!;
        } else if (allCodeBlocks && allCodeBlocks.length === 1) {
          recommendation = allCodeBlocks[0]!;
        } else {
          // Try to extract the text content after "Recommended Fix"
          const fixText = trimmed.match(/-\s*\*\*Recommended Fix\*\*:\s*([\s\S]*?)(?=-\s*\*\*Effort\b|\n\n####|\n\n###|$)/i);
          if (fixText) {
            recommendation = fixText[1]!.trim();
          }
        }
      }

      // Combine current code + fix for the recommendation field (so user sees before/after)
      if (currentCodeBlock && recommendation) {
        recommendation = currentCodeBlock + '\n\n**Fixed:**\n' + recommendation.replace(/^-\s*\*\*Recommended Fix\*\*:\s*/i, '').trim();
      }

      issues.push({
        type,
        severity: severityStr as ReviewIssue['severity'],
        file: resolvedPath || 'unknown',
        line: isNaN(lineNum) ? 0 : lineNum,
        message: message || 'Issue found',
        explanation,
        recommendation: recommendation || 'See recommended fix above',
      });
    }

    return issues;
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
        fileHint.toLowerCase().includes(f.file.name?.toLowerCase() || '')
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

    // Try extracting from TOP RECOMMENDATIONS section (new format)
    const topRecSection = this.extractSection(response, 'TOP RECOMMENDATIONS');
    if (topRecSection) {
      // Parse numbered recommendations
      const lines = topRecSection.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        const priorityMatch = trimmed.match(/^\d+\.\s*\*\*(.+?)\*\*/);
        if (priorityMatch) {
          suggestions.push({
            priority: 'medium',
            file: '',
            line: 0,
            title: priorityMatch[1]!.trim(),
            description: trimmed.replace(/^\d+\.\s*\*\*.+?\*\*\s*/, '').trim(),
            estimatedEffort: '',
          });
        }
      }
    }

    // Also try REFACTORING SUGGESTIONS section (old format with table)
    const section = this.extractSection(response, 'REFACTORING SUGGESTIONS');
    if (section) {
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
          fileHint.toLowerCase().includes(f.file.name?.toLowerCase() || '')
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
    }

    return suggestions;
  }

  private extractFixedCode(response: string): string {
    const section = this.extractSection(response, 'FIXED VERSION');
    if (!section) return '';

    const codeMatch = section.match(/```[\s\S]*?```/);
    return codeMatch ? codeMatch[0] : section;
  }

  private fallbackReview(reason?: string): ReviewResult {
    const detail = reason ? ' Reason: ' + reason.slice(0, 300) : '';
    return {
      score: 50,
      summary: 'AI review was unavailable. Returning a neutral score. Please try again later.' + detail,
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
