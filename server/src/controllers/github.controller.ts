import { Request, Response } from 'express';
import { gitHubService } from '../services/github.service';
import { gitHubOAuthService } from '../github/oauth.service';
import ImportedRepository from '../models/ImportedRepository';
import IndexReport from '../models/IndexReport';
import { env } from '../config/environment';
import { sendSuccess } from '../utils/apiResponse';

export class GitHubController {
  async getAuthorizationUrl(req: Request, res: Response): Promise<void> {
    // Use backend callback URL so SPA routing on frontend is not needed
    const backendUrl = `${req.protocol}://${req.get('host')}`;
    const callbackUrl = `${backendUrl}/api/v1/github/callback`;
    const { url } = await gitHubService.getAuthorizationUrl(req.user!.userId, callbackUrl);
    sendSuccess(res, { statusCode: 200, message: 'GitHub authorization URL generated', data: { url } });
  }

  async handleOAuthCallback(req: Request, res: Response): Promise<void> {
    const { code, state } = req.body;
    const result = await gitHubService.handleOAuthCallback(req.user!.userId, code, state);
    sendSuccess(res, { statusCode: 200, message: 'GitHub account connected successfully', data: result });
  }

  async handleDirectOAuthCallback(req: Request, res: Response): Promise<void> {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${env.CLIENT_URL}/github?error=missing_params`);
    }

    const userId = gitHubOAuthService.getUserIdFromState(state as string);
    if (!userId) {
      return res.redirect(`${env.CLIENT_URL}/github?error=invalid_or_expired_state`);
    }

    try {
      await gitHubService.handleOAuthCallback(userId, code as string, state as string);
      return res.redirect(`${env.CLIENT_URL}/github?github_status=success`);
    } catch (err) {
      const message = encodeURIComponent((err as Error).message);
      return res.redirect(`${env.CLIENT_URL}/github?github_status=error&message=${message}`);
    }
  }

  async disconnect(req: Request, res: Response): Promise<void> {
    await gitHubService.disconnect(req.user!.userId);
    sendSuccess(res, { statusCode: 200, message: 'GitHub account disconnected successfully' });
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
    const { owner, repo, workspaceId } = req.body;
    const result = await gitHubService.importRepository(req.user!.userId, owner, repo, workspaceId);
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
