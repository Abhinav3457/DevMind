import { Request, Response, NextFunction } from 'express';
import IdempotencyRecord from '../models/IdempotencyRecord';
import { ApiError } from '../utils/apiResponse';
import logger from '../utils/logger';

const MAX_KEY_LENGTH = 200;

function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 11000;
}

/**
 * Opt-in idempotency for expensive/duplicating mutations.
 *
 * Behaviour:
 * - No `Idempotency-Key` header → the request is untouched (existing behaviour).
 * - First request with a key → runs normally; a 2xx response is stored and
 *   replayed verbatim for any later request with the same
 *   (user, operation, key).
 * - Concurrent duplicate → the unique index prevents a second insert; the
 *   in-flight request gets 409 instead of executing the mutation twice.
 * - A failed (4xx/5xx) mutation releases the key so the client can retry.
 *
 * Keys are scoped by authenticated user AND operation name, so one user's key
 * can never affect another user and the same key on two routes stays separate.
 */
export function idempotency(operation: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header('Idempotency-Key');
    if (!key) {
      next();
      return;
    }

    if (key.length > MAX_KEY_LENGTH) {
      next(new ApiError(400, 'Idempotency-Key is too long (max ' + MAX_KEY_LENGTH + ' characters).'));
      return;
    }

    const userId = req.user!.userId;

    let record: { _id: unknown };
    try {
      record = await IdempotencyRecord.create({ userId, operation, key, status: 'pending' });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existing = await IdempotencyRecord.findOne({ userId, operation, key }).lean();
        if (existing && existing.status === 'completed') {
          // Replay the previously stored successful result.
          res.status(existing.statusCode || 200).json(existing.response);
          return;
        }
        // Another request with this key is still in flight.
        next(new ApiError(409, 'A request with this Idempotency-Key is already in progress.'));
        return;
      }
      next(error);
      return;
    }

    // Capture the outgoing response so a successful result can be replayed.
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const statusCode = res.statusCode;
      if (statusCode < 400) {
        void IdempotencyRecord.updateOne(
          { _id: record._id },
          { status: 'completed', statusCode, response: body },
        ).catch((err) => logger.error('Idempotency: failed to store response', err));
      } else {
        // The mutation failed — release the key so a retry can execute.
        void IdempotencyRecord.deleteOne({ _id: record._id }).catch((err) =>
          logger.error('Idempotency: failed to release key', err),
        );
      }
      return originalJson(body);
    }) as typeof res.json;

    next();
  };
}
