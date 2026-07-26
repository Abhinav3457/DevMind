import mongoose, { Document, Schema } from 'mongoose';

export interface IOAuthState extends Document {
  state: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const oAuthStateSchema = new Schema<IOAuthState>(
  {
    state: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
);

const OAuthState = mongoose.model<IOAuthState>('OAuthState', oAuthStateSchema);
export default OAuthState;
