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

export interface MoleculeStrength {
  name: string;
  strength: string;
}

export interface Product {
  id: string;
  code: string;
  barcode?: string;
  name: string;
  category: ProductCategory;
  subcategory?: string; // Subclassification (e.g. "Baby Products" for para, "Vitamin D Supplements" for vitamins)
  ingredients: string;
  dosage: string;
  molecules?: MoleculeStrength[]; // Structured list of active ingredients/molecules with their own strength
  presentation: string;
  form: string;
  isDivisible?: boolean; // Whether the product can be sold in pieces
  piecesPerBox?: number; // Number of pieces in a box
  pieceName?: string; // Name of the piece (e.g. sachet, ampoule)
  pieceBarcode?: string; // Optional barcode assigned to an individual piece (blank if none)
  piecePriceUSD?: number; // Price of 1 piece in USD
  piecePriceLBP?: number; // Price of 1 piece in LBP
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

export interface ParkedSale {
  id: string;
  timestamp: number;
  label?: string;
  customerId?: string;
  customerName?: string;
  isUnreal?: boolean;
  items: CartItem[];
  tenderedUSD: string;
  tenderedLBP: string;
  paymentMethod: 'cash_lbp' | 'cash_usd' | 'mixed' | 'credit_debt';
  totalUSD: number;
  totalLBP: number;
  totalItems: number;
  notes?: string;
}

export interface SaleTransaction {
  id: string;
  invoiceNumber: string;
  receiptNumber?: string;
  date: string; // ISO string
  timestamp: number;
  invoices?: string[];
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
  retainedUSD?: number;
  retainedLBP?: number;
  notes?: string;
  synced: boolean;
  isUnreal?: boolean;
}

export interface PurchaseItem {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPriceUSD?: number;
  unitPriceLBP?: number;
  unitCostUSD: number;
  unitCostLBP: number;
  sellingPriceLBP: number;
  sellingPriceUSD?: number;
  discount?: number;
  batchNumber: string;
  expiryDate: string;
  isPiece?: boolean;
  freeQty?: number;
  vatRate?: number;
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
  invoices?: string[];
  currency?: 'USD' | 'LBP';
  invoiceDiscount?: number;
  invoiceDiscountAmount?: number;
  totalOverride?: number;
  paidAmountUSD?: number;
  paidAmountLBP?: number;
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
  enableLowStockAlerts?: boolean;
  lowStockThreshold: number;
  enableExpiryAlerts?: boolean;
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
  customCategories?: string[];
  customGlobalSubcategories?: string[];
  customForms?: string[];
  customPresentations?: string[];
  invoiceTemplate?: {
    enabled: boolean;
    headerEnglish: {
      pharmacyName: string;
      pharmacistName: string;
      amendedDegreeNo: string;
      orderRegNo: string;
      cnssNo: string;
      address: string;
      tel: string;
    };
    headerArabic: {
      pharmacyName: string;
      pharmacistName: string;
      amendedDegreeNo: string;
      orderRegNo: string;
      cnssNo?: string;
      address: string;
      tel: string;
    };
    centerInfo: {
      vatNo: string;
      no: string;
    };
  };
}

export type SyncStatus = 'offline' | 'connecting' | 'connected' | 'error';


export interface SyncConflictLog {
  id: string;
  timestamp: number;
  invoices?: string[];
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
  invoices?: string[];
  read: boolean;
  actionUrl?: string;
}

export type LogComponent =
  | 'POS / Sale'
  | 'Inventory / Stock'
  | 'Purchases'
  | 'Customers / Patients'
  | 'Finance / Expenses'
  | 'Sync / Network'
  | 'Auth / Security'
  | 'Scientifics'
  | 'System';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface AppLogEntry {
  id: string;
  timestamp: number;
  invoices?: string[];
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
  entityType?: 'product' | 'sale' | 'purchase' | 'supplier' | 'customer' | 'user' | 'system' | 'sync' | 'expense';
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
  | 'adjustments';

export interface CustomerPayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: 'USD' | 'LBP' | 'MIXED';
  method: 'cash' | 'card';
  paymentNumber?: string;
  notes?: string;
  amountUSD?: number;
  amountLBP?: number;
  date: string;
  timestamp: number;
  invoices?: string[];
  isPaymentOnAccount?: boolean;
}

export type PaymentFundingSource = 'drawer' | 'outside' | 'mixed';

export interface SupplierPayment {
  id: string;
  receiptNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  currency: 'USD' | 'LBP' | 'MIXED';
  amountUSD?: number;
  amountLBP?: number;
  invoices: string[]; // IDs of purchase invoices this payment applies to
  allocations?: { invoiceId: string, amountUSD: number, amountLBP: number }[];
  isPaymentOnAccount: boolean;
  timestamp: number;
  // Funding source details
  fundingSource?: PaymentFundingSource; // 'drawer' | 'outside' | 'mixed' (defaults to 'drawer')
  drawerAmountUSD?: number;
  drawerAmountLBP?: number;
  outsideAmountUSD?: number;
  outsideAmountLBP?: number;
  outsideSourceNote?: string;
}

export interface PurchaseReturnItem {
  productId: string;
  productCode?: string;
  barcode?: string;
  name: string;
  productName?: string;
  form?: string;
  dosage?: string;
  quantity: number; // packs returned
  unitCostUSD: number;
  unitCostLBP: number;
  oldExpiryDate?: string;
  oldBatchNumber?: string;
  // For 'replace_expiry' resolution:
  newExpiryDate?: string;
  newBatchNumber?: string;
  replacementQuantity?: number; // replacement packs received
  totalUSD?: number;
  totalLBP?: number;
  refundAmountUSD?: number;
  refundAmountLBP?: number;
  reason?: string;
}

export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  originalInvoiceNumber?: string;
  returnType: 'cash_refund' | 'replace_expiry'; // Return for Cash vs Replace with New Expiry
  items: PurchaseReturnItem[];
  totalRefundUSD: number;
  totalRefundLBP: number;
  exchangeRate: number;
  currency?: 'USD' | 'LBP' | 'MIXED';
  status?: 'completed' | 'pending';
  cashReceivedUSD?: number;
  cashReceivedLBP?: number;
  reason?: string;
  notes?: string;
  timestamp: number;
  synced?: boolean;
}

