import type { Octokit } from 'octokit' with { 'resolution-mode': 'import' };
import { Document } from 'mongoose';
import { env } from '../config/environment';
import GitHubAccount, { IGitHubAccount } from '../models/GitHubAccount';
import logger from '../utils/logger';

const RATE_LIMIT_THRESHOLD = 100;

interface GitHubApiOptions {
  userId?: string;
  useGlobalToken?: boolean;
}

export class GitHubApiService {
  private globalOctokit: Octokit | null = null;

  private async getGlobalClient(): Promise<Octokit> {
    if (!this.globalOctokit) {
      const { Octokit } = await import('octokit');
      this.globalOctokit = new Octokit({ auth: env.GITHUB_TOKEN });
    }
    return this.globalOctokit;
  }

  async getUserClient(userId: string): Promise<Octokit> {
    const account = await GitHubAccount.findOne({ userId, isConnected: true });
    if (!account) {
      throw new Error('GitHub account not connected. Please connect your GitHub account first.');
    }

    await this.checkRateLimit(account);

    const { Octokit } = await import('octokit');
    return new Octokit({ auth: account.accessToken });
  }

  private async checkRateLimit(account: Document & IGitHubAccount): Promise<void> {
    if (account.rateLimitRemaining < RATE_LIMIT_THRESHOLD) {
      const resetTime = new Date(account.rateLimitReset).getTime();
      const now = Date.now();
      if (resetTime > now) {
        const waitMs = resetTime - now;
        logger.warn(`GitHub rate limit low (${account.rateLimitRemaining}). Resets in ${Math.ceil(waitMs / 1000)}s`);
      }
    }
  }

  async updateRateLimit(
    userId: string,
    remaining: number,
    reset: Date,
  ): Promise<void> {
    await GitHubAccount.findOneAndUpdate(
      { userId },
      { rateLimitRemaining: remaining, rateLimitReset: reset },
    );
  }

  async getClient(options: GitHubApiOptions = {}): Promise<Octokit> {
    if (options.userId) {
      try {
        return await this.getUserClient(options.userId);
      } catch (error) {
        if (!options.useGlobalToken) throw error;
      }
    }
    return this.getGlobalClient();
  }

  async fetchWithRateLimit<T>(
    userId: string | undefined,
    fetchFn: (octokit: Octokit) => Promise<T>,
  ): Promise<{ data: T; headers: Record<string, unknown> }> {
    const octokit = userId ? await this.getUserClient(userId) : await this.getGlobalClient();
    const response = await fetchFn(octokit) as unknown as { data: T; headers: Record<string, unknown> };
    if (userId && response.headers) {
      const remaining = parseInt(response.headers['x-ratelimit-remaining'] as string, 10);
      const reset = parseInt(response.headers['x-ratelimit-reset'] as string, 10);
      if (!isNaN(remaining) && !isNaN(reset)) {
        await this.updateRateLimit(userId, remaining, new Date(reset * 1000));
      }
    }
    return response;
  }
}

export const gitHubApiService = new GitHubApiService();
