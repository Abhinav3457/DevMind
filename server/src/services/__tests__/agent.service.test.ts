import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../agent.service';

const { mockAgentRun, mockIndexReport, mockImportedRepo, mockEngine } = vi.hoisted(() => ({
  mockAgentRun: { create: vi.fn(), findOne: vi.fn(), find: vi.fn(), deleteOne: vi.fn(), updateMany: vi.fn() },
  mockIndexReport: { findOne: vi.fn() },
  mockImportedRepo: { findById: vi.fn() },
  mockEngine: { runAgent: vi.fn() },
}));

vi.mock('../../models/AgentRun', () => ({ default: mockAgentRun }));
vi.mock('../../models/IndexReport', () => ({ default: mockIndexReport }));
vi.mock('../../models/ImportedRepository', () => ({ default: mockImportedRepo }));
vi.mock('../../agent/agent-engine.service', () => ({ agentEngineService: mockEngine }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    service = new AgentService();
    vi.clearAllMocks();
    mockEngine.runAgent.mockResolvedValue(undefined);
    mockAgentRun.updateMany.mockResolvedValue({ modifiedCount: 0 });
    // createRun chains .select().lean() on its active-run lookup
    mockAgentRun.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });
  });

  it('creates a run and kicks off the engine in the background', async () => {
    mockIndexReport.findOne.mockResolvedValue({ _id: 'r1', status: 'completed', repositoryId: 'repo-1' });
    mockImportedRepo.findById.mockReturnValue({ select: () => ({ lean: async () => ({ fullName: 'acme/app' }) }) });
    mockAgentRun.create.mockResolvedValue({ _id: 'run-1' });

    const run = await service.createRun('u1', 'r1', 'Fix the login bug please');
    expect(run).toEqual({ _id: 'run-1' });
    expect(mockAgentRun.create).toHaveBeenCalled();
    expect(mockAgentRun.create.mock.calls[0]![0]).toMatchObject({ userId: 'u1', reportId: 'r1', repoName: 'acme/app', task: 'Fix the login bug please' });
    expect(mockEngine.runAgent).toHaveBeenCalledWith('run-1');
  });

  it('rejects when the user already has an active run', async () => {
    mockAgentRun.findOne.mockReturnValueOnce({ select: () => ({ lean: async () => ({ _id: 'active-run' }) }) });
    await expect(service.createRun('u1', 'r1', 'Fix the login bug please')).rejects.toThrow('already in progress');
    expect(mockAgentRun.create).not.toHaveBeenCalled();
  });

  it('throws 404 when the report is not found', async () => {
    mockIndexReport.findOne.mockResolvedValue(null);
    await expect(service.createRun('u1', 'r1', 'Fix the login bug please')).rejects.toThrow('not found');
    expect(mockEngine.runAgent).not.toHaveBeenCalled();
  });

  it('throws 400 when the report is not completed', async () => {
    mockIndexReport.findOne.mockResolvedValue({ _id: 'r1', status: 'processing', repositoryId: 'repo-1' });
    await expect(service.createRun('u1', 'r1', 'Fix the login bug please')).rejects.toThrow('not completed');
  });

  it('recovers stale runs before listing', async () => {
    mockAgentRun.find.mockReturnValue({ sort: () => ({ limit: async () => [] }) });
    await service.listRuns('u1');
    expect(mockAgentRun.updateMany).toHaveBeenCalled();
    const filter = mockAgentRun.updateMany.mock.calls[0]![0] as Record<string, unknown>;
    expect(filter.status).toEqual({ $in: ['running', 'queued'] });
  });

  it('gets, lists, and deletes runs', async () => {
    mockAgentRun.findOne.mockResolvedValue({ _id: 'run-1' });
    expect(await service.getRun('run-1', 'u1')).toEqual({ _id: 'run-1' });
    mockAgentRun.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });

    mockAgentRun.find.mockReturnValue({ sort: () => ({ limit: async () => [{ _id: 'run-1' }] }) });
    expect(await service.listRuns('u1')).toHaveLength(1);

    mockAgentRun.deleteOne.mockResolvedValue({ deletedCount: 1 });
    expect(await service.deleteRun('run-1', 'u1')).toBe(true);
    mockAgentRun.deleteOne.mockResolvedValue({ deletedCount: 0 });
    expect(await service.deleteRun('run-1', 'u1')).toBe(false);
  });

  it('throws 404 when the run is missing', async () => {
    mockAgentRun.findOne.mockResolvedValue(null);
    await expect(service.getRun('x', 'u1')).rejects.toThrow('not found');
  });
});
