import React, { useState, useMemo } from 'react';
import {
  Search,
  Receipt,
  Eye,
  Edit,
  Printer,
  Trash2,
  Filter,
  Calendar,
  DollarSign,
  Coins,
  ArrowUpDown,
  ShoppingBag,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { SaleTransaction } from '../../types/pharmacy';
import { usePharmacy } from '../../context/PharmacyContext';
import { ViewSaleModal } from './ViewSaleModal';
import { EditSaleModal } from './EditSaleModal';
import { ReceiptModal } from '../common/ReceiptModal';
import { formatLBPValue } from '../../utils/priceUtils';

interface SalesTransactionLogProps {
  onSwitchToCatalog?: () => void;
}

export const SalesTransactionLog: React.FC<SalesTransactionLogProps> = ({ onSwitchToCatalog }) => {
  const { sales, deleteSale, formatUSD, formatLBP, settings } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash_lbp' | 'cash_usd' | 'mixed' | 'credit_debt'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'real' | 'unreal'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Modal states
  const [viewingSale, setViewingSale] = useState<SaleTransaction | null>(null);
  const [editingSale, setEditingSale] = useState<SaleTransaction | null>(null);
  const [printingSale, setPrintingSale] = useState<SaleTransaction | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filtered and sorted sales
  const filteredSales = useMemo(() => {
    return sales
      .filter((sale) => {
        // Type filter: All, Real sales, or Unreal invoices
        if (typeFilter === 'real' && sale.isUnreal) return false;
        if (typeFilter === 'unreal' && !sale.isUnreal) return false;

        // Query match
        const q = searchQuery.trim().toLowerCase();
        const matchQuery =
          !q ||
          (sale.invoiceNumber || '').toLowerCase().includes(q) ||
          (sale.customerName && sale.customerName.toLowerCase().includes(q)) ||
          (sale.cashierName || '').toLowerCase().includes(q) ||
          (sale.isUnreal && (q === 'unreal' || q === 'fictitious')) ||
          (sale.items || []).some(
            (it) =>
              (it.productName || '').toLowerCase().includes(q) ||
              (it.productCode || '').toLowerCase().includes(q)
          );

        // Payment method filter
        const matchPayment = paymentFilter === 'all' || sale.paymentMethod === paymentFilter;

        // Date filter
        const saleDate = new Date(sale.timestamp || sale.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let matchDate = true;
        if (dateFilter === 'today') {
          matchDate = saleDate >= today;
        } else if (dateFilter === 'yesterday') {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          matchDate = saleDate >= yesterday && saleDate < today;
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          matchDate = saleDate >= weekAgo;
        }

        return matchQuery && matchPayment && matchDate;
      })
      .sort((a, b) => {
        const timeA = a.timestamp || new Date(a.date).getTime();
        const timeB = b.timestamp || new Date(b.date).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [sales, searchQuery, dateFilter, paymentFilter, typeFilter, sortOrder]);

  // Aggregate stats (separated for real vs unreal)
  const realSales = useMemo(() => filteredSales.filter(s => !s.isUnreal), [filteredSales]);
  const unrealCount = filteredSales.length - realSales.length;
  const totalVolumeUSD = realSales.reduce((acc, s) => acc + s.totalUSD, 0);
  const totalVolumeLBP = realSales.reduce((acc, s) => acc + s.totalLBP, 0);
  const totalCreditUSD = realSales
    .filter((s) => s.paymentMethod === 'credit_debt')
    .reduce((acc, s) => acc + s.totalUSD, 0);

  const handleDelete = (saleId: string) => {
    deleteSale(saleId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-slate-900 select-none">
      {/* High Density Top Control Bar: Search & Quick Filters */}
      <div className="p-2.5 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/80 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Invoice #, Patient, Item name, or Cashier..."
              className="w-full rounded border border-gray-300 bg-white pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder-gray-400 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Quick Date Filters */}
          <div className="flex items-center space-x-1 text-xs">
            {(['all', 'today', 'yesterday', 'week'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={`rounded px-2 py-0.5 font-bold uppercase text-[10px] transition-colors cursor-pointer ${
                  dateFilter === d
                    ? 'bg-teal-700 text-white shadow-2xs'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {d === 'all' ? 'All Dates' : d}
              </button>
            ))}
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center space-x-1 text-xs">
            {/* Invoice Type Filter: All / Real Sales / Unreal Invoices */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-700 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Invoices</option>
              <option value="real">Real Sales Only</option>
              <option value="unreal">Unreal Invoices Only</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-700 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Payment Types</option>
              <option value="cash_lbp">Cash (L.L.)</option>
              <option value="cash_usd">Cash ($)</option>
              <option value="mixed">Mixed ($ + L.L.)</option>
              <option value="credit_debt">Credit Account</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="rounded border border-gray-300 bg-white p-1 text-gray-500 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              title={`Sort by Date: ${sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Dense Stats Overview Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="rounded border border-gray-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-800/50">
            <span className="text-[9px] uppercase font-bold text-gray-400 block">Total Invoices</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {filteredSales.length} Invoices
              </span>
              {unrealCount > 0 && (
                <span className="rounded bg-amber-100 dark:bg-amber-950 px-1 py-0.2 text-[9px] font-bold text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  {unrealCount} Unreal
                </span>
              )}
            </div>
          </div>

          <div className="rounded border border-gray-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-800/50">
            <span className="text-[9px] uppercase font-bold text-gray-400 block">Real Revenue (USD)</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {formatUSD(totalVolumeUSD)}
            </span>
          </div>

          <div className="rounded border border-gray-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-800/50">
            <span className="text-[9px] uppercase font-bold text-gray-400 block">Real Revenue (L.L.)</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {formatLBP(totalVolumeLBP)}
            </span>
          </div>

          <div className="rounded border border-gray-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-800/50">
            <span className="text-[9px] uppercase font-bold text-gray-400 block">Patient Debt / Credit</span>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              {formatUSD(totalCreditUSD)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 overflow-y-auto">
        {filteredSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 text-gray-400 text-xs">
            <Receipt className="h-10 w-10 text-gray-300 mb-2 dark:text-slate-700" />
            <span className="font-semibold">No sales transactions found.</span>
            <span className="text-[11px] text-gray-400 mt-0.5">
              Completed counter sales and prescriptions will appear here in real-time.
            </span>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-100 dark:bg-slate-800/90 text-[10px] font-bold uppercase text-gray-600 dark:text-slate-300 border-b border-gray-200 dark:border-slate-700 z-10 shadow-2xs">
              <tr>
                <th className="py-2 px-3">Invoice #</th>
                <th className="py-2 px-2.5">Date & Time</th>
                <th className="py-2 px-2.5">Patient / Customer</th>
                <th className="py-2 px-2.5">Items Sold</th>
                <th className="py-2 px-2 text-center">Payment</th>
                <th className="py-2 px-3 text-right">Total Amount</th>
                <th className="py-2 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 font-sans">
              {filteredSales.map((sale) => {
                const saleDate = new Date(sale.timestamp || sale.date);
                const isToday = new Date().toDateString() === saleDate.toDateString();
                const totalItemUnits = (sale.items || []).reduce((acc, it) => acc + it.quantity, 0);

                return (
                  <tr
                    key={sale.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Invoice # */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded border ${
                            sale.isUnreal
                              ? 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800'
                              : 'text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-900'
                          }`}
                        >
                          {sale.invoiceNumber}
                        </span>
                        {sale.isUnreal && (
                          <span
                            className="rounded bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 px-1 py-0.2 text-[9px] font-extrabold uppercase tracking-wide"
                            title="Fictitious / Unreal invoice (no stock deducted)"
                          >
                            Unreal
                          </span>
                        )}
                        {sale.synced && (
                          <span title="Synced across LAN terminals" className="text-emerald-500">
                            •
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        Cashier: {sale.cashierName}
                      </div>
                    </td>

                    {/* Date & Time */}
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {isToday ? 'Today' : saleDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-2 px-2.5">
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                        <span>{sale.customerName || (sale.isUnreal ? 'Unreal Invoice' : 'Cash Client')}</span>
                        {sale.isUnreal && (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-normal">
                            (No stock deduction)
                          </span>
                        )}
                      </div>
                      {sale.notes && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 truncate max-w-[150px]">
                          Note: {sale.notes}
                        </div>
                      )}
                    </td>

                    {/* Items Sold */}
                    <td className="py-2 px-2.5 max-w-[200px]">
                      <div className="flex items-center space-x-1">
                        <span className="rounded bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.2 text-[10px] font-bold">
                          {totalItemUnits} units
                        </span>
                        <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                          {(sale.items || []).map((it) => `${it.productName}${it.isPiece ? ' (Piece)' : ''} (x${it.quantity})`).join(', ')}
                        </span>
                      </div>
                    </td>

                    {/* Payment Method */}
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          sale.paymentMethod === 'cash_lbp'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : sale.paymentMethod === 'cash_usd'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : sale.paymentMethod === 'credit_debt'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {sale.paymentMethod.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="font-bold text-xs text-blue-700 dark:text-blue-300">
                        ${sale.totalUSD.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatLBPValue(sale.totalLBP)} LBP
                      </div>
                      {(sale.writeOffUSD && sale.writeOffUSD >= 0.01) || (sale.writeOffLBP && sale.writeOffLBP > 0) ? (
                        <div className="text-[9px] font-extrabold text-rose-600 dark:text-rose-400">
                          Write-off: {sale.writeOffUSD && sale.writeOffUSD >= 0.01 ? `-$${sale.writeOffUSD.toFixed(2)}` : `-${formatLBPValue(sale.writeOffLBP || 0)} LBP`}
                        </div>
                      ) : null}
                    </td>

                    {/* Actions: View, Edit, Print, Delete */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1">
                        {/* View Button */}
                        <button
                          onClick={() => setViewingSale(sale)}
                          className="rounded p-1 text-gray-500 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 cursor-pointer"
                          title={sale.isUnreal ? "View unreal invoice details" : "View sale transaction details"}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => setEditingSale(sale)}
                          className="rounded p-1 text-gray-500 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 cursor-pointer"
                          title={sale.isUnreal ? "Edit unreal invoice items & quantities" : "Edit completed sale items, quantities & customer"}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>

                        {/* Print Button */}
                        <button
                          onClick={() => setPrintingSale(sale)}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                          title="Print official thermal receipt / invoice"
                        >
                          <Printer className="h-3.5 w-3.5 text-teal-600" />
                        </button>

                        {/* Delete / Void Button */}
                        {confirmDeleteId === sale.id ? (
                          <div className="flex items-center space-x-0.5 bg-rose-50 dark:bg-rose-950/40 p-0.5 rounded border border-rose-200 dark:border-rose-800">
                            <button
                              onClick={() => handleDelete(sale.id)}
                              className="px-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 hover:underline cursor-pointer"
                            >
                              {sale.isUnreal ? 'Delete' : 'Void'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1 text-[10px] text-gray-400 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(sale.id)}
                            className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 cursor-pointer"
                            title={sale.isUnreal ? "Delete unreal invoice from log" : "Void / cancel sale and restock items"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Viewing Modal */}
      {viewingSale && (
        <ViewSaleModal
          sale={viewingSale}
          onClose={() => setViewingSale(null)}
          onEdit={() => {
            const current = viewingSale;
            setViewingSale(null);
            setEditingSale(current);
          }}
          onPrint={() => {
            const current = viewingSale;
            setViewingSale(null);
            setPrintingSale(current);
          }}
        />
      )}

      {/* Editing Modal */}
      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSaved={(updated) => {
            setEditingSale(null);
            // Optionally open receipt or preview
          }}
        />
      )}

      {/* Printing Modal */}
      {printingSale && (
        <ReceiptModal
          sale={printingSale}
          settings={settings}
          onClose={() => setPrintingSale(null)}
        />
      )}
    </div>
  );
};
