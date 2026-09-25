import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  RefreshCw,
  Banknote,
  Search,
  Plus,
  Trash2,
  Eye,
  Calendar,
  Building2,
  Package,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { PurchaseReturn } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';
import { NewPurchaseReturnModal } from './NewPurchaseReturnModal';
import { PurchaseReturnDetailModal } from './PurchaseReturnDetailModal';

export const PurchaseReturnTab: React.FC = () => {
  const {
    purchaseReturns,
    deletePurchaseReturn,
    suppliers,
    exchangeRate,
  } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'replace_expiry' | 'cash_refund'>('all');
  const [filterSupplierId, setFilterSupplierId] = useState<string>('all');

  const [isNewReturnModalOpen, setIsNewReturnModalOpen] = useState(false);
  const [selectedReturnForDetail, setSelectedReturnForDetail] = useState<PurchaseReturn | null>(null);
  const [returnToDelete, setReturnToDelete] = useState<PurchaseReturn | null>(null);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalReturns = purchaseReturns.length;
    let expiryCount = 0;
    let cashCount = 0;
    let totalCashUSD = 0;
    let totalCashLBP = 0;

    for (const r of purchaseReturns) {
      if (r.returnType === 'replace_expiry') {
        expiryCount++;
      } else {
        cashCount++;
        totalCashUSD += r.totalRefundUSD || 0;
        totalCashLBP += r.totalRefundLBP || 0;
      }
    }

    return {
      totalReturns,
      expiryCount,
      cashCount,
      totalCashUSD,
      totalCashLBP,
    };
  }, [purchaseReturns]);

  // Filtered Returns Log
  const filteredReturns = useMemo(() => {
    return purchaseReturns.filter((r) => {
      // Filter by type
      if (filterType !== 'all' && r.returnType !== filterType) {
        return false;
      }
      // Filter by supplier
      if (filterSupplierId !== 'all' && r.supplierId !== filterSupplierId) {
        return false;
      }
      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNumber = (r.returnNumber || '').toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
        const matchesSupplier = (r.supplierName || '').toLowerCase().includes(q);
        const matchesReason = (r.reason || '').toLowerCase().includes(q);
        const matchesItem = r.items.some(
          (item) =>
            (item.productName || item.name || '').toLowerCase().includes(q) ||
            (item.productCode && item.productCode.toLowerCase().includes(q)) ||
            (item.barcode && item.barcode.toLowerCase().includes(q))
        );

        if (!matchesNumber && !matchesSupplier && !matchesReason && !matchesItem) {
          return false;
        }
      }
      return true;
    });
  }, [purchaseReturns, filterType, filterSupplierId, searchQuery]);

  const handleDeleteConfirm = () => {
    if (returnToDelete) {
      deletePurchaseReturn(returnToDelete.id);
      setReturnToDelete(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 shrink-0">
        {/* Total Returns */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total Returns Logged
            </span>
            <RotateCcw className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 dark:text-slate-100">
              {summary.totalReturns}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">transactions</span>
          </div>
        </div>

        {/* Expiry Swaps */}
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Expiry Replacements
            </span>
            <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-amber-900 dark:text-amber-200">
              {summary.expiryCount}
            </span>
            <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-medium">batches updated</span>
          </div>
        </div>

        {/* Cash Refunds */}
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Cash Refunds Total
            </span>
            <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-black text-emerald-900 dark:text-emerald-200">
              ${summary.totalCashUSD.toFixed(2)}
            </span>
            {summary.totalCashLBP > 0 && (
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                + {formatLBPValue(summary.totalCashLBP)} LBP
              </span>
            )}
          </div>
        </div>

        {/* Action Button Card */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 flex items-center justify-center shadow-2xs">
          <button
            onClick={() => setIsNewReturnModalOpen(true)}
            className="w-full h-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-2xs transition-all active:scale-98 cursor-pointer py-2 px-3"
          >
            <Plus className="h-4 w-4" />
            <span>New Return On Purchase</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-2xs shrink-0">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search return #, supplier, product..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1">
            <label className="text-[11px] font-semibold text-slate-500">Type:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
            >
              <option value="all">All Types</option>
              <option value="replace_expiry">Expiry Replacements</option>
              <option value="cash_refund">Return for Cash</option>
            </select>
          </div>

          {/* Supplier Filter */}
          <div className="flex items-center gap-1">
            <label className="text-[11px] font-semibold text-slate-500">Supplier:</label>
            <select
              value={filterSupplierId}
              onChange={(e) => setFilterSupplierId(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none max-w-[180px]"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing <strong className="text-slate-700 dark:text-slate-200">{filteredReturns.length}</strong> return{filteredReturns.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Transaction Log Table */}
      <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col shadow-2xs">
        <div className="bg-slate-100 dark:bg-slate-800/90 px-3.5 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-amber-500" />
            <span>Supplier Return Transactions Log</span>
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            Synchronized across all terminals
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredReturns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
              <RotateCcw className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3 stroke-[1.5]" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No purchase returns recorded</p>
              <button
                onClick={() => setIsNewReturnModalOpen(true)}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create First Return</span>
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b border-slate-200 dark:border-slate-800 sticky top-0 text-[11px]">
                <tr>
                  <th className="p-3 font-bold">Return #</th>
                  <th className="p-3 font-bold">Date</th>
                  <th className="p-3 font-bold">Supplier</th>
                  <th className="p-3 font-bold">Method</th>
                  <th className="p-3 font-bold">Returned Items</th>
                  <th className="p-3 font-bold">Reason</th>
                  <th className="p-3 font-bold text-right">Refund Value</th>
                  <th className="p-3 font-bold text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReturns.map((ret) => {
                  const isExpiry = ret.returnType === 'replace_expiry';
                  const totalItemsQty = ret.items.reduce((s, it) => s + it.quantity, 0);

                  return (
                    <tr
                      key={ret.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-default"
                    >
                      <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                        #{ret.returnNumber}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {ret.date}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {ret.supplierName}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isExpiry
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {isExpiry ? (
                            <>
                              <RefreshCw className="h-3 w-3" />
                              <span>Replace Expiry</span>
                            </>
                          ) : (
                            <>
                              <Banknote className="h-3 w-3" />
                              <span>Return for Cash</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="max-w-md">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {ret.items.map((it) => `${it.productName || it.name} (x${it.quantity})`).join(', ')}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {ret.items.length} line item{ret.items.length !== 1 ? 's' : ''} • {totalItemsQty} total units
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-500">{ret.reason || '—'}</td>
                      <td className="p-3 text-right">
                        {isExpiry ? (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                            Batch Replacement
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {(ret.currency || 'USD') === 'USD'
                              ? `$${(ret.totalRefundUSD || 0).toFixed(2)}`
                              : `${formatLBPValue(ret.totalRefundLBP || 0)} LBP`}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedReturnForDetail(ret)}
                            className="p-1.5 text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            title="View Return Details & Print Voucher"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setReturnToDelete(ret)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                            title="Delete / Void Return"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {returnToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-rose-50/50 dark:bg-rose-900/20">
              <h3 className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Delete Return Transaction
              </h3>
            </div>
            <div className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Are you sure you want to delete return <strong>#{returnToDelete.returnNumber}</strong> for{' '}
                <strong>{returnToDelete.supplierName}</strong>?
              </p>
              <p className="mt-2 text-rose-600 dark:text-rose-400 font-semibold">
                This will automatically revert the stock quantities and batches that were returned.
              </p>
            </div>
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => setReturnToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm"
              >
                Delete & Revert Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Return Modal */}
      {isNewReturnModalOpen && (
        <NewPurchaseReturnModal
          isOpen={isNewReturnModalOpen}
          onClose={() => setIsNewReturnModalOpen(false)}
        />
      )}

      {/* Detail Modal */}
      {selectedReturnForDetail && (
        <PurchaseReturnDetailModal
          isOpen={!!selectedReturnForDetail}
          onClose={() => setSelectedReturnForDetail(null)}
          returnTransaction={selectedReturnForDetail}
        />
      )}
    </div>
  );
};
