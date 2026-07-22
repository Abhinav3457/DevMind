import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authController } from '../controllers/auth.controller';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validator';

const router = Router();

// @route   POST /api/v1/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validate({ body: registerSchema }), asyncHandler(authController.register));

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validate({ body: loginSchema }), asyncHandler(authController.login));

// @route   POST /api/v1/auth/logout
// @desc    Logout user and invalidate refresh token
// @access  Private
router.post('/logout', authenticate, asyncHandler(authController.logout));

// @route   POST /api/v1/auth/refresh-token
// @desc    Get a new access token using a refresh token
// @access  Public (uses refresh token)
router.post(
  '/refresh-token',
  asyncHandler(authController.refreshToken),
);

// @route   GET /api/v1/auth/me
// @desc    Get current authenticated user's profile
// @access  Private
router.get('/me', authenticate, asyncHandler(authController.getMe));

// @route   PATCH /api/v1/auth/change-password
// @desc    Change password for authenticated user
// @access  Private
router.patch(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  asyncHandler(authController.changePassword),
);

// @route   POST /api/v1/auth/forgot-password
// @desc    Request a password reset email
// @access  Public
router.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema }),
  asyncHandler(authController.forgotPassword),
);

// @route   POST /api/v1/auth/reset-password
// @desc    Reset password using reset token
// @access  Public
router.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  asyncHandler(authController.resetPassword),
);

// @route   GET /api/v1/auth/verify-email/:token
// @desc    Verify email address using verification token
// @access  Public
router.get('/verify-email/:token', asyncHandler(authController.verifyEmail));

// @route   PATCH /api/v1/auth/profile
// @desc    Update user profile (name, username, bio)
// @access  Private
router.patch(
  '/profile',
  authenticate,
  validate({ body: updateProfileSchema }),
  asyncHandler(authController.updateProfile),
);

export default router;
