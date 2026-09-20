import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Minus,
  DollarSign,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  FileText,
  UserCheck
} from 'lucide-react';
import { CashDrawerOpType, CashDrawerCategory } from '../../types/cashDrawer';
import { addCashDrawerManualTransaction } from '../../services/cashDrawerService';
import { formatLBPValue } from '../../utils/priceUtils';

interface CashDrawerFundModalProps {
  isOpen: boolean;
  initialType?: CashDrawerOpType;
  currentDrawerUSD: number;
  currentDrawerLBP: number;
  currentUserName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CashDrawerFundModal: React.FC<CashDrawerFundModalProps> = ({
  isOpen,
  initialType = 'IN',
  currentDrawerUSD,
  currentDrawerLBP,
  currentUserName,
  onClose,
  onSuccess,
}) => {
  const [type, setType] = useState<CashDrawerOpType>(initialType);
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'LBP' | 'BOTH'>('USD');
  const [amountUSD, setAmountUSD] = useState<string>('');
  const [amountLBP, setAmountLBP] = useState<string>('');
  const [category, setCategory] = useState<CashDrawerCategory>(
    initialType === 'IN' ? 'starting_float' : 'daily_expense'
  );
  const [reason, setReason] = useState<string>('');
  const [performedBy, setPerformedBy] = useState<string>(currentUserName || 'Cashier');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync initial type when opened
  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setCategory(initialType === 'IN' ? 'starting_float' : 'daily_expense');
      setAmountUSD('');
      setAmountLBP('');
      setReason('');
      setErrorMsg(null);
      if (currentUserName) setPerformedBy(currentUserName);
    }
  }, [isOpen, initialType, currentUserName]);

  // When type toggles, reset category
  const handleTypeChange = (newType: CashDrawerOpType) => {
    setType(newType);
    setCategory(newType === 'IN' ? 'starting_float' : 'daily_expense');
    setErrorMsg(null);
  };

  if (!isOpen) return null;

  const parsedUSD = parseFloat(amountUSD) || 0;
  const parsedLBP = parseFloat(amountLBP) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (parsedUSD <= 0 && parsedLBP <= 0) {
      setErrorMsg('Please enter an amount in USD or LBP.');
      return;
    }

    if (type === 'OUT') {
      if (parsedUSD > currentDrawerUSD && currentDrawerUSD > 0) {
        const proceed = window.confirm(
          `Warning: Withdrawing $${parsedUSD.toFixed(2)} exceeds the current estimated drawer balance of $${currentDrawerUSD.toFixed(2)}. Continue anyway?`
        );
        if (!proceed) return;
      }
      if (parsedLBP > currentDrawerLBP && currentDrawerLBP > 0) {
        const proceed = window.confirm(
          `Warning: Withdrawing ${formatLBPValue(parsedLBP)} L.L. exceeds the current estimated drawer balance of ${formatLBPValue(currentDrawerLBP)} L.L. Continue anyway?`
        );
        if (!proceed) return;
      }
    }

    try {
      addCashDrawerManualTransaction({
        type,
        category,
        amountUSD: parsedUSD,
        amountLBP: parsedLBP,
        reason: reason.trim() || (type === 'IN' ? 'Cash Addition to Drawer' : 'Cash Withdrawal from Drawer'),
        performedBy: performedBy.trim() || 'Cashier',
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to record cash drawer transaction.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${
          type === 'IN'
            ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/30'
            : 'border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/30'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${
              type === 'IN'
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
            }`}>
              {type === 'IN' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                {type === 'IN' ? 'Add Funds to Cash Drawer' : 'Remove Funds from Cash Drawer'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {type === 'IN'
                  ? 'Deposit cash, add float, or replenish physical drawer'
                  : 'Record expenses, payouts, bank deposits, or owner drawings'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Operation Type Switcher */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Operation Direction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('IN')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  type === 'IN'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Add Funds (Cash In)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('OUT')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  type === 'OUT'
                    ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ring-2 ring-rose-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Minus className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <span>Remove Funds (Cash Out)</span>
              </button>
            </div>
          </div>

          {/* Current Drawer Status Glance */}
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/50 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Estimated Drawer Balance:</span>
            <div className="flex items-center gap-3 font-mono font-bold">
              <span className="text-emerald-600 dark:text-emerald-400">${currentDrawerUSD.toFixed(2)}</span>
              <span className="text-slate-400">•</span>
              <span className="text-blue-600 dark:text-blue-400">{formatLBPValue(currentDrawerLBP)} L.L.</span>
            </div>
          </div>

          {/* Currency Selection & Amounts */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Amount to {type === 'IN' ? 'Add' : 'Remove'}
              </label>
              <div className="flex rounded border border-slate-200 bg-slate-100 p-0.5 text-[10px] font-bold dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrencyMode('USD')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${currencyMode === 'USD' ? 'bg-white shadow-2xs text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyMode('LBP')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${currencyMode === 'LBP' ? 'bg-white shadow-2xs text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}
                >
                  LBP (L.L.)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyMode('BOTH')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${currencyMode === 'BOTH' ? 'bg-white shadow-2xs text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}
                >
                  Both
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {(currencyMode === 'USD' || currencyMode === 'BOTH') && (
                <div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00 USD"
                      value={amountUSD}
                      onChange={(e) => setAmountUSD(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-12 text-sm font-bold text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-bold text-slate-400">
                      USD
                    </div>
                  </div>
                  {/* Quick pills */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[10, 20, 50, 100, 200].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmountUSD(String(val))}
                        className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                      >
                        +${val}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(currencyMode === 'LBP' || currencyMode === 'BOTH') && (
                <div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Coins className="h-4 w-4" />
                    </div>
                    <input
                      type="number"
                      step="500"
                      min="0"
                      placeholder="0 L.L."
                      value={amountLBP}
                      onChange={(e) => setAmountLBP(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-12 text-sm font-bold text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-bold text-slate-400">
                      L.L.
                    </div>
                  </div>
                  {/* Quick pills */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[1000000, 2000000, 5000000, 10000000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmountLBP(String(val))}
                        className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                      >
                        +{val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}k`} L.L.
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Category / Purpose
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CashDrawerCategory)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {type === 'IN' ? (
                <>
                  <option value="starting_float">Starting Float / Opening Balance</option>
                  <option value="cash_replenishment">Cash Drawer Replenishment (Small Bills)</option>
                  <option value="owner_deposit">Owner Capital Injection / Deposit</option>
                  <option value="other_inflow">Other Cash Deposit / Inflow</option>
                </>
              ) : (
                <>
                  <option value="daily_expense">Daily Operational / Utility Expense</option>
                  <option value="generator_fuel">Generator / Electricity / Fuel Fee</option>
                  <option value="bank_deposit">Bank Deposit (Cash Removal to Bank)</option>
                  <option value="owner_withdrawal">Owner Draw / Personal Withdrawal</option>
                  <option value="delivery_fee">Delivery / Courier Fee</option>
                  <option value="staff_advance">Staff Advance / Pocket Expense</option>
                  <option value="other_outflow">Other Cash Payout / Outflow</option>
                </>
              )}
            </select>
          </div>

          {/* Reason / Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Description / Voucher Notes
            </label>
            <textarea
              rows={2}
              placeholder={type === 'IN' ? 'e.g. Added 5 x $20 bills and 5M LBP change...' : 'e.g. Paid neighborhood generator bill $120 for September...'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Performed By */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5 text-teal-600" />
              <span>Authorized Staff Member</span>
            </label>
            <input
              type="text"
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
              placeholder="Staff / Cashier Name"
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-semibold text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-bold text-white shadow-xs cursor-pointer transition-all ${
                type === 'IN'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {type === 'IN' ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              <span>{type === 'IN' ? 'Confirm Cash Inflow' : 'Confirm Cash Outflow'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
