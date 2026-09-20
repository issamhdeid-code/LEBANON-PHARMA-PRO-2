import React from 'react';
import {
  X,
  FileText,
  User as UserIcon,
  Clock,
  Package,
  Pencil,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2
} from 'lucide-react';
import { AppLogEntry } from '../../types/pharmacy';
import { extractBatchDiffsFromLog } from '../../utils/batchAdjustmentUtils';

interface ViewAdjustmentLogModalProps {
  log: AppLogEntry | null;
  onClose: () => void;
  onEdit?: (log: AppLogEntry) => void;
}

export const ViewAdjustmentLogModal: React.FC<ViewAdjustmentLogModalProps> = ({
  log,
  onClose,
  onEdit,
}) => {
  if (!log) return null;

  const details = log.details || {};
  const prevStock = details.previousStock ?? details.oldStock ?? details.stockBefore ?? 0;
  const newStock = details.newStock ?? details.stockAfter ?? prevStock;
  const delta = details.delta ?? (newStock - prevStock);
  const batches = Array.isArray(details.batches) ? details.batches : [];
  const reason = details.reason || details.notes || log.description || 'Routine adjustment';

  const { batchDiffs, editedBatches } = extractBatchDiffsFromLog(log);

  const formattedDate = new Date(log.timestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-xl">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Quantity Adjustment Activity
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>ID: <span className="font-mono text-slate-600 dark:text-slate-300">{log.id}</span></span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formattedDate}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Product Header Banner */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1.5 mb-1">
                <Package className="h-3.5 w-3.5" />
                Target Product
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {details.productName || log.title.replace(/^Quantity Adjustment:\s*/i, '')}
              </h3>
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                Code: {details.productCode || details.productId || 'N/A'}
              </div>
            </div>

            {/* Delta pill */}
            <div className="text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Stock Impact</div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                delta > 0
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : delta < 0
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
              }`}>
                {delta > 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4" />
                    +{delta} Units
                  </>
                ) : delta < 0 ? (
                  <>
                    <TrendingDown className="h-4 w-4" />
                    {delta} Units
                  </>
                ) : (
                  <>No count change</>
                )}
              </div>
            </div>
          </div>

          {/* Stock Change Comparison */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Previous Stock</span>
              <div className="text-xl font-bold text-slate-700 dark:text-slate-300 mt-1">
                {prevStock} <span className="text-xs font-normal text-slate-500">boxes</span>
              </div>
            </div>

            <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800 flex flex-col items-center justify-center">
              <span className="text-xs text-teal-700 dark:text-teal-300 font-medium flex items-center gap-1">
                Transition <ArrowRight className="h-3.5 w-3.5" />
              </span>
              <div className="text-xs font-semibold text-teal-800 dark:text-teal-200 mt-1">
                {delta >= 0 ? `+${delta}` : delta} boxes net
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">New Stock Level</span>
              <div className="text-xl font-bold text-teal-600 dark:text-teal-400 mt-1">
                {newStock} <span className="text-xs font-normal text-teal-500">boxes</span>
              </div>
            </div>
          </div>

          {/* Reason / Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Adjustment Reason & Description
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{reason}</p>
              {log.description && log.description !== reason && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.description}</p>
              )}
            </div>
          </div>

          {/* Batches & Specific Edits */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                Batch Details & Specific Modifications
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {editedBatches.length > 0
                  ? `${editedBatches.length} of ${batchDiffs.length || batches.length} batch(es) modified`
                  : `${batches.length} batch(es) configured`}
              </span>
            </div>

            {/* Prominent Callout for Edited Batches */}
            {editedBatches.length > 0 && (
              <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>Specific Batches Changed in this Transaction:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editedBatches.map((b, bIdx) => (
                    <div
                      key={bIdx}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        b.delta > 0
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                      }`}
                    >
                      {b.delta > 0 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                      )}
                      <span className="font-mono">{b.batchNumber}</span>
                      <span className="opacity-75 text-[11px] font-normal">
                        ({b.previousQuantity} → {b.newQuantity})
                      </span>
                      <span className="font-bold">
                        {b.delta > 0 ? `+${b.delta}` : b.delta} boxes
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Batches Comparison Table */}
            {batchDiffs.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Batch Number</th>
                      <th className="py-2.5 px-3">Expiry Date</th>
                      <th className="py-2.5 px-3 text-center">Previous Qty</th>
                      <th className="py-2.5 px-3 text-center">New Qty</th>
                      <th className="py-2.5 px-3 text-center">Batch Impact</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {batchDiffs.map((b, idx) => {
                      const isEdited = b.delta !== 0;
                      return (
                        <tr
                          key={idx}
                          className={
                            isEdited
                              ? b.delta > 0
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                                : 'bg-rose-50/50 dark:bg-rose-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            {isEdited && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  b.delta > 0 ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                            )}
                            {b.batchNumber || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              {b.expiryDate || '—'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-slate-500 dark:text-slate-400">
                            {b.previousQuantity} boxes
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                            {b.newQuantity} boxes
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                                b.delta > 0
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : b.delta < 0
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {b.delta > 0 ? `+${b.delta}` : b.delta}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {b.changeType === 'added' ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                Increased (+{b.delta})
                              </span>
                            ) : b.changeType === 'reduced' ? (
                              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                Reduced ({b.delta})
                              </span>
                            ) : b.changeType === 'new_batch' ? (
                              <span className="text-teal-600 dark:text-teal-400 font-semibold">
                                New Batch Added
                              </span>
                            ) : b.changeType === 'removed' ? (
                              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                Batch Removed
                              </span>
                            ) : (
                              <span className="text-slate-400">Unchanged</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : batches.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="py-2 px-3">Batch Number</th>
                      <th className="py-2 px-3">Expiry Date</th>
                      <th className="py-2 px-3 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {batches.map((b: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2 px-3 font-mono font-medium text-slate-700 dark:text-slate-200">
                          {b.batchNumber || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {b.expiryDate || '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-100">
                          {b.quantity ?? '0'} boxes
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                No specific batch breakdowns recorded with this adjustment.
              </div>
            )}
          </div>

          {/* User & Terminal Audit Info */}
          <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-slate-400" />
              <div>
                <span className="text-slate-500 dark:text-slate-400">Responsible Pharmacist:</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {log.user?.name || 'Admin'} <span className="text-[10px] text-teal-600 font-normal">({log.user?.role || 'Staff'})</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              <div>
                <span className="text-slate-500 dark:text-slate-400">Station / Terminal:</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {log.device || 'Counter 1 (Main POS)'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Close
          </button>
          {onEdit && (
            <button
              onClick={() => {
                onClose();
                onEdit(log);
              }}
              className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Edit This Log
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
