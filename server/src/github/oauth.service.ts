import crypto from 'crypto';
import GitHubAccount, { IGitHubAccount } from '../models/GitHubAccount';
import { env } from '../config/environment';
import logger from '../utils/logger';

interface PendingState {
  userId: string;
  expiresAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class GitHubOAuthService {
  private pendingStates = new Map<string, PendingState>();

  constructor() {
    // Periodically clean up expired states to prevent memory leaks from abandoned flows
    setInterval(() => this.cleanupExpiredStates(), CLEANUP_INTERVAL_MS);
  }

  getAuthorizationUrl(userId: string, callbackUrl?: string): { url: string; state: string } {
    const state = crypto.randomBytes(32).toString('hex');
    this.pendingStates.set(state, { userId, expiresAt: Date.now() + STATE_TTL_MS });

    const redirectUri = callbackUrl || `${env.CLIENT_URL}/auth/github/callback`;

    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'repo,user:email,read:org',
      state,
    });
    return { url: `https://github.com/login/oauth/authorize?${params.toString()}`, state };
  }

  getUserIdFromState(state: string): string | null {
    const stored = this.pendingStates.get(state);
    if (!stored || stored.expiresAt < Date.now()) return null;
    return stored.userId;
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
    const stored = this.pendingStates.get(state);
    if (!stored) {
      throw new Error('Invalid or expired OAuth state parameter. Possible CSRF attack.');
    }
    if (stored.userId !== userId) {
      throw new Error('OAuth state parameter does not match user. Possible CSRF attack.');
    }
    if (stored.expiresAt < Date.now()) {
      this.pendingStates.delete(state);
      throw new Error('OAuth state parameter has expired. Please try again.');
    }

    // Remove state immediately to prevent replay attacks
    this.pendingStates.delete(state);

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
    await GitHubAccount.findOneAndUpdate(
      { userId },
      { isConnected: false, accessToken: '' },
    );
    logger.info(`GitHub account disconnected for user ${userId}`);
  }

  async getConnectedAccount(userId: string): Promise<IGitHubAccount | null> {
    return GitHubAccount.findOne({ userId, isConnected: true });
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [state, data] of this.pendingStates.entries()) {
      if (data.expiresAt < now) {
        this.pendingStates.delete(state);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug(`OAuth: Cleaned up ${cleaned} expired state(s)`);
    }
  }
}

export const gitHubOAuthService = new GitHubOAuthService();
