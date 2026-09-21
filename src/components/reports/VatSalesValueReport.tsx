import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Download,
  Printer,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Package,
  Receipt,
  FileSpreadsheet,
  Building2,
  Percent,
  Layers,
  Sparkles,
  AlertCircle,
  Tag,
  CheckCircle2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { ProductCategory } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';

interface VatItemizedRow {
  saleId: string;
  invoiceNumber: string;
  dateStr: string;
  timeStr: string;
  timestamp: number;
  cashierName: string;
  customerName?: string;
  paymentMethod: string;
  exchangeRate: number;
  productId: string;
  productCode: string;
  barcode?: string;
  productName: string;
  category: ProductCategory;
  quantity: number;
  isPiece?: boolean;
  unitPriceUSD: number;
  unitPriceLBP: number;
  discountPercent: number;
  vatRate: number;
  // Financials
  netTaxableUSD: number;
  netTaxableLBP: number;
  vatAmountUSD: number;
  vatAmountLBP: number;
  grossTotalUSD: number;
  grossTotalLBP: number;
}

interface VatProductSummary {
  productId: string;
  productCode: string;
  barcode?: string;
  productName: string;
  category: ProductCategory;
  totalQuantity: number;
  vatRate: number;
  netTaxableUSD: number;
  netTaxableLBP: number;
  vatAmountUSD: number;
  vatAmountLBP: number;
  grossTotalUSD: number;
  grossTotalLBP: number;
  transactionCount: number;
}

interface VatCategorySummary {
  category: ProductCategory;
  label: string;
  vatRate: number;
  itemCount: number;
  netTaxableUSD: number;
  netTaxableLBP: number;
  vatAmountUSD: number;
  vatAmountLBP: number;
  grossTotalUSD: number;
  grossTotalLBP: number;
}

const CATEGORY_NAMES: Record<ProductCategory, string> = {
  drug: 'Medicines & Pharmaceuticals (Exempt)',
  vitamins: 'Vitamins & Supplements',
  cosmetics: 'Cosmetics & Dermocosmetics',
  para: 'Para-pharmaceutical & Baby'
};

