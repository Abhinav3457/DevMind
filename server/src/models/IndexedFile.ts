import mongoose, { Document, Schema } from 'mongoose';

export interface ICodeSymbol {
  name: string;
  startLine: number;
  endLine: number;
}

export interface IIndexedFile extends Document {
  reportId: mongoose.Types.ObjectId;
  path: string;
  name: string;
  language: string;
  size: number;
  functions: ICodeSymbol[];
  classes: ICodeSymbol[];
  imports: string[];
  exports: string[];
  dependencies: string[];
  createdAt: Date;
  updatedAt: Date;
}

const indexedFileSchema = new Schema<IIndexedFile>(
  {
    reportId: { type: Schema.Types.ObjectId, ref: 'IndexReport', required: true, index: true },
    path: { type: String, required: true },
    name: { type: String, required: true },
    language: { type: String, required: true },
    size: { type: Number, default: 0 },
    functions: [{ name: String, startLine: Number, endLine: Number }],
    classes: [{ name: String, startLine: Number, endLine: Number }],
    imports: { type: [String], default: [] },
    exports: { type: [String], default: [] },
    dependencies: { type: [String], default: [] },
  },
  { timestamps: true, toJSON: { transform(_doc: Document, ret: Record<string, unknown>) { ret.id = (ret._id as string).toString(); delete ret._id; delete ret.__v; return ret; } } },
);

indexedFileSchema.index({ reportId: 1, path: 1 }, { unique: true });
indexedFileSchema.index({ reportId: 1, language: 1 });

const IndexedFile = mongoose.model<IIndexedFile>('IndexedFile', indexedFileSchema);
export default IndexedFile;
