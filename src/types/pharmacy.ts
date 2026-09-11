export type ProductCategory = 'drug' | 'vitamins' | 'cosmetics' | 'para';

export type UserRole = 'admin' | 'staff' | 'cashier';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  password?: string;
  avatar?: string;
}

export interface ScientificDrugInfo {
  indications: string;
  contraindications: string;
  sideEffects: string;
  generics: string[]; // Equivalent alternative brands/molecules in Lebanon
  dosage: string;
  pediatricDosage?: string;
  form: string;
  presentation: string;
  activeIngredients: string;
  pregnancyCategory?: 'A' | 'B' | 'C' | 'D' | 'X';
  storageConditions?: string;
  onlineEnriched?: boolean;
  onlineSource?: string;
  lastOnlineSearch?: number;
}

export interface ProductBatch {
  batchNumber: string;
  expiryDate: string;
  quantity?: number;
}

export interface Product {
  id: string;
  code: string;
  barcode?: string;
  name: string;
  category: ProductCategory;
  ingredients: string;
  dosage: string;
  presentation: string;
  form: string;
  isDivisible?: boolean; // Whether the product can be sold in pieces
  piecesPerBox?: number; // Number of pieces in a box
  pieceName?: string; // Name of the piece (e.g. sachet, ampoule)
  piecePriceUSD?: number; // Price of 1 piece in USD
  priceLBP: number; // Selling price in Lebanese Pounds
  priceUSD: number; // Selling price in USD
  previousPriceLBP?: number; // Previous price for tracking changes
  previousPriceUSD?: number;
  skippedDecreasedPriceLBP?: number; // Price in LBP from CSV that was lower than previous price and skipped from updating
  skippedDecreasedPriceUSD?: number; // Price in USD from CSV that was lower than previous price and skipped from updating
  priceChangedAt?: number; // Timestamp of the last price change
  costPriceUSD: number; // Cost in USD
  pharmacistMarginProfit: number; // Percentage, e.g. 18%, 20%
  agent: string; // Importer/Agent in Lebanon (e.g., Mersaco, Omnipharma, Fattal)
  stockQuantity: number;
  minStockAlert: number;
  expiryDate: string; // YYYY-MM-DD (Keep for backward compatibility)
  batchNumber: string; // (Keep for backward compatibility)
  batches?: ProductBatch[];
  scientificInfo?: ScientificDrugInfo;
  updatedAt: number; // Timestamp for sync conflict resolution
  version: number; // Vector clock / incrementing version
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number;
  unitPriceUSD: number;
  unitPriceLBP: number;
  cartItemId?: string; // Unique ID for the cart row
  isPiece?: boolean; // Whether this cart item is a piece instead of a whole box
  selectedBatchNumber?: string;
  selectedExpiryDate?: string;
}

export interface SaleTransaction {
  id: string;
  invoiceNumber: string;
  receiptNumber?: string;
  date: string; // ISO string
  timestamp: number;
  items: {
    productId: string;
    productCode: string;
    productName: string;
    category: ProductCategory;
    quantity: number;
    discountPercent?: number;
    unitPriceUSD: number;
    unitPriceLBP: number;
    costPriceUSD: number;
    totalUSD: number;
    totalLBP: number;
    isPiece?: boolean;
    selectedBatchNumber?: string;
    selectedExpiryDate?: string;
  }[];
  totalUSD: number;
  totalLBP: number;
  exchangeRate: number; // LBP per 1 USD at moment of sale
  customerId?: string;
  customerName?: string;
  cashierId: string;
  cashierName: string;
  paymentMethod: 'cash_lbp' | 'cash_usd' | 'mixed' | 'card' | 'credit_debt';
  amountPaidUSD: number;
  amountPaidLBP: number;
  changeGivenUSD: number;
  changeGivenLBP: number;
  writeOffUSD?: number;
  writeOffLBP?: number;
  notes?: string;
  synced: boolean;
}

