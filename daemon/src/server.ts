import express from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { exec } from 'child_process';
import { platform, homedir } from 'os';
import fs from 'fs';
import path from 'path';
import { 
  validateProjectFolder, 
  writeSuggestedGitignore,
  getProjectStatus,
  synchronizeProject,
  resolveConflict,
  publishProject,
  initializeGitRepository,
  isGitRepository,
  GitHubHost
} from 'core';
import { loadConfig, saveConfig, AppConfig } from './config.js';
import { FolderWatcher } from './watcher.js';

let appConfig: AppConfig = loadConfig();
const githubHost = new GitHubHost();
const folderWatcher = new FolderWatcher();
let wsServer: WebSocketServer;
const clients = new Set<WebSocket>();

// Create default DevDropbox folder on startup
const defaultSyncDir = path.join(homedir(), 'DevDropbox');
if (!fs.existsSync(defaultSyncDir)) {
  fs.mkdirSync(defaultSyncDir, { recursive: true });
  console.log(`Created default DevDropbox folder at: ${defaultSyncDir}`);
}

// Auto-authenticate with GitHub on startup if we have a token saved
if (appConfig.githubToken) {
  githubHost.authenticate(appConfig.githubToken)
    .then(() => console.log('Automatically authenticated with GitHub.'))
    .catch((err) => {
      console.warn('Saved GitHub token failed authentication:', err.message);
      // Remove invalid token
      appConfig.githubToken = undefined;
      appConfig.githubUser = undefined;
      saveConfig(appConfig);
    });
}

// Watch initial folders
for (const projectPath of appConfig.projects) {
  folderWatcher.watchFolder(projectPath);
}

// Setup watcher callback to broadcast to connected React frontends
folderWatcher.onStatusChange((projectStatus) => {
  const message = JSON.stringify({
    type: 'project-updated',
    data: projectStatus
  });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
});

