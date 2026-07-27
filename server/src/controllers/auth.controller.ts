import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated, ApiError } from '../utils/apiResponse';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/',
} as const;

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const { name, email, username, password } = req.body;
    const { user } = await authService.register({ name, email, username, password });

    sendCreated(res, {
      message: 'Registration successful. Please check your email to verify your account.',
      data: { userId: user.id, email: user.email },
    });
  }

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.login(email, password);

    // Set HttpOnly cookie — refreshToken is NOT returned in response body
    // to prevent XSS from stealing the long-lived token
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Login successful',
      data: {
        user,
        accessToken,
      },
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    await authService.logout(req.user!.userId);

    res.clearCookie('refreshToken', { path: '/' });

    sendSuccess(res, {
      statusCode: 200,
      message: 'Logged out successfully',
    });
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    const token = req.body.refreshToken || req.cookies?.refreshToken;

    if (!token) {
      throw new ApiError(401, 'Refresh token is required');
    }

    const { user, accessToken, refreshToken } = await authService.refreshAccessToken(token);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Token refreshed successfully',
      data: { accessToken, user },
    });
  }

  async getMe(req: Request, res: Response): Promise<void> {
    const user = await authService.getProfile(req.user!.userId);

    sendSuccess(res, {
      statusCode: 200,
      message: 'User profile retrieved',
      data: { user },
    });
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);

    res.clearCookie('refreshToken', { path: '/' });

    sendSuccess(res, {
      statusCode: 200,
      message: 'Password changed successfully. Please log in again.',
    });
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body;
    await authService.forgotPassword(email);

    sendSuccess(res, {
      statusCode: 200,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { token, password } = req.body;
    await authService.resetPassword(token, password);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Password reset successful. You can now log in with your new password.',
    });
  }

  async verifyEmail(req: Request, res: Response): Promise<void> {
    const { token } = req.params;
    await authService.verifyEmail(token);

    sendSuccess(res, {
      statusCode: 200,
      message: 'Email verified successfully.',
    });
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    const { name, username, bio } = req.body;
    const user = await authService.updateProfile(req.user!.userId, { name, username, bio });

    sendSuccess(res, {
      statusCode: 200,
      message: 'Profile updated successfully',
      data: { user },
    });
  }
}

export const authController = new AuthController();
