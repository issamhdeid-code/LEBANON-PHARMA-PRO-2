import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Package,
  ShoppingCart,
  Users,
  Building2,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  Tag,
  FileSpreadsheet,
  Plus,
  Scale,
  Receipt,
  CheckCircle2
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Product } from '../../types/pharmacy';
import { formatStockDisplay } from '../../utils/stockUtils';
import { formatLBPValue } from '../../utils/priceUtils';
import { SectionRestoreButton } from '../common/SectionRestoreButton';

interface DashboardViewProps {
  onNavigate: (view: any) => void;
  onOpenPriceUpdater: () => void;
  onOpenCSVImport: () => void;
  onViewScientific: (prod: Product) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenPriceUpdater,
  onOpenCSVImport,
  onViewScientific,
}) => {
  const {
    products,
    sales,
    purchases,
    suppliers,
    customers,
    exchangeRate,
    formatLBP,
    formatUSD,
  } = usePharmacy();

  // Today's sales
  const todaySales = useMemo(() => {
    const today = new Date().toDateString();
    return sales.filter((s) => new Date(s.timestamp || s.date).toDateString() === today);
  }, [sales]);

  const todayUSD = todaySales.reduce((acc, s) => acc + s.totalUSD, 0);
  const todayLBP = todaySales.reduce((acc, s) => acc + s.totalLBP, 0);

  // Written-off differences calculations
  const todayWriteOffs = useMemo(() => {
    const today = new Date().toDateString();
    return sales.filter((s) => {
      const isToday = new Date(s.timestamp || s.date).toDateString() === today;
      return isToday && ((s.writeOffUSD && s.writeOffUSD > 0.001) || (s.writeOffLBP && s.writeOffLBP > 0));
    });
  }, [sales]);

  const todayWriteOffUSD = useMemo(() => {
    return todayWriteOffs.reduce((sum, s) => sum + (s.writeOffUSD || 0), 0);
  }, [todayWriteOffs]);

  const todayWriteOffLBP = useMemo(() => {
    return todayWriteOffs.reduce((sum, s) => sum + (s.writeOffLBP || 0), 0);
  }, [todayWriteOffs]);

  const allWriteOffSales = useMemo(() => {
    return sales.filter((s) => (s.writeOffUSD && s.writeOffUSD > 0.001) || (s.writeOffLBP && s.writeOffLBP > 0));
  }, [sales]);

  const totalWriteOffUSD = useMemo(() => {
    return allWriteOffSales.reduce((sum, s) => sum + (s.writeOffUSD || 0), 0);
  }, [allWriteOffSales]);

  const totalWriteOffLBP = useMemo(() => {
    return allWriteOffSales.reduce((sum, s) => sum + (s.writeOffLBP || 0), 0);
  }, [allWriteOffSales]);

  // Low stock products
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stockQuantity <= p.minStockAlert);
  }, [products]);

  // Expiring soon products (e.g. within 2026/2027)
  const expiringProducts = useMemo(() => {
    return products.filter((p) => {
      const exp = new Date(p.expiryDate);
      const now = new Date();
      const diffMonths = (exp.getFullYear() - now.getFullYear()) * 12 + (exp.getMonth() - now.getMonth());
      return diffMonths <= 6;
    });
  }, [products]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#f8fafc] dark:bg-slate-950 p-3.5 space-y-3.5 select-none">
      {/* Top Banner & Quick Shortcuts */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center space-x-2">
            <SectionRestoreButton section="dashboard" />
            <LayoutDashboard className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
              Pharmacy Operations Dashboard
            </h1>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Real-time point-of-sale analytics, inventory alerts, written-off differences audit, and dual-currency revenues.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onNavigate('sale')}
            className="flex items-center space-x-1 rounded bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition-colors cursor-pointer"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>New Sale (POS)</span>
          </button>

          <button
            onClick={onOpenPriceUpdater}
            className="flex items-center space-x-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <Tag className="h-3.5 w-3.5 text-teal-600" />
            <span>Update Drug Price</span>
          </button>

          <button
            onClick={onOpenCSVImport}
            className="flex items-center space-x-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" />
            <span>CSV Import</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Today's Sales USD */}
        <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
              Today's Sales ($ USD)
            </span>
            <div className="rounded bg-teal-50 p-1 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
              <DollarSign className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              ${todayUSD.toFixed(2)}
            </div>
            <div className="text-[10px] font-medium text-teal-700 dark:text-teal-400 mt-0.5">
              {todaySales.length} Transactions Today
            </div>
          </div>
        </div>

        {/* Today's Sales LBP */}
        <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
              Today's Sales (LBP)
            </span>
            <div className="rounded bg-blue-50 p-1 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-lg font-bold text-green-700 dark:text-green-400 truncate">
              {formatLBPValue(todayLBP)} LBP
            </div>
            <div className="text-[10px] font-medium text-gray-500 mt-0.5">
              Rate: 1$ = {formatLBPValue(exchangeRate)} LBP
            </div>
          </div>
        </div>

        {/* Written-off Differences Card */}
        <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
              Written-Off Differences
            </span>
            <div className="rounded bg-rose-50 p-1 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <Scale className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400">
              -${todayWriteOffUSD.toFixed(2)}
            </div>
            <div className="text-[10px] font-medium text-gray-500 dark:text-slate-400 mt-0.5 flex items-center justify-between">
              <span>{todayWriteOffs.length} Today ({formatLBPValue(todayWriteOffLBP)} LBP)</span>
            </div>
            <div className="text-[9px] text-gray-400 dark:text-slate-500 mt-0.5">
              All-Time: -${totalWriteOffUSD.toFixed(2)} ({allWriteOffSales.length} sales)
            </div>
          </div>
        </div>

        {/* Low Inventory Alert Card */}
        <div
          onClick={() => onNavigate('stock')}
          className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 cursor-pointer hover:border-amber-400 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
              Low Stock Alert
            </span>
            <div className="rounded bg-amber-50 p-1 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {lowStockProducts.length} Items
            </div>
            <div className="text-[10px] font-medium text-gray-500 mt-0.5">
              Click to view and restock
            </div>
          </div>
        </div>

        {/* Total Registered Items */}
        <div
          onClick={() => onNavigate('stock')}
          className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 cursor-pointer hover:border-teal-400 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
              Inventory Catalog
            </span>
            <div className="rounded bg-teal-50 p-1 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
              <Package className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {products.length} Products
            </div>
            <div className="text-[10px] font-medium text-gray-500 mt-0.5">
              Drugs, Vitamins, Cosmetics
            </div>
          </div>
        </div>
      </div>

      {/* Two Columns: Low Stock Alerts + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Low Inventory Priority List */}
        <div className="rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-1.5 text-slate-900 dark:text-slate-100 font-bold text-xs uppercase">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <h3>Low Inventory Warning</h3>
              </div>
              <button
                onClick={() => onNavigate('stock')}
                className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="h-3 w-3 ml-0.5" />
              </button>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                All medications are currently stocked above their minimum thresholds!
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {lowStockProducts.slice(0, 5).map((prod) => (
                  <div key={prod.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {prod.name}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Code: {prod.code} • Agent: {prod.agent}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                        {formatStockDisplay(prod.stockQuantity, prod.isDivisible, prod.piecesPerBox, prod.pieceName)} Left (Min: {prod.minStockAlert})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400">
            * Notifications trigger automatically when any item falls below threshold.
          </div>
        </div>

        {/* Recent Sales Register */}
        <div className="rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-1.5 text-slate-900 dark:text-slate-100 font-bold text-xs uppercase">
                <ShoppingCart className="h-3.5 w-3.5 text-teal-600" />
                <h3>Recent Dispensing Invoices</h3>
              </div>
              <button
                onClick={() => onNavigate('reports')}
                className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center cursor-pointer"
              >
                <span>Full Reports</span>
                <ArrowRight className="h-3 w-3 ml-0.5" />
              </button>
            </div>

            {sales.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No invoices recorded yet. Start a sale from the ribbon.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {sales.slice(0, 5).map((sale) => (
                  <div key={sale.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {sale.invoiceNumber || sale.receiptNumber} • {sale.customerName || 'Walk-in Patient'}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {sale.items.length} items
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-600 dark:text-blue-400">
                        ${sale.totalUSD.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-green-700 dark:text-green-400">
                        {formatLBPValue(sale.totalLBP)} LBP
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400">
            * Transactions synchronize in real-time across all LAN connected terminals.
          </div>
        </div>
      </div>

      {/* Differences & Write-Offs Audit Section */}
      <div className="rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center space-x-2">
            <div className="rounded bg-rose-50 p-1.5 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold uppercase text-slate-900 dark:text-slate-100">
                  Payment Differences & Write-Offs Register
                </h3>
                <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  {allWriteOffSales.length} {allWriteOffSales.length === 1 ? 'Sale' : 'Sales'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                Audit log of shortage differences forgiven and accepted during checkout.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-right">
            <div className="rounded bg-rose-50/80 px-3 py-1.5 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/60">
              <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-slate-400 block">
                Total Forgiven Differences
              </span>
              <span className="text-xs font-mono font-extrabold text-rose-600 dark:text-rose-400">
                -${totalWriteOffUSD.toFixed(2)} USD • -{formatLBPValue(totalWriteOffLBP)} LBP
              </span>
            </div>
          </div>
        </div>

        {allWriteOffSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-gray-400">
            <Receipt className="h-8 w-8 text-gray-300 dark:text-slate-700 mb-2" />
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              No payment differences written off yet.
            </span>
            <span className="text-[11px] text-gray-400 mt-0.5 max-w-md">
              When a customer pays less than the invoice total and the cashier checks "Write off differences", the difference is tracked here for register reconciliation.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 dark:border-slate-800 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-gray-600 dark:text-slate-300">
                  <th className="py-2 px-3">Invoice #</th>
                  <th className="py-2 px-3">Date & Time</th>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Cashier</th>
                  <th className="py-2 px-3 text-right">Invoice Total</th>
                  <th className="py-2 px-3 text-right">Cash Received</th>
                  <th className="py-2 px-3 text-right">Difference Written Off</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 font-sans">
                {allWriteOffSales.map((sale) => {
                  const saleDate = new Date(sale.timestamp || sale.date);
                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2 px-3 whitespace-nowrap font-mono font-bold text-teal-700 dark:text-teal-300">
                        {sale.invoiceNumber || sale.receiptNumber}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-gray-600 dark:text-slate-300">
                        <div>{saleDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div className="text-[10px] text-gray-400">{saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">
                        {sale.customerName || 'Cash Client'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-gray-500 dark:text-slate-400">
                        {sale.cashierName || 'Cashier'}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          ${sale.totalUSD.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {formatLBPValue(sale.totalLBP)} LBP
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          ${sale.amountPaidUSD.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {formatLBPValue(sale.amountPaidLBP)} LBP
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap font-mono">
                        <div className="font-extrabold text-xs text-rose-600 dark:text-rose-400">
                          -${(sale.writeOffUSD || 0).toFixed(2)} USD
                        </div>
                        <div className="text-[10px] font-bold text-rose-500 dark:text-rose-400">
                          -{formatLBPValue(sale.writeOffLBP || 0)} LBP
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
    </div>
  );
};
