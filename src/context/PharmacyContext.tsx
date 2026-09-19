import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import {
  Product,
  Supplier,
  Customer,
  SaleTransaction,
  PurchaseInvoice,
  SupplierPayment,
  CustomerPayment,
  PharmacySettings,
  User,
  AppNotification,
  RibbonTab,
  ProductCategory,
  ProductBatch,
  SyncStatus,
  SyncConflictLog,
  AppLogEntry,
  LogComponent,
  LogLevel
} from '../types/pharmacy';
import { syncEngine } from '../services/syncEngine';
import { parseMoleculeList } from '../services/mophParsers';
import { OfflineStorage, INITIAL_PRODUCTS, INITIAL_SUPPLIERS } from '../services/storage';
import { notificationService } from '../services/notificationService';
import {
  searchOnlineScientificData,
  findInStockGenericAlternatives,
  extractCleanMolecules,
  resolveStraightforwardScientificInfo,
  getStraightforwardMonograph,
} from '../services/scientificDataService';
import { idbStorage } from '../services/indexedDbStorage';
import { backupToGoogleDrive, getGoogleDriveClientId } from '../services/googleDriveBackup';
import { formatLBPValue } from '../utils/priceUtils';
import { hashPassword, isHashedPassword, verifyPassword } from '../utils/password';

// Settings fields that describe the pharmacy's shared business data and must be
// identical on every terminal. Everything else (theme, dark mode, font size, this
// device's own name/role/IP, etc.) is local to the PC it's set on and never synced.
const SHARED_SETTINGS_KEYS = [
  'pharmacyName', 'pharmacyPhone', 'pharmacyAddress', 'licenseNumber',
  'exchangeRate', 'defaultCurrency', 'lowStockThreshold', 'expiryWarningDays',
] as const;

function pickSharedSettings(source: Partial<PharmacySettings>): Partial<PharmacySettings> {
  const picked: Partial<PharmacySettings> = {};
  for (const key of SHARED_SETTINGS_KEYS) {
    if (key in source) (picked as any)[key] = (source as any)[key];
  }
  return picked;
}

// Combine a locally-held list with one just received from the other PC (e.g. a full
// snapshot after a reconnect) without discarding records made while disconnected.
// Remote wins on a shared id (it's treated as the more authoritative copy for edits),
// but anything that only exists locally — e.g. a sale rung up while offline — is kept.
// Trade-off: a record deleted on the other PC during the outage can reappear this way,
// since there's no deletion log; this only affects the rare case of the exact same
// record being deleted on one side and still present locally on the other.
function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const merged = new Map(remote.map(item => [item.id, item]));
  for (const item of local) {
    if (!merged.has(item.id)) merged.set(item.id, item);
  }
  return Array.from(merged.values());
}

// Same idea as mergeById but for products specifically, which carry a version number:
// whichever side has the higher version for a shared id wins, instead of "remote always wins".
function mergeProductsArrays(local: Product[], remote: Product[]): { merged: Product[]; changed: boolean } {
  const byId = new Map(local.map(p => [p.id, p]));
  const byCode = new Map<string, Product>();
  for (const p of local) {
    const normalized = String(p.code || '').toUpperCase();
    if (normalized && !byCode.has(normalized)) byCode.set(normalized, p);
  }
  let changed = false;
  for (const remoteProd of remote) {
    let localMatch = byId.get(remoteProd.id);
    if (!localMatch) {
      const normalized = String(remoteProd.code || '').toUpperCase();
      localMatch = normalized ? byCode.get(normalized) : undefined;
    }
    if (!localMatch || (remoteProd.version || 0) >= (localMatch.version || 0)) {
      byId.set(remoteProd.id, remoteProd);
      changed = true;
    }
  }
  return { merged: Array.from(byId.values()), changed };
}

// Depletes product stock (with optional batch-level FIFO) to mirror a sale recorded on
// this PC or received from the other terminal. Pure function: no side effects, safe to
// call inside a state updater.
function applySaleStockDepletion(prevProducts: Product[], saleItems: SaleTransaction['items']): { updated: Product[]; mutated: Product[] } {
  const mutatedProds: Product[] = [];
  const updatedProds = prevProducts.map(prod => {
    const soldItems = saleItems.filter(item => item.productId === prod.id || item.productCode === prod.code);
    if (soldItems.length === 0) return prod;

    const totalQtyToDeduct = soldItems.reduce((sum, item) =>
      sum + (item.isPiece && prod.piecesPerBox ? item.quantity / prod.piecesPerBox : item.quantity), 0);
    const nextStock = Math.max(0, prod.stockQuantity - totalQtyToDeduct);

    let nextBatches = [...(prod.batches || [])].map(b => ({ ...b }));
    if (nextBatches.length > 0) {
      // First pass: deplete the exact batch chosen in the cart for each line item
      for (const soldItem of soldItems) {
        const qtyDeduct = soldItem.isPiece && prod.piecesPerBox ? soldItem.quantity / prod.piecesPerBox : soldItem.quantity;
        let remainingForThisItem = qtyDeduct;
        if (soldItem.selectedBatchNumber && soldItem.selectedExpiryDate) {
          const matchingBatchIdx = nextBatches.findIndex(b =>
            b.batchNumber === soldItem.selectedBatchNumber && b.expiryDate === soldItem.selectedExpiryDate
          );
          if (matchingBatchIdx >= 0) {
            const batchQty = nextBatches[matchingBatchIdx].quantity || 0;
            if (batchQty > 0) {
              const depleteQty = Math.min(batchQty, remainingForThisItem);
              nextBatches[matchingBatchIdx].quantity = batchQty - depleteQty;
              remainingForThisItem -= depleteQty;
            }
          }
        }
        // Still not covered: fall back to FIFO across the remaining batches
        if (remainingForThisItem > 0) {
          const sortedIndices = nextBatches
            .map((b, i) => ({ idx: i, exp: new Date(b.expiryDate).getTime() }))
            .sort((a, b) => a.exp - b.exp)
            .map(x => x.idx);
          for (const idx of sortedIndices) {
            if (remainingForThisItem <= 0) break;
            const batchQty = nextBatches[idx].quantity || 0;
            if (batchQty > 0) {
              const depleteQty = Math.min(batchQty, remainingForThisItem);
              nextBatches[idx].quantity = batchQty - depleteQty;
              remainingForThisItem -= depleteQty;
            }
          }
        }
      }
    } else {
      // Fallback when no batches exist
      nextBatches = [{
        batchNumber: prod.batchNumber || '',
        expiryDate: prod.expiryDate || '',
        quantity: nextStock,
      }];
    }

    const nextProd: Product = {
      ...prod,
      stockQuantity: nextStock,
      batches: nextBatches,
      updatedAt: Date.now(),
      version: (prod.version || 1) + 1,
    };
    mutatedProds.push(nextProd);
    return nextProd;
  });
  return { updated: updatedProds, mutated: mutatedProds };
}

// ---- Invoice number helpers ------------------------------------------------------
// Local per-year counter keeps invoices strictly monotonic even when two sales happen
// in the same millisecond or when the sales list is cleared.
const _invoiceCounterCache = new Map<string, number>();

function nextInvoiceNumber(existing: { invoiceNumber?: string }[], prefix: string, fallbackStart: number): string {
  const year = new Date().getFullYear();
  const fullPrefix = `${prefix}-${year}-`;
  let maxExisting = 0;
  for (const inv of existing) {
    if (inv.invoiceNumber?.startsWith(fullPrefix)) {
      const num = parseInt(String(inv.invoiceNumber).split('-')[2], 10);
      if (Number.isFinite(num) && num > maxExisting) maxExisting = num;
    }
  }
  const cached = Math.max(_invoiceCounterCache.get(`${prefix}-${year}`) || 0, maxExisting);
  const next = cached + 1;
  _invoiceCounterCache.set(`${prefix}-${year}`, next);
  return `${fullPrefix}${String(next).padStart(4, '0')}`;
}

interface PharmacyContextType {
  // Authentication & Role
  currentUser: User | null;
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  users: User[];
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;

  // Navigation
  activeTab: RibbonTab;
  setActiveTab: (tab: RibbonTab) => void;

  // Currency & Rates
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
  toLBP: (usd: number) => number;
  toUSD: (lbp: number) => number;
  formatLBP: (amount: number) => string;
  formatUSD: (amount: number) => string;

  // Products & Stock
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'updatedAt' | 'version'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  bulkUpdateProducts: (
    ids: string[],
    updates: Partial<Product> | ((prod: Product) => Partial<Product>)
  ) => { success: boolean; count: number };
  bulkDeleteProducts: (ids: string[]) => { success: boolean; count: number };
  deleteProduct: (id: string) => void;
  deleteAllProducts: () => void;
  updateDrugPriceByCode: (code: string, newPriceLBP: number, newPriceUSD?: number) => { success: boolean; message: string };
  clearPriceChangeIndicators: () => void;
  importProductsFromCSV: (csvText: string) => { success: boolean; importedCount: number; errors: string[]; skippedLowerPricesCount?: number };
  searchScientificDataOnline: (ingredients: string, drugName?: string) => Promise<{
    scientificInfo: any;
    source: string;
    inStockAlternatives: Product[];
  } | null>;
  enrichProductWithOnlineScientifics: (productId: string, forceUpdate?: boolean) => Promise<Product | null>;
  enrichAllProductsOnline: () => Promise<{ total: number; enriched: number }>;
  isSearchingScientifics: boolean;
  standardizeAllScientifics: () => void;

  // Sales & POS
  sales: SaleTransaction[];
  recordSale: (sale: Omit<SaleTransaction, 'id' | 'timestamp' | 'invoiceNumber' | 'synced'>) => SaleTransaction;
  updateSale: (saleId: string, updatedData: Partial<SaleTransaction>) => { success: boolean; error?: string };
  deleteSale: (saleId: string) => { success: boolean };

  // Purchases & Suppliers
  purchases: PurchaseInvoice[];
  supplierPayments: SupplierPayment[];
  recordSupplierPayment: (payment: Omit<SupplierPayment, 'id' | 'timestamp' | 'allocations'>) => { success: boolean; error?: string };
  updateSupplierPayment: (paymentId: string, updatedData: Partial<SupplierPayment>) => { success: boolean; error?: string };
  deleteSupplierPayment: (paymentId: string) => { success: boolean; error?: string };
  recordPurchase: (purchase: Omit<PurchaseInvoice, 'id' | 'timestamp' | 'invoiceNumber'> & { invoiceNumber?: string }) => PurchaseInvoice;
  updatePurchase: (purchaseId: string, updatedData: Partial<PurchaseInvoice>) => { success: boolean; error?: string };
  deletePurchase: (purchaseId: string) => { success: boolean; error?: string };
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  bulkAddSuppliers: (suppliersData: Omit<Supplier, 'id'>[]) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => { success: boolean; error?: string };

  // Customers
  customers: Customer[];
  customerPayments: CustomerPayment[];
  recordCustomerPayment: (payment: Omit<CustomerPayment, 'id' | 'timestamp'>) => { success: boolean; error?: string };
  updateCustomerPayment: (paymentId: string, updatedData: Partial<CustomerPayment>) => { success: boolean; error?: string };
  deleteCustomerPayment: (paymentId: string) => { success: boolean; error?: string };

  addCustomer: (customer: Omit<Customer, 'id'>) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;

  // Settings & Theme
  settings: PharmacySettings;
  updateSettings: (updates: Partial<PharmacySettings>) => void;
  toggleDarkMode: () => void;



  // Notifications
  notifications: AppNotification[];
  unreadCount: number;
  dismissNotification: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (title: string, message: string, type?: AppNotification['type'], severity?: AppNotification['severity']) => void;

  // LAN Sync
  syncStatus: SyncStatus;
  reconnectSync: () => void;
  // Maps userId -> deviceInstanceId of whichever PC that account is currently logged in on
  activeSessions: Record<string, string>;
    // System & Component Activity Logs
  logs: AppLogEntry[];
  addLog: (entry: {
    component: LogComponent;
    action: string;
    level?: LogLevel;
    title: string;
    description: string;
    entityId?: string;
    entityType?: AppLogEntry['entityType'];
    details?: Record<string, any>;
    user?: AppLogEntry['user'];
    device?: string;
  }) => AppLogEntry;
  clearLogs: () => void;
  exportLogs: (format?: 'json' | 'csv') => void;

  // Backup & Restore
  exportBackup: () => Promise<string>;
  restoreBackup: (jsonContent: string) => Promise<boolean>;
  resetDemoData: () => void;
  clearAllData: () => void;
}

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined);

