import React, { useState } from 'react';
import { Project, useSync } from '../context/SyncContext';
import { 
  CloudUpload, 
  Loader2, 
  AlertTriangle, 
  AlertCircle, 
  Trash2, 
  Share2, 
  GitBranch, 
  FileText,
  FolderOpen
} from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onOpenConflict: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onOpenConflict }) => {
  const { synchronizeProject, initializeProject, removeProject, publishProject, isAuthenticated } = useSync();
  const [syncing, setSyncing] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishInput, setShowPublishInput] = useState(false);
  const [repoName, setRepoName] = useState(project.name.toLowerCase().replace(/[^a-z0-9-_]/g, '-'));
  const [isPrivate, setIsPrivate] = useState(true);
  const [publishError, setPublishError] = useState('');

  const handleSync = async () => {
    setSyncing(true);
    try {
      await synchronizeProject(project.path);
    } catch (e: any) {
      if (e.message === 'conflict') {
        onOpenConflict(project);
      } else {
        alert(`Synchronize failed: ${e.message || e}`);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleInit = async () => {
    setInitializing(true);
    try {
      await initializeProject(project.path);
    } catch (e: any) {
      alert(`Initialization failed: ${e.message || e}`);
    } finally {
      setInitializing(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoName.trim()) {
      setPublishError('Please enter a repository name.');
      return;
    }
    setPublishing(true);
    setPublishError('');
    try {
      await publishProject(project.path, repoName.trim(), isPrivate);
      setShowPublishInput(false);
    } catch (err: any) {
      setPublishError(err.message || 'Failed to publish to GitHub.');
    } finally {
      setPublishing(false);
    }
  };

  const handleRemove = async () => {
    const confirmRemove = window.confirm(
      `Stop tracking "${project.name}"?\n\nThis only stops Dev Dropbox from monitoring this folder. Your files and code will NOT be deleted.`
    );
    if (confirmRemove) {
      try {
        await removeProject(project.path);
      } catch (e: any) {
        alert(`Failed to remove project: ${e.message || e}`);
      }
    }
  };

  const isSyncStatus = project.status === 'syncing' || syncing;

  return (
    <div className={`glass rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between min-h-[260px] relative border ${
      isSyncStatus 
        ? 'syncing-border shadow-glass-hover bg-brand-950/20' 
        : project.status === 'conflicted'
        ? 'border-red-500/35 bg-red-950/5'
        : 'border-dark-700/50 hover:border-dark-600/70 hover:shadow-glass'
    }`}>
      
      {/* CARD TOP INFO */}
      <div>
        <div className="flex justify-between items-start mb-2">
          <div className="truncate max-w-[80%]">
            <h3 className="text-lg font-bold text-white tracking-tight truncate" title={project.name}>
              {project.name}
            </h3>
            <p className="text-xs text-dark-400 truncate flex items-center gap-1 mt-0.5" title={project.path}>
              <FolderOpen className="w-3.5 h-3.5 text-dark-500 shrink-0" />
              <span className="truncate">{project.path}</span>
            </p>
          </div>
          
          {/* Status Pills */}
          <div>
            {project.status === 'up-to-date' && (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Saved & Sync'd
              </span>
            )}
            {project.status === 'changes-waiting' && (
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Sync Waiting
              </span>
            )}
            {project.status === 'syncing' && (
              <span className="bg-brand-500/10 text-brand-400 border border-brand-500/20 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Syncing...
              </span>
            )}
            {project.status === 'conflicted' && (
              <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Resolve Issue
              </span>
            )}
            {project.status === 'error' && (
              <span className="bg-dark-800 text-dark-300 border border-dark-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Setup Needed
              </span>
            )}
          </div>
        </div>

        {/* Error message / Warning message */}
        {project.errorMessage && project.status !== 'up-to-date' && (
          <p className="text-xs text-red-400 mt-2 bg-red-500/5 p-2 rounded-xl border border-red-500/10 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{project.errorMessage}</span>
          </p>
        )}

        {/* Cloud details */}
        {project.remoteUrl && (
          <p className="text-[10px] text-dark-500 mt-1 truncate flex items-center gap-1">
            <GitBranch className="w-3 h-3 text-dark-500" />
            <span>Linked to: {project.remoteUrl}</span>
          </p>
        )}

        {/* Recent file edits list */}
        {project.recentChanges && project.recentChanges.length > 0 && !isSyncStatus && (
          <div className="mt-4 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-dark-500 tracking-wider">Recently edited:</span>
            <div className="space-y-1 max-h-[72px] overflow-y-auto pr-1">
              {project.recentChanges.map((file, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-dark-300 truncate">
                  <FileText className="w-3.5 h-3.5 text-dark-500 shrink-0" />
                  <span className="truncate" title={file}>{file}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inline Publish Form */}
        {showPublishInput && (
          <form onSubmit={handlePublish} className="mt-4 glass-light p-3 rounded-2xl border border-dark-800/40 space-y-2">
            <div className="text-[10px] uppercase font-bold text-dark-400 tracking-wider">Publish to GitHub</div>
            <div className="space-y-1">
              <input 
                type="text"
                placeholder="repo-name"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                className="w-full bg-dark-900 border border-dark-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 text-white"
              />
              <label className="flex items-center gap-1.5 text-[10px] text-dark-400 mt-1 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="rounded text-brand-500 focus:ring-brand-500 h-3 w-3 bg-dark-900 border-dark-700"
                />
                <span>Private Repository</span>
              </label>
            </div>
            {publishError && (
              <p className="text-[10px] text-red-400 leading-tight">{publishError}</p>
            )}
            <div className="flex justify-end gap-2 text-[10px] font-bold">
              <button 
                type="button" 
                onClick={() => setShowPublishInput(false)}
                className="text-dark-400 hover:text-white px-2 py-1"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={publishing}
                className="bg-brand-500 hover:bg-brand-600 text-white rounded px-2.5 py-1"
              >
                {publishing ? 'Publishing...' : 'Upload'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* CARD BOTTOM ACTIONS */}
      <div className="mt-6 flex justify-between items-center gap-2 border-t border-dark-800/40 pt-4 shrink-0">
        
        {/* Left Side: Remove action */}
        <button 
          onClick={handleRemove}
          title="Stop tracking this folder"
          className="text-dark-500 hover:text-red-400 p-2 hover:bg-dark-900 rounded-xl transition shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Right Side: Major Sync actions */}
        <div className="flex gap-2 items-center flex-1 justify-end">
          {/* 1. Initialize action (not git repo) */}
          {project.status === 'error' && !project.remoteUrl && (
            <button 
              onClick={handleInit}
              disabled={initializing}
              className="bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 w-full justify-center"
            >
              {initializing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
              Set Up Sync Folder
            </button>
          )}

          {/* 2. Publish to cloud (git repository but no origin url) */}
          {project.status !== 'error' && !project.remoteUrl && !showPublishInput && (
            <button 
              onClick={() => {
                if (!isAuthenticated) {
                  alert('Please sign in to GitHub in the setup wizard or account settings to upload folders.');
                } else {
                  setShowPublishInput(true);
                }
              }}
              className="bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 w-full justify-center"
            >
              <Share2 className="w-3.5 h-3.5" />
              Upload to GitHub
            </button>
          )}

          {/* 3. Conflict resolution action */}
          {project.status === 'conflicted' && (
            <button 
              onClick={() => onOpenConflict(project)}
              className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg transition flex items-center gap-1.5 w-full justify-center"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Resolve Issues
            </button>
          )}

          {/* 4. Normal Synchronization Button */}
          {project.status !== 'error' && project.status !== 'conflicted' && (project.remoteUrl || project.status === 'changes-waiting') && !showPublishInput && (
            <button 
              onClick={handleSync}
              disabled={isSyncStatus}
              className={`text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 min-w-[120px] justify-center ${
                project.status === 'changes-waiting'
                  ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/20'
                  : 'bg-dark-800 hover:bg-dark-700 text-dark-300'
              }`}
            >
              {isSyncStatus ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <CloudUpload className="w-3.5 h-3.5" />
                  Synchronize
                </>
              )}
            </button>
          )}
        </div>

      </div>

    </div>
  );
};