export const VatSalesValueReport: React.FC = () => {
  const { sales, products, settings, exchangeRate, formatUSD } = usePharmacy();

  // Active VAT rates from settings or standard Lebanese tax defaults
  const activeVatRates: Record<ProductCategory, number> = useMemo(() => {
    return (
      settings.vatRates || {
        drug: 0,
        vitamins: 11,
        cosmetics: 11,
        para: 11
      }
    );
  }, [settings.vatRates]);

  // Date Filters
  const todayStr = new Date().toISOString().split('T')[0];
  const [datePreset, setDatePreset] = useState<
    'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'quarter' | 'all' | 'custom'
  >('month');

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Beginning of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Cashier & Category filters
  const [selectedCashier, setSelectedCashier] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'itemized' | 'consolidated' | 'category'>('itemized');

  // Fast Product lookup
  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  // Cashiers list
  const cashiersList = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if (!s.isUnreal && s.cashierName) set.add(s.cashierName);
    });
    return Array.from(set).sort();
  }, [sales]);

  // Preset Handler
  const handleDatePresetChange = (
    preset: 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'quarter' | 'all' | 'custom'
  ) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yStr = d.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(firstDayLastMonth.toISOString().split('T')[0]);
      setEndDate(lastDayLastMonth.toISOString().split('T')[0]);
    } else if (preset === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const startQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
      setStartDate(startQuarter.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate('2020-01-01');
      setEndDate(todayStr);
    }
  };

  // Filter and Gather all items sold with VAT
  const vatItemizedRows = useMemo<VatItemizedRow[]>(() => {
    const rows: VatItemizedRow[] = [];

    sales.forEach((sale) => {
      if (sale.isUnreal) return;
      // Date filter check
      const saleDate = new Date(sale.timestamp || sale.date);
      const saleDateStr = saleDate.toISOString().split('T')[0];

      if (startDate && saleDateStr < startDate) return;
      if (endDate && saleDateStr > endDate) return;

      // Cashier filter
      if (selectedCashier !== 'ALL' && sale.cashierName !== selectedCashier) return;

      const rateLBP = sale.exchangeRate || exchangeRate || 89500;
      const timeStr = saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Examine each sale item for VAT
      sale.items.forEach((item) => {
        const prod = productMap.get(item.productId);
        const itemCategory = item.category || prod?.category || 'drug';
        const rate = activeVatRates[itemCategory] ?? (itemCategory === 'drug' ? 0 : 11);

        // ONLY GATHER ITEMS SOLD WITH VAT (rate > 0)
        if (rate <= 0) return;

        // Category filter
        if (selectedCategory !== 'ALL' && itemCategory !== selectedCategory) return;

        // Base pre-tax calculation
        const discount = item.discountPercent || 0;
        const discountMultiplier = 1 - discount / 100;
        const netTaxableUSD = Number(
          (item.unitPriceUSD * item.quantity * discountMultiplier).toFixed(2)
        );
        const netTaxableLBP = Math.round(netTaxableUSD * rateLBP);

        // VAT Collected
        const vatAmountUSD = Number((netTaxableUSD * (rate / 100)).toFixed(2));
        const vatAmountLBP = Math.round(vatAmountUSD * rateLBP);

        // Gross total with VAT
        const grossTotalUSD = Number((netTaxableUSD + vatAmountUSD).toFixed(2));
        const grossTotalLBP = netTaxableLBP + vatAmountLBP;

        rows.push({
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber || sale.id.slice(-6),
          dateStr: saleDateStr,
          timeStr,
          timestamp: sale.timestamp || saleDate.getTime(),
          cashierName: sale.cashierName || 'Cashier',
          customerName: sale.customerName,
          paymentMethod: sale.paymentMethod,
          exchangeRate: rateLBP,
          productId: item.productId,
          productCode: item.productCode || prod?.code || '',
          barcode: prod?.barcode,
          productName: item.productName || prod?.name || 'Unknown Product',
          category: itemCategory,
          quantity: item.quantity,
          isPiece: item.isPiece,
          unitPriceUSD: item.unitPriceUSD,
          unitPriceLBP: item.unitPriceLBP || Math.round(item.unitPriceUSD * rateLBP),
          discountPercent: discount,
          vatRate: rate,
          netTaxableUSD,
          netTaxableLBP,
          vatAmountUSD,
          vatAmountLBP,
          grossTotalUSD,
          grossTotalLBP
        });
      });
    });

    // Sort by timestamp descending (newest first)
    return rows.sort((a, b) => b.timestamp - a.timestamp);
  }, [sales, startDate, endDate, selectedCashier, selectedCategory, activeVatRates, exchangeRate, productMap]);

  // Search filtered rows
  const filteredItemizedRows = useMemo(() => {
    if (!searchQuery.trim()) return vatItemizedRows;
    const q = searchQuery.toLowerCase().trim();
    return vatItemizedRows.filter((r) => {
      return (
        r.productName.toLowerCase().includes(q) ||
        r.productCode.toLowerCase().includes(q) ||
        (r.barcode && r.barcode.toLowerCase().includes(q)) ||
        r.invoiceNumber.toLowerCase().includes(q) ||
        (r.customerName && r.customerName.toLowerCase().includes(q))
      );
    });
  }, [vatItemizedRows, searchQuery]);

  // Consolidated by product summary
  const productSummaries = useMemo<VatProductSummary[]>(() => {
    const map = new Map<string, VatProductSummary>();

    filteredItemizedRows.forEach((r) => {
      const existing = map.get(r.productId);
      if (existing) {
        existing.totalQuantity += r.quantity;
        existing.netTaxableUSD += r.netTaxableUSD;
        existing.netTaxableLBP += r.netTaxableLBP;
        existing.vatAmountUSD += r.vatAmountUSD;
        existing.vatAmountLBP += r.vatAmountLBP;
        existing.grossTotalUSD += r.grossTotalUSD;
        existing.grossTotalLBP += r.grossTotalLBP;
        existing.transactionCount += 1;
      } else {
        map.set(r.productId, {
          productId: r.productId,
          productCode: r.productCode,
          barcode: r.barcode,
          productName: r.productName,
          category: r.category,
          totalQuantity: r.quantity,
          vatRate: r.vatRate,
          netTaxableUSD: r.netTaxableUSD,
          netTaxableLBP: r.netTaxableLBP,
          vatAmountUSD: r.vatAmountUSD,
          vatAmountLBP: r.vatAmountLBP,
          grossTotalUSD: r.grossTotalUSD,
          grossTotalLBP: r.grossTotalLBP,
          transactionCount: 1
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.netTaxableUSD - a.netTaxableUSD);
  }, [filteredItemizedRows]);

  // Category level breakdown
  const categorySummaries = useMemo<VatCategorySummary[]>(() => {
    const catMap: Partial<Record<ProductCategory, VatCategorySummary>> = {};

    filteredItemizedRows.forEach((r) => {
      const cat = r.category;
      if (!catMap[cat]) {
        catMap[cat] = {
          category: cat,
          label: CATEGORY_NAMES[cat] || cat,
          vatRate: r.vatRate,
          itemCount: 0,
          netTaxableUSD: 0,
          netTaxableLBP: 0,
          vatAmountUSD: 0,
          vatAmountLBP: 0,
          grossTotalUSD: 0,
          grossTotalLBP: 0
        };
      }
      const summary = catMap[cat]!;
      summary.itemCount += r.quantity;
      summary.netTaxableUSD += r.netTaxableUSD;
      summary.netTaxableLBP += r.netTaxableLBP;
      summary.vatAmountUSD += r.vatAmountUSD;
      summary.vatAmountLBP += r.vatAmountLBP;
      summary.grossTotalUSD += r.grossTotalUSD;
      summary.grossTotalLBP += r.grossTotalLBP;
    });

    return Object.values(catMap).sort((a, b) => b.vatAmountUSD - a.vatAmountUSD);
  }, [filteredItemizedRows]);

  // Aggregated Grand Totals
  const totals = useMemo(() => {
    let totalTaxableUSD = 0;
    let totalTaxableLBP = 0;
    let totalVatUSD = 0;
    let totalVatLBP = 0;
    let totalGrossUSD = 0;
    let totalGrossLBP = 0;
    let totalUnitsSold = 0;
    const invoiceSet = new Set<string>();

    filteredItemizedRows.forEach((r) => {
      totalTaxableUSD += r.netTaxableUSD;
      totalTaxableLBP += r.netTaxableLBP;
      totalVatUSD += r.vatAmountUSD;
      totalVatLBP += r.vatAmountLBP;
      totalGrossUSD += r.grossTotalUSD;
      totalGrossLBP += r.grossTotalLBP;
      totalUnitsSold += r.quantity;
      invoiceSet.add(r.invoiceNumber);
    });

    return {
      totalTaxableUSD: Number(totalTaxableUSD.toFixed(2)),
      totalTaxableLBP,
      totalVatUSD: Number(totalVatUSD.toFixed(2)),
      totalVatLBP,
      totalGrossUSD: Number(totalGrossUSD.toFixed(2)),
      totalGrossLBP,
      totalUnitsSold,
      invoiceCount: invoiceSet.size,
      lineItemCount: filteredItemizedRows.length
    };
  }, [filteredItemizedRows]);

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Time',
      'Invoice #',
      'Cashier',
      'Customer',
      'Product Code',
      'Barcode',
      'Product Name',
      'Category',
      'Quantity',
      'Unit Price USD',
      'Discount %',
      'Net Taxable USD',
      'Net Taxable LBP',
      'VAT Rate %',
      'VAT Amount USD',
      'VAT Amount LBP',
      'Gross Total USD',
      'Gross Total LBP'
    ];

    const csvRows = filteredItemizedRows.map((r) => [
      r.dateStr,
      r.timeStr,
      `"${r.invoiceNumber}"`,
      `"${r.cashierName}"`,
      `"${r.customerName || 'Walk-in'}"`,
      `"${r.productCode}"`,
      `"${r.barcode || ''}"`,
      `"${r.productName.replace(/"/g, '""')}"`,
      `"${CATEGORY_NAMES[r.category] || r.category}"`,
      r.quantity,
      r.unitPriceUSD.toFixed(2),
      `${r.discountPercent}%`,
      r.netTaxableUSD.toFixed(2),
      r.netTaxableLBP,
      `${r.vatRate}%`,
      r.vatAmountUSD.toFixed(2),
      r.vatAmountLBP,
      r.grossTotalUSD.toFixed(2),
      r.grossTotalLBP
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `VAT_Sales_Value_Report_${startDate}_to_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* Report Header & Filter Bar */}
      <div className="rounded-lg border border-teal-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="rounded-lg bg-teal-600 p-2 text-white shadow-xs">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-teal-950 dark:text-teal-200">
                  VAT Sales Value Report
                </h3>
                <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                  Tax Value Register
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Official audit of all products sold subject to Value Added Tax (VAT) with net taxable turnover, VAT collected, and gross receipts in dual currency.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={filteredItemizedRows.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 active:scale-98 transition disabled:opacity-50 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300 cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={filteredItemizedRows.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-800 active:scale-98 transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print VAT Declaration</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-3">
          {/* Preset Buttons */}
          <div className="lg:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-teal-600" /> Date Period Preset:
            </label>
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'week', label: '7 Days' },
                { id: 'month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'quarter', label: 'Quarter' },
                { id: 'all', label: 'All' }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleDatePresetChange(p.id as any)}
                  className={`px-2 py-1 text-[11px] font-bold rounded transition cursor-pointer ${
                    datePreset === p.id
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Inputs */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              From Date:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('custom');
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              To Date:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('custom');
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Cashier Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              Cashier / Register:
            </label>
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer"
            >
              <option value="ALL">All Cashiers</option>
              {cashiersList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second Row Filters & Search */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 mt-2.5 border-t border-gray-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by VAT item name, barcode, code, invoice #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1 text-xs text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer"
            >
              <option value="ALL">All VAT Categories</option>
              <option value="vitamins">Vitamins & Supplements ({activeVatRates.vitamins}%)</option>
              <option value="cosmetics">Cosmetics & Dermocosmetics ({activeVatRates.cosmetics}%)</option>
              <option value="para">Para-pharmaceutical & Baby ({activeVatRates.para}%)</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-800">
            <button
              onClick={() => setViewMode('itemized')}
              className={`rounded px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                viewMode === 'itemized'
                  ? 'bg-white text-teal-800 shadow-xs dark:bg-slate-900 dark:text-teal-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Itemized Audit ({filteredItemizedRows.length})
            </button>
            <button
              onClick={() => setViewMode('consolidated')}
              className={`rounded px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                viewMode === 'consolidated'
                  ? 'bg-white text-teal-800 shadow-xs dark:bg-slate-900 dark:text-teal-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Grouped by Product ({productSummaries.length})
            </button>
            <button
              onClick={() => setViewMode('category')}
              className={`rounded px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                viewMode === 'category'
                  ? 'bg-white text-teal-800 shadow-xs dark:bg-slate-900 dark:text-teal-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Category Tax Schedule ({categorySummaries.length})
            </button>
          </div>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 no-print">
        {/* Net Taxable Base Turnover */}
        <div className="rounded-lg border border-teal-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Taxable Base Turnover (Pre-VAT)
            </span>
            <span className="rounded bg-teal-50 p-1 text-teal-700 dark:bg-teal-950 dark:text-teal-400">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
            ${totals.totalTaxableUSD.toFixed(2)}
          </div>
          <div className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400 truncate">
            {formatLBPValue(totals.totalTaxableLBP)} LBP
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Net sale value of all items subject to VAT
          </div>
        </div>

        {/* VAT Value Collected */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 shadow-2xs dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Total VAT Value Collected
            </span>
            <span className="rounded bg-amber-100 p-1 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              <Percent className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-xl font-black text-amber-900 dark:text-amber-200 leading-tight">
            ${totals.totalVatUSD.toFixed(2)}
          </div>
          <div className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 truncate">
            {formatLBPValue(totals.totalVatLBP)} LBP
          </div>
          <div className="mt-1 text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium">
            VAT tax liability payable to Ministry of Finance
          </div>
        </div>

        {/* Total Gross Receipts with VAT */}
        <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 shadow-2xs dark:border-teal-900/50 dark:bg-teal-950/20">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
              Total Gross Sales with VAT
            </span>
            <span className="rounded bg-teal-100 p-1 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-xl font-black text-teal-900 dark:text-teal-200 leading-tight">
            ${totals.totalGrossUSD.toFixed(2)}
          </div>
          <div className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400 truncate">
            {formatLBPValue(totals.totalGrossLBP)} LBP
          </div>
          <div className="mt-1 text-[10px] text-teal-700/80 dark:text-teal-400/80 font-medium">
            Gross cash collected (Pre-Tax + VAT)
          </div>
        </div>

        {/* Transactions & Dispensed Units */}
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Invoices &amp; Items Sold
            </span>
            <span className="rounded bg-slate-100 p-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Receipt className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white leading-tight">
            {totals.totalUnitsSold} <span className="text-xs font-bold text-slate-500">items</span>
          </div>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Across {totals.invoiceCount} invoices ({totals.lineItemCount} lines)
          </div>
          <div className="mt-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> All items verified with active VAT rate
          </div>
        </div>
      </div>

      {/* Category Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 no-print">
        {categorySummaries.map((cat) => (
          <div
            key={cat.category}
            className="rounded-lg border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {cat.label}
                </span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  {cat.vatRate}% VAT
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Net Taxable:</span>
                  <div className="font-bold text-slate-900 dark:text-white">${cat.netTaxableUSD.toFixed(2)}</div>
                  <div className="text-[10px] font-mono text-slate-500">{formatLBPValue(cat.netTaxableLBP)} L.L.</div>
                </div>
                <div>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold">VAT Collected:</span>
                  <div className="font-bold text-amber-700 dark:text-amber-400">+${cat.vatAmountUSD.toFixed(2)}</div>
                  <div className="text-[10px] font-mono text-amber-600/80 dark:text-amber-400/80">{formatLBPValue(cat.vatAmountLBP)} L.L.</div>
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-500">
              <span>{cat.itemCount} units sold</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Gross: ${cat.grossTotalUSD.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Printable & Display Card */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Formal Printable Document Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h2 className="text-base font-black text-slate-900 dark:text-white tracking-wide">
                  {settings.pharmacyName || 'Lebanon Community Pharmacy'}
                </h2>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                <span>License: {settings.licenseNumber || 'MOPH-REGISTERED'}</span>
                <span>•</span>
                <span>Phone: {settings.pharmacyPhone || 'N/A'}</span>
                <span>•</span>
                <span>Address: {settings.pharmacyAddress || 'Beirut, Lebanon'}</span>
                <span>•</span>
                <span>Reference Exchange: 1 USD = {formatLBPValue(exchangeRate)} LBP</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                Official VAT Sales Value Report
              </div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                Period: {startDate} to {endDate}
              </div>
              <div className="text-[10px] text-slate-400">
                Generated on: {new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {filteredItemizedRows.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Percent className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No VAT items sold in the selected period
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Sales in this period consisted of exempt medications (0% VAT), or no sales were recorded between {startDate} and {endDate}.
            </p>
          </div>
        ) : viewMode === 'itemized' ? (
          /* View 1: Itemized Transactions */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  <th className="py-2.5 px-3">Date / Time</th>
                  <th className="py-2.5 px-2.5">Invoice #</th>
                  <th className="py-2.5 px-3">Product Name &amp; Details</th>
                  <th className="py-2.5 px-2.5">Category</th>
                  <th className="py-2.5 px-2 text-center">Qty</th>
                  <th className="py-2.5 px-2.5 text-right">Unit ($)</th>
                  <th className="py-2.5 px-3 text-right">Net Taxable ($)</th>
                  <th className="py-2.5 px-2.5 text-center">VAT %</th>
                  <th className="py-2.5 px-3 text-right font-black text-amber-800 dark:text-amber-300">
                    VAT ($)
                  </th>
                  <th className="py-2.5 px-3 text-right font-black text-teal-800 dark:text-teal-300">
                    Gross ($)
                  </th>
                  <th className="py-2.5 px-3 text-right font-black text-teal-900 dark:text-teal-200">
                    Gross (L.L.)
                  </th>
                  <th className="py-2.5 px-2.5 text-center">Cashier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-medium">
                {filteredItemizedRows.map((row, idx) => (
                  <tr
                    key={`${row.saleId}-${row.productId}-${idx}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 text-[11px]">
                      {row.dateStr} <span className="text-[10px] text-slate-400">{row.timeStr}</span>
                    </td>
                    <td className="py-2 px-2.5 font-mono font-semibold text-teal-800 dark:text-teal-300">
                      #{row.invoiceNumber}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {row.productName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {row.productCode} {row.barcode ? `• ${row.barcode}` : ''}
                      </div>
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {CATEGORY_NAMES[row.category] || row.category}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                      {row.quantity}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                      ${row.unitPriceUSD.toFixed(2)}
                      {row.discountPercent > 0 && (
                        <div className="text-[9px] text-emerald-600">-{row.discountPercent}%</div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ${row.netTaxableUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      <span className="rounded bg-amber-50 px-1 py-0.5 font-mono text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        {row.vatRate}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-50/30 dark:bg-amber-950/10">
                      +${row.vatAmountUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-teal-800 dark:text-teal-300 bg-teal-50/30 dark:bg-teal-950/10">
                      ${row.grossTotalUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-teal-900 dark:text-teal-200">
                      {formatLBPValue(row.grossTotalLBP)}
                    </td>
                    <td className="py-2 px-2.5 text-center text-[10px] text-slate-500 whitespace-nowrap">
                      {row.cashierName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'consolidated' ? (
          /* View 2: Grouped by Product */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-2.5">Code / Barcode</th>
                  <th className="py-2.5 px-2.5">Category</th>
                  <th className="py-2.5 px-2 text-center">Units Sold</th>
                  <th className="py-2.5 px-2 text-center">Invoices</th>
                  <th className="py-2.5 px-2.5 text-center">VAT Rate</th>
                  <th className="py-2.5 px-3 text-right">Net Taxable ($)</th>
                  <th className="py-2.5 px-3 text-right">Net Taxable (L.L.)</th>
                  <th className="py-2.5 px-3 text-right font-black text-amber-800 dark:text-amber-300">
                    VAT Collected ($)
                  </th>
                  <th className="py-2.5 px-3 text-right font-black text-amber-800 dark:text-amber-300">
                    VAT (L.L.)
                  </th>
                  <th className="py-2.5 px-3 text-right font-black text-teal-800 dark:text-teal-300">
                    Gross Total ($)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-medium">
                {productSummaries.map((prod) => (
                  <tr
                    key={prod.productId}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                      {prod.productName}
                    </td>
                    <td className="py-2 px-2.5 font-mono text-[10px] text-slate-500">
                      {prod.productCode} {prod.barcode ? `• ${prod.barcode}` : ''}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {CATEGORY_NAMES[prod.category] || prod.category}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                      {prod.totalQuantity}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-500 font-mono text-[11px]">
                      {prod.transactionCount}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      <span className="rounded bg-amber-50 px-1 py-0.5 font-mono text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        {prod.vatRate}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ${prod.netTaxableUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {formatLBPValue(prod.netTaxableLBP)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-50/30 dark:bg-amber-950/10">
                      +${prod.vatAmountUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                      {formatLBPValue(prod.vatAmountLBP)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-teal-800 dark:text-teal-300 bg-teal-50/30 dark:bg-teal-950/10">
                      ${prod.grossTotalUSD.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* View 3: Category Tax Schedule Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  <th className="py-2.5 px-3">Taxable Category</th>
                  <th className="py-2.5 px-2.5 text-center">Statutory Rate</th>
                  <th className="py-2.5 px-2 text-center">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">Taxable Base ($ USD)</th>
                  <th className="py-2.5 px-3 text-right">Taxable Base (L.L.)</th>
                  <th className="py-2.5 px-3 text-right font-black text-amber-800 dark:text-amber-300">
                    VAT Collected ($ USD)
                  </th>
                  <th className="py-2.5 px-3 text-right font-black text-amber-800 dark:text-amber-300">
                    VAT Collected (L.L.)
                  </th>
                  <th className="py-2.5 px-3 text-right font-black text-teal-800 dark:text-teal-300">
                    Gross Value ($ USD)
                  </th>
                  <th className="py-2.5 px-3 text-right font-black text-teal-900 dark:text-teal-200">
                    Gross Value (L.L.)
                  </th>
                  <th className="py-2.5 px-2.5 text-center">% of Total VAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-medium">
                {categorySummaries.map((cat) => {
                  const pct = totals.totalVatUSD > 0 ? (cat.vatAmountUSD / totals.totalVatUSD) * 100 : 0;
                  return (
                    <tr
                      key={cat.category}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {cat.label}
                      </td>
                      <td className="py-2.5 px-2.5 text-center">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          {cat.vatRate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                        {cat.itemCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ${cat.netTaxableUSD.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatLBPValue(cat.netTaxableLBP)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-50/30 dark:bg-amber-950/10">
                        +${cat.vatAmountUSD.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                        {formatLBPValue(cat.vatAmountLBP)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-800 dark:text-teal-300 bg-teal-50/30 dark:bg-teal-950/10">
                        ${cat.grossTotalUSD.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-900 dark:text-teal-200">
                        {formatLBPValue(cat.grossTotalLBP)}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-bold text-slate-700 dark:text-slate-300 font-mono">
                        {pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Totals Row */}
        {filteredItemizedRows.length > 0 && (
          <div className="p-3.5 border-t border-gray-200 bg-slate-100/90 dark:border-slate-800 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-slate-800 dark:text-slate-200">
            <div className="flex items-center gap-3">
              <span>Total Lines: {filteredItemizedRows.length}</span>
              <span>•</span>
              <span>Total Units: {totals.totalUnitsSold}</span>
              <span>•</span>
              <span>Invoices: {totals.invoiceCount}</span>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-500 font-normal">Base Taxable: </span>
                <span className="font-black text-slate-900 dark:text-white">
                  ${totals.totalTaxableUSD.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">
                  ({formatLBPValue(totals.totalTaxableLBP)} LBP)
                </span>
              </div>
              <div className="text-amber-800 dark:text-amber-300">
                <span className="font-normal text-amber-700 dark:text-amber-400">Total VAT: </span>
                <span className="font-black">
                  +${totals.totalVatUSD.toFixed(2)}
                </span>
                <span className="text-[10px] ml-1">
                  ({formatLBPValue(totals.totalVatLBP)} LBP)
                </span>
              </div>
              <div className="text-teal-800 dark:text-teal-300">
                <span className="font-normal text-teal-700 dark:text-teal-400">Gross Total: </span>
                <span className="font-black text-sm">
                  ${totals.totalGrossUSD.toFixed(2)}
                </span>
                <span className="text-[10px] ml-1 font-mono">
                  ({formatLBPValue(totals.totalGrossLBP)} LBP)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Printable Official Sign-off Block */}
        <div className="hidden print:block p-8 pt-12 text-xs border-t border-gray-300">
          <div className="grid grid-cols-2 gap-12 text-center">
            <div>
              <div className="border-t border-gray-400 pt-2 font-bold uppercase tracking-wider text-gray-700">
                Prepared By (Pharmacist-in-Charge)
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                Name &amp; Order of Pharmacists in Lebanon (OPL) Registration No.
              </div>
            </div>
            <div>
              <div className="border-t border-gray-400 pt-2 font-bold uppercase tracking-wider text-gray-700">
                Certified Tax Declaration &amp; Auditor Stamp
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                Official Ministry of Finance Lebanese Republic Filing Verification
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
