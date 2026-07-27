import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubOAuthService } from '../../github/oauth.service';
import OAuthState from '../../models/OAuthState';
import GitHubAccount from '../../models/GitHubAccount';

vi.mock('../../models/OAuthState', () => ({
  default: { create: vi.fn(), findOne: vi.fn(), deleteOne: vi.fn() },
}));
vi.mock('../../models/GitHubAccount', () => ({
  default: { findOne: vi.fn(), findOneAndUpdate: vi.fn(), find: vi.fn() },
}));
vi.mock('../../models/ImportedRepository', () => ({ default: { find: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }), deleteMany: vi.fn() } }));
vi.mock('../../models/IndexReport', () => ({ default: { find: vi.fn(), deleteMany: vi.fn() } }));
vi.mock('../../models/IndexedFile', () => ({ default: { deleteMany: vi.fn() } }));
vi.mock('../../models/IndexedChunk', () => ({ default: { deleteMany: vi.fn() } }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

describe('GitHubOAuthService', () => {
  let service: GitHubOAuthService;

  beforeEach(() => {
    service = new GitHubOAuthService();
    vi.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should persist state before returning URL', async () => {
      vi.mocked(OAuthState.create).mockResolvedValue({} as never);
      const result = await service.getAuthorizationUrl('user-123');
      expect(OAuthState.create).toHaveBeenCalled();
      expect(result.url).toContain('github.com/login/oauth/authorize');
      expect(result.state).toBeTruthy();
    });

    it('should throw if state persistence fails', async () => {
      vi.mocked(OAuthState.create).mockRejectedValue(new Error('DB error'));
      await expect(service.getAuthorizationUrl('user-123')).rejects.toThrow('Failed to initialize');
    });
  });

  describe('getUserIdFromState', () => {
    it('should return userId for valid state', async () => {
      vi.mocked(OAuthState.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue({ userId: { toString: () => 'user-123' } }),
      } as never);
      const userId = await service.getUserIdFromState('valid-state');
      expect(userId).toBe('user-123');
    });

    it('should return null for invalid state', async () => {
      vi.mocked(OAuthState.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);
      const userId = await service.getUserIdFromState('invalid-state');
      expect(userId).toBeNull();
    });
  });

  describe('getConnectedAccount', () => {
    it('should return null when not connected', async () => {
      vi.mocked(GitHubAccount.findOne).mockResolvedValue(null);
      const result = await service.getConnectedAccount('user-123');
      expect(result).toBeNull();
    });

    it('should return account when connected', async () => {
      const mockAccount = { login: 'testuser', isConnected: true };
      vi.mocked(GitHubAccount.findOne).mockResolvedValue(mockAccount as never);
      const result = await service.getConnectedAccount('user-123');
      expect(result).toEqual(mockAccount);
    });
  });

  describe('disconnectAccount', () => {
    it('should disconnect and clean up data', async () => {
      await service.disconnectAccount('user-123');
      expect(GitHubAccount.findOneAndUpdate).toHaveBeenCalled();
    });
  });
});
