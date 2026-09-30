import Papa from 'papaparse';
import {
  SaleTransaction,
  PurchaseInvoice,
  PurchaseReturn,
  SaleReturn,
  SupplierPayment,
  CustomerPayment,
  Expense,
} from '../types/pharmacy';
import { escapeCsvCell } from './stockCsvExport';

export type SectionKey =
  | 'sales'
  | 'purchases'
  | 'purchaseReturns'
  | 'saleReturns'
  | 'supplierPayments'
  | 'customerPayments'
  | 'expenses';

export const SECTION_HEADERS: Record<SectionKey, string[]> = {
  sales: [
    'id', 'invoiceNumber', 'receiptNumber', 'date', 'timestamp', 'customerId', 'customerName',
    'cashierId', 'cashierName', 'paymentMethod', 'totalUSD', 'totalLBP', 'exchangeRate',
    'amountPaidUSD', 'amountPaidLBP', 'changeGivenUSD', 'changeGivenLBP', 'writeOffUSD',
    'writeOffLBP', 'retainedUSD', 'retainedLBP', 'notes', 'isUnreal', 'pointsEarned',
    'pointsRedeemed', 'pointsDiscountUSD', 'pointsDiscountLBP', 'items',
  ],
  purchases: [
    'id', 'invoiceNumber', 'supplierId', 'supplierName', 'date', 'timestamp', 'status', 'paid',
    'currency', 'totalCostUSD', 'totalCostLBP', 'exchangeRate', 'invoiceDiscount',
    'invoiceDiscountAmount', 'totalOverride', 'paidAmountUSD', 'paidAmountLBP', 'invoices', 'items',
  ],
  purchaseReturns: [
    'id', 'returnNumber', 'date', 'timestamp', 'supplierId', 'supplierName', 'originalInvoiceNumber',
    'returnType', 'status', 'currency', 'totalRefundUSD', 'totalRefundLBP', 'exchangeRate',
    'cashReceivedUSD', 'cashReceivedLBP', 'reason', 'notes', 'items',
  ],
  saleReturns: [
    'id', 'returnNumber', 'date', 'timestamp', 'originalSaleId', 'originalInvoiceNumber',
    'originalSaleInvoiceNumber', 'customerId', 'customerName', 'totalRefundUSD', 'totalRefundLBP',
    'refundCurrency', 'currency', 'refundMethod', 'refundedUSD', 'refundedLBP', 'creditAmountUSD',
    'creditAmountLBP', 'reason', 'notes', 'cashierName', 'receivedBy', 'items',
  ],
  supplierPayments: [
    'id', 'receiptNumber', 'date', 'timestamp', 'supplierId', 'supplierName', 'amount', 'currency',
    'amountUSD', 'amountLBP', 'isPaymentOnAccount', 'fundingSource', 'drawerAmountUSD',
    'drawerAmountLBP', 'outsideAmountUSD', 'outsideAmountLBP', 'outsideSourceNote', 'invoices',
    'allocations',
  ],
  customerPayments: [
    'id', 'customerId', 'customerName', 'amount', 'currency', 'method', 'paymentNumber', 'notes',
    'amountUSD', 'amountLBP', 'date', 'timestamp', 'isPaymentOnAccount', 'invoices',
  ],
  expenses: [
    'id', 'expenseNumber', 'date', 'timestamp', 'title', 'category', 'categoryLabel', 'payee',
    'amount', 'currency', 'amountUSD', 'amountLBP', 'exchangeRate', 'paidFromDrawer', 'paidBy',
    'receiptRef', 'notes',
  ],
};

const SECTION_FILE_NAME: Record<SectionKey, string> = {
  sales: 'sales',
  purchases: 'purchases',
  purchaseReturns: 'purchase-returns',
  saleReturns: 'sale-returns',
  supplierPayments: 'supplier-payments',
  customerPayments: 'customer-payments',
  expenses: 'expenses',
};

function jsonCell(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value) && value.length === 0) return '';
  return JSON.stringify(value);
}

