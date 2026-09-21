import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  ShoppingCart,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Printer,
  RefreshCw,
  LineChart as LineChartIcon,
  Layers,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { usePharmacy } from '../../context/PharmacyContext';
import { formatLBPValue } from '../../utils/priceUtils';

export type ChartReportType = 'sales_vs_purchase_month' | 'monthly_gross_margin' | 'category_volume_trend';

interface MonthlyDataPoint {
  monthKey: string; // "2026-01"
  monthLabel: string; // "Jan 2026"
  shortLabel: string; // "Jan 26"
  year: number;
  monthIndex: number;
  salesUSD: number;
  salesLBP: number;
  salesCount: number;
  purchasesUSD: number;
  purchasesLBP: number;
  purchasesCount: number;
  netDiffUSD: number;
  netDiffLBP: number;
  ratio: number;
}

export const ChartsReportsView: React.FC = () => {
  const { sales, purchases, exchangeRate } = usePharmacy();

  const [selectedReport, setSelectedReport] = useState<ChartReportType>('sales_vs_purchase_month');
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'LBP'>('USD');
  const [yearFilter, setYearFilter] = useState<string>('last12'); // 'last12', 'all', '2026', '2025', etc.
  const [chartVisualType, setChartVisualType] = useState<'bars' | 'area_lines' | 'composed'>('composed');

  // Extract available years from sales and purchases data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYr = new Date().getFullYear();
    years.add(currentYr);

    sales.forEach((s) => {
      if (s.isUnreal) return;
      const d = new Date(s.timestamp || s.date);
      if (!isNaN(d.getTime())) years.add(d.getFullYear());
    });

    purchases.forEach((p) => {
      const d = new Date(p.date || p.timestamp);
      if (!isNaN(d.getTime())) years.add(d.getFullYear());
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [sales, purchases]);

  // Aggregate monthly data
  const monthlyData = useMemo<MonthlyDataPoint[]>(() => {
    const map = new Map<string, {
      salesUSD: number;
      salesLBP: number;
      salesCount: number;
      purchasesUSD: number;
      purchasesLBP: number;
      purchasesCount: number;
      year: number;
      monthIndex: number;
    }>();

    // 1. Process Sales (exclude isUnreal)
    sales.forEach((sale) => {
      if (sale.isUnreal) return;
      const d = new Date(sale.timestamp || sale.date);
      if (isNaN(d.getTime())) return;
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;

      if (!map.has(key)) {
        map.set(key, {
          salesUSD: 0,
          salesLBP: 0,
          salesCount: 0,
          purchasesUSD: 0,
          purchasesLBP: 0,
          purchasesCount: 0,
          year: y,
          monthIndex: m,
        });
      }

      const entry = map.get(key)!;
      entry.salesUSD += sale.totalUSD || 0;
      entry.salesLBP += sale.totalLBP || Math.round((sale.totalUSD || 0) * (sale.exchangeRate || exchangeRate));
      entry.salesCount += 1;
    });

    // 2. Process Purchases (exclude pending or draft if any)
    purchases.forEach((pur) => {
      const d = new Date(pur.date || pur.timestamp);
      if (isNaN(d.getTime())) return;
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;

      if (!map.has(key)) {
        map.set(key, {
          salesUSD: 0,
          salesLBP: 0,
          salesCount: 0,
          purchasesUSD: 0,
          purchasesLBP: 0,
          purchasesCount: 0,
          year: y,
          monthIndex: m,
        });
      }

      const entry = map.get(key)!;
      const costUSD = pur.totalCostUSD || (pur.totalCostLBP ? pur.totalCostLBP / (pur.exchangeRate || exchangeRate) : 0);
      const costLBP = pur.totalCostLBP || Math.round(costUSD * (pur.exchangeRate || exchangeRate));
      entry.purchasesUSD += costUSD;
      entry.purchasesLBP += costLBP;
      entry.purchasesCount += 1;
    });

    // Ensure at least the last 6 months exist so chart doesn't look empty if new database
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, {
          salesUSD: 0,
          salesLBP: 0,
          salesCount: 0,
          purchasesUSD: 0,
          purchasesLBP: 0,
          purchasesCount: 0,
          year: y,
          monthIndex: m,
        });
      }
    }

    // Convert map to array and sort chronologically
    const allKeys = Array.from(map.keys()).sort();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    let points: MonthlyDataPoint[] = allKeys.map((key) => {
      const item = map.get(key)!;
      const mName = monthNames[item.monthIndex] || 'Mon';
      const fullMName = fullMonthNames[item.monthIndex] || 'Month';
      const sUSD = Number(item.salesUSD.toFixed(2));
      const pUSD = Number(item.purchasesUSD.toFixed(2));
      const sLBP = Math.round(item.salesLBP);
      const pLBP = Math.round(item.purchasesLBP);
      const netUSD = Number((sUSD - pUSD).toFixed(2));
      const netLBP = sLBP - pLBP;
      const ratio = pUSD > 0 ? Number((sUSD / pUSD).toFixed(2)) : (sUSD > 0 ? 99 : 0);

      return {
        monthKey: key,
        monthLabel: `${fullMName} ${item.year}`,
        shortLabel: `${mName} '${String(item.year).slice(2)}`,
        year: item.year,
        monthIndex: item.monthIndex,
        salesUSD: sUSD,
        salesLBP: sLBP,
        salesCount: item.salesCount,
        purchasesUSD: pUSD,
        purchasesLBP: pLBP,
        purchasesCount: item.purchasesCount,
        netDiffUSD: netUSD,
        netDiffLBP: netLBP,
        ratio,
      };
    });

    // Apply yearFilter
    if (yearFilter === 'last12') {
      points = points.slice(-12);
    } else if (yearFilter !== 'all') {
      const selectedYr = parseInt(yearFilter, 10);
      if (!isNaN(selectedYr)) {
        points = points.filter((p) => p.year === selectedYr);
      }
    }

    return points;
  }, [sales, purchases, exchangeRate, yearFilter]);

  // Summary aggregates for the filtered period
  const totalSummary = useMemo(() => {
    let totSalesUSD = 0;
    let totSalesLBP = 0;
    let totSalesCount = 0;
    let totPurchasesUSD = 0;
    let totPurchasesLBP = 0;
    let totPurchasesCount = 0;

    monthlyData.forEach((d) => {
      totSalesUSD += d.salesUSD;
      totSalesLBP += d.salesLBP;
      totSalesCount += d.salesCount;
      totPurchasesUSD += d.purchasesUSD;
      totPurchasesLBP += d.purchasesLBP;
      totPurchasesCount += d.purchasesCount;
    });

    const netUSD = Number((totSalesUSD - totPurchasesUSD).toFixed(2));
    const netLBP = totSalesLBP - totPurchasesLBP;
    const avgSalesUSD = monthlyData.length > 0 ? totSalesUSD / monthlyData.length : 0;
    const avgPurchasesUSD = monthlyData.length > 0 ? totPurchasesUSD / monthlyData.length : 0;
    const overallRatio = totPurchasesUSD > 0 ? totSalesUSD / totPurchasesUSD : (totSalesUSD > 0 ? 1 : 0);

    return {
      totSalesUSD,
      totSalesLBP,
      totSalesCount,
      totPurchasesUSD,
      totPurchasesLBP,
      totPurchasesCount,
      netUSD,
      netLBP,
      avgSalesUSD,
      avgPurchasesUSD,
      overallRatio,
    };
  }, [monthlyData]);

  // Prepare chart payload depending on currency
  const chartPayload = useMemo(() => {
    return monthlyData.map((d) => ({
      name: d.shortLabel,
      fullMonth: d.monthLabel,
      Sales: currencyMode === 'USD' ? d.salesUSD : d.salesLBP,
      Purchases: currencyMode === 'USD' ? d.purchasesUSD : d.purchasesLBP,
      NetCashFlow: currencyMode === 'USD' ? d.netDiffUSD : d.netDiffLBP,
      salesCount: d.salesCount,
      purchasesCount: d.purchasesCount,
      rawUSD: {
        sales: d.salesUSD,
        purchases: d.purchasesUSD,
        net: d.netDiffUSD,
      },
      rawLBP: {
        sales: d.salesLBP,
        purchases: d.purchasesLBP,
        net: d.netDiffLBP,
      },
    }));
  }, [monthlyData, currencyMode]);

  // Export CSV handler
  const handleExportCSV = () => {
    const headers = [
      'Month',
      'Sales (USD)',
      'Sales (LBP)',
      'Sales Invoices Count',
      'Purchases (USD)',
      'Purchases (LBP)',
      'Purchases Invoices Count',
      'Net Difference (USD)',
      'Net Difference (LBP)',
      'Sales/Purchase Ratio',
    ];

    const rows = monthlyData.map((d) => [
      `"${d.monthLabel}"`,
      d.salesUSD.toFixed(2),
      d.salesLBP,
      d.salesCount,
      d.purchasesUSD.toFixed(2),
      d.purchasesLBP,
      d.purchasesCount,
      d.netDiffUSD.toFixed(2),
      d.netDiffLBP,
      d.ratio.toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sales_vs_Purchases_Monthly_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95 text-xs select-none min-w-[210px]">
          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2">
            {data.fullMonth || label}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-teal-600 dark:text-teal-400">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-500 inline-block" />
                Sales ({data.salesCount} inv):
              </span>
              <span className="font-black">
                {currencyMode === 'USD' ? `$${data.rawUSD.sales.toFixed(2)}` : `${formatLBPValue(data.rawLBP.sales)} L.L.`}
              </span>
            </div>
            <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 inline-block" />
                Purchases ({data.purchasesCount} inv):
              </span>
              <span className="font-black">
                {currencyMode === 'USD' ? `$${data.rawUSD.purchases.toFixed(2)}` : `${formatLBPValue(data.rawLBP.purchases)} L.L.`}
              </span>
            </div>
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-bold">
              <span className="text-slate-600 dark:text-slate-400">Net Balance:</span>
              <span className={data.rawUSD.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {currencyMode === 'USD'
                  ? `${data.rawUSD.net >= 0 ? '+' : ''}$${data.rawUSD.net.toFixed(2)}`
                  : `${data.rawLBP.net >= 0 ? '+' : ''}${formatLBPValue(data.rawLBP.net)} L.L.`}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3.5 select-none animate-in fade-in duration-200">
      {/* Controls Bar: Report Selection, Period, Currency, Visualization Style */}
      <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 no-print">
        {/* Left: Report Type Dropdown & Period */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Report:
            </label>
            <div className="relative">
              <select
                value={selectedReport}
                onChange={(e) => setSelectedReport(e.target.value as ChartReportType)}
                className="appearance-none rounded border border-gray-300 bg-slate-50 py-1.5 pl-3 pr-8 text-xs font-bold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              >
                <option value="sales_vs_purchase_month">📊 Sales vs Purchase / Month</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          <div className="h-4 w-px bg-gray-200 dark:bg-slate-700 hidden sm:block" />

          {/* Timeframe Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-teal-600" /> Period:
            </span>
            <div className="flex items-center rounded border border-gray-200 bg-gray-100 p-0.5 dark:border-slate-700 dark:bg-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setYearFilter('last12')}
                className={`rounded px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                  yearFilter === 'last12'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                Last 12 Months
              </button>
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setYearFilter(yr.toString())}
                  className={`rounded px-2 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                    yearFilter === yr.toString()
                      ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                      : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                  }`}
                >
                  {yr}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setYearFilter('all')}
                className={`rounded px-2 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                  yearFilter === 'all'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                All History
              </button>
            </div>
          </div>
        </div>

        {/* Right: Currency Toggle & Chart Visual Mode & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Currency Toggle */}
          <div className="flex items-center rounded border border-gray-200 bg-gray-100 p-0.5 dark:border-slate-700 dark:bg-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setCurrencyMode('USD')}
              className={`rounded px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                currencyMode === 'USD'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setCurrencyMode('LBP')}
              className={`rounded px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                currencyMode === 'LBP'
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
              }`}
            >
              LBP (L.L.)
            </button>
          </div>

          {/* Chart Display Type */}
          <div className="flex items-center rounded border border-gray-200 bg-gray-100 p-0.5 dark:border-slate-700 dark:bg-slate-800 text-xs">
            <button
              type="button"
              title="Combined Bars & Net Flow Trend"
              onClick={() => setChartVisualType('composed')}
              className={`rounded px-2 py-1 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                chartVisualType === 'composed'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
              }`}
            >
              <Layers className="h-3 w-3" />
              <span>Combined</span>
            </button>
            <button
              type="button"
              title="Side-by-Side Comparison Bars"
              onClick={() => setChartVisualType('bars')}
              className={`rounded px-2 py-1 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                chartVisualType === 'bars'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
              }`}
            >
              <BarChart3 className="h-3 w-3" />
              <span>Bars</span>
            </button>
            <button
              type="button"
              title="Continuous Trend Lines"
              onClick={() => setChartVisualType('area_lines')}
              className={`rounded px-2 py-1 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                chartVisualType === 'area_lines'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
              }`}
            >
              <LineChartIcon className="h-3 w-3" />
              <span>Trend</span>
            </button>
          </div>

          {/* Export & Print */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            title="Download Monthly Breakdown as CSV"
          >
            <Download className="h-3.5 w-3.5 text-teal-600" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            title="Print this Chart and Breakdown"
          >
            <Printer className="h-3.5 w-3.5 text-slate-600" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Period Inflow / Outflow / Net Diff / Ratio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Sales Outflow */}
        <div className="rounded border border-teal-200/80 bg-linear-to-br from-white to-teal-50/40 p-3.5 shadow-2xs dark:border-teal-900/50 dark:from-slate-900 dark:to-teal-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-teal-800 dark:text-teal-300">
              Total Inflow (Sales)
            </span>
            <div className="rounded bg-teal-100 p-1 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 dark:text-slate-100">
              {currencyMode === 'USD' ? `$${totalSummary.totSalesUSD.toFixed(2)}` : `${formatLBPValue(totalSummary.totSalesLBP)} L.L.`}
            </div>
            <div className="flex items-center justify-between text-[10px] text-teal-700 dark:text-teal-400 font-semibold mt-1">
              <span>{totalSummary.totSalesCount} Total Invoices</span>
              <span>Avg: ${totalSummary.avgSalesUSD.toFixed(0)}/mo</span>
            </div>
          </div>
        </div>

        {/* Total Purchases */}
        <div className="rounded border border-indigo-200/80 bg-linear-to-br from-white to-indigo-50/40 p-3.5 shadow-2xs dark:border-indigo-900/50 dark:from-slate-900 dark:to-indigo-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-indigo-800 dark:text-indigo-300">
              Total Outflow (Purchases)
            </span>
            <div className="rounded bg-indigo-100 p-1 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 dark:text-slate-100">
              {currencyMode === 'USD' ? `$${totalSummary.totPurchasesUSD.toFixed(2)}` : `${formatLBPValue(totalSummary.totPurchasesLBP)} L.L.`}
            </div>
            <div className="flex items-center justify-between text-[10px] text-indigo-700 dark:text-indigo-400 font-semibold mt-1">
              <span>{totalSummary.totPurchasesCount} Supplier Invoices</span>
              <span>Avg: ${totalSummary.avgPurchasesUSD.toFixed(0)}/mo</span>
            </div>
          </div>
        </div>

        {/* Net Operating Difference */}
        <div className={`rounded border p-3.5 shadow-2xs ${
          totalSummary.netUSD >= 0
            ? 'border-emerald-200/80 bg-linear-to-br from-white to-emerald-50/40 dark:border-emerald-900/50 dark:from-slate-900 dark:to-emerald-950/20'
            : 'border-rose-200/80 bg-linear-to-br from-white to-rose-50/40 dark:border-rose-900/50 dark:from-slate-900 dark:to-rose-950/20'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] uppercase font-bold ${
              totalSummary.netUSD >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'
            }`}>
              Net Flow (Sales - Purchases)
            </span>
            <div className={`rounded p-1 ${
              totalSummary.netUSD >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
            }`}>
              {totalSummary.netUSD >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-xl font-black ${
              totalSummary.netUSD >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
            }`}>
              {currencyMode === 'USD'
                ? `${totalSummary.netUSD >= 0 ? '+' : ''}$${totalSummary.netUSD.toFixed(2)}`
                : `${totalSummary.netLBP >= 0 ? '+' : ''}${formatLBPValue(totalSummary.netLBP)} L.L.`}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-1">
              {totalSummary.netUSD >= 0 ? 'Operating Cash Surplus' : 'Net Re-stock Investment Deficit'}
            </div>
          </div>
        </div>

        {/* Sales / Purchase Ratio */}
        <div className="rounded border border-amber-200/80 bg-linear-to-br from-white to-amber-50/40 p-3.5 shadow-2xs dark:border-amber-900/50 dark:from-slate-900 dark:to-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-amber-800 dark:text-amber-300">
              Turnover Efficiency Ratio
            </span>
            <div className="rounded bg-amber-100 p-1 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 dark:text-slate-100">
              {totalSummary.overallRatio.toFixed(2)}x
            </div>
            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold mt-1">
              {totalSummary.overallRatio >= 1 ? 'Positive Cash Realization' : 'Stock Accumulation Period'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Chart Section */}
      <div className="rounded border border-gray-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-3 mb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-teal-600" />
              Monthly Sales vs Purchases Comparison ({currencyMode})
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Side-by-side analysis of monthly revenue generation vs inventory procurement expenditure.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
              <span className="h-3 w-3 rounded-xs bg-teal-500 inline-block" /> Sales (Revenue)
            </span>
            <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
              <span className="h-3 w-3 rounded-xs bg-indigo-500 inline-block" /> Purchases (Cost)
            </span>
            {chartVisualType === 'composed' && (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="h-1 w-3 bg-amber-500 inline-block" /> Net Cash Flow
              </span>
            )}
          </div>
        </div>

        {/* Recharts Canvas */}
        <div className="h-80 w-full pt-2">
          {chartPayload.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
              <Package className="h-8 w-8 mb-1.5 opacity-40" />
              No transaction or purchase records found for the selected period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartVisualType === 'composed' ? (
                <ComposedChart data={chartPayload} margin={{ top: 10, right: 15, left: 15, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    dy={6}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickFormatter={(val) => (currencyMode === 'USD' ? `$${val}` : `${(val / 1000000).toFixed(1)}M`)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Bar dataKey="Sales" name="Sales Revenue" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={38} />
                  <Bar dataKey="Purchases" name="Purchases Cost" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={38} />
                  <Line
                    type="monotone"
                    dataKey="NetCashFlow"
                    name="Net Cash Flow"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#f59e0b' }}
                  />
                </ComposedChart>
              ) : chartVisualType === 'bars' ? (
                <BarChart data={chartPayload} margin={{ top: 10, right: 15, left: 15, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    dy={6}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickFormatter={(val) => (currencyMode === 'USD' ? `$${val}` : `${(val / 1000000).toFixed(1)}M`)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Bar dataKey="Sales" name="Sales Revenue" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={44} />
                  <Bar dataKey="Purchases" name="Purchases Cost" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              ) : (
                <ComposedChart data={chartPayload} margin={{ top: 10, right: 15, left: 15, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    dy={6}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickFormatter={(val) => (currencyMode === 'USD' ? `$${val}` : `${(val / 1000000).toFixed(1)}M`)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Area
                    type="monotone"
                    dataKey="Sales"
                    name="Sales"
                    fill="#0d9488"
                    fillOpacity={0.15}
                    stroke="#0d9488"
                    strokeWidth={2.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="Purchases"
                    name="Purchases"
                    fill="#6366f1"
                    fillOpacity={0.15}
                    stroke="#6366f1"
                    strokeWidth={2.5}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Monthly Detailed Ledger Table */}
      <div className="rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-3.5 py-2 dark:border-slate-800 dark:bg-slate-800/40 flex items-center justify-between">
          <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">
            Monthly Audit Ledger Breakdown ({monthlyData.length} Months)
          </span>
          <span className="text-[10px] text-gray-500 font-semibold">
            All amounts pegged to official rates
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="py-2.5 px-3">Month</th>
                <th className="py-2.5 px-3 text-right">Sales Inflow ($)</th>
                <th className="py-2.5 px-3 text-right">Sales Inflow (L.L.)</th>
                <th className="py-2.5 px-3 text-center"># Sales</th>
                <th className="py-2.5 px-3 text-right">Purchases Outflow ($)</th>
                <th className="py-2.5 px-3 text-right">Purchases Outflow (L.L.)</th>
                <th className="py-2.5 px-3 text-center"># Purchases</th>
                <th className="py-2.5 px-3 text-right">Net Flow ($)</th>
                <th className="py-2.5 px-3 text-center">Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-[11px]">
              {monthlyData.map((m) => (
                <tr key={m.monthKey} className="hover:bg-teal-50/40 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                    {m.monthLabel}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-teal-700 dark:text-teal-400">
                    ${m.salesUSD.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                    {formatLBPValue(m.salesLBP)} L.L.
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-500">
                    {m.salesCount}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-indigo-700 dark:text-indigo-400">
                    ${m.purchasesUSD.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                    {formatLBPValue(m.purchasesLBP)} L.L.
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-500">
                    {m.purchasesCount}
                  </td>
                  <td className="py-2 px-3 text-right font-bold">
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        m.netDiffUSD >= 0
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                      }`}
                    >
                      {m.netDiffUSD >= 0 ? '+' : ''}${m.netDiffUSD.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                    {m.ratio.toFixed(2)}x
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot className="border-t-2 border-gray-300 bg-gray-50 text-xs font-bold dark:border-slate-700 dark:bg-slate-800">
              <tr>
                <td className="py-2.5 px-3 uppercase text-slate-900 dark:text-slate-100">
                  Total Summary
                </td>
                <td className="py-2.5 px-3 text-right text-teal-700 dark:text-teal-400 font-black">
                  ${totalSummary.totSalesUSD.toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-900 dark:text-slate-100">
                  {formatLBPValue(totalSummary.totSalesLBP)} L.L.
                </td>
                <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300">
                  {totalSummary.totSalesCount}
                </td>
                <td className="py-2.5 px-3 text-right text-indigo-700 dark:text-indigo-400 font-black">
                  ${totalSummary.totPurchasesUSD.toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-900 dark:text-slate-100">
                  {formatLBPValue(totalSummary.totPurchasesLBP)} L.L.
                </td>
                <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300">
                  {totalSummary.totPurchasesCount}
                </td>
                <td className="py-2.5 px-3 text-right font-black">
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold ${
                      totalSummary.netUSD >= 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {totalSummary.netUSD >= 0 ? '+' : ''}${totalSummary.netUSD.toFixed(2)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center text-amber-700 dark:text-amber-400 font-black">
                  {totalSummary.overallRatio.toFixed(2)}x
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
