import { gitHubApiService } from '../github/api.service';
import { gitHubOAuthService } from '../github/oauth.service';
import { IGitHubAccount } from '../models/GitHubAccount';
import ImportedRepository from '../models/ImportedRepository';
import IndexReport from '../models/IndexReport';
import IndexedFile from '../models/IndexedFile';
import IndexedChunk from '../models/IndexedChunk';
import logger from '../utils/logger';
import { ApiError } from '../utils/apiResponse';

interface GitHubRepoMetadata {
  githubId: number;
  name: string;
  fullName: string;
  owner: { id: number; login: string; avatarUrl: string };
  description: string;
  url: string;
  isPrivate: boolean;
  defaultBranch: string;
  language: string;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  permissions: { admin: boolean; push: boolean; pull: boolean };
}

export class GitHubService {
  async getAuthorizationUrl(userId: string): Promise<{ url: string; state: string }> {
    const state = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    const url = gitHubOAuthService.getAuthorizationUrl(state);
    return { url, state };
  }

  async handleOAuthCallback(userId: string, code: string, state: string): Promise<{ connected: boolean; login: string }> {
    const account = await gitHubOAuthService.connectAccount(userId, code, state);
    return { connected: true, login: account.login };
  }

  async disconnect(userId: string): Promise<void> {
    await gitHubOAuthService.disconnectAccount(userId);
  }

  async getConnectionStatus(userId: string): Promise<{ connected: boolean; account: IGitHubAccount | null }> {
    const account = await gitHubOAuthService.getConnectedAccount(userId);
    return { connected: !!account, account };
  }

  async listUserRepositories(userId: string, options: { type?: string; sort?: string; per_page?: number; page?: number } = {}): Promise<{ repos: GitHubRepoMetadata[] }> {
    const octokit = await gitHubApiService.getUserClient(userId);
    const response = await octokit.rest.repos.listForAuthenticatedUser({
      type: (options.type as 'all' | 'owner' | 'member' | 'public' | 'private') || 'all',
      sort: (options.sort as 'created' | 'updated' | 'pushed' | 'full_name') || 'updated',
      per_page: options.per_page || 30,
      page: options.page || 1,
    });
    const repos = response.data.map((repo: { id: number; name: string; full_name: string; owner: { id: number; login: string; avatar_url: string }; description: string | null; html_url: string; private: boolean; default_branch: string; language: string | null; topics?: string[]; stargazers_count: number; forks_count: number; open_issues_count: number; permissions?: { admin: boolean; push: boolean; pull: boolean } }) => ({
      githubId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: { id: repo.owner.id, login: repo.owner.login, avatarUrl: repo.owner.avatar_url },
      description: repo.description || '',
      url: repo.html_url,
      isPrivate: repo.private,
      defaultBranch: repo.default_branch,
      language: repo.language || '',
      topics: repo.topics || [],
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      permissions: repo.permissions
        ? { admin: repo.permissions.admin, push: repo.permissions.push, pull: repo.permissions.pull }
        : { admin: false, push: false, pull: false },
    }));
    return { repos };
  }

