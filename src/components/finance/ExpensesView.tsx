import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Trash2,
  Calendar,
  FileSpreadsheet,
  Printer,
  DollarSign,
  Coins,
  TrendingDown,
  Building,
  Zap,
  Users,
  Fuel,
  Wrench,
  Sparkles,
  Landmark,
  Wifi,
  Truck,
  Megaphone,
  Layers,
  HelpCircle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Expense, ExpenseCategory } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';

interface ExpenseCategoryMeta {
  key: ExpenseCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeBg: string;
  badgeText: string;
}

const EXPENSE_CATEGORIES: ExpenseCategoryMeta[] = [
  { key: 'rent', label: 'Rent', icon: Building, color: 'text-indigo-600', badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40', badgeText: 'text-indigo-700 dark:text-indigo-300' },
  { key: 'electricity', label: 'Electricity (EDL)', icon: Zap, color: 'text-amber-600', badgeBg: 'bg-amber-50 dark:bg-amber-950/40', badgeText: 'text-amber-700 dark:text-amber-300' },
  { key: 'generator_fuel', label: 'Generator & Fuel', icon: Fuel, color: 'text-orange-600', badgeBg: 'bg-orange-50 dark:bg-orange-950/40', badgeText: 'text-orange-700 dark:text-orange-300' },
  { key: 'salaries', label: 'Salaries & Staff', icon: Users, color: 'text-blue-600', badgeBg: 'bg-blue-50 dark:bg-blue-950/40', badgeText: 'text-blue-700 dark:text-blue-300' },
  { key: 'maintenance', label: 'Maintenance & Repairs', icon: Wrench, color: 'text-slate-600', badgeBg: 'bg-slate-100 dark:bg-slate-800', badgeText: 'text-slate-700 dark:text-slate-300' },
  { key: 'cleaning_supplies', label: 'Cleaning & Supplies', icon: Sparkles, color: 'text-teal-600', badgeBg: 'bg-teal-50 dark:bg-teal-950/40', badgeText: 'text-teal-700 dark:text-teal-300' },
  { key: 'taxes_government', label: 'Taxes & Municipal Fees', icon: Landmark, color: 'text-red-600', badgeBg: 'bg-red-50 dark:bg-red-950/40', badgeText: 'text-red-700 dark:text-red-300' },
  { key: 'internet_telecom', label: 'Internet & Telecom', icon: Wifi, color: 'text-cyan-600', badgeBg: 'bg-cyan-50 dark:bg-cyan-950/40', badgeText: 'text-cyan-700 dark:text-cyan-300' },
  { key: 'transport_delivery', label: 'Transport & Delivery', icon: Truck, color: 'text-emerald-600', badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40', badgeText: 'text-emerald-700 dark:text-emerald-300' },
  { key: 'marketing_promo', label: 'Marketing & Signage', icon: Megaphone, color: 'text-purple-600', badgeBg: 'bg-purple-50 dark:bg-purple-950/40', badgeText: 'text-purple-700 dark:text-purple-300' },
  { key: 'professional_services', label: 'Accounting & Legal', icon: Layers, color: 'text-violet-600', badgeBg: 'bg-violet-50 dark:bg-violet-950/40', badgeText: 'text-violet-700 dark:text-violet-300' },
  { key: 'other', label: 'Other Operational Cost', icon: HelpCircle, color: 'text-slate-500', badgeBg: 'bg-slate-100 dark:bg-slate-800', badgeText: 'text-slate-600 dark:text-slate-300' },
];

export const ExpensesView: React.FC = () => {
  const {
    expenses,
    recordExpense,
    deleteExpense,
    exchangeRate,
    currentUser,
    formatUSD,
    formatLBP
  } = usePharmacy();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [fundingFilter, setFundingFilter] = useState<'all' | 'drawer' | 'outside'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month' | 'year'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: 'rent' as ExpenseCategory,
    payee: '',
    currency: 'USD' as 'USD' | 'LBP' | 'MIXED',
    amountUSD: '',
    amountLBP: '',
    paidFromDrawer: true,
    paidBy: currentUser?.name || 'Pharmacist',
    receiptRef: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Expense KPIs
  const metrics = useMemo(() => {
    let totalAllUSD = 0;
    let totalAllLBP = 0;
    let totalDrawerUSD = 0;
    let totalDrawerLBP = 0;
    let totalOutsideUSD = 0;
    let totalOutsideLBP = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let thisMonthUSD = 0;
    let thisMonthLBP = 0;

    expenses.forEach((e) => {
      totalAllUSD += e.amountUSD;
      totalAllLBP += e.amountLBP;

      if (e.paidFromDrawer) {
        totalDrawerUSD += e.amountUSD;
        totalDrawerLBP += e.amountLBP;
      } else {
        totalOutsideUSD += e.amountUSD;
        totalOutsideLBP += e.amountLBP;
      }

      if (e.timestamp >= startOfMonth) {
        thisMonthUSD += e.amountUSD;
        thisMonthLBP += e.amountLBP;
      }
    });

    const totalEqUSD = totalAllUSD + (totalAllLBP > 0 ? totalAllLBP / exchangeRate : 0);
    const drawerEqUSD = totalDrawerUSD + (totalDrawerLBP > 0 ? totalDrawerLBP / exchangeRate : 0);
    const outsideEqUSD = totalOutsideUSD + (totalOutsideLBP > 0 ? totalOutsideLBP / exchangeRate : 0);
    const thisMonthEqUSD = thisMonthUSD + (thisMonthLBP > 0 ? thisMonthLBP / exchangeRate : 0);

    return {
      totalCount: expenses.length,
      totalEqUSD,
      drawerEqUSD,
      outsideEqUSD,
      thisMonthEqUSD,
      totalAllUSD,
      totalAllLBP,
      totalDrawerUSD,
      totalDrawerLBP,
      totalOutsideUSD,
      totalOutsideLBP,
    };
  }, [expenses, exchangeRate]);

  // Filtered List
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    return expenses
      .filter((e) => {
        // Date filter
        if (dateFilter === 'today' && e.timestamp < startOfToday) return false;
        if (dateFilter === 'month' && e.timestamp < startOfMonth) return false;
        if (dateFilter === 'year' && e.timestamp < startOfYear) return false;

        // Category filter
        if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;

        // Funding source filter
        if (fundingFilter === 'drawer' && !e.paidFromDrawer) return false;
        if (fundingFilter === 'outside' && e.paidFromDrawer) return false;

        // Search text
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchTitle = (e.title || '').toLowerCase().includes(q);
          const matchPayee = (e.payee || '').toLowerCase().includes(q);
          const matchNum = (e.expenseNumber || '').toLowerCase().includes(q);
          const matchReceipt = (e.receiptRef || '').toLowerCase().includes(q);
          const matchNotes = (e.notes || '').toLowerCase().includes(q);
          const matchCat = (e.category || '').toLowerCase().includes(q);
          return matchTitle || matchPayee || matchNum || matchReceipt || matchNotes || matchCat;
        }

        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [expenses, dateFilter, categoryFilter, fundingFilter, searchTerm]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormData({
      title: '',
      category: 'rent',
      payee: '',
      currency: 'USD',
      amountUSD: '',
      amountLBP: '',
      paidFromDrawer: true,
      paidBy: currentUser?.name || 'Pharmacist',
      receiptRef: '',
      notes: '',
      date: new Date().toISOString().split('T')[0],
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Expense
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title.trim()) {
      setFormError('Please enter an expense title / description.');
      return;
    }

    const usd = parseFloat(formData.amountUSD) || 0;
    const lbp = parseFloat(formData.amountLBP) || 0;

    if (usd <= 0 && lbp <= 0) {
      setFormError('Please enter a valid amount in USD or LBP.');
      return;
    }

    const categoryObj = EXPENSE_CATEGORIES.find((c) => c.key === formData.category);
    const categoryLabel = categoryObj ? categoryObj.label : formData.category;

    const currency: 'USD' | 'LBP' | 'MIXED' =
      usd > 0 && lbp > 0 ? 'MIXED' : usd > 0 ? 'USD' : 'LBP';

    const amount = currency === 'USD' ? usd : currency === 'LBP' ? lbp : usd;

    const expenseDate = formData.date ? new Date(formData.date).toISOString() : new Date().toISOString();

    recordExpense({
      date: expenseDate,
      title: formData.title.trim(),
      category: formData.category,
      categoryLabel,
      payee: formData.payee.trim() || undefined,
      amount,
      currency,
      amountUSD: usd,
      amountLBP: lbp,
      exchangeRate,
      paidFromDrawer: formData.paidFromDrawer,
      paidBy: formData.paidBy.trim() || currentUser?.name || 'Pharmacist',
      receiptRef: formData.receiptRef.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    });

    setIsModalOpen(false);
  };

  // Delete handler
  const handleDelete = (id: string, num: string) => {
    if (window.confirm(`Are you sure you want to delete expense #${num}?`)) {
      deleteExpense(id);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Expense #',
      'Date',
      'Title',
      'Category',
      'Payee',
      'Amount USD',
      'Amount LBP',
      'Paid From Drawer',
      'Paid By',
      'Receipt Ref',
      'Notes',
    ];

    const rows = filteredExpenses.map((e) => [
      e.expenseNumber,
      new Date(e.date).toLocaleDateString(),
      `"${(e.title || '').replace(/"/g, '""')}"`,
      e.category,
      `"${(e.payee || '').replace(/"/g, '""')}"`,
      e.amountUSD.toFixed(2),
      Math.round(e.amountLBP),
      e.paidFromDrawer ? 'YES (Drawer)' : 'NO (Outside)',
      `"${(e.paidBy || '').replace(/"/g, '""')}"`,
      `"${(e.receiptRef || '').replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pharmacy_expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Operational Expenses & Costs
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Log pharmacy overhead (rent, electricity, generator, salaries). Choose to deduct from Cash Drawer or track as external funds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer"
          >
            <Printer className="h-4 w-4 text-teal-600" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Expenses */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Total Operational Costs</span>
            <div className="rounded-lg bg-rose-50 p-1.5 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
            {formatUSD(metrics.totalEqUSD)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            ${metrics.totalAllUSD.toFixed(2)} + {formatLBPValue(metrics.totalAllLBP)} LBP ({metrics.totalCount} records)
          </div>
        </div>

        {/* Paid From Cash Drawer */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Deducted from Drawer</span>
            <div className="rounded-lg bg-amber-50 p-1.5 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatUSD(metrics.drawerEqUSD)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            ${metrics.totalDrawerUSD.toFixed(2)} + {formatLBPValue(metrics.totalDrawerLBP)} LBP in cash drawer payouts
          </div>
        </div>

        {/* Paid From Outside Drawer */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Outside Funds</span>
            <div className="rounded-lg bg-blue-50 p-1.5 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {formatUSD(metrics.outsideEqUSD)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Personal / Bank funds (Zero impact on daily POS drawer)
          </div>
        </div>

        {/* This Month's Total */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>This Month</span>
            <div className="rounded-lg bg-teal-50 p-1.5 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">
            {formatUSD(metrics.thisMonthEqUSD)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-teal-600 dark:text-teal-400 font-bold">
            Current calendar month total
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date pill filter */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                dateFilter === 'all'
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                dateFilter === 'today'
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('month')}
              className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                dateFilter === 'month'
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('year')}
              className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                dateFilter === 'year'
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              This Year
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.label}
              </option>
            ))}
          </select>

          {/* Funding Source Dropdown */}
          <select
            value={fundingFilter}
            onChange={(e) => setFundingFilter(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">All Funding Sources</option>
            <option value="drawer">Cash Drawer Only (Deducted)</option>
            <option value="outside">Outside / Bank Only (No Deduction)</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search expense, payee, ref #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 bg-slate-50/75 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/60 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-teal-600" />
            Expense Records ({filteredExpenses.length})
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Exchange Rate: 1 USD = {formatLBPValue(exchangeRate)} LBP
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-2.5">Expense #</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Title & Details</th>
                <th className="py-2.5 px-3">Payee / Vendor</th>
                <th className="py-2.5 px-3 text-center">Drawer Source</th>
                <th className="py-2.5 px-3 text-right">Amount (USD)</th>
                <th className="py-2.5 px-3 text-right">Amount (LBP)</th>
                <th className="py-2.5 px-3">Disbursed By</th>
                <th className="py-2.5 px-2 text-center no-print">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <Briefcase className="mx-auto h-8 w-8 mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-sm">No expenses found</p>
                    <p className="text-xs mt-1">Click "Record Expense" above to log operational costs.</p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const catMeta = EXPENSE_CATEGORIES.find((c) => c.key === exp.category);
                  const Icon = catMeta?.icon || HelpCircle;

                  return (
                    <tr
                      key={exp.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      {/* Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium">
                        {new Date(exp.date).toLocaleDateString()}
                      </td>

                      {/* Expense # */}
                      <td className="py-2.5 px-2.5 font-mono font-bold whitespace-nowrap">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                          {exp.expenseNumber}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                            catMeta?.badgeBg || 'bg-slate-100'
                          } ${catMeta?.badgeText || 'text-slate-700'}`}
                        >
                          <Icon className={`h-3 w-3 ${catMeta?.color || 'text-slate-500'}`} />
                          <span>{exp.categoryLabel || catMeta?.label || exp.category}</span>
                        </span>
                      </td>

                      {/* Title & Notes */}
                      <td className="py-2.5 px-3 max-w-xs">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{exp.title}</div>
                        {exp.notes && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={exp.notes}>
                            {exp.notes}
                          </div>
                        )}
                        {exp.receiptRef && (
                          <div className="text-[10px] text-teal-600 dark:text-teal-400 font-mono">
                            Ref: {exp.receiptRef}
                          </div>
                        )}
                      </td>

                      {/* Payee */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                        {exp.payee || <span className="text-slate-400">—</span>}
                      </td>

                      {/* Paid from Drawer? */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {exp.paidFromDrawer ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            title="Deducted from Cash Drawer Ledger"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Drawer Payout
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            title="Zero deduction from Cash Drawer (Personal/Bank funds)"
                          >
                            External Fund
                          </span>
                        )}
                      </td>

                      {/* USD Amount */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap text-rose-600 dark:text-rose-400">
                        {exp.amountUSD > 0 ? `$${exp.amountUSD.toFixed(2)}` : '—'}
                      </td>

                      {/* LBP Amount */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap text-rose-600 dark:text-rose-400">
                        {exp.amountLBP > 0 ? `${formatLBPValue(exp.amountLBP)} LBP` : '—'}
                      </td>

                      {/* Disbursed By */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {exp.paidBy || 'Staff'}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap no-print">
                        <button
                          type="button"
                          onClick={() => handleDelete(exp.id, exp.expenseNumber)}
                          title="Delete expense record"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold dark:border-slate-700 dark:bg-slate-800 text-[11px]">
                <tr>
                  <td colSpan={6} className="py-2.5 px-3 uppercase text-slate-700 dark:text-slate-300">
                    Filtered Totals ({filteredExpenses.length} records):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-600 dark:text-rose-400">
                    ${filteredExpenses.reduce((acc, e) => acc + e.amountUSD, 0).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-600 dark:text-rose-400">
                    {formatLBPValue(filteredExpenses.reduce((acc, e) => acc + e.amountLBP, 0))} LBP
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal: Record Expense */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-teal-600" />
                Record Operational Expense
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-lg bg-rose-50 p-2.5 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Expense Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pharmacy Monthly Rent, May Generator"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cost Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 cursor-pointer font-medium"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payee & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payee / Recipient / Vendor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Landlord Name, EDL, Fuel Supplier"
                    value={formData.payee}
                    onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Amounts (USD & LBP) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-900/60">
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Amount Paid (enter USD, LBP, or both for mixed payment)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      USD Amount ($)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={formData.amountUSD}
                        onChange={(e) => setFormData({ ...formData, amountUSD: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-mono font-bold text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      LBP Amount (L.L.)
                    </label>
                    <div className="relative">
                      <Coins className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        placeholder="0"
                        value={formData.amountLBP}
                        onChange={(e) => setFormData({ ...formData, amountLBP: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-mono font-bold text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Crucial: Paid from Cash Drawer toggle */}
              <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3.5 dark:border-teal-800 dark:bg-teal-950/30">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="paidFromDrawerCheckbox"
                    checked={formData.paidFromDrawer}
                    onChange={(e) => setFormData({ ...formData, paidFromDrawer: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-teal-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <div>
                    <label
                      htmlFor="paidFromDrawerCheckbox"
                      className="text-xs font-bold text-teal-900 dark:text-teal-200 cursor-pointer"
                    >
                      Deduct this payment directly from the Cash Drawer (Ledger)
                    </label>
                    <p className="text-[11px] text-teal-700 dark:text-teal-300 mt-0.5 leading-snug">
                      {formData.paidFromDrawer
                        ? '✓ Enabled: The paid amount will be subtracted from the live POS cash drawer running balance.'
                        : '○ Disabled: Recorded as pharmacy overhead for profit calculation, but NOT deducted from the cashier drawer balance (e.g. paid from personal cash, owner wallet, or bank transfer).'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Authorizer & Receipt Ref */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Authorized / Disbursed By
                  </label>
                  <input
                    type="text"
                    value={formData.paidBy}
                    onChange={(e) => setFormData({ ...formData, paidBy: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt / Invoice Ref #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EDL-98213, INV-5541"
                    value={formData.receiptRef}
                    onChange={(e) => setFormData({ ...formData, receiptRef: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional details, meter reading, period covered..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
