import express from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { exec } from 'child_process';
import { platform } from 'os';
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
      
      // 2. Publish/push local project to origin
      await publishProject(folderPath, html_url);
      
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

  return { server, app };
}

export function shutdownServer() {
  folderWatcher.closeAll();
}