export const PharmacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load state from local offline storage
  OfflineStorage.resetUsersForFirstSetup();
  const [currentUser, setCurrentUser] = useState<User | null>(() => OfflineStorage.getCurrentUser());
  const [users, setUsers] = useState<User[]>(() => OfflineStorage.getUsers());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const [activeTab, setActiveTab] = useState<RibbonTab>(() => {
    const saved = localStorage.getItem('pharma_active_tab');
    return (saved as RibbonTab) || 'dashboard';
  });

  useEffect(() => {
    try {
      localStorage.setItem('pharma_active_tab', activeTab);
    } catch {}
  }, [activeTab]);

  // Guard against a stale saved session (e.g. the user account was deleted, or this is a
  // fresh install that only inherited an old "current user" cookie): force a real re-login
  // instead of silently running as an account that no longer exists.
  useEffect(() => {
    if (currentUser && users.length > 0 && !users.some(u => u.id === currentUser.id)) {
      setCurrentUser(null);
      OfflineStorage.saveCurrentUser(null);
    }
  }, [currentUser, users]);

  // Background hydration from IndexedDB (unlimited offline local storage)
  useEffect(() => {
    idbStorage.getProducts().then((stored) => {
      if (stored && Array.isArray(stored) && stored.length > 0) {
        setProducts((prev) => {
          if (stored.length > prev.length) {
            OfflineStorage.updateMemoryCache(stored);
            return stored;
          }
          return prev;
        });
      }
    });
  }, []);
  const [settings, setSettings] = useState<PharmacySettings>(() => {
    const loaded = OfflineStorage.getSettings();
    // Assign a stable per-install id once, used to tell "logged in on this PC" apart
    // from "logged in on some other PC" when the same account list is shared over sync.
    if (!loaded.deviceInstanceId) {
      loaded.deviceInstanceId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      OfflineStorage.saveSettings(loaded);
    }
    return loaded;
  });
  const [activeSessions, setActiveSessions] = useState<Record<string, string>>({}); // userId -> deviceInstanceId
  const [products, setProducts] = useState<Product[]>(() => OfflineStorage.getProducts());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => OfflineStorage.getSuppliers());
  const [customers, setCustomers] = useState<Customer[]>(() => OfflineStorage.getCustomers());
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>(() => OfflineStorage.getCustomerPayments());
  const [sales, setSales] = useState<SaleTransaction[]>(() => OfflineStorage.getSales());
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>(() => OfflineStorage.getPurchases());
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>(() => OfflineStorage.getSupplierPayments());
  const [notifications, setNotifications] = useState<AppNotification[]>(() => OfflineStorage.getNotifications());
  const [, setSyncConflicts] = useState<SyncConflictLog[]>(() => OfflineStorage.getConflicts());
  const [logs, setLogs] = useState<AppLogEntry[]>(() => OfflineStorage.getLogs());

    const [isSearchingScientifics, setIsSearchingScientifics] = useState(false);

  const exchangeRate = settings.exchangeRate || 89500;

  // Logging Engine across all app components
  const addLog = useCallback((entry: {
    component: LogComponent;
    action: string;
    level?: LogLevel;
    title: string;
    description: string;
    entityId?: string;
    entityType?: AppLogEntry['entityType'];
    details?: Record<string, any>;
    user?: AppLogEntry['user'];
    device?: string;
  }): AppLogEntry => {
    const newLog: AppLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      component: entry.component,
      action: entry.action,
      level: entry.level || 'info',
      title: entry.title,
      description: entry.description,
      user: entry.user || {
        id: currentUser?.id,
        name: currentUser?.name || 'Dr. Tarek El-Khoury',
        role: currentUser?.role || 'admin',
        username: currentUser?.username || 'admin',
      },
      device: entry.device || settings.deviceName || 'Counter 1 (Main POS)',
      entityId: entry.entityId,
      entityType: entry.entityType,
      details: entry.details,
    };

    setLogs(prev => {
      const next = [newLog, ...prev.slice(0, 499)];
      OfflineStorage.saveLogs(next);
      return next;
    });

    return newLog;
  }, [currentUser, settings.deviceName]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    OfflineStorage.saveLogs([]);
  }, []);

  const exportLogs = useCallback((format: 'json' | 'csv' = 'json') => {
    if (format === 'json') {
      const jsonStr = JSON.stringify(logs, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pharmalebanon_audit_logs_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['ID', 'Timestamp', 'Date & Time', 'Component', 'Action', 'Level', 'Title', 'Description', 'User', 'Role', 'Device', 'Entity ID', 'Entity Type'];
      const rows = logs.map(l => [
        `"${l.id}"`,
        l.timestamp,
        `"${new Date(l.timestamp).toLocaleString()}"`,
        `"${l.component}"`,
        `"${l.action}"`,
        `"${l.level}"`,
        `"${(l.title || '').replace(/"/g, '""')}"`,
        `"${(l.description || '').replace(/"/g, '""')}"`,
        `"${(l.user?.name || '').replace(/"/g, '""')}"`,
        `"${l.user?.role || ''}"`,
        `"${(l.device || '').replace(/"/g, '""')}"`,
        `"${l.entityId || ''}"`,
        `"${l.entityType || ''}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pharmalebanon_audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [logs]);

  // Currency helpers
  const toLBP = useCallback((usd: number): number => {
    return Math.round(usd * exchangeRate);
  }, [exchangeRate]);

  const toUSD = useCallback((lbp: number): number => {
    return Number((lbp / exchangeRate).toFixed(2));
  }, [exchangeRate]);

  const formatLBP = useCallback((amount: number): string => {
    return `${formatLBPValue(amount)} L.L.`;
  }, []);

  const formatUSD = useCallback((amount: number): string => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);



  // Notifications helper
  const addNotification = useCallback((
    title: string,
    message: string,
    type: AppNotification['type'] = 'system',
    severity: AppNotification['severity'] = 'info'
  ) => {
    if (settingsRef.current.notificationsEnabled === false) return;
    const notifyKey = `notify${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof PharmacySettings;
    if (settingsRef.current[notifyKey] === false) return;

    const notif = notificationService.showPush(
      title,
      message,
      type,
      severity
    );
    setNotifications(prev => {
      const next = [notif, ...prev.slice(0, 49)];
      OfflineStorage.saveNotifications(next);
      return next;
    });
  }, []);

  // Refs let socket callbacks always read the latest state without forcing a socket
  // reconnect every time products/sales/etc change.
  const productsRef = useRef(products);
  const salesRef = useRef(sales);
  const suppliersRef = useRef(suppliers);
  const customersRef = useRef(customers);
  const purchasesRef = useRef(purchases);
  const usersRef = useRef(users);
  const settingsRef = useRef(settings);
  const activeSessionsRef = useRef(activeSessions);
  const notificationsRef = useRef(notifications);
  const logsRef = useRef(logs);
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => { salesRef.current = sales; }, [sales]);
  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);
  useEffect(() => { logsRef.current = logs; }, [logs]);
  useEffect(() => { suppliersRef.current = suppliers; }, [suppliers]);
  useEffect(() => { customersRef.current = customers; }, [customers]);
  useEffect(() => { purchasesRef.current = purchases; }, [purchases]);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { activeSessionsRef.current = activeSessions; }, [activeSessions]);

  // LAN Sync: connect to the other PC and keep local data in sync.
  // Defined as a stable callback (reads live values via refs) so it can be re-triggered
  // manually (e.g. a "Retry Connection" button) without needing settings to change.
  const connectSyncEngine = useCallback(() => {
    const applyRemoteProducts = (incoming: Product[]) => {
      setProducts(prev => {
        const { merged, changed } = mergeProductsArrays(prev, incoming);
        if (!changed) return prev;
        OfflineStorage.saveProducts(merged);
        idbStorage.saveProducts(merged).catch(() => {});
        return merged;
      });
    };

    const upsertById = <T extends { id: string }>(list: T[], incoming: T): T[] => {
      const idx = list.findIndex(item => item.id === incoming.id);
      if (idx === -1) return [...list, incoming];
      const next = [...list];
      next[idx] = incoming;
      return next;
    };

    syncEngine.init(
      settingsRef.current.syncMode || 'main',
      settingsRef.current.mainPcIp || '',
      (status) => setSyncStatus(status),
      (payload) => {
        if (payload.type === 'STOCK_MUTATION') {
          applyRemoteProducts(Array.isArray(payload.data) ? payload.data : [payload.data]);
        } else if (payload.type === 'PRODUCT_DELETED') {
          if (payload.data?.all) {
            // Whole catalog wiped on the other PC — mirror it here.
            setProducts(prev => {
              if (prev.length === 0) return prev;
              OfflineStorage.saveProducts([]);
              idbStorage.saveProducts([]).catch(() => {});
              return [];
            });
          } else {
            const deletedId = payload.data?.id;
            setProducts(prev => {
              if (!deletedId || !prev.some(p => p.id === deletedId)) return prev;
              const next = prev.filter(p => p.id !== deletedId);
              OfflineStorage.saveProducts(next);
              idbStorage.saveProducts(next).catch(() => {});
              return next;
            });
          }
        } else if (payload.type === 'PRICE_UPDATE') {
          const remoteProduct = payload.data as Product;
          if (!remoteProduct || !remoteProduct.id) return;
          const remoteCode = String(remoteProduct.code || '').toUpperCase();
          setProducts(prev => {
            const next = prev.map(p => {
              const matches = p.id === remoteProduct.id || p.code.toUpperCase() === remoteCode;
              return matches
                ? (remoteProduct.version || 0) >= (p.version || 0) ? remoteProduct : p
                : p;
            });
            if (next.some((p, i) => p !== prev[i])) {
              OfflineStorage.saveProducts(next);
              idbStorage.saveProducts(next).catch(() => {});
            }
            return next;
          });
        } else if (payload.type === 'SALE_CREATED') {
          const remoteSale = payload.data as SaleTransaction;
          setSales(prev => {
            if (!remoteSale || prev.some(s => s.id === remoteSale.id)) return prev;
            const next = [remoteSale, ...prev];
            OfflineStorage.saveSales(next);
            return next;
          });
          // Mirror the stock that the other terminal dispensed for this sale, so both
          // PCs converge on the same quantities without waiting for a snapshot.
          if (remoteSale?.items?.length) {
            setProducts(prev => {
              const { updated: updatedProds } = applySaleStockDepletion(prev, remoteSale.items);
              OfflineStorage.saveProducts(updatedProds);
              idbStorage.saveProducts(updatedProds).catch(() => {});
              return updatedProds;
            });
          }
        } else if (payload.type === 'CLEAR_ALL_DATA') {
          // The other terminal wiped everything — mirror the wipe locally.
          setProducts([]);
          setSuppliers([]);
          setCustomers([]);
          setSales([]);
          setPurchases([]);
          setLogs([]);
          OfflineStorage.clearAllData();
          addNotification('Data Cleared', 'Data was cleared from the other terminal.', 'system', 'warning');
        } else if (payload.type === 'SALE_UPDATED') {
          const remoteSale = payload.data as SaleTransaction;
          setSales(prev => {
            if (!remoteSale || !prev.some(s => s.id === remoteSale.id)) return prev;
            const next = upsertById(prev, remoteSale);
            OfflineStorage.saveSales(next);
            return next;
          });
        } else if (payload.type === 'SALE_DELETED') {
          const deletedId = payload.data?.id;
          setSales(prev => {
            if (!deletedId || !prev.some(s => s.id === deletedId)) return prev;
            const next = prev.filter(s => s.id !== deletedId);
            OfflineStorage.saveSales(next);
            return next;
          });
        } else if (payload.type === 'SUPPLIER_UPSERT') {
          const remoteSup = payload.data as Supplier;
          if (!remoteSup) return;
          setSuppliers(prev => {
            const next = upsertById(prev, remoteSup);
            OfflineStorage.saveSuppliers(next);
            return next;
          });
        } else if (payload.type === 'SUPPLIER_DELETED') {
          const deletedId = payload.data?.id;
          setSuppliers(prev => {
            if (!deletedId || !prev.some(s => s.id === deletedId)) return prev;
            const next = prev.filter(s => s.id !== deletedId);
            OfflineStorage.saveSuppliers(next);
            return next;
          });

        } else if (payload.type === 'CUSTOMER_PAYMENT_UPSERT') {
          const remotePayment = payload.data as CustomerPayment;
          if (!remotePayment) return;
          setCustomerPayments(prev => {
            const exists = prev.some(p => p.id === remotePayment.id);
            const next = exists ? prev.map(p => p.id === remotePayment.id ? remotePayment : p) : [remotePayment, ...prev];
            OfflineStorage.saveCustomerPayments(next);
            return next;
          });
        } else if (payload.type === 'CUSTOMER_PAYMENT_DELETED') {
          const deletedId = payload.data.id;
          if (!deletedId) return;
          setCustomerPayments(prev => {
            const next = prev.filter(p => p.id !== deletedId);
            OfflineStorage.saveCustomerPayments(next);
            return next;
          });
        } else if (payload.type === 'CUSTOMER_UPSERT') {
          const remoteCust = payload.data as Customer;
          if (!remoteCust) return;
          setCustomers(prev => {
            const next = upsertById(prev, remoteCust);
            OfflineStorage.saveCustomers(next);
            return next;
          });
        } else if (payload.type === 'PURCHASE_CREATED') {
          const remotePurchase = payload.data as PurchaseInvoice;
          setPurchases(prev => {
            if (!remotePurchase || prev.some(p => p.id === remotePurchase.id)) return prev;
            const next = [remotePurchase, ...prev];
            OfflineStorage.savePurchases(next);
            return next;
          });
        } else if (payload.type === 'PURCHASE_UPDATED') {
          const remotePurchase = payload.data as PurchaseInvoice;
          setPurchases(prev => {
            if (!remotePurchase) return prev;
            const next = prev.map(p => p.id === remotePurchase.id ? remotePurchase : p);
            OfflineStorage.savePurchases(next);
            return next;
          });
        } else if (payload.type === 'PURCHASE_DELETED') {
          const deletedId = payload.data?.id;
          setPurchases(prev => {
            if (!deletedId || !prev.some(p => p.id === deletedId)) return prev;
            const next = prev.filter(p => p.id !== deletedId);
            OfflineStorage.savePurchases(next);
            return next;
          });
        } else if (payload.type === 'USER_UPSERT') {
          const remoteUser = payload.data as User;
          if (!remoteUser) return;
          setUsers(prev => {
            const next = upsertById(prev, remoteUser);
            OfflineStorage.saveUsers(next);
            return next;
          });
        } else if (payload.type === 'USER_DELETED') {
          const deletedId = payload.data?.id;
          setUsers(prev => {
            if (!deletedId || !prev.some(u => u.id === deletedId)) return prev;
            const next = prev.filter(u => u.id !== deletedId);
            OfflineStorage.saveUsers(next);
            return next;
          });
        } else if (payload.type === 'SETTINGS_UPDATE') {
          // Only shared/business fields ever travel over the wire (see pickSharedSettings)
          setSettings(prev => {
            const next = { ...prev, ...payload.data };
            OfflineStorage.saveSettings(next);
            return next;
          });
        } else if (payload.type === 'USER_SESSION') {
          const { userId, deviceInstanceId, status } = payload.data || {};
          if (!userId || !deviceInstanceId) return;
          setActiveSessions(prev => {
            if (status === 'online') {
              return { ...prev, [userId]: deviceInstanceId };
            }
            // Only clear if the offline notice actually comes from the device that held the session
            if (prev[userId] === deviceInstanceId) {
              const next = { ...prev };
              delete next[userId];
              return next;
            }
            return prev;
          });
        }
      },
      (requesterId, requesterData) => {
        // Only the Main PC answers snapshot requests
        if ((settingsRef.current.syncMode || 'main') === 'main') {
          let mergedProducts = productsRef.current;
          let mergedSales = salesRef.current;
          let mergedSuppliers = suppliersRef.current;
          let mergedCustomers = customersRef.current;
          let mergedPurchases = purchasesRef.current;
          let mergedUsers = usersRef.current;
          let mergedNotifications = notificationsRef.current;
          let mergedLogs = logsRef.current;

          // Absorb whatever the reconnecting Secondary recorded while it was offline,
          // instead of just overwriting it with Main's view once we answer.
          if (requesterData) {
            if (Array.isArray(requesterData.products)) {
              const { merged, changed } = mergeProductsArrays(productsRef.current, requesterData.products);
              if (changed) {
                mergedProducts = merged;
                setProducts(merged);
                OfflineStorage.saveProducts(merged);
                idbStorage.saveProducts(merged).catch(() => {});
              }
            }
            if (Array.isArray(requesterData.sales)) {
              mergedSales = mergeById(requesterData.sales, salesRef.current);
              setSales(mergedSales);
              OfflineStorage.saveSales(mergedSales);
            }
            if (Array.isArray(requesterData.suppliers)) {
              mergedSuppliers = mergeById(requesterData.suppliers, suppliersRef.current);
              setSuppliers(mergedSuppliers);
              OfflineStorage.saveSuppliers(mergedSuppliers);
            }
            if (Array.isArray(requesterData.customers)) {
              mergedCustomers = mergeById(requesterData.customers, customersRef.current);
              setCustomers(mergedCustomers);
              OfflineStorage.saveCustomers(mergedCustomers);
            }
            if (Array.isArray(requesterData.purchases)) {
              mergedPurchases = mergeById(requesterData.purchases, purchasesRef.current);
              setPurchases(mergedPurchases);
              OfflineStorage.savePurchases(mergedPurchases);
            }
            if (Array.isArray(requesterData.users)) {
              mergedUsers = mergeById(requesterData.users, usersRef.current);
              setUsers(mergedUsers);
              OfflineStorage.saveUsers(mergedUsers);
            }
            if (Array.isArray(requesterData.notifications)) {
              mergedNotifications = mergeById(requesterData.notifications, notificationsRef.current);
              setNotifications(mergedNotifications);
              OfflineStorage.saveNotifications(mergedNotifications);
            }
            if (Array.isArray(requesterData.logs)) {
              mergedLogs = mergeById(requesterData.logs, logsRef.current);
              setLogs(mergedLogs);
              OfflineStorage.saveLogs(mergedLogs);
            }
          }

          syncEngine.sendSnapshot(requesterId, {
            products: mergedProducts,
            sales: mergedSales,
            suppliers: mergedSuppliers,
            customers: mergedCustomers,
            purchases: mergedPurchases,
            users: mergedUsers,
            settings: pickSharedSettings(settingsRef.current),
            activeSessions: activeSessionsRef.current,
            notifications: mergedNotifications,
            logs: mergedLogs,
          });
        }
      },
      (snapshotData) => {
        // Secondary PC: adopt the Main PC's dataset, merging rather than overwriting so
        // anything recorded locally while disconnected (e.g. offline sales) isn't lost.
        if (snapshotData?.products) applyRemoteProducts(snapshotData.products);
        if (Array.isArray(snapshotData?.sales)) {
          setSales(prev => {
            const next = mergeById(prev, snapshotData.sales);
            OfflineStorage.saveSales(next);
            return next;
          });
        }
        if (Array.isArray(snapshotData?.suppliers)) {
          setSuppliers(prev => {
            const next = mergeById(prev, snapshotData.suppliers);
            OfflineStorage.saveSuppliers(next);
            return next;
          });
        }
        if (Array.isArray(snapshotData?.customers)) {
          setCustomers(prev => {
            const next = mergeById(prev, snapshotData.customers);
            OfflineStorage.saveCustomers(next);
            return next;
          });
        }
        if (Array.isArray(snapshotData?.purchases)) {
          setPurchases(prev => {
            const next = mergeById(prev, snapshotData.purchases);
            OfflineStorage.savePurchases(next);
            return next;
          });
        }
        if (Array.isArray(snapshotData?.users)) {
          setUsers(prev => {
            const next = mergeById(prev, snapshotData.users);
            OfflineStorage.saveUsers(next);
            return next;
          });
        }
        if (snapshotData?.settings) {
          setSettings(prev => {
            const next = { ...prev, ...snapshotData.settings };
            OfflineStorage.saveSettings(next);
            return next;
          });
        }
        if (snapshotData?.activeSessions && typeof snapshotData.activeSessions === 'object') {
          setActiveSessions(prev => ({ ...prev, ...snapshotData.activeSessions }));
        }
        if (Array.isArray(snapshotData?.notifications)) {
          setNotifications(prev => {
            const next = mergeById(snapshotData.notifications, prev);
            OfflineStorage.saveNotifications(next);
            return next;
          });
        }
        if (Array.isArray(snapshotData?.logs)) {
          setLogs(prev => {
            const next = mergeById(snapshotData.logs, prev);
            OfflineStorage.saveLogs(next);
            return next;
          });
        }
        addNotification('Data Synced', 'Received latest data from Main PC.', 'sync', 'success');
      },
      () => ({
        // Sent along with a Secondary's snapshot request so Main can merge in anything
        // recorded locally while this PC was disconnected, instead of it being lost.
        products: productsRef.current,
        sales: salesRef.current,
        suppliers: suppliersRef.current,
        customers: customersRef.current,
        purchases: purchasesRef.current,
        users: usersRef.current,
        notifications: notificationsRef.current,
        logs: logsRef.current,
      })
    );
  }, [addNotification]);

  useEffect(() => {
    let cancelled = false;
    // Forget any sync secret an older build may have written locally; pairing
    // with the Main PC now needs only its IP address.
    try {
      localStorage.removeItem('pharmalebanon_sync_secret_v1');
    } catch { /* ignore */ }
    if (!cancelled) connectSyncEngine();
    return () => {
      cancelled = true;
      syncEngine.disconnect();
    };
  }, [settings.syncMode, settings.mainPcIp, connectSyncEngine]);

  // Check low stock and expiry periodically
  useEffect(() => {
    const checkAlerts = () => {
      if (settings.enableLowStockAlerts !== false) {
        const lowStockItems = products.filter(p => {
          const threshold = p.minStockAlert !== undefined ? p.minStockAlert : (settings.lowStockThreshold !== undefined ? settings.lowStockThreshold : 5);
          return p.stockQuantity <= threshold;
        });
        if (lowStockItems.length > 0) {
          const itemNames = lowStockItems.slice(0, 3).map(p => `${p.name} (${p.stockQuantity} left)`).join(', ');
          const extra = lowStockItems.length > 3 ? ` and ${lowStockItems.length - 3} others` : '';
          addNotification(
            'Low Inventory Alert',
            `Critical stock level for: ${itemNames}${extra}. Replenish from supplier.`,
            'inventory',
            'warning'
          );
        }
      }

      if (settings.enableExpiryAlerts !== false) {
        // Check expiring items (< 90 days)
        const now = new Date();
        const warningThreshold = new Date(now.getTime() + settings.expiryWarningDays * 24 * 60 * 60 * 1000);
        const expiringItems = products.filter(p => {
          if (!p.expiryDate) return false;
          const exp = new Date(p.expiryDate);
          return exp > now && exp <= warningThreshold;
        });
        if (expiringItems.length > 0) {
          const first = expiringItems[0];
          addNotification(
            'Medication Expiry Alert',
            `${first.name} expires on ${first.expiryDate} (Batch: ${first.batchNumber}). Check dispensary shelf.`,
            'expiry',
            'warning'
          );
        }
      }
    };

    // Run once after mount
    const timeout = setTimeout(checkAlerts, 1800);
    return () => clearTimeout(timeout);
  }, [products, settings.lowStockThreshold, settings.expiryWarningDays, addNotification]);

  // Sync settings to document class
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  useEffect(() => {
    const fontSizes = { small: '14px', normal: '16px', large: '18px' };
    document.documentElement.style.fontSize = fontSizes[settings.fontSize] || fontSizes.normal;
    document.documentElement.style.zoom = `${Math.min(150, Math.max(80, settings.appZoom || 100))}%`;
    return () => {
      document.documentElement.style.fontSize = '';
      document.documentElement.style.zoom = '';
    };
  }, [settings.fontSize, settings.appZoom]);

  // Reconcile supplier balances that may have been affected by previous currency mismatch bug
  useEffect(() => {
    setSuppliers(prevSuppliers => {
      let hasChange = false;
      const updated = prevSuppliers.map(sup => {
        const supPurchases = purchases.filter(p => p.supplierId === sup.id);
        if (supPurchases.length === 0) return sup;

        const unpaidPurchases = supPurchases.filter(p => !p.paid);
        const isInitialWithOpening = INITIAL_SUPPLIERS.find(s => s.id === sup.id && ((s.balanceUSD || 0) > 0 || (s.balanceLBP || 0) > 0));

        if (unpaidPurchases.length === 0) {
          if (!isInitialWithOpening) {
            if ((sup.balanceUSD || 0) > 0 || (sup.balanceLBP || 0) > 0) {
              hasChange = true;
              return { ...sup, balanceUSD: 0, balanceLBP: 0 };
            }
          } else {
            const paidLbpPurchases = supPurchases.filter(p => p.paid && p.currency === 'LBP');
            const totalPaidLbpUSD = paidLbpPurchases.reduce((acc, p) => acc + (p.totalCostUSD || 0), 0);
            if (totalPaidLbpUSD > 0 && Math.abs((sup.balanceUSD || 0) - ((isInitialWithOpening.balanceUSD || 0) + totalPaidLbpUSD)) < 0.05) {
              hasChange = true;
              return { ...sup, balanceUSD: isInitialWithOpening.balanceUSD || 0 };
            }
          }
        } else {
          const unpaidUsd = unpaidPurchases.filter(p => p.currency === 'USD' || !p.currency);
          if (unpaidUsd.length === 0) {
            const expectedUsd = isInitialWithOpening ? (isInitialWithOpening.balanceUSD || 0) : 0;
            if ((sup.balanceUSD || 0) > expectedUsd) {
              hasChange = true;
              return { ...sup, balanceUSD: expectedUsd };
            }
          }
        }
        return sup;
      });

      if (hasChange) {
        OfflineStorage.saveSuppliers(updated);
        return updated;
      }
      return prevSuppliers;
    });
  }, []);

  // Auth methods
  const login = (username: string, password: string): { success: boolean; error?: string } => {
    const trimmedUser = username.trim().toLowerCase();
    const found = users.find(u => u.username.toLowerCase() === trimmedUser && verifyPassword(password, u.password));
    if (found) {
      // One-time migration: upgrade any legacy plaintext-stored password to its hash
      // and push the upgraded user to the other terminal so plaintext disappears.
      if (found.password && !isHashedPassword(found.password)) {
        const upgradedUsers = users.map(u => u.id === found.id ? { ...u, password: hashPassword(found.password || '') } : u);
        setUsers(upgradedUsers);
        OfflineStorage.saveUsers(upgradedUsers);
        try {
          const upgradedUser = upgradedUsers.find(u => u.id === found.id);
          if (upgradedUser) syncEngine.broadcast('USER_UPSERT', upgradedUser);
        } catch (e) {}
      }
      const heldBy = activeSessions[found.id];
      if (heldBy && heldBy !== settings.deviceInstanceId) {
        return { success: false, error: `${found.name} is already signed in on another PC. Choose a different account.` };
      }
      setCurrentUser(found);
      OfflineStorage.saveCurrentUser(found);
      setActiveSessions(prev => ({ ...prev, [found.id]: settings.deviceInstanceId || '' }));
      try {
        syncEngine.broadcast('USER_SESSION', { userId: found.id, deviceInstanceId: settings.deviceInstanceId, status: 'online' });
      } catch (e) {}
      addNotification('Welcome Back', `Logged in as ${found.name} (${found.role.toUpperCase()})`, 'system', 'success');
      addLog({
        component: 'Auth / Security',
        action: 'USER_LOGIN',
        level: 'success',
        title: `Staff Sign In: ${found.name}`,
        description: `User "${found.username}" signed in with ${found.role} privileges.`,
        user: { id: found.id, name: found.name, role: found.role, username: found.username },
        details: { role: found.role, username: found.username, terminal: settings.deviceName }
      });
      return { success: true };
    }
    addLog({
      component: 'Auth / Security',
      action: 'LOGIN_FAILED',
      level: 'warning',
      title: 'Failed Sign In Attempt',
      description: `Unsuccessful login attempt with username "${username}".`,
      details: { attemptedUsername: username, terminal: settings.deviceName }
    });
    return { success: false, error: 'Invalid username or password.' };
  };

  const logout = () => {
    if (currentUser) {
      addLog({
        component: 'Auth / Security',
        action: 'USER_LOGOUT',
        level: 'info',
        title: `Staff Sign Out: ${currentUser.name}`,
        description: `User "${currentUser.username}" signed out. Session safely terminated.`,
        user: { id: currentUser.id, name: currentUser.name, role: currentUser.role, username: currentUser.username }
      });
      setActiveSessions(prev => {
        const next = { ...prev };
        delete next[currentUser.id];
        return next;
      });
      try {
        syncEngine.broadcast('USER_SESSION', { userId: currentUser.id, deviceInstanceId: settings.deviceInstanceId, status: 'offline' });
      } catch (e) {}
    }
    setCurrentUser(null);
    OfflineStorage.saveCurrentUser(null);
  };

  // Best-effort: free up this device's session if the window/app is closed without an explicit Sign Out
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentUser) {
        try {
          syncEngine.broadcast('USER_SESSION', { userId: currentUser.id, deviceInstanceId: settings.deviceInstanceId, status: 'offline' });
        } catch (e) {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentUser, settings.deviceInstanceId]);

  // Re-announce this device's session whenever the socket (re)connects — covers both a
  // reconnect after a drop, and a currentUser restored from storage on app startup (which
  // never went through login(), so the rest of the network wouldn't otherwise know about it).
  useEffect(() => {
    if (syncStatus === 'connected' && currentUser) {
      setActiveSessions(prev => ({ ...prev, [currentUser.id]: settings.deviceInstanceId || '' }));
      try {
        syncEngine.broadcast('USER_SESSION', { userId: currentUser.id, deviceInstanceId: settings.deviceInstanceId, status: 'online' });
      } catch (e) {}
    }
  }, [syncStatus, currentUser, settings.deviceInstanceId]);

  const addUser = (userData: Omit<User, 'id'>) => {
    const newUser: User = {
      ...userData,
      id: `user-${Date.now()}`,
      password: userData.password ? hashPassword(userData.password) : undefined,
    };
    const updated = [...users, newUser];
    setUsers(updated);
    OfflineStorage.saveUsers(updated);
    try { syncEngine.broadcast('USER_UPSERT', newUser); } catch (e) {}
    addNotification('User Created', `Added staff user: ${newUser.name}`, 'system', 'success');
    addLog({
      component: 'Auth / Security',
      action: 'USER_CREATED',
      level: 'success',
      title: `Staff Profile Created: ${newUser.name}`,
      description: `Registered user "${newUser.username}" with role: ${newUser.role}.`,
      entityId: newUser.id,
      entityType: 'user',
      details: { role: newUser.role, username: newUser.username }
    });
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    const updated = users.map(u => u.id === id ? {
      ...u,
      ...updates,
      password: updates.password ? hashPassword(updates.password) : u.password,
    } : u);
    setUsers(updated);
    OfflineStorage.saveUsers(updated);
    try {
      const updatedUser = updated.find(u => u.id === id);
      if (updatedUser) syncEngine.broadcast('USER_UPSERT', updatedUser);
    } catch (e) {}
    addLog({
      component: 'Auth / Security',
      action: 'USER_UPDATED',
      level: 'info',
      title: 'Staff Profile Modified',
      description: `Updated account settings for user ID: ${id}`,
      entityId: id,
      entityType: 'user',
      details: updates
    });
  };

  const deleteUser = (id: string) => {
    const userToDelete = users.find(u => u.id === id);
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    OfflineStorage.saveUsers(updated);
    try { syncEngine.broadcast('USER_DELETED', { id }); } catch (e) {}
    if (userToDelete) {
      addLog({
        component: 'Auth / Security',
        action: 'USER_DELETED',
        level: 'warning',
        title: `Staff Account Removed: ${userToDelete.name}`,
        description: `Deleted staff profile "${userToDelete.username}".`,
        entityId: id,
        entityType: 'user'
      });
    }
  };

  // Settings
  const updateSettings = (updates: Partial<PharmacySettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      OfflineStorage.saveSettings(next);
      return next;
    });
    // Only pharmacy-wide business fields sync across PCs; per-device UI/network prefs stay local
    const sharedUpdates = pickSharedSettings(updates);
    if (Object.keys(sharedUpdates).length > 0) {
      try { syncEngine.broadcast('SETTINGS_UPDATE', sharedUpdates); } catch (e) {}
    }
  };

  const setExchangeRate = (rate: number) => {
    if (!Number.isFinite(rate) || rate <= 0) return;
    updateSettings({ exchangeRate: rate });
    // Recalculate all USD prices based on updated rate and broadcast the affected
    // products only — sending the entire catalog on every rate change is unnecessary.
    setProducts(prev => {
      const updated = prev.map(p => ({
        ...p,
        priceUSD: Number((p.priceLBP / rate).toFixed(2)),
        updatedAt: Date.now(),
        version: (p.version || 1) + 1,
      }));
      OfflineStorage.saveProducts(updated);
      try { syncEngine.broadcast('STOCK_MUTATION', updated); } catch (e) {}
      return updated;
    });
    addNotification('Exchange Rate Updated', `New rate: ${formatLBPValue(rate)} L.L. per 1 USD`, 'system', 'info');
  };

  const toggleDarkMode = () => {
    updateSettings({ darkMode: !settings.darkMode });
  };

  // Product CRUD
  const searchScientificDataOnline = useCallback(async (ingredients: string, drugName?: string) => {
    setIsSearchingScientifics(true);
    try {
      const res = await searchOnlineScientificData(ingredients, drugName, products);
      return res;
    } finally {
      setIsSearchingScientifics(false);
    }
  }, [products]);

  const enrichProductWithOnlineScientifics = useCallback(
    async (productId: string, forceUpdate = false): Promise<Product | null> => {
      const currentList = OfflineStorage.getProducts();
      const target = currentList.find((p) => p.id === productId) || products.find((p) => p.id === productId);
      if (!target || target.category !== 'drug') return null;

      if (!forceUpdate && target.scientificInfo?.onlineEnriched && target.scientificInfo?.indications) {
        return target;
      }

      if (!target.ingredients || !target.ingredients.trim()) {
        addNotification(
          'Active Ingredient Missing',
          `Cannot fetch scientific data for ${target.name}. Active ingredient is blank in stock.`,
          'inventory',
          'warning'
        );
        return target;
      }

      const activeMolecule = target.ingredients.trim();

      setIsSearchingScientifics(true);
      try {
        const res = await searchOnlineScientificData(activeMolecule, target.name, currentList, {
          dosage: target.dosage,
          form: target.form,
          presentation: target.presentation,
          molecules: target.molecules,
        });
        if (res?.scientificInfo) {
          const inStockNames = findInStockGenericAlternatives(target, currentList).map(
            (a) => `${a.name} (${a.code}) - ${a.stockQuantity} in stock`
          );
          const updatedProd: Product = {
            ...target,
            scientificInfo: {
              ...target.scientificInfo,
              ...res.scientificInfo,
              generics: inStockNames,
              onlineEnriched: true,
              onlineSource: res.source,
              lastOnlineSearch: Date.now(),
            },
            updatedAt: Date.now(),
            version: (target.version || 1) + 1,
          };

          setProducts((prev) => {
            const next = prev.map((p) => (p.id === productId ? updatedProd : p));
            OfflineStorage.saveProducts(next);
            return next;
          });

          addNotification(
            'Online Scientific Data Linked',
            `Monograph for ${target.name} (${activeMolecule}) updated from ${res.source}.`,
            'inventory',
            'info'
          );
          return updatedProd;
        }
      } catch (e) {
        console.warn('Failed to enrich product online:', e);
      } finally {
        setIsSearchingScientifics(false);
      }
      return target;
    },
    [products, addNotification]
  );

  const enrichAllProductsOnline = useCallback(async (): Promise<{ total: number; enriched: number }> => {
    const currentList = OfflineStorage.getProducts();
    const drugsToEnrich = currentList.filter((p) => p.category === 'drug');
    if (drugsToEnrich.length === 0) return { total: 0, enriched: 0 };

    setIsSearchingScientifics(true);
    let enrichedCount = 0;
    const nextList = [...currentList];

    try {
      for (const drug of drugsToEnrich) {
        const molecule = drug.ingredients?.trim();
        if (!molecule) continue;

        try {
          const res = await searchOnlineScientificData(molecule, drug.name, nextList, {
            dosage: drug.dosage,
            form: drug.form,
            presentation: drug.presentation,
            molecules: drug.molecules,
          });
          if (res?.scientificInfo) {
            const idx = nextList.findIndex((p) => p.id === drug.id);
            if (idx !== -1) {
              const inStockNames = findInStockGenericAlternatives(drug, nextList).map(
                (a) => `${a.name} (${a.code}) - ${a.stockQuantity} in stock`
              );
              nextList[idx] = {
                ...nextList[idx],
                scientificInfo: {
                  ...nextList[idx].scientificInfo,
                  ...res.scientificInfo,
                  generics: inStockNames,
                  onlineEnriched: true,
                  onlineSource: res.source,
                  lastOnlineSearch: Date.now(),
                },
                updatedAt: Date.now(),
                version: (nextList[idx].version || 1) + 1,
              };
              enrichedCount++;
            }
          }
          // Throttle to respect public APIs and avoid 429 rate limit
          await new Promise((resolve) => setTimeout(resolve, 150));
        } catch (err) {
          console.warn(`Online enrichment error for ${drug.name}:`, err);
        }
      }

      if (enrichedCount > 0) {
        setProducts(nextList);
        OfflineStorage.saveProducts(nextList);
        addNotification(
          'Batch Online Scientifics Enriched',
          `Successfully updated online scientific monographs for ${enrichedCount} drugs.`,
          'inventory',
          'success'
        );
      }
    } finally {
      setIsSearchingScientifics(false);
    }

    return { total: drugsToEnrich.length, enriched: enrichedCount };
  }, [addNotification]);

  const standardizeAllScientifics = useCallback(() => {
    const initialMap = new Map(INITIAL_PRODUCTS.map((p) => [p.code.toUpperCase(), p]));
    setProducts((prev) => {
      const next = prev.map((p) => {
        if (p.category !== 'drug') return p;
        const initialMatch = initialMap.get(p.code.toUpperCase());
        const cleanInfo = initialMatch?.scientificInfo || resolveStraightforwardScientificInfo(p);
        return {
          ...p,
          scientificInfo: { ...cleanInfo },
          updatedAt: Date.now(),
          version: (p.version || 1) + 1,
        };
      });
      OfflineStorage.saveProducts(next);
      return next;
    });
    addNotification(
      'Scientific Monographs Standardized',
      'All medication monographs formatted into the straightforward clinical standard (identical to Adol Extra).',
      'inventory',
      'success'
    );
  }, [addNotification, addLog, products]);

  const addProduct = (productData: Omit<Product, 'id' | 'updatedAt' | 'version'>) => {
    const newProduct: Product = {
      ...productData,
      id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      updatedAt: Date.now(),
      version: 1,
    };
    const updated = [newProduct, ...products];
    setProducts(updated);
    OfflineStorage.saveProducts(updated);
    try { syncEngine.broadcast('STOCK_MUTATION', newProduct); } catch (e) {}
    addNotification('Product Added', `${newProduct.name} (${newProduct.code}) saved to stock`, 'inventory', 'success');
    addLog({
      component: 'Inventory / Stock',
      action: 'PRODUCT_CREATED',
      level: 'success',
      title: `Product Created: ${newProduct.name}`,
      description: `Code: ${newProduct.code} | Stock: ${newProduct.stockQuantity} | Price: ${formatUSD(newProduct.priceUSD)} / ${formatLBP(newProduct.priceLBP)}`,
      entityId: newProduct.id,
      entityType: 'product',
      details: {
        code: newProduct.code,
        name: newProduct.name,
        category: newProduct.category,
        stock: newProduct.stockQuantity,
        priceUSD: newProduct.priceUSD,
        priceLBP: newProduct.priceLBP
      }
    });

    // Automatic online scientific data search whenever a drug is created manually
    if (newProduct.category === 'drug') {
      const activeMolecule = newProduct.ingredients || newProduct.name;
      if (activeMolecule) {
        searchOnlineScientificData(activeMolecule, newProduct.name, updated, {
          dosage: newProduct.dosage,
          form: newProduct.form,
          presentation: newProduct.presentation,
          molecules: newProduct.molecules,
        })
          .then((res) => {
            if (res?.scientificInfo) {
              setProducts((current) => {
                const enriched = current.map((p) => {
                  if (p.id === newProduct.id) {
                    const inStockNames = findInStockGenericAlternatives(p, current).map(
                      (a) => `${a.name} (${a.code}) - ${a.stockQuantity} in stock`
                    );
                    return {
                      ...p,
                      scientificInfo: {
                        ...p.scientificInfo,
                        ...res.scientificInfo,
                        generics: inStockNames,
                        onlineEnriched: true,
                        onlineSource: res.source,
                        lastOnlineSearch: Date.now(),
                      },
                      updatedAt: Date.now(),
                      version: (p.version || 1) + 1,
                    };
                  }
                  return p;
                });
                OfflineStorage.saveProducts(enriched);
                return enriched;
              });
              addNotification(
                'Online Scientific Data Linked',
                `Clinical monograph for ${newProduct.name} (${activeMolecule}) loaded from ${res.source}`,
                'inventory',
                'info'
              );
              addLog({
                component: 'Scientifics',
                action: 'SCIENTIFIC_ENRICHED',
                level: 'info',
                title: `Clinical Monograph Linked: ${newProduct.name}`,
                description: `Linked pharmacology data from ${res.source} for molecule ${activeMolecule}.`,
                entityId: newProduct.id,
                entityType: 'product',
                details: { source: res.source, molecule: activeMolecule }
              });
            }
          })
          .catch((err) => {
            console.warn('Online scientific lookup failed:', err);
          });
      }
    }
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev => {
      const updated = prev.map(p => {
        if (p.id === id) {
          const priceLBPChanged = updates.priceLBP !== undefined && updates.priceLBP !== p.priceLBP;
          const priceUSDChanged = updates.priceUSD !== undefined && updates.priceUSD !== p.priceUSD;
          
          const next: Product = {
            ...p,
            ...updates,
            previousPriceLBP: priceLBPChanged ? p.priceLBP : (updates.previousPriceLBP !== undefined ? updates.previousPriceLBP : p.previousPriceLBP),
            previousPriceUSD: priceUSDChanged ? p.priceUSD : (updates.previousPriceUSD !== undefined ? updates.previousPriceUSD : p.previousPriceUSD),
            skippedDecreasedPriceLBP: (priceLBPChanged || priceUSDChanged) ? undefined : (updates.skippedDecreasedPriceLBP !== undefined ? updates.skippedDecreasedPriceLBP : p.skippedDecreasedPriceLBP),
            skippedDecreasedPriceUSD: (priceLBPChanged || priceUSDChanged) ? undefined : (updates.skippedDecreasedPriceUSD !== undefined ? updates.skippedDecreasedPriceUSD : p.skippedDecreasedPriceUSD),
            priceChangedAt: priceLBPChanged || priceUSDChanged ? Date.now() : (updates.priceChangedAt !== undefined ? updates.priceChangedAt : p.priceChangedAt),
            updatedAt: Date.now(),
            version: (p.version || 1) + 1,
          };
          return next;
        }
        return p;
      });
      OfflineStorage.saveProducts(updated);
            try {
               const updatedProd = updated.find(p => p.id === id);
               if (updatedProd) syncEngine.broadcast('STOCK_MUTATION', updatedProd);
            } catch(e) {}
            return updated;
    });
    addLog({
      component: 'Inventory / Stock',
      action: 'PRODUCT_UPDATED',
      level: 'info',
      title: 'Product Stock/Details Updated',
      description: `Modified product ID: ${id}`,
      entityId: id,
      entityType: 'product',
      details: updates
    });
  };

  const deleteProduct = (id: string) => {
    const prod = products.find(p => p.id === id);
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    OfflineStorage.saveProducts(updated);
    try { syncEngine.broadcast('PRODUCT_DELETED', { id }); } catch (e) {}
    addNotification('Product Removed', 'Item deleted from database', 'inventory', 'info');
    if (prod) {
      addLog({
        component: 'Inventory / Stock',
        action: 'PRODUCT_DELETED',
        level: 'warning',
        title: `Product Deleted: ${prod.name}`,
        description: `Removed product code ${prod.code} from inventory catalog.`,
        entityId: id,
        entityType: 'product',
        details: { code: prod.code, name: prod.name }
      });
    }
  };

  const bulkUpdateProducts = (
    ids: string[],
    updateFnOrPartial: Partial<Product> | ((prod: Product) => Partial<Product>)
  ): { success: boolean; count: number } => {
    if (!ids || ids.length === 0) return { success: false, count: 0 };
    const idSet = new Set(ids);
    const updatedProductsList: Product[] = [];

    setProducts(prev => {
      const next = prev.map(p => {
        if (!idSet.has(p.id)) return p;
        const updates = typeof updateFnOrPartial === 'function' ? updateFnOrPartial(p) : updateFnOrPartial;
        const priceLBPChanged = updates.priceLBP !== undefined && updates.priceLBP !== p.priceLBP;
        const priceUSDChanged = updates.priceUSD !== undefined && updates.priceUSD !== p.priceUSD;

        const updatedProd: Product = {
          ...p,
          ...updates,
          previousPriceLBP: priceLBPChanged ? p.priceLBP : (updates.previousPriceLBP !== undefined ? updates.previousPriceLBP : p.previousPriceLBP),
          previousPriceUSD: priceUSDChanged ? p.priceUSD : (updates.previousPriceUSD !== undefined ? updates.previousPriceUSD : p.previousPriceUSD),
          skippedDecreasedPriceLBP: (priceLBPChanged || priceUSDChanged) ? undefined : (updates.skippedDecreasedPriceLBP !== undefined ? updates.skippedDecreasedPriceLBP : p.skippedDecreasedPriceLBP),
          skippedDecreasedPriceUSD: (priceLBPChanged || priceUSDChanged) ? undefined : (updates.skippedDecreasedPriceUSD !== undefined ? updates.skippedDecreasedPriceUSD : p.skippedDecreasedPriceUSD),
          priceChangedAt: priceLBPChanged || priceUSDChanged ? Date.now() : (updates.priceChangedAt !== undefined ? updates.priceChangedAt : p.priceChangedAt),
          updatedAt: Date.now(),
          version: (p.version || 1) + 1,
        };
        updatedProductsList.push(updatedProd);
        return updatedProd;
      });

      OfflineStorage.saveProducts(next);
      try {
        if (updatedProductsList.length > 0) {
          syncEngine.broadcast('STOCK_MUTATION', updatedProductsList);
        }
      } catch (e) {}
      return next;
    });

    addNotification(
      'Bulk Stock Update',
      `Successfully updated ${ids.length} items in inventory catalog`,
      'inventory',
      'success'
    );

    addLog({
      component: 'Inventory / Stock',
      action: 'PRODUCT_BULK_UPDATE',
      level: 'info',
      title: `Bulk Stock Modified: ${ids.length} Items`,
      description: `Applied bulk edits across ${ids.length} inventory products.`,
      details: { count: ids.length, itemIds: ids.slice(0, 20) }
    });

    return { success: true, count: ids.length };
  };

  const bulkDeleteProducts = (ids: string[]): { success: boolean; count: number } => {
    if (!ids || ids.length === 0) return { success: false, count: 0 };
    const idSet = new Set(ids);
    setProducts(prev => {
      const next = prev.filter(p => !idSet.has(p.id));
      OfflineStorage.saveProducts(next);
      return next;
    });
    ids.forEach(id => {
      try { syncEngine.broadcast('PRODUCT_DELETED', { id }); } catch (e) {}
    });
    addNotification('Bulk Delete Complete', `Removed ${ids.length} items from inventory database`, 'inventory', 'warning');
    addLog({
      component: 'Inventory / Stock',
      action: 'PRODUCT_BULK_DELETE',
      level: 'warning',
      title: `Bulk Products Deleted: ${ids.length} items`,
      description: `Removed ${ids.length} selected items from inventory catalog.`,
      details: { count: ids.length, itemIds: ids.slice(0, 20) }
    });
    return { success: true, count: ids.length };
  };

  const deleteAllProducts = () => {
    const count = products.length;
    setProducts([]);
    OfflineStorage.saveProducts([]);
    try { syncEngine.broadcast('PRODUCT_DELETED', { all: true }); } catch (e) {}
    addNotification('Stock Cleared', `Successfully removed all ${count} products from stock database.`, 'inventory', 'warning');
    addLog({
      component: 'Inventory / Stock',
      action: 'ALL_PRODUCTS_DELETED',
      level: 'warning',
      title: 'Complete Inventory Wiped',
      description: `Permanently removed all ${count} products from inventory catalog.`,
      details: { previousCount: count }
    });
  };

  const clearPriceChangeIndicators = () => {
    setProducts(prev => {
      const updated = prev.map(p => ({
        ...p,
        previousPriceLBP: undefined,
        previousPriceUSD: undefined,
        skippedDecreasedPriceLBP: undefined,
        skippedDecreasedPriceUSD: undefined,
        priceChangedAt: undefined
      }));
      OfflineStorage.saveProducts(updated);
            try {
               syncEngine.broadcast('STOCK_MUTATION', updated);
            } catch(e) {}
            return updated;
    });
    addNotification('Indicators Cleared', 'Price change indicators have been removed.', 'inventory', 'info');
    addLog({
      component: 'Inventory / Stock',
      action: 'PRICE_INDICATORS_CLEARED',
      level: 'info',
      title: 'Price Change Indicators Cleared',
      description: 'Removed all previous price data and visual indicators from the stock list.'
    });
  };

  // Requirement 20: Update drug price in stock based on drug code
  const updateDrugPriceByCode = (code: string, newPriceLBP: number, newPriceUSD?: number): { success: boolean; message: string } => {
    const trimmedCode = code.trim().toUpperCase();
    const product = products.find(p => p.code.toUpperCase() === trimmedCode);
    if (!product) {
      return { success: false, message: `Drug with code "${code}" not found in stock database.` };
    }

    const calculatedUSD = newPriceUSD !== undefined && newPriceUSD > 0
      ? newPriceUSD
      : Number((newPriceLBP / exchangeRate).toFixed(2));

    const newVersion = (product.version || 1) + 1;
    const updatedAt = Date.now();

    const updatedProduct: Product = {
      ...product,
      priceLBP: newPriceLBP,
      priceUSD: calculatedUSD,
      previousPriceLBP: product.priceLBP !== newPriceLBP ? product.priceLBP : product.previousPriceLBP,
      previousPriceUSD: product.priceUSD !== calculatedUSD ? product.priceUSD : product.previousPriceUSD,
      skippedDecreasedPriceLBP: undefined,
      skippedDecreasedPriceUSD: undefined,
      priceChangedAt: product.priceLBP !== newPriceLBP ? Date.now() : product.priceChangedAt,
      updatedAt,
      version: newVersion,
    };

    setProducts(prev => {
      const next = prev.map(p => p.id === product.id ? updatedProduct : p);
      OfflineStorage.saveProducts(next);
      return next;
    });

    // Broadcast price change to other connected PCs (full product so the remote side
    // keeps every field, not just the price columns)
    try {
      syncEngine.broadcast('PRICE_UPDATE', updatedProduct);
    } catch (e) {}

    addNotification(
      'Drug Price Updated',
      `Code: ${trimmedCode} (${product.name}) updated to ${formatLBPValue(newPriceLBP)} L.L. ($${calculatedUSD})`,
      'inventory',
      'success'
    );

    addLog({
      component: 'Inventory / Stock',
      action: 'DRUG_PRICE_UPDATED',
      level: 'info',
      title: `Drug Price Adjusted (${trimmedCode})`,
      description: `New price: ${formatLBPValue(newPriceLBP)} L.L. ($${calculatedUSD}) for ${product.name}.`,
      entityId: product.id,
      entityType: 'product',
      details: {
        code: trimmedCode,
        productName: product.name,
        oldPriceLBP: product.priceLBP,
        newPriceLBP,
        oldPriceUSD: product.priceUSD,
        newPriceUSD: calculatedUSD
      }
    });

    return {
      success: true,
      message: `Price for "${product.name}" (${trimmedCode}) successfully updated to ${formatLBPValue(newPriceLBP)} L.L. ($${calculatedUSD})`
    };
  };

  // Requirements 18 & 19: Bulk data import via CSV files for inventory management
  // Exact headline: code, Name, Ingredients, Dosage, Presentation, Form, Price in LBP, Agent, Pharmacist Margin
  const importProductsFromCSV = (csvText: string): { success: boolean; importedCount: number; errors: string[]; skippedLowerPricesCount?: number } => {
    const errors: string[] = [];
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      quoteChar: '"',
      escapeChar: '"',
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return { success: false, importedCount: 0, errors: ['CSV parsing failed.'] };
    }

    const rows = parsed.data as Record<string, string>[];
    if (rows.length === 0) {
      return { success: false, importedCount: 0, errors: ['CSV file is empty or missing data rows.'] };
    }

    const rawHeaders = parsed.meta.fields || [];
    const colCode = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('code'));
    const colName = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('name'));
    const colIngredients = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('ingredient'));
    const colDosage = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('dosage'));
    const colPresentation = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('presentation'));
    const colForm = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('form'));
    const colPriceUSD = rawHeaders.find(h => {
      const lower = h.trim().toLowerCase().replace(/['"]/g, '');
      return (lower.includes('price') && lower.includes('usd')) || lower === 'usd';
    });
    const colPriceLBP = rawHeaders.find(h => {
      const lower = h.trim().toLowerCase().replace(/['"]/g, '');
      return lower.includes('price in lbp') || (lower.includes('price') && lower.includes('lbp')) || (lower.includes('price') && !lower.includes('usd'));
    });
    const colAgent = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('agent'));
    const colMargin = rawHeaders.find(h => {
      const lower = h.trim().toLowerCase().replace(/['"]/g, '');
      return lower.includes('pharmacist margin') || lower.includes('margin') || lower.includes('profit');
    });
    const colCategory = rawHeaders.find(h => {
      const lower = h.trim().toLowerCase().replace(/['"]/g, '');
      return lower === 'category' || (lower.includes('categor') && !lower.includes('sub'));
    });
    const colSubcategory = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('subcategor'));
    const colBarcode = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('barcode'));
    const colStockQty = rawHeaders.find(h => {
      const lower = h.trim().toLowerCase().replace(/['"]/g, '');
      return lower.includes('stock quantity') || lower.includes('stock qty') || (lower.includes('quantity') && !lower.includes('min'));
    });
    const colMinStock = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('min stock'));
    const colCostPrice = rawHeaders.find(h => {
      const lower = h.trim().toLowerCase().replace(/['"]/g, '');
      return lower.includes('cost') && lower.includes('price');
    });
    const colDivisible = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('divisib'));
    const colPiecesPerBox = rawHeaders.find(h => {
      const lower = h.trim().toLowerCase().replace(/['"]/g, '');
      return lower.includes('pieces') && lower.includes('box');
    });
    const colPieceName = rawHeaders.find(h => {
      const lower = h.trim().toLowerCase().replace(/['"]/g, '');
      return lower.includes('piece') && lower.includes('name');
    });
    const colPiecePriceUSD = rawHeaders.find(h => {
      const lower = h.trim().toLowerCase().replace(/['"]/g, '');
      return lower.includes('piece') && lower.includes('price');
    });
    const colExpiry = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('expiry'));
    const colBatchNumber = rawHeaders.find(h => {
      const lower = h.trim().toLowerCase().replace(/['"]/g, '');
      return lower.includes('batch number') || (lower.includes('batch') && !lower.includes('json'));
    });
    const colBatches = rawHeaders.find(h => h.trim().toLowerCase().replace(/['"]/g, '').includes('batches'));

    if (!colCode || !colName) {
      return {
        success: false,
        importedCount: 0,
        errors: ['Invalid CSV format. Missing required columns: "code" and "Name". Required header: code, Name, Ingredients, Dosage, Presentation, Form, Price in LBP, Agent, Pharmacist Margin']
      };
    }

    const newProducts: Product[] = [];
    let updatedCount = 0;
    let skippedLowerPricesCount = 0;
    const currentProductsMap = new Map<string, Product>();
    products.forEach(p => currentProductsMap.set(p.code.toUpperCase(), p));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cellText = (v: unknown): string => (v == null ? '' : String(v).replace(/^["']+|["']+$/g, '').trim());
      const cellNum = (v: unknown): number | undefined => {
        const s = v == null ? '' : String(v).replace(/[^\d.]/g, '');
        if (!s) return undefined;
        const n = parseFloat(s);
        return isNaN(n) ? undefined : n;
      };
      const cellBool = (v: unknown): boolean | undefined => {
        const s = cellText(v).toLowerCase();
        if (s === '1' || s === 'true' || s === 'yes' || s === 'y') return true;
        if (s === '0' || s === 'false' || s === 'no' || s === 'n' || s === '') return false;
        return undefined;
      };
      const rawCodeStr = colCode ? row[colCode] : '';
      const rawCode = rawCodeStr ? cellText(rawCodeStr) : '';
      const code = rawCode || `BLANK-CODE-${Date.now()}-${i}`;
      
      const rawNameStr = colName ? row[colName] : '';
      const name = rawNameStr ? cellText(rawNameStr) : '';

      const ingredients = colIngredients && row[colIngredients] ? cellText(row[colIngredients]) : '';
      const dosage = colDosage && row[colDosage] ? cellText(row[colDosage]) : '';
      const moleculesFromCsv = parseMoleculeList(ingredients);
      const presentation = colPresentation && row[colPresentation] ? cellText(row[colPresentation]) : '';
      const form = colForm && row[colForm] ? cellText(row[colForm]) : '';
      
      const rawPriceLBPStr = colPriceLBP && row[colPriceLBP] ? row[colPriceLBP].replace(/[^\d.]/g, '') : '';
      const rawPriceUSDStr = colPriceUSD && row[colPriceUSD] ? row[colPriceUSD].replace(/[^\d.]/g, '') : '';

      let priceLBP = 0;
      let priceUSD = 0;

      if (rawPriceLBPStr) {
        priceLBP = parseFloat(rawPriceLBPStr) || 0;
        priceUSD = priceLBP > 0 ? Number((priceLBP / exchangeRate).toFixed(2)) : 0;
      } else if (rawPriceUSDStr) {
        priceUSD = parseFloat(rawPriceUSDStr) || 0;
        priceLBP = priceUSD > 0 ? Math.round(priceUSD * exchangeRate) : 0;
      }

      const hasPriceInCSV = Boolean((colPriceLBP && rawPriceLBPStr !== '') || (colPriceUSD && rawPriceUSDStr !== ''));

      const agent = colAgent && row[colAgent] ? cellText(row[colAgent]) : '';
      const rawMarginStr = colMargin && row[colMargin] ? row[colMargin].replace(/[^\d.]/g, '') : '0';
      let margin = parseFloat(rawMarginStr) || 0;
      
      // Override specific MOPH margin logic
      if (margin === 23.08) {
        margin = 22.25;
      }

      const costPriceUSD = priceUSD > 0 ? Number((priceUSD * (1 - margin / 100)).toFixed(2)) : 0;

      const categoryFromCsv = (() => {
        if (!colCategory) return undefined;
        const rawCat = cellText(row[colCategory]).toLowerCase();
        if (rawCat === 'drug' || rawCat === 'vitamins' || rawCat === 'cosmetics' || rawCat === 'para') return rawCat as ProductCategory;
        return undefined;
      })();
      const subcategoryFromCsv = colSubcategory ? cellText(row[colSubcategory]) || undefined : undefined;
      const barcodeFromCsv = colBarcode ? cellText(row[colBarcode]) || undefined : undefined;
      const stockQtyFromCsv = colStockQty ? cellNum(row[colStockQty]) : undefined;
      const minStockFromCsv = colMinStock ? cellNum(row[colMinStock]) : undefined;
      const costPriceFromCsv = colCostPrice ? cellNum(row[colCostPrice]) : undefined;
      const divisibleFromCsv = colDivisible ? cellBool(row[colDivisible]) : undefined;
      const piecesPerBoxFromCsv = colPiecesPerBox ? cellNum(row[colPiecesPerBox]) : undefined;
      const pieceNameFromCsv = colPieceName ? cellText(row[colPieceName]) || undefined : undefined;
      const piecePriceUSDFromCsv = colPiecePriceUSD ? cellNum(row[colPiecePriceUSD]) : undefined;
      const expiryFromCsv = colExpiry ? cellText(row[colExpiry]) : undefined;
      const batchNoFromCsv = colBatchNumber ? cellText(row[colBatchNumber]) : undefined;
      let batchesFromCsv: ProductBatch[] | undefined;
      if (colBatches) {
        const rawBatches = row[colBatches];
        if (rawBatches != null && String(rawBatches).trim()) {
          try {
            const parsed = JSON.parse(String(rawBatches));
            if (Array.isArray(parsed)) {
              batchesFromCsv = parsed.filter((b: unknown): b is ProductBatch =>
                !!b && typeof b === 'object' && typeof (b as { batchNumber?: unknown }).batchNumber === 'string'
              ).map((b) => ({
                batchNumber: b.batchNumber,
                expiryDate: typeof (b as { expiryDate?: unknown }).expiryDate === 'string' ? (b as { expiryDate: string }).expiryDate : '',
                ...(typeof (b as { quantity?: unknown }).quantity === 'number' ? { quantity: (b as { quantity: number }).quantity } : {}),
              }));
            }
          } catch {
            // ignore malformed batch JSON
          }
        }
      }

      const existing = rawCode ? currentProductsMap.get(code.toUpperCase()) : undefined;

      // Requirement 21: all medicines have category set as drug unless the CSV carries an explicit category
      const category: ProductCategory = categoryFromCsv ?? 'drug';

      if (existing) {
        // Update existing drug
        let finalPriceLBP = existing.priceLBP;
        let finalPriceUSD = existing.priceUSD;
        let finalPreviousPriceLBP = existing.previousPriceLBP;
        let finalPreviousPriceUSD = existing.previousPriceUSD;
        let finalSkippedDecreasedLBP = existing.skippedDecreasedPriceLBP;
        let finalSkippedDecreasedUSD = existing.skippedDecreasedPriceUSD;
        let finalPriceChangedAt = existing.priceChangedAt;
        let finalCostPriceUSD = existing.costPriceUSD;

        if (hasPriceInCSV && (priceLBP > 0 || priceUSD > 0)) {
          const oldPriceLBP = existing.priceLBP || 0;
          const oldPriceUSD = existing.priceUSD || 0;
          const hasOldPrice = oldPriceLBP > 0 || oldPriceUSD > 0;

          if (hasOldPrice) {
            // Check if price in CSV is lower than older price (decrease in price)
            const isDecrease = (oldPriceLBP > 0 && priceLBP > 0 && priceLBP < oldPriceLBP) ||
              (oldPriceUSD > 0 && priceUSD > 0 && priceUSD < oldPriceUSD);

            // Check if price in CSV is higher than older price (increase in price)
            const isIncrease = (oldPriceLBP > 0 && priceLBP > 0 && priceLBP > oldPriceLBP) ||
              (oldPriceUSD > 0 && priceUSD > 0 && priceUSD > oldPriceUSD);

            if (isDecrease) {
              // User requirement:
              // "if the price is lower than the older price (decrease in price), skip this price from the update,
              // but keep showing the small arrow and the % accordingly"
              // (for example if old price is 10$ and the new price is 5$, then in this case don't update to the new price for this item.
              // but keep showing the small arrow (in this case red arrow and the % change in this case 50%))
              finalPriceLBP = existing.priceLBP;
              finalPriceUSD = existing.priceUSD;
              finalSkippedDecreasedLBP = priceLBP;
              finalSkippedDecreasedUSD = priceUSD;
              finalPreviousPriceLBP = undefined;
              finalPreviousPriceUSD = undefined;
              finalPriceChangedAt = Date.now();

              if (colMargin) {
                finalCostPriceUSD = finalPriceUSD > 0 ? Number((finalPriceUSD * (1 - margin / 100)).toFixed(2)) : existing.costPriceUSD;
              }

              skippedLowerPricesCount++;
            } else if (isIncrease) {
              // Price increased: update price and track previous price
              finalPriceLBP = priceLBP;
              finalPriceUSD = priceUSD;
              finalPreviousPriceLBP = existing.priceLBP;
              finalPreviousPriceUSD = existing.priceUSD;
              finalSkippedDecreasedLBP = undefined;
              finalSkippedDecreasedUSD = undefined;
              finalPriceChangedAt = Date.now();

              if (colMargin || hasPriceInCSV) {
                finalCostPriceUSD = costPriceUSD;
              }
            } else {
              // Same price: keep existing
              if (colMargin) {
                finalCostPriceUSD = finalPriceUSD > 0 ? Number((finalPriceUSD * (1 - margin / 100)).toFixed(2)) : existing.costPriceUSD;
              }
            }
          } else {
            // Initial price setting for zero-price item
            finalPriceLBP = priceLBP;
            finalPriceUSD = priceUSD;
            finalPreviousPriceLBP = undefined;
            finalPreviousPriceUSD = undefined;
            finalSkippedDecreasedLBP = undefined;
            finalSkippedDecreasedUSD = undefined;
            finalPriceChangedAt = Date.now();
            finalCostPriceUSD = costPriceUSD;
          }
        } else if (colMargin) {
          finalCostPriceUSD = finalPriceUSD > 0 ? Number((finalPriceUSD * (1 - margin / 100)).toFixed(2)) : existing.costPriceUSD;
        }

        const updated: Product = {
          ...existing,
          name: name || existing.name,
          ingredients: colIngredients ? ingredients : existing.ingredients,
          dosage: colDosage ? dosage : existing.dosage,
          molecules: colIngredients ? (moleculesFromCsv.length > 0 ? moleculesFromCsv : existing.molecules) : existing.molecules,
          presentation: colPresentation ? presentation : existing.presentation,
          form: colForm ? form : existing.form,
          priceLBP: finalPriceLBP,
          priceUSD: finalPriceUSD,
          previousPriceLBP: finalPreviousPriceLBP,
          previousPriceUSD: finalPreviousPriceUSD,
          skippedDecreasedPriceLBP: finalSkippedDecreasedLBP,
          skippedDecreasedPriceUSD: finalSkippedDecreasedUSD,
          priceChangedAt: finalPriceChangedAt,
          costPriceUSD: colCostPrice && costPriceFromCsv != null ? costPriceFromCsv : finalCostPriceUSD,
          pharmacistMarginProfit: colMargin ? margin : existing.pharmacistMarginProfit,
          agent: colAgent ? agent : existing.agent,
          category: colCategory ? category : existing.category,
          subcategory: subcategoryFromCsv ?? existing.subcategory,
          barcode: barcodeFromCsv ?? existing.barcode,
          stockQuantity: stockQtyFromCsv ?? existing.stockQuantity,
          minStockAlert: minStockFromCsv ?? existing.minStockAlert,
          expiryDate: expiryFromCsv ?? existing.expiryDate,
          batchNumber: batchNoFromCsv ?? existing.batchNumber,
          batches: batchesFromCsv ?? existing.batches,
          isDivisible: divisibleFromCsv ?? existing.isDivisible,
          piecesPerBox: piecesPerBoxFromCsv ?? existing.piecesPerBox,
          pieceName: pieceNameFromCsv ?? existing.pieceName,
          piecePriceUSD: piecePriceUSDFromCsv ?? existing.piecePriceUSD,
          updatedAt: Date.now(),
          version: (existing.version || 1) + 1,
        };
        currentProductsMap.set(code.toUpperCase(), updated);
        updatedCount++;
      } else {
        // Create new drug with default 0 quantity and blank expiry (as requested)
        const newProd: Product = {
          id: `prod-${Date.now()}-${i}`,
          code: code.toUpperCase(),
          name,
          category,
          subcategory: subcategoryFromCsv,
          barcode: barcodeFromCsv,
          ingredients,
          dosage,
          molecules: moleculesFromCsv.length > 0 ? moleculesFromCsv : undefined,
          presentation,
          form,
          priceLBP,
          priceUSD,
          costPriceUSD: colCostPrice && costPriceFromCsv != null ? costPriceFromCsv : costPriceUSD,
          pharmacistMarginProfit: margin,
          agent,
          stockQuantity: stockQtyFromCsv ?? 0,
          minStockAlert: minStockFromCsv ?? 5,
          expiryDate: expiryFromCsv ?? '',
          batchNumber: batchNoFromCsv ?? '',
          batches: batchesFromCsv ?? [],
          isDivisible: divisibleFromCsv,
          piecesPerBox: piecesPerBoxFromCsv,
          pieceName: pieceNameFromCsv,
          piecePriceUSD: piecePriceUSDFromCsv,
          updatedAt: Date.now(),
          version: 1,
          scientificInfo: (() => {
            const composedMolecules = moleculesFromCsv.length > 0
              ? moleculesFromCsv.filter((m) => m && m.name && m.name.trim()).map((m) => (
                  m.strength && m.strength.trim() ? `${m.name.trim()} ${m.strength.trim()}` : m.name.trim()
                )).join(' + ')
              : '';
            const monographInput = composedMolecules || ingredients || name;
            const baseMonograph = getStraightforwardMonograph(monographInput, name);
            const cleanMolecules = moleculesFromCsv.length > 0
              ? moleculesFromCsv.map((m) => m.name.trim()).filter(Boolean)
              : extractCleanMolecules(ingredients || name);
            return {
              indications: baseMonograph.indications,
              contraindications: baseMonograph.contraindications,
              sideEffects: baseMonograph.sideEffects,
              generics: [],
              dosage: dosage ? `Adults: as prescribed (${dosage}).` : baseMonograph.dosage,
              pediatricDosage: baseMonograph.pediatricDosage,
              form: form || 'Tablet',
              presentation: presentation || 'Box',
              activeIngredients: cleanMolecules.join(' + ') || monographInput,
              pregnancyCategory: baseMonograph.pregnancyCategory || 'B',
              storageConditions: baseMonograph.storageConditions || 'Store below 25°C.',
              onlineEnriched: false,
              onlineSource: 'Pharmacopoeia',
              lastOnlineSearch: Date.now(),
            };
          })()
        };
        newProducts.push(newProd);
      }
    }

    const mergedProducts = Array.from(currentProductsMap.values()).concat(newProducts);
    setProducts(mergedProducts);
    OfflineStorage.saveProducts(mergedProducts);

    // LAN sync: broadcast all imported/updated products so connected PCs converge.
    try {
      const syncedChanged = newProducts.concat(
        Array.from(currentProductsMap.values()).filter(p =>
          products.some(prev => prev.id === p.id && prev.updatedAt !== p.updatedAt)
        )
      );
      if (syncedChanged.length > 0) {
        syncEngine.broadcast('STOCK_MUTATION', syncedChanged);
      }
    } catch (e) {}

    const totalImported = newProducts.length + updatedCount;
    const skippedMsg = skippedLowerPricesCount > 0
      ? ` (${skippedLowerPricesCount} price decrease${skippedLowerPricesCount > 1 ? 's' : ''} preserved with red decrease indicator)`
      : '';
    addNotification(
      'CSV Bulk Import Completed',
      `Processed ${totalImported} items (${newProducts.length} new drugs, ${updatedCount} updated${skippedMsg}).`,
      'inventory',
      'success'
    );

    // Automatic online scientific search for newly imported drugs (capped batch of up to 35 drugs with throttle)
    const importedDrugs = newProducts.filter(p => p.category === 'drug').slice(0, 35);
    if (importedDrugs.length > 0) {
      setTimeout(async () => {
        let enriched = 0;
        const currentAll = OfflineStorage.getProducts();
        const nextList = [...currentAll];

        for (const drug of importedDrugs) {
          const molecule = drug.ingredients || drug.name;
          if (!molecule) continue;

          try {
            const res = await searchOnlineScientificData(molecule, drug.name, nextList, {
              dosage: drug.dosage,
              form: drug.form,
              presentation: drug.presentation,
              molecules: drug.molecules,
            });
            if (res?.scientificInfo) {
              const idx = nextList.findIndex(p => p.id === drug.id);
              if (idx !== -1) {
                const inStockNames = findInStockGenericAlternatives(drug, nextList).map(
                  a => `${a.name} (${a.code}) - ${a.stockQuantity} in stock`
                );
                nextList[idx] = {
                  ...nextList[idx],
                  scientificInfo: {
                    ...nextList[idx].scientificInfo,
                    ...res.scientificInfo,
                    generics: inStockNames,
                    onlineEnriched: true,
                    onlineSource: res.source,
                    lastOnlineSearch: Date.now(),
                  },
                  updatedAt: Date.now(),
                  version: (nextList[idx].version || 1) + 1,
                };
                enriched++;
              }
            }
            // Throttle between network requests
            await new Promise(r => setTimeout(r, 180));
          } catch (e) {
            console.warn(`Online scientific lookup deferred for ${drug.name}:`, e);
          }
        }

        if (enriched > 0) {
          setProducts(nextList);
          OfflineStorage.saveProducts(nextList);
          addNotification(
            'Online Scientifics Enriched',
            `Online scientific monographs loaded for ${enriched} imported medicines.`,
            'inventory',
            'success'
          );
        }
      }, 400);
    }

    if (totalImported > 0) {
      addLog({
        component: 'Inventory / Stock',
        action: 'CSV_IMPORT_COMPLETED',
        level: 'success',
        title: `CSV Bulk Stock Import (${totalImported} items)`,
        description: `Imported drugs from spreadsheet: ${updatedCount} updated, ${newProducts.length} added.`,
        details: { totalImported, updatedCount, newCount: newProducts.length, errorsCount: errors.length }
      });
    }

    return {
      success: totalImported > 0,
      importedCount: totalImported,
      errors,
      skippedLowerPricesCount,
    };
  };

  // Sales
  const recordSale = (saleData: Omit<SaleTransaction, 'id' | 'timestamp' | 'invoiceNumber' | 'synced'>): SaleTransaction => {
    const saleId = `sale-${Date.now()}`;
    const invoiceNumber = nextInvoiceNumber(sales, 'INV', sales.length + 1);
    const fullSale: SaleTransaction = {
      ...saleData,
      id: saleId,
      invoiceNumber,
      timestamp: Date.now(),
      synced: true,
    };

    // 1. Save Sale
    const updatedSales = [fullSale, ...sales];
    setSales(updatedSales);
    OfflineStorage.saveSales(updatedSales);
    try { syncEngine.broadcast('SALE_CREATED', fullSale); } catch (e) {}

    // 2. Deplete product stock and broadcast
    setProducts(prevProducts => {
      const { updated: updatedProds, mutated: mutatedProds } = applySaleStockDepletion(prevProducts, fullSale.items);
      OfflineStorage.saveProducts(updatedProds);
      if (mutatedProds.length > 0) {
        try { syncEngine.broadcast('STOCK_MUTATION', mutatedProds); } catch (e) {}
      }
      return updatedProds;
    });

    // 3. Update customer loyalty and debt if customer selected
    if (fullSale.customerId) {
      setCustomers(prevCustomers => {
        const updatedCusts = prevCustomers.map(c => {
          if (c.id === fullSale.customerId) {
            const addedPoints = Math.floor(fullSale.totalUSD * 2);
            let debtLBP = c.balanceLBP;
            let debtUSD = c.balanceUSD;

            if (fullSale.paymentMethod === 'credit_debt') {
              debtUSD += fullSale.totalUSD;
              debtLBP += fullSale.totalLBP;
            }

            return {
              ...c,
              loyaltyPoints: c.loyaltyPoints + addedPoints,
              balanceUSD: debtUSD,
              balanceLBP: debtLBP,
              lastVisit: new Date().toISOString().split('T')[0],
            };
          }
          return c;
        });
        OfflineStorage.saveCustomers(updatedCusts);
        try {
          const updatedCust = updatedCusts.find(c => c.id === fullSale.customerId);
          if (updatedCust) syncEngine.broadcast('CUSTOMER_UPSERT', updatedCust);
        } catch (e) {}
        return updatedCusts;
      });
    }

    addNotification(
      'Sale Completed',
      `Invoice #${invoiceNumber}: ${formatUSD(fullSale.totalUSD)} / ${formatLBP(fullSale.totalLBP)}`,
      'sale',
      'success'
    );

    addLog({
      component: 'POS / Sale',
      action: 'SALE_DISPENSED',
      level: 'success',
      title: `Sale Dispensed #${invoiceNumber}`,
      description: `${fullSale.items.length} item(s) dispensed for ${formatUSD(fullSale.totalUSD)} (${formatLBP(fullSale.totalLBP)}). Paid via ${fullSale.paymentMethod}.`,
      entityId: saleId,
      entityType: 'sale',
      details: {
        invoiceNumber,
        totalUSD: fullSale.totalUSD,
        totalLBP: fullSale.totalLBP,
        paymentMethod: fullSale.paymentMethod,
        itemsCount: fullSale.items.length,
        customer: fullSale.customerName || 'Walk-in Patient',
        items: fullSale.items.map(it => ({
          code: it.productCode,
          name: it.productName,
          quantity: it.quantity,
          unitPriceUSD: it.unitPriceUSD,
          totalUSD: it.totalUSD
        }))
      }
    });

    return fullSale;
  };

  const updateSale = (saleId: string, updatedData: Partial<SaleTransaction>): { success: boolean; error?: string } => {
    const existingIndex = sales.findIndex(s => s.id === saleId);
    if (existingIndex === -1) {
      return { success: false, error: 'Sale record not found.' };
    }

    const prevSale = sales[existingIndex];
    const updatedSale: SaleTransaction = {
      ...prevSale,
      ...updatedData,
    };

    // If items were updated, calculate stock difference for each item
    if (updatedData.items) {
      const getEquivalentQty = (items: SaleTransaction['items'], productId: string, prod: Product | undefined) => {
        return items
          .filter(i => i.productId === productId)
          .reduce((sum, i) => {
            const isPiece = i.isPiece;
            const piecesPerBox = prod?.piecesPerBox || 1;
            return sum + (isPiece && piecesPerBox > 1 ? i.quantity / piecesPerBox : i.quantity);
          }, 0);
      };

      const prevQtyMap = new Map<string, number>();
      prevSale.items.forEach(it => {
        prevQtyMap.set(it.productId, getEquivalentQty(prevSale.items, it.productId, products.find(p => p.id === it.productId)));
      });

      const newQtyMap = new Map<string, number>();
      updatedSale.items.forEach(it => {
        newQtyMap.set(it.productId, getEquivalentQty(updatedSale.items, it.productId, products.find(p => p.id === it.productId)));
      });

      const allProductIds = new Set([...Array.from(prevQtyMap.keys()), ...Array.from(newQtyMap.keys())]);

      setProducts(prevProducts => {
        const nextProducts = prevProducts.map(prod => {
          if (allProductIds.has(prod.id)) {
            const oldQty = prevQtyMap.get(prod.id) || 0;
            const newQty = newQtyMap.get(prod.id) || 0;
            const delta = newQty - oldQty;
            
            if (delta !== 0) {
              const nextStock = Math.max(0, prod.stockQuantity - delta);
              let nextBatches = [...(prod.batches || [])].map(b => ({ ...b }));
            
            if (delta > 0) {
               // We need to deplete more stock (FIFO)
               let remainingToDeplete = delta;
               nextBatches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
               for (let i = 0; i < nextBatches.length; i++) {
                 if (remainingToDeplete <= 0) break;
                 const batchQty = nextBatches[i].quantity || 0;
                 if (batchQty > 0) {
                   const depleteQty = Math.min(batchQty, remainingToDeplete);
                   nextBatches[i].quantity = batchQty - depleteQty;
                   remainingToDeplete -= depleteQty;
                 }
               }
            } else if (delta < 0) {
               // We need to restore stock (add it back to the specific batch if possible, or oldest batch)
               let remainingToRestore = Math.abs(delta);
               
               // Let's find if the prevSale had a selected batch for this product
               const prevItem = prevSale.items.find(i => i.productId === prod.id && i.selectedBatchNumber);
               
               if (prevItem && prevItem.selectedBatchNumber && prevItem.selectedExpiryDate) {
                 const matchingBatchIdx = nextBatches.findIndex(b => b.batchNumber === prevItem.selectedBatchNumber && b.expiryDate === prevItem.selectedExpiryDate);
                 if (matchingBatchIdx >= 0) {
                   nextBatches[matchingBatchIdx].quantity = (nextBatches[matchingBatchIdx].quantity || 0) + remainingToRestore;
                 } else {
                   nextBatches.push({
                     batchNumber: prevItem.selectedBatchNumber,
                     expiryDate: prevItem.selectedExpiryDate,
                     quantity: remainingToRestore
                   });
                 }
               } else {
                 // Fallback: restore to oldest batch
                 if (nextBatches.length > 0) {
                   nextBatches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
                   nextBatches[0].quantity = (nextBatches[0].quantity || 0) + remainingToRestore;
                 } else {
                   nextBatches.push({
                      batchNumber: prod.batchNumber || '',
                      expiryDate: prod.expiryDate || '',
                      quantity: remainingToRestore
                   });
                 }
               }
            }

            const updatedProd = {
              ...prod,
              stockQuantity: nextStock,
              batches: nextBatches,
              updatedAt: Date.now(),
              version: (prod.version || 1) + 1,
            };
            return updatedProd;
            }
          }
          return prod;
        });

        // Handle items that no longer exist in the product catalog (they were completely deleted)
        // If they are returning stock (delta < 0) or we need to recreate the item
        const restoredProducts: Product[] = [];
        Array.from(allProductIds).forEach(productId => {
          const exists = nextProducts.some(p => p.id === productId);
          if (!exists) {
            const oldQty = prevQtyMap.get(productId) || 0;
            const newQty = newQtyMap.get(productId) || 0;
            const delta = newQty - oldQty;
            
            // Only restore if we are returning items to stock (delta < 0), meaning they deleted some from the sale
            if (delta < 0) {
               // Find the item details from the previous sale
               const itemSold = prevSale.items.find(it => it.productId === productId);
               if (itemSold) {
                 const returnQty = Math.abs(delta);
                 const expiryString = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
                 const restoredProd: Product = {
                    id: itemSold.productId,
                    code: itemSold.productCode,
                    name: itemSold.productName,
                    category: itemSold.category || 'drug',
                    ingredients: 'Restored from edited sale',
                    dosage: '',
                    presentation: '',
                    form: '',
                    priceLBP: itemSold.unitPriceLBP || 0,
                    priceUSD: itemSold.unitPriceUSD || 0,
                    costPriceUSD: itemSold.costPriceUSD || 0,
                    pharmacistMarginProfit: 0,
                    agent: 'Unknown (Restored)',
                    stockQuantity: returnQty,
                    minStockAlert: 5,
                    expiryDate: expiryString,
                    batchNumber: 'RESTORED-BATCH',
                    batches: [{
                      batchNumber: 'RESTORED-BATCH',
                      expiryDate: expiryString,
                      quantity: returnQty
                    }],
                    updatedAt: Date.now(),
                    version: 1
                 };
                 restoredProducts.push(restoredProd);
               }
            }
          }
        });

        const finalProducts = [...restoredProducts, ...nextProducts];
        OfflineStorage.saveProducts(finalProducts);
        try {
          const changedIds = new Set([...Array.from(allProductIds), ...restoredProducts.map(p => p.id)]);
          const changedProds = finalProducts.filter(p => changedIds.has(p.id));
          if (changedProds.length > 0) syncEngine.broadcast('STOCK_MUTATION', changedProds);
        } catch (e) {}
        return finalProducts;
      });
    }

    const newSales = [...sales];
    newSales[existingIndex] = updatedSale;
    setSales(newSales);
    OfflineStorage.saveSales(newSales);
    try { syncEngine.broadcast('SALE_UPDATED', updatedSale); } catch (e) {}

    // If debt customer changed or amounts changed
    if (updatedSale.customerId && (prevSale.totalUSD !== updatedSale.totalUSD || prevSale.paymentMethod !== updatedSale.paymentMethod)) {
      setCustomers(prevCusts => {
        const nextCusts = prevCusts.map(c => {
          if (c.id === updatedSale.customerId) {
            let debtUSD = c.balanceUSD;
            let debtLBP = c.balanceLBP;

            if (prevSale.paymentMethod === 'credit_debt') {
              debtUSD -= prevSale.totalUSD;
              debtLBP -= prevSale.totalLBP;
            }
            if (updatedSale.paymentMethod === 'credit_debt') {
              debtUSD += updatedSale.totalUSD;
              debtLBP += updatedSale.totalLBP;
            }

            return {
              ...c,
              balanceUSD: Math.max(0, Number(debtUSD.toFixed(2))),
              balanceLBP: Math.max(0, debtLBP),
            };
          }
          return c;
        });
        OfflineStorage.saveCustomers(nextCusts);
        try {
          const updatedCust = nextCusts.find(c => c.id === updatedSale.customerId);
          if (updatedCust) syncEngine.broadcast('CUSTOMER_UPSERT', updatedCust);
        } catch (e) {}
        return nextCusts;
      });
    }

    addNotification(
      'Sale Transaction Updated',
      `Invoice #${updatedSale.invoiceNumber} was successfully updated.`,
      'sale',
      'success'
    );

    addLog({
      component: 'POS / Sale',
      action: 'SALE_MODIFIED',
      level: 'warning',
      title: `Sale Record Adjusted #${updatedSale.invoiceNumber}`,
      description: `Updated invoice #${updatedSale.invoiceNumber}. New total: ${formatUSD(updatedSale.totalUSD)} / ${formatLBP(updatedSale.totalLBP)}.`,
      entityId: saleId,
      entityType: 'sale',
      details: {
        invoiceNumber: updatedSale.invoiceNumber,
        prevTotalUSD: prevSale.totalUSD,
        newTotalUSD: updatedSale.totalUSD,
        paymentMethod: updatedSale.paymentMethod
      }
    });

    return { success: true };
  };

  const deleteSale = (saleId: string): { success: boolean } => {
    const saleToDelete = sales.find(s => s.id === saleId);
    if (!saleToDelete) return { success: false };

    // Restock all items
    setProducts(prevProducts => {
      const mutatedIds = new Set<string>();
      const nextProducts = prevProducts.map(prod => {
        const soldItems = (saleToDelete.items || []).filter(it => it.productId === prod.id || it.productCode === prod.code);
        if (soldItems.length > 0) {
          mutatedIds.add(prod.id);
          const totalQtyToRestock = soldItems.reduce((sum, item) => sum + (item.isPiece && prod.piecesPerBox ? item.quantity / prod.piecesPerBox : item.quantity), 0);
          const nextStock = prod.stockQuantity + totalQtyToRestock;
          let nextBatches = [...(prod.batches || [])].map(b => ({ ...b }));
          
          for (const soldItem of soldItems) {
            const qtyRestock = soldItem.isPiece && prod.piecesPerBox ? soldItem.quantity / prod.piecesPerBox : soldItem.quantity;
            
            if (soldItem.selectedBatchNumber && soldItem.selectedExpiryDate) {
              const matchingBatchIdx = nextBatches.findIndex(b => 
                b.batchNumber === soldItem.selectedBatchNumber && b.expiryDate === soldItem.selectedExpiryDate
              );
              
              if (matchingBatchIdx >= 0) {
                nextBatches[matchingBatchIdx].quantity = (nextBatches[matchingBatchIdx].quantity || 0) + qtyRestock;
              } else {
                nextBatches.push({
                  batchNumber: soldItem.selectedBatchNumber,
                  expiryDate: soldItem.selectedExpiryDate,
                  quantity: qtyRestock
                });
              }
            } else {
              // Fallback: Restore to the oldest batch (reverse of FIFO)
              if (nextBatches.length > 0) {
                nextBatches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
                nextBatches[0].quantity = (nextBatches[0].quantity || 0) + qtyRestock;
              } else {
                nextBatches.push({
                  batchNumber: prod.batchNumber || '',
                  expiryDate: prod.expiryDate || '',
                  quantity: qtyRestock
                });
              }
            }
          }

          const updatedProd = {
            ...prod,
            stockQuantity: nextStock,
            batches: nextBatches,
            updatedAt: Date.now(),
            version: (prod.version || 1) + 1,
          };
          return updatedProd;
        }
        return prod;
      });

      // Handle items that no longer exist in the product catalog (they were completely deleted)
      const restoredProducts: Product[] = [];
      saleToDelete.items.forEach(itemSold => {
        const exists = nextProducts.some(p => p.id === itemSold.productId || p.code === itemSold.productCode);
        if (!exists) {
          // Recreate the product entry since it was deleted
          const fallbackExpiry = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
          const restockQty = itemSold.quantity;
          const restoredProd: Product = {
            id: itemSold.productId,
            code: itemSold.productCode,
            name: itemSold.productName,
            category: itemSold.category || 'drug',
            ingredients: 'Restored from deleted sale',
            dosage: '',
            presentation: '',
            form: '',
            priceLBP: itemSold.unitPriceLBP || 0,
            priceUSD: itemSold.unitPriceUSD || 0,
            costPriceUSD: itemSold.costPriceUSD || 0,
            pharmacistMarginProfit: 0,
            agent: 'Unknown (Restored)',
            stockQuantity: restockQty,
            minStockAlert: 5,
            expiryDate: itemSold.selectedExpiryDate || fallbackExpiry,
            batchNumber: itemSold.selectedBatchNumber || 'RESTORED-BATCH',
            batches: [{
              batchNumber: itemSold.selectedBatchNumber || 'RESTORED-BATCH',
              expiryDate: itemSold.selectedExpiryDate || fallbackExpiry,
              quantity: restockQty
            }],
            updatedAt: Date.now(),
            version: 1
          };
          
          restoredProducts.push(restoredProd);
        }
      });

      const finalProducts = [...restoredProducts, ...nextProducts];
      OfflineStorage.saveProducts(finalProducts);
      try {
        const changedIds = new Set([...Array.from(mutatedIds), ...restoredProducts.map(p => p.id)]);
        const changedProds = finalProducts.filter(p => changedIds.has(p.id));
        if (changedProds.length > 0) syncEngine.broadcast('STOCK_MUTATION', changedProds);
      } catch (e) {}
      return finalProducts;
    });

    if (saleToDelete.customerId && saleToDelete.paymentMethod === 'credit_debt') {
      setCustomers(prevCusts => {
        const nextCusts = prevCusts.map(c => {
          if (c.id === saleToDelete.customerId) {
            return {
              ...c,
              balanceUSD: Math.max(0, Number((c.balanceUSD - saleToDelete.totalUSD).toFixed(2))),
              balanceLBP: Math.max(0, c.balanceLBP - saleToDelete.totalLBP),
            };
          }
          return c;
        });
        OfflineStorage.saveCustomers(nextCusts);
        try {
          const updatedCust = nextCusts.find(c => c.id === saleToDelete.customerId);
          if (updatedCust) syncEngine.broadcast('CUSTOMER_UPSERT', updatedCust);
        } catch (e) {}
        return nextCusts;
      });
    }

    const updatedSales = sales.filter(s => s.id !== saleId);
    setSales(updatedSales);
    OfflineStorage.saveSales(updatedSales);
    try { syncEngine.broadcast('SALE_DELETED', { id: saleId }); } catch (e) {}

    addNotification(
      'Sale Canceled / Voided',
      `Invoice #${saleToDelete.invoiceNumber} was voided and stock restocked.`,
      'sale',
      'warning'
    );

    addLog({
      component: 'POS / Sale',
      action: 'SALE_VOIDED',
      level: 'error',
      title: `Invoice Voided #${saleToDelete.invoiceNumber}`,
      description: `Voided transaction (${formatUSD(saleToDelete.totalUSD)}). Restocked ${(saleToDelete.items || []).length} items.`,
      entityId: saleId,
      entityType: 'sale',
      details: {
        invoiceNumber: saleToDelete.invoiceNumber,
        totalUSD: saleToDelete.totalUSD,
        itemsCount: (saleToDelete.items || []).length
      }
    });

    return { success: true };
  };



  // Customer Payments
  const recordCustomerPayment = (payment: Omit<CustomerPayment, 'id' | 'timestamp'>) => {
    const fullPayment: CustomerPayment = {
      ...payment,
      id: `CUST-PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now()
    };
    
    // Update customer balance
    const cust = customers.find(c => c.id === payment.customerId);
    if (cust) {
      if (payment.currency === 'USD') {
        updateCustomer(cust.id, { balanceUSD: Math.max(0, cust.balanceUSD - payment.amount) });
      } else {
        updateCustomer(cust.id, { balanceLBP: Math.max(0, cust.balanceLBP - payment.amount) });
      }
    }
    
    const newPayments = [fullPayment, ...customerPayments];
    setCustomerPayments(newPayments);
    OfflineStorage.saveCustomerPayments(newPayments);
    
    syncEngine.broadcast('CUSTOMER_PAYMENT_UPSERT', fullPayment);
    return { success: true };
  };
  
  const updateCustomerPayment = (paymentId: string, updatedData: Partial<CustomerPayment>) => {
    const oldPayment = customerPayments.find(p => p.id === paymentId);
    if (!oldPayment) return { success: false, error: 'Payment not found' };

    const mergedData = { ...oldPayment, ...updatedData, timestamp: Date.now() };

    // Handle balance adjustment if amount or currency changed
    if (updatedData.amount !== undefined || updatedData.currency !== undefined) {
      const cust = customers.find(c => c.id === oldPayment.customerId);
      if (cust) {
        // Reverse old
        let currentUsd = cust.balanceUSD;
        let currentLbp = cust.balanceLBP;
        if (oldPayment.currency === 'USD') currentUsd += oldPayment.amount;
        else currentLbp += oldPayment.amount;
        
        // Apply new
        const newCurrency = updatedData.currency || oldPayment.currency;
        const newAmount = updatedData.amount !== undefined ? updatedData.amount : oldPayment.amount;
        if (newCurrency === 'USD') currentUsd = Math.max(0, currentUsd - newAmount);
        else currentLbp = Math.max(0, currentLbp - newAmount);
        
        updateCustomer(cust.id, { balanceUSD: currentUsd, balanceLBP: currentLbp });
      }
    }

    const newPayments = customerPayments.map(p => p.id === paymentId ? mergedData : p);
    setCustomerPayments(newPayments);
    OfflineStorage.saveCustomerPayments(newPayments);
    
    syncEngine.broadcast('CUSTOMER_PAYMENT_UPSERT', mergedData);
    return { success: true };
  };

  const deleteCustomerPayment = (paymentId: string) => {
    const payment = customerPayments.find(p => p.id === paymentId);
    if (!payment) return { success: false, error: 'Payment not found' };
    
    // Reverse customer balance
    const cust = customers.find(c => c.id === payment.customerId);
    if (cust) {
      if (payment.currency === 'USD') {
        updateCustomer(cust.id, { balanceUSD: cust.balanceUSD + payment.amount });
      } else {
        updateCustomer(cust.id, { balanceLBP: cust.balanceLBP + payment.amount });
      }
    }
    
    const newPayments = customerPayments.filter(p => p.id !== paymentId);
    setCustomerPayments(newPayments);
    OfflineStorage.saveCustomerPayments(newPayments);
    
    syncEngine.broadcast('CUSTOMER_PAYMENT_DELETED', { id: paymentId });
    return { success: true };
  };

  // Purchases

const recordSupplierPayment = (payment: Omit<SupplierPayment, 'id' | 'timestamp' | 'allocations'>) => {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const yearPayments = supplierPayments.filter(p => p.id && p.id.startsWith(`RCT-${currentYear}-`));
    let nextNum = 1;
    if (yearPayments.length > 0) {
      const maxNum = Math.max(...yearPayments.map(p => parseInt(p.id.split('-')[2], 10) || 0));
      nextNum = maxNum + 1;
    }
    const paymentId = `RCT-${currentYear}-${nextNum}`;

    let fullPayment: SupplierPayment = {
      ...payment,
      id: paymentId,
      timestamp: Date.now(),
      allocations: []
    };

    // Calculate allocations and update invoices
    let totalDeductedUSD = 0;
    let totalDeductedLBP = 0;
    let totalAllocatedInPaymentCurrency = 0;

    if (fullPayment.invoices.length > 0 && !fullPayment.isPaymentOnAccount) {
      setPurchases(prev => {
        const next = [...prev];
        
        // Sort selected invoices by date ascending (oldest first)
        const selectedInvoices = next.filter(inv => fullPayment.invoices.includes(inv.id))
                                     .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const allocations: { invoiceId: string, amountUSD: number, amountLBP: number }[] = [];

        if (fullPayment.currency === 'MIXED') {
          let payUSD = fullPayment.amountUSD || 0;
          let payLBP = fullPayment.amountLBP || 0;

          for (const inv of selectedInvoices) {
            if (payUSD <= 0 && payLBP <= 0) break;
            const index = next.findIndex(i => i.id === inv.id);
            if (index === -1) continue;

            const updatedInv = { ...next[index] };
            const invRate = updatedInv.exchangeRate || exchangeRate || 1;
            const costUSD = updatedInv.currency === 'USD' ? updatedInv.totalCostUSD : (updatedInv.totalCostLBP / invRate);
            const paidUSD = (updatedInv.paidAmountUSD || 0) + ((updatedInv.paidAmountLBP || 0) / invRate);
            const leftUSD = Math.max(0, costUSD - paidUSD);

            if (leftUSD <= 0.005) continue;

            let appliedUSD = 0;
            let appliedLBP = 0;

            if (updatedInv.currency === 'USD') {
              if (payUSD > 0) {
                const useUSD = Math.min(payUSD, leftUSD);
                appliedUSD += useUSD;
                payUSD -= useUSD;
              }
              const stillLeftUSD = leftUSD - appliedUSD;
              if (stillLeftUSD > 0.005 && payLBP > 0) {
                const neededLBP = stillLeftUSD * invRate;
                const useLBP = Math.min(payLBP, neededLBP);
                appliedLBP += useLBP;
                payLBP -= useLBP;
              }
            } else {
              const leftLBP = leftUSD * invRate;
              if (payLBP > 0) {
                const useLBP = Math.min(payLBP, leftLBP);
                appliedLBP += useLBP;
                payLBP -= useLBP;
              }
              const stillLeftLBP = leftLBP - appliedLBP;
              if (stillLeftLBP > 1 && payUSD > 0) {
                const neededUSD = stillLeftLBP / invRate;
                const useUSD = Math.min(payUSD, neededUSD);
                appliedUSD += useUSD;
                payUSD -= useUSD;
              }
            }

            if (appliedUSD > 0 || appliedLBP > 0) {
              updatedInv.paidAmountUSD = (updatedInv.paidAmountUSD || 0) + appliedUSD;
              updatedInv.paidAmountLBP = (updatedInv.paidAmountLBP || 0) + appliedLBP;
              totalDeductedUSD += appliedUSD;
              totalDeductedLBP += appliedLBP;

              allocations.push({
                invoiceId: updatedInv.id,
                amountUSD: appliedUSD,
                amountLBP: appliedLBP
              });

              const newPaidUSD = (updatedInv.paidAmountUSD || 0) + ((updatedInv.paidAmountLBP || 0) / invRate);
              if (costUSD - newPaidUSD <= 0.01) {
                updatedInv.paid = true;
              }
              next[index] = updatedInv;
            }
          }

          // Any remaining unallocated payment
          totalDeductedUSD += payUSD;
          totalDeductedLBP += payLBP;

        } else {
          let remainingAmount = fullPayment.amount;
          for (const inv of selectedInvoices) {
            if (remainingAmount <= 0) break;
            
            const index = next.findIndex(i => i.id === inv.id);
            if (index === -1) continue;
            
            const updatedInv = { ...next[index] };
            const invRate = updatedInv.exchangeRate || exchangeRate || 1;
            
            // Calculate amount left in payment currency
            let amountLeftInPaymentCurrency = 0;
            if (fullPayment.currency === 'USD') {
               const costInUSD = updatedInv.currency === 'USD' ? updatedInv.totalCostUSD : (updatedInv.totalCostLBP / invRate);
               const paidInUSD = (updatedInv.paidAmountUSD || 0) + ((updatedInv.paidAmountLBP || 0) / invRate);
               amountLeftInPaymentCurrency = costInUSD - paidInUSD;
            } else {
               const costInLBP = updatedInv.currency === 'LBP' ? updatedInv.totalCostLBP : (updatedInv.totalCostUSD * invRate);
               const paidInLBP = (updatedInv.paidAmountLBP || 0) + ((updatedInv.paidAmountUSD || 0) * invRate);
               amountLeftInPaymentCurrency = costInLBP - paidInLBP;
            }
            
            if (amountLeftInPaymentCurrency <= 0.01) continue; // Already paid
            
            const amountToApplyInPaymentCurrency = Math.min(remainingAmount, amountLeftInPaymentCurrency);
            remainingAmount -= amountToApplyInPaymentCurrency;
            totalAllocatedInPaymentCurrency += amountToApplyInPaymentCurrency;
            
            // Convert applied amount to invoice currency
            let appliedUSD = 0;
            let appliedLBP = 0;
            
            if (fullPayment.currency === 'USD') {
               appliedUSD = amountToApplyInPaymentCurrency;
               appliedLBP = amountToApplyInPaymentCurrency * invRate;
            } else {
               appliedLBP = amountToApplyInPaymentCurrency;
               appliedUSD = amountToApplyInPaymentCurrency / invRate;
            }
            
            if (updatedInv.currency === 'USD') {
               updatedInv.paidAmountUSD = (updatedInv.paidAmountUSD || 0) + appliedUSD;
               totalDeductedUSD += appliedUSD;
            } else {
               updatedInv.paidAmountLBP = (updatedInv.paidAmountLBP || 0) + appliedLBP;
               totalDeductedLBP += appliedLBP;
            }
            
            allocations.push({
              invoiceId: updatedInv.id,
              amountUSD: appliedUSD,
              amountLBP: appliedLBP
            });
            
            // Check if fully paid
            const newAmountLeft = amountLeftInPaymentCurrency - amountToApplyInPaymentCurrency;
            if (newAmountLeft <= 0.01) {
               updatedInv.paid = true;
            }
            
            next[index] = updatedInv;
          }

          const unallocatedAmount = Math.max(0, fullPayment.amount - totalAllocatedInPaymentCurrency);
          if (unallocatedAmount > 0) {
            if (fullPayment.currency === 'USD') {
              totalDeductedUSD += unallocatedAmount;
            } else {
              totalDeductedLBP += unallocatedAmount;
            }
          }
        }
        
        fullPayment.allocations = allocations;
        OfflineStorage.savePurchases(next);
        return next;
      });
    } else {
      // Payment on account or no invoices selected
      if (fullPayment.currency === 'MIXED') {
        totalDeductedUSD += fullPayment.amountUSD || 0;
        totalDeductedLBP += fullPayment.amountLBP || 0;
      } else if (fullPayment.currency === 'USD') {
        totalDeductedUSD += fullPayment.amount;
      } else {
        totalDeductedLBP += fullPayment.amount;
      }
    }

    const newPayments = [fullPayment, ...supplierPayments];
    setSupplierPayments(newPayments);
    OfflineStorage.saveSupplierPayments(newPayments);

    // Update supplier balance accordingly with respect to selected invoices
    setSuppliers(prev => {
      const next = prev.map(s => {
        if (s.id === fullPayment.supplierId) {
          let balUSD = (s.balanceUSD || 0) - totalDeductedUSD;
          let balLBP = (s.balanceLBP || 0) - totalDeductedLBP;

          // Cross-currency offset if one goes below zero and the other is positive
          if (balUSD < -0.01 && balLBP > 0) {
            const excessUSD = Math.abs(balUSD);
            balLBP = Math.max(0, balLBP - Math.round(excessUSD * exchangeRate));
            balUSD = 0;
          } else if (balLBP < -1 && balUSD > 0) {
            const excessLBP = Math.abs(balLBP);
            balUSD = Math.max(0, Number((balUSD - (excessLBP / exchangeRate)).toFixed(2)));
            balLBP = 0;
          }

          // If all purchases for this supplier are now paid (and no other opening balance), ensure clean 0
          const supPurchases = purchases.filter(p => p.supplierId === s.id);
          const hasUnpaidOther = supPurchases.some(p => !p.paid && !fullPayment.invoices.includes(p.id));
          if (!hasUnpaidOther && (s.id === 'sup-union' || !s.id.startsWith('sup-'))) {
            balUSD = 0;
            balLBP = 0;
          }

          return {
            ...s,
            balanceUSD: Math.max(0, Number(balUSD.toFixed(2))),
            balanceLBP: Math.max(0, Math.round(balLBP)),
          };
        }
        return s;
      });
      OfflineStorage.saveSuppliers(next);
      try {
        const updatedSup = next.find(s => s.id === fullPayment.supplierId);
        if (updatedSup) syncEngine.broadcast('SUPPLIER_UPSERT', updatedSup);
      } catch (e) {}
      return next;
    });

    return { success: true };
  };

  const deleteSupplierPayment = (paymentId: string) => {
    const payment = supplierPayments.find(p => p.id === paymentId);
    if (!payment) return { success: false, error: 'Payment not found' };

    // Remove from payments list
    const newPayments = supplierPayments.filter(p => p.id !== paymentId);
    setSupplierPayments(newPayments);
    OfflineStorage.saveSupplierPayments(newPayments);

    // Revert supplier balance with respect to allocations
    setSuppliers(prev => {
      const next = prev.map(s => {
        if (s.id === payment.supplierId) {
          let addUSD = 0;
          let addLBP = 0;

          if (payment.allocations && payment.allocations.length > 0 && !payment.isPaymentOnAccount) {
            let totalAllocUSD = 0;
            let totalAllocLBP = 0;
            for (const alloc of payment.allocations) {
              const inv = purchases.find(p => p.id === alloc.invoiceId);
              const invCurrency = inv?.currency || 'USD';
              if (invCurrency === 'LBP') {
                addLBP += alloc.amountLBP;
              } else {
                addUSD += alloc.amountUSD;
              }
              totalAllocUSD += alloc.amountUSD || 0;
              totalAllocLBP += alloc.amountLBP || 0;
            }

            if (payment.currency === 'MIXED') {
              const unallocatedUSD = Math.max(0, (payment.amountUSD || 0) - totalAllocUSD);
              const unallocatedLBP = Math.max(0, (payment.amountLBP || 0) - totalAllocLBP);
              addUSD += unallocatedUSD;
              addLBP += unallocatedLBP;
            } else {
              const totalAllocInPaymentCurr = payment.currency === 'USD' ? totalAllocUSD : totalAllocLBP;
              const unallocated = Math.max(0, payment.amount - totalAllocInPaymentCurr);
              if (unallocated > 0) {
                if (payment.currency === 'USD') addUSD += unallocated;
                else addLBP += unallocated;
              }
            }
          } else {
            if (payment.currency === 'MIXED') {
              addUSD += payment.amountUSD || 0;
              addLBP += payment.amountLBP || 0;
            } else if (payment.currency === 'USD') {
              addUSD += payment.amount;
            } else {
              addLBP += payment.amount;
            }
          }

          return {
            ...s,
            balanceUSD: Number(((s.balanceUSD || 0) + addUSD).toFixed(2)),
            balanceLBP: Math.round((s.balanceLBP || 0) + addLBP),
          };
        }
        return s;
      });
      OfflineStorage.saveSuppliers(next);
      try {
        const updatedSup = next.find(s => s.id === payment.supplierId);
        if (updatedSup) syncEngine.broadcast('SUPPLIER_UPSERT', updatedSup);
      } catch (e) {}
      return next;
    });

    // Revert invoices exactly using allocations
    if (payment.allocations && payment.allocations.length > 0 && !payment.isPaymentOnAccount) {
      setPurchases(prev => {
        const next = [...prev];
        for (const alloc of payment.allocations!) {
          const index = next.findIndex(inv => inv.id === alloc.invoiceId);
          if (index !== -1) {
             const updatedInv = { ...next[index] };
             
             if (alloc.amountUSD) {
                updatedInv.paidAmountUSD = Math.max(0, (updatedInv.paidAmountUSD || 0) - alloc.amountUSD);
             }
             if (alloc.amountLBP) {
                updatedInv.paidAmountLBP = Math.max(0, (updatedInv.paidAmountLBP || 0) - alloc.amountLBP);
             }
             
             // Unmark fully paid if it was
             updatedInv.paid = false; 
             next[index] = updatedInv;
          }
        }
        OfflineStorage.savePurchases(next);
        return next;
      });
    } else if (payment.invoices.length > 0 && !payment.isPaymentOnAccount && (!payment.allocations || payment.allocations.length === 0)) {
      // Fallback for older payments that didn't have allocations recorded
      setPurchases(prev => {
        const next = prev.map(inv => {
          if (payment.invoices.includes(inv.id)) {
            return { ...inv, paid: false, paidAmountUSD: 0, paidAmountLBP: 0 };
          }
          return inv;
        });
        OfflineStorage.savePurchases(next);
        return next;
      });
    }

    return { success: true };
  };

  const updateSupplierPayment = (paymentId: string, updatedData: Partial<SupplierPayment>) => {
    const oldPayment = supplierPayments.find(p => p.id === paymentId);
    if (!oldPayment) return { success: false, error: 'Payment not found' };

    const mergedData = { ...oldPayment, ...updatedData };
    
    // First, revert the old payment
    deleteSupplierPayment(paymentId);
    
    // Then, record the new payment. The new recording flow will recreate allocations.
    // We intentionally omit ID, timestamp, and allocations so they are freshly generated by recordSupplierPayment
    const { id, timestamp, allocations, ...dataToRecord } = mergedData;
    
    recordSupplierPayment(dataToRecord);

    return { success: true };
  };

  const recordPurchase = (purchaseData: Omit<PurchaseInvoice, 'id' | 'timestamp' | 'invoiceNumber'> & { invoiceNumber?: string }): PurchaseInvoice => {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const yearPurchases = purchases.filter(p => p.id && p.id.startsWith(`INV-${currentYear}-`));
    let nextNum = 1;
    if (yearPurchases.length > 0) {
      const maxNum = Math.max(...yearPurchases.map(p => parseInt(p.id.split('-')[2], 10) || 0));
      nextNum = maxNum + 1;
    }
    const purchaseId = `INV-${currentYear}-${nextNum}`;
    const invoiceNumber = purchaseData.invoiceNumber || nextInvoiceNumber(purchases, 'PINV', purchases.length + 500);

    const fullPurchase: PurchaseInvoice = {
      ...purchaseData,
      id: purchaseId,
      invoiceNumber,
      timestamp: Date.now(),
    };

    // 1. Add purchase invoice
    const updatedPurchases = [fullPurchase, ...purchases];
    setPurchases(updatedPurchases);
    OfflineStorage.savePurchases(updatedPurchases);
    try { syncEngine.broadcast('PURCHASE_CREATED', fullPurchase); } catch (e) {}

    // 2. Increase stock of items
    setProducts(prevProducts => {
      const mutatedProds: Product[] = [];
      const updatedProds = prevProducts.map(prod => {
        const purItems = (fullPurchase.items || []).filter(i => i.productId === prod.id || i.productCode === prod.code);
        if (purItems.length > 0) {
          const addedStock = purItems.reduce((acc, item) => acc + ((item.isPiece && prod.piecesPerBox) ? (item.quantity / prod.piecesPerBox) : item.quantity), 0);
          const nextStock = prod.stockQuantity + addedStock;
          const lastPurItem = purItems[purItems.length - 1];

          let newPriceLBP = prod.priceLBP;
          let newPriceUSD = prod.priceUSD;
          let newCostPriceUSD = prod.costPriceUSD;
          let priceChangedAt = prod.priceChangedAt;

          if (lastPurItem.sellingPriceLBP !== undefined && lastPurItem.sellingPriceLBP > 0) {
            if (lastPurItem.sellingPriceLBP !== prod.priceLBP) {
              newPriceLBP = lastPurItem.sellingPriceLBP;
              priceChangedAt = Date.now();
            }
          }
          if (lastPurItem.sellingPriceUSD !== undefined && lastPurItem.sellingPriceUSD > 0) {
            if (lastPurItem.sellingPriceUSD !== prod.priceUSD) {
              newPriceUSD = lastPurItem.sellingPriceUSD;
              priceChangedAt = Date.now();
            }
          }
          if (lastPurItem.unitCostUSD !== undefined && lastPurItem.unitCostUSD > 0) {
            newCostPriceUSD = lastPurItem.unitCostUSD;
          }

          const nextProd: Product = {
            ...prod,
            stockQuantity: nextStock,
            batchNumber: lastPurItem.batchNumber || prod.batchNumber,
            expiryDate: lastPurItem.expiryDate || prod.expiryDate,
            priceLBP: newPriceLBP,
            priceUSD: newPriceUSD,
            costPriceUSD: newCostPriceUSD,
            previousPriceLBP: newPriceLBP !== prod.priceLBP ? prod.priceLBP : prod.previousPriceLBP,
            previousPriceUSD: newPriceUSD !== prod.priceUSD ? prod.priceUSD : prod.previousPriceUSD,
            priceChangedAt,
            updatedAt: Date.now(),
            version: (prod.version || 1) + 1,
          };
          mutatedProds.push(nextProd);
          return nextProd;
        }
        return prod;
      });
      OfflineStorage.saveProducts(updatedProds);
      if (mutatedProds.length > 0) {
        try { syncEngine.broadcast('STOCK_MUTATION', mutatedProds); } catch (e) {}
      }
      return updatedProds;
    });

    // 3. Update supplier balance if unpaid
    if (!fullPurchase.paid) {
      setSuppliers(prev => {
        const isLBP = fullPurchase.currency === 'LBP';
        const updated = prev.map(s => {
          if (s.id === fullPurchase.supplierId) {
            return {
              ...s,
              balanceUSD: isLBP ? (s.balanceUSD || 0) : Number(((s.balanceUSD || 0) + fullPurchase.totalCostUSD).toFixed(2)),
              balanceLBP: isLBP ? Math.round((s.balanceLBP || 0) + fullPurchase.totalCostLBP) : (s.balanceLBP || 0),
            };
          }
          return s;
        });
        OfflineStorage.saveSuppliers(updated);
        try {
          const updatedSup = updated.find(s => s.id === fullPurchase.supplierId);
          if (updatedSup) syncEngine.broadcast('SUPPLIER_UPSERT', updatedSup);
        } catch (e) {}
        return updated;
      });
    }

    addNotification(
      'Purchase Order Recorded',
      `Restocked items from ${fullPurchase.supplierName} (${formatUSD(fullPurchase.totalCostUSD)})`,
      'inventory',
      'success'
    );

    addLog({
      component: 'Purchases',
      action: 'PURCHASE_REGISTERED',
      level: 'success',
      title: `Supplier Delivery Inward #${invoiceNumber}`,
      description: `Inbound invoice from ${fullPurchase.supplierName}. Total: ${formatUSD(fullPurchase.totalCostUSD)}. ${(fullPurchase.items || []).length} items restocked.`,
      entityId: purchaseId,
      entityType: 'purchase',
      details: {
        invoiceNumber,
        supplierName: fullPurchase.supplierName,
        totalCostUSD: fullPurchase.totalCostUSD,
        totalCostLBP: fullPurchase.totalCostLBP,
        itemsCount: (fullPurchase.items || []).length,
        paid: fullPurchase.paid
      }
    });

    return fullPurchase;
  };

  const updatePurchase = (purchaseId: string, updatedData: Partial<PurchaseInvoice>): { success: boolean; error?: string } => {
    const oldPurchase = purchases.find(p => p.id === purchaseId);
    if (!oldPurchase) return { success: false, error: 'Purchase not found' };

    const newPurchase = { ...oldPurchase, ...updatedData };

    // Update purchase record
    const updatedPurchases = purchases.map(p => p.id === purchaseId ? newPurchase : p);
    setPurchases(updatedPurchases);
    OfflineStorage.savePurchases(updatedPurchases);
    try { syncEngine.broadcast('PURCHASE_UPDATED', newPurchase); } catch (e) {}

    // Adjust stock: subtract old items, add new items
    if (updatedData.items) {
      setProducts(prevProducts => {
        const mutatedProds: Product[] = [];
        const updatedProds = prevProducts.map(prod => {
          const oldItems = (oldPurchase.items || []).filter(i => i.productId === prod.id || i.productCode === prod.code);
          const newItems = (newPurchase.items || []).filter(i => i.productId === prod.id || i.productCode === prod.code);

          if (oldItems.length > 0 || newItems.length > 0) {
            const oldStock = oldItems.reduce((acc, item) => acc + ((item.isPiece && prod.piecesPerBox) ? (item.quantity / prod.piecesPerBox) : item.quantity), 0);
            const newStock = newItems.reduce((acc, item) => acc + ((item.isPiece && prod.piecesPerBox) ? (item.quantity / prod.piecesPerBox) : item.quantity), 0);
            
            const netChange = newStock - oldStock;

            if (netChange !== 0 || newItems.length > 0) {
              const lastNewItem = newItems.length > 0 ? newItems[newItems.length - 1] : undefined;
              
              let newPriceLBP = prod.priceLBP;
              let newPriceUSD = prod.priceUSD;
              let newCostPriceUSD = prod.costPriceUSD;
              let priceChangedAt = prod.priceChangedAt;

              if (lastNewItem) {
                if (lastNewItem.sellingPriceLBP !== undefined && lastNewItem.sellingPriceLBP > 0) {
                  if (lastNewItem.sellingPriceLBP !== prod.priceLBP) {
                    newPriceLBP = lastNewItem.sellingPriceLBP;
                    priceChangedAt = Date.now();
                  }
                }
                if (lastNewItem.sellingPriceUSD !== undefined && lastNewItem.sellingPriceUSD > 0) {
                  if (lastNewItem.sellingPriceUSD !== prod.priceUSD) {
                    newPriceUSD = lastNewItem.sellingPriceUSD;
                    priceChangedAt = Date.now();
                  }
                }
                if (lastNewItem.unitCostUSD !== undefined && lastNewItem.unitCostUSD > 0) {
                  newCostPriceUSD = lastNewItem.unitCostUSD;
                }
              }

              const nextProd: Product = {
                ...prod,
                stockQuantity: Math.max(0, prod.stockQuantity + netChange),
                batchNumber: lastNewItem?.batchNumber || prod.batchNumber,
                expiryDate: lastNewItem?.expiryDate || prod.expiryDate,
                priceLBP: newPriceLBP,
                priceUSD: newPriceUSD,
                costPriceUSD: newCostPriceUSD,
                previousPriceLBP: newPriceLBP !== prod.priceLBP ? prod.priceLBP : prod.previousPriceLBP,
                previousPriceUSD: newPriceUSD !== prod.priceUSD ? prod.priceUSD : prod.previousPriceUSD,
                priceChangedAt,
                updatedAt: Date.now(),
                version: (prod.version || 1) + 1,
              };
              mutatedProds.push(nextProd);
              return nextProd;
            }
          }
          return prod;
        });

        OfflineStorage.saveProducts(updatedProds);
        if (mutatedProds.length > 0) {
          try { syncEngine.broadcast('STOCK_MUTATION', mutatedProds); } catch (e) {}
        }
        return updatedProds;
      });
    }

    // Adjust supplier balance if `paid` status or total cost changed
    const oldIsLBP = oldPurchase.currency === 'LBP';
    const oldSupplierDebtUSD = (!oldPurchase.paid && !oldIsLBP) ? oldPurchase.totalCostUSD : 0;
    const oldSupplierDebtLBP = (!oldPurchase.paid && oldIsLBP) ? oldPurchase.totalCostLBP : 0;
    
    const newIsLBP = newPurchase.currency === 'LBP';
    const newSupplierDebtUSD = (!newPurchase.paid && !newIsLBP) ? newPurchase.totalCostUSD : 0;
    const newSupplierDebtLBP = (!newPurchase.paid && newIsLBP) ? newPurchase.totalCostLBP : 0;

    const diffDebtUSD = newSupplierDebtUSD - oldSupplierDebtUSD;
    const diffDebtLBP = newSupplierDebtLBP - oldSupplierDebtLBP;

    if (diffDebtUSD !== 0 || diffDebtLBP !== 0) {
      setSuppliers(prev => {
        const updated = prev.map(s => {
          if (s.id === newPurchase.supplierId) {
            return {
              ...s,
              balanceUSD: Math.max(0, Number(((s.balanceUSD || 0) + diffDebtUSD).toFixed(2))),
              balanceLBP: Math.max(0, Math.round((s.balanceLBP || 0) + diffDebtLBP)),
            };
          }
          return s;
        });
        OfflineStorage.saveSuppliers(updated);
        try {
          const updatedSup = updated.find(s => s.id === newPurchase.supplierId);
          if (updatedSup) syncEngine.broadcast('SUPPLIER_UPSERT', updatedSup);
        } catch (e) {}
        return updated;
      });
    }

    return { success: true };
  };

  const deletePurchase = (purchaseId: string): { success: boolean; error?: string } => {
    const purchaseToDel = purchases.find(p => p.id === purchaseId);
    if (!purchaseToDel) return { success: false, error: 'Purchase not found' };

    const updatedPurchases = purchases.filter(p => p.id !== purchaseId);
    setPurchases(updatedPurchases);
    OfflineStorage.savePurchases(updatedPurchases);
    try { syncEngine.broadcast('PURCHASE_DELETED', { id: purchaseId }); } catch (e) {}

    // Revert stock
    setProducts(prevProducts => {
      const mutatedProds: Product[] = [];
      const updatedProds = prevProducts.map(prod => {
        const purItems = (purchaseToDel.items || []).filter(i => i.productId === prod.id || i.productCode === prod.code);
        if (purItems.length > 0) {
          const removedStock = purItems.reduce((acc, item) => acc + ((item.isPiece && prod.piecesPerBox) ? (item.quantity / prod.piecesPerBox) : item.quantity), 0);
          const nextProd = {
            ...prod,
            stockQuantity: Math.max(0, prod.stockQuantity - removedStock),
            updatedAt: Date.now(),
            version: (prod.version || 1) + 1,
          };
          mutatedProds.push(nextProd);
          return nextProd;
        }
        return prod;
      });
      OfflineStorage.saveProducts(updatedProds);
      if (mutatedProds.length > 0) {
        try { syncEngine.broadcast('STOCK_MUTATION', mutatedProds); } catch (e) {}
      }
      return updatedProds;
    });

    // Adjust supplier balance if it was unpaid
    if (!purchaseToDel.paid) {
      setSuppliers(prev => {
        const isLBP = purchaseToDel.currency === 'LBP';
        const updated = prev.map(s => {
          if (s.id === purchaseToDel.supplierId) {
            return {
              ...s,
              balanceUSD: isLBP ? s.balanceUSD : Math.max(0, Number(((s.balanceUSD || 0) - purchaseToDel.totalCostUSD).toFixed(2))),
              balanceLBP: isLBP ? Math.max(0, Math.round((s.balanceLBP || 0) - purchaseToDel.totalCostLBP)) : s.balanceLBP,
            };
          }
          return s;
        });
        OfflineStorage.saveSuppliers(updated);
        try {
          const updatedSup = updated.find(s => s.id === purchaseToDel.supplierId);
          if (updatedSup) syncEngine.broadcast('SUPPLIER_UPSERT', updatedSup);
        } catch (e) {}
        return updated;
      });
    }

    return { success: true };
  };

  // Suppliers CRUD
  const addSupplier = (supplierData: Omit<Supplier, 'id'>) => {
    const newSup: Supplier = {
      ...supplierData,
      id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
    setSuppliers(prev => {
      const updated = [...prev, newSup];
      OfflineStorage.saveSuppliers(updated);
      return updated;
    });
    try { syncEngine.broadcast('SUPPLIER_UPSERT', newSup); } catch (e) {}
    addNotification('Supplier Added', `Registered supplier: ${newSup.name}`, 'system', 'success');
  };

  const bulkAddSuppliers = (suppliersData: Omit<Supplier, 'id'>[]) => {
    if (suppliersData.length === 0) return;
    
    const newSups: Supplier[] = suppliersData.map((data, index) => ({
      ...data,
      id: `sup-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
    }));

    setSuppliers(prev => {
      const updated = [...prev, ...newSups];
      OfflineStorage.saveSuppliers(updated);
      return updated;
    });

    try {
      newSups.forEach(sup => syncEngine.broadcast('SUPPLIER_UPSERT', sup));
    } catch (e) {}
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    const updated = suppliers.map(s => s.id === id ? { ...s, ...updates } : s);
    setSuppliers(updated);
    OfflineStorage.saveSuppliers(updated);
    try {
      const updatedSup = updated.find(s => s.id === id);
      if (updatedSup) syncEngine.broadcast('SUPPLIER_UPSERT', updatedSup);
    } catch (e) {}
  };

  const deleteSupplier = (id: string) => {
    const hasPurchases = purchases.some(p => p.supplierId === id);
    if (hasPurchases) {
      addNotification('Error', 'Cannot delete a supplier with existing purchase records.', 'system', 'error');
      return { success: false, error: 'Cannot delete a supplier with existing purchase records.' };
    }
    const supToDelete = suppliers.find(s => s.id === id);
    if (!supToDelete) return { success: false, error: 'Supplier not found' };

    const updated = suppliers.filter(s => s.id !== id);
    setSuppliers(updated);
    OfflineStorage.saveSuppliers(updated);
    try { syncEngine.broadcast('SUPPLIER_DELETED', { id }); } catch (e) {}
    addNotification('Supplier Deleted', `Removed supplier: ${supToDelete.name}`, 'system', 'success');
    return { success: true };
  };

  // Customers CRUD
  const addCustomer = (customerData: Omit<Customer, 'id'>) => {
    const newCust: Customer = {
      ...customerData,
      id: `cust-${Date.now()}`,
    };
    const updated = [...customers, newCust];
    setCustomers(updated);
    OfflineStorage.saveCustomers(updated);
    try { syncEngine.broadcast('CUSTOMER_UPSERT', newCust); } catch (e) {}
    addNotification('Patient Registered', `Created profile for ${newCust.name}`, 'system', 'success');
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    const updated = customers.map(c => c.id === id ? { ...c, ...updates } : c);
    setCustomers(updated);
    OfflineStorage.saveCustomers(updated);
    try {
      const updatedCust = updated.find(c => c.id === id);
      if (updatedCust) syncEngine.broadcast('CUSTOMER_UPSERT', updatedCust);
    } catch (e) {}
  };

  const deleteCustomer = (id: string) => {
    const updated = customers.filter(c => c.id !== id);
    setCustomers(updated);
    OfflineStorage.saveCustomers(updated);
    try { syncEngine.broadcast('CUSTOMER_DELETED', { id }); } catch (e) {}
  };




  // Notifications
  const unreadCount = notifications.filter(n => !n.read).length;

  const dismissNotification = (id: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      OfflineStorage.saveNotifications(updated);
      return updated;
    });
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      OfflineStorage.saveNotifications(updated);
      return updated;
    });
  };

  // LAN Simulation

  // Backup & Restore
  const exportBackup = async () => {
    return OfflineStorage.exportFullBackup();
  };

  const restoreBackup = async (jsonContent: string) => {
    const ok = await OfflineStorage.restoreFullBackup(jsonContent);
    if (ok) {
      setSettings(OfflineStorage.getSettings());
      setCurrentUser(OfflineStorage.getCurrentUser());
      setUsers(OfflineStorage.getUsers());
      setProducts(OfflineStorage.getProducts());
      setSuppliers(OfflineStorage.getSuppliers());
      setCustomers(OfflineStorage.getCustomers());
      setSales(OfflineStorage.getSales());
      setPurchases(OfflineStorage.getPurchases());
      setSyncConflicts(OfflineStorage.getConflicts());
      setNotifications(OfflineStorage.getNotifications());
      setLogs(OfflineStorage.getLogs());
      addNotification('Database Restored', 'Successfully restored full pharmacy backup!', 'system', 'success');
      return true;
    }
    return false;
  };

  useEffect(() => {
    const schedule = settings.backupSchedule || 'manual';
    if (schedule === 'manual' || !settings.backupLastSuccess) return;

    const interval = window.setInterval(async () => {
      const lastSuccess = Date.parse(settings.backupLastSuccess || '');
      const intervalMs = schedule === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      if (Number.isFinite(lastSuccess) && Date.now() - lastSuccess < intervalMs) return;
      const clientId = getGoogleDriveClientId();
      if (!clientId) return;
      try {
        const result = await backupToGoogleDrive(clientId, await exportBackup(), settings.backupRetentionCount || 5, false);
        updateSettings({
          backupLastSuccess: new Date().toISOString(),
          backupLastStatus: 'success',
          backupLastSummary: `${result.productCount} products, ${result.salesCount} sales, ${result.customerCount} customers`,
        });
      } catch (error) {
        updateSettings({ backupLastStatus: 'failed' });
        console.warn('Scheduled Google Drive backup failed:', error);
      }
    }, 60 * 1000);

    return () => window.clearInterval(interval);
  }, [settings.backupSchedule, settings.backupLastSuccess, settings.backupRetentionCount]);

  const resetDemoData = () => {
    OfflineStorage.resetToDemoData();
    setSettings(OfflineStorage.getSettings());
    setUsers(OfflineStorage.getUsers());
    setProducts(OfflineStorage.getProducts());
    setSuppliers(OfflineStorage.getSuppliers());
    setCustomers(OfflineStorage.getCustomers());
    setSales(OfflineStorage.getSales());
    setPurchases(OfflineStorage.getPurchases());
    setLogs(OfflineStorage.getLogs());
        addNotification('Demo Reset', 'Reset all modules to initial Lebanese demo records.', 'system', 'info');
  };

  const clearAllData = () => {
    OfflineStorage.clearAllData();
    setProducts([]);
    setSuppliers([]);
    setCustomers([]);
    setSales([]);
    setPurchases([]);
    setLogs([]);
    try { syncEngine.broadcast('CLEAR_ALL_DATA', {}); } catch (e) {}
    addNotification('Data Cleared', 'All inventory, sales, purchases, customers, and suppliers have been deleted.', 'system', 'warning');
  };

  const contextValue = useMemo(() => ({
    currentUser,
    login,
    logout,
    users,
    addUser,
    updateUser,
    deleteUser,

    activeTab,
    setActiveTab,

    exchangeRate,
    setExchangeRate,
    toLBP,
    toUSD,
    formatLBP,
    formatUSD,

    products,
    addProduct,
    updateProduct,
    bulkUpdateProducts,
    bulkDeleteProducts,
    deleteProduct,
    deleteAllProducts,
    updateDrugPriceByCode,
    clearPriceChangeIndicators,
    importProductsFromCSV,
    searchScientificDataOnline,
    enrichProductWithOnlineScientifics,
    enrichAllProductsOnline,
    isSearchingScientifics,
    standardizeAllScientifics,

    sales,
    recordSale,
    updateSale,
    deleteSale,

    purchases,
    supplierPayments,
    recordSupplierPayment,
    updateSupplierPayment,
    deleteSupplierPayment,
    recordPurchase,
    updatePurchase,
    deletePurchase,
    suppliers,
    addSupplier,
    bulkAddSuppliers,
    updateSupplier,
    deleteSupplier,

    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    customerPayments,
    recordCustomerPayment,
    updateCustomerPayment,
    deleteCustomerPayment,

    settings,
    updateSettings,
    toggleDarkMode,

    notifications,
    unreadCount,
    dismissNotification,
    markAllNotificationsRead,
    addNotification,
    syncStatus,
    reconnectSync: connectSyncEngine,
    activeSessions,

    logs,
    addLog,
    clearLogs,
    exportLogs,

    exportBackup,
    restoreBackup,
    resetDemoData,
    clearAllData,
  }), [
    currentUser, users, activeTab, exchangeRate, products, sales, purchases, suppliers, customers,
    settings, notifications, syncStatus, activeSessions, logs, isSearchingScientifics,
    login, logout, addUser, updateUser, deleteUser, setActiveTab, setExchangeRate,
    toLBP, toUSD, formatLBP, formatUSD,
    addProduct, updateProduct, bulkUpdateProducts, bulkDeleteProducts, deleteProduct, deleteAllProducts,
    updateDrugPriceByCode, clearPriceChangeIndicators, importProductsFromCSV,
    searchScientificDataOnline, enrichProductWithOnlineScientifics, enrichAllProductsOnline, standardizeAllScientifics,
    recordSale, updateSale, deleteSale, recordPurchase, updatePurchase, deletePurchase,
    addSupplier, bulkAddSuppliers, updateSupplier, deleteSupplier, addCustomer, updateCustomer, updateSettings, toggleDarkMode,
    unreadCount, dismissNotification, markAllNotificationsRead, addNotification,
    connectSyncEngine, addLog, clearLogs, exportLogs, exportBackup, restoreBackup, resetDemoData, clearAllData,
  ]);

  return (
    <PharmacyContext.Provider value={contextValue}>
      {children}
    </PharmacyContext.Provider>
  );
};

export const usePharmacy = () => {
  const context = useContext(PharmacyContext);
  if (!context) {
    throw new Error('usePharmacy must be used within a PharmacyProvider');
  }
  return context;
};
