import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Calculator,
  Lock,
  DollarSign,
  Coins,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Save,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  Building2,
  FileText,
  UserCheck
} from 'lucide-react';
import { formatLBPValue } from '../../utils/priceUtils';
import {
  recordCashDrawerCount,
  closeCashDrawerSession
} from '../../services/cashDrawerService';
import { CashDrawerCountRecord } from '../../types/cashDrawer';

const USD_DENOMINATIONS = [
  { value: 100, label: '$100' },
  { value: 50, label: '$50' },
  { value: 20, label: '$20' },
  { value: 10, label: '$10' },
  { value: 5, label: '$5' },
  { value: 1, label: '$1' },
];

const LBP_DENOMINATIONS = [
  { value: 100000, label: '100,000 L.L.' },
  { value: 50000, label: '50,000 L.L.' },
  { value: 20000, label: '20,000 L.L.' },
  { value: 10000, label: '10,000 L.L.' },
  { value: 5000, label: '5,000 L.L.' },
  { value: 1000, label: '1,000 L.L.' },
];

interface CashDrawerCountModalProps {
  isOpen: boolean;
  mode: 'count' | 'close';
  expectedUSD: number;
  expectedLBP: number;
  exchangeRate: number;
  currentUserName?: string;
  onClose: () => void;
  onSuccess: (record: CashDrawerCountRecord) => void;
}