export type ExpenseCategory =
  | 'rent'
  | 'electricity'
  | 'salaries'
  | 'generator_fuel'
  | 'maintenance'
  | 'cleaning_supplies'
  | 'taxes_government'
  | 'internet_telecom'
  | 'transport_delivery'
  | 'marketing_promo'
  | 'professional_services'
  | 'other';

export interface Expense {
  id: string;
  expenseNumber: string; // e.g. EXP-26-001
  date: string;          // ISO string
  title: string;         // Brief descriptive name
  category: ExpenseCategory;
  categoryLabel?: string;
  payee?: string;        // Landlord, Électricité du Liban, Employee Name, etc.
  amount: number;
  currency: 'USD' | 'LBP' | 'MIXED';
  amountUSD: number;
  amountLBP: number;
  exchangeRate: number;
  paidFromDrawer: boolean; // If true, deducted from Cash Drawer Ledger
  paidBy?: string;       // Cashier or Pharmacist who authorized / disbursed
  receiptRef?: string;   // Receipt/Invoice number from the payee
  notes?: string;
  timestamp: number;
  synced?: boolean;
}

export type SaleRefundMethod = 'cash_drawer' | 'customer_credit' | 'no_refund';

export interface SaleReturnItem {
  productId: string;
  productCode: string;
  productName: string;
  category?: ProductCategory;
  barcode?: string;
  quantity: number; // units/boxes returned
  isPiece?: boolean;
  unitPriceUSD: number;
  unitPriceLBP: number;
  totalUSD: number;
  totalLBP: number;
  selectedBatchNumber?: string;
  selectedExpiryDate?: string;
  batchNumber?: string;
  expiryDate?: string;
  totalRefundUSD?: number;
  totalRefundLBP?: number;
  condition?: 'good' | 'damaged' | 'expired';
  reason?: string;
}

export interface SaleReturn {
  id: string;
  returnNumber: string; // e.g. SRET-2026-0001
  date: string;         // ISO date string
  timestamp: number;
  originalSaleId?: string;
  originalInvoiceNumber?: string;
  originalSaleInvoiceNumber?: string;
  customerId?: string;
  customerName?: string;
  items: SaleReturnItem[];
  totalRefundUSD: number;
  totalRefundLBP: number;
  refundCurrency?: 'USD' | 'LBP' | 'MIXED';
  currency?: 'USD' | 'LBP' | 'MIXED';
  refundMethod: SaleRefundMethod; // cash_drawer (deducted from drawer), customer_credit (credit customer debt balance), no_refund
  refundedUSD?: number; // actual cash refunded in USD from drawer
  refundedLBP?: number; // actual cash refunded in LBP from drawer
  creditAmountUSD?: number; // amount applied to reduce customer balance
  creditAmountLBP?: number;
  reason?: string;
  notes?: string;
  cashierName?: string;
  receivedBy?: string;
  synced?: boolean;
}

