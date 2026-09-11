import React, { useEffect, useState } from 'react';
import {
  Server, Laptop, Building2, UserPlus, Wifi, CheckCircle2, XCircle,
  ArrowRight, ArrowLeft, RefreshCw, ShieldCheck, CloudDownload, AlertTriangle,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { getGoogleDriveClientId, restoreFromGoogleDrive, saveGoogleDriveClientId } from '../../services/googleDriveBackup';

type Step = 'role' | 'secondary-wait' | 'identity' | 'admin';

// Shown once, the very first time the app runs on a PC (no user accounts exist yet).
// Main PC: define the pharmacy identity and create the first admin account here.
// Secondary PC: point at an already-running Main PC and pull all of its data instead.
export const FirstRunSetup: React.FC = () => {
  const { settings, updateSettings, syncStatus, reconnectSync, addUser, users, addNotification, restoreBackup } = usePharmacy();

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<'main' | 'secondary'>('main');
  const [ip, setIp] = useState('');
  const [waitElapsedSec, setWaitElapsedSec] = useState(0);
  const [showCloudRecovery, setShowCloudRecovery] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(() => getGoogleDriveClientId());
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const [identity, setIdentity] = useState({
    pharmacyName: '',
    pharmacyPhone: '',
    pharmacyAddress: '',
    licenseNumber: '',
    exchangeRate: '',
    defaultCurrency: 'BOTH' as 'LBP' | 'USD' | 'BOTH',
    lowStockThreshold: '10',
    expiryWarningDays: '90',
  });
  const [identityError, setIdentityError] = useState<string | null>(null);

  const [admin, setAdmin] = useState({ name: '', username: '', password: '', confirmPassword: '' });
  const [adminError, setAdminError] = useState<string | null>(null);

  // Tick while waiting on the Secondary PC so we can show extra guidance if it takes too long
  useEffect(() => {
    if (step !== 'secondary-wait') return;
    setWaitElapsedSec(0);
    const interval = setInterval(() => setWaitElapsedSec(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [step]);

  const handleChooseSecondary = () => {
    if (!ip.trim()) {
      addNotification('Error', "Enter the Main PC's IP address first.", 'system', 'error');
      return;
    }
    updateSettings({ syncMode: 'secondary', mainPcIp: ip.trim() });
    setStep('secondary-wait');
  };

  const handleChooseMain = () => {
    updateSettings({ syncMode: 'main' });
    setStep('identity');
  };

  const handleCloudRecovery = async () => {
    const clientId = googleClientId.trim();
    if (!clientId) {
      setRecoveryError('Enter the Google OAuth Client ID used by the previous installation.');
      return;
    }

    setIsRecovering(true);
    setRecoveryError(null);
    try {
      saveGoogleDriveClientId(clientId);
      const { backupJson, modifiedTime } = await restoreFromGoogleDrive(clientId);
      const parsed = JSON.parse(backupJson) as { products?: unknown[]; sales?: unknown[] };
      const confirmed = window.confirm(
        `Restore the latest backup from ${modifiedTime ? new Date(modifiedTime).toLocaleString() : 'Google Drive'}?\n\n` +
        `This will restore ${parsed.products?.length || 0} products and ${parsed.sales?.length || 0} sales and replace this PC's local data.`
      );
      if (!confirmed) return;

      const restored = await restoreBackup(backupJson);
      if (!restored) throw new Error('The Google Drive backup is invalid or incomplete.');
      addNotification('Recovery Complete', 'Your pharmacy data was restored from Google Drive. Please sign in.', 'system', 'success');
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : 'Could not restore the pharmacy backup from Google Drive.');
    } finally {
      setIsRecovering(false);
    }
  };

  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = Number(identity.exchangeRate);
    if (!identity.pharmacyName.trim()) {
      setIdentityError('Pharmacy name is required.');
      return;
    }
    if (!rate || rate <= 0) {
      setIdentityError('Enter a valid exchange rate (L.L. per 1 USD).');
      return;
    }
    setIdentityError(null);
    updateSettings({
      pharmacyName: identity.pharmacyName.trim(),
      pharmacyPhone: identity.pharmacyPhone.trim(),
      pharmacyAddress: identity.pharmacyAddress.trim(),
      licenseNumber: identity.licenseNumber.trim(),
      exchangeRate: rate,
      defaultCurrency: identity.defaultCurrency,
      lowStockThreshold: Number(identity.lowStockThreshold) || 10,
      expiryWarningDays: Number(identity.expiryWarningDays) || 90,
    });
    setStep('admin');
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = admin.name.trim();
    const username = admin.username.trim().toLowerCase();
    if (!name || !username || !admin.password) {
      setAdminError('Please fill in your name, username, and password.');
      return;
    }
    if (admin.password.length < 4) {
      setAdminError('Password must be at least 4 characters.');
      return;
    }
    if (admin.password !== admin.confirmPassword) {
      setAdminError('Passwords do not match.');
      return;
    }
    if (users.some(u => u.username.toLowerCase() === username)) {
      setAdminError('That username is already taken.');
      return;
    }
    setAdminError(null);
    addUser({ name, username, password: admin.password, role: 'admin' });
    addNotification('Setup Complete', `Welcome, ${name}! Your pharmacy is ready.`, 'system', 'success');
    // Once addUser updates the users list, the app automatically leaves this
    // wizard and shows the normal Sign In screen.
  };

  const stepIndex = step === 'role' || step === 'secondary-wait' ? 1 : step === 'identity' ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 select-none overflow-y-auto">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-gray-300 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-6">
        <div className="bg-teal-800 px-6 py-5 text-white text-center border-b border-teal-900">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded bg-white/10 text-xl font-bold border border-white/20">
            ℞
          </div>
          <h2 className="text-base font-bold uppercase tracking-wider">Welcome — First-Time Setup</h2>
          <p className="mt-1 text-xs text-teal-200">
            Let's configure this installation before you start using the pharmacy system.
          </p>
          {role === 'main' && (
            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-teal-200">
              <span className={stepIndex >= 1 ? 'font-bold text-white' : ''}>1. PC Role</span>
              <span>›</span>
              <span className={stepIndex >= 2 ? 'font-bold text-white' : ''}>2. Pharmacy Identity</span>
              <span>›</span>
              <span className={stepIndex >= 3 ? 'font-bold text-white' : ''}>3. Admin Account</span>
            </div>
          )}
        </div>

        <div className="p-6">
          {step === 'role' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Is this computer the <strong>Main PC</strong> (holds the database) or a <strong>Secondary PC</strong> (syncs live from the Main PC)?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setRole('main')}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${role === 'main' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-teal-300'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="h-5 w-5 text-teal-700 dark:text-teal-300" />
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Main PC</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This PC will hold the database and act as the central server. Set up pharmacy details and the first admin account here.
                  </p>
                </div>
                <div
                  onClick={() => setRole('secondary')}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${role === 'secondary' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-teal-300'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Laptop className="h-5 w-5 text-teal-700 dark:text-teal-300" />
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Secondary PC</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Connects to an already-running Main PC and copies all of its data (products, sales, users, settings).
                  </p>
                </div>
              </div>

              {role === 'secondary' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Main PC IP Address
                  </label>
                  <input
                    type="text"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="e.g., 192.168.1.100:3000"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    The Main PC must already be installed, running, and on the same network before you continue.
                  </p>
                </div>
              )}

              <button
                onClick={role === 'main' ? handleChooseMain : handleChooseSecondary}
                className="flex w-full items-center justify-center gap-2 rounded bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 transition-colors"
              >
                <span>{role === 'main' ? 'Continue' : 'Connect & Sync Now'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              {role === 'main' && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                  {!showCloudRecovery ? (
                    <button
                      type="button"
                      onClick={() => setShowCloudRecovery(true)}
                      className="flex w-full items-center justify-center gap-2 rounded border border-teal-300 px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-900/20"
                    >
                      <CloudDownload className="h-4 w-4" /> Recover existing pharmacy from Google Drive
                    </button>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-800 dark:bg-teal-900/20">
                      <div className="flex items-start gap-2">
                        <CloudDownload className="mt-0.5 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" />
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Recover from Google Drive</h3>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            Use the OAuth Client ID from the previous installation. The latest backup will be restored from the <strong>pharmabackup</strong> folder before setup continues.
                          </p>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={googleClientId}
                        onChange={(event) => setGoogleClientId(event.target.value)}
                        placeholder="Google OAuth Client ID"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-900"
                      />
                      {recoveryError && (
                        <p className="flex items-start gap-1.5 text-xs text-rose-700 dark:text-rose-300">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {recoveryError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCloudRecovery}
                          disabled={isRecovering}
                          className="flex flex-1 items-center justify-center gap-2 rounded bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-60"
                        >
                          {isRecovering ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudDownload className="h-3.5 w-3.5" />}
                          {isRecovering ? 'Recovering...' : 'Find & Restore Backup'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowCloudRecovery(false); setRecoveryError(null); }}
                          className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'secondary-wait' && (
            <div className="space-y-4 text-center py-4">
              {syncStatus === 'connected' ? (
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              ) : syncStatus === 'error' ? (
                <XCircle className="mx-auto h-10 w-10 text-rose-600" />
              ) : (
                <Wifi className="mx-auto h-10 w-10 text-amber-500 animate-pulse" />
              )}
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {syncStatus === 'connected' && 'Connected — receiving data from Main PC...'}
                {syncStatus === 'error' && 'Could not reach the Main PC'}
                {(syncStatus === 'connecting' || syncStatus === 'offline') && 'Connecting to Main PC...'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {syncStatus === 'error'
                  ? 'Make sure the Main PC has the app open, is on the same Wi-Fi/network, and that the IP address is correct.'
                  : `Waiting for products, sales, users, and settings from ${settings.mainPcIp || 'the Main PC'}.`}
              </p>
              {waitElapsedSec >= 8 && syncStatus !== 'connected' && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  This is taking longer than expected. Double-check the Main PC is online and ready.
                </p>
              )}
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setStep('role')}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button
                  onClick={() => reconnectSync()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry Connection
                </button>
              </div>
            </div>
          )}

          {step === 'identity' && (
            <form onSubmit={handleIdentitySubmit} className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <Building2 className="h-5 w-5 text-teal-700 dark:text-teal-300" />
                <h3 className="font-semibold">Pharmacy Identity</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                These details identify this pharmacy and are shared with any Secondary PCs that connect later.
              </p>

              {identityError && (
                <div className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {identityError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Pharmacy Name *</label>
                  <input value={identity.pharmacyName} onChange={(e) => setIdentity(s => ({ ...s, pharmacyName: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                  <input value={identity.pharmacyPhone} onChange={(e) => setIdentity(s => ({ ...s, pharmacyPhone: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">License Number</label>
                  <input value={identity.licenseNumber} onChange={(e) => setIdentity(s => ({ ...s, licenseNumber: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                  <input value={identity.pharmacyAddress} onChange={(e) => setIdentity(s => ({ ...s, pharmacyAddress: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Exchange Rate (L.L. per $1) *</label>
                  <input type="number" min="1" value={identity.exchangeRate} onChange={(e) => setIdentity(s => ({ ...s, exchangeRate: e.target.value }))}
                    placeholder="e.g., 89500"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Default Currency Display</label>
                  <select value={identity.defaultCurrency} onChange={(e) => setIdentity(s => ({ ...s, defaultCurrency: e.target.value as 'LBP' | 'USD' | 'BOTH' }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="BOTH">Both (L.L. / $)</option>
                    <option value="LBP">L.L. only</option>
                    <option value="USD">$ only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Low Stock Threshold</label>
                  <input type="number" min="0" value={identity.lowStockThreshold} onChange={(e) => setIdentity(s => ({ ...s, lowStockThreshold: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Expiry Warning (days)</label>
                  <input type="number" min="0" value={identity.expiryWarningDays} onChange={(e) => setIdentity(s => ({ ...s, expiryWarningDays: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button type="button" onClick={() => setStep('role')}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button type="submit"
                  className="flex-1 flex items-center justify-center gap-2 rounded bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 transition-colors">
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {step === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <UserPlus className="h-5 w-5 text-teal-700 dark:text-teal-300" />
                <h3 className="font-semibold">Create Your Admin Account</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This will be the first login for {identity.pharmacyName || 'this pharmacy'}. You can add more staff accounts later from Settings.
              </p>

              {adminError && (
                <div className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {adminError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                  <input value={admin.name} onChange={(e) => setAdmin(s => ({ ...s, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Username *</label>
                  <input value={admin.username} onChange={(e) => setAdmin(s => ({ ...s, username: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password *</label>
                  <input type="password" value={admin.password} onChange={(e) => setAdmin(s => ({ ...s, password: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm Password *</label>
                  <input type="password" value={admin.confirmPassword} onChange={(e) => setAdmin(s => ({ ...s, confirmPassword: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button type="button" onClick={() => setStep('identity')}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button type="submit"
                  className="flex-1 flex items-center justify-center gap-2 rounded bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 transition-colors">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Finish Setup</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
