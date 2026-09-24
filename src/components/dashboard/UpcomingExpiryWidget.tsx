import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  Calendar,
  AlertOctagon,
  AlertTriangle,
  Clock,
  Info,
  ChevronDown,
  ChevronUp,
  Package,
  Search,
  Filter,
  Copy,
  Download,
  Check,
  Tag,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';
import { Product, ProductBatch } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';
import { formatStockDisplay } from '../../utils/stockUtils';
import { formatDate } from '../../utils/dateUtils';

export interface ExpiringItem {
  product: Product;
  batchNumber: string;
  expiryDateStr: string;
  expiryDateObj: Date;
  daysRemaining: number;
  quantity: number;
  tier: 'expired' | '30days' | '60days' | '90days' | 'later';
  valueUSD: number;
  valueLBP: number;
}

interface UpcomingExpiryWidgetProps {
  products: Product[];
  exchangeRate: number;
  onViewProduct?: (product: Product) => void;
  onOpenPriceUpdater?: (code: string) => void;
  onNavigate?: (view: string) => void;
}

/**
 * Helper to parse various pharmacy expiry date string representations into a valid Date object.
 * Pharmacy conventions:
 * - "YYYY-MM-DD" -> explicit date
 * - "YYYY-MM" -> end of month YYYY-MM
 * - "MM/YYYY" or "MM/YY" -> end of month MM/YYYY
 */
export function parseExpiryDateToObj(expiryStr: string | undefined | null): Date | null {
  if (!expiryStr || expiryStr === '-' || !expiryStr.trim()) return null;
  const str = expiryStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(y, m - 1, d, 23, 59, 59);
    }
  }

  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(str)) {
    const [y, m] = str.split('-').map(Number);
    if (m >= 1 && m <= 12) {
      // Last day of month m
      return new Date(y, m, 0, 23, 59, 59);
    }
  }

  // MM/YYYY or MM/YY or MM-YYYY
  const mmYyyyMatch = str.match(/^(\d{1,2})[\/\.-](\d{2,4})$/);
  if (mmYyyyMatch) {
    const mm = Number(mmYyyyMatch[1]);
    let yyyy = Number(mmYyyyMatch[2]);
    if (yyyy < 100) yyyy += 2000;
    if (mm >= 1 && mm <= 12) {
      // Last day of month mm
      return new Date(yyyy, mm, 0, 23, 59, 59);
    }
  }

  // Fallback
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Calculates calendar days remaining relative to a reference date (defaults to today midnight).
 */
export function calculateDaysRemaining(expiryDateObj: Date, referenceDate: Date = new Date()): number {
  const refUtc = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const expUtc = Date.UTC(expiryDateObj.getFullYear(), expiryDateObj.getMonth(), expiryDateObj.getDate());
  return Math.round((expUtc - refUtc) / (1000 * 60 * 60 * 24));
}

