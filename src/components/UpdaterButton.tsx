import React, { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { RefreshCw, Download } from 'lucide-react';

export const UpdaterButton: React.FC = () => {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [statusText, setStatusText] = useState('Check for Updates');

  // Check on startup
  useEffect(() => {
    checkForUpdates(true);
  }, []);

  const checkForUpdates = async (silent = false) => {
    if (!silent) setChecking(true);
    try {
      const update = await check();
      if (update) {
        setUpdateAvailable(update);
        setStatusText(`Update v${update.version} Available`);
      } else {
        if (!silent) alert('Your application is up to date!');
      }
    } catch (e) {
      console.error('Failed to check for updates', e);
    } finally {
      if (!silent) setChecking(false);
    }
  };

  const handleInstall = async () => {
    if (!updateAvailable) return;
    setUpdating(true);
    setStatusText('Downloading update...');
    try {
      // Download and install the update
      await updateAvailable.downloadAndInstall();
      setStatusText('Relaunching...');
      // Relaunch app to apply changes
      await relaunch();
    } catch (e: any) {
      alert(`Update failed: ${e.message || e}`);
      setUpdating(false);
      setStatusText('Retry Update');
    }
  };

  if (updateAvailable) {
    return (
      <button
        onClick={handleInstall}
        disabled={updating}
        className="bg-brand-500 hover:bg-brand-600 disabled:bg-dark-800 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-lg shadow-brand-500/20 hover:shadow-brand-500/10 transition flex items-center gap-1.5 animate-pulse"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{statusText}</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => checkForUpdates(false)}
      disabled={checking}
      className="bg-dark-900 border border-dark-800 hover:bg-dark-850 disabled:opacity-50 text-dark-300 hover:text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition flex items-center gap-1.5"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
      <span>{checking ? 'Checking...' : 'Check for Updates'}</span>
    </button>
  );
};
