import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubService } from '../github.service';
import { gitHubOAuthService } from '../../github/oauth.service';
import { gitHubApiService } from '../../github/api.service';
import ImportedRepository from '../../models/ImportedRepository';

vi.mock('../../github/oauth.service', () => ({
  gitHubOAuthService: {
    getAuthorizationUrl: vi.fn(),
    connectAccount: vi.fn(),
    disconnectAccount: vi.fn(),
    getConnectedAccount: vi.fn(),
  },
}));

vi.mock('../../github/api.service', () => ({
  gitHubApiService: {
    getUserClient: vi.fn(),
  },
}));

vi.mock('../../models/GitHubAccount', () => ({}));
vi.mock('../../models/ImportedRepository', () => ({
  default: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
  },
}));
vi.mock('../../models/IndexReport', () => ({
  default: {
    find: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(),
  },
}));
vi.mock('../../models/IndexedFile', () => ({ default: { deleteMany: vi.fn() } }));
vi.mock('../../models/IndexedChunk', () => ({ default: { deleteMany: vi.fn() } }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

describe('GitHubService', () => {
  let service: GitHubService;

  beforeEach(() => {
    service = new GitHubService();
    vi.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should return auth URL from OAuth service', async () => {
      vi.mocked(gitHubOAuthService.getAuthorizationUrl).mockResolvedValue({
        url: 'https://github.com/login/oauth/authorize?client_id=xxx&state=yyy',
        state: 'yyy',
      });
      const result = await service.getAuthorizationUrl('user-123');
      expect(result.url).toContain('github.com');
      expect(result.state).toBe('yyy');
    });
  });

  describe('handleOAuthCallback', () => {
    it('should connect account and return login', async () => {
      vi.mocked(gitHubOAuthService.connectAccount).mockResolvedValue({ login: 'testuser' } as never);
      const result = await service.handleOAuthCallback('user-123', 'code', 'state');
      expect(result.connected).toBe(true);
      expect(result.login).toBe('testuser');
    });
  });

  describe('getConnectionStatus', () => {
    it('should return connected false when no account', async () => {
      vi.mocked(gitHubOAuthService.getConnectedAccount).mockResolvedValue(null);
      const result = await service.getConnectionStatus('user-123');
      expect(result.connected).toBe(false);
      expect(result.account).toBeNull();
    });

    it('should return connected true with account', async () => {
      vi.mocked(gitHubOAuthService.getConnectedAccount).mockResolvedValue({ login: 'testuser' } as never);
      const result = await service.getConnectionStatus('user-123');
      expect(result.connected).toBe(true);
    });
  });

  describe('importRepository', () => {
    it('should import and upsert a repository', async () => {
      vi.mocked(gitHubApiService.getUserClient).mockResolvedValue({
        rest: {
          repos: {
            get: vi.fn().mockResolvedValue({
              data: {
                id: 12345, name: 'test-repo', full_name: 'user/test-repo',
                owner: { id: 1, login: 'user', avatar_url: '' },
                description: 'A test repo', html_url: '', private: false,
                default_branch: 'main', language: 'TypeScript',
                topics: [], stargazers_count: 10, forks_count: 5,
                open_issues_count: 2, permissions: { admin: true, push: true, pull: true },
              },
            }),
          },
        },
      } as never);
      vi.mocked(ImportedRepository.findOneAndUpdate).mockResolvedValue({} as never);

      const result = await service.importRepository('user-123', 'user', 'test-repo', 'ws-123');

      expect(result.imported).toBe(true);
      expect(result.metadata.name).toBe('test-repo');
      expect(ImportedRepository.findOneAndUpdate).toHaveBeenCalled();
    });
  });

  describe('deleteImportedRepo', () => {
    it('should throw 404 if repo not found', async () => {
      vi.mocked(ImportedRepository.findOne).mockResolvedValue(null);
      await expect(service.deleteImportedRepo('repo-123', 'user-123')).rejects.toThrow('not found');
    });

    it('should delete repo and index data', async () => {
      vi.mocked(ImportedRepository.findOne).mockResolvedValue({
        _id: 'repo-123', fullName: 'user/repo', name: 'repo',
      } as never);
      vi.mocked(ImportedRepository.deleteOne).mockResolvedValue({} as never);

      await service.deleteImportedRepo('repo-123', 'user-123');
      expect(ImportedRepository.deleteOne).toHaveBeenCalledWith({ _id: 'repo-123', userId: 'user-123' });
    });
  });
});
