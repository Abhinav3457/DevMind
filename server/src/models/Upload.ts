import mongoose, { Document, Schema } from 'mongoose';

export interface IUpload extends Document {
  userId: mongoose.Types.ObjectId;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  publicId: string;
  format?: string;
  width?: number;
  height?: number;
  folder: string;
  createdAt: Date;
  updatedAt: Date;
}

const uploadSchema = new Schema<IUpload>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    format: { type: String },
    width: { type: Number },
    height: { type: Number },
    folder: { type: String, default: 'devmind-ai' },
  },
  { timestamps: true },
);

uploadSchema.index({ userId: 1, createdAt: -1 });

const Upload = mongoose.model<IUpload>('Upload', uploadSchema);
export default Upload;