export interface PurchaseItem {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitCostUSD: number;
  unitCostLBP: number;
  sellingPriceLBP: number;
  sellingPriceUSD?: number;
  discount?: number;
  batchNumber: string;
  expiryDate: string;
  isPiece?: boolean;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: PurchaseItem[];
  totalCostUSD: number;
  totalCostLBP: number;
  exchangeRate: number;
  status: 'received' | 'pending';
  paid: boolean;
  timestamp: number;
  currency?: 'USD' | 'LBP';
}

export interface Supplier {
  id: string;
  name: string;
  code: string;
  phone: string;
  email: string;
  address: string;
  contactPerson: string;
  balanceUSD: number; // Debt owed to supplier
  balanceLBP: number;
  paymentTerms: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  bloodType?: string;
  allergies?: string;
  chronicConditions?: string;
  balanceUSD: number; // Credit/Debt balance
  balanceLBP: number;
  loyaltyPoints: number;
  lastVisit: string;
}

export interface PharmacySettings {
  pharmacyName: string;
  pharmacyPhone: string;
  pharmacyAddress: string;
  licenseNumber: string;
  exchangeRate: number; // Standard 89,500 LBP per 1 USD
  defaultCurrency: 'LBP' | 'USD' | 'BOTH';
  theme: 'emerald' | 'blue' | 'teal' | 'indigo' | 'slate';
  darkMode: boolean;
  fontSize: 'small' | 'normal' | 'large';
  appZoom: number;
  backupSchedule?: 'manual' | 'daily' | 'weekly';
  backupRetentionCount?: number;
  backupLastSuccess?: string;
  backupLastStatus?: 'success' | 'failed';
  backupLastSummary?: string;
  layoutStyle: 'standard' | 'compact' | 'touch';
  lowStockThreshold: number;
  expiryWarningDays: number;
  notificationsEnabled?: boolean;
  notifyInventory: boolean;
  notifyExpiry: boolean;
  notifySync: boolean;
  notifySale: boolean;
  notifySystem: boolean;
  enableDesktopNotifications: boolean;
  deviceId: string;
  deviceName: string;
  syncRole: 'server' | 'client' | 'peer';
  syncServerUrl: string;
  autoSyncIntervalSec: number;
  syncMode?: 'main' | 'secondary';
  mainPcIp?: string;
  // Stable per-installation id (not the user-editable deviceName) used to tell which
  // physical PC a login session belongs to, so the same account isn't used on two PCs at once.
  deviceInstanceId?: string;
  // VAT configuration
  vatRates?: Record<ProductCategory, number>;
}

export type SyncStatus = 'offline' | 'connecting' | 'connected' | 'error';


export interface SyncConflictLog {
  id: string;
  timestamp: number;
  entityType: 'product' | 'sale' | 'customer';
  entityId: string;
  targetCode?: string;
  localVersion: number;
  remoteVersion: number;
  resolution: 'local_applied' | 'remote_applied' | 'merged';
  details: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'inventory' | 'expiry' | 'sync' | 'sale' | 'system';
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

export type LogComponent =
  | 'POS / Sale'
  | 'Inventory / Stock'
  | 'Purchases'
  | 'Sync / Network'
  | 'Auth / Security'
  | 'Scientifics'
  | 'System';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface AppLogEntry {
  id: string;
  timestamp: number;
  component: LogComponent;
  action: string;
  level: LogLevel;
  title: string;
  description: string;
  user: {
    id?: string;
    name: string;
    role: string;
    username?: string;
  };
  device?: string;
  entityId?: string;
  entityType?: 'product' | 'sale' | 'purchase' | 'supplier' | 'customer' | 'user' | 'system' | 'sync';
  details?: Record<string, any>;
}

export type RibbonTab =
  | 'dashboard'
  | 'sale'
  | 'stock'
  | 'purchase'
  | 'supplier'
  | 'customer'
  | 'finance'
  | 'reports'
  | 'scientifics'
  | 'logs'
  | 'settings'
  | 'adjustments'
  | 'finance';
