import React, { useState, useEffect } from 'react';
import { useSync } from '../context/SyncContext';
import { X, FolderPlus, CheckCircle2, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';

interface AddProjectModalProps {
  onClose: () => void;
}

export const AddProjectModal: React.FC<AddProjectModalProps> = ({ onClose }) => {
  const { addProject, validateFolder } = useSync();
  const [folderPath, setFolderPath] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [createGitignore, setCreateGitignore] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const handleSelectFolder = async () => {
    try {
      const res = await fetch('http://127.0.0.1:36911/api/dialog/select-folder', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.path) {
          setFolderPath(data.path);
        }
      }
    } catch (e) {
      console.error('Failed to open native folder dialog:', e);
    }
  };

  // Debounced directory validation
  useEffect(() => {
    if (!folderPath) {
      setValidationResult(null);
      setError('');
      return;
    }

    const timer = setTimeout(async () => {
      setValidating(true);
      setError('');
      try {
        const result = await validateFolder(folderPath);
        setValidationResult(result);
      } catch (e: any) {
        setError(e.message || 'Folder validation failed.');
        setValidationResult(null);
      } finally {
        setValidating(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [folderPath, validateFolder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderPath.trim()) return;

    if (validationResult && !validationResult.isValid) {
      setError(validationResult.error || 'This folder cannot be added.');
      return;
    }

    setAdding(true);
    setError('');
    try {
      await addProject(folderPath.trim(), createGitignore);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to add project folder.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass w-full max-w-lg rounded-3xl p-6 shadow-glass border border-dark-700/60 flex flex-col gap-4 relative animate-scale-up">
        
        {/* CLOSE BUTTON */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-dark-400 hover:text-white p-1 hover:bg-dark-900 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* TITLE */}
        <div className="flex gap-2 items-center text-white mb-2">
          <FolderPlus className="w-6 h-6 text-brand-400" />
          <h2 className="text-xl font-bold tracking-tight">Add Project Folder</h2>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider block">
              Folder Directory Path
            </label>
            <div className="flex gap-2">
              <input 
                type="text"
                autoFocus
                placeholder="Choose or paste directory path..."
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                className="flex-1 bg-dark-900 border border-dark-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-white placeholder-dark-600 transition"
              />
              <button
                type="button"
                onClick={handleSelectFolder}
                className="bg-dark-800 hover:bg-dark-700 text-white text-xs font-semibold px-4 rounded-xl border border-dark-700/80 transition"
              >
                Browse...
              </button>
            </div>
          </div>

          {/* Validation Feedback */}
          {validating && (
            <div className="text-xs text-brand-400 animate-pulse flex items-center gap-1.5 py-1">
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
              Scanning folder size and git structures...
            </div>
          )}

          {error && (
            <div className="flex gap-2 items-start text-red-400 text-xs bg-red-500/5 p-3 rounded-2xl border border-red-500/10">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {validationResult && (
            <div className="glass-light p-4 rounded-2xl space-y-2.5 border border-dark-800/30 text-xs">
              {validationResult.isValid ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Safe to track</span>
                  </div>
                  <div className="text-dark-300">
                    Contains <strong className="text-white">{validationResult.fileCount} files</strong> ({validationResult.totalSizeMb} MB).
                  </div>
                  
                  {!validationResult.hasGitignore && validationResult.suggestedGitignore && (
                    <label className="flex items-center gap-2 bg-dark-900/50 p-2.5 rounded-xl cursor-pointer hover:bg-dark-900 border border-dark-850">
                      <input 
                        type="checkbox"
                        checked={createGitignore}
                        onChange={(e) => setCreateGitignore(e.target.checked)}
                        className="rounded text-brand-500 focus:ring-brand-500 h-4 w-4 bg-dark-900 border-dark-700"
                      />
                      <span className="text-dark-300 select-none">
                        Auto-create `.gitignore` (ignores dependency logs and env files)
                      </span>
                    </label>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2 text-red-400">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                  <span>{validationResult.error}</span>
                </div>
              )}

              {validationResult.isValid && validationResult.isOversized && (
                <div className="flex gap-2 items-start text-amber-400 bg-amber-400/5 p-2.5 rounded-xl border border-amber-400/10">
                  <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                  <span>
                    <strong>Warning:</strong> This folder contains a large number of files. Ensure build dependencies (like `node_modules`) are ignored.
                  </span>
                </div>
              )}

              {validationResult.isValid && validationResult.hasNestedRepos && (
                <div className="flex gap-2 items-start text-amber-400 bg-amber-400/5 p-2.5 rounded-xl border border-amber-400/10">
                  <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                  <span>
                    <strong>Warning:</strong> This folder has git sub-repositories inside. Sync logic applies only to the root.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-800/40">
            <button 
              type="button"
              onClick={onClose}
              disabled={adding}
              className="text-xs text-dark-300 hover:text-white font-bold px-4 py-3 rounded-2xl transition"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={adding || !folderPath || (validationResult && !validationResult.isValid)}
              className="bg-brand-500 hover:bg-brand-600 disabled:bg-dark-800 disabled:text-dark-500 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-lg transition flex items-center gap-1.5"
            >
              {adding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Adding Folder...
                </>
              ) : (
                'Add Folder'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
