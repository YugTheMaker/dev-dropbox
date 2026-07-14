import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { Project, SyncStatus } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export async function isGitRepository(folderPath: string): Promise<boolean> {
  if (!fs.existsSync(path.join(folderPath, '.git'))) {
    return false;
  }
  try {
    const git = simpleGit(folderPath);
    await git.status();
    return true;
  } catch {
    return false;
  }
}

export async function initializeGitRepository(folderPath: string, remoteUrl?: string): Promise<void> {
  const git = simpleGit(folderPath);
  await git.init();
  
  // Set default branch name to main
  try {
    await git.addConfig('init.defaultBranch', 'main');
    await git.checkoutLocalBranch('main');
  } catch {
    // Branch checkout might fail if there are no commits yet, which is fine
  }

  // Create an initial commit if folder has files
  const files = fs.readdirSync(folderPath).filter(f => f !== '.git');
  if (files.length > 0) {
    await git.add('.');
    await git.commit('Dev Dropbox: Initial local files');
  } else {
    // Create a dummy readme or similar to have a commit
    fs.writeFileSync(path.join(folderPath, 'README.md'), `# Project\nCreated with Dev Dropbox.`, 'utf8');
    await git.add('README.md');
    await git.commit('Dev Dropbox: Setup');
  }

  if (remoteUrl) {
    await git.addRemote('origin', remoteUrl);
    await git.push(['-u', 'origin', 'main']);
  }
}

export async function getProjectStatus(folderPath: string): Promise<Project> {
  const absolutePath = path.resolve(folderPath);
  const name = path.basename(absolutePath);
  const git = simpleGit(absolutePath);

  const project: Project = {
    id: Buffer.from(absolutePath).toString('base64url'),
    name,
    path: absolutePath,
    status: 'up-to-date'
  };

  try {
    const isRepo = await isGitRepository(absolutePath);
    if (!isRepo) {
      project.status = 'error';
      project.errorMessage = 'Not a synchronized folder. Click initialize to sync.';
      return project;
    }

    // Get remote url
    try {
      const remotes = await git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      if (origin) {
        project.remoteUrl = origin.refs.push;
      }
    } catch {
      // No remote, which is fine
    }

    // Run a fetch in the background (we catch any network errors silently)
    if (project.remoteUrl) {
      try {
        await git.fetch(['--dry-run']);
      } catch {
        // Network offline or authorization issue
      }
    }

    const status: StatusResult = await git.status();

    // Check for conflict files
    if (status.conflicted.length > 0) {
      project.status = 'conflicted';
      project.conflictFiles = status.conflicted;
      project.errorMessage = `${status.conflicted.length} conflict(s) waiting for resolution.`;
      return project;
    }

    // Collect recent changes for display
    const recentFiles = [
      ...status.modified,
      ...status.created,
      ...status.deleted,
      ...status.not_added
    ].slice(0, 5);
    project.recentChanges = recentFiles;

    // Check if there are local uncommitted changes or unpushed commits
    const hasUncommitted = status.files.length > 0;
    const isAhead = status.ahead > 0;
    const isBehind = status.behind > 0;

    if (hasUncommitted || isAhead) {
      project.status = 'changes-waiting';
      if (hasUncommitted && isAhead) {
        project.errorMessage = 'Local modifications and unsaved commits waiting.';
      } else if (hasUncommitted) {
        project.errorMessage = 'Local modifications waiting to save.';
      } else {
        project.errorMessage = 'Unsaved commits waiting to send to cloud.';
      }
    } else if (isBehind) {
      project.status = 'changes-waiting';
      project.errorMessage = 'Cloud has updates waiting. Click Synchronize to download.';
    } else {
      project.status = 'up-to-date';
    }

  } catch (e: any) {
    project.status = 'error';
    project.errorMessage = `Git status failed: ${e.message || e}`;
  }

  return project;
}

export async function synchronizeProject(
  folderPath: string, 
  deviceName: string = os.hostname()
): Promise<void> {
  const absolutePath = path.resolve(folderPath);
  const git = simpleGit(absolutePath);

  // 1. Auto-commit local uncommitted changes
  const status = await git.status();
  if (status.files.length > 0) {
    await git.add('.');
    const timeStr = new Date().toLocaleString();
    await git.commit(`Dev Dropbox: Auto-save from ${deviceName} on ${timeStr}\n\nSynced using dev-dropbox\nCo-authored-by: Dev Dropbox <support@devdropbox.org>`);
  }

  // 2. Fetch and check remote
  const remotes = await git.getRemotes();
  if (remotes.length === 0) {
    // If there is no remote, we just commit locally, which is done.
    return;
  }

  await git.fetch();
  
  // Get active branch
  const branchResult = await git.branch();
  const currentBranch = branchResult.current;
  
  if (!currentBranch) {
    throw new Error('No active branch found. Please checkout a branch.');
  }

  // 3. Merge from remote tracking branch
  try {
    // Run git merge origin/branchName
    await git.merge([`origin/${currentBranch}`, '--no-edit']);
  } catch (mergeError: any) {
    // Check if it's a conflict
    const postMergeStatus = await git.status();
    if (postMergeStatus.conflicted.length > 0) {
      // Conflicts occurred. We stop here and let the user resolve them.
      throw new Error('conflict');
    } else {
      throw mergeError;
    }
  }

  // 4. Push to remote
  await git.push('origin', currentBranch);
}

export async function resolveConflict(
  folderPath: string,
  fileName: string,
  strategy: 'ours' | 'theirs'
): Promise<void> {
  const absolutePath = path.resolve(folderPath);
  const git = simpleGit(absolutePath);

  if (strategy === 'ours') {
    // Keep local version
    await git.checkout(['--ours', fileName]);
  } else {
    // Keep cloud/remote version
    await git.checkout(['--theirs', fileName]);
  }

  // Stage the file as resolved
  await git.add(fileName);

  // Check if all conflicts are resolved
  const status = await git.status();
  if (status.conflicted.length === 0) {
    // Commit the merge resolution
    await git.commit('Dev Dropbox: Resolved sync conflict');
  }
}

export async function publishProject(
  folderPath: string,
  remoteUrl: string
): Promise<void> {
  const absolutePath = path.resolve(folderPath);
  const git = simpleGit(absolutePath);

  // Auto-commit any local changes before pushing (including README edits)
  const status = await git.status();
  if (status.files.length > 0) {
    await git.add('.');
    await git.commit('Dev Dropbox: Pre-publish save\n\nSynced using dev-dropbox\nCo-authored-by: Dev Dropbox <support@devdropbox.org>');
  }

  const remotes = await git.getRemotes();
  const hasOrigin = remotes.some(r => r.name === 'origin');

  if (hasOrigin) {
    await git.removeRemote('origin');
  }
  
  await git.addRemote('origin', remoteUrl);

  // Find active or default branch
  let currentBranch = 'main';
  try {
    const branchResult = await git.branch();
    currentBranch = branchResult.current || 'main';
  } catch {
    // Fallback
  }

  // Push and track
  await git.push(['-u', 'origin', currentBranch]);
}
