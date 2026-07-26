import crypto from 'crypto';
import GitHubAccount, { IGitHubAccount } from '../models/GitHubAccount';
import ImportedRepository from '../models/ImportedRepository';
import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import OAuthState from '../models/OAuthState';
import { env } from '../config/environment';
import logger from '../utils/logger';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class GitHubOAuthService {

  getAuthorizationUrl(userId: string, callbackUrl?: string): { url: string; state: string } {
    const state = crypto.randomBytes(32).toString('hex');

    const redirectUri = callbackUrl || `${env.CLIENT_URL}/auth/github/callback`;

    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'repo,user:email,read:org',
      state,
    });

    // Store state asynchronously — caller should await this
    OAuthState.create({
      state,
      userId,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    }).catch((err) => logger.error('Failed to store OAuth state:', err));

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
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      throw new Error(`GitHub OAuth error: ${tokenData.error || 'No access token received'}`);
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
      throw new Error('Invalid or expired OAuth state parameter. Please try again.');
    }
    if (stored.userId.toString() !== userId) {
      throw new Error('OAuth state parameter does not match user. Possible CSRF attack.');
    }
    if (stored.expiresAt < new Date()) {
      await OAuthState.deleteOne({ state });
      throw new Error('OAuth state parameter has expired. Please try again.');
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

    const existing = await GitHubAccount.findOneAndUpdate(
      { userId },
      {
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
      { upsert: true, new: true },
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


}

export const gitHubOAuthService = new GitHubOAuthService();
