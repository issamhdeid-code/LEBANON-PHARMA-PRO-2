import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  TrendingUp,
  DollarSign,
  Printer,
  Download,
  Filter,
  PieChart,
  ShoppingBag,
  ArrowUpRight
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { SaleTransaction, ProductCategory } from '../../types/pharmacy';
import { SectionRestoreButton } from '../common/SectionRestoreButton';
import { formatLBPValue } from '../../utils/priceUtils';

export const ReportsView: React.FC = () => {
  const { sales, products, exchangeRate, formatLBP, formatUSD } = usePharmacy();

  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('month');

  // Filter sales according to date range
  const filteredSales = useMemo(() => {
    const now = new Date();
    return sales.filter((s) => {
      const saleDate = new Date(s.timestamp);
      if (dateFilter === 'today') {
        return saleDate.toDateString() === now.toDateString();
      }
      if (dateFilter === 'week') {
        const diff = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24);
        return diff <= 7;
      }
      if (dateFilter === 'month') {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [sales, dateFilter]);

  // Financial aggregates
  const totalSalesUSD = filteredSales.reduce((acc, s) => acc + s.totalUSD, 0);
  const totalSalesLBP = filteredSales.reduce((acc, s) => acc + s.totalLBP, 0);

  // Profit calculation based on pharmacistMarginProfit / costPrice
  const totalProfitUSD = useMemo(() => {
    let profit = 0;
    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const costUSD = prod?.costPriceUSD || item.unitPriceUSD * 0.8;
        profit += (item.unitPriceUSD - costUSD) * item.quantity;
      });
    });
    return profit;
  }, [filteredSales, products]);

  const totalProfitLBP = Math.round(totalProfitUSD * exchangeRate);

  // Category breakdown
  const categoryBreakdown = useMemo<Record<ProductCategory, { count: number; totalUSD: number }>>(() => {
    const stats: Record<ProductCategory, { count: number; totalUSD: number }> = {
      drug: { count: 0, totalUSD: 0 },
      vitamins: { count: 0, totalUSD: 0 },
      cosmetics: { count: 0, totalUSD: 0 },
      para: { count: 0, totalUSD: 0 },
    };

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const cat: ProductCategory = prod?.category || 'drug';
        if (stats[cat]) {
          stats[cat].count += item.quantity;
          stats[cat].totalUSD += item.totalUSD;
        }
      });
    });

    return stats;
  }, [filteredSales, products]);

  // Top Selling Medications
  const topMedications = useMemo(() => {
    const itemMap = new Map<string, { name: string; code: string; qty: number; totalUSD: number }>();
    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = itemMap.get(item.productId);
        if (existing) {
          existing.qty += item.quantity;
          existing.totalUSD += item.totalUSD;
        } else {
          itemMap.set(item.productId, {
            name: item.productName,
            code: item.productCode,
            qty: item.quantity,
            totalUSD: item.totalUSD,
          });
        }
      });
    });

    return Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [filteredSales]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#f8fafc] dark:bg-slate-950 p-3.5 space-y-3 select-none">
      {/* Header & Date Range Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center space-x-2">
            <SectionRestoreButton section="reports" />
            <BarChart3 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
              Financial & Sales Performance Reports
            </h2>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Audit pharmacy turnover in dual currencies ($ & L.L.) and profit margins.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Time range buttons */}
          <div className="flex items-center rounded border border-gray-200 bg-gray-100 p-0.5 dark:border-slate-700 dark:bg-slate-800 text-xs">
            {(['today', 'week', 'month', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateFilter(range)}
                className={`rounded px-2.5 py-1 text-[11px] font-bold capitalize transition-all cursor-pointer ${
                  dateFilter === range
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                {range === 'all' ? 'All Time' : range}
              </button>
            ))}
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards in Dual Currency */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Total Turnover USD */}
        <div className="rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-gray-500 dark:text-slate-400">
              Turnover Revenue ($ USD)
            </span>
            <div className="rounded bg-teal-50 p-1 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-black text-slate-900 dark:text-slate-100">
              ${totalSalesUSD.toFixed(2)}
            </div>
            <div className="text-[10px] font-semibold text-teal-700 dark:text-teal-400 mt-0.5">
              {filteredSales.length} Total Completed Invoices
            </div>
          </div>
        </div>

        {/* Total Turnover LBP */}
        <div className="rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-gray-500 dark:text-slate-400">
              Turnover Revenue (L.L.)
            </span>
            <div className="rounded bg-teal-50 p-1 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-black text-slate-900 dark:text-slate-100">
              {formatLBPValue(totalSalesLBP)} L.L.
            </div>
            <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
              Pegged rate: 1$ = {formatLBPValue(exchangeRate)} L.L.
            </div>
          </div>
        </div>

        {/* Estimated Profit */}
        <div className="rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-gray-500 dark:text-slate-400">
              Gross Pharmacy Margin
            </span>
            <div className="rounded bg-amber-50 p-1 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-xl font-black text-slate-900 dark:text-slate-100">
              ${totalProfitUSD.toFixed(2)}
            </div>
            <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
              ≈ {formatLBPValue(totalProfitLBP)} L.L. (Gross Margin)
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Category Share */}
        <div className="rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-2.5">
            Sales Volume by Product Category
          </h3>
          <div className="space-y-2">
            {(() => {
              const itemsList = Object.values(categoryBreakdown) as { count: number; totalUSD: number }[];
              const totalItems: number = itemsList.reduce((s: number, v) => s + v.count, 0) || 1;
              return (Object.entries(categoryBreakdown) as [ProductCategory, { count: number; totalUSD: number }][]).map(([cat, data]) => {
                const pct = Math.round((data.count / totalItems) * 100);

              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-gray-700 dark:text-slate-300">
                    <span className="capitalize">{cat === 'drug' ? 'Drugs (Medicines)' : cat}</span>
                    <span>
                      {data.count} units (${data.totalUSD.toFixed(2)}) • {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded bg-gray-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded transition-all duration-500 ${
                        cat === 'drug'
                          ? 'bg-teal-600'
                          : cat === 'vitamins'
                          ? 'bg-amber-500'
                          : cat === 'cosmetics'
                          ? 'bg-rose-500'
                          : 'bg-indigo-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            });
          })()}
          </div>
        </div>

        {/* Top Dispensed Medications */}
        <div className="rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-2.5">
            Top Dispensed Medications
          </h3>
          {topMedications.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              No medications recorded in selected timeframe.
            </div>
          ) : (
            <div className="space-y-1.5">
              {topMedications.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded bg-gray-50 p-2 dark:bg-slate-800/50 text-xs border border-gray-100 dark:border-slate-800"
                >
                  <div className="flex items-center space-x-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-teal-50 text-[10px] font-bold text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-300">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                        {item.name}
                      </div>
                      <div className="font-mono text-[9px] text-gray-500">
                        Code: {item.code}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                      {item.qty} units
                    </div>
                    <div className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold">
                      ${item.totalUSD.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Detailed Invoices Table */}
      <div className="rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-3.5 py-2 dark:border-slate-800 dark:bg-slate-800/40 font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">
          Filtered Sales Transaction Logs ({filteredSales.length} Entries)
        </div>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 sticky top-0">
              <tr>
                <th className="py-2 px-3">Receipt #</th>
                <th className="py-2 px-3">Date & Time</th>
                <th className="py-2 px-3">Dispenser</th>
                <th className="py-2 px-3">Customer</th>
                <th className="py-2 px-3">Payment</th>
                <th className="py-2 px-3">Total USD</th>
                <th className="py-2 px-3">Total LBP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-[11px]">
              {filteredSales.map((s) => (
                <tr key={s.id} className="hover:bg-teal-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-1.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {s.invoiceNumber || s.receiptNumber}
                  </td>
                  <td className="py-1.5 px-3 text-gray-600 dark:text-slate-300">
                    {new Date(s.timestamp).toLocaleString()}
                  </td>
                  <td className="py-1.5 px-3 text-gray-600 dark:text-slate-300">
                    {s.cashierName}
                  </td>
                  <td className="py-1.5 px-3 text-gray-600 dark:text-slate-300">
                    {s.customerName || 'Walk-in'}
                  </td>
                  <td className="py-1.5 px-3 uppercase font-semibold text-[10px] text-gray-600 dark:text-slate-400">
                    {s.paymentMethod}
                  </td>
                  <td className="py-1.5 px-3 font-bold text-teal-700 dark:text-teal-400">
                    ${s.totalUSD.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                    {formatLBPValue(s.totalLBP)} L.L.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
