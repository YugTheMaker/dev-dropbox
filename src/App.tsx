import React, { useState } from 'react';
import { SyncProvider, useSync, Project } from './context/SyncContext';
import { SetupWizard } from './components/SetupWizard';
import { ProjectCard } from './components/ProjectCard';
import { AddProjectModal } from './components/AddProjectModal';
import { ConflictResolver } from './components/ConflictResolver';
import { DiffReviewModal } from './components/DiffReviewModal';
import { 
  Cloud, 
  Plus, 
  RotateCw, 
  Github, 
  LogOut, 
  RefreshCw,
  FolderMinus
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { 
    projects, 
    githubUser, 
    isAuthenticated, 
    isConnectedToDaemon,
    logoutGitHub, 
    synchronizeProject
  } = useSync();

  const [showAddModal, setShowAddModal] = useState(false);
  const [conflictedProject, setConflictedProject] = useState<Project | null>(null);
  const [diffProject, setDiffProject] = useState<Project | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  // Sync all projects
  const handleSyncAll = async () => {
    setSyncingAll(true);
    const syncPromises = projects
      .filter(p => p.status !== 'error' && p.status !== 'conflicted')
      .map(async (project) => {
        try {
          await synchronizeProject(project.path);
        } catch (e: any) {
          if (e.message === 'conflict') {
            setConflictedProject(project);
          }
        }
      });
    
    await Promise.all(syncPromises);
    setSyncingAll(false);
  };

  const isAnySyncing = projects.some(p => p.status === 'syncing') || syncingAll;

  return (
    <div className="h-full flex flex-col bg-dark-950 text-dark-50 select-none">
      
      {/* NATIVE HEADER / BAR */}
      <header className="glass border-b border-dark-800/40 px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-brand-500 p-1.5 rounded-xl shadow-lg shadow-brand-500/20 text-white">
            <Cloud className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white">Dev Dropbox</span>
        </div>

        {/* CLOUD CONNECTION STATUS / ACCOUNT */}
        <div className="flex items-center gap-3">
          {isAuthenticated && githubUser ? (
            <div className="flex items-center gap-2 bg-dark-900/60 border border-dark-800/80 px-3 py-1.5 rounded-full text-xs">
              <img 
                src={githubUser.avatarUrl || 'https://github.com/identicons/guest.png'} 
                alt={githubUser.username}
                className="w-5 h-5 rounded-full ring-1 ring-brand-500/40"
              />
              <span className="font-semibold text-white truncate max-w-[80px]">
                {githubUser.username}
              </span>
              <button 
                onClick={logoutGitHub}
                title="Disconnect GitHub account"
                className="text-dark-500 hover:text-red-400 p-0.5 rounded transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-dark-900/60 border border-dark-800/80 px-3 py-1.5 rounded-full text-xs text-dark-400">
              <Github className="w-4 h-4 text-dark-500" />
              <span>Local Mode</span>
            </div>
          )}

          {/* DAEMON RUNNING STATUS */}
          <div className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnectedToDaemon ? 'bg-green-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnectedToDaemon ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-[10px] text-dark-500 font-semibold uppercase tracking-wider hidden md:inline">
              {isConnectedToDaemon ? 'Daemon Connected' : 'Daemon Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* DASHBOARD CONTROLS */}
      <div className="px-6 py-4 flex justify-between items-center shrink-0 bg-dark-950">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Tracked Folders</h1>
          <p className="text-xs text-dark-400">We monitor these directories and keep them sync'd.</p>
        </div>

        <div className="flex gap-2">
          {projects.length > 0 && (
            <button 
              onClick={handleSyncAll}
              disabled={isAnySyncing}
              className="bg-dark-900 border border-dark-800 hover:bg-dark-850 disabled:bg-dark-900 text-brand-400 hover:text-brand-300 disabled:text-dark-600 text-xs font-bold px-4 py-2.5 rounded-2xl transition flex items-center gap-1.5"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isAnySyncing ? 'animate-spin' : ''}`} />
              Sync All
            </button>
          )}

          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-lg hover:shadow-brand-500/10 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Folder
          </button>
        </div>
      </div>

      {/* CARD GRID / CONTENT AREA */}
      <main className="flex-1 overflow-y-auto px-6 pb-6 bg-dark-950">
        {projects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 glass rounded-3xl border border-dark-800/40">
            <div className="bg-dark-900 p-5 rounded-3xl border border-dark-800/60 mb-4 text-dark-400">
              <FolderMinus className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No tracked folders yet</h3>
            <p className="text-xs text-dark-400 max-w-xs leading-relaxed mb-6">
              Track your first coding project folder to keep it safely synchronized with local and cloud backups.
            </p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-lg transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Project Folder
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {projects.map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onOpenConflict={setConflictedProject}
                onOpenDiff={setDiffProject}
              />
            ))}
          </div>
        )}
      </main>

      {/* MODALS */}
      {showAddModal && (
        <AddProjectModal onClose={() => setShowAddModal(false)} />
      )}

      {conflictedProject && (
        <ConflictResolver 
          project={conflictedProject} 
          onClose={() => setConflictedProject(null)} 
        />
      )}

      {diffProject && (
        <DiffReviewModal 
          project={diffProject} 
          onClose={() => setDiffProject(null)} 
        />
      )}

    </div>
  );
};

const AppContent: React.FC = () => {
  const { isConnectedToDaemon, loading } = useSync();
  const [setupCompleted, setSetupCompleted] = useState<boolean>(() => {
    return localStorage.getItem('dev_dropbox_setup_done') === 'true';
  });

  if (loading && !isConnectedToDaemon) {
    return (
      <div className="h-full bg-dark-950 flex flex-col items-center justify-center text-center p-6 text-dark-50">
        <div className="glass rounded-3xl p-8 max-w-sm border border-dark-850 flex flex-col items-center space-y-4">
          <RefreshCw className="w-10 h-10 text-brand-400 animate-spin" />
          <h2 className="text-lg font-bold text-white tracking-tight">Connecting...</h2>
          <p className="text-xs text-dark-400 leading-relaxed">
            Establishing connection to the Dev Dropbox background service. Please ensure Node.js is installed.
          </p>
        </div>
      </div>
    );
  }

  if (!setupCompleted) {
    return (
      <div className="h-full bg-dark-950 flex items-center justify-center p-4">
        <SetupWizard onComplete={() => {
          localStorage.setItem('dev_dropbox_setup_done', 'true');
          setSetupCompleted(true);
        }} />
      </div>
    );
  }

  return <Dashboard />;
};

function App() {
  return (
    <SyncProvider>
      <AppContent />
    </SyncProvider>
  );
}

export default App;
