// Local Storage Bucket & Automated Daily Backup Service
// Saves complete inventory and sales state locally with offline guarantee

export interface LocalBackupRecord {
  id: string;
  name: string;
  createdAt: string;
  timestamp: number;
  type: 'automated' | 'manual';
  productCount: number;
  salesCount: number;
  customerCount: number;
  supplierCount: number;
  byteCount: number;
  formattedSize: string;
  jsonContent: string;
}

const DB_NAME = 'PharmaLeb_LocalBackups_v1';
const DB_VERSION = 1;
const STORE_NAME = 'local_backups';
const STORAGE_EVENT = 'pharmalebanon_local_backups_changed';
const FALLBACK_STORAGE_KEY = 'pharmalebanon_local_backups_bucket_fallback';
const LAST_AUTOMATED_KEY = 'pharmalebanon_last_automated_local_backup';

export function formatByteSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

class LocalBackupStorage {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryFallback: Map<string, LocalBackupRecord> = new Map();

  private getDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return Promise.resolve(null);
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open(DB_NAME, DB_VERSION);

          req.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
              store.createIndex('timestamp', 'timestamp', { unique: false });
            }
          };

          req.onsuccess = () => resolve(req.result);
          req.onerror = () => {
            console.warn('Local backups IndexedDB open error, using fallback');
            resolve(null);
          };
        } catch (e) {
          console.warn('Local backups IndexedDB init error, using fallback:', e);
          resolve(null);
        }
      });
    }

    return this.dbPromise;
  }

  private notifyChange() {
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
      } catch {}
    }
  }

  private saveFallback(record: LocalBackupRecord) {
    this.memoryFallback.set(record.id, record);
    try {
      if (typeof localStorage !== 'undefined') {
        const list = Array.from(this.memoryFallback.values());
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(list));
      }
    } catch {}
  }

  private getFallbackList(): LocalBackupRecord[] {
    if (this.memoryFallback.size > 0) {
      return Array.from(this.memoryFallback.values());
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: LocalBackupRecord) => {
              if (item?.id) this.memoryFallback.set(item.id, item);
            });
            return parsed;
          }
        }
      }
    } catch {}
    return [];
  }

  public async saveBackup(
    jsonContent: string,
    type: 'automated' | 'manual' = 'automated',
    retentionCount = 7
  ): Promise<LocalBackupRecord> {
    let parsed: any = {};
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      throw new Error('Invalid backup JSON payload');
    }

    const productCount = Array.isArray(parsed.products) ? parsed.products.length : 0;
    const salesCount = Array.isArray(parsed.sales) ? parsed.sales.length : 0;
    const customerCount = Array.isArray(parsed.customers) ? parsed.customers.length : 0;
    const supplierCount = Array.isArray(parsed.suppliers) ? parsed.suppliers.length : 0;

    const byteCount = typeof Blob !== 'undefined'
      ? new Blob([jsonContent]).size
      : new TextEncoder().encode(jsonContent).length;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const id = `local-backup-${now.getTime()}`;
    const name = `pharmalebanon-backup-${dateStr}-${timeStr}.json`;

    const record: LocalBackupRecord = {
      id,
      name,
      createdAt: now.toISOString(),
      timestamp: now.getTime(),
      type,
      productCount,
      salesCount,
      customerCount,
      supplierCount,
      byteCount,
      formattedSize: formatByteSize(byteCount),
      jsonContent,
    };

    const db = await this.getDB();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction([STORE_NAME], 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(record);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        } catch (e) {
          reject(e);
        }
      });

      // Prune old backups exceeding retention count
      try {
        const all = await this.listBackups();
        if (all.length > retentionCount) {
          const toRemove = all.slice(retentionCount);
          for (const old of toRemove) {
            await this.deleteBackup(old.id);
          }
        }
      } catch {}
    } else {
      this.saveFallback(record);
      // Prune fallback
      const list = this.getFallbackList().sort((a, b) => b.timestamp - a.timestamp);
      if (list.length > retentionCount) {
        const toRemove = list.slice(retentionCount);
        toRemove.forEach((r) => this.memoryFallback.delete(r.id));
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(Array.from(this.memoryFallback.values())));
          }
        } catch {}
      }
    }

    if (type === 'automated' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LAST_AUTOMATED_KEY, now.toISOString());
      } catch {}
    }

    this.notifyChange();
    return record;
  }

  public async listBackups(): Promise<LocalBackupRecord[]> {
    const db = await this.getDB();
    if (!db) {
      return this.getFallbackList().sort((a, b) => b.timestamp - a.timestamp);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const results = Array.isArray(req.result) ? req.result : [];
          results.sort((a, b) => b.timestamp - a.timestamp);
          resolve(results);
        };
        req.onerror = () => {
          resolve(this.getFallbackList().sort((a, b) => b.timestamp - a.timestamp));
        };
      } catch {
        resolve(this.getFallbackList().sort((a, b) => b.timestamp - a.timestamp));
      }
    });
  }

  public async getBackup(id: string): Promise<LocalBackupRecord | null> {
    const db = await this.getDB();
    if (!db) {
      return this.memoryFallback.get(id) || null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(this.memoryFallback.get(id) || null);
      } catch {
        resolve(this.memoryFallback.get(id) || null);
      }
    });
  }

  public async deleteBackup(id: string): Promise<boolean> {
    const db = await this.getDB();
    let success = false;

    if (db) {
      success = await new Promise((resolve) => {
        try {
          const tx = db.transaction([STORE_NAME], 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.delete(id);
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    }

    if (this.memoryFallback.has(id)) {
      this.memoryFallback.delete(id);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(Array.from(this.memoryFallback.values())));
        }
      } catch {}
      success = true;
    }

    this.notifyChange();
    return success;
  }

  public async clearAll(): Promise<boolean> {
    const db = await this.getDB();
    if (db) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction([STORE_NAME], 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.clear();
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    }
    this.memoryFallback.clear();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(FALLBACK_STORAGE_KEY);
      }
    } catch {}
    this.notifyChange();
    return true;
  }
}

export const localBackupStorage = new LocalBackupStorage();

// Trigger download of a JSON backup file in browser
export function downloadBackupJsonFile(fileName: string, jsonContent: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Check whether automated local backup is due
export function shouldRunDailyLocalBackup(
  lastSuccessIso?: string,
  schedule: 'daily' | 'weekly' | 'manual' = 'daily'
): boolean {
  if (schedule === 'manual') return false;

  let lastTime: number | null = null;
  if (lastSuccessIso) {
    const parsed = Date.parse(lastSuccessIso);
    if (Number.isFinite(parsed)) lastTime = parsed;
  }

  if (!lastTime && typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(LAST_AUTOMATED_KEY);
    if (stored) {
      const parsed = Date.parse(stored);
      if (Number.isFinite(parsed)) lastTime = parsed;
    }
  }

  if (!lastTime) return true; // Never run before -> run immediately

  const intervalMs = schedule === 'weekly'
    ? 7 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;

  return Date.now() - lastTime >= intervalMs;
}

// Perform automated backup
export async function performAutomatedDailyBackup(
  exportBackupFn: () => Promise<string>,
  retentionCount = 7
): Promise<LocalBackupRecord | null> {
  const json = await exportBackupFn();
  if (!json || !json.trim()) {
    throw new Error('Export returned empty database payload');
  }

  return await localBackupStorage.saveBackup(json, 'automated', retentionCount);
}