export function setupServer(): { server: HTTPServer; app: express.Application } {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Link opener route to delegate link launching to host system default browser
  app.post('/api/open-link', (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const start = platform() === 'win32' ? 'start' : platform() === 'darwin' ? 'open' : 'xdg-open';
    exec(`${start} "${url.replace(/"/g, '\\"')}"`);
    res.json({ success: true });
  });

  // Native folder browser dialog launcher route
  app.post('/api/dialog/select-folder', (req, res) => {
    if (platform() === 'darwin') {
      const script = `osascript -e 'POSIX path of (choose folder with prompt "Select Project Folder")'`;
      exec(script, (err, stdout) => {
        if (err) return res.json({ path: null }); // User cancelled
        res.json({ path: stdout.trim() });
      });
    } else if (platform() === 'win32') {
      const script = `powershell -Command "& { Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $f.SelectedPath } }"`;
      exec(script, (err, stdout) => {
        if (err) return res.json({ path: null });
        res.json({ path: stdout.trim() });
      });
    } else {
      exec('zenity --file-selection --directory', (err, stdout) => {
        if (err) return res.json({ path: null });
        res.json({ path: stdout.trim() });
      });
    }
  });

  // Native file browser dialog launcher route
  app.post('/api/dialog/select-file', (req, res) => {
    if (platform() === 'darwin') {
      const script = `osascript -e 'POSIX path of (choose file with prompt "Select File to Import")'`;
      exec(script, (err, stdout) => {
        if (err) return res.json({ path: null }); // User cancelled
        res.json({ path: stdout.trim() });
      });
    } else if (platform() === 'win32') {
      const script = `powershell -Command "& { Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $f.FileName } }"`;
      exec(script, (err, stdout) => {
        if (err) return res.json({ path: null });
        res.json({ path: stdout.trim() });
      });
    } else {
      exec('zenity --file-selection', (err, stdout) => {
        if (err) return res.json({ path: null });
        res.json({ path: stdout.trim() });
      });
    }
  });

  const server = createServer(app);
  wsServer = new WebSocketServer({ server });

  wsServer.on('connection', (ws) => {
    clients.add(ws);
    console.log('Tauri client connected to daemon WebSocket.');
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('Tauri client disconnected from daemon WebSocket.');
    });
  });

  // REST API Endpoints
  
  // 1. Get auth status
  app.get('/api/auth/status', async (req, res) => {
    const authenticated = await githubHost.isAuthenticated();
    res.json({
      authenticated,
      user: appConfig.githubUser || null
    });
  });

  // 2. Authenticate with GitHub PAT
  app.post('/api/auth/github', async (req, res) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    try {
      await githubHost.authenticate(token);
      const user = await githubHost.getCurrentUser();
      
      appConfig.githubToken = token;
      appConfig.githubUser = user;
      saveConfig(appConfig);

      res.json({ success: true, user });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Authentication failed.' });
    }
  });

  // 3. Log out GitHub
  app.post('/api/auth/github/logout', (req, res) => {
    appConfig.githubToken = undefined;
    appConfig.githubUser = undefined;
    saveConfig(appConfig);
    res.json({ success: true });
  });

  // 4. Validate Folder before adding
  app.post('/api/projects/validate', async (req, res) => {
    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }

    const result = await validateProjectFolder(folderPath);
    res.json(result);
  });

  // 5. Add Project
  app.post('/api/projects/add', async (req, res) => {
    const { folderPath, createGitignore } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }

    const resolvedPath = require('path').resolve(folderPath);
    
    // Check if already tracking
    if (appConfig.projects.includes(resolvedPath)) {
      return res.status(400).json({ error: 'This folder is already being tracked.' });
    }

    const validation = await validateProjectFolder(resolvedPath);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    // Auto-create gitignore if requested
    if (createGitignore && validation.suggestedGitignore) {
      writeSuggestedGitignore(resolvedPath, validation.suggestedGitignore);
    }

    appConfig.projects.push(resolvedPath);
    saveConfig(appConfig);

    // Watch folder
    folderWatcher.watchFolder(resolvedPath);

    // Return status
    const status = await getProjectStatus(resolvedPath);
    res.json(status);
  });

  // 6. Remove Project (without deleting files)
  app.post('/api/projects/remove', (req, res) => {
    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }

    const resolved = require('path').resolve(folderPath);
    appConfig.projects = appConfig.projects.filter(p => p !== resolved);
    saveConfig(appConfig);

    folderWatcher.unwatchFolder(resolved);
    res.json({ success: true });
  });

  // 7. Get Projects and their status
  app.get('/api/projects', async (req, res) => {
    const results = [];
    for (const projectPath of appConfig.projects) {
      try {
        const status = await getProjectStatus(projectPath);
        results.push(status);
      } catch (e: any) {
        results.push({
          id: Buffer.from(projectPath).toString('base64url'),
          name: require('path').basename(projectPath),
          path: projectPath,
          status: 'error',
          errorMessage: e.message || 'Failed to check status'
        });
      }
    }
    res.json(results);
  });

  // 8. Initialize Git Repository
  app.post('/api/projects/initialize', async (req, res) => {
    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }

    try {
      await initializeGitRepository(folderPath);
      const status = await getProjectStatus(folderPath);
      res.json(status);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Initialization failed' });
    }
  });

  // 9. Synchronize Project
  app.post('/api/projects/sync', async (req, res) => {
    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }

    try {
      await synchronizeProject(folderPath);
      const status = await getProjectStatus(folderPath);
      res.json({ success: true, status });
    } catch (e: any) {
      if (e.message === 'conflict') {
        const status = await getProjectStatus(folderPath);
        res.status(409).json({ error: 'conflict', status });
      } else {
        res.status(500).json({ error: e.message || 'Sync failed.' });
      }
    }
  });

  // 10. Resolve conflict
  app.post('/api/projects/resolve', async (req, res) => {
    const { folderPath, fileName, strategy } = req.body;
    if (!folderPath || !fileName || !strategy) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
      await resolveConflict(folderPath, fileName, strategy);
      const status = await getProjectStatus(folderPath);
      res.json(status);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to resolve conflict.' });
    }
  });

  // 11. Publish to Cloud
  app.post('/api/projects/publish', async (req, res) => {
    const { folderPath, repoName, isPrivate, readmeNote } = req.body;
    if (!folderPath || !repoName) {
      return res.status(400).json({ error: 'Folder path and repo name are required' });
    }

    try {
      // Write custom maker description to README.md if provided
      if (readmeNote && readmeNote.trim()) {
        const path = require('path');
        const fs = require('fs');
        const readmePath = path.join(folderPath, 'README.md');
        let currentContent = '';
        if (fs.existsSync(readmePath)) {
          currentContent = fs.readFileSync(readmePath, 'utf8');
        } else {
          currentContent = `# ${repoName}\nCreated with Dev Dropbox.`;
        }
        const updatedContent = `${currentContent}\n\n## About the Maker\n${readmeNote.trim()}\n`;
        fs.writeFileSync(readmePath, updatedContent, 'utf8');
      }

      // 1. Create remote repo on GitHub
      const { html_url } = await githubHost.createRepo(repoName, !!isPrivate);
      
      let authenticatedUrl = html_url;
      if (appConfig.githubToken) {
        authenticatedUrl = html_url.replace('https://github.com/', `https://x-access-token:${appConfig.githubToken}@github.com/`);
      }

      // 2. Publish/push local project to origin
      await publishProject(folderPath, authenticatedUrl);
      
      const status = await getProjectStatus(folderPath);
      res.json({ success: true, status });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to publish project to GitHub.' });
    }
  });

  // 12. Get File Diff
  app.post('/api/projects/diff', async (req, res) => {
    const { folderPath, fileName } = req.body;
    if (!folderPath || !fileName) {
      return res.status(400).json({ error: 'Folder path and file name are required' });
    }

    try {
      const path = require('path');
      const fs = require('fs');
      const simpleGit = require('simple-git');
      
      const absolutePath = path.resolve(folderPath);
      const git = simpleGit(absolutePath);
      
      // Ensure it's a relative path for Git
      const relativePath = path.relative(absolutePath, path.resolve(absolutePath, fileName));
      
      let originalContent = '';
      let modifiedContent = '';

      // 1. Get original content from HEAD
      try {
        originalContent = await git.show([`HEAD:${relativePath}`]);
      } catch {
        // File is probably untracked/newly created, so original is empty
      }

      // 2. Get modified content from disk
      const diskPath = path.join(absolutePath, relativePath);
      if (fs.existsSync(diskPath)) {
        try {
          modifiedContent = fs.readFileSync(diskPath, 'utf8');
        } catch {
          // File might be deleted
        }
      }

      res.json({
        original: originalContent,
        modified: modifiedContent
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to get file diff' });
    }
  });

  // Get all repositories for the authenticated GitHub user
  app.get('/api/github/repos', async (req, res) => {
    if (!githubHost.isAuthenticated()) {
      return res.status(401).json({ error: 'GitHub is not authenticated.' });
    }
    try {
      if (githubHost.listRepos) {
        const repos = await githubHost.listRepos();
        res.json(repos);
      } else {
        res.status(501).json({ error: 'List repositories method not implemented.' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to list GitHub repositories.' });
    }
  });

  // Clone a remote repository to default local folder and track it
  app.post('/api/projects/clone', async (req, res) => {
    const { cloneUrl, repoName } = req.body;
    if (!cloneUrl || !repoName) {
      return res.status(400).json({ error: 'Clone URL and Repo Name are required.' });
    }

    try {
      const syncDir = path.join(homedir(), 'DevDropbox');
      let targetPath = path.join(syncDir, repoName);
      
      // Handle naming conflicts (e.g. if folder already exists)
      let counter = 1;
      while (fs.existsSync(targetPath)) {
        targetPath = path.join(syncDir, `${repoName}-${counter}`);
        counter++;
      }

      // Clone via git
      const simpleGit = require('simple-git');
      fs.mkdirSync(targetPath, { recursive: true });
      const git = simpleGit(targetPath);

      let authenticatedUrl = cloneUrl;
      if (appConfig.githubToken) {
        authenticatedUrl = cloneUrl.replace('https://github.com/', `https://x-access-token:${appConfig.githubToken}@github.com/`);
      }
      await git.clone(authenticatedUrl, targetPath);

      // Verify clone succeeded and register project
      if (!appConfig.projects.includes(targetPath)) {
        appConfig.projects.push(targetPath);
        saveConfig(appConfig);
        folderWatcher.watchFolder(targetPath);
      }

      const status = await getProjectStatus(targetPath);
      res.json({ success: true, status });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to clone repository.' });
    }
  });

  // Create GitHub Repository and Import Files/Folders
  app.post('/api/projects/create-and-import', async (req, res) => {
    const { repoName, isPrivate, importType, importPath } = req.body;
    if (!repoName || !importType) {
      return res.status(400).json({ error: 'Repository name and import type are required.' });
    }

    if (!githubHost.isAuthenticated()) {
      return res.status(401).json({ error: 'GitHub is not authenticated.' });
    }

    try {
      // 1. Create remote repository on GitHub
      const { html_url } = await githubHost.createRepo(repoName, !!isPrivate);

      let targetPath = '';

      if (importType === 'folder') {
        if (!importPath) {
          return res.status(400).json({ error: 'Folder path is required for folder import.' });
        }
        targetPath = require('path').resolve(importPath);

        // Validate folder
        const validation = await validateProjectFolder(targetPath);
        if (!validation.isValid) {
          return res.status(400).json({ error: validation.error });
        }

        // Initialize Git if not a repository
        const isRepo = await isGitRepository(targetPath);
        if (!isRepo) {
          await initializeGitRepository(targetPath);
        }

        // Suggest gitignore if missing
        if (!validation.hasGitignore && validation.suggestedGitignore) {
          writeSuggestedGitignore(targetPath, validation.suggestedGitignore);
        }

        let authenticatedUrl = html_url;
        if (appConfig.githubToken) {
          authenticatedUrl = html_url.replace('https://github.com/', `https://x-access-token:${appConfig.githubToken}@github.com/`);
        }

        // Publish to GitHub
        await publishProject(targetPath, authenticatedUrl);

        // Register project
        if (!appConfig.projects.includes(targetPath)) {
          appConfig.projects.push(targetPath);
          saveConfig(appConfig);
          folderWatcher.watchFolder(targetPath);
        }

      } else if (importType === 'file') {
        if (!importPath) {
          return res.status(400).json({ error: 'File path is required for file import.' });
        }
        const sourceFilePath = require('path').resolve(importPath);

        if (!fs.existsSync(sourceFilePath) || !fs.statSync(sourceFilePath).isFile()) {
          return res.status(400).json({ error: 'Selected path is not a valid file.' });
        }

        const syncDir = path.join(homedir(), 'DevDropbox');
        if (!fs.existsSync(syncDir)) {
          fs.mkdirSync(syncDir, { recursive: true });
        }

        let folderName = repoName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        let destFolder = path.join(syncDir, folderName);
        let counter = 1;
        while (fs.existsSync(destFolder)) {
          destFolder = path.join(syncDir, `${folderName}-${counter}`);
          counter++;
        }

        fs.mkdirSync(destFolder, { recursive: true });

        // Copy file
        const fileName = path.basename(sourceFilePath);
        const destFilePath = path.join(destFolder, fileName);
        fs.copyFileSync(sourceFilePath, destFilePath);

        // Write custom README and suggested gitignore
        fs.writeFileSync(
          path.join(destFolder, 'README.md'),
          `# ${repoName}\n\nImported file: \`${fileName}\`\n\nCreated with Dev Dropbox.`,
          'utf8'
        );

        // Write basic gitignore
        const defaultGitignore = `# System Files\n.DS_Store\nThumbs.db\ndesktop.ini\n`;
        fs.writeFileSync(path.join(destFolder, '.gitignore'), defaultGitignore, 'utf8');

        // Initialize Git
        await initializeGitRepository(destFolder);

        let authenticatedUrl = html_url;
        if (appConfig.githubToken) {
          authenticatedUrl = html_url.replace('https://github.com/', `https://x-access-token:${appConfig.githubToken}@github.com/`);
        }

        // Publish to GitHub
        await publishProject(destFolder, authenticatedUrl);

        targetPath = destFolder;

        // Register project
        if (!appConfig.projects.includes(targetPath)) {
          appConfig.projects.push(targetPath);
          saveConfig(appConfig);
          folderWatcher.watchFolder(targetPath);
        }
      }

      const status = targetPath ? await getProjectStatus(targetPath) : null;
      res.json({ success: true, cloneUrl: html_url, status });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to create repository and import.' });
    }
  });

  // Open project in IDE (VSCode or Antigravity)
  app.post('/api/projects/open-ide', (req, res) => {
    const { folderPath, ide } = req.body;
    if (!folderPath || !ide) {
      return res.status(400).json({ error: 'Folder path and IDE are required' });
    }

    try {
      const escapedPath = folderPath.replace(/"/g, '\\"');
      let command = '';
      if (ide === 'vscode') {
        if (platform() === 'darwin') {
          command = `open -a "Visual Studio Code" "${escapedPath}"`;
        } else {
          command = `code "${escapedPath}"`;
        }
      } else if (ide === 'antigravity') {
        if (platform() === 'darwin') {
          command = `open -a "Antigravity IDE" "${escapedPath}" || open -a "Antigravity" "${escapedPath}"`;
        } else {
          return res.status(400).json({ error: 'Antigravity is only supported on macOS.' });
        }
      } else {
        return res.status(400).json({ error: 'Unsupported IDE' });
      }

      exec(command, (err) => {
        if (err) {
          console.error(`Failed to launch IDE: ${err.message}`);
          return res.status(500).json({ error: `Failed to open project in ${ide}` });
        }
        res.json({ success: true });
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to open project' });
    }
  });

  return { server, app };
}

export function shutdownServer() {
  folderWatcher.closeAll();
}
