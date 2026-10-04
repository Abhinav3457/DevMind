import mongoose, { Document, Schema } from 'mongoose';

export interface IGeneratedDoc extends Document {
  userId: mongoose.Types.ObjectId;
  type: string;
  fileName: string;
  context: string;
  reportId?: mongoose.Types.ObjectId | null;
  content: string;
  createdAt: Date;
}

const generatedDocSchema = new Schema<IGeneratedDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    fileName: { type: String, default: '' },
    context: { type: String, default: '' },
    reportId: { type: Schema.Types.ObjectId, ref: 'IndexReport', default: null },
    content: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

generatedDocSchema.index({ userId: 1, createdAt: -1 });

const GeneratedDoc = mongoose.model<IGeneratedDoc>('GeneratedDoc', generatedDocSchema);
export default GeneratedDoc;
