import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Banknote,
  DollarSign,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Minus,
  Search,
  Filter,
  Calendar,
  FileSpreadsheet,
  Printer,
  Trash2,
  Receipt,
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  History,
  Scale,
  Sparkles,
  Calculator,
  Lock,
  ClipboardList,
  Briefcase
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { formatLBPValue } from '../../utils/priceUtils';
import {
  CashDrawerOpType,
  CashDrawerCategory,
  ManualDrawerTransaction,
  UnifiedCashDrawerEntry,
  CashDrawerCountRecord
} from '../../types/cashDrawer';
import {
  getCashDrawerManualTransactions,
  deleteCashDrawerManualTransaction,
  getCashDrawerCountRecords
} from '../../services/cashDrawerService';
import { CashDrawerFundModal } from './CashDrawerFundModal';
import { CashDrawerCountModal } from './CashDrawerCountModal';

export const CashDrawerView: React.FC = () => {
  const {
    sales,
    customerPayments,
    supplierPayments,
    expenses,
    currentUser,
    exchangeRate,
    settings,
    formatUSD,
    formatLBP
  } = usePharmacy();

  // Fund Add/Remove Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<CashDrawerOpType>('IN');

  // Count & Close Drawer Modal state
  const [isCountModalOpen, setIsCountModalOpen] = useState(false);
  const [countModalMode, setCountModalMode] = useState<'count' | 'close'>('count');
  const [countRecords, setCountRecords] = useState<CashDrawerCountRecord[]>(() =>
    getCashDrawerCountRecords()
  );

  // Active view tab: ledger vs audit counts
  const [activeTableTab, setActiveTableTab] = useState<'ledger' | 'counts'>('ledger');

  // Manual transactions state from storage
  const [manualTransactions, setManualTransactions] = useState<ManualDrawerTransaction[]>(() =>
    getCashDrawerManualTransactions()
  );

  // Reload manual transactions on custom event or mount
  const reloadManualTransactions = useCallback(() => {
    setManualTransactions(getCashDrawerManualTransactions());
  }, []);

  const reloadCountRecords = useCallback(() => {
    setCountRecords(getCashDrawerCountRecords());
  }, []);

  useEffect(() => {
    const handleStorageUpdate = () => reloadManualTransactions();
    const handleCountsUpdate = () => reloadCountRecords();
    window.addEventListener('cash_drawer_updated', handleStorageUpdate);
    window.addEventListener('cash_drawer_counts_updated', handleCountsUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener('cash_drawer_updated', handleStorageUpdate);
      window.removeEventListener('cash_drawer_counts_updated', handleCountsUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [reloadManualTransactions, reloadCountRecords]);

  // Filters
  const [datePeriod, setDatePeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out' | 'manual' | 'expense'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Build Unified Ledger from all sources
  const allLedgerEntries = useMemo<UnifiedCashDrawerEntry[]>(() => {
    const entries: UnifiedCashDrawerEntry[] = [];

    // A. Cash movements from POS Sales
    sales.forEach((s) => {
      if (s.isUnreal) return;
      if (s.paymentMethod === 'credit_debt' || s.paymentMethod === 'card') {
        // No physical cash in drawer
        return;
      }

      // Heal historical duplicate change data if both were populated for single-currency payments:
      let changeUSD = s.changeGivenUSD || 0;
      let changeLBP = s.changeGivenLBP || 0;
      if ((s.amountPaidLBP || 0) === 0 && (s.amountPaidUSD || 0) > 0 && changeUSD > 0 && changeLBP > 0) {
        changeLBP = 0; // Legacy pure USD payment duplicate
      } else if ((s.amountPaidUSD || 0) === 0 && (s.amountPaidLBP || 0) > 0 && changeUSD > 0 && changeLBP > 0) {
        changeUSD = 0; // Legacy pure LBP payment duplicate
      }

      const netUSD = (s.amountPaidUSD || 0) - changeUSD;
      const netLBP = (s.amountPaidLBP || 0) - changeLBP;

      if (netUSD === 0 && netLBP === 0) return;

      const timestamp = s.timestamp || new Date(s.date).getTime();
      const date = s.date || new Date(s.timestamp).toISOString();
      const referenceNumber = s.invoiceNumber || `INV-${s.id.substring(0, 6)}`;
      const partyName = s.customerName || 'Walk-in Patient';
      const performedBy = s.cashierName || 'Cashier';

      // Check if both currencies move in the same direction or one is 0:
      if ((netUSD >= 0 && netLBP >= 0) || (netUSD <= 0 && netLBP <= 0)) {
        const isOverallIn = netUSD >= 0 && netLBP >= 0;
        entries.push({
          id: `sale-${s.id}`,
          timestamp,
          date,
          type: isOverallIn ? 'IN' : 'OUT',
          categoryLabel: isOverallIn ? 'POS Cash Sale' : 'POS Cash Refund',
          categoryKey: 'pos_sale',
          referenceNumber,
          partyName,
          amountUSD: Math.abs(netUSD),
          amountLBP: Math.abs(netLBP),
          performedBy,
          notes: `${s.items.length} item(s) dispensed • Method: ${s.paymentMethod.toUpperCase()}`,
          source: 'pos_sale',
        });
      } else {
        // Split cross-currency cash flows into separate IN and OUT entries
        // so drawer USD and drawer LBP reflect actual physical cash movements
        if (netUSD !== 0) {
          const isUSDIn = netUSD > 0;
          entries.push({
            id: `sale-${s.id}-usd`,
            timestamp,
            date,
            type: isUSDIn ? 'IN' : 'OUT',
            categoryLabel: isUSDIn ? 'POS Cash Sale' : 'POS Change Return',
            categoryKey: 'pos_sale',
            referenceNumber,
            partyName,
            amountUSD: Math.abs(netUSD),
            amountLBP: 0,
            performedBy,
            notes: isUSDIn
              ? `${s.items.length} item(s) • USD Cash Received (Change given in LBP)`
              : `Change returned in USD for invoice ${referenceNumber}`,
            source: 'pos_sale',
          });
        }
        if (netLBP !== 0) {
          const isLBPIn = netLBP > 0;
          entries.push({
            id: `sale-${s.id}-lbp`,
            timestamp,
            date,
            type: isLBPIn ? 'IN' : 'OUT',
            categoryLabel: isLBPIn ? 'POS Cash Sale' : 'POS Change Return',
            categoryKey: 'pos_sale',
            referenceNumber,
            partyName,
            amountUSD: 0,
            amountLBP: Math.abs(netLBP),
            performedBy,
            notes: isLBPIn
              ? `${s.items.length} item(s) • LBP Cash Received (Change given in USD)`
              : `Change returned in LBP for invoice ${referenceNumber}`,
            source: 'pos_sale',
          });
        }
      }
    });

    // B. Cash movements from Customer Debt Payments
    customerPayments.forEach((cp) => {
      if (cp.method && cp.method !== 'cash') {
        return; // card or cheque
      }

      let usd = 0;
      let lbp = 0;

      if (cp.currency === 'USD') {
        usd = cp.amountUSD || cp.amount || 0;
      } else if (cp.currency === 'LBP') {
        lbp = cp.amountLBP || cp.amount || 0;
      } else if (cp.currency === 'MIXED') {
        usd = cp.amountUSD || 0;
        lbp = cp.amountLBP || 0;
      }

      if (usd > 0 || lbp > 0) {
        entries.push({
          id: `custpay-${cp.id}`,
          timestamp: cp.timestamp || new Date(cp.date).getTime(),
          date: cp.date || new Date(cp.timestamp).toISOString(),
          type: 'IN',
          categoryLabel: 'Customer Debt Collection',
          categoryKey: 'customer_debt_payment',
          referenceNumber: cp.paymentNumber || `PAY-${cp.id.substring(0, 6)}`,
          partyName: cp.customerName || 'Patient Account',
          amountUSD: usd,
          amountLBP: lbp,
          performedBy: cp.customerName ? 'Counter Cashier' : 'Cashier',
          notes: cp.notes || 'Account debt payment received in cash',
          source: 'customer_payment',
        });
      }
    });

    // C. Cash movements from Supplier Payments
    supplierPayments.forEach((sp) => {
      const source = sp.fundingSource || 'drawer';
      const totalUSD = sp.currency === 'USD' ? (sp.amountUSD || sp.amount || 0) : sp.currency === 'MIXED' ? (sp.amountUSD || 0) : 0;
      const totalLBP = sp.currency === 'LBP' ? (sp.amountLBP || sp.amount || 0) : sp.currency === 'MIXED' ? (sp.amountLBP || 0) : 0;

      let drawerUSD = 0;
      let drawerLBP = 0;
      let outsideUSD = 0;
      let outsideLBP = 0;

      if (source === 'outside') {
        drawerUSD = 0;
        drawerLBP = 0;
        outsideUSD = sp.outsideAmountUSD != null ? sp.outsideAmountUSD : totalUSD;
        outsideLBP = sp.outsideAmountLBP != null ? sp.outsideAmountLBP : totalLBP;
      } else if (source === 'mixed') {
        drawerUSD = sp.drawerAmountUSD != null ? sp.drawerAmountUSD : 0;
        drawerLBP = sp.drawerAmountLBP != null ? sp.drawerAmountLBP : 0;
        outsideUSD = sp.outsideAmountUSD != null ? sp.outsideAmountUSD : Math.max(0, totalUSD - drawerUSD);
        outsideLBP = sp.outsideAmountLBP != null ? sp.outsideAmountLBP : Math.max(0, totalLBP - drawerLBP);
      } else {
        // 'drawer' (default)
        drawerUSD = sp.drawerAmountUSD != null ? sp.drawerAmountUSD : totalUSD;
        drawerLBP = sp.drawerAmountLBP != null ? sp.drawerAmountLBP : totalLBP;
        outsideUSD = 0;
        outsideLBP = 0;
      }

      if (drawerUSD > 0 || drawerLBP > 0) {
        entries.push({
          id: `suppay-${sp.id}`,
          timestamp: sp.timestamp || new Date(sp.date).getTime(),
          date: sp.date || new Date(sp.timestamp).toISOString(),
          type: 'OUT',
          categoryLabel: source === 'mixed' ? 'Supplier Payout (Mixed Sources)' : 'Supplier Cash Payout',
          categoryKey: 'supplier_payout',
          referenceNumber: sp.receiptNumber || `SUP-${sp.id.substring(0, 6)}`,
          partyName: sp.supplierName || 'Medicine Distributor',
          amountUSD: drawerUSD,
          amountLBP: drawerLBP,
          performedBy: 'Purchaser / Pharmacist',
          notes: `Paid invoice(s): ${(sp.invoices || []).join(', ') || 'Direct COD Settlement'}${
            source === 'mixed'
              ? ` [Drawer: $${drawerUSD.toFixed(2)}${drawerLBP > 0 ? ` + ${formatLBPValue(drawerLBP)} LBP` : ''} | Outside: $${outsideUSD.toFixed(2)}${outsideLBP > 0 ? ` + ${formatLBPValue(outsideLBP)} LBP` : ''}${sp.outsideSourceNote ? ` (${sp.outsideSourceNote})` : ''}]`
              : ''
          }`,
          source: 'supplier_payment',
        });
      } else if (source === 'outside' && (outsideUSD > 0 || outsideLBP > 0)) {
        // Outside payment: 0 deduction from drawer ledger, but visible for audit transparency
        entries.push({
          id: `suppay-${sp.id}`,
          timestamp: sp.timestamp || new Date(sp.date).getTime(),
          date: sp.date || new Date(sp.timestamp).toISOString(),
          type: 'OUT',
          categoryLabel: 'Supplier Payout (Outside Drawer)',
          categoryKey: 'supplier_payout',
          referenceNumber: sp.receiptNumber || `SUP-${sp.id.substring(0, 6)}`,
          partyName: sp.supplierName || 'Medicine Distributor',
          amountUSD: 0,
          amountLBP: 0,
          performedBy: 'Purchaser / Pharmacist',
          notes: `Paid invoice(s): ${(sp.invoices || []).join(', ') || 'Direct COD Settlement'} [Funded Outside: $${outsideUSD.toFixed(2)}${outsideLBP > 0 ? ` + ${formatLBPValue(outsideLBP)} LBP` : ''} (Zero drawer deduction)${sp.outsideSourceNote ? ` - ${sp.outsideSourceNote}` : ''}]`,
          source: 'supplier_payment',
        });
      }
    });

    // D. Operational Expenses (if paid from drawer, deducts ledger; if outside, 0 deduction but logged)
    expenses.forEach((exp) => {
      const isDrawer = exp.paidFromDrawer;
      const usd = isDrawer ? exp.amountUSD : 0;
      const lbp = isDrawer ? exp.amountLBP : 0;

      const categoryLabel = exp.categoryLabel || (
        exp.category === 'rent' ? 'Operational Expense: Rent'
        : exp.category === 'electricity' ? 'Operational Expense: Electricity'
        : exp.category === 'salaries' ? 'Operational Expense: Salary'
        : exp.category === 'generator_fuel' ? 'Operational Expense: Generator / Fuel'
        : exp.category === 'maintenance' ? 'Operational Expense: Maintenance'
        : exp.category === 'cleaning_supplies' ? 'Operational Expense: Cleaning'
        : exp.category === 'taxes_government' ? 'Operational Expense: Taxes / Gov'
        : exp.category === 'internet_telecom' ? 'Operational Expense: Internet / Phone'
        : exp.category === 'transport_delivery' ? 'Operational Expense: Transport'
        : exp.category === 'marketing_promo' ? 'Operational Expense: Marketing'
        : exp.category === 'professional_services' ? 'Operational Expense: Professional'
        : 'Operational Expense'
      );

      const noteDesc = `${exp.title}${exp.payee ? ` • Payee: ${exp.payee}` : ''}${
        isDrawer
          ? ' [Deducted from Cash Drawer]'
          : ` [Paid Outside Drawer: $${exp.amountUSD.toFixed(2)}${exp.amountLBP > 0 ? ` + ${formatLBPValue(exp.amountLBP)} LBP` : ''}]`
      }${exp.notes ? ` • ${exp.notes}` : ''}`;

      entries.push({
        id: `expense-${exp.id}`,
        timestamp: exp.timestamp || new Date(exp.date).getTime(),
        date: exp.date || new Date(exp.timestamp).toISOString(),
        type: 'OUT',
        categoryLabel: isDrawer ? categoryLabel : `${categoryLabel} (External)`,
        categoryKey: 'operational_expense',
        referenceNumber: exp.expenseNumber,
        partyName: exp.payee || 'Operational Expense',
        amountUSD: usd,
        amountLBP: lbp,
        performedBy: exp.paidBy || 'Pharmacist / Admin',
        notes: noteDesc,
        source: 'expense',
      });
    });

    // E. Manual Drawer Additions & Deductions
    manualTransactions.forEach((mt) => {
      let categoryLabel = 'Manual Fund Adjustment';
      if (mt.category === 'starting_float') categoryLabel = 'Starting Cash Float';
      else if (mt.category === 'cash_replenishment') categoryLabel = 'Cash Replenishment';
      else if (mt.category === 'owner_deposit') categoryLabel = 'Owner Capital Deposit';
      else if (mt.category === 'daily_expense') categoryLabel = 'Daily Store Expense';
      else if (mt.category === 'generator_fuel') categoryLabel = 'Generator / Fuel Expense';
      else if (mt.category === 'bank_deposit') categoryLabel = 'Bank Deposit';
      else if (mt.category === 'owner_withdrawal') categoryLabel = 'Owner Withdrawal';
      else if (mt.category === 'delivery_fee') categoryLabel = 'Delivery / Courier Fee';
      else if (mt.category === 'staff_advance') categoryLabel = 'Staff Advance';
      else if (mt.type === 'IN') categoryLabel = 'General Cash In';
      else categoryLabel = 'General Cash Out';

      entries.push({
        id: `manual-${mt.id}`,
        timestamp: mt.timestamp,
        date: mt.date,
        type: mt.type,
        categoryLabel,
        categoryKey: mt.category,
        referenceNumber: mt.voucherNumber,
        partyName:
          mt.category === 'owner_deposit' || mt.category === 'owner_withdrawal'
            ? 'Owner / Management'
            : 'Internal Drawer',
        amountUSD: mt.amountUSD,
        amountLBP: mt.amountLBP,
        performedBy: mt.performedBy,
        notes: mt.reason,
        source: 'manual',
        manualTxId: mt.id,
      });
    });

    // Sort chronologically (oldest first) to compute running balances
    entries.sort((a, b) => a.timestamp - b.timestamp);

    let runningUSD = 0;
    let runningLBP = 0;

    entries.forEach((e) => {
      if (e.type === 'IN') {
        runningUSD += e.amountUSD;
        runningLBP += e.amountLBP;
      } else {
        runningUSD -= e.amountUSD;
        runningLBP -= e.amountLBP;
      }
      e.runningBalanceUSD = runningUSD;
      e.runningBalanceLBP = runningLBP;
    });

    // Return newest first for display
    return entries.reverse();
  }, [sales, customerPayments, supplierPayments, expenses, manualTransactions]);

  // Total Lifetime & Current Drawer Balances
  const drawerSummary = useMemo(() => {
    let currentUSD = 0;
    let currentLBP = 0;
    let todayInflowUSD = 0;
    let todayInflowLBP = 0;
    let todayOutflowUSD = 0;
    let todayOutflowLBP = 0;

    const startOfToday = new Date().setHours(0, 0, 0, 0);

    allLedgerEntries.forEach((e) => {
      // Calculate net balances (allLedgerEntries has everything)
      if (e.type === 'IN') {
        currentUSD += e.amountUSD;
        currentLBP += e.amountLBP;
        if (e.timestamp >= startOfToday) {
          todayInflowUSD += e.amountUSD;
          todayInflowLBP += e.amountLBP;
        }
      } else {
        currentUSD -= e.amountUSD;
        currentLBP -= e.amountLBP;
        if (e.timestamp >= startOfToday) {
          todayOutflowUSD += e.amountUSD;
          todayOutflowLBP += e.amountLBP;
        }
      }
    });

    const netTodayUSD = todayInflowUSD - todayOutflowUSD;
    const netTodayLBP = todayInflowLBP - todayOutflowLBP;

    const totalEquivalentUSD = currentUSD + (currentLBP > 0 ? currentLBP / exchangeRate : 0);
    const totalEquivalentLBP = currentUSD * exchangeRate + currentLBP;

    return {
      currentUSD,
      currentLBP,
      totalEquivalentUSD,
      totalEquivalentLBP,
      todayInflowUSD,
      todayInflowLBP,
      todayOutflowUSD,
      todayOutflowLBP,
      netTodayUSD,
      netTodayLBP,
    };
  }, [allLedgerEntries, exchangeRate]);

  // Filtered entries for the table
  const filteredEntries = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return allLedgerEntries.filter((item) => {
      // Date filter
      if (datePeriod === 'today' && item.timestamp < startOfToday) return false;
      if (
        datePeriod === 'yesterday' &&
        (item.timestamp < startOfYesterday || item.timestamp >= startOfToday)
      )
        return false;
      if (datePeriod === 'week' && item.timestamp < startOfWeek) return false;
      if (datePeriod === 'month' && item.timestamp < startOfMonth) return false;

      // Type filter
      if (filterType === 'in' && item.type !== 'IN') return false;
      if (filterType === 'out' && item.type !== 'OUT') return false;
      if (filterType === 'manual' && item.source !== 'manual') return false;
      if (filterType === 'expense' && item.source !== 'expense') return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchRef = item.referenceNumber.toLowerCase().includes(q);
        const matchParty = (item.partyName || '').toLowerCase().includes(q);
        const matchNotes = item.notes.toLowerCase().includes(q);
        const matchCategory = item.categoryLabel.toLowerCase().includes(q);
        const matchUser = item.performedBy.toLowerCase().includes(q);
        return matchRef || matchParty || matchNotes || matchCategory || matchUser;
      }

      return true;
    });
  }, [allLedgerEntries, datePeriod, filterType, searchTerm]);

  // Handle Counting and Closing Cash Drawer
  const handleOpenCount = () => {
    setCountModalMode('count');
    setIsCountModalOpen(true);
  };

  const handleOpenClose = () => {
    setCountModalMode('close');
    setIsCountModalOpen(true);
  };

  // Handle Manual Fund Addition / Removal
  const handleOpenAdd = () => {
    setModalType('IN');
    setIsModalOpen(true);
  };

  const handleOpenRemove = () => {
    setModalType('OUT');
    setIsModalOpen(true);
  };

  // Delete manual transaction
  const handleDeleteManual = (id: string, voucher: string) => {
    if (window.confirm(`Are you sure you want to void/delete manual voucher ${voucher}?`)) {
      deleteCashDrawerManualTransaction(id);
      reloadManualTransactions();
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Timestamp',
      'Voucher / Ref #',
      'Operation Type',
      'Category',
      'Party / Beneficiary',
      'Amount USD ($)',
      'Amount LBP (L.L.)',
      'Performed By',
      'Notes',
    ];

    const rows = filteredEntries.map((e) => [
      `"${new Date(e.timestamp).toLocaleString()}"`,
      `"${e.referenceNumber}"`,
      `"${e.type === 'IN' ? 'CASH INFLOW (+)' : 'CASH OUTFLOW (-)'}"`,
      `"${e.categoryLabel}"`,
      `"${(e.partyName || '').replace(/"/g, '""')}"`,
      e.amountUSD > 0 ? (e.type === 'IN' ? `+${e.amountUSD.toFixed(2)}` : `-${e.amountUSD.toFixed(2)}`) : '0.00',
      e.amountLBP > 0 ? (e.type === 'IN' ? `+${Math.round(e.amountLBP)}` : `-${Math.round(e.amountLBP)}`) : '0',
      `"${e.performedBy.replace(/"/g, '""')}"`,
      `"${e.notes.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Cash_Drawer_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Banknote className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Physical Cash Drawer Ledger
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time tracking of all cash receipts, POS sales, customer collections, payouts, and manual float adjustments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add Funds Button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-2xs cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Add Funds (Cash In)</span>
          </button>

          {/* Remove Funds Button */}
          <button
            type="button"
            onClick={handleOpenRemove}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700 active:scale-95 transition-all shadow-2xs cursor-pointer"
          >
            <Minus className="h-4 w-4 stroke-[3]" />
            <span>Remove Funds (Cash Out)</span>
          </button>

          {/* Count Cash Drawer Button */}
          <button
            type="button"
            onClick={handleOpenCount}
            className="flex items-center gap-1.5 rounded-lg border border-teal-600 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-300 active:scale-95 transition-all shadow-2xs cursor-pointer"
          >
            <Calculator className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>Count Cash Drawer</span>
          </button>

          {/* Close Cash Drawer Button */}
          <button
            type="button"
            onClick={handleOpenClose}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700 active:scale-95 transition-all shadow-2xs cursor-pointer"
          >
            <Lock className="h-4 w-4" />
            <span>Close Cash Drawer</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          {/* Print */}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer"
          >
            <Printer className="h-4 w-4 text-teal-600" />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Real-time Cash Position */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Drawer USD */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-950 dark:bg-emerald-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Cash in Drawer (USD)
            </span>
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
              ${drawerSummary.currentUSD.toFixed(2)}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-0.5">
              Physical USD banknotes
            </div>
          </div>
        </div>

        {/* Drawer LBP */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm dark:border-blue-950 dark:bg-blue-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
              Cash in Drawer (LBP)
            </span>
            <div className="p-1.5 bg-blue-600 text-white rounded-lg">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-blue-700 dark:text-blue-400 font-mono">
              {formatLBPValue(drawerSummary.currentLBP)}
              <span className="text-xs font-bold ml-1">L.L.</span>
            </div>
            <div className="text-[11px] text-blue-600 dark:text-blue-500 mt-0.5">
              Physical Lebanese Pounds
            </div>
          </div>
        </div>

        {/* Total Combined Value */}
        <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 shadow-sm dark:border-teal-950 dark:bg-teal-950/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
              Total Drawer Value
            </span>
            <div className="p-1.5 bg-teal-600 text-white rounded-lg">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">
              ${drawerSummary.totalEquivalentUSD.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              ≈ {formatLBPValue(drawerSummary.totalEquivalentLBP)} L.L. @ {formatLBPValue(exchangeRate)}
            </div>
          </div>
        </div>

        {/* Today's Cash Flow */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Today's Net Cash Flow
            </span>
            <div className="p-1.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-lg">
              <History className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-xl font-black font-mono ${
              drawerSummary.netTodayUSD >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {drawerSummary.netTodayUSD >= 0 ? '+' : ''}${drawerSummary.netTodayUSD.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
              <span className="text-emerald-600">In: +${drawerSummary.todayInflowUSD.toFixed(0)}</span>
              <span>•</span>
              <span className="text-rose-600">Out: -${drawerSummary.todayOutflowUSD.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm no-print">
        <div className="flex flex-wrap items-center gap-2">
          {/* Period buttons */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setDatePeriod('today')}
              className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                datePeriod === 'today'
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDatePeriod('yesterday')}
              className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                datePeriod === 'yesterday'
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setDatePeriod('week')}
              className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                datePeriod === 'week'
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setDatePeriod('month')}
              className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                datePeriod === 'month'
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setDatePeriod('all')}
              className={`rounded-md px-2.5 py-1 transition-all cursor-pointer ${
                datePeriod === 'all'
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">All Operations</option>
            <option value="in">Cash Inflows Only (+)</option>
            <option value="out">Cash Outflows Only (-)</option>
            <option value="expense">Operational Expenses Only</option>
            <option value="manual">Manual Adjustments Only</option>
          </select>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search ref #, party, note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 bg-slate-50/75 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setActiveTableTab('ledger')}
              className={`rounded-md px-3 py-1 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTableTab === 'ledger'
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Banknote className="h-3.5 w-3.5" />
              <span>Cash Journal ({filteredEntries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTableTab('counts')}
              className={`rounded-md px-3 py-1 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTableTab === 'counts'
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>Physical Counts & Closings ({countRecords.length})</span>
            </button>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {activeTableTab === 'ledger'
              ? 'Real-time cash receipts, payouts & float adjustments'
              : 'Audit history of physical banknote counts & shift reconciliations'}
          </span>
        </div>

        {activeTableTab === 'ledger' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/75 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-900/50 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-2.5">Reference #</th>
                <th className="py-2.5 px-2 text-center">Dir</th>
                <th className="py-2.5 px-3">Category & Party</th>
                <th className="py-2.5 px-3">Description / Notes</th>
                <th className="py-2.5 px-3 text-right">Cash USD</th>
                <th className="py-2.5 px-3 text-right">Cash LBP</th>
                <th className="py-2.5 px-3">Staff / Cashier</th>
                <th className="py-2.5 px-3 text-right">Running USD</th>
                <th className="py-2.5 px-2 text-center no-print">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400 italic">
                    No cash drawer operations found for the selected period.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e) => {
                  const isIn = e.type === 'IN';
                  return (
                    <tr
                      key={e.id}
                      className="hover:bg-teal-50/20 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Date & Time */}
                      <td className="py-2 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {new Date(e.timestamp).toLocaleDateString()} {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Reference # */}
                      <td className="py-2 px-2.5 font-mono font-bold whitespace-nowrap">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                          {e.referenceNumber}
                        </span>
                      </td>

                      {/* Direction */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                            isIn
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {isIn ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                          {isIn ? 'IN' : 'OUT'}
                        </span>
                      </td>

                      {/* Category & Party */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          {e.source === 'pos_sale' && <Receipt className="h-3 w-3 text-teal-600" />}
                          {e.source === 'customer_payment' && <Users className="h-3 w-3 text-blue-600" />}
                          {e.source === 'supplier_payment' && <Building2 className="h-3 w-3 text-amber-600" />}
                          {e.source === 'expense' && <Briefcase className="h-3 w-3 text-rose-600" />}
                          {e.source === 'manual' && <Sparkles className="h-3 w-3 text-purple-600" />}
                          <span>{e.categoryLabel}</span>
                        </div>
                        {e.partyName && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {e.partyName}
                          </div>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={e.notes}>
                        {e.notes}
                      </td>

                      {/* Cash USD */}
                      <td className={`py-2 px-3 text-right font-mono font-bold whitespace-nowrap ${
                        e.amountUSD === 0
                          ? 'text-slate-300 dark:text-slate-600'
                          : isIn
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {e.amountUSD > 0 ? `${isIn ? '+' : '-'}$${e.amountUSD.toFixed(2)}` : '-'}
                      </td>

                      {/* Cash LBP */}
                      <td className={`py-2 px-3 text-right font-mono font-bold whitespace-nowrap ${
                        e.amountLBP === 0
                          ? 'text-slate-300 dark:text-slate-600'
                          : isIn
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {e.amountLBP > 0 ? `${isIn ? '+' : '-'}${formatLBPValue(e.amountLBP)}` : '-'}
                      </td>

                      {/* Staff */}
                      <td className="py-2 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                        {e.performedBy}
                      </td>

                      {/* Running Balance USD */}
                      <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap font-semibold">
                        {e.runningBalanceUSD !== undefined ? `$${e.runningBalanceUSD.toFixed(2)}` : '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-2 text-center whitespace-nowrap no-print">
                        {e.source === 'manual' && e.manualTxId ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteManual(e.manualTxId!, e.referenceNumber)}
                            title="Void / Delete manual transaction"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredEntries.length > 0 && (
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold dark:border-slate-700 dark:bg-slate-800 text-[11px]">
                <tr>
                  <td colSpan={5} className="py-2.5 px-3 uppercase text-slate-700 dark:text-slate-300">
                    Filtered Totals ({filteredEntries.length} items):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                    ${filteredEntries
                      .reduce((sum, e) => sum + (e.type === 'IN' ? e.amountUSD : -e.amountUSD), 0)
                      .toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-blue-700 dark:text-blue-400">
                    {formatLBPValue(
                      filteredEntries.reduce(
                        (sum, e) => sum + (e.type === 'IN' ? e.amountLBP : -e.amountLBP),
                        0
                      )
                    )} L.L.
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        ) : (
          /* Physical Counts and Closeouts Audit Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/75 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-900/50 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-2.5">Audit Ref #</th>
                  <th className="py-2.5 px-2.5">Session Mode</th>
                  <th className="py-2.5 px-3">Auditor / Cashier</th>
                  <th className="py-2.5 px-3 text-right">Physical Count (USD)</th>
                  <th className="py-2.5 px-3 text-right">Physical Count (LBP)</th>
                  <th className="py-2.5 px-3 text-right">Discrepancy (USD)</th>
                  <th className="py-2.5 px-3 text-right">Discrepancy (LBP)</th>
                  <th className="py-2.5 px-3">Closing Action / Transferred</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {countRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center">
                      <Calculator className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-500 dark:text-slate-400 font-medium">No cash drawer counts or shift closeouts recorded yet.</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">Use the "Count Cash Drawer" or "Close Cash Drawer" buttons above to perform an audit.</p>
                    </td>
                  </tr>
                ) : (
                  countRecords.map((rec) => {
                    const isClose = rec.type === 'shift_close';
                    const hasDiscrepancyUSD = Math.abs(rec.diffUSD) > 0.009;
                    const hasDiscrepancyLBP = Math.abs(rec.diffLBP) > 999;

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(rec.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                          <span className="text-[10px] block text-slate-400">
                            {new Date(rec.timestamp).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 font-mono font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {rec.referenceNumber}
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              isClose
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                            }`}
                          >
                            {isClose ? <Lock className="h-3 w-3" /> : <Calculator className="h-3 w-3" />}
                            {isClose ? 'Shift Close (Z-Report)' : 'Spot Cash Count'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {rec.performedBy}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          ${rec.countedUSD.toFixed(2)}
                          <span className="block text-[9px] font-normal text-slate-400">
                            Exp: ${rec.expectedUSD.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                          {formatLBPValue(rec.countedLBP)} L.L.
                          <span className="block text-[9px] font-normal text-slate-400">
                            Exp: {formatLBPValue(rec.expectedLBP)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                          {!hasDiscrepancyUSD ? (
                            <span className="text-emerald-600 font-semibold text-[10px]">Exact Match</span>
                          ) : rec.diffUSD > 0 ? (
                            <span className="text-blue-600 font-bold">Over +${rec.diffUSD.toFixed(2)}</span>
                          ) : (
                            <span className="text-rose-600 font-bold">Short -${Math.abs(rec.diffUSD).toFixed(2)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                          {!hasDiscrepancyLBP ? (
                            <span className="text-emerald-600 font-semibold text-[10px]">Exact Match</span>
                          ) : rec.diffLBP > 0 ? (
                            <span className="text-blue-600 font-bold">Over +{formatLBPValue(rec.diffLBP)}</span>
                          ) : (
                            <span className="text-rose-600 font-bold">Short -{formatLBPValue(Math.abs(rec.diffLBP))}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {rec.closingAction ? (
                            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                              {rec.closingAction === 'leave_float' && (
                                <span className="text-amber-700 dark:text-amber-300 font-semibold">
                                  Float: ${rec.floatCarriedOverUSD || 0} / {formatLBPValue(rec.floatCarriedOverLBP || 0)}
                                </span>
                              )}
                              {rec.closingAction === 'empty_to_safe' && (
                                <span className="text-purple-700 dark:text-purple-300 font-semibold">
                                  Safe: ${rec.withdrawnToSafeUSD?.toFixed(2)} / {formatLBPValue(rec.withdrawnToSafeLBP || 0)}
                                </span>
                              )}
                              {rec.closingAction === 'keep_as_is' && 'Kept all cash in drawer'}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Count only (no transfer)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-[180px] truncate">
                          {rec.notes || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fund Modal */}
      <CashDrawerFundModal
        isOpen={isModalOpen}
        initialType={modalType}
        currentDrawerUSD={drawerSummary.currentUSD}
        currentDrawerLBP={drawerSummary.currentLBP}
        currentUserName={currentUser?.name || 'Cashier'}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => reloadManualTransactions()}
      />

      {/* Count & Close Cash Drawer Modal */}
      <CashDrawerCountModal
        isOpen={isCountModalOpen}
        mode={countModalMode}
        expectedUSD={drawerSummary.currentUSD}
        expectedLBP={drawerSummary.currentLBP}
        exchangeRate={exchangeRate}
        currentUserName={currentUser?.name || 'Cashier'}
        onClose={() => setIsCountModalOpen(false)}
        onSuccess={() => {
          reloadManualTransactions();
          reloadCountRecords();
        }}
      />
    </div>
  );
};
