import React, { useState } from 'react';
import { Lock, User as UserIcon, Shield, AlertCircle, ArrowRight, Calendar, Archive } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';

export const LoginModal: React.FC = () => {
  const { login, settings, workingYear, closedYears } = usePharmacy();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(workingYear);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      const res = login(username, password, selectedYear);
      if (!res.success) {
        setError(res.error || 'Invalid credentials');
      }
      setIsLoading(false);
    }, 200);
  };

  const isSelectedYearArchived = closedYears.some(r => r.year === selectedYear);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-sm overflow-hidden rounded border border-gray-300 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header Branding */}
        <div className="bg-teal-800 px-5 py-4 text-white text-center relative border-b border-teal-900">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded bg-white/10 text-xl font-bold border border-white/20">
            ℞
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wider">Pharmacy Management System</h2>
          <p className="mt-0.5 text-[11px] text-teal-200">
            {settings.pharmacyName || 'Offline Multi-PC Management (Lebanon)'}
          </p>
          <div className="mt-2 inline-flex items-center rounded bg-teal-950/60 px-2 py-0.5 text-[10px] font-bold text-teal-200 border border-teal-700/40">
            <Shield className="mr-1 h-3 w-3 text-teal-300" />
            Standalone Offline DB • Dual Currency (L.L. / $)
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && (
            <div className="flex items-start rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="mr-1.5 h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span className="text-[11px]">{error}</span>
            </div>
          )}

          {/* Fiscal / Working Year Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-600 dark:text-slate-300 mb-1">
              Fiscal / Working Year
            </label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full rounded border border-gray-300 bg-white pl-8 pr-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value={workingYear}>
                  {workingYear} (Active Year)
                </option>
                {closedYears.map((cy) => (
                  <option key={cy.year} value={cy.year}>
                    {cy.year} (Archived - Read Only)
                  </option>
                ))}
              </select>
            </div>
            {isSelectedYearArchived && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                <Archive className="h-3 w-3" />
                This year is closed & sealed. App will start in Read-Only archive mode.
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-600 dark:text-slate-300 mb-1">
              Username
            </label>
            <div className="relative">
              <UserIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                className="w-full rounded border border-gray-300 bg-white pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-gray-400 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-600 dark:text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded border border-gray-300 bg-white pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-gray-400 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center space-x-1.5 rounded bg-teal-700 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-800 focus:outline-hidden cursor-pointer transition-colors disabled:opacity-50 uppercase tracking-wider"
          >
            <span>{isLoading ? 'Signing In...' : `Sign In (${selectedYear})`}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>

        <div className="bg-gray-50 px-4 py-2 text-center text-[10px] text-gray-500 border-t border-gray-200 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-400">
          Ready for packaging into .exe via Visual Studio Code & Electron/Tauri
        </div>
      </div>
    </div>
  );
};
