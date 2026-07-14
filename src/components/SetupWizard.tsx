import React, { useState } from 'react';
import { useSync } from '../context/SyncContext';
import { Cloud, GitBranch, Shield, ArrowRight, Github, AlertCircle } from 'lucide-react';

interface SetupWizardProps {
  onComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const { authenticateGitHub } = useSync();
  const [step, setStep] = useState(1);
  const [token, setToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  const handleOpenLink = async (url: string) => {
    try {
      await fetch('http://127.0.0.1:36911/api/open-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
    } catch (e) {
      console.error('Failed to open link:', e);
    }
  };

  const handleAuth = async () => {
    if (!token.trim()) {
      setAuthError('Please enter a valid personal access token.');
      return;
    }
    setAuthenticating(true);
    setAuthError('');
    try {
      await authenticateGitHub(token.trim());
      onComplete(); // Immediately finish setup upon successful auth
    } catch (e: any) {
      setAuthError(e.message || 'Could not authenticate. Check your token.');
    } finally {
      setAuthenticating(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto glass p-8 rounded-3xl shadow-glass flex flex-col justify-between min-h-[440px] border border-dark-700/50">
      
      {/* HEADER */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-brand-400">
          <Cloud className="w-8 h-8 animate-pulse" />
          <span className="font-extrabold text-2xl tracking-tight text-white">Dev Dropbox</span>
        </div>
        <div className="h-1 bg-dark-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-brand-500 transition-all duration-500 ease-out" 
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>
      </div>

      {/* STEP CONTENT */}
      <div className="flex-1 flex flex-col justify-center my-4">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white tracking-tight">Welcome to Dev Dropbox!</h2>
            <p className="text-dark-300 text-sm leading-relaxed">
              We make Git invisible and simple. No terminals, no complicated commands, no merge conflicts to fear. Just choose your code folders and we keep them synchronized in the cloud automatically—just like Dropbox.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="glass-light p-4 rounded-2xl flex gap-3 items-start border border-dark-800/30">
                <GitBranch className="w-6 h-6 text-brand-400 shrink-0" />
                <div>
                  <h3 className="font-semibold text-white text-sm">Automatic Sync</h3>
                  <p className="text-xs text-dark-400">Files save in real-time. Commits and pulls happen silently.</p>
                </div>
              </div>
              
              <div className="glass-light p-4 rounded-2xl flex gap-3 items-start border border-dark-800/30">
                <Shield className="w-6 h-6 text-brand-400 shrink-0" />
                <div>
                  <h3 className="font-semibold text-white text-sm">Never Lose Code</h3>
                  <p className="text-xs text-dark-400">Safe, non-destructive merges ensure your changes are never deleted.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Github className="w-6 h-6" /> Connect GitHub
            </h2>
            <p className="text-dark-300 text-sm leading-relaxed">
              Log in to GitHub to sync your projects online. Enter a Personal Access Token (Classic) with <code className="bg-dark-800 text-brand-400 px-1 py-0.5 rounded text-xs">repo</code> permissions.
            </p>

            <div className="space-y-2 mt-4">
              <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider block">GitHub Access Token</label>
              <input 
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-dark-900 border border-dark-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-white placeholder-dark-600 transition"
              />
              {authError && (
                <div className="flex gap-2 items-center text-red-400 text-xs mt-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-dark-500">
              Need a token? <button type="button" onClick={() => handleOpenLink('https://github.com/settings/tokens/new?scopes=repo')} className="text-brand-400 hover:underline">Click here to create one</button>. We store tokens securely locally.
            </p>
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex justify-between items-center mt-6">
        {step > 1 ? (
          <button 
            onClick={() => setStep(step - 1)}
            disabled={authenticating}
            className="text-xs text-dark-400 hover:text-white font-semibold transition px-4 py-2"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        {step === 1 && (
          <button 
            onClick={() => setStep(2)}
            className="bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-bold px-6 py-3 rounded-2xl shadow-lg hover:shadow-brand-500/20 transition flex items-center gap-1.5 group"
          >
            Start Setup <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        )}

        {step === 2 && (
          <div className="flex gap-4 items-center justify-end w-full">
            <button 
              onClick={handleAuth}
              disabled={authenticating}
              className="bg-brand-500 hover:bg-brand-600 disabled:bg-dark-800 text-white text-sm font-bold px-6 py-3 rounded-2xl shadow-lg transition flex items-center gap-1.5"
            >
              {authenticating ? 'Connecting...' : 'Connect Cloud'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
