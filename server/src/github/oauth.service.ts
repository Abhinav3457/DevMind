import { Octokit } from 'octokit';
import GitHubAccount, { IGitHubAccount } from '../models/GitHubAccount';
import { env } from '../config/environment';
import logger from '../utils/logger';

export class GitHubOAuthService {
  private pendingStates = new Map<string, string>(); // state -> userId

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: `${env.CLIENT_URL}/auth/github/callback`,
      scope: 'repo,user:email,read:org',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
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

    const octokit = new Octokit({ auth: tokenData.access_token });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    return { accessToken: tokenData.access_token, login: user.login };
  }

  async connectAccount(userId: string, code: string, state: string): Promise<IGitHubAccount> {
    // Validate state to prevent CSRF attacks on OAuth flow
    // State is base64(userId:timestamp) — decode and check it starts with the userId
    let decodedState: string;
    try {
      decodedState = Buffer.from(state, 'base64').toString('utf-8');
    } catch {
      throw new Error('Invalid OAuth state parameter. Possible CSRF attack.');
    }
    if (!decodedState.startsWith(`${userId}:`)) {
      throw new Error('Invalid OAuth state parameter. Possible CSRF attack.');
    }
    const { accessToken, login } = await this.handleCallback(code);

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
}

export const gitHubOAuthService = new GitHubOAuthService();
