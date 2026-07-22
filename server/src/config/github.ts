import { Octokit } from 'octokit';
import { env } from './environment';

let octokit: Octokit | null = null;

export function getGitHubClient(): Octokit {
  if (!octokit) {
    octokit = new Octokit({
      auth: env.GITHUB_TOKEN,
    });
  }
  return octokit;
}

export async function getAuthenticatedUser() {
  const client = getGitHubClient();
  const { data } = await client.rest.users.getAuthenticated();
  return data;
}
