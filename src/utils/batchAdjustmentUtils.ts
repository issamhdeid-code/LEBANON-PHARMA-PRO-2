import { AppLogEntry, ProductBatch } from '../types/pharmacy';

export interface BatchAdjustmentDiff {
  batchNumber: string;
  expiryDate?: string;
  previousQuantity: number;
  newQuantity: number;
  delta: number;
  changeType: 'added' | 'reduced' | 'new_batch' | 'removed' | 'unchanged';
}

/**
 * Calculates batch-level diffs between previous product batches and new form batches.
 */
export function calculateBatchDiffs(
  prevBatches: ProductBatch[],
  newBatches: ProductBatch[]
): {
  batchDiffs: BatchAdjustmentDiff[];
  editedBatches: BatchAdjustmentDiff[];
  summaryText: string;
} {
  const prevList = prevBatches.length > 0 ? prevBatches : [];
  const newList = newBatches.length > 0 ? newBatches : [];

  const prevMap = new Map<string, { batchNumber: string; expiryDate?: string; quantity: number }>();
  prevList.forEach((b, i) => {
    const key = (b.batchNumber || '').trim().toLowerCase() || `_unnamed_${i}`;
    prevMap.set(key, {
      batchNumber: b.batchNumber || `Batch #${i + 1}`,
      expiryDate: b.expiryDate,
      quantity: Number(b.quantity) || 0,
    });
  });

  const batchDiffs: BatchAdjustmentDiff[] = [];
  const handledPrevKeys = new Set<string>();

  newList.forEach((nb, i) => {
    const key = (nb.batchNumber || '').trim().toLowerCase() || `_unnamed_${i}`;
    const oldB = prevMap.get(key);
    const newQty = Number(nb.quantity) || 0;

    if (oldB) {
      handledPrevKeys.add(key);
      const prevQty = oldB.quantity;
      const delta = newQty - prevQty;
      batchDiffs.push({
        batchNumber: nb.batchNumber || oldB.batchNumber,
        expiryDate: nb.expiryDate || oldB.expiryDate,
        previousQuantity: prevQty,
        newQuantity: newQty,
        delta,
        changeType: delta > 0 ? 'added' : delta < 0 ? 'reduced' : 'unchanged',
      });
    } else {
      batchDiffs.push({
        batchNumber: nb.batchNumber || `New Batch #${i + 1}`,
        expiryDate: nb.expiryDate,
        previousQuantity: 0,
        newQuantity: newQty,
        delta: newQty,
        changeType: 'new_batch',
      });
    }
  });

  // Check for deleted / removed batches
  prevList.forEach((ob, i) => {
    const key = (ob.batchNumber || '').trim().toLowerCase() || `_unnamed_${i}`;
    if (!handledPrevKeys.has(key)) {
      const prevQty = Number(ob.quantity) || 0;
      batchDiffs.push({
        batchNumber: ob.batchNumber || `Batch #${i + 1}`,
        expiryDate: ob.expiryDate,
        previousQuantity: prevQty,
        newQuantity: 0,
        delta: -prevQty,
        changeType: 'removed',
      });
    }
  });

  const editedBatches = batchDiffs.filter((b) => b.delta !== 0);

  const summaryParts = editedBatches.map((b) => {
    const sign = b.delta > 0 ? '+' : '';
    return `Batch ${b.batchNumber}: ${b.previousQuantity} → ${b.newQuantity} (${sign}${b.delta})`;
  });

  const summaryText = summaryParts.length > 0 ? summaryParts.join('; ') : 'No batch counts changed';

  return {
    batchDiffs,
    editedBatches,
    summaryText,
  };
}

/**
 * Extracts batch differences from an existing log entry,
 * falling back gracefully if pre-computed fields are not present.
 */
export function extractBatchDiffsFromLog(log: AppLogEntry): {
  batchDiffs: BatchAdjustmentDiff[];
  editedBatches: BatchAdjustmentDiff[];
} {
  const details = log.details || {};

  if (Array.isArray(details.batchDiffs) && details.batchDiffs.length > 0) {
    const batchDiffs = details.batchDiffs as BatchAdjustmentDiff[];
    const editedBatches = (Array.isArray(details.editedBatches) && details.editedBatches.length > 0
      ? details.editedBatches
      : batchDiffs.filter((b) => b.delta !== 0)) as BatchAdjustmentDiff[];
    return { batchDiffs, editedBatches };
  }

  if (Array.isArray(details.editedBatches) && details.editedBatches.length > 0) {
    const editedBatches = details.editedBatches as BatchAdjustmentDiff[];
    return { batchDiffs: editedBatches, editedBatches };
  }

  // If previousBatches and batches are recorded
  const prevBatches = Array.isArray(details.previousBatches) ? details.previousBatches : [];
  const newBatches = Array.isArray(details.batches) ? details.batches : [];

  if (prevBatches.length > 0 || newBatches.length > 0) {
    const res = calculateBatchDiffs(prevBatches, newBatches);
    return { batchDiffs: res.batchDiffs, editedBatches: res.editedBatches };
  }

  // If single batch or single delta exists
  const delta = details.delta ?? ((details.newStock ?? 0) - (details.previousStock ?? 0));
  if (newBatches.length === 1) {
    const single = newBatches[0];
    const newQty = Number(single.quantity) || (details.newStock ?? 0);
    const prevQty = newQty - delta;
    const item: BatchAdjustmentDiff = {
      batchNumber: single.batchNumber || 'Batch-1',
      expiryDate: single.expiryDate || '',
      previousQuantity: prevQty,
      newQuantity: newQty,
      delta,
      changeType: delta > 0 ? 'added' : delta < 0 ? 'reduced' : 'unchanged',
    };
    return {
      batchDiffs: [item],
      editedBatches: delta !== 0 ? [item] : [],
    };
  }

  return { batchDiffs: [], editedBatches: [] };
}
