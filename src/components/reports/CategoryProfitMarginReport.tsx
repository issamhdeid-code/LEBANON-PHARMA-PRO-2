import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Download,
  Printer,
  Search,
  Building2,
  DollarSign,
  TrendingUp,
  PieChart,
  Layers,
  Percent,
  Package,
  FileSpreadsheet,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { ProductCategory } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';

const CATEGORY_META: Record<
  ProductCategory,
  { label: string; badgeColor: string; iconBg: string; description: string }
> = {
  drug: {
    label: 'Drugs & Pharmaceuticals',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
    iconBg: 'bg-blue-500 text-white',
    description: 'MOPH regulated medications, prescription & OTC pharmaceutical drugs.',
  },
  vitamins: {
    label: 'Vitamins & Supplements',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
    iconBg: 'bg-amber-500 text-white',
    description: 'Nutritional supplements, minerals, multivitamins & herbal wellness.',
  },
  cosmetics: {
    label: 'Cosmetics & Dermocosmetics',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900',
    iconBg: 'bg-purple-500 text-white',
    description: 'Skincare, dermatological treatments, hair care, and beauty products.',
  },
  para: {
    label: 'Para-pharmaceutical & Baby',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
    iconBg: 'bg-emerald-500 text-white',
    description: 'Medical disposables, diagnostics, thermometers, diapers & baby care.',
  },
};

