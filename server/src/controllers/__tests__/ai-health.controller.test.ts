import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIHealthController } from '../ai-health.controller';

const { mockCheckAIHealth } = vi.hoisted(() => ({
  mockCheckAIHealth: vi.fn(),
}));

vi.mock('../../services/ai-health.service', () => ({
  checkAIHealth: mockCheckAIHealth,
}));

vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function createMockReq(query: Record<string, string> = {}) {
  return { query } as never;
}

function createMockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as never;
}

const healthyReport = {
  overall: 'all',
  ready: true,
  checkedAt: '2026-01-01T00:00:00.000Z',
  providers: [],
};

const unhealthyReport = {
  overall: 'none',
  ready: false,
  checkedAt: '2026-01-01T00:00:00.000Z',
  providers: [],
};

describe('AIHealthController', () => {
  let controller: AIHealthController;

  beforeEach(() => {
    controller = new AIHealthController();
    vi.resetAllMocks();
  });

  it('returns 200 with the health report by default', async () => {
    mockCheckAIHealth.mockResolvedValue(healthyReport);
    const res = createMockRes();

    await controller.check(createMockReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: healthyReport }),
    );
  });

  it('still returns 200 when providers are down unless strict is set', async () => {
    mockCheckAIHealth.mockResolvedValue(unhealthyReport);
    const res = createMockRes();

    await controller.check(createMockReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 503 in strict mode when no provider can serve a review', async () => {
    mockCheckAIHealth.mockResolvedValue(unhealthyReport);
    const res = createMockRes();

    await controller.check(createMockReq({ strict: '1' }), res);

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('returns 200 in strict mode when providers are healthy', async () => {
    mockCheckAIHealth.mockResolvedValue(healthyReport);
    const res = createMockRes();

    await controller.check(createMockReq({ strict: '1' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
