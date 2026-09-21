export type CashDrawerOpType = 'IN' | 'OUT';

export type CashDrawerCategory =
  | 'pos_sale'
  | 'customer_debt_payment'
  | 'sale_return'
  | 'starting_float'
  | 'cash_replenishment'
  | 'owner_deposit'
  | 'supplier_payout'
  | 'bank_deposit'
  | 'owner_withdrawal'
  | 'daily_expense'
  | 'generator_fuel'
  | 'delivery_fee'
  | 'staff_advance'
  | 'operational_expense'
  | 'other_inflow'
  | 'other_outflow';

export interface ManualDrawerTransaction {
  id: string;
  voucherNumber: string;
  type: CashDrawerOpType;
  category: CashDrawerCategory;
  amountUSD: number;
  amountLBP: number;
  reason: string;
  performedBy: string;
  timestamp: number;
  date: string;
}

export interface CashDenominationCounts {
  usd: Record<string, number>;
  lbp: Record<string, number>;
}

export interface CashDrawerCountRecord {
  id: string;
  referenceNumber: string;
  type: 'spot_count' | 'shift_close';
  timestamp: number;
  date: string;
  performedBy: string;
  notes?: string;

  denominationsUSD: Record<string, number>;
  denominationsLBP: Record<string, number>;

  countedUSD: number;
  countedLBP: number;

  expectedUSD: number;
  expectedLBP: number;

  diffUSD: number;
  diffLBP: number;

  closingAction?: 'keep_as_is' | 'leave_float' | 'empty_to_safe';
  floatCarriedOverUSD?: number;
  floatCarriedOverLBP?: number;
  withdrawnToSafeUSD?: number;
  withdrawnToSafeLBP?: number;
}

export interface UnifiedCashDrawerEntry {
  id: string;
  timestamp: number;
  date: string;
  type: CashDrawerOpType;
  categoryLabel: string;
  categoryKey: CashDrawerCategory;
  referenceNumber: string;
  partyName?: string;
  amountUSD: number;
  amountLBP: number;
  performedBy: string;
  notes: string;
  source: 'pos_sale' | 'customer_payment' | 'supplier_payment' | 'manual' | 'expense' | 'sale_return';
  manualTxId?: string;
  runningBalanceUSD?: number;
  runningBalanceLBP?: number;
}
