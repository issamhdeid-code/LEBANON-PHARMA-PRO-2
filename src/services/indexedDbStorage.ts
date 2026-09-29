// Offline IndexedDB Storage Service for high-capacity local data storage
// Provides unlimited offline storage for products, sales, purchases, and large catalogs
import {
  Product,
  ArchivedYearData,
  SaleTransaction,
  PurchaseInvoice,
  PurchaseReturn,
  SaleReturn,
  SupplierPayment,
  CustomerPayment,
  Expense,
} from '../types/pharmacy';

const DB_NAME = 'PharmaLebDB_v2';
const DB_VERSION = 1;
const STORE_PRODUCTS = 'products';
const STORE_STATE = 'app_state';

type CollectionKey =
  | 'full_products_list'
  | 'full_sales_list'
  | 'full_purchases_list'
  | 'full_purchase_returns_list'
  | 'full_sale_returns_list'
  | 'full_supplier_payments_list'
  | 'full_customer_payments_list'
  | 'full_expenses_list';

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
    return this.saveCollection('full_products_list', products);
  }

  public async getProducts(): Promise<Product[] | null> {
    return this.getCollection<Product>('full_products_list');
  }

  public async saveSales(sales: SaleTransaction[]): Promise<boolean> {
    return this.saveCollection('full_sales_list', sales);
  }

  public async getSales(): Promise<SaleTransaction[] | null> {
    return this.getCollection<SaleTransaction>('full_sales_list');
  }

  public async savePurchases(purchases: PurchaseInvoice[]): Promise<boolean> {
    return this.saveCollection('full_purchases_list', purchases);
  }

  public async getPurchases(): Promise<PurchaseInvoice[] | null> {
    return this.getCollection<PurchaseInvoice>('full_purchases_list');
  }

  public async savePurchaseReturns(data: PurchaseReturn[]): Promise<boolean> {
    return this.saveCollection('full_purchase_returns_list', data);
  }

  public async getPurchaseReturns(): Promise<PurchaseReturn[] | null> {
    return this.getCollection<PurchaseReturn>('full_purchase_returns_list');
  }

  public async saveSaleReturns(data: SaleReturn[]): Promise<boolean> {
    return this.saveCollection('full_sale_returns_list', data);
  }

  public async getSaleReturns(): Promise<SaleReturn[] | null> {
    return this.getCollection<SaleReturn>('full_sale_returns_list');
  }

  public async saveSupplierPayments(data: SupplierPayment[]): Promise<boolean> {
    return this.saveCollection('full_supplier_payments_list', data);
  }

  public async getSupplierPayments(): Promise<SupplierPayment[] | null> {
    return this.getCollection<SupplierPayment>('full_supplier_payments_list');
  }

  public async saveCustomerPayments(data: CustomerPayment[]): Promise<boolean> {
    return this.saveCollection('full_customer_payments_list', data);
  }

  public async getCustomerPayments(): Promise<CustomerPayment[] | null> {
    return this.getCollection<CustomerPayment>('full_customer_payments_list');
  }

  public async saveExpenses(data: Expense[]): Promise<boolean> {
    return this.saveCollection('full_expenses_list', data);
  }

  public async getExpenses(): Promise<Expense[] | null> {
    return this.getCollection<Expense>('full_expenses_list');
  }

  private async saveCollection(key: CollectionKey, data: unknown[]): Promise<boolean> {
    try {
      const db = await this.getDB();
      if (!db) return false;

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_STATE], 'readwrite');
        const store = tx.objectStore(STORE_STATE);
        const req = store.put(data, key);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn(`IndexedDB saveCollection(${key}) error:`, e);
      return false;
    }
  }

  private async getCollection<T>(key: CollectionKey): Promise<T[] | null> {
    try {
      const db = await this.getDB();
      if (!db) return null;

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_STATE], 'readonly');
        const store = tx.objectStore(STORE_STATE);
        const req = store.get(key);

        req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as T[]) : null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn(`IndexedDB getCollection(${key}) error:`, e);
      return null;
    }
  }

  public async saveArchivedYear(year: number, data: ArchivedYearData): Promise<boolean> {
    try {
      const db = await this.getDB();
      if (!db) return false;

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_STATE], 'readwrite');
        const store = tx.objectStore(STORE_STATE);
        const req = store.put(data, `archived_year_${year}`);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('IndexedDB saveArchivedYear error:', e);
      return false;
    }
  }

  public async getArchivedYear(year: number): Promise<ArchivedYearData | null> {
    try {
      const db = await this.getDB();
      if (!db) return null;

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_STATE], 'readonly');
        const store = tx.objectStore(STORE_STATE);
        const req = store.get(`archived_year_${year}`);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('IndexedDB getArchivedYear error:', e);
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
