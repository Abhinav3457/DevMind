import type { Octokit } from 'octokit' with { 'resolution-mode': 'import' };
import { env } from './environment';

let octokit: Octokit | null = null;

export async function getGitHubClient(): Promise<Octokit> {
  if (!octokit) {
    const { Octokit } = await import('octokit');
    octokit = new Octokit({
      auth: env.GITHUB_TOKEN,
    });
  }
  return octokit;
}

export async function getAuthenticatedUser() {
  const client = await getGitHubClient();
  const { data } = await client.rest.users.getAuthenticated();
  return data;
}
