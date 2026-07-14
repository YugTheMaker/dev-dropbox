import React, { useState, useEffect } from 'react';
import { Project, useSync } from '../context/SyncContext';
import { X, FileText, ChevronRight, Loader2, GitPullRequest, AlertCircle } from 'lucide-react';
import * as Diff from 'diff';

interface DiffReviewModalProps {
  project: Project;
  onClose: () => void;
}

interface DiffLine {
  content: string;
  type: 'added' | 'removed' | 'normal' | 'empty';
  lineNumber?: number;
}

interface DiffLineGroup {
  type: 'hunk' | 'skipped';
  lines?: { left: DiffLine; right: DiffLine }[];
  skippedCount?: number;
}

export const DiffReviewModal: React.FC<DiffReviewModalProps> = ({ project, onClose }) => {
  const { getFileDiff } = useSync();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<{ original: string; modified: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const files = project.recentChanges || [];

  // Automatically select the first file on mount
  useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      setSelectedFile(files[0]);
    }
  }, [files, selectedFile]);

  // Fetch diff details on file select
  useEffect(() => {
    if (!selectedFile) return;

    const fetchDiff = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getFileDiff(project.path, selectedFile);
        setDiffData(data);
      } catch (e: any) {
        setError(e.message || 'Failed to load diff details.');
        setDiffData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDiff();
  }, [selectedFile, project.path, getFileDiff]);

  // Compute aligned diff lines and group them into hunks
  const alignAndHunkDiff = (original: string, modified: string, contextCount = 4) => {
    const changes = Diff.diffLines(original, modified);
    
    const left: DiffLine[] = [];
    const right: DiffLine[] = [];
    
    let leftLineNum = 1;
    let rightLineNum = 1;
    
    for (const change of changes) {
      const lines = change.value.replace(/\n$/, '').split('\n');
      
      if (change.removed) {
        for (const line of lines) {
          left.push({ content: line, type: 'removed', lineNumber: leftLineNum++ });
          right.push({ content: '', type: 'empty' });
        }
      } else if (change.added) {
        for (const line of lines) {
          left.push({ content: '', type: 'empty' });
          right.push({ content: line, type: 'added', lineNumber: rightLineNum++ });
        }
      } else {
        for (const line of lines) {
          left.push({ content: line, type: 'normal', lineNumber: leftLineNum++ });
          right.push({ content: line, type: 'normal', lineNumber: rightLineNum++ });
        }
      }
    }
    
    // Group into hunks based on visibility context
    const total = left.length;
    const isVisible = new Array(total).fill(false);
    
    for (let i = 0; i < total; i++) {
      const isChange = left[i].type === 'removed' || right[i].type === 'added';
      if (isChange) {
        const start = Math.max(0, i - contextCount);
        const end = Math.min(total - 1, i + contextCount);
        for (let j = start; j <= end; j++) {
          isVisible[j] = true;
        }
      }
    }
    
    const groups: DiffLineGroup[] = [];
    let currentGroup: { left: DiffLine; right: DiffLine }[] = [];
    let skippedCount = 0;
    
    for (let i = 0; i < total; i++) {
      if (isVisible[i]) {
        if (skippedCount > 0) {
          groups.push({ type: 'skipped', skippedCount });
          skippedCount = 0;
        }
        currentGroup.push({ left: left[i], right: right[i] });
      } else {
        if (currentGroup.length > 0) {
          groups.push({ type: 'hunk', lines: currentGroup });
          currentGroup = [];
        }
        skippedCount++;
      }
    }
    
    if (skippedCount > 0) {
      groups.push({ type: 'skipped', skippedCount });
    } else if (currentGroup.length > 0) {
      groups.push({ type: 'hunk', lines: currentGroup });
    }
    
    return groups;
  };

  const hunkGroups = diffData ? alignAndHunkDiff(diffData.original, diffData.modified) : [];

  return (
    <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass w-full max-w-6xl h-[85vh] rounded-3xl p-6 shadow-glass border border-dark-700/60 flex flex-col gap-4 relative animate-scale-up">
        
        {/* CLOSE BUTTON */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-dark-400 hover:text-white p-1 hover:bg-dark-900 rounded-lg transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* HEADER */}
        <div className="flex gap-2 items-center text-white mb-1 shrink-0">
          <GitPullRequest className="w-6 h-6 text-brand-400" />
          <div>
            <h2 className="text-xl font-bold tracking-tight">Review Updates</h2>
            <p className="text-xs text-dark-400">See changes waiting in <strong>{project.name}</strong> before synchronizing.</p>
          </div>
        </div>

        {/* WORKSPACE CONTENT SPLIT */}
        <div className="flex-1 flex gap-4 min-h-0">
          
          {/* SIDEBAR FILE LIST (20% width) */}
          <div className="w-[180px] border border-dark-800 rounded-2xl bg-dark-900/20 p-2 overflow-y-auto shrink-0 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-dark-500 tracking-wider px-2 py-1">Modified Files</span>
            <div className="space-y-1">
              {files.map((file) => (
                <button
                  key={file}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                    selectedFile === file 
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/10' 
                      : 'text-dark-300 hover:bg-dark-900/60'
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5 max-w-[85%]">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate" title={file.split('/').pop()}>{file.split('/').pop()}</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                </button>
              ))}
            </div>
          </div>

          {/* SIDE-BY-SIDE DIFF PANELS */}
          <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-dark-400 gap-2 border border-dark-800 rounded-2xl bg-dark-950">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
                <span className="text-xs">Loading comparative view...</span>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center text-red-400 gap-2 border border-red-500/15 rounded-2xl bg-red-950/5">
                <AlertCircle className="w-8 h-8" />
                <span className="text-xs">{error}</span>
              </div>
            ) : diffData ? (
              <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                
                {/* LEFT COLUMN: ORIGINAL (COMMITTED) */}
                <div className="flex-1 flex flex-col h-full overflow-hidden border border-dark-800 rounded-2xl bg-dark-950">
                  <div className="px-4 py-2 border-b border-dark-800 text-xs font-bold text-dark-300 bg-dark-900/60 flex justify-between items-center">
                    <span>Original (Committed)</span>
                    <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">- Removed</span>
                  </div>
                  <div className="flex-1 overflow-auto p-2 font-mono text-[11px] leading-relaxed select-text bg-dark-950">
                    <table className="w-full border-collapse">
                      <tbody>
                        {hunkGroups.map((group, groupIdx) => {
                          if (group.type === 'skipped') {
                            return (
                              <tr key={`skip-${groupIdx}`} className="bg-dark-900/40 text-dark-500">
                                <td className="w-8 text-right pr-3 select-none border-r border-dark-900 text-[9px] py-1 bg-dark-900/20">...</td>
                                <td className="pl-3 whitespace-pre text-left font-mono italic text-[10px] py-1 text-brand-400/80 bg-brand-950/5">
                                  @@ skipped {group.skippedCount} unchanged lines @@
                                </td>
                              </tr>
                            );
                          }
                          return group.lines?.map((line, lineIdx) => (
                            <tr 
                              key={`line-${groupIdx}-${lineIdx}`} 
                              className={`min-h-[20px] ${
                                line.left.type === 'removed' 
                                  ? 'bg-red-950/30 text-red-300 border-l-2 border-red-500' 
                                  : line.left.type === 'empty' 
                                  ? 'bg-dark-900/10 opacity-30 select-none' 
                                  : 'hover:bg-dark-900/20 text-dark-400'
                              }`}
                            >
                              <td className="w-8 text-right pr-3 text-dark-600 select-none border-r border-dark-900 text-[9px]">
                                {line.left.lineNumber || ''}
                              </td>
                              <td className="pl-3 whitespace-pre text-left font-mono">
                                {line.left.type === 'removed' ? '-' : ' '} {line.left.content || ' '}
                              </td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RIGHT COLUMN: MODIFIED (LOCAL) */}
                <div className="flex-1 flex flex-col h-full overflow-hidden border border-dark-800 rounded-2xl bg-dark-950">
                  <div className="px-4 py-2 border-b border-dark-800 text-xs font-bold text-dark-300 bg-dark-900/60 flex justify-between items-center">
                    <span>My Changes (Local)</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">+ Added</span>
                  </div>
                  <div className="flex-1 overflow-auto p-2 font-mono text-[11px] leading-relaxed select-text bg-dark-950">
                    <table className="w-full border-collapse">
                      <tbody>
                        {hunkGroups.map((group, groupIdx) => {
                          if (group.type === 'skipped') {
                            return (
                              <tr key={`skip-right-${groupIdx}`} className="bg-dark-900/40 text-dark-500">
                                <td className="w-8 text-right pr-3 select-none border-r border-dark-900 text-[9px] py-1 bg-dark-900/20">...</td>
                                <td className="pl-3 whitespace-pre text-left font-mono italic text-[10px] py-1 text-brand-400/80 bg-brand-950/5">
                                  @@ skipped {group.skippedCount} unchanged lines @@
                                </td>
                              </tr>
                            );
                          }
                          return group.lines?.map((line, lineIdx) => (
                            <tr 
                              key={`line-right-${groupIdx}-${lineIdx}`} 
                              className={`min-h-[20px] ${
                                line.right.type === 'added' 
                                  ? 'bg-emerald-950/20 text-emerald-300 border-l-2 border-emerald-500' 
                                  : line.right.type === 'empty' 
                                  ? 'bg-dark-900/10 opacity-30 select-none' 
                                  : 'hover:bg-dark-900/20 text-dark-300'
                              }`}
                            >
                              <td className="w-8 text-right pr-3 text-dark-600 select-none border-r border-dark-900 text-[9px]">
                                {line.right.lineNumber || ''}
                              </td>
                              <td className="pl-3 whitespace-pre text-left font-mono">
                                {line.right.type === 'added' ? '+' : ' '} {line.right.content || ' '}
                              </td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-dark-500 gap-2 border border-dark-800 rounded-2xl bg-dark-950">
                <FileText className="w-8 h-8" />
                <span className="text-xs">Select a file to review its changes.</span>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
