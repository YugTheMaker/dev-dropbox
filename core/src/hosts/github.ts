import { Octokit } from '@octokit/rest';
import { CloudHost } from '../types.js';

export class GitHubHost implements CloudHost {
  id = 'github';
  name = 'GitHub';
  private octokit: Octokit | null = null;

  async isAuthenticated(): Promise<boolean> {
    if (!this.octokit) return false;
    try {
      await this.octokit.users.getAuthenticated();
      return true;
    } catch {
      return false;
    }
  }

  async authenticate(token: string): Promise<void> {
    this.octokit = new Octokit({ auth: token });
    const valid = await this.isAuthenticated();
    if (!valid) {
      this.octokit = null;
      throw new Error('Invalid GitHub access token. Please check your credentials.');
    }
  }

  async getCurrentUser(): Promise<{ username: string; avatarUrl?: string }> {
    if (!this.octokit) {
      throw new Error('Not authenticated with GitHub.');
    }
    const { data } = await this.octokit.users.getAuthenticated();
    return {
      username: data.login,
      avatarUrl: data.avatar_url
    };
  }

  async getRepoInfo(owner: string, repo: string): Promise<{ id: number; html_url: string; private: boolean }> {
    if (!this.octokit) {
      throw new Error('Not authenticated with GitHub.');
    }
    const { data } = await this.octokit.repos.get({ owner, repo });
    return {
      id: data.id,
      html_url: data.html_url,
      private: data.private
    };
  }

  async createRepo(name: string, isPrivate: boolean): Promise<{ html_url: string }> {
    if (!this.octokit) {
      throw new Error('Not authenticated with GitHub.');
    }
    const { data } = await this.octokit.repos.createForAuthenticatedUser({
      name,
      private: isPrivate,
      auto_init: false // We will push our own files
    });
    return {
      html_url: data.clone_url // git url or clone url
    };
  }

  async listRepos(): Promise<{ name: string; clone_url: string; private: boolean }[]> {
    if (!this.octokit) {
      throw new Error('Not authenticated with GitHub.');
    }
    const { data } = await this.octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated'
    });
    return data.map(repo => ({
      name: repo.name,
      clone_url: repo.clone_url,
      private: repo.private
    }));
  }
}
