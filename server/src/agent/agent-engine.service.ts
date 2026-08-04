import AgentRun, { IAgentRun, IAgentStep, IAgentPlanStep, IAgentChange, AgentToolName } from '../models/AgentRun';
import { generateFromAI } from '../config/ai';
import { codebaseToolsService, RepoInfo } from './codebase-tools.service';
import { extractJson } from './json-utils';
import logger from '../utils/logger';

const MAX_PLAN_STEPS = 6;
const MAX_TRANSCRIPT_CHARS = 14000;
const MAX_STEP_RESULT_CHARS = 900;
const MAX_REASONING_CHARS = 300;

const NL = String.fromCharCode(10);

const TOOL_DOCS = [
  'Available tools:',
  '- search: { "query": "terms" } — full-text search across the codebase chunks. Returns matching code snippets with file paths and line numbers.',
  '- read_file: { "path": "src/app.ts" } — read the full content of a file (path may be partial, e.g. "app.ts" or "config/ai").',
  '- list_files: { "pattern": "src/routes" } — list files whose path contains the pattern.',
  '- analyze: { "instruction": "what to analyze" } — reason over everything gathered so far and produce findings.',
  '- propose_change: { "instruction": "what change to propose" } — propose a concrete code change for ONE file, outputting JSON { filePath, title, reasoning, before, after }.',
].join(NL);

interface StepOutcome {
  result: string;
  reasoning: string;
  change?: IAgentChange;
}

