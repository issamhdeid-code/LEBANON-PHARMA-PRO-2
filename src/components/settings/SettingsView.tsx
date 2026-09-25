import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Package,
  ShoppingCart,
  Globe,
  RefreshCw,
  X,
  Sun,
  Moon,
  Trash2,
  Database,
  ShieldCheck,
  Star,
  Calendar,
} from 'lucide-react';
import { UsersPanel } from './UsersPanel';
import { StockSettingsPanel } from './StockSettingsPanel';
import { SaleSettingsPanel } from './SaleSettingsPanel';
import { LoyaltySettingsPanel } from './LoyaltySettingsPanel';
import { YearClosingTab } from './YearClosingTab';
import {
  backupToGoogleDrive,
  restoreFromGoogleDrive,
  listGoogleDriveBackups,
  GoogleDriveBackupVersion,
  getGoogleDriveClientId,
  saveGoogleDriveClientId,
  getCurrentAppOrigin,
} from '../../services/googleDriveBackup';
import {
  localBackupStorage,
  LocalBackupRecord,
  downloadBackupJsonFile,
} from '../../services/localBackupService';

import { DesktopWindow } from '../common/DesktopWindow';
import { formatTime, formatDateTime } from '../../utils/dateUtils';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, syncStatus, addNotification, exportBackup, restoreBackup, clearAllData } = usePharmacy();
  const [settingsTab, setSettingsTab] = useState<'display' | 'network' | 'notifications' | 'backup' | 'users' | 'stock' | 'sale' | 'loyalty' | 'yearClosing'>('display');
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
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [ipFetchFailed, setIpFetchFailed] = useState(false);
  const [isRestoringLocal, setIsRestoringLocal] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<{
    content: string;
    fileName: string;
    productCount: number;
    salesCount: number;
    customerCount: number;
    supplierCount: number;
    exportDate?: string;
  } | null>(null);
  const [lastRestoredSuccess, setLastRestoredSuccess] = useState<{
    fileName: string;
    productCount: number;
    salesCount: number;
    customerCount: number;
    timestamp: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local storage bucket backup states
  const [localBackups, setLocalBackups] = useState<LocalBackupRecord[]>([]);
  const [isLoadingLocalBackups, setIsLoadingLocalBackups] = useState(false);
  const [isCreatingManualBackup, setIsCreatingManualBackup] = useState(false);
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);

  const currentOrigin = getCurrentAppOrigin();
  const syncPort = (() => { try { return new URL(currentOrigin).port || '3000'; } catch { return '3000'; } })();
  const isWebPreview = typeof window !== 'undefined' && (window.location.hostname.includes('run.app') || window.location.protocol === 'https:');

  useEffect(() => {
    if (mode !== 'main') return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/network/ipv4');
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.addresses)) {
          const valid = data.addresses.filter((a: string) => !a.startsWith('169.254.') && !a.startsWith('127.'));
          setLocalIps(valid);
        }
      } catch {
        if (!cancelled) setIpFetchFailed(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mode]);

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
        const timeStr = modifiedTime ? formatDateTime(modifiedTime) : 'recently saved';
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
      try {
        const content = e.target?.result as string;
        if (!content || !content.trim()) {
          addNotification('Restore Error', 'The selected backup file is empty.', 'system', 'error');
          return;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(content);
        } catch {
          addNotification('Restore Error', 'The selected file is not valid JSON.', 'system', 'error');
          return;
        }

        const productCount = Array.isArray(parsed.products) ? parsed.products.length : 0;
        const salesCount = Array.isArray(parsed.sales) ? parsed.sales.length : 0;
        const customerCount = Array.isArray(parsed.customers) ? parsed.customers.length : 0;
        const supplierCount = Array.isArray(parsed.suppliers) ? parsed.suppliers.length : 0;
        const exportDate =
          parsed.exportDate ||
          (parsed.exportTimestamp ? formatDateTime(parsed.exportTimestamp) : undefined);

        setRestoreCandidate({
          content,
          fileName: file.name,
          productCount,
          salesCount,
          customerCount,
          supplierCount,
          exportDate,
        });
      } catch (err) {
        console.error('Failed to parse backup file:', err);
        addNotification('Restore Error', 'Could not read or parse the selected file.', 'system', 'error');
      }
    };
    reader.onerror = () => {
      addNotification('Restore Error', 'Failed to read file from disk.', 'system', 'error');
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleConfirmRestoreCandidate = async () => {
    if (!restoreCandidate) return;
    setIsRestoringLocal(true);
    try {
      const ok = await restoreBackup(restoreCandidate.content);
      if (ok) {
        const successInfo = {
          fileName: restoreCandidate.fileName,
          productCount: restoreCandidate.productCount,
          salesCount: restoreCandidate.salesCount,
          customerCount: restoreCandidate.customerCount,
          timestamp: formatTime(new Date()),
        };
        setLastRestoredSuccess(successInfo);
        addNotification(
          'Database Restored Successfully',
          `Restored ${restoreCandidate.productCount} products, ${restoreCandidate.salesCount} sales, and ${restoreCandidate.customerCount} customers from ${restoreCandidate.fileName}.`,
          'system',
          'success'
        );
      } else {
        addNotification('Restore Failed', 'Invalid or corrupt backup JSON file structure.', 'system', 'error');
      }
    } catch (err) {
      console.error('Restore error:', err);
      addNotification('Restore Failed', 'An error occurred while restoring data.', 'system', 'error');
    } finally {
      setIsRestoringLocal(false);
      setRestoreCandidate(null);
    }
  };

  const loadLocalBackups = useCallback(async () => {
    setIsLoadingLocalBackups(true);
    try {
      const list = await localBackupStorage.listBackups();
      setLocalBackups(list);
    } catch (err) {
      console.error('Failed to load local backups:', err);
    } finally {
      setIsLoadingLocalBackups(false);
    }
  }, []);

  useEffect(() => {
    loadLocalBackups();
    const handleBackupsChanged = () => {
      loadLocalBackups();
    };
    window.addEventListener('pharmalebanon_local_backups_changed', handleBackupsChanged);
    return () => {
      window.removeEventListener('pharmalebanon_local_backups_changed', handleBackupsChanged);
    };
  }, [loadLocalBackups]);

  const handleCreateLocalBackupNow = async () => {
    setIsCreatingManualBackup(true);
    try {
      const json = await exportBackup();
      const retention = settings.localBackupRetentionCount || 7;
      const record = await localBackupStorage.saveBackup(json, 'manual', retention);
      updateSettings({
        localBackupLastSuccess: record.createdAt,
        localBackupLastStatus: 'success',
        localBackupLastSummary: `${record.productCount} products, ${record.salesCount} sales, ${record.customerCount} customers (${record.formattedSize})`,
      });
      addNotification(
        'Local Backup Saved',
        `Saved snapshot with ${record.productCount} products and ${record.salesCount} sales records to local storage.`,
        'system',
        'success'
      );
      await loadLocalBackups();
    } catch (err) {
      console.error('Failed to create manual local backup:', err);
      addNotification('Backup Failed', 'Could not create local backup snapshot.', 'system', 'error');
    } finally {
      setIsCreatingManualBackup(false);
    }
  };

  const handleDeleteLocalBackup = async (id: string, name: string) => {
    if (!window.confirm(`Delete local backup "${name}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingBackupId(id);
    try {
      await localBackupStorage.deleteBackup(id);
      addNotification('Backup Deleted', `Removed local backup snapshot ${name}.`, 'system', 'info');
      await loadLocalBackups();
    } catch (err) {
      console.error('Delete error:', err);
      addNotification('Delete Failed', 'Could not delete local backup.', 'system', 'error');
    } finally {
      setDeletingBackupId(null);
    }
  };

  const handleRestoreLocalRecord = (record: LocalBackupRecord) => {
    setRestoreCandidate({
      content: record.jsonContent,
      fileName: record.name,
      productCount: record.productCount,
      salesCount: record.salesCount,
      customerCount: record.customerCount,
      supplierCount: record.supplierCount,
      exportDate: formatDateTime(record.timestamp),
    });
  };

  const handleDownloadLocalRecord = (record: LocalBackupRecord) => {
    downloadBackupJsonFile(record.name, record.jsonContent);
    addNotification('Backup Downloaded', `Downloaded ${record.name} to your device.`, 'system', 'success');
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
    setIsTesting(true);
    let target = (ip || '').trim();
    if (!target) {
      target = currentOrigin;
    }
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      const isHttps = (typeof window !== 'undefined' && window.location.protocol === 'https:') || target.includes('.run.app');
      target = (isHttps ? 'https://' : 'http://') + target;
    }
    if (target.includes('.run.app') && target.startsWith('http://')) {
      target = target.replace('http://', 'https://');
    }
    if (target.startsWith('http://') && !target.includes('.run.app') && target.split(':').length === 2) {
      target = target + ':3000';
    }
    target = target.replace(/\/+$/, '');

    try {
      const res = await fetch(`${target}/api/health`);
      if (res.ok) {
        addNotification('Success', 'Successfully reached the Main PC server!', 'system', 'success');
      } else {
        addNotification('Error', `Reached server but received error status: ${res.status}`, 'system', 'error');
      }
    } catch {
      addNotification('Connection Failed', `Could not reach ${target}. Check your network or URL.`, 'system', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    let target = (ip || '').trim();
    if (target) {
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        const isHttps = (typeof window !== 'undefined' && window.location.protocol === 'https:') || target.includes('.run.app');
        target = (isHttps ? 'https://' : 'http://') + target;
      }
      if (target.includes('.run.app') && target.startsWith('http://')) {
        target = target.replace('http://', 'https://');
      }
      if (target.startsWith('http://') && !target.includes('.run.app') && target.split(':').length === 2) {
        target = target + ':3000';
      }
      target = target.replace(/\/+$/, '');
    } else if (mode === 'secondary' && isWebPreview) {
      target = currentOrigin;
    }

    updateSettings({
      ...settings,
      syncMode: mode,
      mainPcIp: target,
    });
    // Add small delay for visual feedback
    setTimeout(() => {
      setIsSaving(false);
      // Force a reload to reinitialize socket cleanly
      window.location.reload();
    }, 600);
  };

  return (
    <div className="w-full h-full p-4 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <div className="max-w-3xl mx-auto space-y-4">
        
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
            id="tab-btn-backup"
            onClick={() => setSettingsTab('backup')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              settingsTab === 'backup'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <HardDrive className="h-4 w-4" /> Backup &amp; Restore
          </button>
          <button
            onClick={() => setSettingsTab('stock')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              settingsTab === 'stock'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Package className="h-4 w-4" /> Stock
          </button>
          <button
            onClick={() => setSettingsTab('sale')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              settingsTab === 'sale'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ShoppingCart className="h-4 w-4" /> Sale
          </button>
          <button
            id="tab-btn-loyalty"
            onClick={() => setSettingsTab('loyalty')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              settingsTab === 'loyalty'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Star className="h-4 w-4 fill-amber-400" /> Loyalty Program
          </button>
          <button
            id="tab-btn-year-closing"
            onClick={() => setSettingsTab('yearClosing')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              settingsTab === 'yearClosing'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Calendar className="h-4 w-4" /> Fiscal Year Closing
          </button>
        </div>

        {settingsTab === 'display' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Monitor className="h-5 w-5 text-teal-600" /> Display & Appearance Settings
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Customize the application theme, font scale, and viewport zoom. All visual adjustments take effect immediately across all screens, tables, and dialog windows.
              </p>
            </div>
            <div className="p-6 space-y-6">
              {/* Theme / Appearance (Light vs Dark Mode) */}
              <div className="space-y-3 pb-6 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Color Theme Mode
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select your preferred visual mode. Both themes are calibrated for optimal contrast across inventory tables, checkout POS, reports, and floating windows.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Light Mode Option */}
                  <button
                    type="button"
                    onClick={() => updateSettings({ darkMode: false })}
                    className={`flex items-start gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      !settings.darkMode
                        ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/30 ring-2 ring-teal-600/30 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${!settings.darkMode ? 'bg-amber-100 text-amber-700 shadow-2xs' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                      <Sun className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">Light Mode</span>
                        {!settings.darkMode && (
                          <span className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-teal-600 text-white rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Bright, high-clarity daylight theme designed for well-lit pharmacy counters and standard daytime shifts.
                      </p>
                    </div>
                  </button>

                  {/* Dark Mode Option */}
                  <button
                    type="button"
                    onClick={() => updateSettings({ darkMode: true })}
                    className={`flex items-start gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.darkMode
                        ? 'border-teal-500 bg-teal-950/30 ring-2 ring-teal-500/40 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${settings.darkMode ? 'bg-teal-900/60 text-amber-300 shadow-2xs' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                      <Moon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">Dark Mode</span>
                        {settings.darkMode && (
                          <span className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-teal-500 text-slate-950 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Deep slate palette engineered to minimize eye strain during night shifts and dim back-office environments.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
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

        {settingsTab === 'stock' && <StockSettingsPanel />}
        {settingsTab === 'sale' && <SaleSettingsPanel />}
        {settingsTab === 'loyalty' && <LoyaltySettingsPanel />}

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
            {/* Automated Daily Local Backup & Local Storage Bucket (Recommended & 100% Offline) */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-teal-600" /> Automated Daily Local Backup
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Automatically saves daily local snapshots of your current inventory and sales state directly on this PC. Works 100% offline.
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> 100% Offline Bucket
                </span>
              </div>

              <div className="p-6 space-y-6">
                {/* Schedule & Retention Controls */}
                <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/50 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Automated backup schedule
                    <select
                      id="select-local-backup-schedule"
                      value={settings.localBackupSchedule || 'daily'}
                      onChange={(event) =>
                        updateSettings({
                          localBackupSchedule: event.target.value as 'manual' | 'daily' | 'weekly',
                        })
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value="daily">Daily (Automated every 24 hours)</option>
                      <option value="weekly">Weekly (Automated every 7 days)</option>
                      <option value="manual">Manual only (On-demand snapshots)</option>
                    </select>
                  </label>

                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Versions to keep in local bucket
                    <select
                      id="select-local-backup-retention"
                      value={settings.localBackupRetentionCount || 7}
                      onChange={(event) =>
                        updateSettings({
                          localBackupRetentionCount: Number(event.target.value),
                        })
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value={3}>3 versions</option>
                      <option value={7}>7 versions (1 week history)</option>
                      <option value={14}>14 versions (2 weeks history)</option>
                      <option value={30}>30 versions (1 month history)</option>
                    </select>
                  </label>

                  <div className="sm:col-span-2 rounded-md border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="leading-relaxed">
                      <strong className="text-slate-700 dark:text-slate-200">Latest local backup status:</strong>{' '}
                      {settings.localBackupLastSuccess ? (
                        <span>
                          {settings.localBackupLastStatus === 'failed' ? (
                            <span className="text-rose-600 font-medium">Last automated backup failed. </span>
                          ) : (
                            <span className="text-emerald-600 font-medium">Verified saved. </span>
                          )}
                          {settings.localBackupLastSummary || ''} &bull; Recorded at{' '}
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatDateTime(settings.localBackupLastSuccess)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">
                          No automated daily backup has run yet. Will back up automatically or click "Back Up Now".
                        </span>
                      )}
                    </div>
                    <button
                      id="btn-create-local-backup-now"
                      type="button"
                      onClick={handleCreateLocalBackupNow}
                      disabled={isCreatingManualBackup}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-semibold rounded-md shadow-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    >
                      {isCreatingManualBackup ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving Snapshot...</span>
                        </>
                      ) : (
                        <>
                          <HardDrive className="h-3.5 w-3.5" />
                          <span>Back Up Now (Local Snapshot)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Local Storage Bucket Snapshot List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Database className="h-4 w-4 text-teal-600" />
                        Local Storage Bucket Snapshots ({localBackups.length})
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Each snapshot contains complete inventory quantities, sales records, customer balances, and supplier invoices.
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                      Click <strong>Restore</strong> to rollback data
                    </span>
                  </div>

                  {isLoadingLocalBackups ? (
                    <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-teal-600" />
                      <span>Loading local snapshots...</span>
                    </div>
                  ) : localBackups.length === 0 ? (
                    <div className="p-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-center">
                      <HardDrive className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-60" />
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        No local backup snapshots in the bucket yet.
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        The app will automatically save a daily snapshot, or you can create one right now.
                      </p>
                      <button
                        type="button"
                        onClick={handleCreateLocalBackupNow}
                        disabled={isCreatingManualBackup}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-md shadow-xs cursor-pointer transition-colors"
                      >
                        <HardDrive className="h-3.5 w-3.5" /> Create First Local Backup
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {localBackups.map((backup, idx) => (
                          <div
                            key={backup.id}
                            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                  {formatDateTime(backup.timestamp)}
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${
                                    backup.type === 'automated'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  }`}
                                >
                                  {backup.type === 'automated' ? 'Daily Automated' : 'Manual Snapshot'}
                                </span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                                  {backup.formattedSize}
                                </span>
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-3">
                                <span>
                                  Inventory:{' '}
                                  <strong className="text-slate-800 dark:text-slate-200">{backup.productCount}</strong> items
                                </span>
                                <span>&bull;</span>
                                <span>
                                  Sales:{' '}
                                  <strong className="text-slate-800 dark:text-slate-200">{backup.salesCount}</strong> records
                                </span>
                                <span>&bull;</span>
                                <span>
                                  Customers:{' '}
                                  <strong className="text-slate-800 dark:text-slate-200">{backup.customerCount}</strong>
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-md">
                                {backup.name}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <button
                                id={`btn-restore-local-${idx}`}
                                type="button"
                                onClick={() => handleRestoreLocalRecord(backup)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                title="Restore current database state from this backup snapshot"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                <span>Restore</span>
                              </button>
                              <button
                                id={`btn-download-local-${idx}`}
                                type="button"
                                onClick={() => handleDownloadLocalRecord(backup)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-md transition-colors cursor-pointer focus:ring-2 focus:ring-slate-400 focus:outline-none"
                                title="Download as standalone JSON file"
                              >
                                <Download className="h-3.5 w-3.5 text-slate-500" />
                                <span>Download JSON</span>
                              </button>
                              <button
                                id={`btn-delete-local-${idx}`}
                                type="button"
                                disabled={deletingBackupId === backup.id}
                                onClick={() => handleDeleteLocalBackup(backup.id, backup.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors cursor-pointer disabled:opacity-50"
                                title="Delete this local snapshot"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

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
                      ? `${settings.backupLastStatus === 'failed' ? 'Last attempt failed. ' : 'Verified successfully. '}${settings.backupLastSummary || ''} Last success: ${formatDateTime(settings.backupLastSuccess)}.`
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
                          ? formatDateTime(result.modifiedTime)
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
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400">{version.modifiedTime ? formatDateTime(version.modifiedTime) : 'Unknown date'}</span>
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">{version.size ? `${Math.round(Number(version.size) / 1024)} KB` : 'Size unknown'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Manual JSON File Backup & Restore */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Upload className="h-5 w-5 text-teal-600" /> Manual File Backup &amp; Restore (.json)
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Export a standalone JSON database file to your computer or restore records from an external backup file.
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                  File Import / Export
                </span>
              </div>

              <div className="p-6">
                {lastRestoredSuccess && (
                  <div className="mb-4 p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start justify-between gap-3 text-emerald-800 dark:text-emerald-200">
                    <div className="flex items-start gap-2.5 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                          Database Restored Successfully at {lastRestoredSuccess.timestamp}
                        </p>
                        <p className="text-emerald-700 dark:text-emerald-300 mt-0.5 leading-relaxed">
                          Successfully restored <strong>{lastRestoredSuccess.productCount}</strong> products,{' '}
                          <strong>{lastRestoredSuccess.salesCount}</strong> sales transactions, and{' '}
                          <strong>{lastRestoredSuccess.customerCount}</strong> customers from{' '}
                          <span className="font-mono font-medium text-emerald-900 dark:text-emerald-100 bg-emerald-100/70 dark:bg-emerald-900/50 px-1 py-0.5 rounded text-[11px]">
                            {lastRestoredSuccess.fileName}
                          </span>.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLastRestoredSuccess(null)}
                      className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 p-0.5 rounded transition-colors cursor-pointer"
                      title="Dismiss notice"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

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
                      id="btn-download-local-backup"
                      type="button"
                      onClick={handleDownloadLocalBackup}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500"
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
                      id="btn-restore-from-file"
                      type="button"
                      disabled={isRestoringLocal}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRestoringLocal ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Restoring...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span>Restore from File (.json)</span>
                        </>
                      )}
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

            {mode === 'main' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-3">
                {isWebPreview && (
                  <div className="p-4 bg-teal-50/80 dark:bg-teal-900/20 rounded-lg border border-teal-300 dark:border-teal-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-teal-700 dark:text-teal-300" />
                        <span className="text-sm font-bold text-teal-900 dark:text-teal-100">
                          Open on Second PC / Mobile Device
                        </span>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-teal-200 dark:bg-teal-800 text-teal-800 dark:text-teal-200 rounded">
                        Cloud Web App
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      To access this app from your second PC, open the link below in that PC's browser (e.g., Chrome, Edge):
                    </p>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                            Direct Web Link
                          </span>
                          <code className="text-xs font-mono font-bold text-teal-800 dark:text-teal-300 break-all select-all">
                            {currentOrigin.includes('ais-dev-') ? currentOrigin.replace('ais-dev-', 'ais-pre-') : currentOrigin}
                          </code>
                        </div>
                        <button
                          onClick={() => handleCopy(currentOrigin.includes('ais-dev-') ? currentOrigin.replace('ais-dev-', 'ais-pre-') : currentOrigin, 'webOriginShared')}
                          className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-medium transition-colors cursor-pointer"
                        >
                          {copiedKey === 'webOriginShared' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copiedKey === 'webOriginShared' ? 'Copied' : 'Copy Link'}</span>
                        </button>
                      </div>

                      {currentOrigin.includes('ais-dev-') && (
                        <div className="flex items-center justify-between gap-2 p-2 bg-white/70 dark:bg-slate-900/70 border border-teal-200/60 dark:border-teal-800/60 rounded-lg">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                              Developer Link (Requires AI Studio Login)
                            </span>
                            <code className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all select-all">
                              {currentOrigin}
                            </code>
                          </div>
                          <button
                            onClick={() => handleCopy(currentOrigin, 'webOriginDev')}
                            className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium transition-colors cursor-pointer"
                          >
                            {copiedKey === 'webOriginDev' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copiedKey === 'webOriginDev' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!isWebPreview && localIps.length > 0 && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Local Wi-Fi IP Address (for desktop Electron app)
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {localIps.map((addr) => (
                        <div key={addr} className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <code className="text-sm font-mono text-slate-800 dark:text-slate-200">{addr}</code>
                          <button
                            onClick={() => handleCopy(`${addr}:${syncPort}`, `mainIp-${addr}`)}
                            className="p-1 text-slate-400 hover:text-teal-600 transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary"
                            aria-label={`Copy ${addr} for the Secondary PC`}
                            title="Copy IP + port"
                          >
                            {copiedKey === `mainIp-${addr}` ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!isWebPreview && localIps.length === 0 && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {ipFetchFailed
                        ? "Could not detect this PC's local IP address. Open a command prompt on this PC and run:"
                        : "Detecting this PC's local IP address..."}
                    </p>
                    {ipFetchFailed && (
                      <code className="mt-2 inline-block text-xs font-mono bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-slate-700 dark:text-slate-300">
                        ipconfig
                      </code>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode === 'secondary' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Main PC Address or URL
                    </label>
                    {isWebPreview && (
                      <button
                        type="button"
                        onClick={() => setIp(currentOrigin)}
                        className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium flex items-center gap-1"
                      >
                        ⚡ Use This Web App URL
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder={isWebPreview ? currentOrigin : 'e.g., 192.168.1.100:3000'}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-shadow text-xs font-mono"
                  />
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    {isWebPreview ? (
                      <p>
                        <strong>Cloud Web Preview Mode:</strong> Click <strong>"⚡ Use This Web App URL"</strong> above (or leave it blank). Both PCs will connect through this web server to sync sales, stock, and customers live!
                      </p>
                    ) : (
                      <p>
                        Enter the local IP address of the Main PC (e.g. 192.168.1.xxx:3000).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sync pairing needs only the Main PC IP — no shared key */}
          <div className="p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
             {mode === 'secondary' && (
               <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
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

        {settingsTab === 'yearClosing' && <YearClosingTab />}

      </div>

      {restoreCandidate && (
        <DesktopWindow
          id="restore-from-file-modal"
          section="settings"
          title="Confirm Database Restore"
          isOpen={true}
          onClose={() => !isRestoringLocal && setRestoreCandidate(null)}
          width="480px"
        >
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Restore Database from JSON Backup?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  This will replace all current inventory, customer, supplier, and sales records with the data inside this backup file.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 dark:text-slate-400">File Name:</span>
                <span className="font-medium font-mono text-slate-900 dark:text-slate-100 truncate max-w-[220px]">
                  {restoreCandidate.fileName}
                </span>
              </div>
              {restoreCandidate.exportDate && (
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">Export Date:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {restoreCandidate.exportDate}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div>Products: <strong className="text-slate-900 dark:text-slate-100">{restoreCandidate.productCount}</strong></div>
                <div>Sales: <strong className="text-slate-900 dark:text-slate-100">{restoreCandidate.salesCount}</strong></div>
                <div>Customers: <strong className="text-slate-900 dark:text-slate-100">{restoreCandidate.customerCount}</strong></div>
                <div>Suppliers: <strong className="text-slate-900 dark:text-slate-100">{restoreCandidate.supplierCount}</strong></div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setRestoreCandidate(null)}
                disabled={isRestoringLocal}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-restore-file"
                type="button"
                onClick={handleConfirmRestoreCandidate}
                disabled={isRestoringLocal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 active:bg-teal-800 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRestoringLocal ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Restoring Database...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    <span>Confirm &amp; Restore</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}

      {showClearDataModal && (
        <DesktopWindow
          id="clear-all-data-modal"
          section="settings"
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
