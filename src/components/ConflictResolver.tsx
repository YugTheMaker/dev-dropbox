import React, { useState } from 'react';
import { Project, useSync } from '../context/SyncContext';
import { X, ShieldAlert, CheckCircle2, ChevronRight, FileCode, Loader2 } from 'lucide-react';

interface ConflictResolverProps {
  project: Project;
  onClose: () => void;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({ project, onClose }) => {
  const { resolveConflict } = useSync();
  const [resolvingState, setResolvingState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  const conflicts = project.conflictFiles || [];

  const handleResolve = async (strategy: 'ours' | 'theirs') => {
    const fileToResolve = conflicts[activeFileIndex];
    if (!fileToResolve) return;

    setResolvingState('loading');
    try {
      await resolveConflict(project.path, fileToResolve, strategy);
      
      // Move to next file or finish
      if (activeFileIndex < conflicts.length - 1) {
        setActiveFileIndex(activeFileIndex + 1);
        setResolvingState('idle');
      } else {
        setResolvingState('done');
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (e: any) {
      alert(`Conflict resolution failed: ${e.message || e}`);
      setResolvingState('idle');
    }
  };

  const currentFile = conflicts[activeFileIndex];

  return (
    <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass w-full max-w-xl rounded-3xl p-6 shadow-glass border border-red-500/20 flex flex-col gap-4 relative animate-scale-up">
        
        {/* CLOSE BUTTON */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-dark-400 hover:text-white p-1 hover:bg-dark-900 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* TITLE */}
        <div className="flex gap-2 items-center text-red-400 mb-2">
          <ShieldAlert className="w-6 h-6" />
          <h2 className="text-xl font-bold tracking-tight">Resolve Folder Issue</h2>
        </div>

        {resolvingState === 'done' ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-green-400 animate-bounce" />
            <h3 className="text-lg font-bold text-white">All Resolved!</h3>
            <p className="text-sm text-dark-300">We've completed the synchronization for your project.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-dark-300 leading-relaxed">
              We found changes in the same lines of code between your computer and the cloud version.
              Please select how you want to keep the files for <strong>{project.name}</strong>.
            </p>

            {/* PROGRESS COUNTER */}
            <div className="flex justify-between items-center text-xs text-dark-400 font-semibold bg-dark-900/50 px-3 py-2 rounded-xl border border-dark-850">
              <span>File {activeFileIndex + 1} of {conflicts.length}</span>
              <span className="truncate max-w-[70%] font-mono text-brand-400">{currentFile}</span>
            </div>

            {/* RESOLUTION CARD */}
            <div className="bg-dark-900/40 border border-dark-800 rounded-2xl p-4 flex items-start gap-3">
              <FileCode className="w-8 h-8 text-dark-500 shrink-0 mt-0.5" />
              <div className="truncate flex-1">
                <div className="font-bold text-white text-sm truncate">{currentFile ? currentFile.split('/').pop() : ''}</div>
                <div className="text-[10px] text-dark-500 font-mono truncate">{currentFile}</div>
              </div>
            </div>

            {/* OPTIONS CHIP GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              
              {/* OPTION 1: KEEP MY COPY */}
              <button
                disabled={resolvingState === 'loading'}
                onClick={() => handleResolve('ours')}
                className="glass-light hover:border-brand-500/50 hover:bg-brand-950/5 p-5 rounded-2xl flex flex-col gap-2 text-left border border-dark-800 transition active:scale-[0.98] group"
              >
                <span className="font-bold text-white text-sm flex justify-between items-center w-full">
                  Keep My Copy
                  <ChevronRight className="w-4 h-4 text-dark-500 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-xs text-dark-400 leading-relaxed">
                  Discard changes in the cloud and keep the current files on this computer.
                </span>
              </button>

              {/* OPTION 2: KEEP CLOUD COPY */}
              <button
                disabled={resolvingState === 'loading'}
                onClick={() => handleResolve('theirs')}
                className="glass-light hover:border-brand-500/50 hover:bg-brand-950/5 p-5 rounded-2xl flex flex-col gap-2 text-left border border-dark-800 transition active:scale-[0.98] group"
              >
                <span className="font-bold text-white text-sm flex justify-between items-center w-full">
                  Keep Cloud Copy
                  <ChevronRight className="w-4 h-4 text-dark-500 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="text-xs text-dark-400 leading-relaxed">
                  Overwrite local files with the latest updates from your online repository.
                </span>
              </button>

            </div>

            {resolvingState === 'loading' && (
              <div className="flex gap-2 items-center justify-center text-xs text-brand-400 animate-pulse pt-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Applying resolution choice...
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
