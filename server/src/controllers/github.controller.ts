import { Request, Response } from 'express';
import { gitHubService } from '../services/github.service';
import { gitHubOAuthService } from '../github/oauth.service';
import ImportedRepository from '../models/ImportedRepository';
import IndexReport from '../models/IndexReport';
import { env } from '../config/environment';
import { sendSuccess, sendError } from '../utils/apiResponse';
import logger from '../utils/logger';

export class GitHubController {
  async getAuthorizationUrl(req: Request, res: Response): Promise<void> {
    // Use configured callback URL (env var) or fall back to frontend callback route
    // Frontend callback is more reliable: CLIENT_URL is already configured, and
    // the frontend handles the OAuth redirect by posting code+state to the backend.
    const callbackUrl =
      env.GITHUB_CALLBACK_URL ||
      `${env.CLIENT_URL}/auth/github/callback`;
    const { url } = await gitHubService.getAuthorizationUrl(req.user!.userId, callbackUrl);
    sendSuccess(res, { statusCode: 200, message: 'GitHub authorization URL generated', data: { url } });
  }

  async handleOAuthCallback(req: Request, res: Response): Promise<void> {
    const { code, state } = req.body;

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      sendError(res, 500, 'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.');
      return;
    }

    try {
      const result = await gitHubService.handleOAuthCallback(req.user!.userId, code, state);
      sendSuccess(res, { statusCode: 200, message: 'GitHub account connected successfully', data: result });
    } catch (error) {
      const message = (error as Error).message || 'Failed to connect GitHub account';
      logger.error('GitHub OAuth callback error:', { message });
      sendError(res, 500, message);
    }
  }

  async handleDirectOAuthCallback(req: Request, res: Response): Promise<void> {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${env.CLIENT_URL}/github?error=missing_params`);
    }

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return res.redirect(`${env.CLIENT_URL}/github?github_status=error&message=${encodeURIComponent('GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.')}`);
    }

    const userId = await gitHubOAuthService.getUserIdFromState(state as string);
    if (!userId) {
      return res.redirect(`${env.CLIENT_URL}/github?error=invalid_or_expired_state`);
    }

    try {
      await gitHubService.handleOAuthCallback(userId, code as string, state as string);
      return res.redirect(`${env.CLIENT_URL}/github?github_status=success`);
    } catch (err) {
      logger.error('GitHub OAuth direct callback error:', { message: (err as Error).message });
      const message = encodeURIComponent((err as Error).message);
      return res.redirect(`${env.CLIENT_URL}/github?github_status=error&message=${message}`);
    }
  }

  async disconnect(req: Request, res: Response): Promise<void> {
    await gitHubService.disconnect(req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'GitHub account disconnected successfully' });
  }

  async forceDisconnect(req: Request, res: Response): Promise<void> {
    const { githubId } = req.body;

    if (!githubId || isNaN(Number(githubId))) {
      sendError(res, 400, 'A valid githubId is required.');
      return;
    }

    const result = await gitHubService.forceDisconnectByGithubId(Number(githubId));

    if (!result.deleted) {
      sendError(res, 404, `No GitHub account found with githubId: ${githubId}`);
      return;
    }

    sendSuccess(res, {
      statusCode: 200,
      message: `GitHub account "${result.login}" (ID: ${githubId}) has been force-disconnected.`,
      data: result,
    });
  }

  async getConnectionStatus(req: Request, res: Response): Promise<void> {
    const result = await gitHubService.getConnectionStatus(req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'GitHub connection status retrieved', data: result });
  }

  async listRepositories(req: Request, res: Response): Promise<void> {
    const { type, sort, per_page, page } = req.query;
    const result = await gitHubService.listUserRepositories(req.user!.userId, {
      type: type as string,
      sort: sort as string,
      per_page: per_page ? parseInt(per_page as string, 10) : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
    });
    sendSuccess(res, { statusCode: 200, message: 'Repositories retrieved', data: { repos: result.repos } });
  }

  async getRepoMetadata(req: Request, res: Response): Promise<void> {
    const { owner, repo } = req.params;
    const metadata = await gitHubService.getRepoMetadata(req.user!.userId, owner, repo);
    sendSuccess(res, { statusCode: 200, message: 'Repository metadata retrieved', data: { metadata } });
  }

  async listBranches(req: Request, res: Response): Promise<void> {
    const { owner, repo } = req.params;
    const branches = await gitHubService.listBranches(req.user!.userId, owner, repo);
    sendSuccess(res, { statusCode: 200, message: 'Branches retrieved', data: { branches } });
  }

  async listCommits(req: Request, res: Response): Promise<void> {
    const { owner, repo } = req.params;
    const { branch, per_page, page } = req.query;
    const commits = await gitHubService.listCommits(req.user!.userId, owner, repo, {
      branch: branch as string,
      per_page: per_page ? parseInt(per_page as string, 10) : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
    });
    sendSuccess(res, { statusCode: 200, message: 'Commits retrieved', data: { commits } });
  }

  async listPullRequests(req: Request, res: Response): Promise<void> {
    const { owner, repo } = req.params;
    const { state, per_page, page } = req.query;
    const pullRequests = await gitHubService.listPullRequests(req.user!.userId, owner, repo, {
      state: state as string,
      per_page: per_page ? parseInt(per_page as string, 10) : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
    });
    sendSuccess(res, { statusCode: 200, message: 'Pull requests retrieved', data: { pullRequests } });
  }

  async getFileTree(req: Request, res: Response): Promise<void> {
    const { owner, repo } = req.params;
    const { branch, path } = req.query;
    const fileTree = await gitHubService.getFileTree(req.user!.userId, owner, repo, branch as string, path as string);
    sendSuccess(res, { statusCode: 200, message: 'File tree retrieved', data: { fileTree } });
  }

  async importRepository(req: Request, res: Response): Promise<void> {
    const { owner, repo } = req.body;
    const result = await gitHubService.importRepository(req.user!.userId, owner, repo);
    sendSuccess(res, { statusCode: 200, message: 'Repository imported and stored successfully', data: result });
  }

  async listImportedRepos(req: Request, res: Response): Promise<void> {
    const repos = await ImportedRepository.find({ userId: req.user!.userId }).sort({ updatedAt: -1 }).lean();

    // Attach indexing status for each repo
    const reposWithStatus = await Promise.all(repos.map(async (repo) => {
      const report = await IndexReport.findOne({ repositoryId: repo._id, userId: req.user!.userId })
        .sort({ createdAt: -1 })
        .select('status summary fileCount chunkCount createdAt completedAt')
        .lean();
      return {
        ...repo,
        indexStatus: report ? report.status : 'not_indexed',
        indexSummary: report?.summary || null,
        indexedFiles: report?.fileCount || 0,
        indexedChunks: report?.chunkCount || 0,
        indexedAt: report?.completedAt || null,
      };
    }));

    sendSuccess(res, {
      statusCode: 200,
      message: 'Imported repositories retrieved',
      data: { repos: reposWithStatus },
    });
  }

  async deleteImportedRepo(req: Request, res: Response): Promise<void> {
    await gitHubService.deleteImportedRepo(req.params.id, req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'Repository and its index data removed' });
  }

  async syncRepository(req: Request, res: Response): Promise<void> {
    const { owner, repo } = req.body;
    const result = await gitHubService.syncRepository(req.user!.userId, owner, repo);
    sendSuccess(res, { statusCode: 200, message: 'Repository synced', data: result });
  }
}

export const gitHubController = new GitHubController();
