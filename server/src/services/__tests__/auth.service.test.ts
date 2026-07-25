import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth.service';
import { ApiError } from '../../utils/apiResponse';
import User from '../../models/User';

// ── Mock functions that survive hoisting (email helpers only) ───

const { mockSendVerificationEmail, mockSendPasswordResetEmail } = vi.hoisted(() => ({
  mockSendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  mockSendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock all dependencies ───────────────────────────────────────

vi.mock('../../models/User', () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../helpers/email.helper', () => ({
  sendVerificationEmail: mockSendVerificationEmail,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

vi.mock('jsonwebtoken', () => {
  const mockVerify = vi.fn();
  return {
    default: { verify: mockVerify },
    verify: mockVerify,
  };
});

vi.mock('../../utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Helper: create a mock user object ───────────────────────────

function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'user-123',
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    username: 'testuser',
    role: 'user',
    isEmailVerified: false,
    password: 'hashedPassword123',
    refreshToken: 'old-refresh-token',
    lastLoginAt: null,
    save: vi.fn().mockResolvedValue(true),
    comparePassword: vi.fn(),
    generateAccessToken: vi.fn().mockReturnValue('mock-access-token'),
    generateRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
    createVerificationToken: vi.fn().mockReturnValue('verification-token-abc'),
    createResetPasswordToken: vi.fn().mockReturnValue('reset-token-abc'),
    ...overrides,
  };
}

function mockFindByIdToUser(user: unknown) {
  vi.mocked(User.findById).mockReturnValue({
    select: vi.fn().mockResolvedValue(user),
  } as never);
}

/** Sets jwt.verify to return { userId: 'user-123' } — call at start of each test that needs jwt */
function mockJwtVerifyValid() {
  const jwtMod = { verify: vi.fn() };
  // We need to access the mocked jwt module to set verify
  // Since it's mocked, we import it which returns the factory's value
  // The verify function is shared via the factory closure
}

describe('AuthService', () => {
  let authService: AuthService;
  // Access the shared jwt.verify mock
  let jwtVerify: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    authService = new AuthService();
    // Reset ALL mock state (clears implementations, return values, call history)
    vi.resetAllMocks();
    // Re-apply Promise returns for email helpers (service calls .catch() on them)
    mockSendVerificationEmail.mockResolvedValue(undefined);
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    // Get a reference to the shared jwt.verify mock from the mocked module
    const jwtMod = await import('jsonwebtoken');
    jwtVerify = (jwtMod as unknown as { verify: ReturnType<typeof vi.fn> }).verify;
  });

  // ─── Register ─────────────────────────────────────────────────

  describe('register', () => {
    const registerParams = {
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      password: 'Password123!',
    };

    it('should register a new user successfully', async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);
      const mockUser = createMockUser();
      vi.mocked(User.create).mockResolvedValue(mockUser);

      const result = await authService.register(registerParams);

      expect(User.findOne).toHaveBeenCalledWith({ email: registerParams.email });
      expect(User.findOne).toHaveBeenCalledWith({ username: registerParams.username });
      expect(User.create).toHaveBeenCalledWith({
        name: registerParams.name,
        email: registerParams.email,
        username: registerParams.username,
        password: registerParams.password,
      });
      expect(mockUser.createVerificationToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
      expect(mockSendVerificationEmail).toHaveBeenCalledWith(
        mockUser.email, mockUser.name, 'verification-token-abc',
      );
      expect(result.verificationToken).toBe('verification-token-abc');
    });

    it('should throw 409 if email already exists', async () => {
      vi.mocked(User.findOne).mockResolvedValue(createMockUser());

      await expect(authService.register(registerParams)).rejects.toThrow(ApiError);
      await expect(authService.register(registerParams)).rejects.toThrow(
        'An account with this email already exists',
      );
      expect(User.create).not.toHaveBeenCalled();
    });

    it('should throw 409 if username already exists', async () => {
      vi.mocked(User.findOne).mockImplementation((query: Record<string, unknown>) => {
        if ('email' in query) return Promise.resolve(null);
        return Promise.resolve(createMockUser());
      });

      await expect(authService.register(registerParams)).rejects.toThrow(ApiError);
      await expect(authService.register(registerParams)).rejects.toThrow(
        'This username is already taken',
      );
      expect(User.create).not.toHaveBeenCalled();
    });
  });

  // ─── Login ────────────────────────────────────────────────────

  describe('login', () => {
    const email = 'test@example.com';
    const password = 'Password123!';

    it('should login successfully with valid credentials', async () => {
      const mockUser = createMockUser({
        comparePassword: vi.fn().mockResolvedValue(true),
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as never);

      const result = await authService.login(email, password);

      expect(mockUser.comparePassword).toHaveBeenCalledWith(password);
      expect(mockUser.generateAccessToken).toHaveBeenCalled();
      expect(mockUser.generateRefreshToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
    });

    it('should throw 401 if user not found', async () => {
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as never);

      await expect(authService.login(email, password)).rejects.toThrow(ApiError);
      await expect(authService.login(email, password)).rejects.toThrow('Invalid email or password');
    });

    it('should throw 401 if password is invalid', async () => {
      const mockUser = createMockUser({
        comparePassword: vi.fn().mockResolvedValue(false),
      });
      vi.mocked(User.findOne).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as never);

      await expect(authService.login(email, password)).rejects.toThrow(ApiError);
      await expect(authService.login(email, password)).rejects.toThrow('Invalid email or password');
    });
  });

  // ─── Logout ───────────────────────────────────────────────────

  describe('logout', () => {
    it('should clear refresh token', async () => {
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(createMockUser());

      await authService.logout('user-123');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-123', { refreshToken: null }, { validateBeforeSave: false },
      );
    });
  });

  // ─── Refresh Access Token ─────────────────────────────────────

  describe('refreshAccessToken', () => {
    const token = 'valid-refresh-token';

    it('should refresh tokens successfully', async () => {
      jwtVerify.mockReturnValue({ userId: 'user-123' });
      const mockUser = createMockUser({ refreshToken: token });
      mockFindByIdToUser(mockUser);

      const result = await authService.refreshAccessToken(token);

      expect(User.findById).toHaveBeenCalledWith('user-123');
      expect(mockUser.generateAccessToken).toHaveBeenCalled();
      expect(mockUser.generateRefreshToken).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
    });

    it('should throw 401 if refresh token is invalid/expired', async () => {
      jwtVerify.mockImplementation(() => { throw new Error('jwt expired'); });

      await expect(authService.refreshAccessToken(token)).rejects.toThrow(ApiError);
      await expect(authService.refreshAccessToken(token)).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });

    it('should throw 401 if user not found', async () => {
      jwtVerify.mockReturnValue({ userId: 'user-123' });
      mockFindByIdToUser(null);

      await expect(authService.refreshAccessToken(token)).rejects.toThrow(ApiError);
      await expect(authService.refreshAccessToken(token)).rejects.toThrow(
        'Refresh token not found',
      );
    });

    it('should throw 401 if no refresh token stored in user record', async () => {
      jwtVerify.mockReturnValue({ userId: 'user-123' });
      const mockUser = createMockUser({ refreshToken: undefined });
      mockFindByIdToUser(mockUser);

      await expect(authService.refreshAccessToken(token)).rejects.toThrow(ApiError);
      await expect(authService.refreshAccessToken(token)).rejects.toThrow(
        'Refresh token not found',
      );
    });

    it('should detect token reuse and invalidate all tokens', async () => {
      jwtVerify.mockReturnValue({ userId: 'user-123' });
      const saveSpy = vi.fn().mockResolvedValue(true);
      const mockUser = { _id: 'user-123', refreshToken: 'different-token', save: saveSpy };
      mockFindByIdToUser(mockUser);

      // Use a SINGLE rejects.toThrow call (not two!) because each .rejects call
      // invokes the function again, and the first call mutates mockUser.refreshToken
      // to undefined, causing the second call to fail with 'Refresh token not found'.
      await expect(authService.refreshAccessToken(token)).rejects.toThrow(
        'Token reuse detected',
      );
      expect(mockUser.refreshToken).toBeUndefined();
      expect(saveSpy).toHaveBeenCalledWith({ validateBeforeSave: false });
    });
  });

  // ─── Get Profile ──────────────────────────────────────────────

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockUser = createMockUser();
      vi.mocked(User.findById).mockResolvedValue(mockUser);

      const result = await authService.getProfile('user-123');
      expect(result).toBe(mockUser);
    });

    it('should throw 404 if user not found', async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      await expect(authService.getProfile('user-123')).rejects.toThrow(ApiError);
      await expect(authService.getProfile('user-123')).rejects.toThrow('User not found');
    });
  });

  // ─── Change Password ──────────────────────────────────────────

  describe('changePassword', () => {
    const userId = 'user-123';
    const currentPassword = 'OldPass1!';
    const newPassword = 'NewPass1!';

    it('should change password successfully', async () => {
      const mockUser = createMockUser({
        comparePassword: vi.fn().mockResolvedValue(true),
      });
      vi.mocked(User.findById).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as never);

      await authService.changePassword(userId, currentPassword, newPassword);

      expect(mockUser.comparePassword).toHaveBeenCalledWith(currentPassword);
      expect(mockUser.password).toBe(newPassword);
      expect(mockUser.refreshToken).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw 404 if user not found', async () => {
      vi.mocked(User.findById).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as never);

      await expect(
        authService.changePassword(userId, currentPassword, newPassword),
      ).rejects.toThrow('User not found');
    });

    it('should throw 400 if current password is incorrect', async () => {
      const mockUser = createMockUser({
        comparePassword: vi.fn().mockResolvedValue(false),
      });
      vi.mocked(User.findById).mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as never);

      await expect(
        authService.changePassword(userId, currentPassword, newPassword),
      ).rejects.toThrow('Current password is incorrect');
    });
  });

  // ─── Forgot Password ──────────────────────────────────────────

  describe('forgotPassword', () => {
    const email = 'test@example.com';

    it('should send password reset email if user exists', async () => {
      const mockUser = createMockUser();
      vi.mocked(User.findOne).mockResolvedValue(mockUser);

      await authService.forgotPassword(email);

      expect(mockUser.createResetPasswordToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email, mockUser.name, 'reset-token-abc',
      );
    });

    it('should silently return if user does not exist (no email info leak)', async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);

      await authService.forgotPassword(email);
      expect(User.findOne).toHaveBeenCalledWith({ email });
      expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  // ─── Reset Password ───────────────────────────────────────────

  describe('resetPassword', () => {
    const resetTokenToken = 'valid-reset-token';
    const newPassword = 'NewPassword123!';

    it('should reset password successfully', async () => {
      const mockUser = createMockUser({ save: vi.fn().mockResolvedValue(true) });
      vi.mocked(User.findOne).mockResolvedValue(mockUser);

      await authService.resetPassword(resetTokenToken, newPassword);

      expect(mockUser.password).toBe(newPassword);
      expect(mockUser.resetPasswordToken).toBeUndefined();
      expect(mockUser.resetPasswordExpires).toBeUndefined();
      expect(mockUser.refreshToken).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw 400 if token is invalid or expired', async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);

      await expect(authService.resetPassword(resetTokenToken, newPassword)).rejects.toThrow(
        'Invalid or expired reset token',
      );
    });
  });

  // ─── Verify Email ─────────────────────────────────────────────

  describe('verifyEmail', () => {
    const verificationToken = 'valid-verification-token';

    it('should verify email successfully', async () => {
      const mockUser = createMockUser({
        isEmailVerified: false,
        save: vi.fn().mockResolvedValue(true),
      });
      vi.mocked(User.findOne).mockResolvedValue(mockUser);

      await authService.verifyEmail(verificationToken);

      expect(mockUser.isEmailVerified).toBe(true);
      expect(mockUser.verificationToken).toBeUndefined();
      expect(mockUser.verificationTokenExpires).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    });

    it('should throw 400 if token is invalid or expired', async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);

      await expect(authService.verifyEmail(verificationToken)).rejects.toThrow(
        'Invalid or expired verification token',
      );
    });
  });

  // ─── Update Profile ───────────────────────────────────────────

  describe('updateProfile', () => {
    const userId = 'user-123';

    it('should update profile fields successfully', async () => {
      const updates = { name: 'New Name', bio: 'A new bio' };
      const mockUser = createMockUser(updates);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(mockUser);

      const result = await authService.updateProfile(userId, updates);

      expect(result.name).toBe('New Name');
      expect(result.bio).toBe('A new bio');
    });

    it('should reject duplicate usernames', async () => {
      const updates = { username: 'taken-username' };
      vi.mocked(User.findOne).mockResolvedValue(
        createMockUser({ _id: 'other-user', username: 'taken-username' }),
      );

      await expect(authService.updateProfile(userId, updates)).rejects.toThrow(
        'This username is already taken',
      );
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should allow updating to own username', async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);
      const updates = { username: 'still-my-username' };
      const mockUser = createMockUser(updates);
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(mockUser);

      const result = await authService.updateProfile(userId, updates);

      expect(User.findOne).toHaveBeenCalledWith({
        username: 'still-my-username', _id: { $ne: userId },
      });
      expect(result.username).toBe('still-my-username');
    });

    it('should throw 404 if user not found after update', async () => {
      vi.mocked(User.findByIdAndUpdate).mockResolvedValue(null);

      await expect(authService.updateProfile(userId, { name: 'New' })).rejects.toThrow(
        'User not found',
      );
    });
  });
});
