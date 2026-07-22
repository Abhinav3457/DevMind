import mongoose, { Document, Schema } from 'mongoose';

export interface IIndexedChunk extends Document {
  reportId: mongoose.Types.ObjectId;
  fileId: mongoose.Types.ObjectId;
  index: number;
  content: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'section' | 'import_block' | 'exports_block';
  metadata: Record<string, unknown>;
  embedding: null;
  tokenCount: number;
  createdAt: Date;
}

const indexedChunkSchema = new Schema<IIndexedChunk>(
  {
    reportId: { type: Schema.Types.ObjectId, ref: 'IndexReport', required: true, index: true },
    fileId: { type: Schema.Types.ObjectId, ref: 'IndexedFile', required: true, index: true },
    index: { type: Number, required: true },
    content: { type: String, required: true },
    startLine: { type: Number, required: true },
    endLine: { type: Number, required: true },
    type: { type: String, enum: ['function', 'class', 'section', 'import_block', 'exports_block'], required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    embedding: { type: Schema.Types.Mixed, default: null },
    tokenCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { transform(_doc: Document, ret: Record<string, unknown>) { ret.id = (ret._id as string).toString(); delete ret._id; delete ret.__v; return ret; } } },
);

indexedChunkSchema.index({ reportId: 1, fileId: 1, index: 1 });

const IndexedChunk = mongoose.model<IIndexedChunk>('IndexedChunk', indexedChunkSchema);
export default IndexedChunk;
