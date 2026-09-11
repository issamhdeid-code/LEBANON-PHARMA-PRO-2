// Offline IndexedDB Storage Service for high-capacity local data storage
// Provides unlimited offline storage for products, sales, purchases, and large catalogs
import { Product } from '../types/pharmacy';

const DB_NAME = 'PharmaLebDB_v2';
const DB_VERSION = 1;
const STORE_PRODUCTS = 'products';
const STORE_STATE = 'app_state';

class IndexedDbStorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private getDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return Promise.resolve(null);
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
              db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_STATE)) {
              db.createObjectStore(STORE_STATE);
            }
          };

          request.onsuccess = () => {
            resolve(request.result);
          };

          request.onerror = (e) => {
            console.warn('IndexedDB open error:', e);
            resolve(null);
          };
        } catch (e) {
          console.warn('IndexedDB init error:', e);
          resolve(null);
        }
      });
    }

    return this.dbPromise;
  }

  public async saveProducts(products: Product[]): Promise<boolean> {
    try {
      const db = await this.getDB();
      if (!db) return false;

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_STATE], 'readwrite');
        const store = tx.objectStore(STORE_STATE);
        const req = store.put(products, 'full_products_list');

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('IndexedDB saveProducts error:', e);
      return false;
    }
  }

  public async getProducts(): Promise<Product[] | null> {
    try {
      const db = await this.getDB();
      if (!db) return null;

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_STATE], 'readonly');
        const store = tx.objectStore(STORE_STATE);
        const req = store.get('full_products_list');

        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('IndexedDB getProducts error:', e);
      return null;
    }
  }

  public async clearAll(): Promise<boolean> {
    try {
      const db = await this.getDB();
      if (!db) return false;

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_STATE], 'readwrite');
        const store = tx.objectStore(STORE_STATE);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }
}

export const idbStorage = new IndexedDbStorageService();