export const CategoryProfitMarginReport: React.FC = () => {
  const { sales, settings, exchangeRate } = usePharmacy();

  // Date range presets
  const todayStr = new Date().toISOString().split('T')[0];
  const [dateRangePreset, setDateRangePreset] = useState<'today' | '7days' | 'month' | 'all' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<ProductCategory | 'ALL'>('ALL');

  const handleRangePreset = (preset: 'today' | '7days' | 'month' | 'all' | 'custom') => {
    setDateRangePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate('2020-01-01');
      setEndDate(todayStr);
    }
  };

  // Filtered sales in range (excluding unreal invoices)
  const salesInRange = useMemo(() => {
    return sales.filter((s) => {
      if (s.isUnreal) return false;
      const saleDate = new Date(s.timestamp || s.date).toISOString().split('T')[0];
      return saleDate >= startDate && saleDate <= endDate;
    });
  }, [sales, startDate, endDate]);

  // Aggregated Category Metrics
  interface CategoryData {
    category: ProductCategory;
    distinctProducts: Set<string>;
    totalBoxes: number;
    totalPieces: number;
    revenueUSD: number;
    revenueLBP: number;
    cogsUSD: number;
    profitUSD: number;
    profitLBP: number;
    marginPercent: number;
    markupPercent: number;
    shareOfRevenue: number;
    shareOfProfit: number;
    topProducts: {
      name: string;
      code: string;
      units: number;
      revenueUSD: number;
      profitUSD: number;
    }[];
  }

  const { categoryStats, totalRevenueUSD, totalProfitUSD, totalCOGSUSD, overallMargin } = useMemo(() => {
    const map: Record<ProductCategory, {
      distinctProducts: Set<string>;
      totalBoxes: number;
      totalPieces: number;
      revenueUSD: number;
      revenueLBP: number;
      cogsUSD: number;
      profitUSD: number;
      profitLBP: number;
      productsMap: Map<string, { name: string; code: string; units: number; revenueUSD: number; profitUSD: number }>;
    }> = {
      drug: { distinctProducts: new Set(), totalBoxes: 0, totalPieces: 0, revenueUSD: 0, revenueLBP: 0, cogsUSD: 0, profitUSD: 0, profitLBP: 0, productsMap: new Map() },
      vitamins: { distinctProducts: new Set(), totalBoxes: 0, totalPieces: 0, revenueUSD: 0, revenueLBP: 0, cogsUSD: 0, profitUSD: 0, profitLBP: 0, productsMap: new Map() },
      cosmetics: { distinctProducts: new Set(), totalBoxes: 0, totalPieces: 0, revenueUSD: 0, revenueLBP: 0, cogsUSD: 0, profitUSD: 0, profitLBP: 0, productsMap: new Map() },
      para: { distinctProducts: new Set(), totalBoxes: 0, totalPieces: 0, revenueUSD: 0, revenueLBP: 0, cogsUSD: 0, profitUSD: 0, profitLBP: 0, productsMap: new Map() },
    };

    let grandRevUSD = 0;
    let grandProfitUSD = 0;
    let grandCOGSUSD = 0;

    salesInRange.forEach((sale) => {
      sale.items.forEach((item) => {
        const cat: ProductCategory = (item.category as ProductCategory) in map ? (item.category as ProductCategory) : 'drug';
        const bucket = map[cat];

        bucket.distinctProducts.add(item.productId || item.productCode);
        if (item.isPiece) {
          bucket.totalPieces += item.quantity;
        } else {
          bucket.totalBoxes += item.quantity;
        }

        const revUSD = item.totalUSD || 0;
        const revLBP = item.totalLBP || (revUSD * (sale.exchangeRate || exchangeRate));
        const costUSD = (item.costPriceUSD || 0) * (item.quantity || 1);
        const profitItemUSD = Math.max(0, revUSD - costUSD);
        const profitItemLBP = profitItemUSD * (sale.exchangeRate || exchangeRate);

        bucket.revenueUSD += revUSD;
        bucket.revenueLBP += revLBP;
        bucket.cogsUSD += costUSD;
        bucket.profitUSD += profitItemUSD;
        bucket.profitLBP += profitItemLBP;

        grandRevUSD += revUSD;
        grandProfitUSD += profitItemUSD;
        grandCOGSUSD += costUSD;

        // Track top product
        const pKey = item.productId || item.productCode || item.productName;
        if (!bucket.productsMap.has(pKey)) {
          bucket.productsMap.set(pKey, {
            name: item.productName,
            code: item.productCode,
            units: 0,
            revenueUSD: 0,
            profitUSD: 0,
          });
        }
        const pStat = bucket.productsMap.get(pKey)!;
        pStat.units += item.quantity;
        pStat.revenueUSD += revUSD;
        pStat.profitUSD += profitItemUSD;
      });
    });

    const categoriesOrder: ProductCategory[] = ['drug', 'vitamins', 'cosmetics', 'para'];
    const stats: CategoryData[] = categoriesOrder.map((catKey) => {
      const b = map[catKey];
      const margin = b.revenueUSD > 0 ? (b.profitUSD / b.revenueUSD) * 100 : 0;
      const markup = b.cogsUSD > 0 ? (b.profitUSD / b.cogsUSD) * 100 : 0;
      const shareOfRev = grandRevUSD > 0 ? (b.revenueUSD / grandRevUSD) * 100 : 0;
      const shareOfProf = grandProfitUSD > 0 ? (b.profitUSD / grandProfitUSD) * 100 : 0;

      const top = Array.from(b.productsMap.values())
        .sort((a, b) => b.profitUSD - a.profitUSD)
        .slice(0, 5);

      return {
        category: catKey,
        distinctProducts: b.distinctProducts,
        totalBoxes: b.totalBoxes,
        totalPieces: b.totalPieces,
        revenueUSD: b.revenueUSD,
        revenueLBP: b.revenueLBP,
        cogsUSD: b.cogsUSD,
        profitUSD: b.profitUSD,
        profitLBP: b.profitLBP,
        marginPercent: margin,
        markupPercent: markup,
        shareOfRevenue: shareOfRev,
        shareOfProfit: shareOfProf,
        topProducts: top,
      };
    });

    const overallMarginPct = grandRevUSD > 0 ? (grandProfitUSD / grandRevUSD) * 100 : 0;

    return {
      categoryStats: stats,
      totalRevenueUSD: grandRevUSD,
      totalProfitUSD: grandProfitUSD,
      totalCOGSUSD: grandCOGSUSD,
      overallMargin: overallMarginPct,
    };
  }, [salesInRange, exchangeRate]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Category',
      'Unique SKUs',
      'Boxes Sold',
      'Pieces Sold',
      'Gross Revenue ($ USD)',
      'Gross Revenue (L.L.)',
      'COGS ($ USD)',
      'Gross Profit ($ USD)',
      'Gross Profit (L.L.)',
      'Gross Margin %',
      'Markup %',
      'Share of Sales %',
      'Share of Profit %',
    ];

    const rows = categoryStats.map((c) => [
      `"${CATEGORY_META[c.category].label}"`,
      c.distinctProducts.size,
      c.totalBoxes,
      c.totalPieces,
      c.revenueUSD.toFixed(2),
      Math.round(c.revenueLBP),
      c.cogsUSD.toFixed(2),
      c.profitUSD.toFixed(2),
      Math.round(c.profitLBP),
      `${c.marginPercent.toFixed(1)}%`,
      `${c.markupPercent.toFixed(1)}%`,
      `${c.shareOfRevenue.toFixed(1)}%`,
      `${c.shareOfProfit.toFixed(1)}%`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Category_Profit_Margin_${startDate}_to_${endDate}.csv`);
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
                onClick={() => handleRangePreset('today')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  dateRangePreset === 'today'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleRangePreset('7days')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  dateRangePreset === '7days'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => handleRangePreset('month')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  dateRangePreset === 'month'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => handleRangePreset('all')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  dateRangePreset === 'all'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                All Time
              </button>
            </div>

            <div className="flex items-center space-x-1.5 text-xs text-gray-500">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDateRangePreset('custom');
                }}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateRangePreset('custom');
                }}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={totalRevenueUSD === 0}
              className="flex items-center space-x-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={totalRevenueUSD === 0}
              className="flex items-center space-x-1.5 rounded bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Category Analysis</span>
            </button>
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
          <span>
            Period: <strong className="text-slate-800 dark:text-slate-200">{startDate}</strong> to{' '}
            <strong className="text-slate-800 dark:text-slate-200">{endDate}</strong> ({salesInRange.length} sales analyzed)
          </span>
          <span>Exchange Rate: 1$ = <strong>{formatLBPValue(exchangeRate)} L.L.</strong></span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 no-print">
        <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Total Sales Revenue</span>
            <DollarSign className="h-3.5 w-3.5 text-teal-600" />
          </div>
          <div className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
            ${totalRevenueUSD.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            ≈ {formatLBPValue(totalRevenueUSD * exchangeRate)} L.L.
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Cost of Goods (COGS)</span>
            <Package className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="mt-1 text-base font-black text-slate-700 dark:text-slate-300">
            ${totalCOGSUSD.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Acquisition inventory cost
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Gross Pharmacy Profit</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 text-base font-black text-emerald-600 dark:text-emerald-400">
            ${totalProfitUSD.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            ≈ {formatLBPValue(totalProfitUSD * exchangeRate)} L.L.
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Weighted Margin %</span>
            <Percent className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <div className="mt-1 text-base font-black text-indigo-600 dark:text-indigo-400">
            {overallMargin.toFixed(1)}%
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Overall pharmacy gross margin
          </div>
        </div>
      </div>

      {/* Visual Margin & Sales Proportion Bars */}
      <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-teal-600" />
          <span>Category Share & Profit Margin Distribution</span>
        </h4>
        <div className="space-y-2">
          {categoryStats.map((c) => (
            <div key={c.category} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${c.category === 'drug' ? 'bg-blue-500' : c.category === 'vitamins' ? 'bg-amber-500' : c.category === 'cosmetics' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                  {CATEGORY_META[c.category].label}
                </span>
                <span className="font-mono text-gray-600 dark:text-slate-400">
                  ${c.revenueUSD.toFixed(2)} ({c.shareOfRevenue.toFixed(1)}% of sales) • Margin: <strong className="text-teal-700 dark:text-teal-400">{c.marginPercent.toFixed(1)}%</strong>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${c.category === 'drug' ? 'bg-blue-500' : c.category === 'vitamins' ? 'bg-amber-500' : c.category === 'cosmetics' ? 'bg-purple-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, Math.max(2, c.shareOfRevenue))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

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
                Category Sales & Profit Margin Analysis
              </div>
              <div className="text-[10px] text-gray-600 dark:text-slate-400 mt-1">
                Period: <span className="font-bold text-slate-900 dark:text-slate-200">{startDate}</span> to <span className="font-bold text-slate-900 dark:text-slate-200">{endDate}</span>
              </div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500">
                Generated: {new Date().toLocaleString()} • Rate: 1$ = {formatLBPValue(exchangeRate)} L.L.
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown Table */}
        <div className="p-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-gray-200 bg-gray-100/80 text-[10px] font-bold uppercase text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-2.5">Category</th>
                  <th className="py-2 px-2 text-center">SKUs</th>
                  <th className="py-2 px-2 text-center">Boxes</th>
                  <th className="py-2 px-2 text-center">Pieces</th>
                  <th className="py-2 px-2 text-right">Revenue ($)</th>
                  <th className="py-2 px-2 text-right">Revenue (L.L.)</th>
                  <th className="py-2 px-2 text-right">COGS ($)</th>
                  <th className="py-2 px-2 text-right">Gross Profit ($)</th>
                  <th className="py-2 px-2 text-right">Margin %</th>
                  <th className="py-2 px-2 text-right">Sales Share</th>
                  <th className="py-2 px-2 text-right">Profit Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-[11px]">
                {categoryStats.map((c) => (
                  <tr key={c.category} className="hover:bg-teal-50/30 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-2.5 font-bold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${CATEGORY_META[c.category].badgeColor}`}>
                          {CATEGORY_META[c.category].label}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-gray-600 dark:text-slate-400">
                      {c.distinctProducts.size}
                    </td>
                    <td className="py-2 px-2 text-center font-mono font-semibold">
                      {c.totalBoxes}
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-gray-500">
                      {c.totalPieces}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ${c.revenueUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-gray-700 dark:text-slate-300">
                      {formatLBPValue(c.revenueLBP)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-gray-600 dark:text-slate-400">
                      ${c.cogsUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ${c.profitUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-black text-teal-700 dark:text-teal-400">
                      {c.marginPercent.toFixed(1)}%
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-gray-600 dark:text-slate-400">
                      {c.shareOfRevenue.toFixed(1)}%
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-gray-600 dark:text-slate-400">
                      {c.shareOfProfit.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <td className="py-2 px-2.5 uppercase">Totals:</td>
                  <td className="py-2 px-2 text-center font-mono">
                    {categoryStats.reduce((acc, c) => acc + c.distinctProducts.size, 0)}
                  </td>
                  <td className="py-2 px-2 text-center font-mono">
                    {categoryStats.reduce((acc, c) => acc + c.totalBoxes, 0)}
                  </td>
                  <td className="py-2 px-2 text-center font-mono">
                    {categoryStats.reduce((acc, c) => acc + c.totalPieces, 0)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-900 dark:text-white font-black font-mono">
                    ${totalRevenueUSD.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono">
                    {formatLBPValue(totalRevenueUSD * exchangeRate)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono">
                    ${totalCOGSUSD.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400 font-mono font-black">
                    ${totalProfitUSD.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right text-teal-800 dark:text-teal-300 font-black font-mono">
                    {overallMargin.toFixed(1)}%
                  </td>
                  <td className="py-2 px-2 text-right font-mono">100%</td>
                  <td className="py-2 px-2 text-right font-mono">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Top Products Per Category Sub-section */}
        <div className="border-t border-gray-200 bg-gray-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/20">
          <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200 mb-2">
            Top Profit-Contributing Products per Category
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {categoryStats.map((c) => (
              <div key={c.category} className="rounded border border-gray-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[11px] font-bold text-slate-900 dark:text-white border-b border-gray-100 dark:border-slate-700 pb-1 mb-1.5 flex items-center justify-between">
                  <span>{CATEGORY_META[c.category].label}</span>
                  <span className="text-[9px] font-mono text-teal-600 font-bold">{c.marginPercent.toFixed(0)}% avg</span>
                </div>
                {c.topProducts.length === 0 ? (
                  <div className="text-[10px] text-gray-400 italic py-2 text-center">No sales in period</div>
                ) : (
                  <div className="space-y-1.5">
                    {c.topProducts.slice(0, 3).map((p, idx) => (
                      <div key={p.code + idx} className="text-[10px] flex items-center justify-between">
                        <div className="truncate pr-2 font-medium text-slate-700 dark:text-slate-300">
                          <span className="text-gray-400 mr-1">#{idx + 1}</span>
                          {p.name}
                        </div>
                        <div className="text-right whitespace-nowrap font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">+${p.profitUSD.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-800/30 flex items-center justify-between text-[11px] text-gray-500">
          <span>Official Category Margin Breakdown • Dual Currency System</span>
          <span>Verified by Chief Pharmacist</span>
        </div>
      </div>
    </div>
  );
};
