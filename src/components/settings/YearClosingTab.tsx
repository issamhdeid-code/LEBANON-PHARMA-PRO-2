import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Archive,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  FileText,
  DollarSign,
  Package,
  Users,
  Building2,
  Receipt,
  HelpCircle,
  Eye,
  X,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { formatLBPValue } from '../../utils/priceUtils';
import { formatDateTime } from '../../utils/dateUtils';
import { YearClosingRecord } from '../../types/pharmacy';

export const YearClosingTab: React.FC = () => {
  const {
    currentUser,
    workingYear,
    isArchiveReadOnly,
    closedYears,
    closeYear,
    logout,
    sales,
    purchases,
    expenses,
    products,
    customers,
    suppliers,
    customerPayments,
    supplierPayments,
    toLBP,
    addNotification,
  } = usePharmacy();

  const [closingNote, setClosingNote] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [selectedArchiveDetail, setSelectedArchiveDetail] = useState<YearClosingRecord | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Compute live pre-closing totals for the active year
  const activeMetrics = useMemo(() => {
    const totalSalesUSD = sales.reduce((sum, s) => sum + (s.totalUSD || 0), 0);
    const totalSalesLBP = sales.reduce((sum, s) => sum + (s.totalLBP || 0), 0);

    const totalPurchasesUSD = purchases.reduce((sum, p) => sum + (p.totalCostUSD || 0), 0);
    const totalPurchasesLBP = purchases.reduce((sum, p) => sum + (p.totalCostLBP || 0), 0);

    const totalExpensesUSD = expenses.reduce((sum, e) => sum + (e.amountUSD || 0), 0);
    const totalExpensesLBP = expenses.reduce((sum, e) => sum + (e.amountLBP || 0), 0);

    const totalStockQty = products.reduce((sum, p) => sum + (p.stockQuantity || 0), 0);
    const stockValuationUSD = products.reduce((sum, p) => sum + ((p.stockQuantity || 0) * (p.costPriceUSD || 0)), 0);
    const stockValuationLBP = toLBP(stockValuationUSD);

    // Outstanding customer balances
    const customersWithBalance = customers.filter(c => (c.balanceUSD || 0) > 0 || (c.balanceLBP || 0) > 0);
    const customerDebtUSD = customers.reduce((sum, c) => sum + (c.balanceUSD || 0), 0);
    const customerDebtLBP = customers.reduce((sum, c) => sum + (c.balanceLBP || 0), 0);

    // Outstanding supplier balances
    const suppliersWithBalance = suppliers.filter(s => (s.balanceUSD || 0) > 0 || (s.balanceLBP || 0) > 0);
    const supplierBalanceUSD = suppliers.reduce((sum, s) => sum + (s.balanceUSD || 0), 0);
    const supplierBalanceLBP = suppliers.reduce((sum, s) => sum + (s.balanceLBP || 0), 0);

    return {
      salesCount: sales.length,
      totalSalesUSD,
      totalSalesLBP,
      purchasesCount: purchases.length,
      totalPurchasesUSD,
      totalPurchasesLBP,
      expensesCount: expenses.length,
      totalExpensesUSD,
      totalExpensesLBP,
      productsCount: products.length,
      totalStockQty,
      stockValuationUSD,
      stockValuationLBP,
      customersWithBalanceCount: customersWithBalance.length,
      customerDebtUSD,
      customerDebtLBP,
      suppliersWithBalanceCount: suppliersWithBalance.length,
      supplierBalanceUSD,
      supplierBalanceLBP,
      customerPaymentsCount: customerPayments.length,
      supplierPaymentsCount: supplierPayments.length,
    };
  }, [sales, purchases, expenses, products, customers, suppliers, customerPayments, supplierPayments, toLBP]);

  const requiredConfirmPhrase = `CLOSE ${workingYear}`;
  const isConfirmValid = confirmationText.trim().toUpperCase() === requiredConfirmPhrase;

  const handleExecuteCloseYear = async () => {
    if (!isAdmin) {
      addNotification('Unauthorized', 'Only administrators can perform year closing.', 'system', 'error');
      return;
    }
    if (isArchiveReadOnly) {
      addNotification('Error', 'Cannot close an already archived fiscal year.', 'system', 'error');
      return;
    }
    if (!isConfirmValid) {
      addNotification('Confirmation Required', `Type "${requiredConfirmPhrase}" to confirm irreversible closing.`, 'system', 'warning');
      return;
    }

    setIsClosing(true);
    try {
      const res = await closeYear(workingYear, closingNote.trim() || undefined);
      if (res.success) {
        setClosingNote('');
        setConfirmationText('');
        addNotification(
          'Fiscal Year Closed',
          `Fiscal year ${workingYear} is now permanently sealed. Rolled over into year ${workingYear + 1}.`,
          'system',
          'success'
        );
      } else {
        addNotification('Year Closing Failed', res.error || 'Failed to close fiscal year.', 'system', 'error');
      }
    } catch (err: any) {
      addNotification('Error', err?.message || 'An unexpected error occurred.', 'system', 'error');
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Annual Fiscal Closing &amp; Year Archives
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Permanently seal annual transactional registers, carry forward balances into the new year, and inspect historical fiscal archives.
            </p>
          </div>

          {/* Current Working Year Badge */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold shrink-0 select-none ${
              isArchiveReadOnly
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                : 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800'
            }`}
          >
            {isArchiveReadOnly ? (
              <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            )}
            <div>
              <span className="text-[10px] uppercase tracking-wider block opacity-75 font-semibold">
                {isArchiveReadOnly ? 'Archived View' : 'Active Working Year'}
              </span>
              <span className="text-sm">{workingYear}</span>
            </div>
          </div>
        </div>

        {/* Read-Only Mode Banner in Settings */}
        {isArchiveReadOnly && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-2.5">
              <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Historical Archive Mode:</span> You are browsing closed data for fiscal year{' '}
                <span className="font-extrabold">{workingYear}</span>. All modifications, sales, and purchases are locked.
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-900 text-amber-50 hover:bg-amber-950 transition-colors font-bold text-xs shrink-0 cursor-pointer"
            >
              <span>Log Out &amp; Switch Year</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Irreversible Year Closing Action Section (Only on Active Year) */}
      {!isArchiveReadOnly && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-xs space-y-5">
          <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Close Fiscal Year {workingYear}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Review current metrics and seal the fiscal year permanently. This procedure is strictly irreversible.
            </p>
          </div>

          {/* Pre-Closing Metrics Overview */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
              Pre-Closing Balances &amp; Roll-Over Summary (Year {workingYear})
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Sales Summary */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Receipt className="h-3.5 w-3.5 text-teal-600" /> Total Sales ({activeMetrics.salesCount})
                  </span>
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">Sealed</span>
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  ${activeMetrics.totalSalesUSD.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {formatLBPValue(activeMetrics.totalSalesLBP)} L.L.
                </div>
              </div>

              {/* Purchases Summary */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" /> Purchases ({activeMetrics.purchasesCount})
                  </span>
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">Sealed</span>
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  ${activeMetrics.totalPurchasesUSD.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {formatLBPValue(activeMetrics.totalPurchasesLBP)} L.L.
                </div>
              </div>

              {/* Expenses Summary */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <DollarSign className="h-3.5 w-3.5 text-rose-600" /> Expenses ({activeMetrics.expensesCount})
                  </span>
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">Sealed</span>
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  ${activeMetrics.totalExpensesUSD.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {formatLBPValue(activeMetrics.totalExpensesLBP)} L.L.
                </div>
              </div>

              {/* Stock Valuation (Carried over) */}
              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 mb-1">
                  <span className="flex items-center gap-1 font-semibold">
                    <Package className="h-3.5 w-3.5 text-emerald-600" /> Stock Valuation ({activeMetrics.productsCount} items)
                  </span>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded font-bold">
                    Carried Over
                  </span>
                </div>
                <div className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                  ${activeMetrics.stockValuationUSD.toFixed(2)}
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono">
                  {formatLBPValue(activeMetrics.stockValuationLBP)} L.L. ({activeMetrics.totalStockQty} units)
                </div>
              </div>

              {/* Customer Balances (Carried over as Opening Balances) */}
              <div className="p-3 rounded-lg border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20">
                <div className="flex items-center justify-between text-xs text-purple-800 dark:text-purple-300 mb-1">
                  <span className="flex items-center gap-1 font-semibold">
                    <Users className="h-3.5 w-3.5 text-purple-600" /> Customer Debt ({activeMetrics.customersWithBalanceCount} debtors)
                  </span>
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-1.5 py-0.5 rounded font-bold">
                    Carried Over
                  </span>
                </div>
                <div className="text-sm font-bold text-purple-900 dark:text-purple-100">
                  ${activeMetrics.customerDebtUSD.toFixed(2)}
                </div>
                <div className="text-[11px] text-purple-700 dark:text-purple-300 font-mono">
                  {formatLBPValue(activeMetrics.customerDebtLBP)} L.L.
                </div>
              </div>

              {/* Supplier Balances (Carried over as Opening Balances) */}
              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20">
                <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 mb-1">
                  <span className="flex items-center gap-1 font-semibold">
                    <Building2 className="h-3.5 w-3.5 text-amber-600" /> Supplier Debt ({activeMetrics.suppliersWithBalanceCount} creditors)
                  </span>
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded font-bold">
                    Carried Over
                  </span>
                </div>
                <div className="text-sm font-bold text-amber-900 dark:text-amber-100">
                  ${activeMetrics.supplierBalanceUSD.toFixed(2)}
                </div>
                <div className="text-[11px] text-amber-700 dark:text-amber-300 font-mono">
                  {formatLBPValue(activeMetrics.supplierBalanceLBP)} L.L.
                </div>
              </div>
            </div>
          </div>

          {/* Operational Rules & Carry-Over Notice */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 text-xs space-y-2 text-slate-600 dark:text-slate-300">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-teal-600" />
              How Year Closing Operates:
            </div>
            <ul className="list-disc pl-5 space-y-1 text-[11px]">
              <li>
                <strong>Stock Valuation:</strong> Carries over with exact quantities and batches intact at the moment of closing into the new year.
              </li>
              <li>
                <strong>Customer &amp; Supplier Balances:</strong> Outstanding receivables and payables carry forward into the new year as opening balances.
              </li>
              <li>
                <strong>Archived Registers:</strong> All sales invoices, purchases, returns, expenses, and cash drawer vouchers of year {workingYear} are sealed into an offline archive database.
              </li>
              <li>
                <strong>Strictly Irreversible:</strong> Once closed, transactions of year {workingYear} cannot be altered. To inspect them, sign out and select year {workingYear} from the login screen.
              </li>
            </ul>
          </div>

          {/* Warning & Confirmation Execution Form */}
          {isAdmin ? (
            <div className="rounded-lg border-2 border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-4 space-y-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                    Mandatory Irreversibility Confirmation
                  </h4>
                  <p className="mt-0.5 text-[11px] text-rose-700 dark:text-rose-400">
                    You are preparing to finalize and seal fiscal year {workingYear}. Enter an optional closing note and type{' '}
                    <code className="font-mono font-bold bg-rose-100 dark:bg-rose-900/60 px-1 py-0.5 rounded text-rose-900 dark:text-rose-200">
                      {requiredConfirmPhrase}
                    </code>{' '}
                    below to unlock the closing button.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Closing Audit Note / Memo (Optional)
                  </label>
                  <input
                    type="text"
                    value={closingNote}
                    onChange={(e) => setClosingNote(e.target.value)}
                    placeholder={`e.g. Official Fiscal Year ${workingYear} Audit Signoff`}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-rose-700 dark:text-rose-400 mb-1">
                    Type "{requiredConfirmPhrase}" to Confirm *
                  </label>
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder={requiredConfirmPhrase}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold uppercase bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-md focus:border-rose-600 focus:outline-hidden text-rose-900 dark:text-rose-100"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={!isConfirmValid || isClosing}
                  onClick={handleExecuteCloseYear}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Lock className="h-4 w-4" />
                  <span>{isClosing ? 'Finalizing & Sealing Archive...' : `Permanently Close Fiscal Year ${workingYear}`}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 text-center text-xs text-slate-500">
              Only administrator accounts have permission to perform annual fiscal closing.
            </div>
          )}
        </div>
      )}

      {/* Closed Fiscal Years Archive Table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Archive className="h-4 w-4 text-teal-600" />
              Archived Fiscal Years ({closedYears.length})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Historical fiscal periods sealed in the offline database. Select any year at login to browse in read-only mode.
            </p>
          </div>
        </div>

        {closedYears.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            <Archive className="mx-auto h-8 w-8 text-slate-400 mb-2 opacity-50" />
            <p className="font-semibold">No fiscal years have been closed yet.</p>
            <p className="text-[11px] mt-1 text-slate-400">
              When a fiscal year is finalized, its immutable snapshot will appear in this archive table.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60">
                  <th className="py-2.5 px-3">Year</th>
                  <th className="py-2.5 px-3">Closed Date</th>
                  <th className="py-2.5 px-3">Closed By</th>
                  <th className="py-2.5 px-3 text-right">Sales (USD / LBP)</th>
                  <th className="py-2.5 px-3 text-right">Purchases (USD)</th>
                  <th className="py-2.5 px-3 text-right">Stock Valuation</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                {closedYears.map((record) => {
                  const s = record.summary;
                  const isCurrent = workingYear === record.year;
                  return (
                    <tr
                      key={record.year}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors ${
                        isCurrent ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span>{record.year}</span>
                          {isCurrent && (
                            <span className="text-[10px] bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded font-bold">
                              Viewing
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {formatDateTime(record.closedAt || record.closedDate)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{record.closedBy}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-800 dark:text-slate-100">
                        <div>${(s?.totalSalesUSD || 0).toFixed(2)}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {formatLBPValue(s?.totalSalesLBP || 0)} L.L.
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-800 dark:text-slate-100">
                        ${(s?.totalPurchasesUSD || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-800 dark:text-slate-100">
                        ${(s?.inventoryValuationUSD || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedArchiveDetail(record)}
                            className="p-1 rounded text-slate-600 hover:text-teal-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                            title="View Full Closing Report"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Archive Detail Report Modal */}
      {selectedArchiveDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 select-none">
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-teal-800 px-5 py-4 text-white flex items-center justify-between border-b border-teal-900">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-300" />
                <h3 className="font-bold text-sm">
                  Fiscal Year {selectedArchiveDetail.year} — Closing Report
                </h3>
              </div>
              <button
                onClick={() => setSelectedArchiveDetail(null)}
                className="text-teal-200 hover:text-white p-1 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Closed On</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatDateTime(selectedArchiveDetail.closedAt || selectedArchiveDetail.closedDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Closed By</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedArchiveDetail.closedBy}
                  </span>
                </div>
                {selectedArchiveDetail.note && (
                  <div className="col-span-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Closing Memo</span>
                    <span className="text-slate-700 dark:text-slate-300 italic">{selectedArchiveDetail.note}</span>
                  </div>
                )}
              </div>

              {selectedArchiveDetail.summary && (
                <div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-2">Sealed Financial Summary</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">Total Sales</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        ${(selectedArchiveDetail.summary.totalSalesUSD || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        {formatLBPValue(selectedArchiveDetail.summary.totalSalesLBP || 0)} L.L.
                      </span>
                    </div>

                    <div className="p-2.5 rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">Purchases</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        ${(selectedArchiveDetail.summary.totalPurchasesUSD || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        {formatLBPValue(selectedArchiveDetail.summary.totalPurchasesLBP || 0)} L.L.
                      </span>
                    </div>

                    <div className="p-2.5 rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">Expenses</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        ${(selectedArchiveDetail.summary.totalExpensesUSD || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        {formatLBPValue(selectedArchiveDetail.summary.totalExpensesLBP || 0)} L.L.
                      </span>
                    </div>

                    <div className="p-2.5 rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">Inventory Valuation</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        ${(selectedArchiveDetail.summary.inventoryValuationUSD || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {selectedArchiveDetail.summary.productsCount} catalog items
                      </span>
                    </div>

                    <div className="p-2.5 rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">Invoices Processed</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {selectedArchiveDetail.summary.salesCount} sales
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {selectedArchiveDetail.summary.purchasesCount} purchase bills
                      </span>
                    </div>

                    <div className="p-2.5 rounded border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">Parties Handled</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {selectedArchiveDetail.summary.customersCount} customers
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {selectedArchiveDetail.summary.suppliersCount} suppliers
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 p-3 text-[11px] text-teal-900 dark:text-teal-200">
                To explore this year's detailed transaction registers, invoices, and ledgers in the user interface, sign out of the system and select{' '}
                <strong>{selectedArchiveDetail.year} (Archived)</strong> on the login screen.
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-100 dark:bg-slate-800/80 px-5 py-3 flex justify-end border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setSelectedArchiveDetail(null)}
                className="px-4 py-1.5 rounded bg-slate-700 hover:bg-slate-800 text-white font-medium text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