export const CashDrawerCountModal: React.FC<CashDrawerCountModalProps> = ({
  isOpen,
  mode,
  expectedUSD,
  expectedLBP,
  exchangeRate,
  currentUserName,
  onClose,
  onSuccess,
}) => {
  // Counts state: denomination -> count
  const [countsUSD, setCountsUSD] = useState<Record<string, number>>({});
  const [countsLBP, setCountsLBP] = useState<Record<string, number>>({});
  const [otherUSD, setOtherUSD] = useState<string>('');
  const [otherLBP, setOtherLBP] = useState<string>('');

  // Closing parameters (for mode === 'close')
  const [closingAction, setClosingAction] = useState<'leave_float' | 'empty_to_safe' | 'keep_as_is'>('leave_float');
  const [floatCarriedUSD, setFloatCarriedUSD] = useState<string>('100');
  const [floatCarriedLBP, setFloatCarriedLBP] = useState<string>('10000000');
  const [notes, setNotes] = useState<string>('');
  const [performedBy, setPerformedBy] = useState<string>(currentUserName || 'Cashier');
  const [activeTab, setActiveTab] = useState<'both' | 'usd' | 'lbp'>('both');
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState<CashDrawerCountRecord | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCountsUSD({});
      setCountsLBP({});
      setOtherUSD('');
      setOtherLBP('');
      setNotes('');
      setIsSubmittedSuccess(null);
      if (currentUserName) setPerformedBy(currentUserName);
    }
  }, [isOpen, currentUserName]);

  // Handler to update count
  const handleUSDCountChange = (valStr: string, qty: number) => {
    setCountsUSD((prev) => ({
      ...prev,
      [valStr]: Math.max(0, qty),
    }));
  };

  const handleLBPCountChange = (valStr: string, qty: number) => {
    setCountsLBP((prev) => ({
      ...prev,
      [valStr]: Math.max(0, qty),
    }));
  };

  const handleIncrementUSD = (valStr: string, delta: number) => {
    setCountsUSD((prev) => ({
      ...prev,
      [valStr]: Math.max(0, (prev[valStr] || 0) + delta),
    }));
  };

  const handleIncrementLBP = (valStr: string, delta: number) => {
    setCountsLBP((prev) => ({
      ...prev,
      [valStr]: Math.max(0, (prev[valStr] || 0) + delta),
    }));
  };

  // Reset all
  const handleResetAll = () => {
    if (window.confirm('Clear all counted note values?')) {
      setCountsUSD({});
      setCountsLBP({});
      setOtherUSD('');
      setOtherLBP('');
    }
  };

  // Calculations
  const countedUSD = useMemo(() => {
    let sum = 0;
    USD_DENOMINATIONS.forEach((d) => {
      const qty = countsUSD[String(d.value)] || 0;
      sum += qty * d.value;
    });
    const extra = parseFloat(otherUSD) || 0;
    return sum + extra;
  }, [countsUSD, otherUSD]);

  const countedLBP = useMemo(() => {
    let sum = 0;
    LBP_DENOMINATIONS.forEach((d) => {
      const qty = countsLBP[String(d.value)] || 0;
      sum += qty * d.value;
    });
    const extra = parseFloat(otherLBP) || 0;
    return sum + extra;
  }, [countsLBP, otherLBP]);

  const diffUSD = countedUSD - expectedUSD;
  const diffLBP = countedLBP - expectedLBP;

  // Handlers for Submission
  const handleSaveAuditCount = () => {
    const record = recordCashDrawerCount({
      type: 'spot_count',
      performedBy: performedBy.trim() || 'Cashier',
      notes: notes.trim() || 'Mid-shift physical cash count audit',
      denominationsUSD: countsUSD,
      denominationsLBP: countsLBP,
      countedUSD,
      countedLBP,
      expectedUSD,
      expectedLBP,
      diffUSD,
      diffLBP,
    });

    setIsSubmittedSuccess(record);
    onSuccess(record);
  };

  const handleConfirmCloseDrawer = () => {
    if (Math.abs(diffUSD) > 0.01 || Math.abs(diffLBP) > 500) {
      const msg = `Discrepancy detected:\n` +
        `USD: ${diffUSD >= 0 ? '+' : ''}$${diffUSD.toFixed(2)}\n` +
        `LBP: ${diffLBP >= 0 ? '+' : ''}${formatLBPValue(diffLBP)} L.L.\n\n` +
        `Do you want to proceed with closing the drawer session?`;
      if (!window.confirm(msg)) return;
    }

    const floatUSD = parseFloat(floatCarriedUSD) || 0;
    const floatLBP = parseFloat(floatCarriedLBP) || 0;

    const record = closeCashDrawerSession({
      performedBy: performedBy.trim() || 'Cashier',
      notes: notes.trim() || (mode === 'close' ? 'End of Day / Shift Cash Reconciliation' : ''),
      denominationsUSD: countsUSD,
      denominationsLBP: countsLBP,
      countedUSD,
      countedLBP,
      expectedUSD,
      expectedLBP,
      closingAction,
      floatCarriedOverUSD: closingAction === 'leave_float' ? floatUSD : 0,
      floatCarriedOverLBP: closingAction === 'leave_float' ? floatLBP : 0,
    });

    setIsSubmittedSuccess(record);
    onSuccess(record);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-auto">
        {/* Header */}
        <div className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${
          mode === 'close'
            ? 'border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30'
            : 'border-teal-200 bg-teal-50/80 dark:border-teal-900/50 dark:bg-teal-950/30'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              mode === 'close'
                ? 'bg-amber-600 text-white'
                : 'bg-teal-600 text-white'
            }`}>
              {mode === 'close' ? <Lock className="h-5 w-5" /> : <Calculator className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  {mode === 'close' ? 'Close Cash Drawer (Shift Reconciliation)' : 'Count Cash Drawer (Physical Audit)'}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  mode === 'close'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                    : 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
                }`}>
                  {mode === 'close' ? 'Z-Close Session' : 'Spot Check Only'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {mode === 'close'
                  ? 'Count cash notes to reconcile drawer against sales and close out register session.'
                  : 'Enter physical note quantities to verify register balances without modifying cash totals.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleResetAll}
              title="Reset all note quantities"
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Success Slip View if already submitted */}
        {isSubmittedSuccess ? (
          <div className="p-6 space-y-6 overflow-y-auto">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
              <h4 className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">
                {isSubmittedSuccess.type === 'shift_close'
                  ? 'Cash Drawer Session Successfully Closed'
                  : 'Cash Drawer Count Recorded'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                Official Reference: {isSubmittedSuccess.referenceNumber} • Staff: {isSubmittedSuccess.performedBy}
              </p>

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                <div className="rounded-lg bg-white p-3 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Physical USD Counted</div>
                  <div className="text-lg font-black text-emerald-600 font-mono">
                    ${isSubmittedSuccess.countedUSD.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg bg-white p-3 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Physical LBP Counted</div>
                  <div className="text-lg font-black text-blue-600 font-mono">
                    {formatLBPValue(isSubmittedSuccess.countedLBP)} L.L.
                  </div>
                </div>
                <div className="rounded-lg bg-white p-3 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                  <div className="text-[10px] uppercase font-bold text-slate-400">USD Variance</div>
                  <div className={`text-lg font-black font-mono ${
                    isSubmittedSuccess.diffUSD === 0
                      ? 'text-slate-700 dark:text-slate-300'
                      : isSubmittedSuccess.diffUSD > 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}>
                    {isSubmittedSuccess.diffUSD >= 0 ? '+' : ''}${isSubmittedSuccess.diffUSD.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg bg-white p-3 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                  <div className="text-[10px] uppercase font-bold text-slate-400">LBP Variance</div>
                  <div className={`text-lg font-black font-mono ${
                    isSubmittedSuccess.diffLBP === 0
                      ? 'text-slate-700 dark:text-slate-300'
                      : isSubmittedSuccess.diffLBP > 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}>
                    {isSubmittedSuccess.diffLBP >= 0 ? '+' : ''}{formatLBPValue(isSubmittedSuccess.diffLBP)} L.L.
                  </div>
                </div>
              </div>

              {isSubmittedSuccess.type === 'shift_close' && isSubmittedSuccess.closingAction && (
                <div className="mt-4 text-xs text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-800/70 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="font-bold">Closing Action: </span>
                  {isSubmittedSuccess.closingAction === 'leave_float' && (
                    <span>
                      Left Float of ${isSubmittedSuccess.floatCarriedOverUSD?.toFixed(2)} and {formatLBPValue(isSubmittedSuccess.floatCarriedOverLBP || 0)} L.L. in drawer.
                      Transferred ${(isSubmittedSuccess.withdrawnToSafeUSD || 0).toFixed(2)} and {formatLBPValue(isSubmittedSuccess.withdrawnToSafeLBP || 0)} L.L. to safe.
                    </span>
                  )}
                  {isSubmittedSuccess.closingAction === 'empty_to_safe' && (
                    <span>
                      Emptied 100% of cash (${(isSubmittedSuccess.withdrawnToSafeUSD || 0).toFixed(2)} & {formatLBPValue(isSubmittedSuccess.withdrawnToSafeLBP || 0)} L.L.) to safe.
                    </span>
                  )}
                  {isSubmittedSuccess.closingAction === 'keep_as_is' && (
                    <span>Kept drawer funds unchanged. Audit closing count recorded.</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-xs"
              >
                <Printer className="h-4 w-4 text-teal-600" />
                <span>Print Statement / Slip</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white hover:bg-teal-700 cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Main Denomination Counting Body */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Real-time Comparison Dashboard Bar */}
            <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Expected */}
                <div className="rounded-lg bg-white p-2.5 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Expected in Drawer</div>
                  <div className="flex items-center justify-between mt-1 text-xs font-mono font-bold">
                    <span className="text-slate-700 dark:text-slate-200">${expectedUSD.toFixed(2)}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-700 dark:text-slate-200">{formatLBPValue(expectedLBP)} L.L.</span>
                  </div>
                </div>

                {/* Physical Counted */}
                <div className="rounded-lg bg-white p-2.5 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Counted</div>
                  <div className="flex items-center justify-between mt-1 text-xs font-mono font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400">${countedUSD.toFixed(2)}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-blue-600 dark:text-blue-400">{formatLBPValue(countedLBP)} L.L.</span>
                  </div>
                </div>

                {/* Discrepancy Status */}
                <div className="rounded-lg bg-white p-2.5 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Variance</div>
                  <div className="flex items-center justify-between mt-1 text-xs font-mono font-bold">
                    <span className={diffUSD === 0 ? 'text-emerald-600' : diffUSD > 0 ? 'text-amber-600' : 'text-rose-600'}>
                      {diffUSD >= 0 ? '+' : ''}${diffUSD.toFixed(2)}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className={diffLBP === 0 ? 'text-emerald-600' : diffLBP > 0 ? 'text-amber-600' : 'text-rose-600'}>
                      {diffLBP >= 0 ? '+' : ''}{formatLBPValue(diffLBP)} L.L.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Currency Tab Selector for mobile */}
            <div className="sm:hidden px-4 pt-2 border-b border-slate-100 dark:border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('both')}
                className={`text-xs py-1.5 px-3 rounded-lg font-bold ${activeTab === 'both' ? 'bg-teal-600 text-white' : 'text-slate-600'}`}
              >
                All Currencies
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('usd')}
                className={`text-xs py-1.5 px-3 rounded-lg font-bold ${activeTab === 'usd' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
              >
                USD ($) Only
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('lbp')}
                className={`text-xs py-1.5 px-3 rounded-lg font-bold ${activeTab === 'lbp' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
              >
                LBP (L.L.) Only
              </button>
            </div>

            {/* Scrollable Denominations Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* USD Denomination Table */}
                {(activeTab === 'both' || activeTab === 'usd') && (
                  <div className="rounded-xl border border-emerald-200 bg-white shadow-xs dark:border-emerald-950 dark:bg-slate-900/60 overflow-hidden">
                    <div className="bg-emerald-50/75 dark:bg-emerald-950/30 px-3.5 py-2.5 border-b border-emerald-100 dark:border-emerald-950 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                          USD Banknotes ($)
                        </span>
                      </div>
                      <span className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-400">
                        Subtotal: ${countedUSD.toFixed(2)}
                      </span>
                    </div>

                    <div className="p-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                            <th className="text-left pb-1.5">Note</th>
                            <th className="text-center pb-1.5 w-28">Quantity</th>
                            <th className="text-right pb-1.5">Total ($)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {USD_DENOMINATIONS.map((d) => {
                            const valKey = String(d.value);
                            const qty = countsUSD[valKey] || 0;
                            const subtotal = qty * d.value;
                            return (
                              <tr key={d.value} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                <td className="py-2 font-mono font-bold text-slate-800 dark:text-slate-200">
                                  <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-900 dark:text-emerald-300 text-xs">
                                    {d.label}
                                  </span>
                                </td>
                                <td className="py-2 px-1">
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      placeholder="0"
                                      value={qty === 0 ? '' : qty}
                                      onChange={(e) =>
                                        handleUSDCountChange(valKey, parseInt(e.target.value) || 0)
                                      }
                                      className="w-16 rounded border border-slate-200 bg-white py-1 px-1.5 text-center text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleIncrementUSD(valKey, 1)}
                                      className="rounded bg-slate-100 hover:bg-emerald-100 px-1.5 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                                    >
                                      +1
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleIncrementUSD(valKey, 5)}
                                      className="rounded bg-slate-100 hover:bg-emerald-100 px-1.5 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer hidden sm:inline-block"
                                    >
                                      +5
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {subtotal > 0 ? `$${subtotal.toFixed(0)}` : '-'}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Extra / Coins */}
                          <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                            <td className="py-2 text-[11px] font-medium text-slate-500">
                              Loose Coins / Extra
                            </td>
                            <td className="py-2 px-1">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0.00"
                                value={otherUSD}
                                onChange={(e) => setOtherUSD(e.target.value)}
                                className="w-24 mx-auto block rounded border border-slate-200 bg-white py-1 px-2 text-center text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </td>
                            <td className="py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {parseFloat(otherUSD) > 0 ? `$${parseFloat(otherUSD).toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* LBP Denomination Table */}
                {(activeTab === 'both' || activeTab === 'lbp') && (
                  <div className="rounded-xl border border-blue-200 bg-white shadow-xs dark:border-blue-950 dark:bg-slate-900/60 overflow-hidden">
                    <div className="bg-blue-50/75 dark:bg-blue-950/30 px-3.5 py-2.5 border-b border-blue-100 dark:border-blue-950 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                          LBP Banknotes (L.L.)
                        </span>
                      </div>
                      <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-400">
                        Subtotal: {formatLBPValue(countedLBP)} L.L.
                      </span>
                    </div>

                    <div className="p-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                            <th className="text-left pb-1.5">Note</th>
                            <th className="text-center pb-1.5 w-28">Quantity</th>
                            <th className="text-right pb-1.5">Total (L.L.)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {LBP_DENOMINATIONS.map((d) => {
                            const valKey = String(d.value);
                            const qty = countsLBP[valKey] || 0;
                            const subtotal = qty * d.value;
                            return (
                              <tr key={d.value} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                <td className="py-2 font-mono font-bold text-slate-800 dark:text-slate-200">
                                  <span className="inline-block px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/50 dark:border-blue-900 dark:text-blue-300 text-xs">
                                    {d.label}
                                  </span>
                                </td>
                                <td className="py-2 px-1">
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      placeholder="0"
                                      value={qty === 0 ? '' : qty}
                                      onChange={(e) =>
                                        handleLBPCountChange(valKey, parseInt(e.target.value) || 0)
                                      }
                                      className="w-16 rounded border border-slate-200 bg-white py-1 px-1.5 text-center text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleIncrementLBP(valKey, 1)}
                                      className="rounded bg-slate-100 hover:bg-blue-100 px-1.5 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                                    >
                                      +1
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleIncrementLBP(valKey, 5)}
                                      className="rounded bg-slate-100 hover:bg-blue-100 px-1.5 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer hidden sm:inline-block"
                                    >
                                      +5
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {subtotal > 0 ? formatLBPValue(subtotal) : '-'}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Extra LBP */}
                          <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                            <td className="py-2 text-[11px] font-medium text-slate-500">
                              Loose Coins / Extra L.L.
                            </td>
                            <td className="py-2 px-1">
                              <input
                                type="number"
                                min="0"
                                step="500"
                                placeholder="0"
                                value={otherLBP}
                                onChange={(e) => setOtherLBP(e.target.value)}
                                className="w-24 mx-auto block rounded border border-slate-200 bg-white py-1 px-2 text-center text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </td>
                            <td className="py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {parseFloat(otherLBP) > 0 ? formatLBPValue(parseFloat(otherLBP)) : '-'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Close Drawer Options (Only if mode === 'close') */}
              {mode === 'close' && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                      Reconciliation & Closing Action
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className={`rounded-lg border p-2.5 text-xs flex flex-col justify-between cursor-pointer transition-all ${
                      closingAction === 'leave_float'
                        ? 'border-amber-500 bg-white shadow-2xs text-amber-900 dark:bg-slate-800 dark:text-amber-300 font-bold'
                        : 'border-slate-200 bg-white/60 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="radio"
                          name="closingAction"
                          checked={closingAction === 'leave_float'}
                          onChange={() => setClosingAction('leave_float')}
                          className="accent-amber-600"
                        />
                        <span>Leave Starting Float</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-normal">
                        Retains a base float in drawer; sweeps the rest to the safe.
                      </p>
                    </label>

                    <label className={`rounded-lg border p-2.5 text-xs flex flex-col justify-between cursor-pointer transition-all ${
                      closingAction === 'empty_to_safe'
                        ? 'border-amber-500 bg-white shadow-2xs text-amber-900 dark:bg-slate-800 dark:text-amber-300 font-bold'
                        : 'border-slate-200 bg-white/60 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="radio"
                          name="closingAction"
                          checked={closingAction === 'empty_to_safe'}
                          onChange={() => setClosingAction('empty_to_safe')}
                          className="accent-amber-600"
                        />
                        <span>Empty Drawer to Safe</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-normal">
                        Withdraws 100% of counted cash; resets register balance to 0.
                      </p>
                    </label>

                    <label className={`rounded-lg border p-2.5 text-xs flex flex-col justify-between cursor-pointer transition-all ${
                      closingAction === 'keep_as_is'
                        ? 'border-amber-500 bg-white shadow-2xs text-amber-900 dark:bg-slate-800 dark:text-amber-300 font-bold'
                        : 'border-slate-200 bg-white/60 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="radio"
                          name="closingAction"
                          checked={closingAction === 'keep_as_is'}
                          onChange={() => setClosingAction('keep_as_is')}
                          className="accent-amber-600"
                        />
                        <span>Keep Cash in Drawer</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-normal">
                        Records count without generating a safe withdrawal.
                      </p>
                    </label>
                  </div>

                  {closingAction === 'leave_float' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500">
                          Retained Float in USD ($)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={floatCarriedUSD}
                          onChange={(e) => setFloatCarriedUSD(e.target.value)}
                          placeholder="100.00"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-500">
                          Retained Float in LBP (L.L.)
                        </label>
                        <input
                          type="number"
                          step="100000"
                          value={floatCarriedLBP}
                          onChange={(e) => setFloatCarriedLBP(e.target.value)}
                          placeholder="10000000"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes and Staff Member */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Notes / Discrepancy Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      diffUSD !== 0 || diffLBP !== 0
                        ? 'Explain reason for cash variance...'
                        : 'e.g. Normal shift end, counted by morning staff...'
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Staff Name
                  </label>
                  <input
                    type="text"
                    value={performedBy}
                    onChange={(e) => setPerformedBy(e.target.value)}
                    placeholder="Pharmacist / Cashier"
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-semibold text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Footer Actions */}
            <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-3 dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {mode === 'count' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
                    >
                      <Printer className="h-4 w-4 text-teal-600" />
                      <span>Print Count Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAuditCount}
                      className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white hover:bg-teal-700 cursor-pointer shadow-2xs transition-all active:scale-95"
                    >
                      <Save className="h-4 w-4" />
                      <span>Save Audit Count</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmCloseDrawer}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer shadow-2xs transition-all active:scale-95"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Confirm & Close Cash Drawer</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
