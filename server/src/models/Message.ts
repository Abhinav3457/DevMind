import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  chatId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'code' | 'system' | 'ai';
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: [true, 'Message content is required'], maxlength: 10000 },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true, default: 'user' },
    type: { type: String, enum: ['text', 'code', 'system', 'ai'], default: 'text' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

messageSchema.index({ chatId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, createdAt: -1 });

const Message = mongoose.model<IMessage>('Message', messageSchema);
export default Message;
