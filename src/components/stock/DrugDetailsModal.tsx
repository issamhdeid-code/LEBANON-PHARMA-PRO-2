import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Pill,
  DollarSign,
  Boxes,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Thermometer,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Shuffle,
  Clock,
  Sparkles,
  Info,
  Layers,
  History,
  ExternalLink
} from 'lucide-react';
import { Product } from '../../types/pharmacy';
import { formatStockDisplay, parseExpiryDate, resolveProductBatches, ResolvedBatch } from '../../utils/stockUtils';
import { getPriceChangeInfoUSD, getPriceChangeInfoLBP, formatLBPValue } from '../../utils/priceUtils';
import { resolveStraightforwardScientificInfo } from '../../services/scientificDataService';
import { DesktopWindow } from '../common/DesktopWindow';
import { usePharmacy } from '../../context/PharmacyContext';
import { OperationDetailModal, ProductOperationItem } from './OperationDetailModal';

interface DrugDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onViewScientific?: (product: Product) => void;
  exchangeRate?: number;
}

export const DrugDetailsModal: React.FC<DrugDetailsModalProps> = ({
  product,
  isOpen,
  onClose,
  onViewScientific,
  exchangeRate = 89500,
}) => {
  const { purchases, sales, logs } = usePharmacy();
  const [showAllExpiries, setShowAllExpiries] = useState(true);
  const [selectedOperation, setSelectedOperation] = useState<ProductOperationItem | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const batches = useMemo(() => {
    if (!product) return [];
    return resolveProductBatches(product, purchases);
  }, [product, purchases]);

  const operations: ProductOperationItem[] = useMemo(() => {
    if (!product) return [];
    const list: ProductOperationItem[] = [];

    // 1. Inbound purchases
    (purchases || []).forEach((p) => {
      if (!p.items || !Array.isArray(p.items)) return;
      p.items.forEach((it, itIdx) => {
        if (it.productId === product.id || (product.code && it.productCode === product.code)) {
          const { displayMMYYYY } = parseExpiryDate(it.expiryDate);
          const expLabel = displayMMYYYY !== 'N/A' ? displayMMYYYY : '—';

          const qty = it.quantity || 0;
          list.push({
            id: `${p.id}-${itIdx}`,
            referenceId: p.id,
            invoiceNumber: p.invoiceNumber,
            operationType: 'Purchase',
            type: 'purchase',
            quantity: qty,
            formattedQuantity: `+${formatStockDisplay(qty, product.isDivisible, product.piecesPerBox, product.pieceName)}`,
            expiry: expLabel,
            rawExpiry: it.expiryDate,
            batchNumber: it.batchNumber,
            date: p.date,
            timestamp: p.date ? new Date(p.date).getTime() : p.timestamp || 0,
            purchase: p,
          });
        }
      });
    });

    // 2. Outbound sales
    (sales || []).forEach((s) => {
      if (!s.items || !Array.isArray(s.items)) return;
      s.items.forEach((it, itIdx) => {
        if (it.productId === product.id || (product.code && it.productCode === product.code)) {
          const expStr = it.selectedExpiryDate || product.expiryDate || '';
          const { displayMMYYYY } = parseExpiryDate(expStr);
          const batchNum = it.selectedBatchNumber || product.batchNumber || '';
          const expLabel = displayMMYYYY !== 'N/A' ? displayMMYYYY : '—';

          const qty = it.quantity || 0;
          list.push({
            id: `${s.id}-${itIdx}`,
            referenceId: s.id,
            invoiceNumber: s.invoiceNumber,
            operationType: 'Sale',
            type: 'sale',
            quantity: qty,
            formattedQuantity: `-${formatStockDisplay(qty, product.isDivisible, product.piecesPerBox, product.pieceName)}`,
            expiry: expLabel,
            rawExpiry: expStr,
            batchNumber: batchNum,
            date: s.date,
            timestamp: s.timestamp || (s.date ? new Date(s.date).getTime() : 0),
            sale: s,
          });
        }
      });
    });

    // 3. Genuine manual quantity adjustments only (performed by user in Qty Adjustments)
    (logs || []).forEach((l) => {
      const isEntity = l.entityId === product.id;
      const isDetails = l.details && (l.details.productId === product.id || l.details.code === product.code);
      if ((isEntity || isDetails) && l.action === 'QTY_ADJUSTMENT') {
        const delta = l.details?.delta;
        const newStock = l.details?.newStock ?? l.details?.stockQuantity;
        const batchExp = l.details?.batches?.[0]?.expiryDate || l.details?.expiryDate || product.expiryDate;
        const { displayMMYYYY } = parseExpiryDate(batchExp);
        const batchNum = l.details?.batches?.[0]?.batchNumber || l.details?.batchNumber || product.batchNumber;
        const expLabel = displayMMYYYY !== 'N/A' ? displayMMYYYY : '—';

        const qtyDisplay = delta !== undefined
          ? `${delta >= 0 ? '+' : ''}${formatStockDisplay(Math.abs(delta), product.isDivisible, product.piecesPerBox, product.pieceName)}`
          : newStock !== undefined
          ? `${formatStockDisplay(newStock, product.isDivisible, product.piecesPerBox, product.pieceName)}`
          : '—';

        list.push({
          id: l.id,
          referenceId: l.id,
          invoiceNumber: l.id,
          operationType: 'Qty Adj',
          type: 'adjustment',
          quantity: typeof delta === 'number' ? Math.abs(delta) : (typeof newStock === 'number' ? newStock : 0),
          formattedQuantity: qtyDisplay,
          expiry: expLabel,
          rawExpiry: batchExp,
          batchNumber: batchNum,
          date: new Date(l.timestamp).toISOString(),
          timestamp: l.timestamp || 0,
          log: l,
        });
      }
    });

    // Sort chronologically descending (newest operation first)
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
  }, [product, purchases, sales, logs]);

  if (!isOpen || !product) return null;

  const isLowStock = product.stockQuantity <= product.minStockAlert;
  const isOutOfStock = product.stockQuantity <= 0;

  // Resolve scientific information for clinical preview
  const sciInfo =
    product.scientificInfo ||
    (product.category === 'drug'
      ? resolveStraightforwardScientificInfo(product)
      : undefined);

  const renderClinicalLines = (text?: string, bulletColor = 'text-teal-600 dark:text-teal-400') => {
    if (!text || !text.trim()) return null;
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    return (
      <div className="space-y-1 text-xs">
        {lines.map((line, idx) => {
          const cleaned = line.replace(/^[•*–-]\s*/, '').trim();
          const colonIdx = cleaned.indexOf(':');
          if (colonIdx > 0 && colonIdx < 35) {
            const title = cleaned.substring(0, colonIdx).trim();
            const desc = cleaned.substring(colonIdx + 1).trim();
            return (
              <div key={idx} className="flex items-start space-x-1.5 leading-relaxed">
                <span className={`${bulletColor} font-bold shrink-0 mt-0.5`}>•</span>
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{title}: </span>
                  <span className="text-slate-700 dark:text-slate-300">{desc}</span>
                </div>
              </div>
            );
          }
          return (
            <div key={idx} className="flex items-start space-x-1.5 leading-relaxed text-slate-700 dark:text-slate-300">
              <span className={`${bulletColor} font-bold shrink-0 mt-0.5`}>•</span>
              <span>{cleaned}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <DesktopWindow id="stock-card-modal" section="stock" title={product ? `${product.name} (Stock Card)` : "Stock Card & Details"} isOpen={true} onClose={onClose} width="750px" height="85vh">
      <div className="w-full h-full flex flex-col min-h-0">
        {/* MODAL HEADER */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-start space-x-3">
            <div className="rounded-xl bg-teal-600/10 p-2.5 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 shrink-0 mt-0.5">
              <Pill className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id="drug-detail-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight"
                >
                  {product.name}
                </h3>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    product.category === 'drug'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                      : product.category === 'vitamins'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                      : product.category === 'cosmetics'
                      ? 'bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300'
                      : 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300'
                  }`}
                >
                  {product.category}
                </span>
                {product.subcategory && (
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {product.subcategory}
                  </span>
                )}
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isOutOfStock
                      ? 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300'
                      : isLowStock
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                  }`}
                >
                  {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-2 flex-wrap gap-y-1">
                {product.code && (
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    CODE: {product.code}
                  </span>
                )}
                {product.barcode && (
                  <span className="font-mono text-slate-600 dark:text-slate-400">
                    • BARCODE: {product.barcode}
                  </span>
                )}
                {product.isDivisible && product.pieceBarcode && (
                  <span className="font-mono text-teal-600 dark:text-teal-400 font-medium">
                    • PIECE BARCODE: {product.pieceBarcode}
                  </span>
                )}
                {product.dosage && <span>• {product.dosage}</span>}
                {product.form && <span>• {product.form}</span>}
                {product.presentation && <span>• {product.presentation}</span>}
              </p>
            </div>
          </div>
        </div>

        {/* MODAL CONTENT (READ ONLY) */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto text-xs text-slate-700 dark:text-slate-200 min-h-0">
          {/* 1. Core Specifications & Distributor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                Active Ingredients / Molecule
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                {product.ingredients || product.name}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                Dosage & Form
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                {product.dosage || 'Standard'} • {product.form || 'Unit'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                Lebanese Agent / Distributor
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs flex items-center space-x-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{product.agent || 'Local Importer'}</span>
              </p>
            </div>
          </div>

          {/* 2. Dual-Currency Pricing & Commercial Metrics */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center space-x-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span>Dual-Currency Pricing & Commercial Metrics</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Rate: {formatLBPValue(exchangeRate)} L.L. / $
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-emerald-50/80 p-2.5 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <span className="block text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                  Retail Price (USD)
                </span>
                <div className="flex items-baseline space-x-1.5 mt-0.5">
                  <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                    ${product.priceUSD.toFixed(2)}
                  </span>
                  {(() => {
                    const changeUSD = getPriceChangeInfoUSD(product);
                    if (!changeUSD) return null;
                    return (
                      <span
                        className={`text-[10px] font-bold flex items-center ${
                          changeUSD.direction === 'up' ? 'text-green-600' : 'text-red-500'
                        }`}
                        title={
                          changeUSD.isSkippedDecrease
                            ? `Lower CSV price ($${changeUSD.importedPrice?.toFixed(2)}) skipped; selling price preserved (-${changeUSD.percentFormatted}%)`
                            : undefined
                        }
                      >
                        {changeUSD.direction === 'up' ? (
                          <ArrowUp className="h-2.5 w-2.5 mr-0.5" />
                        ) : (
                          <ArrowDown className="h-2.5 w-2.5 mr-0.5" />
                        )}
                        {changeUSD.percentFormatted}%
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="rounded-lg bg-emerald-50/80 p-2.5 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <span className="block text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                  Retail Price (LBP)
                </span>
                <div className="flex items-baseline space-x-1.5 mt-0.5">
                  <span className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200 block truncate">
                    {formatLBPValue(product.priceLBP)} L.L.
                  </span>
                  {(() => {
                    const changeLBP = getPriceChangeInfoLBP(product);
                    if (!changeLBP) return null;
                    return (
                      <span
                        className={`text-[10px] font-bold flex items-center ${
                          changeLBP.direction === 'up' ? 'text-green-600' : 'text-red-500'
                        }`}
                        title={
                          changeLBP.isSkippedDecrease
                            ? `Lower CSV price (${formatLBPValue(changeLBP.importedPrice ?? 0)} LBP) skipped; selling price preserved (-${changeLBP.percentFormatted}%)`
                            : undefined
                        }
                      >
                        {changeLBP.direction === 'up' ? (
                          <ArrowUp className="h-2.5 w-2.5 mr-0.5" />
                        ) : (
                          <ArrowDown className="h-2.5 w-2.5 mr-0.5" />
                        )}
                        {changeLBP.percentFormatted}%
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
                <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  Cost Price (USD)
                </span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-0.5 block">
                  ${product.costPriceUSD ? product.costPriceUSD.toFixed(2) : '0.00'}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
                <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  Profit Margin
                </span>
                <span className="text-sm font-bold text-teal-600 dark:text-teal-400 mt-0.5 block">
                  {product.pharmacistMarginProfit || 20}%
                </span>
              </div>
            </div>

            {product.isDivisible && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-teal-50/50 dark:bg-teal-950/20 p-2.5 rounded-lg border border-teal-100 dark:border-teal-900/40">
                <div>
                  <span className="block text-[10px] font-semibold text-teal-800 dark:text-teal-300">
                    Piece Unit
                  </span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5 block">
                    {product.piecesPerBox || 1} {product.pieceName || 'Pieces'} / Box
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-teal-800 dark:text-teal-300">
                    Piece Price ($)
                  </span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                    ${(product.piecePriceUSD ?? (product.priceUSD / (product.piecesPerBox || 1))).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-teal-800 dark:text-teal-300">
                    Piece Price (L.L.)
                  </span>
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 mt-0.5 block truncate">
                    {formatLBPValue(product.piecePriceLBP ?? Math.round((product.piecePriceUSD ?? (product.priceUSD / (product.piecesPerBox || 1))) * exchangeRate))} L.L.
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-teal-800 dark:text-teal-300">
                    Piece Barcode
                  </span>
                  <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 mt-0.5 block truncate">
                    {product.pieceBarcode || '—'}
                  </span>
                </div>
              </div>
            )}

            {product.skippedDecreasedPriceUSD !== undefined && (
              <div className="mt-2.5 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                <div className="flex items-center space-x-1.5">
                  <Info className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    Lower price from imported CSV (${product.skippedDecreasedPriceUSD.toFixed(2)} / {formatLBPValue(product.skippedDecreasedPriceLBP ?? 0)} L.L.) was skipped to preserve current selling price.
                  </span>
                </div>
                <span className="font-bold text-red-600 dark:text-red-400 flex items-center shrink-0 ml-2">
                  <ArrowDown className="h-3 w-3 mr-0.5" />
                  {getPriceChangeInfoUSD(product)?.percentFormatted}%
                </span>
              </div>
            )}
          </div>

          {/* 3. Stock Level & Batches */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center space-x-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                <Boxes className="h-4 w-4 text-teal-600" />
                <span>Inventory & Batch Expiry Tracking</span>
                {operations.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 rounded border border-teal-200/60 dark:border-teal-800/60">
                    {operations.length} Record{operations.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-3 text-xs">
                <span>
                  Total Stock:{' '}
                  <strong
                    className={
                      isOutOfStock
                        ? 'text-red-600'
                        : isLowStock
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }
                  >
                    {formatStockDisplay(product.stockQuantity, product.isDivisible, product.piecesPerBox, product.pieceName)}
                  </strong>
                </span>
                <span className="hidden text-slate-400">|</span>
                <span className="hidden">
                  Alert Threshold:{' '}
                  <strong className="text-slate-700 dark:text-slate-300">
                    {product.minStockAlert || 5} units
                  </strong>
                </span>
              </div>
            </div>

            {operations.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700/80 shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-3">Operation</th>
                        <th className="py-2.5 px-3 text-center">Quantity</th>
                        <th className="py-2.5 px-3">Expiry</th>
                        <th className="py-2.5 px-3 text-right">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {operations.map((op) => {
                        const { date: expDate } = parseExpiryDate(op.rawExpiry);
                        let isExpired = false;
                        let isNear = false;
                        if (expDate && !isNaN(expDate.getTime())) {
                          const now = new Date();
                          now.setHours(0, 0, 0, 0);
                          const diffDays = Math.ceil(
                            (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                          );
                          isExpired = diffDays < 0;
                          isNear = diffDays >= 0 && diffDays <= 90;
                        }

                        return (
                          <tr
                            key={op.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            {/* 1. Operation */}
                            <td className="py-2 px-3">
                              <div className="flex flex-col items-start gap-0.5">
                                {op.operationType === 'Purchase' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                                    Purchase
                                  </span>
                                ) : op.operationType === 'Sale' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
                                    Sale
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                                    Qty Adj
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {new Date(op.timestamp || op.date).toLocaleDateString()}
                                </span>
                              </div>
                            </td>

                            {/* 2. Quantity */}
                            <td className="py-2 px-3 text-center font-mono">
                              <span
                                className={`font-extrabold text-xs ${
                                  op.operationType === 'Purchase'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : op.operationType === 'Sale'
                                    ? 'text-blue-700 dark:text-blue-400'
                                    : 'text-amber-700 dark:text-amber-400'
                                }`}
                              >
                                {op.formattedQuantity}
                              </span>
                            </td>

                            {/* 3. Expiry */}
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`font-mono text-xs font-semibold ${
                                    isExpired
                                      ? 'text-red-600 dark:text-red-400 font-bold'
                                      : isNear
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {op.expiry}
                                </span>
                                {op.batchNumber && (
                                  <span
                                    className="font-mono text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700"
                                    title={`Batch / Lot Number: ${op.batchNumber}`}
                                  >
                                    Batch: {op.batchNumber}
                                  </span>
                                )}
                                {isExpired && (
                                  <span className="text-[9px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-1 py-0.2 rounded">
                                    EXP
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 4. Reference */}
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedOperation(op)}
                                className="inline-flex items-center gap-1 font-mono text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-200 underline decoration-teal-300 dark:decoration-teal-700 underline-offset-2 hover:bg-teal-50 dark:hover:bg-teal-950/50 px-2 py-1 rounded cursor-pointer transition-colors"
                                title={`View details for ${op.referenceId}`}
                              >
                                <span>{op.referenceId}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-slate-400 dark:border-slate-800 text-xs">
                No inventory operations recorded for this item.
              </div>
            )}
          </div>

          {/* 4. Clinical & Scientific Information (if drug or scientificInfo exists) */}
          {sciInfo && (
            <div className="hidden rounded-xl border border-teal-200/80 bg-teal-50/30 p-4 dark:border-teal-900/40 dark:bg-teal-950/20 space-y-3">
              <div className="flex items-center justify-between border-b border-teal-200/70 pb-2 dark:border-teal-900/50">
                <div className="flex items-center space-x-1.5 font-bold text-xs text-teal-900 dark:text-teal-200">
                  <BookOpen className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span>Clinical Scientific Reference & Dossier</span>
                </div>
                {sciInfo.onlineEnriched && (
                  <span className="inline-flex items-center space-x-1 rounded bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-800 dark:bg-teal-900/80 dark:text-teal-200 border border-teal-300/60 dark:border-teal-800">
                    <Sparkles className="h-3 w-3 text-teal-600" />
                    <span>{sciInfo.onlineSource || 'NIH NLM Enriched'}</span>
                  </span>
                )}
              </div>

              {/* Indications */}
              {sciInfo.indications && (
                <div>
                  <h4 className="font-bold text-xs text-teal-950 dark:text-teal-200 flex items-center space-x-1 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                    <span>Clinical Indications & Uses:</span>
                  </h4>
                  {renderClinicalLines(sciInfo.indications, 'text-teal-600 dark:text-teal-400')}
                </div>
              )}

              {/* Regimens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                {sciInfo.dosage && (
                  <div className="rounded-lg bg-white/80 p-2.5 dark:bg-slate-900/60 border border-teal-200/60 dark:border-teal-900/40">
                    <span className="font-bold text-teal-950 dark:text-teal-300 block mb-0.5">
                      Standard Regimen:
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {sciInfo.dosage}
                    </p>
                  </div>
                )}
                {sciInfo.pediatricDosage && (
                  <div className="rounded-lg bg-white/80 p-2.5 dark:bg-slate-900/60 border border-amber-200/60 dark:border-amber-900/40">
                    <span className="font-bold text-amber-900 dark:text-amber-300 block mb-0.5">
                      Pediatric Regimen:
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {sciInfo.pediatricDosage}
                    </p>
                  </div>
                )}
              </div>

              {/* Contraindications & Side Effects in split columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {sciInfo.contraindications && (
                  <div className="rounded-lg bg-rose-50/70 p-3 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50">
                    <h4 className="font-bold text-xs text-rose-900 dark:text-rose-200 flex items-center space-x-1 mb-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                      <span>Contraindications:</span>
                    </h4>
                    {renderClinicalLines(sciInfo.contraindications, 'text-rose-600 dark:text-rose-400')}
                    {sciInfo.pregnancyCategory && (
                      <div className="mt-2 text-[11px] font-semibold text-rose-800 dark:text-rose-300">
                        Pregnancy Category: Class {sciInfo.pregnancyCategory}
                      </div>
                    )}
                  </div>
                )}

                {sciInfo.sideEffects && (
                  <div className="rounded-lg bg-amber-50/70 p-3 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50">
                    <h4 className="font-bold text-xs text-amber-900 dark:text-amber-200 flex items-center space-x-1 mb-1.5">
                      <Flame className="h-3.5 w-3.5 text-amber-600" />
                      <span>Adverse Reactions:</span>
                    </h4>
                    {renderClinicalLines(sciInfo.sideEffects, 'text-amber-600 dark:text-amber-400')}
                    {sciInfo.storageConditions && (
                      <div className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                        <Thermometer className="h-3 w-3 text-slate-400" />
                        <span>Storage: {sciInfo.storageConditions}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* In-Stock Generics */}
              {sciInfo.generics && sciInfo.generics.length > 0 && (
                <div className="rounded-lg bg-white/80 p-2.5 dark:bg-slate-900/60 border border-teal-200/60 dark:border-teal-900/40 text-xs">
                  <div className="flex items-center space-x-1 font-bold text-slate-800 dark:text-slate-200 mb-1">
                    <Shuffle className="h-3.5 w-3.5 text-teal-600" />
                    <span>Equivalent Brands & Bio-equivalents:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sciInfo.generics.map((gen, idx) => (
                      <span
                        key={idx}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        {gen}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER (READ ONLY - NO EDIT / SAVE) */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-900 shrink-0">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Info className="h-3.5 w-3.5" />
            <span>Read-only overview • Press Esc to exit</span>
          </div>

          <div className="flex items-center space-x-2">
            {product.category === 'drug' && onViewScientific && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewScientific(product);
                }}
                className="inline-flex items-center space-x-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-900 cursor-pointer transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Open in Scientifics</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {selectedOperation && (
        <OperationDetailModal
          operation={selectedOperation}
          product={product}
          onClose={() => setSelectedOperation(null)}
        />
      )}
    </DesktopWindow>
  );
};
