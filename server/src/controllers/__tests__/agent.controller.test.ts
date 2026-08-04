import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentController } from '../agent.controller';

const { mockService } = vi.hoisted(() => ({
  mockService: { createRun: vi.fn(), getRun: vi.fn(), listRuns: vi.fn(), deleteRun: vi.fn() },
}));

const { mockSendSuccess, mockSendCreated } = vi.hoisted(() => ({
  mockSendSuccess: vi.fn(),
  mockSendCreated: vi.fn(),
}));

vi.mock('../../services/agent.service', () => ({ agentService: mockService }));
vi.mock('../../utils/apiResponse', () => ({
  sendSuccess: mockSendSuccess,
  sendCreated: mockSendCreated,
}));

function res() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

function req(overrides: Record<string, unknown> = {}) {
  return { body: {}, params: {}, query: {}, user: { userId: 'u1' }, ...overrides };
}

describe('AgentController', () => {
  let controller: AgentController;

  beforeEach(() => {
    controller = new AgentController();
    vi.clearAllMocks();
  });

  it('createRun delegates to the service and responds 201', async () => {
    mockService.createRun.mockResolvedValue({ id: 'run-1' });
    await controller.createRun(
      req({ body: { reportId: 'r1', task: 'Fix the bug' } }) as never,
      res() as never,
    );
    expect(mockService.createRun).toHaveBeenCalledWith('u1', 'r1', 'Fix the bug');
    expect(mockSendCreated).toHaveBeenCalled();
  });

  it('getRun delegates with the run id', async () => {
    mockService.getRun.mockResolvedValue({ id: 'run-1' });
    await controller.getRun(req({ params: { id: 'run-1' } }) as never, res() as never);
    expect(mockService.getRun).toHaveBeenCalledWith('run-1', 'u1');
    expect(mockSendSuccess).toHaveBeenCalled();
  });

  it('listRuns reads the limit query param', async () => {
    mockService.listRuns.mockResolvedValue([]);
    await controller.listRuns(req({ query: { limit: '5' } }) as never, res() as never);
    expect(mockService.listRuns).toHaveBeenCalledWith('u1', 5);
  });

  it('deleteRun responds 404 when nothing was deleted', async () => {
    mockService.deleteRun.mockResolvedValue(false);
    const response = res();
    await controller.deleteRun(req({ params: { id: 'run-1' } }) as never, response as never);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ success: false, message: 'Agent run not found' });
  });
});
