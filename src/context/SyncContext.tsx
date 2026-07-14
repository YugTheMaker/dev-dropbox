import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type SyncStatus = 'up-to-date' | 'changes-waiting' | 'syncing' | 'conflicted' | 'error';

export interface Project {
  id: string;
  name: string;
  path: string;
  status: SyncStatus;
  remoteUrl?: string;
  lastSynced?: string;
  errorMessage?: string;
  conflictFiles?: string[];
  recentChanges?: string[];
}

export interface GitHubUser {
  username: string;
  avatarUrl?: string;
}

interface SyncContextType {
  projects: Project[];
  githubUser: GitHubUser | null;
  isAuthenticated: boolean;
  isConnectedToDaemon: boolean;
  loading: boolean;
  addProject: (folderPath: string, createGitignore: boolean) => Promise<Project>;
  removeProject: (folderPath: string) => Promise<void>;
  synchronizeProject: (folderPath: string) => Promise<void>;
  initializeProject: (folderPath: string) => Promise<Project>;
  resolveConflict: (folderPath: string, fileName: string, strategy: 'ours' | 'theirs') => Promise<void>;
  publishProject: (folderPath: string, repoName: string, isPrivate: boolean, readmeNote?: string) => Promise<void>;
  validateFolder: (folderPath: string) => Promise<any>;
  authenticateGitHub: (token: string) => Promise<any>;
  logoutGitHub: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  getFileDiff: (folderPath: string, fileName: string) => Promise<{ original: string; modified: string }>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);
const DAEMON_PORT = 36911;
const DAEMON_URL = `http://127.0.0.1:${DAEMON_PORT}`;
const WS_URL = `ws://127.0.0.1:${DAEMON_PORT}`;

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isConnectedToDaemon, setIsConnectedToDaemon] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch all projects status
  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch(`${DAEMON_URL}/api/projects`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.error('Failed to fetch projects:', e);
    }
  }, []);

  // Fetch GitHub auth status
  const checkAuthStatus = useCallback(async () => {
    try {
      const res = await fetch(`${DAEMON_URL}/api/auth/status`);
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(data.authenticated);
        setGithubUser(data.user);
      }
    } catch (e) {
      console.error('Failed to check auth status:', e);
    }
  }, []);

  // Establish WebSocket connection with retry loop
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let initialLoadsDone = false;

    const connectWS = () => {
      console.log('Connecting to daemon WebSocket...');
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        console.log('Connected to daemon WebSocket!');
        setIsConnectedToDaemon(true);
        
        // Fetch initial data once connected
        if (!initialLoadsDone) {
          Promise.all([refreshProjects(), checkAuthStatus()]).then(() => {
            setLoading(false);
            initialLoadsDone = true;
          });
        }
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'project-updated') {
            const updatedProject = message.data as Project;
            setProjects((prev) => 
              prev.map((p) => p.path === updatedProject.path ? updatedProject : p)
            );
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      socket.onclose = () => {
        console.warn('Daemon WebSocket connection closed. Retrying in 3 seconds...');
        setIsConnectedToDaemon(false);
        reconnectTimeout = setTimeout(connectWS, 3000);
      };

      socket.onerror = (err) => {
        console.error('Daemon WebSocket encountered error:', err);
        socket?.close();
      };
    };

    connectWS();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [refreshProjects, checkAuthStatus]);

  // Folder validation
  const validateFolder = async (folderPath: string) => {
    const res = await fetch(`${DAEMON_URL}/api/projects/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Validation failed');
    }
    return await res.json();
  };

  // Add a project
  const addProject = async (folderPath: string, createGitignore: boolean) => {
    const res = await fetch(`${DAEMON_URL}/api/projects/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath, createGitignore })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add project');
    }
    const newProject = await res.json();
    setProjects((prev) => [...prev, newProject]);
    return newProject;
  };

  // Remove a project
  const removeProject = async (folderPath: string) => {
    const res = await fetch(`${DAEMON_URL}/api/projects/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to remove project');
    }
    setProjects((prev) => prev.filter((p) => p.path !== folderPath));
  };

  // Synchronize a project (pull + push)
  const synchronizeProject = async (folderPath: string) => {
    // 1. Locally set state to syncing for immediate UI feedback
    setProjects((prev) => 
      prev.map((p) => p.path === folderPath ? { ...p, status: 'syncing' } : p)
    );

    try {
      const res = await fetch(`${DAEMON_URL}/api/projects/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath })
      });

      if (res.status === 409) {
        // Conflict occurred
        const data = await res.json();
        setProjects((prev) => 
          prev.map((p) => p.path === folderPath ? data.status : p)
        );
        throw new Error('conflict');
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Sync failed');
      }

      const data = await res.json();
      setProjects((prev) => 
        prev.map((p) => p.path === folderPath ? data.status : p)
      );
    } catch (e: any) {
      // Re-fetch project status to ensure state matches disk in case of network timeouts
      await refreshProjects();
      throw e;
    }
  };

  // Initialize Git on a folder
  const initializeProject = async (folderPath: string) => {
    const res = await fetch(`${DAEMON_URL}/api/projects/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to initialize Git');
    }
    const updated = await res.json();
    setProjects((prev) => 
      prev.map((p) => p.path === folderPath ? updated : p)
    );
    return updated;
  };

  // Resolve a conflict
  const resolveConflict = async (folderPath: string, fileName: string, strategy: 'ours' | 'theirs') => {
    const res = await fetch(`${DAEMON_URL}/api/projects/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath, fileName, strategy })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to resolve conflict');
    }
    const updated = await res.json();
    setProjects((prev) => 
      prev.map((p) => p.path === folderPath ? updated : p)
    );
  };

  // Publish local project to GitHub
  const publishProject = async (folderPath: string, repoName: string, isPrivate: boolean, readmeNote?: string) => {
    // Set to syncing while publishing
    setProjects((prev) => 
      prev.map((p) => p.path === folderPath ? { ...p, status: 'syncing' } : p)
    );

    const res = await fetch(`${DAEMON_URL}/api/projects/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath, repoName, isPrivate, readmeNote })
    });

    if (!res.ok) {
      const err = await res.json();
      await refreshProjects(); // Reset status
      throw new Error(err.error || 'Failed to publish project');
    }

    const data = await res.json();
    setProjects((prev) => 
      prev.map((p) => p.path === folderPath ? data.status : p)
    );
  };

  // Authenticate GitHub PAT
  const authenticateGitHub = async (token: string) => {
    const res = await fetch(`${DAEMON_URL}/api/auth/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Authentication failed');
    }
    const data = await res.json();
    setIsAuthenticated(true);
    setGithubUser(data.user);
    return data.user;
  };

  // Logout from GitHub
  const logoutGitHub = async () => {
    const res = await fetch(`${DAEMON_URL}/api/auth/github/logout`, {
      method: 'POST'
    });
    if (res.ok) {
      setIsAuthenticated(false);
      setGithubUser(null);
    }
  };

  const getFileDiff = async (folderPath: string, fileName: string) => {
    const res = await fetch(`${DAEMON_URL}/api/projects/diff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath, fileName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch file diff');
    }
    return await res.json();
  };

  return (
    <SyncContext.Provider value={{
      projects,
      githubUser,
      isAuthenticated,
      isConnectedToDaemon,
      loading,
      addProject,
      removeProject,
      synchronizeProject,
      initializeProject,
      resolveConflict,
      publishProject,
      validateFolder,
      authenticateGitHub,
      logoutGitHub,
      refreshProjects,
      getFileDiff
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};