export const UpcomingExpiryWidget: React.FC<UpcomingExpiryWidgetProps> = ({
  products,
  exchangeRate,
  onViewProduct,
  onOpenPriceUpdater,
  onNavigate,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [tierFilter, setTierFilter] = useState<'all' | 'expired' | '30days' | '60days' | '90days'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [hideZeroStock, setHideZeroStock] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Parse all expiring items across products and batch arrays
  // Deferred products keep this full-catalog parse from blocking the main thread
  // during bursts of product/sales changes while the dashboard is open.
  const deferredProducts = useDeferredValue(products);
  const allExpiringItems = useMemo(() => {
    const items: ExpiringItem[] = [];
    const today = new Date();

    deferredProducts.forEach((prod) => {
      // If product has structured batches array with entries
      if (prod.batches && prod.batches.length > 0) {
        prod.batches.forEach((b) => {
          const dateObj = parseExpiryDateToObj(b.expiryDate);
          if (!dateObj) return;

          const days = calculateDaysRemaining(dateObj, today);
          const qty = b.quantity ?? prod.stockQuantity;

          let tier: ExpiringItem['tier'] = 'later';
          if (days <= 0) tier = 'expired';
          else if (days <= 30) tier = '30days';
          else if (days <= 60) tier = '60days';
          else if (days <= 90) tier = '90days';

          const valueUSD = qty * (prod.priceUSD || 0);
          const valueLBP = Math.round(qty * (prod.priceLBP || (prod.priceUSD || 0) * exchangeRate));

          items.push({
            product: prod,
            batchNumber: b.batchNumber || prod.batchNumber || 'N/A',
            expiryDateStr: b.expiryDate,
            expiryDateObj: dateObj,
            daysRemaining: days,
            quantity: qty,
            tier,
            valueUSD,
            valueLBP,
          });
        });
      } else {
        // Fallback to single product.expiryDate
        const dateObj = parseExpiryDateToObj(prod.expiryDate);
        if (!dateObj) return;

        const days = calculateDaysRemaining(dateObj, today);
        const qty = prod.stockQuantity;

        let tier: ExpiringItem['tier'] = 'later';
        if (days <= 0) tier = 'expired';
        else if (days <= 30) tier = '30days';
        else if (days <= 60) tier = '60days';
        else if (days <= 90) tier = '90days';

        const valueUSD = qty * (prod.priceUSD || 0);
        const valueLBP = Math.round(qty * (prod.priceLBP || (prod.priceUSD || 0) * exchangeRate));

        items.push({
          product: prod,
          batchNumber: prod.batchNumber || 'N/A',
          expiryDateStr: prod.expiryDate,
          expiryDateObj: dateObj,
          daysRemaining: days,
          quantity: qty,
          tier,
          valueUSD,
          valueLBP,
        });
      }
    });

    // Sort by days remaining ascending (earliest expiring / expired first)
    return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [deferredProducts, exchangeRate]);

  // Distinct list of agents for dropdown filter
  const uniqueAgents = useMemo(() => {
    const agents = new Set<string>();
    products.forEach((p) => {
      if (p.agent && p.agent.trim()) {
        agents.add(p.agent.trim());
      }
    });
    return Array.from(agents).sort();
  }, [products]);

  // Aggregate counts & values for 30, 60, 90 days and expired
  const metrics = useMemo(() => {
    let expiredCount = 0;
    let expiredValueUSD = 0;
    let expiredValueLBP = 0;

    let days30Count = 0;
    let days30ValueUSD = 0;
    let days30ValueLBP = 0;

    let days60Count = 0;
    let days60ValueUSD = 0;
    let days60ValueLBP = 0;

    let days90Count = 0;
    let days90ValueUSD = 0;
    let days90ValueLBP = 0;

    allExpiringItems.forEach((item) => {
      if (hideZeroStock && item.quantity <= 0) return;

      if (item.tier === 'expired') {
        expiredCount++;
        expiredValueUSD += item.valueUSD;
        expiredValueLBP += item.valueLBP;
      } else if (item.tier === '30days') {
        days30Count++;
        days30ValueUSD += item.valueUSD;
        days30ValueLBP += item.valueLBP;
      } else if (item.tier === '60days') {
        days60Count++;
        days60ValueUSD += item.valueUSD;
        days60ValueLBP += item.valueLBP;
      } else if (item.tier === '90days') {
        days90Count++;
        days90ValueUSD += item.valueUSD;
        days90ValueLBP += item.valueLBP;
      }
    });

    const totalAtRiskCount = expiredCount + days30Count + days60Count + days90Count;
    const totalAtRiskUSD = expiredValueUSD + days30ValueUSD + days60ValueUSD + days90ValueUSD;
    const totalAtRiskLBP = expiredValueLBP + days30ValueLBP + days60ValueLBP + days90ValueLBP;

    return {
      expiredCount,
      expiredValueUSD,
      expiredValueLBP,
      days30Count,
      days30ValueUSD,
      days30ValueLBP,
      days60Count,
      days60ValueUSD,
      days60ValueLBP,
      days90Count,
      days90ValueUSD,
      days90ValueLBP,
      totalAtRiskCount,
      totalAtRiskUSD,
      totalAtRiskLBP,
    };
  }, [allExpiringItems, hideZeroStock]);

  // Filtered list based on controls
  const filteredExpiringItems = useMemo(() => {
    return allExpiringItems.filter((item) => {
      // Stock filter
      if (hideZeroStock && item.quantity <= 0) return false;

      // Tier filter
      if (tierFilter === 'expired' && item.tier !== 'expired') return false;
      if (tierFilter === '30days' && item.tier !== '30days') return false;
      if (tierFilter === '60days' && item.tier !== '60days') return false;
      if (tierFilter === '90days' && item.tier !== '90days') return false;

      // All within 90 days or expired
      if (tierFilter === 'all' && item.tier === 'later') return false;

      // Agent filter
      if (agentFilter !== 'all' && item.product.agent?.trim() !== agentFilter) return false;

      // Search query filter (name, code, agent, batch)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = item.product.name.toLowerCase().includes(q);
        const codeMatch = item.product.code.toLowerCase().includes(q);
        const agentMatch = (item.product.agent || '').toLowerCase().includes(q);
        const batchMatch = item.batchNumber.toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !agentMatch && !batchMatch) return false;
      }

      return true;
    });
  }, [allExpiringItems, hideZeroStock, tierFilter, agentFilter, searchQuery]);

  // Copy report to clipboard
  const handleCopyReport = () => {
    if (filteredExpiringItems.length === 0) return;

    const lines = [
      `LEBANON PHARMA PRO - EXPIRING MEDICINES AUDIT REPORT`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Total Items: ${filteredExpiringItems.length}`,
      `------------------------------------------------------------`,
      `Code\tProduct Name\tAgent\tBatch\tExpiry Date\tDays Left\tStock\tValue (USD)`,
    ];

    filteredExpiringItems.forEach((item) => {
      const expDateDisplay = item.expiryDateObj.toLocaleDateString([], { month: 'short', year: 'numeric' });
      lines.push(
        `${item.product.code}\t${item.product.name}\t${item.product.agent || '-'}\t${item.batchNumber}\t${expDateDisplay}\t${item.daysRemaining <= 0 ? 'EXPIRED' : item.daysRemaining + 'd'}\t${item.quantity}\t$${item.valueUSD.toFixed(2)}`
      );
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export CSV file
  const handleExportCSV = () => {
    if (filteredExpiringItems.length === 0) return;

    const headers = [
      'Product Code',
      'Product Name',
      'Category',
      'Agent / Importer',
      'Batch Number',
      'Expiry Date',
      'Days Remaining',
      'Status Tier',
      'Stock Quantity',
      'Selling Price USD',
      'Total Value USD',
      'Total Value LBP',
    ];

    const rows = filteredExpiringItems.map((item) => [
      `"${item.product.code.replace(/"/g, '""')}"`,
      `"${item.product.name.replace(/"/g, '""')}"`,
      `"${item.product.category}"`,
      `"${(item.product.agent || '').replace(/"/g, '""')}"`,
      `"${item.batchNumber.replace(/"/g, '""')}"`,
      `"${item.expiryDateObj.toLocaleDateString([], { month: '2-digit', year: 'numeric' })}"`,
      item.daysRemaining,
      item.daysRemaining <= 0 ? 'EXPIRED' : `${item.daysRemaining} days`,
      item.quantity,
      item.product.priceUSD.toFixed(2),
      item.valueUSD.toFixed(2),
      item.valueLBP,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `expiring_medicines_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper badge styling
  const renderDaysBadge = (days: number, tier: ExpiringItem['tier']) => {
    if (days <= 0 || tier === 'expired') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-900 dark:bg-rose-950 dark:text-rose-200 uppercase tracking-tight">
          <AlertOctagon className="h-3 w-3 text-rose-600 animate-pulse" />
          {days < 0 ? `Expired ${Math.abs(days)}d ago` : 'Expired Today'}
        </span>
      );
    }
    if (days <= 30 || tier === '30days') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
          <AlertTriangle className="h-3 w-3 text-rose-600" />
          Expires in {days}d (&le;30d)
        </span>
      );
    }
    if (days <= 60 || tier === '60days') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <Clock className="h-3 w-3 text-amber-600" />
          Expires in {days}d (31-60d)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-300">
        <Calendar className="h-3 w-3 text-blue-600" />
        Expires in {days}d (61-90d)
      </span>
    );
  };

  return (
    <div className="rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 transition-all select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="rounded bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Upcoming Medicine Expiry Tracking
              </h3>
              <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                30 / 60 / 90 Days Alert
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Identifies medicines nearing expiration to enable First-Expired-First-Out (FEFO) discounts, return to agents, or quarantine.
            </p>
          </div>
        </div>

        {/* Controls & Export buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyReport}
            disabled={filteredExpiringItems.length === 0}
            className="flex items-center space-x-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer transition-colors"
            title="Copy expiring medicines list to clipboard"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
            <span>{copied ? 'Copied List!' : 'Copy List'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredExpiringItems.length === 0}
            className="flex items-center space-x-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer transition-colors"
            title="Export expiring medicines report to CSV"
          >
            <Download className="h-3.5 w-3.5 text-teal-600" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer"
            title={isExpanded ? 'Collapse expiry widget' : 'Expand expiry widget'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      {isExpanded && (
        <div>
          {/* Summary KPI Cards across timeframes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-gray-100 dark:border-slate-800">
            {/* Expired */}
            <div
              onClick={() => setTierFilter('expired')}
              className={`rounded border p-2.5 cursor-pointer transition-all ${
                tierFilter === 'expired'
                  ? 'border-rose-500 bg-rose-50/90 dark:bg-rose-950/80 shadow-2xs'
                  : 'border-rose-200 bg-white dark:border-rose-900/40 dark:bg-slate-900 hover:border-rose-400'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400">
                <span>Already Expired</span>
                <AlertOctagon className="h-3.5 w-3.5 text-rose-600" />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-base font-extrabold text-rose-700 dark:text-rose-300">
                  {metrics.expiredCount} <span className="text-[10px] font-medium text-rose-600">Items</span>
                </span>
                <span className="text-[10px] font-mono font-bold text-rose-800 dark:text-rose-200">
                  ${metrics.expiredValueUSD.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Within 30 Days */}
            <div
              onClick={() => setTierFilter('30days')}
              className={`rounded border p-2.5 cursor-pointer transition-all ${
                tierFilter === '30days'
                  ? 'border-rose-400 bg-rose-50/80 dark:bg-rose-950/60 shadow-2xs'
                  : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-rose-300'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">
                <span>Within 30 Days</span>
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                  {metrics.days30Count} <span className="text-[10px] font-medium text-gray-500">Items</span>
                </span>
                <span className="text-[10px] font-mono font-semibold text-slate-800 dark:text-slate-200">
                  ${metrics.days30ValueUSD.toFixed(2)}
                </span>
              </div>
            </div>

            {/* 31 to 60 Days */}
            <div
              onClick={() => setTierFilter('60days')}
              className={`rounded border p-2.5 cursor-pointer transition-all ${
                tierFilter === '60days'
                  ? 'border-amber-400 bg-amber-50/80 dark:bg-amber-950/60 shadow-2xs'
                  : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                <span>31 - 60 Days</span>
                <Clock className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                  {metrics.days60Count} <span className="text-[10px] font-medium text-gray-500">Items</span>
                </span>
                <span className="text-[10px] font-mono font-semibold text-slate-800 dark:text-slate-200">
                  ${metrics.days60ValueUSD.toFixed(2)}
                </span>
              </div>
            </div>

            {/* 61 to 90 Days */}
            <div
              onClick={() => setTierFilter('90days')}
              className={`rounded border p-2.5 cursor-pointer transition-all ${
                tierFilter === '90days'
                  ? 'border-blue-400 bg-blue-50/80 dark:bg-blue-950/60 shadow-2xs'
                  : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400">
                <span>61 - 90 Days</span>
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                  {metrics.days90Count} <span className="text-[10px] font-medium text-gray-500">Items</span>
                </span>
                <span className="text-[10px] font-mono font-semibold text-slate-800 dark:text-slate-200">
                  ${metrics.days90ValueUSD.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search drug, agent, batch, code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 text-xs rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {/* Agent Filter */}
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="py-1 px-2.5 text-xs rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Agents / Importers</option>
                {uniqueAgents.map((ag) => (
                  <option key={ag} value={ag}>
                    {ag}
                  </option>
                ))}
              </select>

              {/* Hide Zero Stock Checkbox */}
              <label className="flex items-center space-x-1.5 text-[11px] text-gray-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideZeroStock}
                  onChange={(e) => setHideZeroStock(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span>In-Stock Only</span>
              </label>
            </div>

            {/* Timeframe Pill Filters */}
            <div className="inline-flex rounded-md shadow-2xs" role="group">
              <button
                onClick={() => setTierFilter('all')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-l border cursor-pointer transition-colors ${
                  tierFilter === 'all'
                    ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-700 dark:border-slate-700'
                    : 'bg-white text-slate-700 border-gray-300 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                All (&le;90d)
              </button>
              <button
                onClick={() => setTierFilter('expired')}
                className={`px-2.5 py-1 text-[10px] font-bold border-t border-b cursor-pointer transition-colors ${
                  tierFilter === 'expired'
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-white text-rose-700 border-gray-300 hover:bg-rose-50 dark:bg-slate-800 dark:text-rose-400 dark:border-slate-700'
                }`}
              >
                Expired ({metrics.expiredCount})
              </button>
              <button
                onClick={() => setTierFilter('30days')}
                className={`px-2.5 py-1 text-[10px] font-bold border-t border-b cursor-pointer transition-colors ${
                  tierFilter === '30days'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-rose-600 border-gray-300 hover:bg-rose-50 dark:bg-slate-800 dark:text-rose-400 dark:border-slate-700'
                }`}
              >
                &le; 30d ({metrics.days30Count})
              </button>
              <button
                onClick={() => setTierFilter('60days')}
                className={`px-2.5 py-1 text-[10px] font-bold border-t border-b cursor-pointer transition-colors ${
                  tierFilter === '60days'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-amber-700 border-gray-300 hover:bg-amber-50 dark:bg-slate-800 dark:text-amber-400 dark:border-slate-700'
                }`}
              >
                31-60d ({metrics.days60Count})
              </button>
              <button
                onClick={() => setTierFilter('90days')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-r border cursor-pointer transition-colors ${
                  tierFilter === '90days'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-gray-300 hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-400 dark:border-slate-700'
                }`}
              >
                61-90d ({metrics.days90Count})
              </button>
            </div>
          </div>

          {/* Table View */}
          {filteredExpiringItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              <Package className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-slate-700" />
              <p className="font-semibold text-slate-600 dark:text-slate-400">
                No medications matching the selected expiry filters.
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Great job! All active stock is well beyond 90 days from expiration.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 dark:border-slate-800 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-gray-600 dark:text-slate-300">
                    <th className="py-2.5 px-3">Product Name & Code</th>
                    <th className="py-2.5 px-3">Agent / Importer</th>
                    <th className="py-2.5 px-3">Batch Number</th>
                    <th className="py-2.5 px-3">Expiry Date</th>
                    <th className="py-2.5 px-3">Expiry Urgency Status</th>
                    <th className="py-2.5 px-3 text-center">In Stock</th>
                    <th className="py-2.5 px-3 text-right">Value At Risk</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 font-sans">
                  {filteredExpiringItems.map((item, idx) => {
                    const isExpired = item.daysRemaining <= 0;
                    return (
                      <tr
                        key={`${item.product.id}-${item.batchNumber}-${idx}`}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                          isExpired ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                        }`}
                      >
                        {/* Product Name */}
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>{item.product.name}</span>
                            {onViewProduct && (
                              <button
                                onClick={() => onViewProduct(item.product)}
                                className="text-[10px] text-teal-600 hover:underline cursor-pointer"
                                title="View drug scientific info & inventory"
                              >
                                ℹ
                              </button>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-slate-400">
                            Code: {item.product.code} • Form: {item.product.form || item.product.presentation || '-'}
                          </div>
                        </td>

                        {/* Agent */}
                        <td className="py-2 px-3 text-gray-600 dark:text-slate-300 font-medium">
                          {item.product.agent || '-'}
                        </td>

                        {/* Batch Number */}
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {item.batchNumber}
                        </td>

                        {/* Expiry Date */}
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-700 dark:text-slate-300">
                          {formatDate(item.expiryDateObj)}
                        </td>

                        {/* Urgency Badge */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          {renderDaysBadge(item.daysRemaining, item.tier)}
                        </td>

                        {/* Stock */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span
                            className={`font-bold text-xs ${
                              item.quantity <= 0
                                ? 'text-gray-400'
                                : isExpired
                                ? 'text-rose-700 dark:text-rose-400 font-extrabold'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {formatStockDisplay(
                              item.quantity,
                              item.product.isDivisible,
                              item.product.piecesPerBox,
                              item.product.pieceName
                            )}
                          </span>
                        </td>

                        {/* Value at Risk */}
                        <td className="py-2 px-3 text-right whitespace-nowrap font-mono">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            ${item.valueUSD.toFixed(2)}
                          </div>
                          <div className="text-[9px] text-gray-400">
                            {formatLBPValue(item.valueLBP)} LBP
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center space-x-1">
                            {/* Update Drug Price (FEFO Discount) */}
                            {onOpenPriceUpdater && (
                              <button
                                onClick={() => onOpenPriceUpdater(item.product.code)}
                                className="p-1 rounded text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/60 transition-colors cursor-pointer"
                                title="Update drug price or apply FEFO clearance discount"
                              >
                                <Tag className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Stock Adjustments / Quarantine */}
                            {onNavigate && (
                              <button
                                onClick={() => onNavigate('adjustments')}
                                className="p-1 rounded text-slate-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Navigate to Quantity Adjustments to quarantine or destroy expired batch"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Bar */}
          <div className="p-3 border-t border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-gray-600 dark:text-slate-400">
              <span>Showing:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {filteredExpiringItems.length} of {metrics.totalAtRiskCount} at-risk items
              </span>
              <span className="text-gray-400 font-mono">
                • Total Stock Value: ${metrics.totalAtRiskUSD.toFixed(2)} USD ({formatLBPValue(metrics.totalAtRiskLBP)} LBP)
              </span>
            </div>

            <div className="text-[10px] text-gray-400">
              * In pharmacy practice, items expiring within 30-90 days should be placed upfront or discounted to clear before expiration.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
