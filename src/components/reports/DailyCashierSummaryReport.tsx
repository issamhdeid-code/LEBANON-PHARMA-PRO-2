import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Download,
  Printer,
  Search,
  Building2,
  DollarSign,
  TrendingUp,
  User,
  CreditCard,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Scale,
  FileSpreadsheet,
  Coins,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { SaleTransaction } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';
import { formatTime, formatDateTime } from '../../utils/dateUtils';

export const DailyCashierSummaryReport: React.FC = () => {
  const { sales, customerPayments, settings, exchangeRate } = usePharmacy();

  // Filter States
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [selectedCashier, setSelectedCashier] = useState<string>('ALL');

  // Physical Drawer Cash Count (User can input counted cash to audit variance)
  const [countedCashUSD, setCountedCashUSD] = useState<string>('');
  const [countedCashLBP, setCountedCashLBP] = useState<string>('');
  const [drawerNotes, setDrawerNotes] = useState<string>('');

  // Handle Preset changes
  const handlePresetChange = (preset: 'today' | 'yesterday' | 'custom') => {
    setDatePreset(preset);
    if (preset === 'today') {
      setSelectedDate(todayStr);
    } else if (preset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      setSelectedDate(d.toISOString().split('T')[0]);
    }
  };

  // Distinct Cashiers list from sales and customerPayments
  const cashiersList = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if (!s.isUnreal && s.cashierName) set.add(s.cashierName);
    });
    return Array.from(set).sort();
  }, [sales]);

  // Filtered sales matching date and cashier
  const matchingSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.isUnreal) return false;
      const saleDateStr = new Date(s.timestamp || s.date).toISOString().split('T')[0];
      if (saleDateStr !== selectedDate) return false;
      if (selectedCashier !== 'ALL' && s.cashierName !== selectedCashier) return false;
      return true;
    });
  }, [sales, selectedDate, selectedCashier]);

  // Filtered customer payments received on the same day
  const matchingPayments = useMemo(() => {
    return customerPayments.filter((p) => {
      const payDateStr = new Date(p.timestamp || p.date).toISOString().split('T')[0];
      return payDateStr === selectedDate;
    });
  }, [customerPayments, selectedDate]);

  // Cashier aggregations
  interface CashierStat {
    cashierName: string;
    transactionsCount: number;
    cashUSDIn: number;
    cashLBPIn: number;
    cardUSD: number;
    cardLBP: number;
    creditDebtUSD: number;
    creditDebtLBP: number;
    totalTurnoverUSD: number;
    totalTurnoverLBP: number;
  }

  const cashierStats = useMemo<CashierStat[]>(() => {
    const map = new Map<string, CashierStat>();

    matchingSales.forEach((sale) => {
      const name = sale.cashierName || 'Cashier';
      if (!map.has(name)) {
        map.set(name, {
          cashierName: name,
          transactionsCount: 0,
          cashUSDIn: 0,
          cashLBPIn: 0,
          cardUSD: 0,
          cardLBP: 0,
          creditDebtUSD: 0,
          creditDebtLBP: 0,
          totalTurnoverUSD: 0,
          totalTurnoverLBP: 0,
        });
      }

      const stat = map.get(name)!;
      stat.transactionsCount += 1;
      stat.totalTurnoverUSD += sale.totalUSD;
      stat.totalTurnoverLBP += sale.totalLBP;

      // Net Cash collected: paid minus change returned
      let changeUSD = sale.changeGivenUSD || 0;
      let changeLBP = sale.changeGivenLBP || 0;
      if ((sale.amountPaidLBP || 0) === 0 && (sale.amountPaidUSD || 0) > 0 && changeUSD > 0 && changeLBP > 0) {
        changeLBP = 0;
      } else if ((sale.amountPaidUSD || 0) === 0 && (sale.amountPaidLBP || 0) > 0 && changeUSD > 0 && changeLBP > 0) {
        changeUSD = 0;
      }

      if (sale.paymentMethod === 'cash_usd' || sale.paymentMethod === 'cash_lbp' || sale.paymentMethod === 'mixed') {
        const netUSD = (sale.amountPaidUSD || 0) - changeUSD;
        const netLBP = (sale.amountPaidLBP || 0) - changeLBP;
        stat.cashUSDIn += netUSD;
        stat.cashLBPIn += netLBP;
      }
      if (sale.paymentMethod === 'card') {
        stat.cardUSD += sale.totalUSD;
        stat.cardLBP += sale.totalLBP;
      }
      if (sale.paymentMethod === 'credit_debt') {
        stat.creditDebtUSD += sale.totalUSD;
        stat.creditDebtLBP += sale.totalLBP;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalTurnoverUSD - a.totalTurnoverUSD);
  }, [matchingSales]);

  // Summary figures
  const summary = useMemo(() => {
    let totalSalesUSD = 0;
    let totalSalesLBP = 0;
    let netCashUSD = 0;
    let netCashLBP = 0;
    let cardUSD = 0;
    let cardLBP = 0;
    let creditDebtUSD = 0;
    let creditDebtLBP = 0;

    matchingSales.forEach((s) => {
      totalSalesUSD += s.totalUSD;
      totalSalesLBP += s.totalLBP;

      let changeUSD = s.changeGivenUSD || 0;
      let changeLBP = s.changeGivenLBP || 0;
      if ((s.amountPaidLBP || 0) === 0 && (s.amountPaidUSD || 0) > 0 && changeUSD > 0 && changeLBP > 0) {
        changeLBP = 0;
      } else if ((s.amountPaidUSD || 0) === 0 && (s.amountPaidLBP || 0) > 0 && changeUSD > 0 && changeLBP > 0) {
        changeUSD = 0;
      }

      if (s.paymentMethod === 'cash_usd' || s.paymentMethod === 'cash_lbp' || s.paymentMethod === 'mixed') {
        netCashUSD += (s.amountPaidUSD || 0) - changeUSD;
        netCashLBP += (s.amountPaidLBP || 0) - changeLBP;
      }
      if (s.paymentMethod === 'card') {
        cardUSD += s.totalUSD;
        cardLBP += s.totalLBP;
      }
      if (s.paymentMethod === 'credit_debt') {
        creditDebtUSD += s.totalUSD;
        creditDebtLBP += s.totalLBP;
      }
    });

    // Customer payments collected (debt collections in cash)
    let debtCollectedUSD = 0;
    let debtCollectedLBP = 0;
    matchingPayments.forEach((p) => {
      if (p.method === 'cash') {
        if (p.currency === 'USD' || p.amountUSD) {
          debtCollectedUSD += p.amountUSD || p.amount;
        } else if (p.currency === 'LBP' || p.amountLBP) {
          debtCollectedLBP += p.amountLBP || p.amount;
        }
      }
    });

    // Expected drawer totals
    const expectedDrawerUSD = netCashUSD + debtCollectedUSD;
    const expectedDrawerLBP = netCashLBP + debtCollectedLBP;

    return {
      totalSalesUSD,
      totalSalesLBP,
      netCashUSD,
      netCashLBP,
      debtCollectedUSD,
      debtCollectedLBP,
      expectedDrawerUSD,
      expectedDrawerLBP,
      cardUSD,
      cardLBP,
      creditDebtUSD,
      creditDebtLBP,
      invoiceCount: matchingSales.length,
      averageBasketUSD: matchingSales.length > 0 ? totalSalesUSD / matchingSales.length : 0,
    };
  }, [matchingSales, matchingPayments]);

  // Drawer Variance Calculations
  const countedUSDNum = countedCashUSD !== '' ? parseFloat(countedCashUSD) || 0 : null;
  const countedLBPNum = countedCashLBP !== '' ? parseFloat(countedCashLBP) || 0 : null;

  const diffUSD = countedUSDNum !== null ? countedUSDNum - summary.expectedDrawerUSD : null;
  const diffLBP = countedLBPNum !== null ? countedLBPNum - summary.expectedDrawerLBP : null;

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Time',
      'Invoice #',
      'Cashier',
      'Customer',
      'Payment Method',
      'Total USD',
      'Total LBP',
      'Paid USD',
      'Paid LBP',
      'Change USD',
      'Change LBP',
      'Net USD Tendered',
      'Net LBP Tendered',
    ];

    const rows = matchingSales.map((s) => {
      let changeUSD = s.changeGivenUSD || 0;
      let changeLBP = s.changeGivenLBP || 0;
      if ((s.amountPaidLBP || 0) === 0 && (s.amountPaidUSD || 0) > 0 && changeUSD > 0 && changeLBP > 0) {
        changeLBP = 0;
      } else if ((s.amountPaidUSD || 0) === 0 && (s.amountPaidLBP || 0) > 0 && changeUSD > 0 && changeLBP > 0) {
        changeUSD = 0;
      }
      const netUSD = (s.amountPaidUSD || 0) - changeUSD;
      const netLBP = (s.amountPaidLBP || 0) - changeLBP;
      return [
        `"${formatTime(s.timestamp || s.date)}"`,
        `"${s.invoiceNumber || s.receiptNumber || 'N/A'}"`,
        `"${(s.cashierName || 'Cashier').replace(/"/g, '""')}"`,
        `"${(s.customerName || 'Walk-in').replace(/"/g, '""')}"`,
        `"${s.paymentMethod}"`,
        s.totalUSD.toFixed(2),
        Math.round(s.totalLBP),
        (s.amountPaidUSD || 0).toFixed(2),
        Math.round(s.amountPaidLBP || 0),
        (s.changeGivenUSD || 0).toFixed(2),
        Math.round(s.changeGivenLBP || 0),
        netUSD.toFixed(2),
        Math.round(netLBP),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Cashier_Summary_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* Ribbon Controls */}
      <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 rounded border border-gray-200 bg-gray-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => handlePresetChange('today')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  datePreset === 'today'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('yesterday')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  datePreset === 'yesterday'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('custom')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  datePreset === 'custom'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                Custom Date
              </button>
            </div>

            <div className="flex items-center space-x-1.5">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={matchingSales.length === 0}
              className="flex items-center space-x-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={matchingSales.length === 0}
              className="flex items-center space-x-1.5 rounded bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Cashier Summary</span>
            </button>
          </div>
        </div>

        {/* Filter Selection Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2.5">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Filter by Cashier / Terminal
            </label>
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              className="w-full rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Cashiers / Combined Drawer</option>
              {cashiersList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex items-center justify-end text-xs text-gray-500">
            <span>Pegged Rate: <strong className="text-slate-900 dark:text-white font-mono">1$ = {formatLBPValue(exchangeRate)} L.L.</strong></span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 no-print">
        {/* Expected Net Cash USD */}
        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Net Drawer ($)</span>
            <DollarSign className="h-3.5 w-3.5 text-teal-600" />
          </div>
          <div className="mt-1 text-base font-black text-teal-700 dark:text-teal-400">
            ${summary.expectedDrawerUSD.toFixed(2)}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            Sales: ${summary.netCashUSD.toFixed(2)} + Debt: ${summary.debtCollectedUSD.toFixed(2)}
          </div>
        </div>

        {/* Expected Net Cash LBP */}
        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Net Drawer (L.L.)</span>
            <Coins className="h-3.5 w-3.5 text-teal-600" />
          </div>
          <div className="mt-1 text-base font-black text-teal-700 dark:text-teal-400 truncate">
            {formatLBPValue(summary.expectedDrawerLBP)}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5 truncate">
            L.L. physical cash
          </div>
        </div>

        {/* Card Payments */}
        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Card / POS</span>
            <CreditCard className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
            ${summary.cardUSD.toFixed(2)}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            ≈ {formatLBPValue(summary.cardLBP)} L.L.
          </div>
        </div>

        {/* Credit Debt Sales */}
        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>On-Credit Debt</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="mt-1 text-base font-black text-amber-600 dark:text-amber-400">
            ${summary.creditDebtUSD.toFixed(2)}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            Booked to patient accounts
          </div>
        </div>

        {/* Total Turnover */}
        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Total Sales ($)</span>
            <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <div className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
            ${summary.totalSalesUSD.toFixed(2)}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            {formatLBPValue(summary.totalSalesLBP)} L.L.
          </div>
        </div>

        {/* Invoices Count */}
        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Invoices / Avg</span>
            <Receipt className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <div className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
            {summary.invoiceCount}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            Avg: ${summary.averageBasketUSD.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Drawer Reconciliation & Variance Calculator (Interactive Audit Tool - not needed when choosing All Cashiers / Combined Drawer) */}
      {selectedCashier !== 'ALL' && (
        <div
          id="drawer-reconciliation-audit-section"
          className="rounded-lg border border-teal-200/90 bg-teal-50/50 p-3.5 shadow-2xs dark:border-teal-900/60 dark:bg-teal-950/20 no-print transition-all"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-teal-200/70 dark:border-teal-900/50">
            <div className="flex items-center space-x-2">
              <Scale className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-teal-950 dark:text-teal-200">
                Cash Drawer Physical Count &amp; Variance Audit ({selectedCashier})
              </h4>
            </div>
            <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold">
              Count drawer bills at shift end to reconcile against system totals
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2.5">
            {/* USD Audit */}
            <div className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase text-gray-600 dark:text-slate-400">
                  Counted Cash ($ USD)
                </span>
                <span className="text-[10px] font-mono text-gray-500">
                  Expected: ${summary.expectedDrawerUSD.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1.5 text-xs text-gray-400">$</span>
                  <input
                    type="number"
                    placeholder="Enter counted USD..."
                    value={countedCashUSD}
                    onChange={(e) => setCountedCashUSD(e.target.value)}
                    className="w-full rounded border border-gray-200 bg-white pl-6 pr-2 py-1 text-xs font-mono font-bold text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                {diffUSD !== null && (
                  <div
                    className={`px-2 py-1 rounded text-xs font-bold font-mono whitespace-nowrap ${
                      Math.abs(diffUSD) < 0.05
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : diffUSD > 0
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {diffUSD === 0 ? '✓ Balanced' : diffUSD > 0 ? `+$${diffUSD.toFixed(2)}` : `-$${Math.abs(diffUSD).toFixed(2)}`}
                  </div>
                )}
              </div>
            </div>

            {/* LBP Audit */}
            <div className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold uppercase text-gray-600 dark:text-slate-400">
                  Counted Cash (L.L.)
                </span>
                <span className="text-[10px] font-mono text-gray-500 truncate">
                  Expected: {formatLBPValue(summary.expectedDrawerLBP)}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    placeholder="Enter counted L.L...."
                    value={countedCashLBP}
                    onChange={(e) => setCountedCashLBP(e.target.value)}
                    className="w-full rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-mono font-bold text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                {diffLBP !== null && (
                  <div
                    className={`px-2 py-1 rounded text-xs font-bold font-mono whitespace-nowrap ${
                      Math.abs(diffLBP) < 500
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : diffLBP > 0
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {diffLBP === 0 ? '✓ Balanced' : diffLBP > 0 ? `+${formatLBPValue(diffLBP)}` : `-${formatLBPValue(Math.abs(diffLBP))}`}
                  </div>
                )}
              </div>
            </div>

            {/* Shift Audit Note */}
            <div className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
              <label className="block text-[10px] font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                Shift Reconcile Notes / Reason for Variance
              </label>
              <input
                type="text"
                placeholder="e.g. Starting float $50 verified, small change discrepancy"
                value={drawerNotes}
                onChange={(e) => setDrawerNotes(e.target.value)}
                className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Printable Report Block */}
      <div
        id="printable-report"
        className="rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
      >
        {/* Header */}
        <div className="border-b border-gray-200 bg-gray-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  {settings.pharmacyName || 'Lebanon Pharma Pro'}
                </h3>
              </div>
              <div className="text-[11px] text-gray-600 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                {settings.pharmacyAddress && <span>{settings.pharmacyAddress}</span>}
                {settings.pharmacyPhone && <span>Tel: {settings.pharmacyPhone}</span>}
                {settings.licenseNumber && <span>Lic: #{settings.licenseNumber}</span>}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-black uppercase text-teal-800 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-900 inline-block">
                Daily Cashier & Register Summary
              </div>
              <div className="text-[10px] text-gray-600 dark:text-slate-400 mt-1">
                Date: <span className="font-bold text-slate-900 dark:text-slate-200">{selectedDate}</span>
                {' • '}Rate: <span className="font-mono">1$ = {formatLBPValue(exchangeRate)} L.L.</span>
              </div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500">
                Audited: {formatDateTime(new Date())} • Dispenser: {selectedCashier}
              </div>
            </div>
          </div>

          {/* Drawer Reconciliation Summary Box in Printed Document (Only if specific cashier selected) */}
          {selectedCashier !== 'ALL' && (countedUSDNum !== null || countedLBPNum !== null || drawerNotes) && (
            <div className="mt-2.5 rounded border border-gray-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-800">
              <div className="font-bold text-[10px] uppercase text-gray-500 mb-1">
                Cash Drawer Physical Count & Variance Summary:
              </div>
              <div className="flex flex-wrap gap-4 text-[11px]">
                {countedUSDNum !== null && (
                  <div>
                    USD Drawer: Counted <strong>${countedUSDNum.toFixed(2)}</strong> vs Expected ${summary.expectedDrawerUSD.toFixed(2)}
                    {diffUSD !== null && (
                      <span className={`ml-1 font-bold ${diffUSD >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ({diffUSD >= 0 ? `+${diffUSD.toFixed(2)}` : diffUSD.toFixed(2)})
                      </span>
                    )}
                  </div>
                )}
                {countedLBPNum !== null && (
                  <div>
                    LBP Drawer: Counted <strong>{formatLBPValue(countedLBPNum)}</strong> vs Expected {formatLBPValue(summary.expectedDrawerLBP)}
                    {diffLBP !== null && (
                      <span className={`ml-1 font-bold ${diffLBP >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ({diffLBP >= 0 ? `+${formatLBPValue(diffLBP)}` : formatLBPValue(diffLBP)})
                      </span>
                    )}
                  </div>
                )}
                {drawerNotes && (
                  <div className="italic text-gray-600 dark:text-slate-300">
                    Note: "{drawerNotes}"
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cashier Breakdown Table */}
        <div className="p-3 border-b border-gray-200 dark:border-slate-800">
          <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200 mb-2">
            Dispensers Collections Breakdown ({cashierStats.length} Terminals)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-gray-200 bg-gray-100/80 text-[10px] font-bold uppercase text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-2.5">Cashier / Dispenser</th>
                  <th className="py-2 px-2 text-right">Invoices</th>
                  <th className="py-2 px-2 text-right">Cash Net ($)</th>
                  <th className="py-2 px-2 text-right">Cash Net (L.L.)</th>
                  <th className="py-2 px-2 text-right">Card ($)</th>
                  <th className="py-2 px-2 text-right">Credit Debt ($)</th>
                  <th className="py-2 px-2 text-right">Total Sales ($)</th>
                  <th className="py-2 px-2 text-right">Total Sales (L.L.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-[11px]">
                {cashierStats.map((c) => (
                  <tr key={c.cashierName} className="hover:bg-teal-50/30 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-2.5 font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                      <User className="h-3 w-3 text-teal-600" />
                      <span>{c.cashierName}</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-gray-700 dark:text-slate-300">
                      {c.transactionsCount}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                      ${c.cashUSDIn.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-800 dark:text-slate-200">
                      {formatLBPValue(c.cashLBPIn)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-blue-600 dark:text-blue-400">
                      ${c.cardUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-amber-600 dark:text-amber-400">
                      ${c.creditDebtUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right font-black text-slate-900 dark:text-white">
                      ${c.totalTurnoverUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right font-semibold text-slate-800 dark:text-slate-200">
                      {formatLBPValue(c.totalTurnoverLBP)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <td className="py-2 px-2.5 uppercase">Totals:</td>
                  <td className="py-2 px-2 text-right">{summary.invoiceCount}</td>
                  <td className="py-2 px-2 text-right text-teal-800 dark:text-teal-300 font-mono">
                    ${summary.netCashUSD.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono">
                    {formatLBPValue(summary.netCashLBP)}
                  </td>
                  <td className="py-2 px-2 text-right text-blue-600 font-mono">
                    ${summary.cardUSD.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right text-amber-600 font-mono">
                    ${summary.creditDebtUSD.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-900 dark:text-white font-black">
                    ${summary.totalSalesUSD.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {formatLBPValue(summary.totalSalesLBP)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Detailed Transactions Register Table */}
        <div className="p-3">
          <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200 mb-2">
            Register Transaction Audit Log ({matchingSales.length} Transactions)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-gray-200 bg-gray-100/80 text-[10px] font-bold uppercase text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-2 w-8 text-center">#</th>
                  <th className="py-2 px-2">Time</th>
                  <th className="py-2 px-2">Receipt #</th>
                  <th className="py-2 px-2">Cashier</th>
                  <th className="py-2 px-2">Customer</th>
                  <th className="py-2 px-2">Payment Method</th>
                  <th className="py-2 px-2 text-right">Total ($)</th>
                  <th className="py-2 px-2 text-right">Total (L.L.)</th>
                  <th className="py-2 px-2 text-right">Paid Amount</th>
                  <th className="py-2 px-2 text-right">Change Given</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-[11px]">
                {matchingSales.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-teal-50/30 dark:hover:bg-slate-800/30">
                    <td className="py-1.5 px-2 text-center text-[10px] font-mono text-gray-400">
                      {idx + 1}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-[10px] text-gray-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(s.timestamp || s.date).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </td>
                    <td className="py-1.5 px-2 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {s.invoiceNumber || s.receiptNumber || 'N/A'}
                    </td>
                    <td className="py-1.5 px-2 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                      {s.cashierName}
                    </td>
                    <td className="py-1.5 px-2 text-gray-600 dark:text-slate-400 whitespace-nowrap">
                      {s.customerName || 'Walk-in'}
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="uppercase text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {s.paymentMethod}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-teal-700 dark:text-teal-400 whitespace-nowrap">
                      ${s.totalUSD.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap text-[10px]">
                      {formatLBPValue(s.totalLBP)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-[10px] text-gray-600 dark:text-slate-400 whitespace-nowrap">
                      {s.amountPaidUSD > 0 && `$${s.amountPaidUSD.toFixed(2)} `}
                      {s.amountPaidLBP > 0 && `${formatLBPValue(s.amountPaidLBP)} L.L.`}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-[10px] text-gray-500 whitespace-nowrap">
                      {s.changeGivenUSD > 0 && `$${s.changeGivenUSD.toFixed(2)} `}
                      {s.changeGivenLBP > 0 && `${formatLBPValue(s.changeGivenLBP)} L.L.`}
                      {!s.changeGivenUSD && !s.changeGivenLBP && '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Printable Signatures Block */}
        <div className="border-t border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-6 text-[11px] text-gray-600 dark:text-slate-400">
          <div>
            Official Cash Register Audit • Dual Currency Lebanese Pharmacy Register System
          </div>
          <div className="flex items-center space-x-8">
            <div>
              Cashier Signature: <span className="underline decoration-dotted font-semibold text-slate-800 dark:text-slate-200">________________________</span>
            </div>
            <div>
              Supervising Pharmacist: <span className="underline decoration-dotted font-semibold text-slate-800 dark:text-slate-200">________________________</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
