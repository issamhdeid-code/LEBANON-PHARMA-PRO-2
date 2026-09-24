import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  localBackupStorage,
  shouldRunDailyLocalBackup,
  performAutomatedDailyBackup,
  formatByteSize,
} from './localBackupService';

describe('LocalBackupService & Storage Bucket', () => {
  const store = new Map<string, string>();

  beforeAll(() => {
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i],
      get length() {
        return store.size;
      },
    };
  });

  beforeEach(async () => {
    store.clear();
    await localBackupStorage.clearAll();
  });

  const samplePayload = JSON.stringify({
    products: [
      { id: 'p1', name: 'Panadol 500mg', barcode: '111', stock: 10, priceUSD: 2.5 },
      { id: 'p2', name: 'Amoxicillin 250mg', barcode: '222', stock: 5, priceUSD: 4.0 },
    ],
    sales: [
      { id: 's1', invoiceNumber: 'INV-100', totalUSD: 5.0, date: '2026-09-24' },
    ],
    customers: [
      { id: 'c1', name: 'Hassan', phone: '03123456' },
      { id: 'c2', name: 'Layla', phone: '70123456' },
    ],
    suppliers: [
      { id: 'sup1', name: 'Mersaco' },
    ],
    settings: { pharmacyName: 'Pharma Test' },
  });

  it('formats byte sizes accurately', () => {
    expect(formatByteSize(0)).toBe('0 B');
    expect(formatByteSize(512)).toBe('512 B');
    expect(formatByteSize(2048)).toBe('2.0 KB');
    expect(formatByteSize(2 * 1024 * 1024)).toBe('2.00 MB');
  });

  it('saves a backup into local storage bucket with correct entity counts', async () => {
    const record = await localBackupStorage.saveBackup(samplePayload, 'automated', 7);

    expect(record).toBeDefined();
    expect(record.id).toContain('local-backup-');
    expect(record.productCount).toBe(2);
    expect(record.salesCount).toBe(1);
    expect(record.customerCount).toBe(2);
    expect(record.supplierCount).toBe(1);
    expect(record.type).toBe('automated');
    expect(record.byteCount).toBeGreaterThan(0);
    expect(record.jsonContent).toBe(samplePayload);
  });

  it('lists stored backups sorted with newest first', async () => {
    await localBackupStorage.saveBackup(samplePayload, 'automated', 7);
    // Small artificial delay to guarantee distinct timestamp
    await new Promise((r) => setTimeout(r, 10));
    await localBackupStorage.saveBackup(samplePayload, 'manual', 7);

    const list = await localBackupStorage.listBackups();
    expect(list.length).toBe(2);
    expect(list[0].timestamp).toBeGreaterThanOrEqual(list[1].timestamp);
  });

  it('enforces retention limit by trimming older backups', async () => {
    const retentionLimit = 3;
    for (let i = 0; i < 5; i++) {
      await localBackupStorage.saveBackup(samplePayload, 'automated', retentionLimit);
      await new Promise((r) => setTimeout(r, 5));
    }

    const list = await localBackupStorage.listBackups();
    expect(list.length).toBeLessThanOrEqual(retentionLimit);
  });

  it('deletes an individual backup from the local bucket', async () => {
    const record = await localBackupStorage.saveBackup(samplePayload, 'manual', 7);
    const beforeList = await localBackupStorage.listBackups();
    expect(beforeList.some((b) => b.id === record.id)).toBe(true);

    const ok = await localBackupStorage.deleteBackup(record.id);
    expect(ok).toBe(true);

    const afterList = await localBackupStorage.listBackups();
    expect(afterList.some((b) => b.id === record.id)).toBe(false);
  });

  it('detects when daily backup is due or not due', () => {
    // Never run before -> due immediately
    expect(shouldRunDailyLocalBackup(undefined, 'daily')).toBe(true);

    // Ran 5 minutes ago -> not due
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(shouldRunDailyLocalBackup(fiveMinutesAgo, 'daily')).toBe(false);

    // Ran 25 hours ago -> due
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(shouldRunDailyLocalBackup(twentyFiveHoursAgo, 'daily')).toBe(true);

    // Schedule set to manual -> never due
    expect(shouldRunDailyLocalBackup(undefined, 'manual')).toBe(false);
    expect(shouldRunDailyLocalBackup(twentyFiveHoursAgo, 'manual')).toBe(false);

    // Weekly schedule: ran 3 days ago -> not due; ran 8 days ago -> due
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldRunDailyLocalBackup(threeDaysAgo, 'weekly')).toBe(false);
    expect(shouldRunDailyLocalBackup(eightDaysAgo, 'weekly')).toBe(true);
  });

  it('performs automated daily backup using provided export function', async () => {
    const mockExport = async () => samplePayload;
    const backup = await performAutomatedDailyBackup(mockExport, 7);

    expect(backup).not.toBeNull();
    expect(backup?.productCount).toBe(2);
    expect(backup?.salesCount).toBe(1);
    expect(backup?.type).toBe('automated');

    const storedLast = localStorage.getItem('pharmalebanon_last_automated_local_backup');
    expect(storedLast).toBeDefined();
  });
});
