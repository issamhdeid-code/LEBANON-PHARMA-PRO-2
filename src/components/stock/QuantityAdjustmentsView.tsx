import React, { useState, useMemo } from 'react';
import {
  Search,
  Save,
  PackageMinus,
  Plus,
  Minus,
  Trash2,
  Eye,
  Pencil,
  History,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  Layers,
  User as UserIcon,
  Tag,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Product, ProductBatch, AppLogEntry } from '../../types/pharmacy';
import { formatStockDisplay } from '../../utils/stockUtils';
import { formatLBPValue } from '../../utils/priceUtils';
import { SectionRestoreButton } from '../common/SectionRestoreButton';
import { ViewAdjustmentLogModal } from './ViewAdjustmentLogModal';
import { EditAdjustmentLogModal } from './EditAdjustmentLogModal';
import { OfflineStorage } from '../../services/storage';
import { calculateBatchDiffs, extractBatchDiffsFromLog } from '../../utils/batchAdjustmentUtils';

const QUICK_REASONS = [
  'Inventory Audit / Physical Count',
  'Damaged or Broken Package',
  'Expired Stock Removed',
  'Supplier Bonus / Overdelivery',
  'Barcode / Miscount Correction',
];

export const QuantityAdjustmentsView: React.FC = () => {
  const { products, updateProduct, deleteProduct, currentUser, addLog, logs, addNotification, exchangeRate } = usePharmacy();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Form states
  const [formBatches, setFormBatches] = useState<ProductBatch[]>([]);
  const [formIsDivisible, setFormIsDivisible] = useState(false);
  const [formPiecesPerBox, setFormPiecesPerBox] = useState<string | number>('');
  const [formPieceName, setFormPieceName] = useState('');
  const [formPieceBarcode, setFormPieceBarcode] = useState('');
  const [formPiecePriceUSD, setFormPiecePriceUSD] = useState('');
  const [formPiecePriceLBP, setFormPiecePriceLBP] = useState('');
  const [isPiecePriceManual, setIsPiecePriceManual] = useState(false);
  const [batchQuantityDrafts, setBatchQuantityDrafts] = useState<Array<{ boxes: string; pieces: string }>>([]);

  // Form reason & notes
  const [formReason, setFormReason] = useState<string>('Inventory Audit / Physical Count');
  const [formNotes, setFormNotes] = useState<string>('');

  // Log Table states
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logDeltaFilter, setLogDeltaFilter] = useState<'all' | 'increase' | 'decrease'>('all');
  const [viewingLog, setViewingLog] = useState<AppLogEntry | null>(null);
  const [editingLog, setEditingLog] = useState<AppLogEntry | null>(null);

  // Local overrides & seed storage
  const [localLogsOverride, setLocalLogsOverride] = useState<AppLogEntry[]>(() => {
    try {
      const data = localStorage.getItem('lebanon_pharma_qty_adjustments_local_cache');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  });

  const getBatchQuantityDraft = (quantity: number, piecesPerBox: number) => {
    const totalPieces = Math.round(quantity * piecesPerBox);
    return {
      boxes: Math.floor(totalPieces / piecesPerBox).toString(),
      pieces: (totalPieces % piecesPerBox).toString(),
    };
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(p => 
      (p.code || '').toLowerCase().includes(q) || 
      (p.barcode || '').toLowerCase().includes(q) || 
      (p.name || '').toLowerCase().includes(q) ||
      (p.presentation || '').toLowerCase().includes(q) ||
      (p.form || '').toLowerCase().includes(q) ||
      (p.batchNumber || '').toLowerCase().includes(q) ||
      (p.batches || []).some(b => (b.batchNumber || '').toLowerCase().includes(q))
    ).slice(0, 10);
  }, [searchQuery, products]);

  // Merge logs from context with local overrides and seed realistic initial activities if empty
  const allAdjustmentActivities = useMemo(() => {
    const map = new Map<string, AppLogEntry>();

    // 1. Gather all logs from PharmacyContext that match QTY_ADJUSTMENT or are in Inventory / Stock with adjustment keywords
    const ctxAdjustments = (logs || []).filter(
      l => l.action === 'QTY_ADJUSTMENT' || 
           l.action === 'QTY_ADJUSTMENT_LOG_EDITED' ||
           (l.component === 'Inventory / Stock' && (l.title?.toLowerCase().includes('adjustment') || l.description?.toLowerCase().includes('stock adjusted')))
    );

    // If both context and local override are empty, create initial sample activities
    if (ctxAdjustments.length === 0 && localLogsOverride.length === 0) {
      const sampleLogs: AppLogEntry[] = [
        {
          id: 'adj-seed-1',
          timestamp: Date.now() - 1000 * 60 * 25, // 25 min ago
          component: 'Inventory / Stock',
          action: 'QTY_ADJUSTMENT',
          level: 'info',
          title: `Quantity Adjustment: ${products[0]?.name || 'Panadol Extra 500mg'}`,
          description: `Stock adjusted from 45 to 50 (+5) - Batch BT-9824: 25 → 30 (+5) (Routine Count Audit)`,
          user: {
            name: currentUser?.name || 'Dr. Tarek El-Khoury',
            role: currentUser?.role || 'admin',
          },
          device: 'Counter 1 (Main POS)',
          entityId: products[0]?.id || 'prod-panadol',
          entityType: 'product',
          details: {
            productId: products[0]?.id || 'prod-panadol',
            productCode: products[0]?.code || 'MED-001',
            productName: products[0]?.name || 'Panadol Extra 500mg',
            previousStock: 45,
            newStock: 50,
            delta: 5,
            reason: 'Inventory Audit / Physical Count',
            notes: 'Verified drawer count during morning handover.',
            previousBatches: [
              { batchNumber: 'BT-9824', expiryDate: '2027-08-01', quantity: 25 },
              { batchNumber: 'BT-9901', expiryDate: '2028-02-15', quantity: 20 },
            ],
            batches: [
              { batchNumber: 'BT-9824', expiryDate: '2027-08-01', quantity: 30 },
              { batchNumber: 'BT-9901', expiryDate: '2028-02-15', quantity: 20 },
            ],
            batchDiffs: [
              { batchNumber: 'BT-9824', expiryDate: '2027-08-01', previousQuantity: 25, newQuantity: 30, delta: 5, changeType: 'added' },
              { batchNumber: 'BT-9901', expiryDate: '2028-02-15', previousQuantity: 20, newQuantity: 20, delta: 0, changeType: 'unchanged' },
            ],
            editedBatches: [
              { batchNumber: 'BT-9824', expiryDate: '2027-08-01', previousQuantity: 25, newQuantity: 30, delta: 5, changeType: 'added' },
            ],
          },
        },
        {
          id: 'adj-seed-2',
          timestamp: Date.now() - 1000 * 60 * 110, // ~2 hours ago
          component: 'Inventory / Stock',
          action: 'QTY_ADJUSTMENT',
          level: 'warning',
          title: `Quantity Adjustment: ${products[1]?.name || 'Augmentin 1g Tablets'}`,
          description: `Stock adjusted from 22 to 20 (-2) - Batch AUG-2025B: 22 → 20 (-2) (Damaged Carton Removed)`,
          user: {
            name: 'Dr. Sarah Mansour',
            role: 'pharmacist',
          },
          device: 'Counter 2 (Dispensing)',
          entityId: products[1]?.id || 'prod-augmentin',
          entityType: 'product',
          details: {
            productId: products[1]?.id || 'prod-augmentin',
            productCode: products[1]?.code || 'MED-002',
            productName: products[1]?.name || 'Augmentin 1g Tablets',
            previousStock: 22,
            newStock: 20,
            delta: -2,
            reason: 'Damaged or Broken Package',
            notes: 'Damaged packaging removed and reported to supplier.',
            previousBatches: [
              { batchNumber: 'AUG-2025B', expiryDate: '2026-11-30', quantity: 22 },
            ],
            batches: [
              { batchNumber: 'AUG-2025B', expiryDate: '2026-11-30', quantity: 20 },
            ],
            batchDiffs: [
              { batchNumber: 'AUG-2025B', expiryDate: '2026-11-30', previousQuantity: 22, newQuantity: 20, delta: -2, changeType: 'reduced' },
            ],
            editedBatches: [
              { batchNumber: 'AUG-2025B', expiryDate: '2026-11-30', previousQuantity: 22, newQuantity: 20, delta: -2, changeType: 'reduced' },
            ],
          },
        },
        {
          id: 'adj-seed-3',
          timestamp: Date.now() - 1000 * 60 * 60 * 20, // 20 hours ago
          component: 'Inventory / Stock',
          action: 'QTY_ADJUSTMENT',
          level: 'info',
          title: `Quantity Adjustment: ${products[2]?.name || 'Cataflam 50mg Tablets'}`,
          description: `Stock adjusted from 30 to 32 (+2) - Batch CAT-5510: 30 → 32 (+2) (Supplier Bonus Overdelivery)`,
          user: {
            name: currentUser?.name || 'Dr. Tarek El-Khoury',
            role: currentUser?.role || 'admin',
          },
          device: 'Counter 1 (Main POS)',
          entityId: products[2]?.id || 'prod-cataflam',
          entityType: 'product',
          details: {
            productId: products[2]?.id || 'prod-cataflam',
            productCode: products[2]?.code || 'MED-003',
            productName: products[2]?.name || 'Cataflam 50mg Tablets',
            previousStock: 30,
            newStock: 32,
            delta: 2,
            reason: 'Supplier Bonus / Overdelivery',
            notes: '2 extra promotional sample boxes incorporated into stock.',
            previousBatches: [
              { batchNumber: 'CAT-5510', expiryDate: '2027-04-10', quantity: 30 },
            ],
            batches: [
              { batchNumber: 'CAT-5510', expiryDate: '2027-04-10', quantity: 32 },
            ],
            batchDiffs: [
              { batchNumber: 'CAT-5510', expiryDate: '2027-04-10', previousQuantity: 30, newQuantity: 32, delta: 2, changeType: 'added' },
            ],
            editedBatches: [
              { batchNumber: 'CAT-5510', expiryDate: '2027-04-10', previousQuantity: 30, newQuantity: 32, delta: 2, changeType: 'added' },
            ],
          },
        },
      ];
      sampleLogs.forEach(l => map.set(l.id, l));
    }

    ctxAdjustments.forEach(l => map.set(l.id, l));
    localLogsOverride.forEach(l => map.set(l.id, l));

    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [logs, localLogsOverride, products, currentUser]);

  // Filter activities based on search text and delta filter
  const filteredActivities = useMemo(() => {
    return allAdjustmentActivities.filter(log => {
      const details = log.details || {};
      const prodName = (details.productName || log.title || '').toLowerCase();
      const prodCode = (details.productCode || details.productId || '').toLowerCase();
      const user = (log.user?.name || '').toLowerCase();
      const reason = (details.reason || details.notes || log.description || '').toLowerCase();
      const batches = Array.isArray(details.batches)
        ? details.batches.map((b: any) => (b.batchNumber || '').toLowerCase()).join(' ')
        : '';
      const editedBatchesStr = Array.isArray(details.editedBatches)
        ? details.editedBatches.map((b: any) => (b.batchNumber || '').toLowerCase()).join(' ')
        : '';

      const matchesSearch = !logSearchQuery.trim() ||
        prodName.includes(logSearchQuery.toLowerCase()) ||
        prodCode.includes(logSearchQuery.toLowerCase()) ||
        user.includes(logSearchQuery.toLowerCase()) ||
        reason.includes(logSearchQuery.toLowerCase()) ||
        batches.includes(logSearchQuery.toLowerCase()) ||
        editedBatchesStr.includes(logSearchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const delta = details.delta ?? ((details.newStock ?? 0) - (details.previousStock ?? 0));
      if (logDeltaFilter === 'increase') return delta > 0;
      if (logDeltaFilter === 'decrease') return delta < 0;
      return true;
    });
  }, [allAdjustmentActivities, logSearchQuery, logDeltaFilter]);

  const handleSelectProduct = (prod: Product) => {
    setIsConfirmingDelete(false);
    setSelectedProduct(prod);
    setFormIsDivisible(prod.isDivisible || false);
    setFormPiecesPerBox(prod.piecesPerBox || '');
    setFormPieceName(prod.pieceName || '');
    setFormPieceBarcode(prod.pieceBarcode || '');
    setFormPiecePriceUSD(prod.piecePriceUSD?.toString() || '');
    setFormPiecePriceLBP(
      prod.piecePriceLBP
        ? formatLBPValue(prod.piecePriceLBP)
        : prod.piecePriceUSD
        ? formatLBPValue(prod.piecePriceUSD * exchangeRate)
        : ''
    );
    setIsPiecePriceManual(!!prod.piecePriceUSD || !!prod.piecePriceLBP);
    setFormReason('Inventory Audit / Physical Count');
    setFormNotes('');
    setSearchQuery('');
    
    // Init batches
    if (prod.batches && prod.batches.length > 0) {
      let bts = prod.batches.map(b => ({
        ...b,
        quantity: b.quantity ?? 0
      }));
      
      const sum = bts.reduce((s, b) => s + b.quantity, 0);
      if (sum !== prod.stockQuantity) {
        const delta = prod.stockQuantity - sum;
        bts[0].quantity = Math.max(0, bts[0].quantity + delta);
      }
      setFormBatches(bts);
      setBatchQuantityDrafts(bts.map(b => getBatchQuantityDraft(b.quantity || 0, prod.piecesPerBox || 1)));
    } else {
      const batch = {
        batchNumber: prod.batchNumber || '',
        expiryDate: prod.expiryDate || '',
        quantity: prod.stockQuantity || 0
      };
      setFormBatches([batch]);
      setBatchQuantityDrafts([getBatchQuantityDraft(batch.quantity, prod.piecesPerBox || 1)]);
    }
  };

  const handleUpdateBatchQuantity = (index: number, qtyString: string) => {
    const newBatches = [...formBatches];
    newBatches[index].quantity = parseFloat(qtyString) || 0;
    setFormBatches(newBatches);
  };

  const handleAddBatch = () => {
    setFormBatches([...formBatches, { batchNumber: '', expiryDate: '', quantity: 0 }]);
    setBatchQuantityDrafts([...batchQuantityDrafts, { boxes: '0', pieces: '0' }]);
  };

  const handleRemoveBatch = (index: number) => {
    const newBatches = formBatches.filter((_, i) => i !== index);
    setFormBatches(newBatches);
    setBatchQuantityDrafts(batchQuantityDrafts.filter((_, i) => i !== index));
  };

  const handleUpdateBatchPart = (index: number, part: 'boxes' | 'pieces', value: string) => {
    const drafts = [...batchQuantityDrafts];
    const draft = { ...(drafts[index] || { boxes: '0', pieces: '0' }), [part]: value };
    drafts[index] = draft;
    setBatchQuantityDrafts(drafts);

    const piecesPerBox = Number(formPiecesPerBox) || 1;
    const boxes = parseInt(draft.boxes, 10) || 0;
    const pieces = parseInt(draft.pieces, 10) || 0;
    handleUpdateBatchQuantity(index, (boxes + pieces / piecesPerBox).toString());
  };

  const handleNormalizeBatchPart = (index: number) => {
    const piecesPerBox = Number(formPiecesPerBox) || 1;
    const draft = batchQuantityDrafts[index] || { boxes: '0', pieces: '0' };
    let boxes = Math.max(0, parseInt(draft.boxes, 10) || 0);
    let pieces = Math.max(0, parseInt(draft.pieces, 10) || 0);
    
    if (pieces >= piecesPerBox && piecesPerBox > 1) {
      boxes += Math.floor(pieces / piecesPerBox);
      pieces = pieces % piecesPerBox;
    } else if (piecesPerBox <= 1) {
      pieces = 0;
    }

    const normalizedDrafts = [...batchQuantityDrafts];
    normalizedDrafts[index] = { boxes: boxes.toString(), pieces: pieces.toString() };
    setBatchQuantityDrafts(normalizedDrafts);
    handleUpdateBatchQuantity(index, (boxes + pieces / piecesPerBox).toString());
  };

  const handleSave = () => {
    if (!selectedProduct) return;
    
    const totalQuantity = formBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    const mainBatch = formBatches.length > 0 ? formBatches[0].batchNumber : '';
    const mainExpiry = formBatches.length > 0 ? formBatches[0].expiryDate : '';

    const resolvedPiecePriceUSD = formIsDivisible
      ? (formPiecePriceUSD ? Number(parseFloat(formPiecePriceUSD).toFixed(2)) : (formPiecePriceLBP ? Number((parseFloat(formPiecePriceLBP.replace(/[^\d.]/g, '')) / exchangeRate).toFixed(2)) : undefined))
      : undefined;
    const resolvedPiecePriceLBP = formIsDivisible
      ? (formPiecePriceLBP ? Math.round(parseFloat(formPiecePriceLBP.replace(/[^\d.]/g, ''))) : (resolvedPiecePriceUSD ? Math.round(resolvedPiecePriceUSD * exchangeRate) : undefined))
      : undefined;
    const resolvedPieceBarcode = formIsDivisible && formPieceBarcode.trim() ? formPieceBarcode.trim() : undefined;

    updateProduct(selectedProduct.id, {
      ...selectedProduct,
      stockQuantity: totalQuantity,
      batchNumber: mainBatch,
      expiryDate: mainExpiry,
      batches: formBatches,
      isDivisible: formIsDivisible,
      piecesPerBox: formIsDivisible ? Number(formPiecesPerBox) || undefined : undefined,
      pieceName: formIsDivisible ? formPieceName : undefined,
      pieceBarcode: resolvedPieceBarcode,
      piecePriceUSD: resolvedPiecePriceUSD,
      piecePriceLBP: resolvedPiecePriceLBP,
    });
    
    const prevBatchesForDiff = (selectedProduct.batches && selectedProduct.batches.length > 0)
      ? selectedProduct.batches
      : [{
          batchNumber: selectedProduct.batchNumber || 'Batch-1',
          expiryDate: selectedProduct.expiryDate || '',
          quantity: selectedProduct.stockQuantity || 0
        }];

    const { batchDiffs, editedBatches, summaryText } = calculateBatchDiffs(prevBatchesForDiff, formBatches);

    const delta = totalQuantity - selectedProduct.stockQuantity;
    const reasonText = formReason.trim() || 'Inventory Audit / Physical Count';
    const notesText = formNotes.trim();

    if (addLog) {
      const newLog = addLog({
        component: 'Inventory / Stock',
        action: 'QTY_ADJUSTMENT',
        level: 'info',
        title: `Quantity Adjustment: ${selectedProduct.name}`,
        description: `Stock adjusted from ${selectedProduct.stockQuantity} to ${totalQuantity} (${delta >= 0 ? '+' : ''}${delta}) - ${summaryText} (${reasonText})`,
        entityId: selectedProduct.id,
        entityType: 'product',
        details: {
          productId: selectedProduct.id,
          productCode: selectedProduct.code,
          productName: selectedProduct.name,
          previousStock: selectedProduct.stockQuantity,
          newStock: totalQuantity,
          delta,
          reason: reasonText,
          notes: notesText,
          previousBatches: prevBatchesForDiff,
          batches: formBatches,
          batchDiffs,
          editedBatches,
        }
      });

      if (newLog) {
        setLocalLogsOverride(prev => [newLog, ...prev]);
      }
    }

    if (addNotification) {
      addNotification('Stock Adjusted', `Stock level for ${selectedProduct.name} set to ${totalQuantity} units.`, 'inventory', 'success');
    }

    // Clear selection after save
    setSelectedProduct(null);
    setFormBatches([]);
    setBatchQuantityDrafts([]);
    setFormNotes('');
  };

  const handleSaveEditedLog = (updatedLog: AppLogEntry, shouldSyncProductStock: boolean) => {
    // 1. Update local cache
    setLocalLogsOverride(prev => {
      const filtered = prev.filter(l => l.id !== updatedLog.id);
      const next = [updatedLog, ...filtered];
      try {
        localStorage.setItem('lebanon_pharma_qty_adjustments_local_cache', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to cache edited log locally', e);
      }
      return next;
    });

    // 2. Persist to system logs via OfflineStorage
    try {
      const systemLogs = OfflineStorage.getLogs();
      const updatedSystemLogs = systemLogs.map(l => l.id === updatedLog.id ? updatedLog : l);
      if (!systemLogs.some(l => l.id === updatedLog.id)) {
        updatedSystemLogs.unshift(updatedLog);
      }
      OfflineStorage.saveLogs(updatedSystemLogs);
    } catch (e) {
      console.warn('Failed to save to OfflineStorage', e);
    }

    // 3. If live product stock sync is requested
    if (shouldSyncProductStock) {
      const prodId = updatedLog.details?.productId || updatedLog.entityId;
      const targetProd = products.find(p => p.id === prodId || p.code === updatedLog.details?.productCode);
      if (targetProd) {
        const newStockVal = Number(updatedLog.details?.newStock) || 0;
        const newBatchesVal = Array.isArray(updatedLog.details?.batches) && updatedLog.details.batches.length > 0
          ? updatedLog.details.batches
          : targetProd.batches;
        updateProduct(targetProd.id, {
          ...targetProd,
          stockQuantity: newStockVal,
          batches: newBatchesVal,
        });
      }
    }

    // 4. Record audit log for the edit
    if (addLog) {
      addLog({
        component: 'Inventory / Stock',
        action: 'QTY_ADJUSTMENT_LOG_EDITED',
        level: 'info',
        title: `Edited Adjustment Log: ${updatedLog.details?.productName || updatedLog.title}`,
        description: `Updated reason/count for activity record #${updatedLog.id}`,
        entityId: updatedLog.id,
        entityType: 'product',
        details: {
          originalLogId: updatedLog.id,
          reason: updatedLog.details?.reason,
          newStock: updatedLog.details?.newStock,
          syncedProductStock: shouldSyncProductStock,
        },
      });
    }

    if (addNotification) {
      addNotification('Activity Log Updated', 'The quantity adjustment record was successfully updated.', 'inventory', 'success');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <SectionRestoreButton section="adjustments" />
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <PackageMinus className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                Quantity Adjustments
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Adjust stock levels and manage batches for inventory items.
            </p>
          </div>
        </div>

        {/* Search & Select */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by barcode, code, name, or batch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 dark:text-slate-100 transition-all"
            />
            {searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto z-10">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No products found matching "{searchQuery}"
                  </div>
                ) : (
                  filteredProducts.map(p => {
                    const presentation = (p.presentation || p.scientificInfo?.presentation || '').trim();
                    const form = (p.form || p.scientificInfo?.form || '').trim();

                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer flex justify-between items-center last:border-0 gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</span>
                            {presentation && (
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-600">
                                {presentation}
                              </span>
                            )}
                            {form && (
                              <span className="text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-1.5 py-0.5 rounded border border-teal-200/80 dark:border-teal-800">
                                {form}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Code: {p.code} • Total Stock: {formatStockDisplay(p.stockQuantity, p.isDivisible, p.piecesPerBox, p.pieceName)}
                          </div>
                        </div>
                        <div className="text-xs font-mono bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-slate-600 dark:text-slate-400 shrink-0">
                          ${p.priceUSD.toFixed(2)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Product Adjustments */}
        {selectedProduct && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedProduct.name}</h2>
                  {(selectedProduct.presentation || selectedProduct.scientificInfo?.presentation) && (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                      {selectedProduct.presentation || selectedProduct.scientificInfo?.presentation}
                    </span>
                  )}
                  {(selectedProduct.form || selectedProduct.scientificInfo?.form) && (
                    <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800">
                      {selectedProduct.form || selectedProduct.scientificInfo?.form}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Code: <span className="font-mono text-slate-700 dark:text-slate-300">{selectedProduct.code}</span></span>
                  <span>Category: <span className="capitalize text-slate-700 dark:text-slate-300">{selectedProduct.category}</span></span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Calculated Stock</div>
                <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                  {formatStockDisplay(formBatches.reduce((sum, b) => sum + (b.quantity || 0), 0), selectedProduct.isDivisible, Number(formPiecesPerBox), formPieceName)}
                </div>
              </div>
            </div>

            
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 mb-6">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDivisibleCheckQty"
                  checked={formIsDivisible}
                  onChange={(e) => setFormIsDivisible(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                />
                <label htmlFor="isDivisibleCheckQty" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Divide Box into Pieces
                </label>
              </div>
              {formIsDivisible && (
                <div className="space-y-3 pl-6 border-l-2 border-teal-200 dark:border-teal-900 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Pieces per Box
                      </label>
                      <input
                        type="number"
                        min="2"
                        value={formPiecesPerBox}
                        onChange={(e) => {
                          setFormPiecesPerBox(e.target.value);
                          const val = parseFloat(e.target.value);
                          if (!isPiecePriceManual && !isNaN(val) && val > 0 && selectedProduct?.priceUSD) {
                            const calcUSD = (Number(selectedProduct.priceUSD) / val).toFixed(2);
                            setFormPiecePriceUSD(calcUSD);
                            setFormPiecePriceLBP(formatLBPValue(Number(calcUSD) * exchangeRate));
                          }
                        }}
                        placeholder="e.g. 30"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        required={formIsDivisible}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Piece Name
                      </label>
                      <input
                        type="text"
                        value={formPieceName}
                        onChange={(e) => setFormPieceName(e.target.value)}
                        placeholder="e.g. Sachet"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        required={formIsDivisible}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Piece Barcode <span className="text-xs font-normal text-slate-400">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={formPieceBarcode}
                        onChange={(e) => setFormPieceBarcode(e.target.value)}
                        placeholder="Leave blank if none"
                        className="w-full h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        1 Piece Price (L.L.)
                      </label>
                      <input
                        type="text"
                        value={formPiecePriceLBP}
                        onChange={(e) => {
                          setFormPiecePriceLBP(e.target.value);
                          setIsPiecePriceManual(true);
                          const num = parseFloat(e.target.value.replace(/[^\d.]/g, ''));
                          if (!isNaN(num) && num > 0) {
                            const usdVal = num / exchangeRate;
                            setFormPiecePriceUSD(usdVal.toFixed(2));
                          } else if (!e.target.value.trim()) {
                            setFormPiecePriceUSD('');
                            setIsPiecePriceManual(false);
                          }
                        }}
                        onBlur={() => {
                          const num = parseFloat(formPiecePriceLBP.replace(/[^\d.]/g, ''));
                          if (!isNaN(num) && num > 0) {
                            setFormPiecePriceLBP(formatLBPValue(num));
                          }
                        }}
                        placeholder="e.g. 50,000"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        1 Piece Price ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formPiecePriceUSD}
                        onChange={(e) => {
                          setFormPiecePriceUSD(e.target.value);
                          setIsPiecePriceManual(true);
                          const num = parseFloat(e.target.value);
                          if (!isNaN(num) && num > 0) {
                            setFormPiecePriceLBP(formatLBPValue(num * exchangeRate));
                          } else if (!e.target.value.trim()) {
                            setFormPiecePriceLBP('');
                            setIsPiecePriceManual(false);
                          }
                        }}
                        placeholder="e.g. 1.50"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">

              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300">Batches & Quantities</h3>
                <button
                  onClick={handleAddBatch}
                  className="flex items-center gap-1.5 text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add Batch
                </button>
              </div>

              {formBatches.length === 0 ? (
                <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-gray-500 dark:text-gray-400">
                  No batches configured. Add a batch to adjust stock.
                </div>
              ) : (
                <div className="space-y-3">
                  {formBatches.map((batch, idx) => (
                    <div key={idx} className="flex gap-4 items-end bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Batch Number</label>
                        <input
                          type="text"
                          value={batch.batchNumber}
                          onChange={(e) => {
                            const newBatches = [...formBatches];
                            newBatches[idx].batchNumber = e.target.value;
                            setFormBatches(newBatches);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-teal-500 dark:text-slate-100"
                          placeholder="e.g. BT-123"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Expiry Date</label>
                        <input
                          type="date"
                          value={batch.expiryDate}
                          onChange={(e) => {
                            const newBatches = [...formBatches];
                            newBatches[idx].expiryDate = e.target.value;
                            setFormBatches(newBatches);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-teal-500 dark:text-slate-100"
                        />
                      </div>
                      {formIsDivisible ? (
                        <div className="flex gap-2">
                          <div className="w-24">
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Boxes</label>
                            <input
                              type="number"
                              value={batchQuantityDrafts[idx]?.boxes ?? '0'}
                              onChange={(e) => {
                                handleUpdateBatchPart(idx, 'boxes', e.target.value);
                              }}
                              onBlur={() => handleNormalizeBatchPart(idx)}
                              min="0"
                              placeholder="0"
                              className="w-full text-center font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-hidden focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <div className="w-24">
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1" title={formPieceName || 'Pieces'}>
                              {formPieceName || 'Pieces'}
                            </label>
                            <input
                              type="number"
                              value={batchQuantityDrafts[idx]?.pieces ?? '0'}
                              onChange={(e) => {
                                handleUpdateBatchPart(idx, 'pieces', e.target.value);
                              }}
                              onBlur={() => handleNormalizeBatchPart(idx)}
                              min="0"
                              placeholder="0"
                              className="w-full text-center font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-hidden focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="w-32">
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Quantity</label>
                          <div className="flex items-center">
                            <input
                              type="number"
                              value={batch.quantity === 0 ? '' : batch.quantity}
                              onChange={(e) => handleUpdateBatchQuantity(idx, e.target.value)}
                              min="0"
                              placeholder="0"
                              className="w-full text-center font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-hidden focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => handleRemoveBatch(idx)}
                        className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg dark:hover:bg-red-950/30 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900/50 cursor-pointer"
                        title="Remove Batch"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

                        {/* Reason & Notes for this adjustment */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  Adjustment Reason & Audit Notes
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Attached to official activity log</span>
              </div>

              {/* Quick reason chips */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setFormReason(reason)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                      formReason === reason
                        ? 'bg-teal-600 text-white shadow-xs font-semibold'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Selected Reason
                  </label>
                  <input
                    type="text"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    placeholder="Enter or customize adjustment reason..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Additional Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="E.g. Verified during shelf count audit #4..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                {formBatches.reduce((sum, b) => sum + (b.quantity || 0), 0) === 0 && currentUser?.role === 'admin' && (
                  <>
                  <button
                    onClick={() => {
                      if (isConfirmingDelete) {
                        deleteProduct(selectedProduct.id);
                        setSelectedProduct(null);
                        setFormBatches([]);
                        setIsConfirmingDelete(false);
                      } else {
                        setIsConfirmingDelete(true);
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer shadow-xs ${
                      isConfirmingDelete 
                        ? 'bg-rose-600 text-white hover:bg-rose-700' 
                        : 'bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50'
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isConfirmingDelete ? 'Are you sure? Click to confirm' : 'Delete Product Completely'}
                  </button>
                  {isConfirmingDelete && (
                    <button
                      onClick={() => setIsConfirmingDelete(false)}
                      className="ml-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                    >
                      Cancel
                    </button>
                  )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={formBatches.length === 0 || formBatches.some(b => !(b.batchNumber || '').trim() || !(b.expiryDate || '').trim())}
                  className="flex items-center gap-2 bg-teal-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-teal-700 focus:ring-4 focus:ring-teal-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  <Save className="h-4 w-4" />
                  Save Adjustments
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quantity Adjustments Activity Log Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header & Controls */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50 dark:bg-slate-850/50">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-xl">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      Quantity Adjustment Activities
                    </h2>
                    <span className="px-2 py-0.5 text-xs font-semibold bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 rounded-full border border-teal-200 dark:border-teal-800">
                      {allAdjustmentActivities.length} {allAdjustmentActivities.length === 1 ? 'Record' : 'Records'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Complete history of stock counts, batch corrections, and audit adjustments
                  </p>
                </div>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search activities */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter activities..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>

              {/* Filter pills */}
              <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setLogDeltaFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    logDeltaFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setLogDeltaFilter('increase')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                    logDeltaFilter === 'increase'
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'
                  }`}
                >
                  <TrendingUp className="h-3 w-3" />
                  Added (+)
                </button>
                <button
                  type="button"
                  onClick={() => setLogDeltaFilter('decrease')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                    logDeltaFilter === 'decrease'
                      ? 'bg-rose-600 text-white shadow-xs font-semibold'
                      : 'text-rose-700 dark:text-rose-400 hover:text-rose-800'
                  }`}
                >
                  <TrendingDown className="h-3 w-3" />
                  Reduced (-)
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/75 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4 w-40">Date & Time</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4 text-center">Adjustment</th>
                  <th className="py-3 px-4">Batches</th>
                  <th className="py-3 px-4">Reason & Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <History className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          No matching quantity adjustment activities
                        </p>
                        <p className="text-xs text-slate-500">
                          {logSearchQuery ? 'Try adjusting your search keywords or active filters.' : 'Adjust any product quantity to record activity here.'}
                        </p>
                        {logSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setLogSearchQuery('');
                              setLogDeltaFilter('all');
                            }}
                            className="mt-2 text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
                          >
                            Clear search filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((activity) => {
                    const details = activity.details || {};
                    const prevStock = details.previousStock ?? details.oldStock ?? 0;
                    const newStock = details.newStock ?? details.stockAfter ?? prevStock;
                    const delta = details.delta ?? (newStock - prevStock);
                    const reason = details.reason || details.notes || activity.description || 'Routine adjustment';
                    const batches = Array.isArray(details.batches) ? details.batches : [];

                    const { batchDiffs, editedBatches } = extractBatchDiffsFromLog(activity);

                    const dateObj = new Date(activity.timestamp);
                    const formattedDate = dateObj.toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    });
                    const formattedTime = dateObj.toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    });

                    return (
                      <tr
                        key={activity.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Date & Time */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {formattedDate}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formattedTime}
                          </div>
                        </td>

                        {/* Product */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                            {details.productName || activity.title.replace(/^Quantity Adjustment:\s*/i, '')}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            {details.productCode || details.productId || '—'}
                          </div>
                        </td>

                        {/* User / Pharmacist */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              <UserIcon className="h-3 w-3" />
                            </div>
                            <div>
                              <div className="font-medium text-slate-700 dark:text-slate-300">
                                {activity.user?.name || 'Pharmacist'}
                              </div>
                              <div className="text-[10px] text-slate-400 capitalize">
                                {activity.user?.role || 'Staff'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Adjustment Details & Delta */}
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="text-right">
                              <div className="text-[11px] text-slate-400">was {prevStock}</div>
                              <div className="font-bold text-slate-700 dark:text-slate-200">now {newStock}</div>
                            </div>

                            {/* Delta pill */}
                            <span
                              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                                delta > 0
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800'
                                  : delta < 0
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700'
                              }`}
                            >
                              {delta > 0 ? (
                                <>
                                  <TrendingUp className="h-3 w-3" />
                                  +{delta}
                                </>
                              ) : delta < 0 ? (
                                <>
                                  <TrendingDown className="h-3 w-3" />
                                  {delta}
                                </>
                              ) : (
                                <>0</>
                              )}
                            </span>
                          </div>
                        </td>

                        {/* Batches Affected & Specific Changes */}
                        <td className="py-3 px-4">
                          {editedBatches.length > 0 ? (
                            <div className="space-y-1 max-w-sm">
                              {editedBatches.map((b, bIdx) => (
                                <div
                                  key={bIdx}
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono border ${
                                    b.delta > 0
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-300/70 dark:border-emerald-800 font-semibold'
                                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 border-rose-300/70 dark:border-rose-800 font-semibold'
                                  }`}
                                >
                                  {b.delta > 0 ? (
                                    <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                  )}
                                  <span className="font-bold">{b.batchNumber}:</span>
                                  <span className="opacity-75 font-normal">{b.previousQuantity} → {b.newQuantity}</span>
                                  <span className="font-bold">({b.delta > 0 ? `+${b.delta}` : b.delta})</span>
                                </div>
                              ))}
                              {batchDiffs.length > editedBatches.length && (
                                <div className="text-[10px] text-slate-400">
                                  +{batchDiffs.length - editedBatches.length} other batch(es) unchanged
                                </div>
                              )}
                            </div>
                          ) : batches.length > 0 ? (
                            <div className="space-y-0.5 max-w-xs">
                              {batches.slice(0, 2).map((b: any, bIdx: number) => (
                                <div key={bIdx} className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{b.batchNumber || '—'}</span>
                                  {b.expiryDate && <span className="text-slate-400 ml-1">({b.expiryDate})</span>}
                                  <span className="text-teal-600 dark:text-teal-400 ml-1 font-bold">[{b.quantity || 0}]</span>
                                </div>
                              ))}
                              {batches.length > 2 && (
                                <div className="text-[10px] text-slate-400">+{batches.length - 2} more batches</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No batch details</span>
                          )}
                        </td>

                        {/* Reason & Notes */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate" title={reason}>
                            {reason}
                          </div>
                          {details.notes && details.notes !== reason && (
                            <div className="text-[11px] text-slate-400 truncate mt-0.5" title={details.notes}>
                              {details.notes}
                            </div>
                          )}
                          {details.lastEditedAt && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 mt-0.5">
                              <Pencil className="h-2.5 w-2.5" />
                              Edited
                            </div>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingLog(activity)}
                              className="p-1.5 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors cursor-pointer"
                              title="View Activity Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLog(activity)}
                              className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                              title="Edit Activity Log"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* View Modal */}
        <ViewAdjustmentLogModal
          log={viewingLog}
          onClose={() => setViewingLog(null)}
          onEdit={(log) => {
            setViewingLog(null);
            setEditingLog(log);
          }}
        />

        {/* Edit Modal */}
        <EditAdjustmentLogModal
          log={editingLog}
          products={products}
          onClose={() => setEditingLog(null)}
          onSave={handleSaveEditedLog}
        />
      </div>
    </div>
  );
};
