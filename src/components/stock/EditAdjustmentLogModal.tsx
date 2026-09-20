import React, { useState } from 'react';
import {
  X,
  Pencil,
  Save,
  Package,
  Layers,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Plus,
  Trash2,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { AppLogEntry, Product } from '../../types/pharmacy';
import { calculateBatchDiffs } from '../../utils/batchAdjustmentUtils';

interface EditAdjustmentLogModalProps {
  log: AppLogEntry | null;
  products: Product[];
  onClose: () => void;
  onSave: (updatedLog: AppLogEntry, shouldSyncProductStock: boolean) => void;
}

const COMMON_REASONS = [
  'Inventory Audit / Physical Count',
  'Damaged or Broken Package',
  'Expired Stock Removed',
  'Supplier Bonus / Overdelivery',
  'Supplier Delivery Shortage',
  'Barcode / Miscount Correction',
  'Dispensing Return',
  'Other / Custom Reason',
];

export const EditAdjustmentLogModal: React.FC<EditAdjustmentLogModalProps> = ({
  log,
  products,
  onClose,
  onSave,
}) => {
  if (!log) return null;

  const details = log.details || {};
  const currentReason = details.reason || details.notes || 'Inventory Audit / Physical Count';
  const isCustomInitial = !COMMON_REASONS.slice(0, -1).includes(currentReason);

  const [selectedReasonOption, setSelectedReasonOption] = useState<string>(
    isCustomInitial ? 'Other / Custom Reason' : currentReason
  );
  const [customReason, setCustomReason] = useState<string>(isCustomInitial ? currentReason : '');
  const [description, setDescription] = useState<string>(log.description || '');
  const [title, setTitle] = useState<string>(log.title || 'Quantity Adjustment');
  
  const [prevStock, setPrevStock] = useState<string>(
    String(details.previousStock ?? details.oldStock ?? 0)
  );
  const [newStock, setNewStock] = useState<string>(
    String(details.newStock ?? details.stockAfter ?? 0)
  );

  const [batches, setBatches] = useState<Array<{ batchNumber: string; expiryDate: string; quantity: number }>>(
    Array.isArray(details.batches)
      ? details.batches.map((b: any) => ({
          batchNumber: b.batchNumber || '',
          expiryDate: b.expiryDate || '',
          quantity: Number(b.quantity) || 0,
        }))
      : []
  );

  const [syncProductStock, setSyncProductStock] = useState(false);

  // Find target product if available
  const targetProduct = products.find(
    (p) => p.id === details.productId || p.id === log.entityId || p.code === details.productCode
  );

  const effectiveReason =
    selectedReasonOption === 'Other / Custom Reason'
      ? customReason.trim() || 'Custom Adjustment'
      : selectedReasonOption;

  const handleAddBatch = () => {
    setBatches([...batches, { batchNumber: '', expiryDate: '', quantity: 0 }]);
  };

  const handleRemoveBatch = (idx: number) => {
    setBatches(batches.filter((_, i) => i !== idx));
  };

  const handleUpdateBatch = (idx: number, field: string, val: any) => {
    const updated = [...batches];
    updated[idx] = { ...updated[idx], [field]: val };
    setBatches(updated);
  };

  const handleRecalculateNewStockFromBatches = () => {
    const sum = batches.reduce((acc, b) => acc + (Number(b.quantity) || 0), 0);
    setNewStock(String(sum));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedPrev = parseFloat(prevStock) || 0;
    const parsedNew = parseFloat(newStock) || 0;
    const delta = parsedNew - parsedPrev;

    const prevBatchesForDiff = Array.isArray(details.previousBatches) && details.previousBatches.length > 0
      ? details.previousBatches
      : (targetProduct?.batches || []);

    const { batchDiffs, editedBatches } = calculateBatchDiffs(prevBatchesForDiff, batches);

    const updatedLog: AppLogEntry = {
      ...log,
      title: title.trim() || `Quantity Adjustment: ${details.productName || 'Product'}`,
      description: description.trim() || `Stock adjusted from ${parsedPrev} to ${parsedNew} (${delta >= 0 ? '+' : ''}${delta})`,
      details: {
        ...log.details,
        previousStock: parsedPrev,
        newStock: parsedNew,
        delta,
        reason: effectiveReason,
        notes: description.trim(),
        previousBatches: prevBatchesForDiff,
        batches: batches,
        batchDiffs,
        editedBatches,
        lastEditedAt: Date.now(),
      },
    };

    onSave(updatedLog, syncProductStock);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-xl">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Edit Adjustment Activity Log
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update the reason, notes, or recorded count for log #{log.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5">
          {/* Target Product Pill */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Package className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {details.productName || log.title.replace(/^Quantity Adjustment:\s*/i, '')}
                </h4>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Code: <span className="font-mono">{details.productCode || details.productId || 'N/A'}</span>
                  {targetProduct && (
                    <span className="ml-2 px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 rounded text-[10px] font-semibold">
                      Live Stock: {targetProduct.stockQuantity}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Adjustment Reason
            </label>
            <select
              value={selectedReasonOption}
              onChange={(e) => setSelectedReasonOption(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            >
              {COMMON_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {selectedReasonOption === 'Other / Custom Reason' && (
              <input
                type="text"
                placeholder="Specify custom reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                required
              />
            )}
          </div>

          {/* Title & Notes */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Log Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Detailed Notes / Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add context or explanation for why this adjustment was entered..."
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
            </div>
          </div>

          {/* Stock Counts */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Recorded Previous Stock
              </label>
              <input
                type="number"
                step="any"
                value={prevStock}
                onChange={(e) => setPrevStock(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Recorded Adjusted Stock
                </label>
                {batches.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRecalculateNewStockFromBatches}
                    className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                    title="Calculate from batches below"
                  >
                    <RefreshCw className="h-3 w-3" /> Sum batches
                  </button>
                )}
              </div>
              <input
                type="number"
                step="any"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-teal-600 dark:text-teal-400"
              />
            </div>
          </div>

          {/* Batches Editing */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Batches Configured ({batches.length})
              </label>
              <button
                type="button"
                onClick={handleAddBatch}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="h-3.5 w-3.5" /> Add Batch Row
              </button>
            </div>

            {batches.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-center">
                No batches attached to this log. Click "Add Batch Row" if you want to attach one.
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {batches.map((batch, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <input
                      type="text"
                      placeholder="Batch #"
                      value={batch.batchNumber}
                      onChange={(e) => handleUpdateBatch(idx, 'batchNumber', e.target.value)}
                      className="flex-1 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-mono"
                    />
                    <input
                      type="date"
                      value={batch.expiryDate}
                      onChange={(e) => handleUpdateBatch(idx, 'expiryDate', e.target.value)}
                      className="w-32 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={batch.quantity}
                      onChange={(e) => handleUpdateBatch(idx, 'quantity', Number(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-right font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveBatch(idx)}
                      className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sync Live Product Stock Toggle */}
          {targetProduct && (
            <div className="p-3 bg-teal-50/70 dark:bg-teal-950/30 rounded-xl border border-teal-200 dark:border-teal-800 flex items-start gap-3">
              <input
                type="checkbox"
                id="syncProductStock"
                checked={syncProductStock}
                onChange={(e) => setSyncProductStock(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
              />
              <label htmlFor="syncProductStock" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <span className="font-bold text-teal-900 dark:text-teal-200">
                  Also apply this corrected count to live product inventory
                </span>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  If checked, will update <strong className="font-semibold">{targetProduct.name}</strong>'s current stock from{' '}
                  <strong className="font-semibold">{targetProduct.stockQuantity}</strong> to{' '}
                  <strong className="font-semibold">{parseFloat(newStock) || 0}</strong> boxes and sync the batches.
                </p>
              </label>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