  async listBranches(userId: string, owner: string, repo: string): Promise<{ name: string; sha: string; protected: boolean }[]> {
    const octokit = await gitHubApiService.getUserClient(userId);
    const response = await octokit.rest.repos.listBranches({ owner, repo, per_page: 100 });
    return response.data.map((branch: { name: string; commit: { sha: string }; protected: boolean }) => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected,
    }));
  }

  async listCommits(userId: string, owner: string, repo: string, options: { branch?: string; per_page?: number; page?: number } = {}): Promise<{ sha: string; message: string; author: string; date: string; url: string }[]> {
    const octokit = await gitHubApiService.getUserClient(userId);
    const response = await octokit.rest.repos.listCommits({
      owner, repo,
      sha: options.branch,
      per_page: options.per_page || 30,
      page: options.page || 1,
    });
    return response.data.map((commit: { sha: string; commit: { message: string; author?: { name?: string; date?: string } | null }; html_url: string }) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name || 'Unknown',
      date: commit.commit.author?.date || '',
      url: commit.html_url,
    }));
  }

  async listPullRequests(userId: string, owner: string, repo: string, options: { state?: string; per_page?: number; page?: number } = {}): Promise<{ number: number; title: string; state: string; author: string; createdAt: string; url: string }[]> {
    const octokit = await gitHubApiService.getUserClient(userId);
    const response = await octokit.rest.pulls.list({
      owner, repo,
      state: (options.state as 'open' | 'closed' | 'all') || 'open',
      per_page: options.per_page || 30,
      page: options.page || 1,
    });
    return response.data.map((pr: { number: number; title: string; state: string; user?: { login: string } | null; created_at: string; html_url: string }) => ({
      number: pr.number, title: pr.title, state: pr.state,
      author: pr.user?.login || 'Unknown', createdAt: pr.created_at, url: pr.html_url,
    }));
  }

  async getFileTree(userId: string, owner: string, repo: string, branch = 'main', path = ''): Promise<{ path: string; type: 'tree' | 'blob'; size: number; name: string }[]> {
    const octokit = await gitHubApiService.getUserClient(userId);
    const response = await octokit.rest.git.getTree({ owner, repo, tree_sha: branch, recursive: '1' });
    const items = response.data.tree.filter((item: { path?: string }) => !path || item.path?.startsWith(path));
    return items.map((item: { path?: string; type: string; size?: number }) => ({
      path: item.path || '', type: item.type as 'tree' | 'blob', size: item.size || 0,
      name: item.path?.split('/').pop() || '',
    }));
  }

  async getRepoMetadata(userId: string, owner: string, repo: string): Promise<GitHubRepoMetadata> {
    const octokit = await gitHubApiService.getUserClient(userId);
    const response = await octokit.rest.repos.get({ owner, repo });
    const d = response.data;
    return {
      githubId: d.id, name: d.name, fullName: d.full_name,
      owner: { id: d.owner.id, login: d.owner.login, avatarUrl: d.owner.avatar_url },
      description: d.description || '', url: d.html_url, isPrivate: d.private,
      defaultBranch: d.default_branch, language: d.language || '',
      topics: d.topics || [], stars: d.stargazers_count, forks: d.forks_count,
      openIssues: d.open_issues_count,
      permissions: d.permissions
        ? { admin: d.permissions.admin, push: d.permissions.push, pull: d.permissions.pull }
        : { admin: false, push: false, pull: false },
    };
  }

  async importRepository(userId: string, owner: string, repo: string, workspaceId?: string): Promise<{ imported: boolean; metadata: GitHubRepoMetadata }> {
    const metadata = await this.getRepoMetadata(userId, owner, repo);

    const updateData: Record<string, unknown> = {
      userId: userId,
      githubId: metadata.githubId,
      name: metadata.name,
      fullName: metadata.fullName,
      owner: metadata.owner,
      description: metadata.description,
      url: metadata.url,
      isPrivate: metadata.isPrivate,
      defaultBranch: metadata.defaultBranch,
      language: metadata.language,
      topics: metadata.topics,
      stars: metadata.stars,
      forks: metadata.forks,
      openIssues: metadata.openIssues,
      permissions: metadata.permissions,
      lastSyncedAt: new Date(),
    };

    if (workspaceId) {
      updateData.workspaceId = workspaceId;
    }

    await ImportedRepository.findOneAndUpdate(
      { githubId: metadata.githubId },
      updateData,
      { upsert: true, new: true },
    );

    logger.info(`Repository ${metadata.fullName} imported into MongoDB`);
    return { imported: true, metadata };
  }

  async deleteImportedRepo(repoId: string, userId: string): Promise<void> {
    const repo = await ImportedRepository.findOne({ _id: repoId, userId });
    if (!repo) {
      throw new ApiError(404, 'Repository not found or access denied');
    }

    // Find and delete all associated index data
    const reports = await IndexReport.find({ repositoryId: repoId, userId });
    const reportIds = reports.map((r) => r._id);

    await Promise.all([
      // Delete the imported repo
      ImportedRepository.deleteOne({ _id: repoId, userId }),
      // Delete all index reports for this repo
      IndexReport.deleteMany({ _id: { $in: reportIds }, userId }),
      // Delete all indexed files for these reports
      ...(reportIds.length > 0 ? [
        IndexedFile.deleteMany({ reportId: { $in: reportIds } }),
        IndexedChunk.deleteMany({ reportId: { $in: reportIds } }),
      ] : []),
    ]);

    logger.info(`Repository ${repo.fullName} and its index data deleted`);
  }

  async syncRepository(userId: string, owner: string, repo: string): Promise<{ synced: boolean; branches: number }> {
    const metadata = await this.getRepoMetadata(userId, owner, repo);
    const branches = await this.listBranches(userId, owner, repo);

    await ImportedRepository.findOneAndUpdate(
      { githubId: metadata.githubId },
      {
        stars: metadata.stars,
        forks: metadata.forks,
        openIssues: metadata.openIssues,
        description: metadata.description,
        topics: metadata.topics,
        lastSyncedAt: new Date(),
      },
    );

    logger.info(`Synced ${metadata.fullName}: ${branches.length} branches`);
    return { synced: true, branches: branches.length };
  }
}

export const gitHubService = new GitHubService();