function opt(value: string | undefined): string {
  const v = (value ?? '').trim();
  return v;
}

function num(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function numRequired(value: unknown, fallback: number): number {
  const n = num(value);
  return n !== undefined ? n : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  if (value == null) return fallback;
  const v = String(value).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === '') return false;
  return fallback;
}

function strArr(value: unknown): string[] {
  if (value == null) return [];
  const v = String(value).trim();
  if (!v) return [];
  if (v.startsWith('[')) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* fall through to splitting */
    }
  }
  return v.split('|').map((s) => s.trim()).filter(Boolean);
}

function parseJsonArray<T>(value: unknown): T[] {
  if (value == null) return [];
  const v = String(value).trim();
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed as T[];
  } catch {
    /* ignore malformed json cells */
  }
  return [];
}

/**
 * Coerces one raw entry from a sale's `items` JSON cell into the
 * `SaleTransaction['items']` shape.
 *
 * Every other field in a parsed row is defensively normalised (opt/num/bool), but `items`
 * used to be cast straight through, so a hand-written or third-party CSV that used different
 * key names (`code`/`name`/`priceUSD`) produced a sale whose items did not satisfy the type
 * the rest of the app reads. The consequences were real: EditSaleModal threw
 * "Cannot read properties of undefined (reading 'toFixed')" on open, and itemised reports
 * rendered blanks. Aliases are accepted, numeric fields are defaulted, and a missing line
 * total is derived from unit price x quantity so the figures still add up.
 */
function normalizeSaleItem(raw: unknown): SaleTransaction['items'][number] {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const quantity = numRequired(r['quantity'] ?? r['qty'], 0);
  const unitPriceUSD = numRequired(r['unitPriceUSD'] ?? r['priceUSD'] ?? r['unitPrice'] ?? r['price'], 0);
  // Derive the LBP unit price from the line total when only the total was supplied, so an
  // imported sale still prices correctly in LBP instead of showing 0.
  const totalLBP = num(r['totalLBP']) ?? num(r['total_lbp']);
  const unitPriceLBP = numRequired(
    r['unitPriceLBP'] ?? r['priceLBP'] ?? r['unit_price_lbp'],
    quantity > 0 && totalLBP !== undefined ? totalLBP / quantity : 0
  );
  const totalUSD = numRequired(r['totalUSD'] ?? r['total_usd'], Number((unitPriceUSD * quantity).toFixed(2)));

  return {
    productId: opt(String(r['productId'] ?? r['id'] ?? '')) || 'unknown',
    productCode: opt(String(r['productCode'] ?? r['code'] ?? r['sku'] ?? '')),
    productName: opt(String(r['productName'] ?? r['name'] ?? '')) || 'Unknown Item',
    category: (opt(String(r['category'] ?? '')) || 'drug') as SaleTransaction['items'][number]['category'],
    quantity,
    discountPercent: num(r['discountPercent']),
    unitPriceUSD,
    unitPriceLBP,
    costPriceUSD: numRequired(r['costPriceUSD'] ?? r['costPrice'] ?? r['costUSD'] ?? r['cost'], 0),
    totalUSD,
    totalLBP: totalLBP ?? Math.round(unitPriceLBP * quantity),
    isPiece: bool(r['isPiece'], false),
    selectedBatchNumber: opt(String(r['selectedBatchNumber'] ?? '')) || undefined,
    selectedExpiryDate: opt(String(r['selectedExpiryDate'] ?? '')) || undefined,
    // parseJsonArray stringifies before JSON.parse, so handing it an already-parsed array
    // would yield "[object Object]" and silently drop the batches. Accept either form.
    batches: (Array.isArray(r['batches']) ? r['batches'] : parseJsonArray<Record<string, unknown>>(r['batches'])).map((b) => {
      const bb = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
      return {
        batchNumber: opt(String(bb['batchNumber'] ?? '')),
        expiryDate: opt(String(bb['expiryDate'] ?? '')),
        quantity: numRequired(bb['quantity'], 0),
      };
    }),
  };
}

