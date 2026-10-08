import mongoose, { Document, Schema } from 'mongoose';

/**
 * One record per (user, operation, idempotency key). The unique index is what
 * makes concurrent duplicate requests safe: only one insert can win, so a
 * second in-flight request is rejected instead of executing the mutation again.
 *
 * Records are auto-expired after 24h so the collection does not grow forever.
 */
export interface IIdempotencyRecord extends Document {
  userId: mongoose.Types.ObjectId;
  operation: string;
  key: string;
  status: 'pending' | 'completed';
  statusCode: number;
  response: unknown;
  createdAt: Date;
}

const idempotencyRecordSchema = new Schema<IIdempotencyRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    operation: { type: String, required: true, maxlength: 100 },
    key: { type: String, required: true, maxlength: 200 },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    statusCode: { type: Number, default: 200 },
    response: { type: Schema.Types.Mixed, default: null },
    // TTL: MongoDB removes the record 24h after creation.
    createdAt: { type: Date, default: Date.now, expires: 86400 },
  },
  { versionKey: false },
);

// Scope every key to its user AND operation so User A's key cannot collide
// with User B's, and the same key used on two operations stays independent.
idempotencyRecordSchema.index({ userId: 1, operation: 1, key: 1 }, { unique: true });

const IdempotencyRecord = mongoose.model<IIdempotencyRecord>('IdempotencyRecord', idempotencyRecordSchema);
export default IdempotencyRecord;
