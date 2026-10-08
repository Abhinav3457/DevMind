import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubService, mapGitHubError } from '../github.service';
import { gitHubOAuthService } from '../../github/oauth.service';
import { gitHubApiService } from '../../github/api.service';
import ImportedRepository from '../../models/ImportedRepository';
import { ApiError } from '../../utils/apiResponse';

vi.mock('../../github/oauth.service', () => ({
  gitHubOAuthService: {
    getAuthorizationUrl: vi.fn(),
    connectAccount: vi.fn(),
    disconnectAccount: vi.fn(),
    getConnectedAccount: vi.fn(),
    forceDisconnectByGithubId: vi.fn(),
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

const REPO_DATA = {
  id: 12345, name: 'test-repo', full_name: 'user/test-repo',
  owner: { id: 1, login: 'user', avatar_url: '' },
  description: 'A test repo', html_url: '', private: false,
  default_branch: 'main', language: 'TypeScript',
  topics: [], stargazers_count: 10, forks_count: 5,
  open_issues_count: 2, permissions: { admin: true, push: true, pull: true },
};

function makeOctokitMock() {
  return {
    rest: {
      repos: {
        get: vi.fn().mockResolvedValue({ data: REPO_DATA }),
        listBranches: vi.fn().mockResolvedValue({
          data: [{ name: 'main', commit: { sha: 'abc123' }, protected: true }],
        }),
      },
    },
  };
}

describe('GitHubService', () => {
  let service: GitHubService;

  beforeEach(() => {
    service = new GitHubService();
    vi.clearAllMocks();
  });

  describe('mapGitHubError', () => {
    it('maps 404 to a safe 404', () => {
      const err = mapGitHubError({ status: 404, message: 'Not Found' }, 'repository');
      expect(err.statusCode).toBe(404);
      expect(err.message).toContain('not found');
    });

    it('maps 401 to a reconnect message', () => {
      const err = mapGitHubError({ status: 401, message: 'Bad credentials (token ghp_secret)' }, 'repository');
      expect(err.statusCode).toBe(401);
      expect(err.message).not.toContain('ghp_secret');
    });

    it('maps 403/429 to a rate-limit message', () => {
      expect(mapGitHubError({ status: 403 }, 'repository').statusCode).toBe(429);
      expect(mapGitHubError({ status: 429 }, 'repository').statusCode).toBe(429);
    });

    it('never leaks the raw upstream message for unexpected failures', () => {
      const err = mapGitHubError(new Error('socket hang up at internal-host:5432 token=abc'), 'repository');
      expect(err.statusCode).toBe(502);
      expect(err.message).not.toContain('internal-host');
      expect(err.message).not.toContain('token=abc');
    });

    it('passes an ApiError through unchanged', () => {
      const original = new ApiError(418, 'teapot');
      expect(mapGitHubError(original, 'repository')).toBe(original);
    });
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
      vi.mocked(gitHubApiService.getUserClient).mockResolvedValue(makeOctokitMock() as never);
      vi.mocked(ImportedRepository.findOneAndUpdate).mockResolvedValue({} as never);

      const result = await service.importRepository('user-123', 'user', 'test-repo', 'ws-123');

      expect(result.imported).toBe(true);
      expect(result.metadata.name).toBe('test-repo');
      expect(ImportedRepository.findOneAndUpdate).toHaveBeenCalled();
    });

    it('should scope the import upsert to the authenticated user', async () => {
      vi.mocked(gitHubApiService.getUserClient).mockResolvedValue(makeOctokitMock() as never);
      vi.mocked(ImportedRepository.findOneAndUpdate).mockResolvedValue({} as never);

      await service.importRepository('user-123', 'user', 'test-repo');

      expect(ImportedRepository.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123', githubId: 12345 }),
        expect.any(Object),
        { upsert: true, new: true },
      );
    });

    it('should not reassign another user\u2019s record when a different user imports the same repo', async () => {
      vi.mocked(gitHubApiService.getUserClient).mockResolvedValue(makeOctokitMock() as never);
      vi.mocked(ImportedRepository.findOneAndUpdate).mockResolvedValue({} as never);

      await service.importRepository('user-B', 'user', 'test-repo');

      const filter = vi.mocked(ImportedRepository.findOneAndUpdate).mock.calls[0]?.[0];
      // Filter MUST include the importing user - a githubId-only filter would hijack user A's row.
      expect(filter).toEqual({ userId: 'user-B', githubId: 12345 });
      expect(filter).not.toEqual({ githubId: 12345 });
    });
  });

  describe('syncRepository', () => {
    it('should scope the sync update to the authenticated user', async () => {
      vi.mocked(gitHubApiService.getUserClient).mockResolvedValue(makeOctokitMock() as never);
      vi.mocked(ImportedRepository.findOneAndUpdate).mockResolvedValue({} as never);

      const result = await service.syncRepository('user-123', 'user', 'test-repo');

      expect(result.synced).toBe(true);
      expect(ImportedRepository.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123', githubId: 12345 }),
        expect.any(Object),
      );
    });

    it('should never sync another user\u2019s repository', async () => {
      vi.mocked(gitHubApiService.getUserClient).mockResolvedValue(makeOctokitMock() as never);
      vi.mocked(ImportedRepository.findOneAndUpdate).mockResolvedValue({} as never);

      await service.syncRepository('user-B', 'user', 'test-repo');

      const filter = vi.mocked(ImportedRepository.findOneAndUpdate).mock.calls[0]?.[0];
      expect(filter).toEqual(expect.objectContaining({ userId: 'user-B' }));
    });
  });

  describe('forceDisconnectByGithubId', () => {
    it('should delegate with the authenticated userId so only the owner can disconnect', async () => {
      vi.mocked(gitHubOAuthService.forceDisconnectByGithubId).mockResolvedValue({ deleted: true, login: 'user' });

      const result = await service.forceDisconnectByGithubId('user-123', 12345);

      expect(result).toEqual({ deleted: true, login: 'user' });
      expect(gitHubOAuthService.forceDisconnectByGithubId).toHaveBeenCalledWith('user-123', 12345);
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