function timestamp(value: unknown): number {
  const n = num(value);
  if (n !== undefined) return n;
  const d = opt(String(value ?? ''));
  if (!d) return Date.now();
  const parsed = Date.parse(d);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function localeDate(value: unknown): string {
  const v = opt(String(value ?? ''));
  if (!v) return new Date().toISOString().slice(0, 10);
  // Keep plain YYYY-MM-DD as written; only normalize a raw mm/dd/yyyy into YYYY-MM-DD.
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return v;
}

function headerRow(record: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) {
    out[k.trim().toLowerCase()] = v == null ? '' : String(v);
  }
  return out;
}

export function exportSectionCsv(section: SectionKey, records: unknown[]): string {
  const headers = SECTION_HEADERS[section];
  const rows: string[][] = [];

  for (const raw of records) {
    const r = raw as Record<string, unknown>;
    let row: string[];
    switch (section) {
      case 'sales':
        row = [
          opt(String(r.id ?? '')), opt(String(r.invoiceNumber ?? '')), opt(String(r.receiptNumber ?? '')),
          localeDate(r.date), String(timestamp(r.timestamp)), opt(String(r.customerId ?? '')),
          opt(String(r.customerName ?? '')), opt(String(r.cashierId ?? '')), opt(String(r.cashierName ?? '')),
          opt(String(r.paymentMethod ?? '')), String(numRequired(r.totalUSD, 0)), String(numRequired(r.totalLBP, 0)),
          String(numRequired(r.exchangeRate, 0)), String(numRequired(r.amountPaidUSD, 0)),
          String(numRequired(r.amountPaidLBP, 0)), String(numRequired(r.changeGivenUSD, 0)),
          String(numRequired(r.changeGivenLBP, 0)), String(num(r.writeOffUSD) ?? ''), String(num(r.writeOffLBP) ?? ''),
          String(num(r.retainedUSD) ?? ''), String(num(r.retainedLBP) ?? ''), opt(String(r.notes ?? '')),
          String(bool(r.isUnreal, false)), String(num(r.pointsEarned) ?? ''), String(num(r.pointsRedeemed) ?? ''),
          String(num(r.pointsDiscountUSD) ?? ''), String(num(r.pointsDiscountLBP) ?? ''), jsonCell(r.items),
        ];
        break;
      case 'purchases':
        row = [
          opt(String(r.id ?? '')), opt(String(r.invoiceNumber ?? '')), opt(String(r.supplierId ?? '')),
          opt(String(r.supplierName ?? '')), localeDate(r.date), String(timestamp(r.timestamp)),
          opt(String(r.status ?? 'received')), String(bool(r.paid, false)), opt(String(r.currency ?? '')),
          String(numRequired(r.totalCostUSD, 0)), String(numRequired(r.totalCostLBP, 0)),
          String(numRequired(r.exchangeRate, 0)), String(num(r.invoiceDiscount) ?? ''),
          String(num(r.invoiceDiscountAmount) ?? ''), String(num(r.totalOverride) ?? ''),
          String(num(r.paidAmountUSD) ?? ''), String(num(r.paidAmountLBP) ?? ''), jsonCell(r.invoices), jsonCell(r.items),
        ];
        break;
      case 'purchaseReturns':
        row = [
          opt(String(r.id ?? '')), opt(String(r.returnNumber ?? '')), localeDate(r.date), String(timestamp(r.timestamp)),
          opt(String(r.supplierId ?? '')), opt(String(r.supplierName ?? '')), opt(String(r.originalInvoiceNumber ?? '')),
          opt(String(r.returnType ?? 'cash_refund')), opt(String(r.status ?? 'completed')), opt(String(r.currency ?? '')),
          String(numRequired(r.totalRefundUSD, 0)), String(numRequired(r.totalRefundLBP, 0)),
          String(numRequired(r.exchangeRate, 0)), String(num(r.cashReceivedUSD) ?? ''), String(num(r.cashReceivedLBP) ?? ''),
          opt(String(r.reason ?? '')), opt(String(r.notes ?? '')), jsonCell(r.items),
        ];
        break;
      case 'saleReturns':
        row = [
          opt(String(r.id ?? '')), opt(String(r.returnNumber ?? '')), localeDate(r.date), String(timestamp(r.timestamp)),
          opt(String(r.originalSaleId ?? '')), opt(String(r.originalInvoiceNumber ?? '')),
          opt(String(r.originalSaleInvoiceNumber ?? '')), opt(String(r.customerId ?? '')), opt(String(r.customerName ?? '')),
          String(numRequired(r.totalRefundUSD, 0)), String(numRequired(r.totalRefundLBP, 0)),
          opt(String(r.refundCurrency ?? '')), opt(String(r.currency ?? '')), opt(String(r.refundMethod ?? 'cash_drawer')),
          String(num(r.refundedUSD) ?? ''), String(num(r.refundedLBP) ?? ''), String(num(r.creditAmountUSD) ?? ''),
          String(num(r.creditAmountLBP) ?? ''), opt(String(r.reason ?? '')), opt(String(r.notes ?? '')),
          opt(String(r.cashierName ?? '')), opt(String(r.receivedBy ?? '')), jsonCell(r.items),
        ];
        break;
      case 'supplierPayments':
        row = [
          opt(String(r.id ?? '')), opt(String(r.receiptNumber ?? '')), localeDate(r.date), String(timestamp(r.timestamp)),
          opt(String(r.supplierId ?? '')), opt(String(r.supplierName ?? '')), String(numRequired(r.amount, 0)),
          opt(String(r.currency ?? 'LBP')), String(num(r.amountUSD) ?? ''), String(num(r.amountLBP) ?? ''),
          String(bool(r.isPaymentOnAccount, false)), opt(String(r.fundingSource ?? '')),
          String(num(r.drawerAmountUSD) ?? ''), String(num(r.drawerAmountLBP) ?? ''),
          String(num(r.outsideAmountUSD) ?? ''), String(num(r.outsideAmountLBP) ?? ''),
          opt(String(r.outsideSourceNote ?? '')), jsonCell(r.invoices), jsonCell(r.allocations),
        ];
        break;
      case 'customerPayments':
        row = [
          opt(String(r.id ?? '')), opt(String(r.customerId ?? '')), opt(String(r.customerName ?? '')),
          String(numRequired(r.amount, 0)), opt(String(r.currency ?? 'LBP')), opt(String(r.method ?? 'cash')),
          opt(String(r.paymentNumber ?? '')), opt(String(r.notes ?? '')), String(num(r.amountUSD) ?? ''),
          String(num(r.amountLBP) ?? ''), localeDate(r.date), String(timestamp(r.timestamp)),
          String(bool(r.isPaymentOnAccount, false)), jsonCell(r.invoices),
        ];
        break;
      case 'expenses':
        row = [
          opt(String(r.id ?? '')), opt(String(r.expenseNumber ?? '')), localeDate(r.date), String(timestamp(r.timestamp)),
          opt(String(r.title ?? '')), opt(String(r.category ?? 'other')), opt(String(r.categoryLabel ?? '')),
          opt(String(r.payee ?? '')), String(numRequired(r.amount, 0)), opt(String(r.currency ?? 'LBP')),
          String(numRequired(r.amountUSD, 0)), String(numRequired(r.amountLBP, 0)),
          String(numRequired(r.exchangeRate, 0)), String(bool(r.paidFromDrawer, false)),
          opt(String(r.paidBy ?? '')), opt(String(r.receiptRef ?? '')), opt(String(r.notes ?? '')),
        ];
        break;
    }
    rows.push(row.map(escapeCsvCell));
  }

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

export function downloadSectionCsv(csvContent: string, section: SectionKey): void {
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pharmalebanon-${SECTION_FILE_NAME[section]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type SectionImportResult = {
  success: boolean;
  importedCount: number;
  // Rows whose id already existed and whose timestamp was not newer than the stored copy,
  // so the stored copy was kept instead of being overwritten.
  skippedCount: number;
  errors: string[];
};

export function parseSectionCsv(section: SectionKey, csvText: string): { records: SaleTransaction[] | PurchaseInvoice[] | PurchaseReturn[] | SaleReturn[] | SupplierPayment[] | CustomerPayment[] | Expense[]; errors: string[] } {
  const errors: string[] = [];
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    quoteChar: '"',
    escapeChar: '"',
  });

  if (parsed.errors && parsed.errors.length > 0) {
    for (const err of parsed.errors.slice(0, 20)) {
      errors.push(`CSV line ${err.row !== undefined ? err.row + 1 : '?'}: ${err.message}`);
    }
  }

  const rows = (parsed.data || []).map(headerRow).filter((r) => Object.keys(r).length > 0 && Object.values(r).some((v) => v.trim() !== ''));

  const records: SaleTransaction[] | PurchaseInvoice[] | PurchaseReturn[] | SaleReturn[] | SupplierPayment[] | CustomerPayment[] | Expense[] = [];

  for (let i = 0; i < rows.length; i++) {
    const h = rows[i];
    const line = i + 2;
    const id = opt(h['id']) || `${section}-import-${Date.now()}-${i}`;
    const missingId = !opt(rawId(h));
    const items = parseJsonArray<any>(h['items']);
    // Only sales are normalised: their items are read as SaleTransaction['items'] by the POS,
    // the edit modal and itemised reports, all of which require the canonical keys. The other
    // three sections keep their own item shapes and are left exactly as they were.
    const saleItems = items.map(normalizeSaleItem);

    switch (section) {
      case 'sales': {
        (records as SaleTransaction[]).push({
          id,
          invoiceNumber: opt(h['invoicenumber']) || opt(h['invoiceno']) || id,
          receiptNumber: opt(h['receiptnumber']) || undefined,
          date: localeDate(h['date']),
          timestamp: timestamp(h['timestamp']),
          items: saleItems,
          totalUSD: numRequired(h['totalusd'], 0),
          totalLBP: numRequired(h['totallbp'], 0),
          exchangeRate: numRequired(h['exchangerate'], 89500),
          customerId: opt(h['customerid']) || undefined,
          customerName: opt(h['customername']) || undefined,
          cashierId: opt(h['cashierid']) || 'import',
          cashierName: opt(h['cashiername']) || 'CSV Import',
          paymentMethod: (opt(h['paymentmethod']) as SaleTransaction['paymentMethod']) || 'cash_lbp',
          amountPaidUSD: numRequired(h['amountpaidusd'], numRequired(h['totalusd'], 0)),
          amountPaidLBP: numRequired(h['amountpaidlbp'], numRequired(h['totallbp'], 0)),
          changeGivenUSD: num(h['changegivenusd']) ?? 0,
          changeGivenLBP: num(h['changegivenlbp']) ?? 0,
          writeOffUSD: num(h['writeoffusd']),
          writeOffLBP: num(h['writeofflbp']),
          retainedUSD: num(h['retainedusd']),
          retainedLBP: num(h['retainedlbp']),
          notes: opt(h['notes']) || undefined,
          synced: false,
          isUnreal: bool(h['isunreal'], false),
          pointsEarned: num(h['pointsearned']),
          pointsRedeemed: num(h['pointsredeemed']),
          pointsDiscountUSD: num(h['pointsdiscountusd']),
          pointsDiscountLBP: num(h['pointsdiscountlbp']),
        });
        if (missingId) errors.push(`Line ${line}: missing "id" column for sale record (generated: ${id})`);
        break;
      }
      case 'purchases': {
        (records as PurchaseInvoice[]).push({
          id,
          invoiceNumber: opt(h['invoicenumber']) || id,
          supplierId: opt(h['supplierid']) || 'unknown',
          supplierName: opt(h['suppliername']) || 'Import',
          date: localeDate(h['date']),
          items: items.length > 0 ? items : [],
          totalCostUSD: numRequired(h['totalcostusd'], 0),
          totalCostLBP: numRequired(h['totalcostlbp'], 0),
          exchangeRate: numRequired(h['exchangerate'], 89500),
          status: (opt(h['status']) as PurchaseInvoice['status']) || 'received',
          paid: bool(h['paid'], false),
          timestamp: timestamp(h['timestamp']),
          invoices: strArr(h['invoices']),
          currency: (opt(h['currency']) as PurchaseInvoice['currency']) || undefined,
          invoiceDiscount: num(h['invoicediscount']),
          invoiceDiscountAmount: num(h['invoicediscountamount']),
          totalOverride: num(h['totaloverride']),
          paidAmountUSD: num(h['paidamountusd']),
          paidAmountLBP: num(h['paidamountlbp']),
        });
        if (missingId) errors.push(`Line ${line}: missing "id" column for purchase record (generated: ${id})`);
        break;
      }
      case 'purchaseReturns': {
        (records as PurchaseReturn[]).push({
          id,
          returnNumber: opt(h['returnnumber']) || id,
          date: localeDate(h['date']),
          supplierId: opt(h['supplierid']) || 'unknown',
          supplierName: opt(h['suppliername']) || 'Import',
          originalInvoiceNumber: opt(h['originalinvoicenumber']) || undefined,
          returnType: (opt(h['returntype']) as PurchaseReturn['returnType']) || 'cash_refund',
          items: items.length > 0 ? items : [],
          totalRefundUSD: numRequired(h['totalrefundusd'], 0),
          totalRefundLBP: numRequired(h['totalrefundlbp'], 0),
          exchangeRate: numRequired(h['exchangerate'], 89500),
          currency: (opt(h['currency']) as PurchaseReturn['currency']) || undefined,
          status: (opt(h['status']) as PurchaseReturn['status']) || 'completed',
          cashReceivedUSD: num(h['cashreceivedusd']),
          cashReceivedLBP: num(h['cashreceivedlbp']),
          reason: opt(h['reason']) || undefined,
          notes: opt(h['notes']) || undefined,
          timestamp: timestamp(h['timestamp']),
          synced: false,
        });
        if (missingId) errors.push(`Line ${line}: missing "id" column for purchase return record (generated: ${id})`);
        break;
      }
      case 'saleReturns': {
        (records as SaleReturn[]).push({
          id,
          returnNumber: opt(h['returnnumber']) || id,
          date: localeDate(h['date']),
          timestamp: timestamp(h['timestamp']),
          originalSaleId: opt(h['originalsaleid']) || undefined,
          originalInvoiceNumber: opt(h['originalinvoicenumber']) || undefined,
          originalSaleInvoiceNumber: opt(h['originalsaleinvoicenumber']) || undefined,
          customerId: opt(h['customerid']) || undefined,
          customerName: opt(h['customername']) || undefined,
          items: items.length > 0 ? items : [],
          totalRefundUSD: numRequired(h['totalrefundusd'], 0),
          totalRefundLBP: numRequired(h['totalrefundlbp'], 0),
          refundCurrency: (opt(h['refundcurrency']) as SaleReturn['refundCurrency']) || undefined,
          currency: (opt(h['currency']) as SaleReturn['currency']) || undefined,
          refundMethod: (opt(h['refundmethod']) as SaleReturn['refundMethod']) || 'cash_drawer',
          refundedUSD: num(h['refundedusd']),
          refundedLBP: num(h['refundedlbp']),
          creditAmountUSD: num(h['creditamountusd']),
          creditAmountLBP: num(h['creditamountlbp']),
          reason: opt(h['reason']) || undefined,
          notes: opt(h['notes']) || undefined,
          cashierName: opt(h['cashiername']) || undefined,
          receivedBy: opt(h['receivedby']) || undefined,
          synced: false,
        });
        if (missingId) errors.push(`Line ${line}: missing "id" column for sale return record (generated: ${id})`);
        break;
      }
      case 'supplierPayments': {
        const allocations = parseJsonArray<{ invoiceId: string; amountUSD: number; amountLBP: number }>(h['allocations']);
        (records as SupplierPayment[]).push({
          id,
          receiptNumber: opt(h['receiptnumber']) || id,
          date: localeDate(h['date']),
          supplierId: opt(h['supplierid']) || 'unknown',
          supplierName: opt(h['suppliername']) || 'Import',
          amount: numRequired(h['amount'], 0),
          currency: (opt(h['currency']) as SupplierPayment['currency']) || 'LBP',
          amountUSD: num(h['amountusd']),
          amountLBP: num(h['amountlbp']),
          invoices: strArr(h['invoices']),
          allocations: allocations.length > 0 ? allocations : undefined,
          isPaymentOnAccount: bool(h['ispaymentonaccount'], false),
          timestamp: timestamp(h['timestamp']),
          fundingSource: (opt(h['fundingsource']) as SupplierPayment['fundingSource']) || 'drawer',
          drawerAmountUSD: num(h['draweramountusd']),
          drawerAmountLBP: num(h['draweramountlbp']),
          outsideAmountUSD: num(h['outsideamountusd']),
          outsideAmountLBP: num(h['outsideamountlbp']),
          outsideSourceNote: opt(h['outsidesourcenote']) || undefined,
        });
        if (missingId) errors.push(`Line ${line}: missing "id" column for supplier payment record (generated: ${id})`);
        break;
      }
      case 'customerPayments': {
        (records as CustomerPayment[]).push({
          id,
          customerId: opt(h['customerid']) || 'unknown',
          customerName: opt(h['customername']) || 'Import',
          amount: numRequired(h['amount'], 0),
          currency: (opt(h['currency']) as CustomerPayment['currency']) || 'LBP',
          method: (opt(h['method']) as CustomerPayment['method']) || 'cash',
          paymentNumber: opt(h['paymentnumber']) || undefined,
          notes: opt(h['notes']) || undefined,
          amountUSD: num(h['amountusd']),
          amountLBP: num(h['amountlbp']),
          date: localeDate(h['date']),
          timestamp: timestamp(h['timestamp']),
          invoices: strArr(h['invoices']),
          isPaymentOnAccount: bool(h['ispaymentonaccount'], false),
        });
        if (missingId) errors.push(`Line ${line}: missing "id" column for customer payment record (generated: ${id})`);
        break;
      }
      case 'expenses': {
        (records as Expense[]).push({
          id,
          expenseNumber: opt(h['expensenumber']) || id,
          date: localeDate(h['date']),
          title: opt(h['title']) || 'Imported expense',
          category: (opt(h['category']) as Expense['category']) || 'other',
          categoryLabel: opt(h['categorylabel']) || undefined,
          payee: opt(h['payee']) || undefined,
          amount: numRequired(h['amount'], 0),
          currency: (opt(h['currency']) as Expense['currency']) || 'LBP',
          amountUSD: numRequired(h['amountusd'], 0),
          amountLBP: numRequired(h['amountlbp'], 0),
          exchangeRate: numRequired(h['exchangerate'], 89500),
          paidFromDrawer: bool(h['paidfromdrawer'], false),
          paidBy: opt(h['paidby']) || undefined,
          receiptRef: opt(h['receiptref']) || undefined,
          notes: opt(h['notes']) || undefined,
          timestamp: timestamp(h['timestamp']),
          synced: false,
        });
        if (missingId) errors.push(`Line ${line}: missing "id" column for expense record (generated: ${id})`);
        break;
      }
    }
  }

  if (records.length === 0 && rows.length > 0) {
    errors.push('No valid rows were recognized. Check the header row matches the expected column names.');
  }

  return { records, errors };
}

function rawId(h: Record<string, string>): string | undefined {
  return h['id'] && h['id'].trim() ? h['id'] : undefined;
}