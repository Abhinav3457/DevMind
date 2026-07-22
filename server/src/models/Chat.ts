import mongoose, { Document, Schema } from 'mongoose';

export interface IChat extends Document {
  title: string;
  participants: mongoose.Types.ObjectId[];
  projectId?: mongoose.Types.ObjectId;
  workspaceId?: mongoose.Types.ObjectId;
  type: 'direct' | 'project' | 'ai';
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>(
  {
    title: { type: String, default: '', maxlength: 200 },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace' },
    type: { type: String, enum: ['direct', 'project', 'ai'], default: 'ai', index: true },
    lastMessage: { type: String, maxlength: 500 },
    lastMessageAt: { type: Date },
  },
  { timestamps: true },
);

chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });

const Chat = mongoose.model<IChat>('Chat', chatSchema);
export default Chat;
