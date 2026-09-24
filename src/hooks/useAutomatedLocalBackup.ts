import { useEffect, useRef } from 'react';
import { PharmacySettings } from '../types/pharmacy';
import {
  shouldRunDailyLocalBackup,
  performAutomatedDailyBackup,
} from '../services/localBackupService';

interface UseAutomatedLocalBackupProps {
  settings: PharmacySettings;
  updateSettings: (newSettings: Partial<PharmacySettings>) => void;
  exportBackup: () => Promise<string>;
  addNotification: (
    title: string,
    message: string,
    type: 'inventory' | 'expiry' | 'sync' | 'sale' | 'system',
    variant?: 'info' | 'warning' | 'error' | 'success'
  ) => void;
}

export function useAutomatedLocalBackup({
  settings,
  updateSettings,
  exportBackup,
  addNotification,
}: UseAutomatedLocalBackupProps) {
  const isBackingUpRef = useRef(false);

  useEffect(() => {
    const schedule = settings.localBackupSchedule ?? 'daily';
    if (schedule === 'manual') return;

    const checkAndRunBackup = async () => {
      if (isBackingUpRef.current) return;

      const isDue = shouldRunDailyLocalBackup(
        settings.localBackupLastSuccess,
        schedule
      );

      if (!isDue) return;

      isBackingUpRef.current = true;
      try {
        const retention = settings.localBackupRetentionCount || 7;
        const backup = await performAutomatedDailyBackup(exportBackup, retention);
        if (backup) {
          updateSettings({
            localBackupLastSuccess: backup.createdAt,
            localBackupLastStatus: 'success',
            localBackupLastSummary: `${backup.productCount} products, ${backup.salesCount} sales, ${backup.customerCount} customers (${backup.formattedSize})`,
          });

          addNotification(
            'Daily Local Backup Saved',
            `Automated backup saved ${backup.productCount} products and ${backup.salesCount} sales records to local storage.`,
            'system',
            'success'
          );
        }
      } catch (error) {
        console.warn('Automated daily local backup failed:', error);
        updateSettings({
          localBackupLastStatus: 'failed',
        });
      } finally {
        isBackingUpRef.current = false;
      }
    };

    // Run check on mount with a brief delay so initial load completes smoothly
    const initialTimer = setTimeout(() => {
      checkAndRunBackup();
    }, 3000);

    // Run check periodically every 15 minutes while app is running
    const intervalTimer = setInterval(() => {
      checkAndRunBackup();
    }, 15 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [
    settings.localBackupSchedule,
    settings.localBackupLastSuccess,
    settings.localBackupRetentionCount,
    exportBackup,
    updateSettings,
    addNotification,
  ]);
}