export class AgentEngineService {
  async runAgent(runId: string): Promise<void> {
    const run = await AgentRun.findById(runId);
    if (!run) return;
    run.status = 'running';
    run.startedAt = new Date();
    await run.save();

    try {
      const reportId = run.reportId.toString();
      const repoInfo = await codebaseToolsService.getRepoInfo(reportId);
      const transcriptParts: string[] = [];
      const changes: IAgentChange[] = [];

      // Phase 1 — plan
      const plan = await this.createPlan(run, repoInfo);
      run.plan = plan;
      await run.save();
      logger.info('Agent: run ' + runId + ' planned ' + plan.length + ' steps');

      // Phase 2 — execute each step, feeding prior tool output forward
      for (let i = 0; i < plan.length; i++) {
        const stepPlan = plan[i]!;
        const step = await this.startStep(run, i, stepPlan);
        const transcript = this.buildTranscript(transcriptParts);
        try {
          const outcome = await this.executeStep(reportId, run.task, stepPlan, transcript, repoInfo, changes);
          if (stepPlan.tool === 'propose_change' && outcome.change) {
            changes.push(outcome.change);
          }
          if (outcome.result) {
            transcriptParts.push(this.formatTranscriptEntry(stepPlan, outcome.result));
          }
          await this.completeStep(run, step._id.toString(), outcome.reasoning, outcome.result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn('Agent: step ' + (i + 1) + ' failed - ' + message.slice(0, 200));
          await this.failStep(run, step._id.toString(), message);
        }
      }

      // Phase 3 — synthesize the final solution report
      const solution = await this.synthesize(run, transcriptParts, changes, repoInfo);
      const fresh = await AgentRun.findById(runId);
      if (!fresh) return;
      fresh.solution = solution;
      fresh.status = 'completed';
      fresh.completedAt = new Date();
      await fresh.save();
      logger.info('Agent: run ' + runId + ' completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Agent: run ' + runId + ' failed - ' + message.slice(0, 300));
      const fresh = await AgentRun.findById(runId);
      if (fresh) {
        fresh.status = 'failed';
        fresh.error = message.slice(0, 500);
        fresh.completedAt = new Date();
        await fresh.save();
      }
    }
  }

  // ── Phase 1: plan ──────────────────────────────────────────────
  private async createPlan(run: IAgentRun, repoInfo: RepoInfo): Promise<IAgentPlanStep[]> {
    const systemInstruction = [
      "You are DevMind AI's autonomous coding agent. You plan how to solve a task against a user's indexed codebase.",
      'Respond ONLY with a JSON array of steps. No prose, no markdown.',
      'Each step: { "tool": "<name>", "params": { ... }, "action": "one-line human description" }.',
      TOOL_DOCS,
      'Rules:',
      '- At most ' + MAX_PLAN_STEPS + ' steps. Prefer the smallest number of steps that gets the job done.',
      '- Search or list files first, then read_file for the most relevant files, then analyze, then propose_change.',
      '- propose_change is the only step that records a code change; use it last, once per file to change.',
      '- Use file paths as they appear in the repository.',
      'Return ONLY the JSON array.',
    ].join(NL);

    const userPrompt = [
      '=== TASK ===',
      run.task,
      '',
      '=== REPOSITORY OVERVIEW ===',
      'Summary: ' + repoInfo.summary,
      'Tech stack: ' + repoInfo.techStack,
      'Folder structure: ' + repoInfo.folderStructure,
    ].join(NL);

    const raw = await generateFromAI({ systemInstruction, prompt: userPrompt, temperature: 0.2, maxTokens: 2048 });
    const parsed = extractJson<Array<Record<string, unknown>>>(raw);
    if (!Array.isArray(parsed)) {
      return this.fallbackPlan();
    }

    const allowedTools: AgentToolName[] = ['search', 'read_file', 'list_files', 'analyze', 'propose_change'];
    const steps: IAgentPlanStep[] = [];
    for (const item of parsed.slice(0, MAX_PLAN_STEPS)) {
      const tool = item.tool;
      if (typeof tool !== 'string' || !allowedTools.includes(tool as AgentToolName)) continue;
      const paramsRaw = item.params;
      const params = paramsRaw && typeof paramsRaw === 'object' && !Array.isArray(paramsRaw)
        ? (paramsRaw as Record<string, unknown>)
        : {};
      steps.push({
        action: typeof item.action === 'string' ? item.action.slice(0, 200) : '',
        tool: tool as AgentToolName,
        params,
      });
    }

    if (steps.length === 0) return this.fallbackPlan();
    return steps;
  }

  private fallbackPlan(): IAgentPlanStep[] {
    return [
      { action: 'Analyze the codebase for the task', tool: 'analyze', params: { instruction: 'Investigate the codebase evidence and explain what needs to change to solve the task.' } },
      { action: 'Propose the concrete code change', tool: 'propose_change', params: { instruction: 'Propose the concrete minimal change that solves the task.' } },
    ];
  }

  // ── Phase 2: execute a single step ─────────────────────────────
  private async executeStep(
    reportId: string,
    task: string,
    stepPlan: IAgentPlanStep,
    transcript: string,
    repoInfo: RepoInfo,
    changes: IAgentChange[],
  ): Promise<StepOutcome> {
    const params = stepPlan.params;
    switch (stepPlan.tool) {
      case 'search': {
        const query = typeof params.query === 'string' ? params.query : (params.terms as string) || '';
        const hits = await codebaseToolsService.search(reportId, query);
        if (hits.length === 0) return { result: 'No matches found for: ' + query, reasoning: '' };
        const result = hits
          .map((h) => 'File: ' + h.filePath + ' (Lines ' + h.startLine + '-' + h.endLine + ', ' + h.type + ')' + NL + h.snippet)
          .join(NL + NL);
        return { result, reasoning: '' };
      }
      case 'read_file': {
        const path = typeof params.path === 'string' ? params.path : (params.file as string) || '';
        const res = await codebaseToolsService.readFile(reportId, path);
        if (!res.found) {
          return {
            result: 'File not found: ' + path + (res.closeMatches.length ? NL + 'Close matches:' + NL + res.closeMatches.join(NL) : ''),
            reasoning: '',
          };
        }
        return { result: '=== ' + res.path + ' (' + res.language + ') ===' + NL + res.content, reasoning: '' };
      }
      case 'list_files': {
        const pattern = typeof params.pattern === 'string' ? params.pattern : (params.path as string) || '';
        const list = await codebaseToolsService.listFiles(reportId, pattern);
        return { result: list.length ? list.join(NL) : 'No files matched pattern: ' + pattern, reasoning: '' };
      }
      case 'analyze': {
        const instruction = typeof params.instruction === 'string' ? params.instruction : 'Analyze the codebase evidence for the task.';
        const result = await this.runAnalyze(task, instruction, transcript, repoInfo);
        return { result, reasoning: '' };
      }
      case 'propose_change': {
        const instruction = typeof params.instruction === 'string' ? params.instruction : 'Propose the concrete change that solves the task.';
        return this.runProposeChange(task, instruction, transcript, repoInfo, changes);
      }
      default:
        return { result: '', reasoning: '' };
    }
  }

  private async runAnalyze(task: string, instruction: string, transcript: string, repoInfo: RepoInfo): Promise<string> {
    const systemInstruction = [
      "You are DevMind AI's autonomous coding agent.",
      'Analyze the codebase evidence below and produce clear, concise findings for the given instruction.',
      'Reference exact file paths and line numbers. Be specific, technical, and actionable.',
      'Do NOT propose code changes here — that happens in a later step.',
    ].join(NL);
    const userPrompt = [
      '=== TASK ===',
      task,
      '',
      '=== INSTRUCTION ===',
      instruction,
      '',
      '=== REPOSITORY OVERVIEW ===',
      'Summary: ' + repoInfo.summary,
      'Tech stack: ' + repoInfo.techStack,
      'Folder structure: ' + repoInfo.folderStructure,
      '',
      '=== EVIDENCE GATHERED SO FAR ===',
      transcript || '(no evidence yet)',
    ].join(NL);
    const out = await generateFromAI({ systemInstruction, prompt: userPrompt, temperature: 0.3, maxTokens: 2048 });
    return out.trim();
  }

  private async runProposeChange(
    task: string,
    instruction: string,
    transcript: string,
    repoInfo: RepoInfo,
    changes: IAgentChange[],
  ): Promise<StepOutcome> {
    const systemInstruction = [
      "You are DevMind AI's autonomous coding agent. Propose one concrete, minimal code change for ONE file.",
      'Respond ONLY with a JSON object. No prose, no markdown:',
      '{ "filePath": "full path of the file to change", "title": "short title", "reasoning": "why this change solves the task", "before": "exact current code being replaced", "after": "the improved code" }',
      'Rules:',
      '- before must be the exact existing snippet from the evidence; after is its improved version.',
      '- Keep the change minimal and focused. Never invent files that do not appear in the evidence.',
      '- If the task does not require a code change, respond with: { "filePath": "", "title": "", "reasoning": "", "before": "", "after": "" }',
      'Return ONLY the JSON object.',
    ].join(NL);
    const userPrompt = [
      '=== TASK ===',
      task,
      '',
      '=== INSTRUCTION ===',
      instruction,
      '',
      '=== REPOSITORY OVERVIEW ===',
      'Summary: ' + repoInfo.summary,
      'Tech stack: ' + repoInfo.techStack,
      '',
      '=== EVIDENCE GATHERED SO FAR ===',
      transcript || '(no evidence yet)',
      '',
      '=== CHANGES PROPOSED SO FAR ===',
      JSON.stringify(changes, null, 2) || '[]',
    ].join(NL);
    const raw = await generateFromAI({ systemInstruction, prompt: userPrompt, temperature: 0.2, maxTokens: 2048 });
    const parsed = extractJson<Record<string, unknown>>(raw);

    if (!parsed || typeof parsed.filePath !== 'string' || !parsed.filePath.trim()) {
      return { result: 'No code change proposed (the agent determined none was needed).', reasoning: '' };
    }
    const change: IAgentChange = {
      filePath: parsed.filePath.slice(0, 300),
      title: typeof parsed.title === 'string' ? parsed.title.slice(0, 200) : '',
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 1000) : '',
      before: typeof parsed.before === 'string' ? parsed.before : '',
      after: typeof parsed.after === 'string' ? parsed.after : '',
    };
    return {
      result: 'Proposed change for ' + change.filePath + NL + change.title + NL + NL + change.reasoning,
      reasoning: '',
      change,
    };
  }

