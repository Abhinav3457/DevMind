import { generateFromAI } from '../config/ai';
import { SubmissionIssue, SubmissionStatus } from '../models/PracticeSubmission';
import logger from '../utils/logger';

/**
 * The judge accepts any problem description — a stored DevMind problem or a
 * live LeetCode question. LeetCode only exposes example *inputs*, so
 * `expectedOutput` is optional and the model derives it from the statement.
 */
export interface JudgeProblem {
  title: string;
  difficulty: string;
  category: string;
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  testCases: { input: string; expectedOutput?: string; hidden?: boolean }[];
  functionName?: string;
}

export interface JudgeResult {
  status: SubmissionStatus;
  score: number;
  passedTests: number;
  totalTests: number;
  timeComplexity: string;
  spaceComplexity: string;
  feedback: string;
  issues: SubmissionIssue[];
  betterApproach: string;
  improvedCode: string;
  durationMs: number;
}

const MAX_CODE_CHARS = 20000;

export class JudgeService {
  /**
   * Evaluate a candidate solution. There is no execution sandbox in DevMind,
   * so correctness is judged by reasoning over the test cases rather than by
   * running them. The prompt forces the model to work test-by-test in order,
   * which keeps the pass count grounded instead of hand-wavy.
   */
  async judge(problem: JudgeProblem, code: string, language: string): Promise<JudgeResult> {
    const start = Date.now();

    const trimmed = code.trim();
    if (trimmed.length < 10) {
      return this.buildResult({
        status: 'wrong_answer',
        score: 0,
        passedTests: 0,
        totalTests: problem.testCases.length,
        feedback: 'Your submission is empty or too short to evaluate.',
        issues: [{ severity: 'critical', message: 'No solution body found.', suggestion: 'Implement the requested function before submitting.' }],
        durationMs: Date.now() - start,
      });
    }

    const systemInstruction = [
      'You are a strict-but-fair technical interviewer and code judge.',
      'You evaluate a candidate solution against a fixed set of test cases.',
      'You CANNOT execute the code, so you must trace it by hand, carefully and honestly.',
      '',
      'Rules:',
      '- Test cases are given in order. For EACH one, mentally run the candidate code and decide PASS or FAIL.',
      '- passedTests MUST equal the number of test cases that genuinely pass. Never inflate it.',
      '- If the code does not compile / has a syntax error / references undefined variables, status is "wrong_answer".',
      '- If the code is plausibly correct but your confidence is low (ambiguous spec, missing edge case info), use "needs_review".',
      '- status is "accepted" only when ALL test cases (including hidden ones you can infer) pass.',
      '- Score 0-100 reflects correctness first, then efficiency and code quality.',
      '- Report the candidate\'s actual time and space complexity as Big-O.',
      '',
      'Respond with a SINGLE JSON object and NOTHING else. No markdown fences, no prose before or after.',
      'Schema:',
      '{',
      '  "status": "accepted" | "wrong_answer" | "needs_review",',
      '  "passedTests": number,',
      '  "totalTests": number,',
      '  "score": number,',
      '  "timeComplexity": string,',
      '  "spaceComplexity": string,',
      '  "feedback": string,',
      '  "issues": [{ "severity": "critical" | "major" | "minor", "message": string, "suggestion": string }],',
      '  "betterApproach": string,',
      '  "improvedCode": string',
      '}',
    ].join('\n');

    const prompt = this.buildPrompt(problem, trimmed, language);

    try {
      let raw = await generateFromAI({
        systemInstruction,
        prompt,
        temperature: 0.1,
        maxTokens: 4096,
      });

      if (!raw.trim()) {
        logger.warn('Judge: empty AI response, retrying once');
        raw = await generateFromAI({ systemInstruction, prompt, temperature: 0.1, maxTokens: 4096 });
      }

      const parsed = this.parseJudgeResponse(raw, problem);
      if (parsed) {
        return this.buildResult({ ...parsed, durationMs: Date.now() - start });
      }

      logger.warn('Judge: could not parse AI response, falling back');
      return this.buildResult({
        status: 'needs_review',
        score: 50,
        passedTests: 0,
        totalTests: problem.testCases.length,
        feedback: 'The judge could not produce a reliable verdict. Your code was saved — please review it manually or resubmit.',
        issues: [],
        durationMs: Date.now() - start,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('Judge: AI judgement failed', error);
      return this.buildResult({
        status: 'error',
        score: 0,
        passedTests: 0,
        totalTests: problem.testCases.length,
        feedback: 'The judge is unavailable right now. Please try again in a moment.',
        issues: [{ severity: 'minor', message: reason.slice(0, 200), suggestion: 'Retry the submission.' }],
        durationMs: Date.now() - start,
      });
    }
  }

  private buildPrompt(problem: JudgeProblem, code: string, language: string): string {
    const capped = code.length > MAX_CODE_CHARS ? code.slice(0, MAX_CODE_CHARS) + '\n// ... [truncated]' : code;

    const examples = problem.examples
      .map((e, i) => 'Example ' + (i + 1) + ':\n  Input:  ' + e.input + '\n  Output: ' + e.output)
      .join('\n');

    const testCases = problem.testCases
      .map((t, i) => (i + 1) + '. Input: ' + t.input + '  ->  Expected: ' +
        (t.expectedOutput || '(derive the correct output from the statement and examples)') +
        (t.hidden ? '  [hidden]' : ''))
      .join('\n');

    return [
      '## Problem: ' + problem.title + ' (' + problem.difficulty + ', ' + problem.category + ')',
      '',
      problem.description,
      '',
      '### Examples',
      examples,
      '',
      '### Test cases (evaluate EVERY one)',
      testCases,
      '',
      problem.functionName ? '### Function to implement\n`' + problem.functionName + '`' : '',
      '',
      '### Candidate solution (' + language + ')',
      '```' + language,
      capped,
      '```',
      '',
      'Trace the candidate code against each test case above and return the JSON verdict.',
    ].join('\n');
  }

  private parseJudgeResponse(raw: string, problem: JudgeProblem): Omit<JudgeResult, 'durationMs'> | null {
    const json = this.extractJson(raw);
    if (!json) return null;

    const totalTests = problem.testCases.length;
    const rawStatus = String(json.status || '').toLowerCase();
    const status: SubmissionStatus =
      rawStatus === 'accepted' || rawStatus === 'wrong_answer' || rawStatus === 'needs_review'
        ? (rawStatus as SubmissionStatus)
        : 'needs_review';

    const passed = this.clampInt(json.passedTests, 0, totalTests);
    const score = this.clampInt(json.score, 0, 100);

    return {
      status,
      score: score ?? 0,
      passedTests: passed ?? 0,
      totalTests,
      timeComplexity: this.str(json.timeComplexity, 'unknown'),
      spaceComplexity: this.str(json.spaceComplexity, 'unknown'),
      feedback: this.str(json.feedback, 'No feedback provided.'),
      issues: this.parseIssues(json.issues),
      betterApproach: this.str(json.betterApproach, ''),
      improvedCode: this.str(json.improvedCode, ''),
    };
  }

  private parseIssues(value: unknown): SubmissionIssue[] {
    if (!Array.isArray(value)) return [];
    const severities: SubmissionIssue['severity'][] = ['critical', 'major', 'minor'];
    return value
      .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
      .slice(0, 10)
      .map((i) => {
        const severity = String(i.severity || 'minor').toLowerCase() as SubmissionIssue['severity'];
        return {
          severity: severities.includes(severity) ? severity : 'minor',
          message: this.str(i.message, ''),
          suggestion: this.str(i.suggestion, ''),
        };
      })
      .filter((i) => i.message.length > 0);
  }

  /** Pull the first JSON object out of the model output, tolerating fences/prose. */
  private extractJson(text: string): Record<string, unknown> | null {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  private clampInt(value: unknown, min: number, max: number): number | null {
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (isNaN(n)) return null;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  private str(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private buildResult(result: {
    status: SubmissionStatus;
    score: number;
    passedTests: number;
    totalTests: number;
    feedback: string;
    issues: SubmissionIssue[];
    durationMs: number;
    timeComplexity?: string;
    spaceComplexity?: string;
    betterApproach?: string;
    improvedCode?: string;
  }): JudgeResult {
    return {
      status: result.status,
      score: result.score,
      passedTests: result.passedTests,
      totalTests: result.totalTests,
      timeComplexity: result.timeComplexity || 'unknown',
      spaceComplexity: result.spaceComplexity || 'unknown',
      feedback: result.feedback,
      issues: result.issues,
      betterApproach: result.betterApproach || '',
      improvedCode: result.improvedCode || '',
      durationMs: result.durationMs,
    };
  }
}

export const judgeService = new JudgeService();
