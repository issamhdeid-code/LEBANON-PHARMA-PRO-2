import React, { useState, useMemo } from 'react';
import {
  Users,
  Download,
  Printer,
  Search,
  Building2,
  AlertCircle,
  Clock,
  DollarSign,
  TrendingDown,
  Phone,
  Calendar,
  FileSpreadsheet,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2,
  Coins
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { formatLBPValue } from '../../utils/priceUtils';

export interface CustomerAgingRecord {
  customerId: string;
  name: string;
  phone: string;
  address: string;
  balanceUSD: number;
  balanceLBP: number;
  totalDebtEquivalentUSD: number;
  totalDebtEquivalentLBP: number;
  current0_30USD: number;
  aging31_60USD: number;
  aging61_90USD: number;
  aging90PlusUSD: number;
  lastVisitDate: string;
  lastPaymentDate?: string;
  lastPaymentAmountUSD?: number;
  riskCategory: 'current' | 'attention' | 'warning' | 'critical';
  unpaidInvoicesCount: number;
}

export const CustomerDebtAgingReport: React.FC = () => {
  const { customers, sales, customerPayments, settings, exchangeRate } = usePharmacy();

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [agingFilter, setAgingFilter] = useState<'ALL' | 'OVERDUE_30' | 'CRITICAL_90'>('ALL');
  const [minBalanceUSD, setMinBalanceUSD] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'balance_desc' | 'aging_desc' | 'name_asc'>('balance_desc');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  const now = new Date().getTime();

  // Compute Aging per Customer
  const customerAgingList = useMemo<CustomerAgingRecord[]>(() => {
    const list: CustomerAgingRecord[] = [];

    customers.forEach((cust) => {
      // Find credit sales belonging to this customer
      const creditSales = sales.filter((s) => {
        if (s.paymentMethod !== 'credit_debt') return false;
        if (s.customerId && s.customerId === cust.id) return true;
        if (s.customerName && cust.name && s.customerName.toLowerCase() === cust.name.toLowerCase()) return true;
        return false;
      });

      // Find payments from this customer
      const payments = customerPayments.filter((p) => {
        if (p.customerId === cust.id) return true;
        if (cust.name && p.customerName && p.customerName.toLowerCase() === cust.name.toLowerCase()) return true;
        return false;
      }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const lastPayment = payments.length > 0 ? payments[0] : null;

      // Calculate total debt equivalent in USD
      const totalDebtUSD = cust.balanceUSD + (cust.balanceLBP > 0 ? cust.balanceLBP / exchangeRate : 0);
      const totalDebtLBP = (cust.balanceUSD * exchangeRate) + cust.balanceLBP;

      // If customer has no recorded balance and no credit sales, skip
      if (totalDebtUSD <= 0.05 && creditSales.length === 0) {
        return;
      }

      // Bracket allocation based on credit sales dates
      let b0_30 = 0;
      let b31_60 = 0;
      let b61_90 = 0;
      let b90Plus = 0;

      if (creditSales.length > 0) {
        creditSales.forEach((sale) => {
          const saleTime = sale.timestamp || new Date(sale.date).getTime();
          const daysDiff = Math.max(0, Math.floor((now - saleTime) / (1000 * 60 * 60 * 24)));

          if (daysDiff <= 30) {
            b0_30 += sale.totalUSD;
          } else if (daysDiff <= 60) {
            b31_60 += sale.totalUSD;
          } else if (daysDiff <= 90) {
            b61_90 += sale.totalUSD;
          } else {
            b90Plus += sale.totalUSD;
          }
        });
      } else {
        // If no specific credit sales found, infer aging from cust.lastVisit
        const lastVisitTime = cust.lastVisit ? new Date(cust.lastVisit).getTime() : now;
        const daysDiff = Math.max(0, Math.floor((now - lastVisitTime) / (1000 * 60 * 60 * 24)));

        if (daysDiff <= 30) b0_30 = totalDebtUSD;
        else if (daysDiff <= 60) b31_60 = totalDebtUSD;
        else if (daysDiff <= 90) b61_90 = totalDebtUSD;
        else b90Plus = totalDebtUSD;
      }

      // Determine Risk Category
      let riskCategory: CustomerAgingRecord['riskCategory'] = 'current';
      if (b90Plus > 0 || (b61_90 > 50 && totalDebtUSD > 100)) {
        riskCategory = 'critical';
      } else if (b61_90 > 0 || b31_60 > 50) {
        riskCategory = 'warning';
      } else if (b31_60 > 0) {
        riskCategory = 'attention';
      }

      list.push({
        customerId: cust.id,
        name: cust.name,
        phone: cust.phone || 'N/A',
        address: cust.address || '',
        balanceUSD: cust.balanceUSD,
        balanceLBP: cust.balanceLBP,
        totalDebtEquivalentUSD: totalDebtUSD,
        totalDebtEquivalentLBP: totalDebtLBP,
        current0_30USD: b0_30,
        aging31_60USD: b31_60,
        aging61_90USD: b61_90,
        aging90PlusUSD: b90Plus,
        lastVisitDate: cust.lastVisit || 'N/A',
        lastPaymentDate: lastPayment ? new Date(lastPayment.timestamp || lastPayment.date).toLocaleDateString() : undefined,
        lastPaymentAmountUSD: lastPayment ? (lastPayment.amountUSD || lastPayment.amount) : undefined,
        riskCategory,
        unpaidInvoicesCount: creditSales.length,
      });
    });

    return list;
  }, [customers, sales, customerPayments, exchangeRate, now]);

  // Filter and Sort
  const filteredRecords = useMemo(() => {
    return customerAgingList
      .filter((r) => {
        if (minBalanceUSD > 0 && r.totalDebtEquivalentUSD < minBalanceUSD) return false;

        if (agingFilter === 'OVERDUE_30' && (r.aging31_60USD + r.aging61_90USD + r.aging90PlusUSD) <= 0.05) {
          return false;
        }
        if (agingFilter === 'CRITICAL_90' && r.aging90PlusUSD <= 0.05) {
          return false;
        }

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          return r.name.toLowerCase().includes(q) || r.phone.includes(q);
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'balance_desc') return b.totalDebtEquivalentUSD - a.totalDebtEquivalentUSD;
        if (sortBy === 'aging_desc') return b.aging90PlusUSD - a.aging90PlusUSD || b.aging61_90USD - a.aging61_90USD;
        return a.name.localeCompare(b.name);
      });
  }, [customerAgingList, minBalanceUSD, agingFilter, searchTerm, sortBy]);

  // Overall KPIs
  const summary = useMemo(() => {
    let grandTotalUSD = 0;
    let grandTotalLBP = 0;
    let totalCurrent = 0;
    let total31_60 = 0;
    let total61_90 = 0;
    let total90Plus = 0;

    filteredRecords.forEach((r) => {
      grandTotalUSD += r.totalDebtEquivalentUSD;
      grandTotalLBP += r.totalDebtEquivalentLBP;
      totalCurrent += r.current0_30USD;
      total31_60 += r.aging31_60USD;
      total61_90 += r.aging61_90USD;
      total90Plus += r.aging90PlusUSD;
    });

    const overdueTotal = total31_60 + total61_90 + total90Plus;

    return {
      debtorsCount: filteredRecords.length,
      grandTotalUSD,
      grandTotalLBP,
      totalCurrent,
      overdueTotal,
      total90Plus,
      avgBalanceUSD: filteredRecords.length > 0 ? grandTotalUSD / filteredRecords.length : 0,
    };
  }, [filteredRecords]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Customer Name',
      'Phone',
      'Total Debt ($ USD)',
      'Total Debt (L.L.)',
      'Current (0-30d)',
      '31-60 Days',
      '61-90 Days',
      '90+ Days (Critical)',
      'Risk Classification',
      'Last Visit Date',
      'Last Payment Date',
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.phone}"`,
      r.totalDebtEquivalentUSD.toFixed(2),
      Math.round(r.totalDebtEquivalentLBP),
      r.current0_30USD.toFixed(2),
      r.aging31_60USD.toFixed(2),
      r.aging61_90USD.toFixed(2),
      r.aging90PlusUSD.toFixed(2),
      `"${r.riskCategory.toUpperCase()}"`,
      `"${r.lastVisitDate}"`,
      `"${r.lastPaymentDate || 'None'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Customer_Debt_Aging_Report_${new Date().toISOString().split('T')[0]}.csv`);
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
                onClick={() => setAgingFilter('ALL')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  agingFilter === 'ALL'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                All Debtors ({customerAgingList.length})
              </button>
              <button
                type="button"
                onClick={() => setAgingFilter('OVERDUE_30')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  agingFilter === 'OVERDUE_30'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                Overdue &gt;30 Days
              </button>
              <button
                type="button"
                onClick={() => setAgingFilter('CRITICAL_90')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  agingFilter === 'CRITICAL_90'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                Critical &gt;90 Days
              </button>
            </div>

            <div className="flex items-center space-x-1.5 text-xs text-gray-500">
              <span>Min Debt:</span>
              <select
                value={minBalanceUSD}
                onChange={(e) => setMinBalanceUSD(Number(e.target.value))}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value={0}>Any Balance ($0+)</option>
                <option value={10}>$10+</option>
                <option value={25}>$25+</option>
                <option value={50}>$50+</option>
                <option value={100}>$100+</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredRecords.length === 0}
              className="flex items-center space-x-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export Aging CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={filteredRecords.length === 0}
              className="flex items-center space-x-1.5 rounded bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Debt Aging</span>
            </button>
          </div>
        </div>

        {/* Search & Sort Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2.5">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Search Patient or Phone
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search patient name, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded border border-gray-200 bg-white pl-7 pr-2.5 py-1 text-xs text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Sort Order
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="balance_desc">Highest Outstanding Debt ($)</option>
              <option value="aging_desc">Most Overdue (90+ Days First)</option>
              <option value="name_asc">Patient Name (A-Z)</option>
            </select>
          </div>

          <div className="flex items-center justify-end text-[11px] text-gray-500">
            <span>Official Lebanese Pharmacy Credit Ledger ("Daftar el Zabayen")</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 no-print">
        <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Total Outstanding Debt</span>
            <DollarSign className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <div className="mt-1 text-base font-black text-rose-600 dark:text-rose-400">
            ${summary.grandTotalUSD.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5 truncate">
            ≈ {formatLBPValue(summary.grandTotalLBP)} L.L.
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Active Indebted Patients</span>
            <Users className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
            {summary.debtorsCount}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Avg balance: ${summary.avgBalanceUSD.toFixed(2)}
          </div>
        </div>

        <div className="rounded border border-amber-200 bg-amber-50/50 p-3 shadow-2xs dark:border-amber-950 dark:bg-amber-950/20">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
            <span>Overdue &gt;30 Days</span>
            <Clock className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="mt-1 text-base font-black text-amber-700 dark:text-amber-400">
            ${summary.overdueTotal.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Require telephone reminder
          </div>
        </div>

        <div className="rounded border border-red-200 bg-red-50/50 p-3 shadow-2xs dark:border-red-950 dark:bg-red-950/20">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-red-700 dark:text-red-400">
            <span>Critical &gt;90 Days</span>
            <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
          </div>
          <div className="mt-1 text-base font-black text-red-700 dark:text-red-400">
            ${summary.total90Plus.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            High risk debt accounts
          </div>
        </div>
      </div>

      {/* Main Printable Ledger Block */}
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
              <div className="text-xs font-black uppercase text-rose-800 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900 inline-block">
                Customer Credit & Debt Aging Report
              </div>
              <div className="text-[10px] text-gray-600 dark:text-slate-400 mt-1">
                Aging As Of: <span className="font-bold text-slate-900 dark:text-slate-200">{new Date().toISOString().split('T')[0]}</span>
                {' • '}Rate: 1$ = {formatLBPValue(exchangeRate)} L.L.
              </div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500">
                Accounts Receivable Ledger
              </div>
            </div>
          </div>
        </div>

        {/* Debt Aging Table */}
        <div className="p-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-gray-200 bg-gray-100/80 text-[10px] font-bold uppercase text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-2.5">Patient / Account</th>
                  <th className="py-2 px-2">Phone Number</th>
                  <th className="py-2 px-2 text-right">Total ($)</th>
                  <th className="py-2 px-2 text-right">Total (L.L.)</th>
                  <th className="py-2 px-2 text-right">Current (0-30d)</th>
                  <th className="py-2 px-2 text-right">31 - 60 Days</th>
                  <th className="py-2 px-2 text-right">61 - 90 Days</th>
                  <th className="py-2 px-2 text-right">90+ Days</th>
                  <th className="py-2 px-2 text-center">Status</th>
                  <th className="py-2 px-2">Last Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-[11px]">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-gray-500 italic">
                      No customer debts found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.customerId} className="hover:bg-teal-50/30 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-2.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {r.name}
                      </td>
                      <td className="py-2 px-2 font-mono text-gray-600 dark:text-slate-400 whitespace-nowrap">
                        {r.phone}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        ${r.totalDebtEquivalentUSD.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {formatLBPValue(r.totalDebtEquivalentLBP)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {r.current0_30USD > 0 ? `$${r.current0_30USD.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        {r.aging31_60USD > 0 ? `$${r.aging31_60USD.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        {r.aging61_90USD > 0 ? `$${r.aging61_90USD.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                        {r.aging90PlusUSD > 0 ? `$${r.aging90PlusUSD.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            r.riskCategory === 'critical'
                              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300'
                              : r.riskCategory === 'warning'
                              ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300'
                              : r.riskCategory === 'attention'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {r.riskCategory}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-500 text-[10px] whitespace-nowrap">
                        {r.lastPaymentDate ? `${r.lastPaymentDate} ($${r.lastPaymentAmountUSD?.toFixed(0)})` : 'None logged'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <td className="py-2 px-2.5 uppercase">Totals ({filteredRecords.length} accounts):</td>
                  <td className="py-2 px-2"></td>
                  <td className="py-2 px-2 text-right font-mono text-rose-700 dark:text-rose-400 font-black">
                    ${summary.grandTotalUSD.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono">
                    {formatLBPValue(summary.grandTotalLBP)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-emerald-700 dark:text-emerald-400">
                    ${summary.totalCurrent.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-amber-600">
                    ${summary.overdueTotal.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono"></td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-red-600 dark:text-red-400">
                    ${summary.total90Plus.toFixed(2)}
                  </td>
                  <td className="py-2 px-2"></td>
                  <td className="py-2 px-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Printable Footer / Follow-up notes */}
        <div className="border-t border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-6 text-[11px] text-gray-600 dark:text-slate-400">
          <div>
            <div>Receivables Aging Verification • Confirmed with Patient Credit Cards & Ledgers</div>
          </div>
          <div className="flex items-center space-x-8">
            <div>
              Accountant / Credit Officer: <span className="underline decoration-dotted font-semibold text-slate-800 dark:text-slate-200">________________________</span>
            </div>
            <div>
              Managing Pharmacist: <span className="underline decoration-dotted font-semibold text-slate-800 dark:text-slate-200">________________________</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