  // ── Phase 3: synthesize ────────────────────────────────────────
  private async synthesize(
    run: IAgentRun,
    transcriptParts: string[],
    changes: IAgentChange[],
    repoInfo: RepoInfo,
  ): Promise<{ summary: string; report: string; changes: IAgentChange[] }> {
    const systemInstruction = [
      "You are DevMind AI's autonomous coding agent. Write the final solution report for the user's task.",
      'Use markdown with these sections:',
      '## Summary — a short overview of the solution.',
      '## Root cause / Findings — what is wrong and why.',
      '## Proposed changes — for each change: file path, what changes and why.',
      '## Verification — how to test the change.',
      '## Risks & limitations — anything the user should know.',
      'Reference exact file paths throughout. Be concrete.',
    ].join(NL);
    const userPrompt = [
      '=== TASK ===',
      run.task,
      '',
      '=== REPOSITORY OVERVIEW ===',
      'Summary: ' + repoInfo.summary,
      'Tech stack: ' + repoInfo.techStack,
      '',
      '=== PROPOSED CHANGES (JSON) ===',
      JSON.stringify(changes, null, 2),
      '',
      '=== WORK TRANSCRIPT ===',
      transcriptParts.join(NL + NL).slice(-MAX_TRANSCRIPT_CHARS) || '(no work was completed)',
    ].join(NL);
    const report = (await generateFromAI({ systemInstruction, prompt: userPrompt, temperature: 0.3, maxTokens: 3072 })).trim();
    const firstLine = report.split(NL).find((l) => l.trim().length > 0 && !l.trim().startsWith('#'));
    return {
      summary: (firstLine || 'Solution generated for: ' + run.task).slice(0, 220),
      report,
      changes,
    };
  }

