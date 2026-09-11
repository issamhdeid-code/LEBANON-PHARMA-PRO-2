import React, { useState, useEffect, useRef } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import {
  Network,
  Save,
  Server,
  Laptop,
  CheckCircle2,
  XCircle,
  Wifi,
  Users,
  Bell,
  BellOff,
  CloudUpload,
  CloudDownload,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Download,
  Upload,
  HardDrive,
  Info,
  Monitor,
} from 'lucide-react';
import { UsersPanel } from './UsersPanel';
import {
  backupToGoogleDrive,
  restoreFromGoogleDrive,
  listGoogleDriveBackups,
  GoogleDriveBackupVersion,
  getGoogleDriveClientId,
  saveGoogleDriveClientId,
  getCurrentAppOrigin,
} from '../../services/googleDriveBackup';

import { DesktopWindow } from '../common/DesktopWindow';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, syncStatus, addNotification, exportBackup, restoreBackup, clearAllData } = usePharmacy();
  const [settingsTab, setSettingsTab] = useState<'display' | 'network' | 'notifications' | 'backup' | 'users'>('display');
  const [isTesting, setIsTesting] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [mode, setMode] = useState<'main' | 'secondary'>(settings.syncMode || 'main');
  const [ip, setIp] = useState(settings.mainPcIp || '');
  const [isSaving, setIsSaving] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(() => getGoogleDriveClientId());
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoringGoogle, setIsRestoringGoogle] = useState(false);
  const [availableBackups, setAvailableBackups] = useState<GoogleDriveBackupVersion[]>([]);
  const [isSelectingBackup, setIsSelectingBackup] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentOrigin = getCurrentAppOrigin();

  const handleGoogleDriveRestore = async () => {
    const trimmed = googleClientId.trim();
    if (!trimmed) {
      addNotification('Client ID Required', 'Please enter your Google OAuth Client ID first.', 'system', 'error');
      return;
    }

    setIsRestoringGoogle(true);
    try {
      saveGoogleDriveClientId(trimmed);
      const versions = await listGoogleDriveBackups(trimmed);
      if (versions.length === 0) throw new Error('No pharmacy backup versions were found in the Google Drive pharmabackup folder.');
      setAvailableBackups(versions);
      setIsSelectingBackup(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not list backups from Google Drive.';
      addNotification('Restore Failed', msg, 'system', 'error');
    } finally {
      setIsRestoringGoogle(false);
    }
  };

  const handleRestoreGoogleVersion = async (version: GoogleDriveBackupVersion) => {
    setIsRestoringGoogle(true);
    try {
      const { backupJson, modifiedTime } = await restoreFromGoogleDrive(googleClientId, version.id);

      let summaryText = 'Found Google Drive backup.';
      try {
        const parsed = JSON.parse(backupJson);
        const prodCount = Array.isArray(parsed.products) ? parsed.products.length : 0;
        const salesCount = Array.isArray(parsed.sales) ? parsed.sales.length : 0;
        const timeStr = modifiedTime ? new Date(modifiedTime).toLocaleString() : 'recently saved';
        summaryText = `Found backup from ${timeStr} containing ${prodCount} products and ${salesCount} sales.\n\nAre you sure you want to restore this database? Current records will be replaced.`;
      } catch {
        summaryText = 'Are you sure you want to restore the backup from Google Drive? Current records will be replaced.';
      }

      const confirmed = window.confirm(summaryText);
      if (!confirmed) {
        addNotification('Restore Cancelled', 'Google Drive restore was cancelled.', 'system', 'info');
        return;
      }

      const ok = await restoreBackup(backupJson);
      if (ok) {
        addNotification(
          'Database Restored',
          `Successfully restored pharmacy database from Google Drive (${modifiedTime ? new Date(modifiedTime).toLocaleDateString() : 'latest'}).`,
          'system',
          'success'
        );
      } else {
        addNotification('Restore Failed', 'Corrupt or invalid backup file in Google Drive.', 'system', 'error');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not restore the selected backup from Google Drive.';
      addNotification('Restore Failed', msg, 'system', 'error');
    } finally {
      setIsRestoringGoogle(false);
      setIsSelectingBackup(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadLocalBackup = async () => {
    try {
      const data = await exportBackup();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pharmalebanon-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addNotification('Backup Downloaded', 'Local JSON backup file saved to your device.', 'system', 'success');
    } catch {
      addNotification('Backup Failed', 'Could not generate local backup file.', 'system', 'error');
    }
  };

  const handleLocalRestoreFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (!content) return;
      const confirmed = window.confirm(
        'Are you sure you want to restore this database backup? This will replace all current inventory and transactions with the records from the backup file.'
      );
      if (confirmed) {
        const ok = await restoreBackup(content);
        if (ok) {
          addNotification('Database Restored', 'Successfully restored database from backup file.', 'system', 'success');
        } else {
          addNotification('Restore Failed', 'Invalid or corrupt backup JSON file.', 'system', 'error');
        }
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  useEffect(() => {
    setMode(settings.syncMode || 'main');
    setIp(settings.mainPcIp || '');
  }, [settings.syncMode, settings.mainPcIp]);

  const allNotificationsEnabled =
    (settings.notificationsEnabled ?? true) &&
    (settings.notifyInventory ?? true) &&
    (settings.notifyExpiry ?? true) &&
    (settings.notifySync ?? true) &&
    (settings.notifySale ?? true) &&
    (settings.notifySystem ?? true);

  const isNotificationsActive =
    (settings.notificationsEnabled ?? true) &&
    ((settings.notifyInventory ?? true) ||
      (settings.notifyExpiry ?? true) ||
      (settings.notifySync ?? true) ||
      (settings.notifySale ?? true) ||
      (settings.notifySystem ?? true));

  const enabledCount = [
    settings.notifyInventory ?? true,
    settings.notifyExpiry ?? true,
    settings.notifySync ?? true,
    settings.notifySale ?? true,
    settings.notifySystem ?? true,
  ].filter(Boolean).length;

  const handleToggleAll = (enabled: boolean) => {
    updateSettings({
      notificationsEnabled: enabled,
      notifyInventory: enabled,
      notifyExpiry: enabled,
      notifySync: enabled,
      notifySale: enabled,
      notifySystem: enabled,
    });
  };

  
  const handleTestConnection = async () => {
    if (!ip) {
      addNotification('Error', 'Please enter an IP address first', 'system', 'error');
      return;
    }
    
    setIsTesting(true);
    let url = ip;
    if (!url.startsWith('http')) {
      url = 'http://' + url;
    }
    if (url.startsWith('http://') && !url.includes('.run.app') && url.split(':').length === 2) {
      url = url + ':3000';
    }

    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) {
        addNotification('Success', 'Successfully reached the Main PC!', 'system', 'success');
      } else {
        addNotification('Error', `Reached IP but received error status: ${res.status}`, 'system', 'error');
      }
    } catch (e: any) {
      addNotification('Connection Failed', `Could not reach ${url}. Check your firewall and network.`, 'system', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    updateSettings({
      ...settings,
      syncMode: mode,
      mainPcIp: ip,
    });
    // Add small delay for visual feedback
    setTimeout(() => {
      setIsSaving(false);
      // Let's force a reload to reinitialize socket (easiest way in this architecture)
      window.location.reload();
    }, 600);
  };

  return (
    <div className="w-full h-full p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Network className="h-6 w-6 text-teal-600" />
            Network & Synchronization Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Configure how this PC connects to other instances of the Pharmacy application on your local network.
          </p>
        </div>

        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setSettingsTab('display')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              settingsTab === 'display'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Monitor className="h-4 w-4" /> Display
          </button>
          <button
            onClick={() => setSettingsTab('network')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              settingsTab === 'network'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Network className="h-4 w-4" /> Network & Sync
          </button>
          <button
            onClick={() => setSettingsTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              settingsTab === 'users'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Users className="h-4 w-4" /> Users & Roles
          </button>
          <button
            onClick={() => setSettingsTab('notifications')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              settingsTab === 'notifications'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {isNotificationsActive ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />} Notifications
          </button>
          <button
            onClick={() => setSettingsTab('backup')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              settingsTab === 'backup'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <CloudUpload className="h-4 w-4" /> Backup
          </button>
        </div>

        {settingsTab === 'display' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Monitor className="h-5 w-5 text-teal-600" /> Display Settings
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Adjust the text size and overall app zoom. Changes apply immediately to every screen.
              </p>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label htmlFor="app-font-size" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Font size</label>
                <select
                  id="app-font-size"
                  value={settings.fontSize}
                  onChange={(event) => updateSettings({ fontSize: event.target.value as 'small' | 'normal' | 'large' })}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="small">Small</option>
                  <option value="normal">Normal</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="app-zoom" className="text-sm font-medium text-slate-700 dark:text-slate-300">App zoom</label>
                  <span className="rounded bg-slate-100 px-2 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">{settings.appZoom || 100}%</span>
                </div>
                <input
                  id="app-zoom"
                  type="range"
                  min="80"
                  max="150"
                  step="5"
                  value={settings.appZoom || 100}
                  onChange={(event) => updateSettings({ appZoom: Number(event.target.value) })}
                  className="mt-3 w-full accent-teal-600"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-400"><span>80%</span><span>100%</span><span>150%</span></div>
              </div>

              <button
                type="button"
                onClick={() => updateSettings({ fontSize: 'normal', appZoom: 100 })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Reset display settings
              </button>
            </div>
          </div>
        )}

        {settingsTab === 'users' && <UsersPanel />}

        {settingsTab === 'notifications' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {isNotificationsActive ? (
                  <Bell className="h-5 w-5 text-teal-600" />
                ) : (
                  <BellOff className="h-5 w-5 text-slate-400" />
                )}
                App Notifications
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Control system alerts shown in the notification center and desktop notifications.
              </p>
            </div>

            {/* Master Toggle */}
            <div className="p-5 bg-teal-50/50 dark:bg-teal-950/20 border-b border-slate-200 dark:border-slate-700">
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <span className="block font-medium text-slate-800 dark:text-slate-100">
                    Enable all notifications
                  </span>
                  <span className="block mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Master switch to enable or disable all notification categories at once.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={allNotificationsEnabled}
                  onChange={(event) => handleToggleAll(event.target.checked)}
                  className="h-5 w-5 shrink-0 accent-teal-600 cursor-pointer"
                />
              </label>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Notification Categories
                </span>
                <span className="text-xs text-slate-400">
                  {settings.notificationsEnabled === false ? 'All muted' : `${enabledCount} of 5 active`}
                </span>
              </div>

              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span>
                  <span className="block font-medium text-slate-800 dark:text-slate-100">Inventory Alerts</span>
                  <span className="block mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Receive notifications when products are added, removed, or out of stock.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.notifyInventory ?? true}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    updateSettings({
                      notifyInventory: checked,
                      ...(checked ? { notificationsEnabled: true } : {}),
                    });
                  }}
                  className="h-5 w-5 shrink-0 accent-teal-600 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span>
                  <span className="block font-medium text-slate-800 dark:text-slate-100">Expiry Alerts</span>
                  <span className="block mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Receive warnings when products are nearing their expiration date.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.notifyExpiry ?? true}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    updateSettings({
                      notifyExpiry: checked,
                      ...(checked ? { notificationsEnabled: true } : {}),
                    });
                  }}
                  className="h-5 w-5 shrink-0 accent-teal-600 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span>
                  <span className="block font-medium text-slate-800 dark:text-slate-100">Sync Alerts</span>
                  <span className="block mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Receive updates on LAN synchronization with other computers.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.notifySync ?? true}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    updateSettings({
                      notifySync: checked,
                      ...(checked ? { notificationsEnabled: true } : {}),
                    });
                  }}
                  className="h-5 w-5 shrink-0 accent-teal-600 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span>
                  <span className="block font-medium text-slate-800 dark:text-slate-100">Sale Alerts</span>
                  <span className="block mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Receive notifications when sales are processed.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.notifySale ?? true}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    updateSettings({
                      notifySale: checked,
                      ...(checked ? { notificationsEnabled: true } : {}),
                    });
                  }}
                  className="h-5 w-5 shrink-0 accent-teal-600 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span>
                  <span className="block font-medium text-slate-800 dark:text-slate-100">System Alerts</span>
                  <span className="block mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Receive administrative alerts, connection issues, and general app events.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.notifySystem ?? true}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    updateSettings({
                      notifySystem: checked,
                      ...(checked ? { notificationsEnabled: true } : {}),
                    });
                  }}
                  className="h-5 w-5 shrink-0 accent-teal-600 cursor-pointer"
                />
              </label>

              <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700 pt-4">
                These settings are saved on this PC and take effect immediately.
              </p>
            </div>
          </div>
        )}

        {settingsTab === 'backup' && (
          <div className="space-y-6">
            {/* Google Drive Cloud Backup */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <CloudUpload className="h-5 w-5 text-teal-600" /> Google Drive Cloud Backup
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Upload and restore a snapshot of your pharmacy database in your Google Drive <strong>pharmabackup</strong> folder.
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  Cloud Sync
                </span>
              </div>

              <div className="p-6 space-y-5">
                {/* Origin Setup Banner for GeneralOAuthFlow error */}
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300 flex-1">
                      <p className="font-semibold text-amber-900 dark:text-amber-200">
                        Fixing "origin_mismatch (flowName=GeneralOAuthFlow)"
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Google requires the exact origin of this web app to be whitelisted in your Google Cloud Console under{' '}
                        <strong className="text-slate-800 dark:text-slate-200">"Authorized JavaScript origins"</strong>{' '}
                        (NOT redirect URIs). Without this, Google rejects authentication requests.
                      </p>

                      <div className="mt-3 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-900 rounded border border-amber-200/80 dark:border-amber-900/40">
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-medium text-slate-500 block">Current Web App Origin:</span>
                            <span className="font-mono text-xs text-slate-800 dark:text-slate-200 break-all select-all">
                              {currentOrigin || window.location.origin}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(currentOrigin || window.location.origin, 'liveOrigin')}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-200 rounded transition-colors shrink-0"
                          >
                            {copiedKey === 'liveOrigin' ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" /> Copy Origin
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-900 rounded border border-amber-200/80 dark:border-amber-900/40">
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-medium text-slate-500 block">Desktop/Offline Origin:</span>
                            <span className="font-mono text-xs text-slate-800 dark:text-slate-200">http://localhost:3000</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy('http://localhost:3000', 'localOrigin')}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-200 rounded transition-colors shrink-0"
                          >
                            {copiedKey === 'localOrigin' ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" /> Copy
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                        <p className="font-medium text-slate-700 dark:text-slate-300">Quick Setup Steps in Google Cloud:</p>
                        <ol className="list-decimal pl-5 space-y-1">
                          <li>
                            Open{' '}
                            <a
                              href="https://console.cloud.google.com/apis/credentials"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-teal-600 dark:text-teal-400 underline inline-flex items-center gap-0.5"
                            >
                              Google Cloud Credentials <ExternalLink className="h-3 w-3 inline" />
                            </a>
                          </li>
                          <li>Click on your OAuth 2.0 Client ID (Application type must be <strong>Web application</strong>).</li>
                          <li>
                            Under <strong>Authorized JavaScript origins</strong>, click <strong>ADD URI</strong>, paste the copied origin above, and click <strong>Save</strong>.
                          </li>
                          <li>
                            Open{' '}
                            <a
                              href="https://console.cloud.google.com/apis/credentials/consent"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-teal-600 dark:text-teal-400 underline inline-flex items-center gap-0.5 font-medium"
                            >
                              OAuth consent screen <ExternalLink className="h-3 w-3 inline" />
                            </a>
                            : Scroll to <strong>Test users</strong>, click <strong>+ ADD USERS</strong>, and add your Google account email to allow sign in while in testing mode.
                          </li>
                          <li>Ensure the <strong>Google Drive API</strong> is enabled under APIs & Services &gt; Enabled APIs &gt; Services.</li>
                        </ol>
                      </div>

                      {/* Error 403 Access Denied explanation note */}
                      <div className="mt-2 p-2.5 rounded bg-amber-100/70 dark:bg-amber-900/40 border border-amber-300/60 dark:border-amber-700/60 text-xs">
                        <span className="font-semibold text-amber-900 dark:text-amber-200">Got "Error 403: access_denied" or "App has not completed verification"?</span>
                        <p className="mt-1 text-slate-700 dark:text-slate-300">
                          Because your Google Cloud app is in <em>Testing</em> status, Google blocks any account not listed in <strong>Test users</strong>. Simply open the{' '}
                          <a
                            href="https://console.cloud.google.com/apis/credentials/consent"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-teal-700 dark:text-teal-400 font-medium"
                          >
                            OAuth Consent Screen
                          </a>
                          , scroll down to <strong>Test users</strong>, click <strong>+ ADD USERS</strong>, type your Gmail address, and click <strong>Save</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <p>The app creates a visible Drive folder named <strong className="text-slate-800 dark:text-slate-200">pharmabackup</strong> and keeps several verified backup versions inside it.</p>
                </div>

                {/* Client ID Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Google OAuth Client ID
                    <input
                      type="text"
                      value={googleClientId}
                      onChange={(event) => setGoogleClientId(event.target.value)}
                      onBlur={() => saveGoogleDriveClientId(googleClientId)}
                      placeholder="e.g. 1234567890-abcdefg.apps.googleusercontent.com"
                      className="mt-1.5 w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none font-mono text-xs"
                    />
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    Saved locally on this device. Google OAuth Client IDs are public identifiers and safe to store in the browser.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Automatic backup schedule
                    <select
                      value={settings.backupSchedule || 'manual'}
                      onChange={(event) => updateSettings({ backupSchedule: event.target.value as 'manual' | 'daily' | 'weekly' })}
                      className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="manual">Manual only</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Versions to keep
                    <select
                      value={settings.backupRetentionCount || 5}
                      onChange={(event) => updateSettings({ backupRetentionCount: Number(event.target.value) })}
                      className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {[3, 5, 7, 14, 30].map((count) => <option key={count} value={count}>{count} versions</option>)}
                    </select>
                  </label>
                  <div className="sm:col-span-2 text-xs text-slate-500 dark:text-slate-400">
                    Automatic backups start after one successful manual backup while this app remains open. Google authorization is kept in memory and never stored as a secret.
                  </div>
                  <div className="sm:col-span-2 rounded-md border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900">
                    <strong className="text-slate-700 dark:text-slate-200">Backup verification:</strong>{' '}
                    {settings.backupLastSuccess
                      ? `${settings.backupLastStatus === 'failed' ? 'Last attempt failed. ' : 'Verified successfully. '}${settings.backupLastSummary || ''} Last success: ${new Date(settings.backupLastSuccess).toLocaleString()}.`
                      : 'No verified backup has been completed on this PC yet.'}
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    id="btn-backup-google-drive"
                    onClick={async () => {
                      setIsBackingUp(true);
                      try {
                        saveGoogleDriveClientId(googleClientId);
                        const result = await backupToGoogleDrive(googleClientId, await exportBackup(), settings.backupRetentionCount || 5);
                        const timestamp = result.modifiedTime
                          ? new Date(result.modifiedTime).toLocaleString()
                          : 'now';
                        updateSettings({
                          backupLastSuccess: new Date().toISOString(),
                          backupLastStatus: 'success',
                          backupLastSummary: `${result.productCount} products, ${result.salesCount} sales, ${result.customerCount} customers`,
                        });
                        addNotification('Backup Complete', `Verified Google Drive backup at ${timestamp}: ${result.productCount} products, ${result.salesCount} sales, ${result.customerCount} customers.`, 'system', 'success');
                      } catch (error) {
                        const msg = error instanceof Error ? error.message : 'Could not upload the backup.';
                        updateSettings({ backupLastStatus: 'failed' });
                        addNotification('Backup Failed', msg, 'system', 'error');
                      } finally {
                        setIsBackingUp(false);
                      }
                    }}
                    disabled={isBackingUp || isRestoringGoogle || !googleClientId.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-medium rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isBackingUp ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CloudUpload className="h-4 w-4" />
                    )}
                    <span>{isBackingUp ? 'Connecting & Uploading...' : 'Back Up to Google Drive'}</span>
                  </button>

                  <button
                    id="btn-restore-google-drive"
                    onClick={handleGoogleDriveRestore}
                    disabled={isBackingUp || isRestoringGoogle || !googleClientId.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isRestoringGoogle ? (
                      <div className="h-4 w-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CloudDownload className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    )}
                    <span>{isRestoringGoogle ? 'Retrieving Backup...' : 'Restore from Google Drive'}</span>
                  </button>

                  {!googleClientId.trim() && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 w-full sm:w-auto">
                      <Info className="h-3.5 w-3.5" /> Enter your Client ID above to enable Google Drive actions.
                    </span>
                  )}
                </div>

                {isSelectingBackup && (
                  <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-800 dark:bg-teal-900/20">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Choose a backup version</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Select the version to download and restore.</p>
                      </div>
                      <button type="button" onClick={() => setIsSelectingBackup(false)} className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Cancel</button>
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto">
                      {availableBackups.map((version) => (
                        <button
                          key={version.id}
                          type="button"
                          onClick={() => handleRestoreGoogleVersion(version)}
                          disabled={isRestoringGoogle}
                          className="flex w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left hover:border-teal-500 hover:bg-teal-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-teal-900/20"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{version.name}</span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400">{version.modifiedTime ? new Date(version.modifiedTime).toLocaleString() : 'Unknown date'}</span>
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">{version.size ? `${Math.round(Number(version.size) / 1024)} KB` : 'Size unknown'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Local JSON File Backup & Restore (Offline Guaranteed) */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-teal-600" /> Local Database Backup & Restore
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Export a standalone JSON database snapshot or restore existing records directly. Works 100% offline without any account setup.
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                  Offline
                </span>
              </div>

              <div className="p-6">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLocalRestoreFile}
                  accept=".json,application/json"
                  className="hidden"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Download className="h-4 w-4 text-teal-600" /> Download Local Backup
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Saves an instant JSON snapshot containing all inventory, transactions, customers, suppliers, and settings to your computer.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadLocalBackup}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                    >
                      <Download className="h-4 w-4" /> Download Backup (.json)
                    </button>
                  </div>

                  <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Upload className="h-4 w-4 text-teal-600" /> Restore Database
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Import a previously exported JSON backup file to restore all modules, inventory quantities, and transactions.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                    >
                      <Upload className="h-4 w-4" /> Restore from File (.json)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Data Management Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-lg font-semibold text-rose-600 dark:text-rose-500 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Danger Zone
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Destructive actions that cannot be undone. Please proceed with caution.
                </p>
              </div>
              <div className="p-6">
                <div className="p-4 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-slate-800 dark:text-slate-100">Clear All Data</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-lg">
                      This will permanently delete all products, suppliers, customers, sales, purchases, and system logs. Your user accounts and system settings will be retained. Make sure you have exported a backup before proceeding.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowClearDataModal(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    <AlertTriangle className="h-4 w-4" /> Clear All Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {settingsTab === 'network' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">PC Role Configuration</h2>
            
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border
              \${syncStatus === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : 
                syncStatus === 'connecting' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
                'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}
            `}>
              {syncStatus === 'connected' ? <CheckCircle2 className="h-3.5 w-3.5" /> : 
               syncStatus === 'connecting' ? <div className="h-3.5 w-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" /> : 
               <XCircle className="h-3.5 w-3.5" />}
              {syncStatus === 'connected' ? 'Connected' : 
               syncStatus === 'connecting' ? 'Connecting...' : 
               'Offline'}
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                onClick={() => setMode('main')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 \${
                  mode === 'main' 
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
                    : 'border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-full \${mode === 'main' ? 'bg-teal-100 text-teal-700 dark:bg-teal-800 dark:text-teal-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    <Server className="h-5 w-5" />
                  </div>
                  <h3 className={`font-semibold \${mode === 'main' ? 'text-teal-900 dark:text-teal-100' : 'text-slate-700 dark:text-slate-300'}`}>Main PC</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  This PC holds the database and acts as the central server for other PCs on the network.
                </p>
              </div>

              <div 
                onClick={() => setMode('secondary')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 \${
                  mode === 'secondary' 
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
                    : 'border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-full \${mode === 'secondary' ? 'bg-teal-100 text-teal-700 dark:bg-teal-800 dark:text-teal-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    <Laptop className="h-5 w-5" />
                  </div>
                  <h3 className={`font-semibold \${mode === 'secondary' ? 'text-teal-900 dark:text-teal-100' : 'text-slate-700 dark:text-slate-300'}`}>Secondary PC</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  This PC connects to the Main PC over the network to sync sales and stock data live.
                </p>
              </div>
            </div>

            {mode === 'secondary' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Main PC IP Address
                  </label>
                  <input
                    type="text"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="e.g., 192.168.1.100:3000"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-shadow"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Enter the local IP address of the Main PC. 
                    <br/><br/>
                    <strong>Web Preview Note:</strong> If testing in this browser, leave this blank or use the current URL. Open the app in a new incognito window, set one to Main and one to Secondary to test live sync!
                  </p>
                </div>
              </div>
            )}
          </div>
          
          
          <div className="p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
             {mode === 'secondary' && (
               <button
                  onClick={handleTestConnection}
                  disabled={isTesting || !ip}
                  className="flex items-center gap-2 px-6 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium rounded-lg transition-colors disabled:opacity-70"
               >
                 {isTesting ? (
                   <div className="h-4 w-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                 ) : (
                   <Wifi className="h-4 w-4" />
                 )}
                 {isTesting ? 'Testing...' : 'Test Connection'}
               </button>
             )}
             <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors disabled:opacity-70"
             >
               {isSaving ? (
                 <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
               ) : (
                 <Save className="h-4 w-4" />
               )}
               {isSaving ? 'Saving & Restarting...' : 'Save & Connect'}
             </button>
          </div>

        </div>
        )}

      </div>

      {showClearDataModal && (
        <DesktopWindow
          title="Clear All Data"
          isOpen={true}
          onClose={() => setShowClearDataModal(false)}
        >
          <div className="p-6 max-w-md">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              Confirm Data Deletion
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              Are you absolutely sure you want to clear all data? This will permanently wipe your inventory, transactions, customers, and suppliers.
            </p>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg mb-6 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
                This action CANNOT BE UNDONE. Your user accounts and system settings will be retained, but all business data will be lost forever.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearDataModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllData();
                  setShowClearDataModal(false);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition-all cursor-pointer active:scale-95"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Clear All Data</span>
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}
    </div>
  );
};
