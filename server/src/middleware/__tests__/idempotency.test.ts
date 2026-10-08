import { describe, it, expect, vi, beforeEach } from 'vitest';
import { idempotency } from '../idempotency';
import { ApiError } from '../../utils/apiResponse';

const { mockCreate, mockFindOne, mockUpdateOne, mockDeleteOne } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindOne: vi.fn(),
  mockUpdateOne: vi.fn(),
  mockDeleteOne: vi.fn(),
}));

vi.mock('../../models/IdempotencyRecord', () => ({
  default: {
    create: mockCreate,
    findOne: mockFindOne,
    updateOne: mockUpdateOne,
    deleteOne: mockDeleteOne,
  },
}));

vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function createReq(userId = 'user-123', key?: string) {
  return {
    user: { userId },
    header: vi.fn((name: string) => (name === 'Idempotency-Key' ? key : undefined)),
  } as never;
}

function createRes() {
  const res: Record<string, unknown> = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => body);
  return res as never;
}

describe('idempotency middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateOne.mockResolvedValue({});
    mockDeleteOne.mockResolvedValue({});
  });

  it('preserves existing behaviour when no Idempotency-Key is provided', async () => {
    const next = vi.fn();

    await idempotency('op')(createReq('user-123'), createRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('executes the first request and stores the successful response', async () => {
    mockCreate.mockResolvedValue({ _id: 'rec-1' });
    const res = createRes();
    const next = vi.fn();

    await idempotency('op')(createReq('user-123', 'key-1'), res, next);

    expect(mockCreate).toHaveBeenCalledWith({
      userId: 'user-123',
      operation: 'op',
      key: 'key-1',
      status: 'pending',
    });
    expect(next).toHaveBeenCalledWith();

    // Simulate the handler responding successfully.
    (res as unknown as { status: (c: number) => void }).status(201);
    (res as unknown as { json: (b: unknown) => void }).json({ success: true, data: { ok: true } });

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: 'rec-1' },
      { status: 'completed', statusCode: 201, response: { success: true, data: { ok: true } } },
    );
  });

  it('does not execute twice for the same user + operation + key and replays the stored result', async () => {
    mockCreate.mockRejectedValue({ code: 11000 });
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        status: 'completed',
        statusCode: 200,
        response: { success: true, data: { replayed: true } },
      }),
    });
    const res = createRes();
    const next = vi.fn();

    await idempotency('op')(createReq('user-123', 'key-1'), res, next);

    expect(mockFindOne).toHaveBeenCalledWith({ userId: 'user-123', operation: 'op', key: 'key-1' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { replayed: true } });
    // The mutation handler must NOT run again.
    expect(next).not.toHaveBeenCalled();
  });

  it('treats the same key from a different user as independent', async () => {
    mockCreate.mockResolvedValue({ _id: 'rec-1' });
    const nextA = vi.fn();

    await idempotency('op')(createReq('user-A', 'shared-key'), createRes(), nextA);
    await idempotency('op')(createReq('user-B', 'shared-key'), createRes(), vi.fn());

    expect(mockCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: 'user-A', operation: 'op', key: 'shared-key' }),
    );
    expect(mockCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userId: 'user-B', operation: 'op', key: 'shared-key' }),
    );
    expect(nextA).toHaveBeenCalledWith();
  });

  it('treats the same key on a different operation as independent', async () => {
    mockCreate.mockResolvedValue({ _id: 'rec-1' });

    await idempotency('op.a')(createReq('user-123', 'k'), createRes(), vi.fn());
    await idempotency('op.b')(createReq('user-123', 'k'), createRes(), vi.fn());

    expect(mockCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ operation: 'op.a' }));
    expect(mockCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ operation: 'op.b' }));
  });

  it('rejects a concurrent duplicate while the first request is still in flight', async () => {
    mockCreate.mockRejectedValue({ code: 11000 });
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ status: 'pending' }),
    });
    const next = vi.fn();

    await idempotency('op')(createReq('user-123', 'key-1'), createRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]![0] as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(409);
  });

  it('releases the key when the mutation fails so it can be retried', async () => {
    mockCreate.mockResolvedValue({ _id: 'rec-1' });
    const res = createRes();

    await idempotency('op')(createReq('user-123', 'key-1'), res, vi.fn());

    (res as unknown as { status: (c: number) => void }).status(400);
    (res as unknown as { json: (b: unknown) => void }).json({ success: false, message: 'nope' });

    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: 'rec-1' });
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it('rejects an over-long key with 400 without touching the mutation', async () => {
    const next = vi.fn();

    await idempotency('op')(createReq('user-123', 'x'.repeat(201)), createRes(), next);

    expect(mockCreate).not.toHaveBeenCalled();
    const error = next.mock.calls[0]![0] as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(400);
  });
});
