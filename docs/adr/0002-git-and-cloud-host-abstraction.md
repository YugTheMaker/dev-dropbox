# ADR 0002: Git and Cloud Host Abstraction

## Context and Problem
We want Dev Dropbox to be extensible so it can support not just GitHub but other Git providers (e.g. GitLab, Bitbucket, Gitea) or self-hosted Git configurations. Coupling the core application flow to the GitHub API would make refactoring difficult later.

## Decision
We define an abstract `CloudHost` interface in our core library (`core/src/types.ts`):

```typescript
export interface CloudHost {
  id: string;
  name: string;
  isAuthenticated(): Promise<boolean>;
  authenticate(token: string): Promise<void>;
  getCurrentUser(): Promise<{ username: string; avatarUrl?: string }>;
  getRepoInfo(owner: string, repo: string): Promise<any>;
  createRepo(name: string, isPrivate: boolean): Promise<{ html_url: string }>;
}
```

We implement `GitHubHost` as the first implementation of this interface using Octokit. The backend daemon uses this abstraction to interact with cloud providers.

## Consequences
*   **Pros**:
    *   Adding support for GitLab or Bitbucket in the future only requires implementing the `CloudHost` interface.
    *   Decoupled architecture makes writing mocks for unit testing trivial.
*   **Cons**:
    *   Limits UI interactions to common actions supported by all platforms (e.g. auth, get user, create repo, get info). Advanced provider-specific actions (e.g., managing pull requests or actions) are not represented in this interface. This is acceptable since Dev Dropbox hides advanced Git/host concepts anyway.
