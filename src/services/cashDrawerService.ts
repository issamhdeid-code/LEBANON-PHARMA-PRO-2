import { ManualDrawerTransaction, CashDrawerCountRecord } from '../types/cashDrawer';

const CASH_DRAWER_STORAGE_KEY = 'pharmalebanon_cash_drawer_manual_v1';
const CASH_DRAWER_COUNTS_STORAGE_KEY = 'pharmalebanon_cash_drawer_counts_v1';

const INITIAL_MANUAL_TRANSACTIONS: ManualDrawerTransaction[] = [
  {
    id: 'cd-init-float-1',
    voucherNumber: 'VCH-FLOAT-001',
    type: 'IN',
    category: 'starting_float',
    amountUSD: 200,
    amountLBP: 15000000,
    reason: 'Daily Opening Cash Drawer Float (Small bills & coins)',
    performedBy: 'Head Pharmacist',
    timestamp: new Date().setHours(8, 0, 0, 0),
    date: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
  },
];

export function getCashDrawerManualTransactions(): ManualDrawerTransaction[] {
  try {
    const raw = localStorage.getItem(CASH_DRAWER_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CASH_DRAWER_STORAGE_KEY, JSON.stringify(INITIAL_MANUAL_TRANSACTIONS));
      return INITIAL_MANUAL_TRANSACTIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Error reading cash drawer manual transactions from storage:', err);
    return [];
  }
}

export function saveCashDrawerManualTransactions(transactions: ManualDrawerTransaction[]): void {
  try {
    localStorage.setItem(CASH_DRAWER_STORAGE_KEY, JSON.stringify(transactions));
    window.dispatchEvent(new CustomEvent('cash_drawer_updated'));
  } catch (err) {
    console.error('Error saving cash drawer transactions to storage:', err);
  }
}

export function addCashDrawerManualTransaction(
  payload: Omit<ManualDrawerTransaction, 'id' | 'voucherNumber' | 'timestamp' | 'date'> & {
    timestamp?: number;
  }
): ManualDrawerTransaction {
  const current = getCashDrawerManualTransactions();
  const now = payload.timestamp || Date.now();
  const dateStr = new Date(now).toISOString();

  // Generate voucher number: VCH-YYYYMMDD-XXX
  const d = new Date(now);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const countToday = current.filter(t => t.date.startsWith(`${yyyy}-${mm}-${dd}`)).length + 1;
  const voucherNumber = `VCH-${yyyy}${mm}${dd}-${String(countToday).padStart(3, '0')}`;

  const newRecord: ManualDrawerTransaction = {
    id: `cd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    voucherNumber,
    type: payload.type,
    category: payload.category,
    amountUSD: Number(payload.amountUSD) || 0,
    amountLBP: Number(payload.amountLBP) || 0,
    reason: payload.reason.trim() || (payload.type === 'IN' ? 'Cash Addition' : 'Cash Withdrawal'),
    performedBy: payload.performedBy.trim() || 'Cashier',
    timestamp: now,
    date: dateStr,
  };

  const updated = [newRecord, ...current];
  saveCashDrawerManualTransactions(updated);
  return newRecord;
}

export function deleteCashDrawerManualTransaction(id: string): void {
  const current = getCashDrawerManualTransactions();
  const filtered = current.filter(t => t.id !== id);
  saveCashDrawerManualTransactions(filtered);
}

export function getCashDrawerCountRecords(): CashDrawerCountRecord[] {
  try {
    const raw = localStorage.getItem(CASH_DRAWER_COUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Error reading cash drawer counts from storage:', err);
    return [];
  }
}

export function saveCashDrawerCountRecords(records: CashDrawerCountRecord[]): void {
  try {
    localStorage.setItem(CASH_DRAWER_COUNTS_STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent('cash_drawer_counts_updated'));
  } catch (err) {
    console.error('Error saving cash drawer count records:', err);
  }
}

export function recordCashDrawerCount(
  record: Omit<CashDrawerCountRecord, 'id' | 'referenceNumber' | 'timestamp' | 'date'> & {
    timestamp?: number;
  }
): CashDrawerCountRecord {
  const existing = getCashDrawerCountRecords();
  const now = record.timestamp || Date.now();
  const dateStr = new Date(now).toISOString();

  const d = new Date(now);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const prefix = record.type === 'shift_close' ? 'CLS' : 'CNT';
  const countToday = existing.filter(r => r.date.startsWith(`${yyyy}-${mm}-${dd}`)).length + 1;
  const referenceNumber = `${prefix}-${yyyy}${mm}${dd}-${String(countToday).padStart(3, '0')}`;

  const newRecord: CashDrawerCountRecord = {
    ...record,
    id: `cnt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    referenceNumber,
    timestamp: now,
    date: dateStr,
  };

  const updated = [newRecord, ...existing];
  saveCashDrawerCountRecords(updated);
  return newRecord;
}

export function closeCashDrawerSession(params: {
  performedBy: string;
  notes?: string;
  denominationsUSD: Record<string, number>;
  denominationsLBP: Record<string, number>;
  countedUSD: number;
  countedLBP: number;
  expectedUSD: number;
  expectedLBP: number;
  closingAction: 'keep_as_is' | 'leave_float' | 'empty_to_safe';
  floatCarriedOverUSD?: number;
  floatCarriedOverLBP?: number;
}): CashDrawerCountRecord {
  const diffUSD = params.countedUSD - params.expectedUSD;
  const diffLBP = params.countedLBP - params.expectedLBP;

  let withdrawnToSafeUSD = 0;
  let withdrawnToSafeLBP = 0;

  if (params.closingAction === 'empty_to_safe') {
    withdrawnToSafeUSD = params.countedUSD;
    withdrawnToSafeLBP = params.countedLBP;
  } else if (params.closingAction === 'leave_float') {
    const floatUSD = params.floatCarriedOverUSD || 0;
    const floatLBP = params.floatCarriedOverLBP || 0;
    withdrawnToSafeUSD = Math.max(0, params.countedUSD - floatUSD);
    withdrawnToSafeLBP = Math.max(0, params.countedLBP - floatLBP);
  }

  // 1. Record the shift close count record
  const countRecord = recordCashDrawerCount({
    type: 'shift_close',
    performedBy: params.performedBy,
    notes: params.notes,
    denominationsUSD: params.denominationsUSD,
    denominationsLBP: params.denominationsLBP,
    countedUSD: params.countedUSD,
    countedLBP: params.countedLBP,
    expectedUSD: params.expectedUSD,
    expectedLBP: params.expectedLBP,
    diffUSD,
    diffLBP,
    closingAction: params.closingAction,
    floatCarriedOverUSD: params.floatCarriedOverUSD,
    floatCarriedOverLBP: params.floatCarriedOverLBP,
    withdrawnToSafeUSD,
    withdrawnToSafeLBP,
  });

  // 2. If money was swept to the safe, record Cash Out manual transaction
  if (withdrawnToSafeUSD > 0 || withdrawnToSafeLBP > 0) {
    addCashDrawerManualTransaction({
      type: 'OUT',
      category: 'bank_deposit',
      amountUSD: withdrawnToSafeUSD,
      amountLBP: withdrawnToSafeLBP,
      reason: `Shift Closeout [${countRecord.referenceNumber}] Cash transferred to Safe. Retained float: $${(params.floatCarriedOverUSD || 0).toFixed(2)} / ${Math.round(params.floatCarriedOverLBP || 0)} L.L.`,
      performedBy: params.performedBy,
    });
  }

  return countRecord;
}

