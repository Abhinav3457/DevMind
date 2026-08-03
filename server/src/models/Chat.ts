import mongoose, { Document, Schema } from 'mongoose';

export interface IChat extends Document {
  title: string;
  participants: mongoose.Types.ObjectId[];
  type: 'ai';
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>(
  {
    title: { type: String, default: '', maxlength: 200 },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    type: { type: String, enum: ['ai'], default: 'ai', index: true },
    lastMessage: { type: String, maxlength: 500 },
    lastMessageAt: { type: Date },
  },
  { timestamps: true },
);

chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });

const Chat = mongoose.model<IChat>('Chat', chatSchema);
export default Chat;
