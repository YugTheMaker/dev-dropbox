import React, { useState, useEffect } from 'react';
import { useSync } from '../context/SyncContext';
import { 
  X, 
  Github, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Loader2, 
  FolderPlus, 
  FilePlus, 
  Sparkles,
  Lock,
  Globe
} from 'lucide-react';

interface CreateRepoModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateRepoModal: React.FC<CreateRepoModalProps> = ({ onClose, onSuccess }) => {
  const { createAndImportRepo, selectFile, validateFolder } = useSync();
  
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [importType, setImportType] = useState<'none' | 'file' | 'folder'>('none');
  const [importPath, setImportPath] = useState('');
  
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // Auto-sanitize repo name
  const handleRepoNameChange = (val: string) => {
    const sanitized = val.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    setRepoName(sanitized);
  };

  const handleSelectFolder = async () => {
    try {
      const res = await fetch('http://127.0.0.1:36911/api/dialog/select-folder', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.path) {
          setImportPath(data.path);
        }
      }
    } catch (e) {
      console.error('Failed to open folder dialog:', e);
    }
  };

  const handleSelectFile = async () => {
    try {
      const path = await selectFile();
      if (path) {
        setImportPath(path);
      }
    } catch (e) {
      console.error('Failed to open file dialog:', e);
    }
  };

  // Validate directory path if importing a folder
  useEffect(() => {
    if (importType !== 'folder' || !importPath) {
      setValidationResult(null);
      setError('');
      return;
    }

    const timer = setTimeout(async () => {
      setValidating(true);
      setError('');
      try {
        const result = await validateFolder(importPath);
        setValidationResult(result);
      } catch (e: any) {
        setError(e.message || 'Folder validation failed.');
        setValidationResult(null);
      } finally {
        setValidating(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [importPath, importType, validateFolder]);

  // Reset import path when switching types
  useEffect(() => {
    setImportPath('');
    setValidationResult(null);
    setError('');
  }, [importType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoName.trim()) {
      setError('Please enter a repository name.');
      return;
    }

    if (importType !== 'none' && !importPath) {
      setError(`Please select a ${importType} to import.`);
      return;
    }

    if (importType === 'folder' && validationResult && !validationResult.isValid) {
      setError(validationResult.error || 'This folder cannot be imported.');
      return;
    }

    setCreating(true);
    setError('');
    try {
      await createAndImportRepo(repoName.trim(), isPrivate, importType, importPath);
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Failed to create repository and import.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass w-full max-w-lg rounded-3xl p-6 shadow-glass border border-dark-700/60 flex flex-col gap-4 relative animate-scale-up">
        
        {/* CLOSE BUTTON */}
        <button 
          onClick={onClose}
          disabled={creating}
          className="absolute top-4 right-4 text-dark-400 hover:text-white p-1 hover:bg-dark-900 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* TITLE */}
        <div className="flex gap-2.5 items-center text-white mb-2">
          <div className="bg-brand-500/10 p-2 rounded-xl text-brand-400 border border-brand-500/20">
            <Github className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">New Cloud Folder</h2>
            <p className="text-[10px] text-dark-400 font-semibold uppercase tracking-wider">Create GitHub Repository</p>
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* REPO NAME */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-dark-400 uppercase tracking-wider block">
              Repository Name
            </label>
            <input 
              type="text"
              autoFocus
              placeholder="my-cool-project"
              value={repoName}
              onChange={(e) => handleRepoNameChange(e.target.value)}
              disabled={creating}
              className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-white placeholder-dark-600 transition"
            />
          </div>

          {/* PRIVACY CHOOSER */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-dark-400 uppercase tracking-wider block">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                disabled={creating}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition font-bold text-xs ${
                  isPrivate 
                    ? 'bg-brand-500/10 border-brand-500/35 text-brand-400' 
                    : 'bg-dark-900 border-dark-800 text-dark-400 hover:text-white hover:border-dark-700'
                }`}
              >
                <Lock className="w-4 h-4" />
                Private
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                disabled={creating}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition font-bold text-xs ${
                  !isPrivate 
                    ? 'bg-brand-500/10 border-brand-500/35 text-brand-400' 
                    : 'bg-dark-900 border-dark-800 text-dark-400 hover:text-white hover:border-dark-700'
                }`}
              >
                <Globe className="w-4 h-4" />
                Public
              </button>
            </div>
          </div>

          {/* IMPORT TYPE CHOOSER */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-dark-400 uppercase tracking-wider block">
              Initial Content
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setImportType('none')}
                disabled={creating}
                className={`flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-xl border transition text-center ${
                  importType === 'none' 
                    ? 'bg-brand-500/10 border-brand-500/35 text-brand-400' 
                    : 'bg-dark-900 border-dark-800 text-dark-400 hover:text-white hover:border-dark-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] font-bold">Empty Repository</span>
              </button>

              <button
                type="button"
                onClick={() => setImportType('folder')}
                disabled={creating}
                className={`flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-xl border transition text-center ${
                  importType === 'folder' 
                    ? 'bg-brand-500/10 border-brand-500/35 text-brand-400' 
                    : 'bg-dark-900 border-dark-800 text-dark-400 hover:text-white hover:border-dark-700'
                }`}
              >
                <FolderPlus className="w-4 h-4" />
                <span className="text-[10px] font-bold">Import Folder</span>
              </button>

              <button
                type="button"
                onClick={() => setImportType('file')}
                disabled={creating}
                className={`flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-xl border transition text-center ${
                  importType === 'file' 
                    ? 'bg-brand-500/10 border-brand-500/35 text-brand-400' 
                    : 'bg-dark-900 border-dark-800 text-dark-400 hover:text-white hover:border-dark-700'
                }`}
              >
                <FilePlus className="w-4 h-4" />
                <span className="text-[10px] font-bold">Import File</span>
              </button>
            </div>
          </div>

          {/* PATH SELECTOR */}
          {importType !== 'none' && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-xs font-bold text-dark-400 uppercase tracking-wider block">
                {importType === 'folder' ? 'Local Folder Path' : 'Local File Path'}
              </label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder={importType === 'folder' ? 'Choose local project folder...' : 'Choose file to import...'}
                  value={importPath}
                  onChange={(e) => setImportPath(e.target.value)}
                  disabled={creating}
                  className="flex-1 bg-dark-900 border border-dark-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 text-white placeholder-dark-600 transition"
                />
                <button
                  type="button"
                  onClick={importType === 'folder' ? handleSelectFolder : handleSelectFile}
                  disabled={creating}
                  className="bg-dark-800 hover:bg-dark-700 text-white text-xs font-semibold px-4 rounded-xl border border-dark-700/80 transition"
                >
                  Browse...
                </button>
              </div>
            </div>
          )}

          {/* Validation Feedback for folder */}
          {importType === 'folder' && validating && (
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

          {importType === 'folder' && validationResult && (
            <div className="glass-light p-4 rounded-2xl space-y-2 border border-dark-800/30 text-xs">
              {validationResult.isValid ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-green-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Safe to import and sync</span>
                  </div>
                  <div className="text-dark-300">
                    Contains <strong className="text-white">{validationResult.fileCount} files</strong> ({validationResult.totalSizeMb} MB).
                  </div>
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
                    Warning: Large number of files. Ensure build folders (like target or node_modules) are ignored.
                  </span>
                </div>
              )}
            </div>
          )}

          {importType === 'file' && importPath && (
            <div className="glass-light p-4 rounded-2xl space-y-2 border border-dark-800/30 text-xs text-dark-300 leading-relaxed">
              <div className="flex items-center gap-2 text-brand-400 font-semibold mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ready to import</span>
              </div>
              This file will be copied into <code className="text-white">~/DevDropbox/{repoName}/</code>. We will automatically initialize a sync folder for it.
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-800/40">
            <button 
              type="button"
              onClick={onClose}
              disabled={creating}
              className="text-xs text-dark-300 hover:text-white font-bold px-4 py-3 rounded-2xl transition"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={creating || !repoName || (importType !== 'none' && !importPath) || (importType === 'folder' && validationResult && !validationResult.isValid)}
              className="bg-brand-500 hover:bg-brand-600 disabled:bg-dark-800 disabled:text-dark-500 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-lg transition flex items-center gap-1.5"
            >
              {creating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating Repository...
                </>
              ) : (
                'Create & Sync'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
