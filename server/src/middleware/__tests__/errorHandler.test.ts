import { describe, it, expect, vi, beforeEach } from 'vitest';
import { globalErrorHandler } from '../errorHandler';
import { ApiError } from '../../utils/apiResponse';

vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function createMockRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as never;
}

const req = {} as never;
const next = vi.fn();

describe('globalErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes an ApiError status and message through to the client', () => {
    const res = createMockRes();
    globalErrorHandler(new ApiError(404, 'Not found'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Not found' }),
    );
  });

  it('never echoes a raw unexpected error message (secrets/tokens/internal hosts)', () => {
    const res = createMockRes();
    globalErrorHandler(
      new Error('connect ECONNREFUSED internal-host:5432 token=sk-secret-123'),
      req,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    const body = vi.mocked(res.json).mock.calls[0]?.[0] as { message: string };
    expect(body.message).toBe('Internal Server Error');
    expect(body.message).not.toContain('internal-host');
    expect(body.message).not.toContain('sk-secret-123');
  });

  it('maps a Mongoose CastError to a safe 400', () => {
    const res = createMockRes();
    const err = new Error('Cast to ObjectId failed for value "xyz"');
    err.name = 'CastError';
    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Invalid resource identifier' }),
    );
  });
});
