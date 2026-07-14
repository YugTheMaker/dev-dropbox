export type SyncStatus = 
  | 'up-to-date' 
  | 'changes-waiting' 
  | 'syncing' 
  | 'conflicted' 
  | 'error';

export interface Project {
  id: string;
  name: string;
  path: string;
  status: SyncStatus;
  remoteUrl?: string;
  lastSynced?: string;
  errorMessage?: string;
  conflictFiles?: string[];
  recentChanges?: string[]; // Simplified file change list
}

export interface ValidationResult {
  isValid: boolean;
  isHomeOrSystemFolder: boolean;
  isOversized: boolean;
  hasNestedRepos: boolean;
  fileCount: number;
  totalSizeMb: number;
  hasGitignore: boolean;
  suggestedGitignore?: string;
  error?: string;
}

export interface CloudHost {
  id: string;
  name: string;
  isAuthenticated(): Promise<boolean>;
  authenticate(token: string): Promise<void>;
  getCurrentUser(): Promise<{ username: string; avatarUrl?: string }>;
  getRepoInfo(owner: string, repo: string): Promise<{ id: number; html_url: string; private: boolean }>;
  createRepo(name: string, isPrivate: boolean): Promise<{ html_url: string }>;
  listRepos?(): Promise<{ name: string; clone_url: string; private: boolean }[]>;
}
