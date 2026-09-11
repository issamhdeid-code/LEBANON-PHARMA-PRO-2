import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowRight, AlertCircle, KeyRound, Wifi, WifiOff } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';

// Shown on a Secondary PC before login: pick which synced account this terminal will use.
// Accounts already signed in on another PC are hidden to avoid two terminals sharing one identity.
export const SecondaryUserPicker: React.FC = () => {
  const { users, settings, activeSessions, syncStatus, login } = usePharmacy();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualUsername, setManualUsername] = useState('');
  const [manualPassword, setManualPassword] = useState('');

  const availableUsers = users.filter(u => {
    const heldBy = activeSessions[u.id];
    return !heldBy || heldBy === settings.deviceInstanceId;
  });

  const selectedUser = users.find(u => u.id === selectedId) || null;

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      const res = login(selectedUser.username, password);
      if (!res.success) setError(res.error || 'Invalid password.');
      setIsLoading(false);
    }, 150);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      const res = login(manualUsername, manualPassword);
      if (!res.success) setError(res.error || 'Invalid credentials.');
      setIsLoading(false);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-300 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-teal-800 px-6 py-5 text-white text-center border-b border-teal-900">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded bg-white/10 text-xl font-bold border border-white/20">
            ℞
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wider">Choose Your Account</h2>
          <p className="mt-1 text-xs text-teal-200">{settings.pharmacyName || 'Secondary PC'}</p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-teal-950/60 px-2 py-0.5 text-[10px] font-bold text-teal-200 border border-teal-700/40">
            {syncStatus === 'connected' ? <Wifi className="h-3 w-3 text-emerald-300" /> : <WifiOff className="h-3 w-3 text-amber-300" />}
            {syncStatus === 'connected' ? 'Synced with Main PC' : 'Connecting to Main PC...'}
          </div>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-3 flex items-start rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="mr-1.5 h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!manualMode && (
            <>
              {availableUsers.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                  All accounts are currently signed in on other PCs.
                </p>
              ) : !selectedUser ? (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {availableUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedId(u.id); setPassword(''); setError(null); }}
                      className="w-full flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-left hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                    >
                      <div className="h-9 w-9 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                        {u.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{u.name}</span>
                          {u.role === 'admin' && <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">@{u.username} • {u.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleSignIn} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    <KeyRound className="h-4 w-4 text-teal-600" />
                    Signing in as {selectedUser.name}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="password"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      className="w-full rounded border border-gray-300 bg-white pl-8 pr-2.5 py-2 text-sm text-slate-800 placeholder-gray-400 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSelectedId(null)}
                      className="px-4 py-2 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Back
                    </button>
                    <button type="submit" disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-2 rounded bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">
                      <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}

              <button
                onClick={() => { setManualMode(true); setError(null); }}
                className="mt-4 w-full text-center text-[11px] text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 underline underline-offset-2"
              >
                Enter username & password manually
              </button>
            </>
          )}

          {manualMode && (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <input
                type="text"
                value={manualUsername}
                onChange={(e) => setManualUsername(e.target.value)}
                placeholder="Username"
                required
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-gray-400 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="password"
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-gray-400 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setManualMode(false); setError(null); }}
                  className="px-4 py-2 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Back
                </button>
                <button type="submit" disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">
                  <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
