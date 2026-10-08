import crypto from 'crypto';
import GitHubAccount, { IGitHubAccount } from '../models/GitHubAccount';
import ImportedRepository from '../models/ImportedRepository';
import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import OAuthState from '../models/OAuthState';
import { env } from '../config/environment';
import logger from '../utils/logger';
import { ApiError } from '../utils/apiResponse';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class GitHubOAuthService {

  async getAuthorizationUrl(userId: string, callbackUrl?: string): Promise<{ url: string; state: string }> {
    const state = crypto.randomBytes(32).toString('hex');

    const redirectUri = callbackUrl || `${env.CLIENT_URL}/auth/github/callback`;

    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'repo,user:email,read:org',
      state,
    });

    // Persist state BEFORE returning the URL — this is critical for CSRF protection
    try {
      await OAuthState.create({
        state,
        userId,
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      });
    } catch (err) {
      logger.error('Failed to store OAuth state:', err);
      throw new ApiError(500, 'Failed to initialize GitHub authorization. Please try again.');
    }

    return { url: `https://github.com/login/oauth/authorize?${params.toString()}`, state };
  }

  async getUserIdFromState(state: string): Promise<string | null> {
    try {
      const stored = await OAuthState.findOne({ state, expiresAt: { $gt: new Date() } }).lean();
      if (!stored) return null;
      return stored.userId.toString();
    } catch {
      return null;
    }
  }

  async handleCallback(code: string): Promise<{ accessToken: string; login: string }> {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new ApiError(503, 'GitHub OAuth is not configured. Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET environment variables.');
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string };
    if (!tokenData.access_token) {
      // Keep the provider detail in server logs only — never send it to clients.
      logger.error('GitHub OAuth token exchange failed:', {
        error: tokenData.error || 'no_access_token',
        description: tokenData.error_description,
      });
      throw new ApiError(502, 'Could not complete GitHub authorization. Please try again.');
    }

    const { Octokit } = await import('octokit');
    const octokit = new Octokit({ auth: tokenData.access_token });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    return { accessToken: tokenData.access_token, login: user.login };
  }

  async connectAccount(userId: string, code: string, state: string): Promise<IGitHubAccount> {
    // Validate state to prevent CSRF attacks on OAuth flow
    const stored = await OAuthState.findOne({ state }).lean();
    if (!stored) {
      throw new ApiError(400, 'Invalid or expired OAuth state parameter. Please try again.');
    }
    if (stored.userId.toString() !== userId) {
      throw new ApiError(400, 'OAuth state parameter does not match user. Possible CSRF attack.');
    }
    if (stored.expiresAt < new Date()) {
      await OAuthState.deleteOne({ state });
      throw new ApiError(400, 'OAuth state parameter has expired. Please try again.');
    }

    // Remove state immediately to prevent replay attacks
    await OAuthState.deleteOne({ state });

    const { accessToken, login } = await this.handleCallback(code);

    const { Octokit } = await import('octokit');
    const octokit = new Octokit({ auth: accessToken });
    const [userRes, emailsRes] = await Promise.all([
      octokit.rest.users.getAuthenticated(),
      octokit.rest.users.listEmailsForAuthenticatedUser(),
    ]);
    const user = userRes.data;
    const primaryEmail = emailsRes.data.find((e: { primary: boolean }) => e.primary)?.email || '';

    // Check if this GitHub account is already connected to another user
    const existingByGithubId = await GitHubAccount.findOne({ githubId: user.id, userId: { $ne: userId } }).lean();
    if (existingByGithubId) {
      throw new ApiError(
        409,
        `GitHub account "${login}" is already connected to another user. ` +
        'Please disconnect it from that account first, or use a different GitHub account.',
      );
    }

    // Upsert by userId to handle re-connection by the same user
    const existing = await GitHubAccount.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          githubId: user.id,
          login: user.login,
          name: user.name || user.login,
          email: primaryEmail,
          avatarUrl: user.avatar_url,
          accessToken,
          scopes: ['repo', 'user:email', 'read:org'],
          isConnected: true,
          rateLimitRemaining: 5000,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    logger.info(`GitHub account connected for user ${userId}: ${login}`);
    return existing;
  }

  async disconnectAccount(userId: string): Promise<void> {
    // Set account as disconnected
    await GitHubAccount.findOneAndUpdate(
      { userId },
      { isConnected: false, accessToken: '' },
    );

    // Clean up all imported repos and their indexed data
    const repos = await ImportedRepository.find({ userId }).select('_id').lean();
    const repoIds = repos.map((r) => r._id);

    if (repoIds.length > 0) {
      const reports = await IndexReport.find({ repositoryId: { $in: repoIds }, userId }).select('_id').lean();
      const reportIds = reports.map((r) => r._id);

      await Promise.all([
        ImportedRepository.deleteMany({ userId }),
        IndexReport.deleteMany({ repositoryId: { $in: repoIds }, userId }),
        ...(reportIds.length > 0
          ? [
              IndexedFile.deleteMany({ reportId: { $in: reportIds } }),
              IndexedChunk.deleteMany({ reportId: { $in: reportIds } }),
            ]
          : []),
      ]);

      logger.info(`Cleaned up ${repoIds.length} repos and ${reportIds.length} index reports for user ${userId}`);
    }

    logger.info(`GitHub account disconnected for user ${userId}`);
  }

  async getConnectedAccount(userId: string): Promise<IGitHubAccount | null> {
    return GitHubAccount.findOne({ userId, isConnected: true });
  }

  /**
   * Force-disconnect the authenticated user's own GitHub account by its numeric ID.
   * Always scoped by userId: a user can never disconnect (or delete the repos of)
   * another user's GitHub account.
   */
  async forceDisconnectByGithubId(userId: string, githubId: number): Promise<{ deleted: boolean; login?: string }> {
    const account = await GitHubAccount.findOne({ githubId, userId }).lean();
    if (!account) {
      return { deleted: false };
    }

    // Clean up repos and indexed data for this user
    await this.disconnectAccount(userId);

    // Also hard-delete the record in case disconnectAccount only soft-disconnects
    await GitHubAccount.deleteOne({ githubId, userId });

    logger.info(`Force-disconnected GitHub account ${account.login} (ID: ${githubId})`);
    return { deleted: true, login: account.login };
  }

}

export const gitHubOAuthService = new GitHubOAuthService();