  // ── step persistence helpers ───────────────────────────────────
  private async startStep(run: IAgentRun, order: number, plan: IAgentPlanStep): Promise<IAgentStep> {
    const step = run.steps.create({
      order,
      tool: plan.tool,
      params: plan.params,
      reasoning: plan.action.slice(0, MAX_REASONING_CHARS),
      status: 'running',
      startedAt: new Date(),
    });
    run.steps.push(step);
    run.markModified('steps');
    await run.save();
    return step;
  }

  private async completeStep(run: IAgentRun, stepId: string, reasoning: string, result: string): Promise<void> {
    const step = run.steps.id(stepId);
    if (!step) return;
    step.status = 'completed';
    if (reasoning) step.reasoning = reasoning.slice(0, MAX_REASONING_CHARS);
    step.result = result.slice(0, MAX_STEP_RESULT_CHARS);
    step.completedAt = new Date();
    run.markModified('steps');
    await run.save();
  }

  private async failStep(run: IAgentRun, stepId: string, message: string): Promise<void> {
    const step = run.steps.id(stepId);
    if (!step) return;
    step.status = 'failed';
    step.error = message.slice(0, 300);
    step.completedAt = new Date();
    run.markModified('steps');
    await run.save();
  }

  private formatTranscriptEntry(stepPlan: IAgentPlanStep, result: string): string {
    return '--- STEP: ' + stepPlan.tool + ' ' + this.stringifyParams(stepPlan.params) + ' ---' + NL + result;
  }

  private stringifyParams(params: Record<string, unknown>): string {
    try {
      const s = JSON.stringify(params);
      return s && s.length > 150 ? s.slice(0, 150) + '...' : (s || '');
    } catch {
      return '';
    }
  }

  private buildTranscript(parts: string[]): string {
    const joined = parts.join(NL + NL);
    return joined.length > MAX_TRANSCRIPT_CHARS ? joined.slice(-MAX_TRANSCRIPT_CHARS) : joined;
  }
}

export const agentEngineService = new AgentEngineService();
