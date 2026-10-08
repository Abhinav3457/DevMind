import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubApiService } from '../api.service';
import GitHubAccount from '../../models/GitHubAccount';
import { ApiError } from '../../utils/apiResponse';

vi.mock('../../models/GitHubAccount', () => ({
  default: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock('../../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('GitHubApiService.getUserClient', () => {
  let service: GitHubApiService;

  beforeEach(() => {
    service = new GitHubApiService();
    vi.clearAllMocks();
  });

  it('throws a safe 400 ApiError when GitHub is not connected', async () => {
    vi.mocked(GitHubAccount.findOne).mockResolvedValue(null);

    await expect(service.getUserClient('user-1')).rejects.toThrow(ApiError);

    try {
      await service.getUserClient('user-1');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
      expect((error as ApiError).message).toBe(
        'GitHub account not connected. Please connect your GitHub account first.',
      );
    }
  });
});
