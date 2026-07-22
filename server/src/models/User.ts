import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/environment';

export interface IUser extends Document {
  name: string;
  email: string;
  username: string;
  password: string;
  avatar?: string;
  role: 'user' | 'admin';
  isEmailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  refreshToken?: string;
  passwordChangedAt?: Date;
  lastLoginAt?: Date;
  preferences: Record<string, unknown>;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAccessToken(): string;
  generateRefreshToken(): string;
  createVerificationToken(): string;
  createResetPasswordToken(): string;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: [1, 'Name must be at least 1 character'], maxlength: [100, 'Name cannot exceed 100 characters'] },
    email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true, maxlength: [255, 'Email cannot exceed 255 characters'], match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'] },
    username: { type: String, required: [true, 'Username is required'], unique: true, trim: true, minlength: [3, 'Username must be at least 3 characters'], maxlength: [30, 'Username cannot exceed 30 characters'], match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'] },
    password: { type: String, required: [true, 'Password is required'], minlength: [8, 'Password must be at least 8 characters'], maxlength: [128, 'Password cannot exceed 128 characters'], select: false },
    avatar: { type: String, default: null },
    role: { type: String, enum: { values: ['user', 'admin'], message: 'Role must be either "user" or "admin"' }, default: 'user' },
    isEmailVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    refreshToken: { type: String, select: false },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
    preferences: { type: Schema.Types.Mixed, default: {} },
    bio: { type: String, maxlength: [500, 'Bio cannot exceed 500 characters'] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc: Document, ret: Record<string, unknown>) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.verificationToken;
        delete ret.verificationTokenExpires;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        delete ret.__v;
        ret.id = (ret._id as string).toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

userSchema.index({ role: 1 });

// TTL index to auto-delete expired verification tokens after 24h
userSchema.index({ verificationTokenExpires: 1 }, { expireAfterSeconds: 86400 });

// TTL index to auto-delete expired password reset tokens after 1h
userSchema.index({ resetPasswordExpires: 1 }, { expireAfterSeconds: 3600, partialFilterExpression: { resetPasswordExpires: { $exists: true } } });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = new Date();
    return next();
  } catch (error) {
    return next(error as Error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAccessToken = function (): string {
  return jwt.sign({ userId: this._id.toString(), email: this.email, role: this.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
};

userSchema.methods.generateRefreshToken = function (): string {
  return jwt.sign({ userId: this._id.toString(), type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
};

userSchema.methods.createVerificationToken = function (): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.verificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return token;
};

userSchema.methods.createResetPasswordToken = function (): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
  this.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  return token;
};

const User = mongoose.model<IUser>('User', userSchema);
export default User;
