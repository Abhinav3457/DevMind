import crypto from 'crypto';
import User, { IUser } from '../models/User';
import { ApiError } from '../utils/apiResponse';
import { sendVerificationEmail, sendPasswordResetEmail } from '../helpers/email.helper';
import jwt from 'jsonwebtoken';
import { env } from '../config/environment';
import logger from '../utils/logger';

interface RegisterParams {
  name: string;
  email: string;
  username: string;
  password: string;
}

interface LoginResult {
  user: IUser;
  accessToken: string;
  refreshToken: string;
}

interface TokenPayload {
  userId: string;
  type?: string;
}

export class AuthService {
  async register(params: RegisterParams): Promise<{ user: IUser; verificationToken: string }> {
    const { name, email, username, password } = params;

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw new ApiError(409, 'An account with this email already exists');
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      throw new ApiError(409, 'This username is already taken');
    }

    const user = await User.create({ name, email, username, password });
    const verificationToken = user.createVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email (fire-and-forget)
    sendVerificationEmail(user.email, user.name, verificationToken).catch((err) =>
      logger.error('Failed to send verification email:', err),
    );

    return { user, verificationToken };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    return { user, accessToken, refreshToken };
  }

  async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { refreshToken: null }, { validateBeforeSave: false });
  }

  async refreshAccessToken(token: string): Promise<LoginResult> {
    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
    } catch {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user || !user.refreshToken) {
      throw new ApiError(401, 'Refresh token not found. Please log in again.');
    }

    if (user.refreshToken !== token) {
      // Potential token reuse detected. Invalidate all tokens.
      user.refreshToken = undefined;
      await user.save({ validateBeforeSave: false });
      throw new ApiError(401, 'Token reuse detected. Please log in again.');
    }

    const accessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    return { user, accessToken, refreshToken: newRefreshToken };
  }

  async getProfile(userId: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new ApiError(400, 'Current password is incorrect');
    }

    user.password = newPassword;
    user.refreshToken = undefined;
    await user.save();
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal whether the email exists
      return;
    }

    const resetToken = user.createResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    sendPasswordResetEmail(user.email, user.name, resetToken).catch((err) =>
      logger.error('Failed to send password reset email:', err),
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new ApiError(400, 'Invalid or expired reset token');
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshToken = undefined;
    await user.save();
  }

  async verifyEmail(token: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new ApiError(400, 'Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });
  }

  async updateProfile(
    userId: string,
    updates: { name?: string; username?: string; bio?: string },
  ): Promise<IUser> {
    if (updates.username) {
      const existing = await User.findOne({
        username: updates.username,
        _id: { $ne: userId },
      });
      if (existing) {
        throw new ApiError(409, 'This username is already taken');
      }
    }

    const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    return user;
  }
}

export const authService = new AuthService();
