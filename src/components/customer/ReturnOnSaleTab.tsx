import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Banknote,
  CreditCard,
  Search,
  Plus,
  Trash2,
  Eye,
  Calendar,
  Package,
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  Receipt
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { SaleReturn } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';
import { NewCustomerReturnModal } from './NewCustomerReturnModal';
import { DesktopWindow } from '../common/DesktopWindow';

export const ReturnOnSaleTab: React.FC = () => {
  const {
    saleReturns,
    deleteSaleReturn,
    customers,
    exchangeRate,
  } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState<'all' | 'cash_drawer' | 'customer_credit'>('all');
  const [filterCustomerId, setFilterCustomerId] = useState<string>('all');

  const [isNewReturnModalOpen, setIsNewReturnModalOpen] = useState(false);
  const [selectedReturnForDetail, setSelectedReturnForDetail] = useState<SaleReturn | null>(null);
  const [returnToDelete, setReturnToDelete] = useState<SaleReturn | null>(null);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalReturns = saleReturns.length;
    let cashCount = 0;
    let creditCount = 0;
    let totalCashRefundUSD = 0;
    let totalCashRefundLBP = 0;
    let totalCreditRefundUSD = 0;

    for (const r of saleReturns) {
      if (r.refundMethod === 'customer_credit') {
        creditCount++;
        totalCreditRefundUSD += r.totalRefundUSD || 0;
      } else {
        cashCount++;
        totalCashRefundUSD += r.totalRefundUSD || 0;
        totalCashRefundLBP += r.totalRefundLBP || 0;
      }
    }

    return {
      totalReturns,
      cashCount,
      creditCount,
      totalCashRefundUSD,
      totalCashRefundLBP,
      totalCreditRefundUSD,
    };
  }, [saleReturns]);

  // Filtered Returns
  const filteredReturns = useMemo(() => {
    return saleReturns.filter((r) => {
      // Filter by refund method
      if (filterMethod !== 'all' && r.refundMethod !== filterMethod) {
        return false;
      }

      // Filter by customer
      if (filterCustomerId !== 'all' && r.customerId !== filterCustomerId) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = r.returnNumber.toLowerCase().includes(q);
        const matchCustomer = r.customerName?.toLowerCase().includes(q);
        const matchInvoice = r.originalSaleInvoiceNumber?.toLowerCase().includes(q);
        const matchReason = r.reason?.toLowerCase().includes(q);
        const matchItems = (r.items || []).some(
          (i) => i.productName.toLowerCase().includes(q) || (i.productCode && i.productCode.toLowerCase().includes(q))
        );

        if (!matchNumber && !matchCustomer && !matchInvoice && !matchReason && !matchItems) {
          return false;
        }
      }

      return true;
    });
  }, [saleReturns, filterMethod, filterCustomerId, searchQuery]);

  const confirmDelete = () => {
    if (!returnToDelete) return;
    deleteSaleReturn(returnToDelete.id);
    setReturnToDelete(null);
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Return On Sale (Customer Goods Returns)
            </h2>
            <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-300">
              {saleReturns.length} Total Returns
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Accept returned goods from patients, automatically restore warehouse stock, and deduct from cash drawer or credit balance.
          </p>
        </div>

        <button
          onClick={() => setIsNewReturnModalOpen(true)}
          className="flex items-center justify-center space-x-1.5 rounded bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Customer Return</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Goods Returns</span>
            <RotateCcw className="h-4 w-4 text-teal-600" />
          </div>
          <div className="mt-1 text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            {summary.totalReturns}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {summary.cashCount} cash refunds • {summary.creditCount} customer credits
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Cash Drawer Refunded</span>
            <Banknote className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            ${summary.totalCashRefundUSD.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {formatLBPValue(summary.totalCashRefundLBP)} LBP deducted from Drawer
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Customer Account Credit</span>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-1 text-base font-extrabold text-blue-600 dark:text-blue-400 font-mono">
            ${summary.totalCreditRefundUSD.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Applied directly to reduce patient debts
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs flex flex-col md:flex-row gap-2 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by return #, patient name, original invoice #, item name or reason..."
            className="w-full rounded border border-gray-200 bg-gray-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Method Filter */}
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value as any)}
            className="rounded border border-gray-200 bg-white py-1.5 px-2 text-xs font-semibold text-slate-700 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">All Refund Methods</option>
            <option value="cash_drawer">Cash Drawer Refund</option>
            <option value="customer_credit">Customer Account Credit</option>
          </select>

          {/* Customer Filter */}
          <select
            value={filterCustomerId}
            onChange={(e) => setFilterCustomerId(e.target.value)}
            className="rounded border border-gray-200 bg-white py-1.5 px-2 text-xs font-semibold text-slate-700 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 max-w-[180px]"
          >
            <option value="all">All Patients</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Returns Table */}
      <div className="flex-1 overflow-y-auto rounded border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
        <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-3 py-2.5 whitespace-nowrap">Return #</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Date</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Customer / Patient</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Original Invoice</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Refund Method</th>
              <th className="px-3 py-2.5 text-center whitespace-nowrap">Items</th>
              <th className="px-3 py-2.5 text-right whitespace-nowrap">Refund ($)</th>
              <th className="px-3 py-2.5 text-right whitespace-nowrap">Refund (LBP)</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Reason</th>
              <th className="px-3 py-2.5 text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {filteredReturns.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-3 py-2.5 font-bold font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {r.returnNumber}
                </td>
                <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                  {r.date}
                </td>
                <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {r.customerName || 'Walk-in Patient'}
                </td>
                <td className="px-3 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                  {r.originalSaleInvoiceNumber ? `#${r.originalSaleInvoiceNumber}` : '—'}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                      r.refundMethod === 'customer_credit'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                    }`}
                  >
                    {r.refundMethod === 'customer_credit' ? (
                      <>
                        <CreditCard className="h-3 w-3" />
                        <span>Customer Credit</span>
                      </>
                    ) : (
                      <>
                        <Banknote className="h-3 w-3" />
                        <span>Cash Drawer</span>
                      </>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center font-bold font-mono">
                  {r.items?.length || 0}
                </td>
                <td className="px-3 py-2.5 text-right font-bold font-mono text-teal-600 dark:text-teal-400 whitespace-nowrap">
                  ${(r.totalRefundUSD || 0).toFixed(2)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {formatLBPValue(r.totalRefundLBP || 0)} LBP
                </td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={r.reason}>
                  {r.reason || 'Not specified'}
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center space-x-1.5">
                    <button
                      onClick={() => setSelectedReturnForDetail(r)}
                      className="p-1 text-gray-400 hover:text-teal-600 dark:hover:text-teal-300 cursor-pointer"
                      title="View Voucher Details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setReturnToDelete(r)}
                      className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                      title="Delete Return"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredReturns.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                  No returns on sale matching the selected criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Return Modal */}
      {isNewReturnModalOpen && (
        <NewCustomerReturnModal
          isOpen={isNewReturnModalOpen}
          onClose={() => setIsNewReturnModalOpen(false)}
        />
      )}

      {/* Detail Modal */}
      {selectedReturnForDetail && (
        <DesktopWindow
          id={`sale_return_detail_${selectedReturnForDetail.id}`}
          title={`Return On Sale Voucher #${selectedReturnForDetail.returnNumber}`}
          isOpen={!!selectedReturnForDetail}
          onClose={() => setSelectedReturnForDetail(null)}
          minWidth={680}
          minHeight={480}
          width="760px"
          height="540px"
          section="customer"
        >
          <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs">
            <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 p-4 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      Return #{selectedReturnForDetail.returnNumber}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        selectedReturnForDetail.refundMethod === 'customer_credit'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {selectedReturnForDetail.refundMethod === 'customer_credit' ? (
                        <>
                          <CreditCard className="h-3 w-3" />
                          <span>Customer Credit Account</span>
                        </>
                      ) : (
                        <>
                          <Banknote className="h-3 w-3" />
                          <span>Cash Drawer Refund</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <strong className="text-slate-700 dark:text-slate-300">{selectedReturnForDetail.customerName}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{selectedReturnForDetail.date}</span>
                    </span>
                    {selectedReturnForDetail.originalSaleInvoiceNumber && (
                      <span className="flex items-center gap-1">
                        <Receipt className="h-3.5 w-3.5 text-slate-400" />
                        <span>Invoice #{selectedReturnForDetail.originalSaleInvoiceNumber}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Refund</div>
                  <div className="text-base font-extrabold text-teal-600 font-mono">
                    ${(selectedReturnForDetail.totalRefundUSD || 0).toFixed(2)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {formatLBPValue(selectedReturnForDetail.totalRefundLBP || 0)} LBP
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Item Name</th>
                      <th className="py-2 px-3 text-center">Returned Qty</th>
                      <th className="py-2 px-3 text-right">Unit Refund</th>
                      <th className="py-2 px-3 text-right">Total Refund ($)</th>
                      <th className="py-2 px-3">Batch / Expiry</th>
                      <th className="py-2 px-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(selectedReturnForDetail.items || []).map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold">{it.productName}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold">{it.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono">${(it.unitPriceUSD || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-teal-600">
                          ${(it.totalRefundUSD || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-[11px] font-mono text-slate-500">
                          {it.batchNumber ? `${it.batchNumber} (${it.expiryDate || 'N/A'})` : 'Default'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{it.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 p-3 shrink-0 flex items-center justify-between text-xs">
              <div className="text-slate-500">
                Processed by: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedReturnForDetail.receivedBy || 'Pharmacist'}</span>
              </div>
              <button
                onClick={() => setSelectedReturnForDetail(null)}
                className="rounded bg-slate-200 dark:bg-slate-750 px-4 py-1.5 font-bold hover:bg-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}

      {/* Delete Confirmation Modal */}
      {returnToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-rose-600">
              <AlertCircle className="h-4 w-4" />
              Delete Sale Return #{returnToDelete.returnNumber}?
            </h3>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              This will remove the return voucher, reverse the restocked product quantities from inventory, and reverse the customer credit balance adjustment.
            </p>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setReturnToDelete(null)}
                className="rounded px-3 py-1.5 font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
