import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractJson } from '../json-utils';
import { AgentEngineService } from '../agent-engine.service';
import { IAgentSolution, IAgentPlanStep } from '../../models/AgentRun';

const { mockGenerateFromAI, mockTools, mockFindById } = vi.hoisted(() => ({
  mockGenerateFromAI: vi.fn(),
  mockTools: {
    getRepoInfo: vi.fn(),
    search: vi.fn(),
    readFile: vi.fn(),
    listFiles: vi.fn(),
  },
  mockFindById: vi.fn(),
}));

vi.mock('../../config/ai', () => ({ generateFromAI: mockGenerateFromAI }));
vi.mock('../codebase-tools.service', () => ({ codebaseToolsService: mockTools }));
vi.mock('../../models/AgentRun', () => ({ default: { findById: mockFindById } }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

interface FakeStepDoc {
  _id: string;
  tool: string;
  status: string;
  params: Record<string, unknown>;
  reasoning: string;
  result: string;
  error?: string;
  completedAt?: Date;
}

interface FakeRun {
  _id: string;
  status: string;
  reportId: { toString(): string };
  task: string;
  plan: IAgentPlanStep[];
  solution: IAgentSolution | null;
  error?: string;
  startedAt: Date | null;
  completedAt: Date | null;
  markModified: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  steps: {
    items: FakeStepDoc[];
    create(data: Record<string, unknown>): FakeStepDoc;
    push(d: FakeStepDoc): void;
    id(id: string): FakeStepDoc | undefined;
  };
}

function makeFakeRun(): FakeRun {
  const items: FakeStepDoc[] = [];
  let counter = 0;
  const steps = {
    items,
    create(data: Record<string, unknown>) {
      const doc: FakeStepDoc = { _id: 'step-' + (++counter), tool: '', status: 'running', params: {}, reasoning: '', result: '', ...data } as FakeStepDoc;
      return doc;
    },
    push(d: FakeStepDoc) { items.push(d); },
    id(id: string) { return items.find((i) => i._id === id); },
  };
  return {
    _id: 'run-1',
    status: 'queued',
    reportId: { toString: () => 'report-1' },
    task: 'Find and fix the bug in JWT generation',
    plan: [],
    steps,
    solution: null,
    startedAt: null,
    completedAt: null,
    markModified: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('parses JSON inside markdown fences', () => {
    const out = extractJson('Here you go:\n```json\n[{"tool":"search"}]\n```\nDone.');
    expect(Array.isArray(out)).toBe(true);
  });
  it('parses JSON embedded after prose', () => {
    expect(extractJson('Sure! The result is {"filePath":"a.ts"} thanks!')).toEqual({ filePath: 'a.ts' });
  });
  it('returns null for non-JSON', () => {
    expect(extractJson('no json here')).toBeNull();
  });
});

describe('AgentEngineService.runAgent', () => {
  let engine: AgentEngineService;

  beforeEach(() => {
    engine = new AgentEngineService();
    vi.clearAllMocks();
    mockGenerateFromAI
      .mockResolvedValueOnce(JSON.stringify([
        { tool: 'search', params: { query: 'jwt' }, action: 'Find JWT code' },
        { tool: 'read_file', params: { path: 'src/auth.ts' }, action: 'Read auth file' },
        { tool: 'analyze', params: { instruction: 'Analyze the auth flow' }, action: 'Analyze' },
        { tool: 'propose_change', params: { instruction: 'Propose a fix' }, action: 'Propose fix' },
      ]))
      .mockResolvedValueOnce('The token is generated without expiry validation.')
      .mockResolvedValueOnce(JSON.stringify({
        filePath: 'src/auth.ts', title: 'Add expiry check', reasoning: 'Prevents expired tokens', before: 'old', after: 'new',
      }))
      .mockResolvedValueOnce('## Summary\nFixed the JWT bug.');
    mockTools.getRepoInfo.mockResolvedValue({ summary: 'Auth service', techStack: '{}', folderStructure: '[]', fileCount: 10 });
    mockTools.search.mockResolvedValue([{ filePath: 'src/auth.ts', startLine: 1, endLine: 5, type: 'function', snippet: 'function signToken() {}' }]);
    mockTools.readFile.mockResolvedValue({ found: true, path: 'src/auth.ts', language: 'typescript', content: 'export function signToken() {}', closeMatches: [] });
  });

  it('runs plan -> steps -> synthesis and completes', async () => {
    const run = makeFakeRun();
    mockFindById.mockResolvedValue(run);
    await engine.runAgent('run-1');
    expect(run.status).toBe('completed');
    expect(run.plan).toHaveLength(4);
    expect(run.steps.items).toHaveLength(4);
    expect(run.steps.items.every((s) => s.status === 'completed')).toBe(true);
    expect(run.solution).not.toBeNull();
    expect(run.solution!.changes).toHaveLength(1);
    expect(run.solution!.changes[0]!.filePath).toBe('src/auth.ts');
  });

  it('falls back to a generic plan when the planner returns garbage', async () => {
    mockGenerateFromAI
      .mockReset()
      .mockResolvedValueOnce('Sorry, no JSON here.')
      .mockResolvedValueOnce('findings text')
      .mockResolvedValueOnce(JSON.stringify({ filePath: 'src/auth.ts', title: 'Fix', reasoning: 'r', before: 'b', after: 'a' }))
      .mockResolvedValueOnce('## Summary\nDone.');
    const run = makeFakeRun();
    mockFindById.mockResolvedValue(run);
    await engine.runAgent('run-1');
    expect(run.status).toBe('completed');
    expect(run.plan).toHaveLength(2);
    expect(run.plan[0]!.tool).toBe('analyze');
    expect(run.plan[1]!.tool).toBe('propose_change');
  });

  it('marks the run failed when the AI plan call throws', async () => {
    mockGenerateFromAI.mockReset().mockRejectedValueOnce(new Error('All AI providers failed'));
    const run = makeFakeRun();
    mockFindById.mockResolvedValue(run);
    await engine.runAgent('run-1');
    expect(run.status).toBe('failed');
    expect(run.error).toContain('All AI providers failed');
  });
});
