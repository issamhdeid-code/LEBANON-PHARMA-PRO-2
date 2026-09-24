import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from 'motion/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  UserCheck,
  CreditCard,
  Banknote,
  Receipt,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Filter,
  X,
  Tag,
  Check,
  Percent,
  ArrowLeftRight,
  Printer,
  ArrowDownToLine,
  Wallet,
  Zap,
  SlidersHorizontal,
  Barcode,
  Calendar,
  Layers,
  Activity,
  PauseCircle,
  GripVertical
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { playScanBeepSound } from '../../utils/soundEffects';
import { useDebounce } from '../../hooks/useDebounce';
import { Product, CartItem, SaleTransaction, ProductCategory, ParkedSale } from '../../types/pharmacy';
import { formatStockDisplay, parseExpiryDate } from '../../utils/stockUtils';
import { formatLBPValue } from '../../utils/priceUtils';
import { filterProductsByMultiWordQuery } from '../../utils/searchUtils';
import { extractCleanMolecules } from '../../services/scientificDataService';
import { ReceiptModal } from '../common/ReceiptModal';
import { SalesTransactionLog } from './SalesTransactionLog';
import { DesktopWindow } from '../common/DesktopWindow';
import { SectionRestoreButton } from '../common/SectionRestoreButton';
import { DrugDetailsModal } from '../stock/DrugDetailsModal';
import { ParkedSalesModal } from './ParkedSalesModal';
import { useWindowContext } from '../../context/WindowContext';

interface SaleViewProps {
  onViewScientific: (product: Product) => void;
}

let sharedCanvasContext: CanvasRenderingContext2D | null = null;
function getSharedCanvasContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!sharedCanvasContext) {
    const canvas = document.createElement('canvas');
    sharedCanvasContext = canvas.getContext('2d');
  }
  return sharedCanvasContext;
}

interface ProductCardTitleProps {
  name: string;
  dosage?: string;
  presentation?: string;
  form?: string;
}

const ProductCardTitle: React.FC<ProductCardTitleProps> = ({
  name,
  dosage,
  presentation,
  form,
}) => {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const trimmedPresentation = presentation?.trim();
  const trimmedForm = form?.trim();
  const trimmedDosage = dosage?.trim();
  const hasMeta = !!(trimmedPresentation || trimmedForm);

  // Initial estimate to prevent visual layout shifts on first paint
  const [isWrapped, setIsWrapped] = useState(() => {
    const totalChars =
      name.length +
      (trimmedDosage ? trimmedDosage.length + 2 : 0) +
      (trimmedPresentation ? trimmedPresentation.length + 2 : 0) +
      (trimmedForm ? trimmedForm.length + 2 : 0);
    return totalChars * 7.5 > 220;
  });

  useEffect(() => {
    if (!hasMeta) return;
    const el = containerRef.current;
    if (!el) return;

    let lastWidth = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const evaluateWrap = (width?: number) => {
      const container = containerRef.current;
      if (!container) return;
      const containerWidth = width ?? container.clientWidth;
      if (containerWidth <= 0) return;

      const ctx = getSharedCanvasContext();
      let nameWidth = 0;
      let metaWidth = 0;

      if (ctx) {
        ctx.font = 'bold 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const nameText = trimmedDosage ? `${name}  ${trimmedDosage}` : name;
        nameWidth = ctx.measureText(nameText).width;

        ctx.font = '11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const metaParts = [trimmedPresentation, trimmedForm].filter(Boolean);
        metaWidth = ctx.measureText(metaParts.join('  ')).width;
      } else {
        nameWidth = (name.length + (trimmedDosage?.length || 0)) * 7.5;
        metaWidth = ((trimmedPresentation?.length || 0) + (trimmedForm?.length || 0)) * 6.8;
      }

      // If name + meta + required gap (16px) does not fit on one line:
      const shouldWrap = (nameWidth + metaWidth + 16) > containerWidth;
      setIsWrapped(prev => (prev !== shouldWrap ? shouldWrap : prev));
    };

    evaluateWrap();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = entry.contentRect.width;
      if (w <= 0 || Math.abs(w - lastWidth) < 2) return;
      lastWidth = w;
      if (timerId !== null) clearTimeout(timerId);
      // Defer state update to next macrotask to prevent ResizeObserver loop notification
      timerId = setTimeout(() => {
        evaluateWrap(w);
      }, 0);
    });
    resizeObserver.observe(el);

    return () => {
      if (timerId !== null) clearTimeout(timerId);
      resizeObserver.disconnect();
    };
  }, [name, trimmedDosage, trimmedPresentation, trimmedForm, hasMeta]);

  if (!hasMeta) {
    return (
      <h3 ref={containerRef} className="mt-1 leading-snug">
        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 break-words whitespace-normal">
          {name}
          {trimmedDosage && (
            <span className="ml-1.5 font-semibold text-teal-700 dark:text-teal-400">
              {trimmedDosage}
            </span>
          )}
        </span>
      </h3>
    );
  }

  // If presentation or form are not on the same line next to the item name, adjust alignment to the left
  if (isWrapped) {
    return (
      <h3 ref={containerRef} className="mt-1 flex flex-col items-start gap-0.5 leading-snug w-full">
        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 break-words whitespace-normal w-full text-left">
          {name}
          {trimmedDosage && (
            <span className="ml-1.5 font-semibold text-teal-700 dark:text-teal-400">
              {trimmedDosage}
            </span>
          )}
        </span>
        <span className="w-full flex items-baseline gap-1.5 text-left text-[11px] justify-start flex-wrap">
          {trimmedPresentation && (
            <span className="font-semibold text-slate-700 dark:text-slate-300 break-words">
              {trimmedPresentation}
            </span>
          )}
          {trimmedForm && (
            <span className="font-normal text-slate-500 dark:text-slate-400 break-words">
              {trimmedForm}
            </span>
          )}
        </span>
      </h3>
    );
  }

  // When on the same line: form on extreme right, presentation before it
  return (
    <h3 ref={containerRef} className="mt-1 flex items-baseline justify-between gap-1.5 leading-snug w-full">
      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 break-words whitespace-normal flex-1 min-w-0">
        {name}
        {trimmedDosage && (
          <span className="ml-1.5 font-semibold text-teal-700 dark:text-teal-400">
            {trimmedDosage}
          </span>
        )}
      </span>
      <span className="ml-auto flex items-baseline gap-1.5 text-right text-[11px] justify-end shrink-0">
        {trimmedPresentation && (
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {trimmedPresentation}
          </span>
        )}
        {trimmedForm && (
          <span className="font-normal text-slate-500 dark:text-slate-400">
            {trimmedForm}
          </span>
        )}
      </span>
    </h3>
  );
};

const UNREAL_INVOICE_ID = '__UNREAL_INVOICE__';

interface ProductCardProps {
  prod: Product;
  index: number;
  isFocused: boolean;
  inCartBoxes: number;
  inCartPieces: number;
  onAdd: (prod: Product) => void;
  onAddPiece: (prod: Product) => void;
  onViewScientific: (prod: Product) => void;
  onOpenStockCard: (prod: Product) => void;
  isUnreal?: boolean;
  viewMode?: 'pos' | 'advanced';
}

const ProductCard = React.memo(function ProductCard({
  prod,
  index,
  isFocused,
  inCartBoxes,
  inCartPieces,
  onAdd,
  onAddPiece,
  onViewScientific,
  onOpenStockCard,
  isUnreal = false,
  viewMode = 'pos',
}: ProductCardProps) {
  const isLow = prod.stockQuantity <= prod.minStockAlert;
  const isOut = prod.stockQuantity <= 0;
  const isInCart = inCartBoxes > 0 || inCartPieces > 0;
  const canAdd = !isOut || isUnreal;
  const totalInCartDisplay = inCartBoxes > 0 && inCartPieces > 0
    ? `${inCartBoxes} bxs, ${inCartPieces} ${prod.pieceName || 'pcs'}`
    : inCartBoxes > 0
    ? `${inCartBoxes} ${inCartBoxes === 1 ? 'box' : 'boxes'}`
    : `${inCartPieces} ${prod.pieceName || 'pcs'}`;

  // Advanced mode computations
  const marginPct = prod.pharmacistMarginProfit || (prod.costPriceUSD > 0 && prod.priceUSD > 0 ? ((prod.priceUSD - prod.costPriceUSD) / prod.priceUSD) * 100 : 0);
  const activeBatches = prod.batches && prod.batches.length > 0 ? prod.batches : (prod.batchNumber ? [{ batchNumber: prod.batchNumber, expiryDate: prod.expiryDate, quantity: prod.stockQuantity }] : []);
  const primaryBatch = activeBatches[0] || null;
  const expDateStr = primaryBatch?.expiryDate || prod.expiryDate;

  // Expiry check
  let expiryStatus: 'expired' | 'soon' | 'valid' | 'none' = 'none';
  let formattedExpDate = '';
  if (expDateStr) {
    formattedExpDate = expDateStr.length === 7 ? expDateStr : expDateStr.slice(0, 7);
    const expDate = new Date(expDateStr);
    if (!isNaN(expDate.getTime())) {
      const now = new Date();
      const diffMonths = (expDate.getFullYear() - now.getFullYear()) * 12 + (expDate.getMonth() - now.getMonth());
      if (diffMonths < 0) expiryStatus = 'expired';
      else if (diffMonths <= 3) expiryStatus = 'soon';
      else expiryStatus = 'valid';
    }
  }

  if (viewMode === 'advanced') {
    return (
      <div
        id={`product-card-${index}`}
        onClick={() => {
          if (canAdd) onAdd(prod);
        }}
        role="button"
        tabIndex={canAdd ? 0 : -1}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && canAdd) {
            e.preventDefault();
            onAdd(prod);
          }
        }}
        className={`group relative flex flex-col justify-between rounded-lg border p-3 transition-all select-none shadow-2xs ${
          isFocused ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 border-indigo-500 z-10' : ''
        } ${
          isOut && !isUnreal
            ? 'border-gray-200 bg-gray-50/70 opacity-70 dark:border-slate-800 dark:bg-slate-900/40 cursor-not-allowed'
            : isInCart
            ? 'border-teal-500 bg-teal-50/30 ring-1 ring-teal-500/30 hover:border-teal-600 hover:shadow-md dark:border-teal-500 dark:bg-teal-950/25 cursor-pointer'
            : isOut && isUnreal
            ? 'border-amber-300 bg-amber-50/30 hover:border-amber-500 hover:shadow-md dark:border-amber-700/50 dark:bg-amber-950/20 cursor-pointer'
            : 'border-gray-200 bg-white hover:border-teal-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-teal-500 cursor-pointer'
        }`}
      >
        <div className="space-y-2">
          {/* Header Row: Codes, Category, Importer & Quick Actions */}
          <div className="flex items-start justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[10px] font-bold uppercase rounded bg-gray-100 px-1.5 py-0.5 text-gray-700 dark:bg-slate-800 dark:text-slate-300">
                {prod.code}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  prod.category === 'drug'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                    : prod.category === 'vitamins'
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
                    : prod.category === 'cosmetics'
                    ? 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300'
                    : 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                }`}
              >
                {prod.category}
              </span>
              {prod.agent && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400 truncate max-w-[120px]" title={`Importer/Agent: ${prod.agent}`}>
                  {prod.agent}
                </span>
              )}
              {prod.barcode && (
                <span className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-mono text-gray-400 dark:text-slate-500">
                  <Barcode className="h-3 w-3" />
                  {prod.barcode}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isInCart && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-2xs shrink-0">
                  <Check className="h-2.5 w-2.5" />
                  <span>{totalInCartDisplay} in cart</span>
                </span>
              )}
              {/* Quick Stock Card button (s) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenStockCard(prod);
                }}
                className="flex items-center justify-center w-5 h-5 rounded border border-gray-200 text-[10px] font-bold text-gray-600 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 cursor-pointer transition-colors leading-none"
                title="Open Stock Card of this item (Shortcut: s)"
              >
                s
              </button>
              {/* Scientific info */}
              {prod.category === 'drug' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewScientific(prod);
                  }}
                  className="flex items-center justify-center w-5 h-5 rounded border border-gray-200 text-gray-400 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 cursor-pointer transition-colors"
                  title="View Scientific Indications, Contraindications & Generics"
                >
                  <Info className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Product Title, Presentation, Dosage */}
          <ProductCardTitle
            name={prod.name}
            dosage={prod.dosage}
            presentation={prod.presentation}
            form={prod.form}
          />

          {prod.ingredients && (
            <p className="text-[10px] text-gray-500 dark:text-slate-400 line-clamp-1 leading-tight">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Active: </span>
              {prod.ingredients}
            </p>
          )}

          {/* Full Inventory, Batch & Expiry Micro-Panel */}
          <div className="rounded border border-gray-100 bg-slate-50/80 p-2 text-[10px] dark:border-slate-800 dark:bg-slate-800/40 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Layers className="h-3 w-3 text-teal-600" />
                Stock: {formatStockDisplay(prod.stockQuantity, prod.isDivisible, prod.piecesPerBox, prod.pieceName)}
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                isOut
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : isLow
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}>
                {isOut ? 'Out of Stock' : isLow ? `Low (Min: ${prod.minStockAlert})` : 'In Stock'}
              </span>
            </div>

            {/* Batch & Expiry Date row */}
            <div className="flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 pt-0.5 border-t border-gray-200/50 dark:border-slate-700/50">
              <span className="truncate max-w-[130px]">
                {primaryBatch?.batchNumber ? `Lot: #${primaryBatch.batchNumber}` : 'Lot: Unassigned'}
                {activeBatches.length > 1 && ` (${activeBatches.length} lots)`}
              </span>
              {formattedExpDate ? (
                <span className={`font-semibold flex items-center gap-0.5 ${
                  expiryStatus === 'expired'
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : expiryStatus === 'soon'
                    ? 'text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}>
                  <Calendar className="h-2.5 w-2.5" />
                  Exp: {formattedExpDate}
                </span>
              ) : (
                <span>No Exp Date</span>
              )}
            </div>
          </div>
        </div>

        {/* Pricing, Cost, Margin & Quick Add Buttons */}
        <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                ${prod.priceUSD.toFixed(2)}
              </span>
              <span className="text-[10px] font-semibold text-green-700 dark:text-green-400">
                {formatLBPValue(prod.priceLBP)} LBP
              </span>
            </div>

            {/* Margin & Cost info */}
            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
              {prod.costPriceUSD > 0 && (
                <span>Cost: ${prod.costPriceUSD.toFixed(2)}</span>
              )}
              {marginPct > 0 && (
                <span className="rounded bg-emerald-50 px-1 py-0.2 font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {marginPct.toFixed(1)}% mgn
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {prod.isDivisible && prod.piecesPerBox && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddPiece(prod);
                }}
                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 rounded text-[10px] font-bold shadow-2xs transition-colors border border-indigo-200 dark:border-indigo-800/50 cursor-pointer"
                title={`Add 1 ${prod.pieceName || 'Piece'} ($${(prod.piecePriceUSD || prod.priceUSD / prod.piecesPerBox).toFixed(2)})`}
              >
                + {prod.pieceName || 'Piece'}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (canAdd) onAdd(prod);
              }}
              disabled={!canAdd}
              className={`px-2 py-1 rounded text-[10px] font-bold shadow-2xs transition-colors cursor-pointer ${
                canAdd
                  ? 'bg-teal-700 hover:bg-teal-800 text-white dark:bg-teal-600 dark:hover:bg-teal-500'
                  : 'bg-gray-200 text-gray-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              + Box
            </button>
          </div>
        </div>
      </div>
    );
  }

  // POS Mode (Simplified high-speed retail checkout: hides MOPH code, category, and active ingredients)
  return (
    <div
      id={`product-card-${index}`}
      onClick={() => {
        if (canAdd) onAdd(prod);
      }}
      role="button"
      tabIndex={canAdd ? 0 : -1}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && canAdd) {
          e.preventDefault();
          onAdd(prod);
        }
      }}
      className={`group relative flex flex-col justify-between rounded-lg border p-2.5 transition-all select-none shadow-2xs min-h-[92px] ${
        isFocused ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 border-indigo-500 z-10' : ''
      } ${
        isOut && !isUnreal
          ? 'border-gray-200 bg-gray-50/70 opacity-60 dark:border-slate-800 dark:bg-slate-900/40 cursor-not-allowed'
          : isInCart
          ? 'border-teal-500 bg-teal-50/30 ring-1 ring-teal-500/30 hover:border-teal-600 hover:shadow-md active:scale-[0.985] dark:border-teal-500 dark:bg-teal-950/25 cursor-pointer'
          : isOut && isUnreal
          ? 'border-amber-300 bg-amber-50/30 hover:border-amber-500 hover:shadow-md active:scale-[0.985] dark:border-amber-700/50 dark:bg-amber-950/20 cursor-pointer'
          : 'border-gray-200 bg-white hover:border-teal-500 hover:shadow-md active:scale-[0.985] dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-teal-500 cursor-pointer'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0 pr-0.5">
            <ProductCardTitle
              name={prod.name}
              dosage={prod.dosage}
              presentation={prod.presentation}
              form={prod.form}
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isInCart && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-600 px-1.5 py-0.5 text-[8.5px] font-bold text-white shadow-2xs shrink-0" title={`${totalInCartDisplay} in cart`}>
                <Check className="h-2 w-2" />
                <span className="max-w-[70px] truncate">{totalInCartDisplay}</span>
              </span>
            )}
            {/* Quick Stock Card button (s) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStockCard(prod);
              }}
              className="flex items-center justify-center w-4.5 h-4.5 rounded border border-gray-200 text-[9px] font-bold text-gray-500 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 cursor-pointer transition-colors leading-none"
              title="Open Stock Card of this item (s)"
            >
              s
            </button>
            {/* Requirement 22: For drugs, quick scientific info */}
            {prod.category === 'drug' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewScientific(prod);
                }}
                className="flex items-center justify-center w-4.5 h-4.5 rounded border border-gray-200 text-gray-400 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 cursor-pointer transition-colors"
                title="View Scientific Indications, Contraindications & Generics"
              >
                <Info className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
        <div className="shrink-0 min-w-0">
          <div className="text-sm font-black text-blue-600 dark:text-blue-400 leading-none">
            ${prod.priceUSD.toFixed(2)}
          </div>
          <div className="text-[9.5px] font-semibold text-green-700 dark:text-green-400 leading-tight mt-0.5 truncate">
            {formatLBPValue(prod.priceLBP)} LBP
          </div>
        </div>

        <div className="text-right flex flex-col items-end space-y-1 shrink-0">
          {prod.isDivisible && prod.piecesPerBox && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddPiece(prod);
              }}
              className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 rounded text-[8.5px] font-bold shadow-2xs transition-colors border border-indigo-200 dark:border-indigo-800/50 z-10 cursor-pointer leading-none"
            >
              + Add {prod.pieceName || 'Piece'}
            </button>
          )}
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[9.5px] font-bold leading-none ${
              isOut
                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                : isLow
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                : 'text-green-700 dark:text-green-400 font-semibold'
            }`}
          >
            {isOut ? 'Out of Stock' : `${formatStockDisplay(prod.stockQuantity, prod.isDivisible, prod.piecesPerBox, prod.pieceName)} in stock`}
          </span>
        </div>
      </div>
    </div>
  );
});

export const SaleView: React.FC<SaleViewProps> = ({ onViewScientific }) => {
  const {
    products,
    customers,
    currentUser,
    recordSale,
    exchangeRate,
    toLBP,
    toUSD,
    formatLBP,
    formatUSD,
    settings,
    addNotification,
    updateProduct,
  } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Barcode scan feedback state
  interface ScanFeedback {
    type: 'idle' | 'success' | 'not-found' | 'out-of-stock';
    message: string;
    productName?: string;
    barcode?: string;
  }

  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>({
    type: 'idle',
    message: '',
  });
  const scanFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerScanFeedback = useCallback((
    type: 'success' | 'not-found' | 'out-of-stock',
    message: string,
    extra?: { productName?: string; barcode?: string }
  ) => {
    if (type === 'success') {
      playScanBeepSound();
    }
    if (scanFeedbackTimeoutRef.current) {
      clearTimeout(scanFeedbackTimeoutRef.current);
    }
    setScanFeedback({
      type,
      message,
      productName: extra?.productName,
      barcode: extra?.barcode,
    });
    scanFeedbackTimeoutRef.current = setTimeout(() => {
      setScanFeedback({ type: 'idle', message: '' });
    }, 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (scanFeedbackTimeoutRef.current) {
        clearTimeout(scanFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const getNumCols = useCallback((mode: 'pos' | 'advanced') => {
    const width = window.innerWidth;
    if (mode === 'pos') {
      if (width >= 1024) return 4;
      if (width >= 768) return 3;
      if (width >= 480) return 2;
      return 1;
    } else {
      if (width >= 1280) return 3;
      if (width >= 640) return 2;
      return 1;
    }
  }, []);

  const [catalogViewMode, setCatalogViewMode] = useState<'pos' | 'advanced'>(() => {
    return (localStorage.getItem('pos_catalog_view_mode') as 'pos' | 'advanced') || 'pos';
  });

  const [numCols, setNumCols] = useState<number>(() => {
    const initialMode = (localStorage.getItem('pos_catalog_view_mode') as 'pos' | 'advanced') || 'pos';
    const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
    if (initialMode === 'pos') {
      if (width >= 1024) return 4;
      if (width >= 768) return 3;
      if (width >= 480) return 2;
      return 1;
    } else {
      if (width >= 1280) return 3;
      if (width >= 640) return 2;
      return 1;
    }
  });

  const handleSetCatalogViewMode = (mode: 'pos' | 'advanced') => {
    setCatalogViewMode(mode);
    localStorage.setItem('pos_catalog_view_mode', mode);
    setNumCols(getNumCols(mode));
  };

  const DEFAULT_CART_WIDTH = 450;
  const MIN_CART_WIDTH = 340;
  const [cartWidth, setCartWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pos_cart_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_CART_WIDTH && parsed <= 950) return parsed;
      }
    } catch {}
    return DEFAULT_CART_WIDTH;
  });
  const [isDraggingCartResizer, setIsDraggingCartResizer] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  useEffect(() => {
    const handleResize = () => {
      setNumCols(getNumCols(catalogViewMode));
      setIsDesktop(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [catalogViewMode, getNumCols]);

  const handleResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingCartResizer(true);
    const startX = e.clientX;
    const startWidth = cartWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      // When cart is positioned on the right: dragging left (negative deltaX) increases width
      // When cart is positioned on the left: dragging right (positive deltaX) increases width
      const newWidth = cartPosition === 'right' ? startWidth - deltaX : startWidth + deltaX;
      const maxWidth = Math.min(900, Math.floor(window.innerWidth * 0.7));
      const clamped = Math.max(MIN_CART_WIDTH, Math.min(maxWidth, Math.round(newWidth)));
      setCartWidth(clamped);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      setIsDraggingCartResizer(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      const deltaX = upEvent.clientX - startX;
      const newWidth = cartPosition === 'right' ? startWidth - deltaX : startWidth + deltaX;
      const maxWidth = Math.min(900, Math.floor(window.innerWidth * 0.7));
      const clamped = Math.max(MIN_CART_WIDTH, Math.min(maxWidth, Math.round(newWidth)));
      try {
        localStorage.setItem('pos_cart_width', String(clamped));
      } catch {}
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleResizerDoubleClick = () => {
    setCartWidth(DEFAULT_CART_WIDTH);
    try {
      localStorage.setItem('pos_cart_width', String(DEFAULT_CART_WIDTH));
    } catch {}
  };

  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingQuantities, setEditingQuantities] = useState<Record<string, string>>({});
  const [editingUnitPriceLBP, setEditingUnitPriceLBP] = useState<Record<string, string>>({});
  const [cartPosition, setCartPosition] = useState<'right' | 'left'>(() => {
    return (localStorage.getItem('pos_cart_position') as 'right' | 'left') || 'right';
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const isUnrealInvoice = selectedCustomerId === UNREAL_INVOICE_ID;
  const [paymentMethod, setPaymentMethod] = useState<'cash_lbp' | 'cash_usd' | 'mixed' | 'credit_debt'>('cash_lbp');
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState<boolean>(false);
  const [writeOffDifferences, setWriteOffDifferences] = useState<boolean>(false);

  const { restoreWindow } = useWindowContext();
  const [selectedStockCardProduct, setSelectedStockCardProduct] = useState<Product | null>(null);
  const [isStockCardOpen, setIsStockCardOpen] = useState<boolean>(false);

  const handleOpenStockCard = useCallback((prod: Product) => {
    setSelectedStockCardProduct(prod);
    restoreWindow('stock-card-modal');
    restoreWindow('stock_drug_intelligence_details');
    restoreWindow('drug_intelligence');
    setIsStockCardOpen(true);
  }, [restoreWindow]);

  const selectedCust = useMemo(
    () => (selectedCustomerId === UNREAL_INVOICE_ID ? null : customers.find((c) => c.id === selectedCustomerId)),
    [customers, selectedCustomerId]
  );

  // Tendered amounts
  const [tenderedUSD, setTenderedUSD] = useState<string>('');
  const [tenderedLBP, setTenderedLBP] = useState<string>('');
  const [changeCurrency, setChangeCurrency] = useState<'USD' | 'LBP' | 'keep_extra' | 'auto'>('auto');
  const [customChangeUSD, setCustomChangeUSD] = useState<string>('');
  const [customChangeLBP, setCustomChangeLBP] = useState<string>('');
  const [isCustomChange, setIsCustomChange] = useState<boolean>(false);

  const [lastCompletedSale, setLastCompletedSale] = useState<SaleTransaction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leftPanelMode, setLeftPanelMode] = useState<'log' | 'catalog'>('log');
  const catalogContainerRef = useRef<HTMLDivElement>(null);
  const printAfterSaleRef = useRef(false);

  // Parked / Held Sales State (persistent across reloads via localStorage)
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>(() => {
    try {
      const raw = localStorage.getItem('pos_parked_sales');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isParkedModalOpen, setIsParkedModalOpen] = useState<boolean>(false);
  const holdCurrentSaleRef = useRef<((optionalNote?: string) => void) | null>(null);

  // Stock price change confirmation prompt state
  interface PriceChangePrompt {
    product: Product;
    isPiece?: boolean;
    oldPriceLBP: number;
    newPriceLBP: number;
    oldPriceUSD: number;
    newPriceUSD: number;
  }
  const [priceChangePrompt, setPriceChangePrompt] = useState<PriceChangePrompt | null>(null);

  const confirmUpdateStockPrice = () => {
    if (!priceChangePrompt) return;
    const { product, isPiece, newPriceLBP, newPriceUSD, oldPriceLBP, oldPriceUSD } = priceChangePrompt;

    if (isPiece) {
      updateProduct(product.id, {
        piecePriceLBP: newPriceLBP,
        piecePriceUSD: newPriceUSD,
      });
      // Also update the cart item's product reference so it reflects the updated base product
      setCart((prev) =>
        prev.map((it) =>
          it.product.id === product.id
            ? {
                ...it,
                product: {
                  ...it.product,
                  piecePriceLBP: newPriceLBP,
                  piecePriceUSD: newPriceUSD,
                },
              }
            : it
        )
      );
    } else {
      updateProduct(product.id, {
        priceLBP: newPriceLBP,
        priceUSD: newPriceUSD,
        previousPriceLBP: oldPriceLBP,
        previousPriceUSD: oldPriceUSD,
        priceChangedAt: Date.now(),
      });
      // Also update the cart item's product reference
      setCart((prev) =>
        prev.map((it) =>
          it.product.id === product.id
            ? {
                ...it,
                product: {
                  ...it.product,
                  priceLBP: newPriceLBP,
                  priceUSD: newPriceUSD,
                  previousPriceLBP: oldPriceLBP,
                  previousPriceUSD: oldPriceUSD,
                  priceChangedAt: Date.now(),
                },
              }
            : it
        )
      );
    }

    addNotification(
      'Stock Price Updated',
      `Updated stock selling price for "${product.name}"${isPiece ? ' (Piece)' : ''} to ${newPriceLBP.toLocaleString('en-US')} LBP ($${newPriceUSD.toFixed(2)}).`,
      'inventory',
      'info'
    );
    setPriceChangePrompt(null);
  };

  useEffect(() => {
    try {
      localStorage.setItem('pos_parked_sales', JSON.stringify(parkedSales));
    } catch (err) {
      console.warn('Failed to persist parked sales', err);
    }
  }, [parkedSales]);

  const [focusedItemIndex, setFocusedItemIndex] = useState<number>(-1);
  const addToCartRef = useRef<((product: Product, isPiece?: boolean) => boolean | void) | null>(null);

  // Cart operations
  const addToCart = useCallback((product: Product, isPiece: boolean = false): boolean => {
    if (!isUnrealInvoice && product.stockQuantity <= 0) {
      setErrorMessage(`Cannot add "${product.name}": Out of stock!`);
      setTimeout(() => setErrorMessage(null), 3000);
      return false;
    }

    const requestedEquivalent = isPiece && product.piecesPerBox ? (1 / product.piecesPerBox) : 1;

    // Synchronous check against current cart usage
    if (!isUnrealInvoice) {
      const currentUsage = cart
        .filter((item) => item.product.id === product.id)
        .reduce((sum, item) => sum + (item.isPiece && item.product.piecesPerBox ? item.quantity / item.product.piecesPerBox : item.quantity), 0);

      if (currentUsage + requestedEquivalent > product.stockQuantity) {
        setErrorMessage(`Only ${formatStockDisplay(product.stockQuantity, product.isDivisible, product.piecesPerBox, product.pieceName)} available in stock!`);
        setTimeout(() => setErrorMessage(null), 3000);
        return false;
      }
    }

    setCart((prev) => {
      if (!isUnrealInvoice) {
        const currentUsage = prev
          .filter((item) => item.product.id === product.id)
          .reduce((sum, item) => sum + (item.isPiece && item.product.piecesPerBox ? item.quantity / item.product.piecesPerBox : item.quantity), 0);

        if (currentUsage + requestedEquivalent > product.stockQuantity) {
          return prev;
        }
      }

      const existingIdx = prev.findIndex((item) => item.product.id === product.id && !!item.isPiece === !!isPiece && (!item.selectedBatchNumber || (item.product.batches && item.product.batches.length <= 1)));
      if (existingIdx >= 0) {
        const newCart = [...prev];
        newCart[existingIdx] = { ...newCart[existingIdx], quantity: newCart[existingIdx].quantity + 1 };
        return newCart;
      }
      
      const divisor = isPiece && product.piecesPerBox ? product.piecesPerBox : 1;
      
      let initialUnitPriceUSD = 0;
      let initialUnitPriceLBP = 0;
      
      if (isPiece && (product.piecePriceUSD != null || product.piecePriceLBP != null)) {
        initialUnitPriceUSD = product.piecePriceUSD != null ? product.piecePriceUSD : Number(((product.piecePriceLBP ?? 0) / exchangeRate).toFixed(2));
        initialUnitPriceLBP = product.piecePriceLBP != null ? product.piecePriceLBP : Math.round((product.piecePriceUSD ?? 0) * exchangeRate);
      } else {
        initialUnitPriceUSD = Number((product.priceUSD / divisor).toFixed(2));
        initialUnitPriceLBP = Math.round(product.priceLBP / divisor);
      }

      return [
        ...prev,
        {
          cartItemId: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          product,
          quantity: 1,
          discountPercent: 0,
          unitPriceUSD: initialUnitPriceUSD,
          unitPriceLBP: initialUnitPriceLBP,
          isPiece,
        },
      ];
    });

    return true;
  }, [isUnrealInvoice, cart, exchangeRate]);

  // Keep ref fresh so keydown handlers always use the latest
  useEffect(() => {
    addToCartRef.current = addToCart;
  }, [addToCart]);

  // Barcode scanning handler with visual feedback
  const lastScannedBarcodeTimeRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 });

  // Auto-clear and focus mechanism for continuous barcode scanning
  const clearAndFocusSearchInput = useCallback(() => {
    setSearchQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      searchInputRef.current.focus();
    }
    // Handle React state flush and virtualizer updates
    requestAnimationFrame(() => {
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
        searchInputRef.current.focus();
      }
    });
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
        searchInputRef.current.focus();
      }
    }, 40);
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
        searchInputRef.current.focus();
      }
    }, 120);
  }, []);

  const handleBarcodeScan = useCallback((scannedCode: string) => {
    const rawBarcode = scannedCode.trim();
    const cleanScan = rawBarcode.toLowerCase();
    if (!cleanScan) return;

    // Prevent duplicate hardware bounce (< 180ms), but allow continuous scanning of identical items
    const now = Date.now();
    if (
      lastScannedBarcodeTimeRef.current.barcode === cleanScan &&
      now - lastScannedBarcodeTimeRef.current.time < 180
    ) {
      return;
    }
    lastScannedBarcodeTimeRef.current = { barcode: cleanScan, time: now };

    if (leftPanelMode !== 'catalog') {
      setLeftPanelMode('catalog');
    }

    // 1. Check piece barcode
    const pieceMatch = products.find(
      (p) => p.isDivisible && (p.pieceBarcode || '').toLowerCase() === cleanScan
    );
    if (pieceMatch) {
      if (!isUnrealInvoice && pieceMatch.stockQuantity <= 0) {
        triggerScanFeedback('out-of-stock', `"${pieceMatch.name} (${pieceMatch.pieceName || 'Piece'})" is not found in stock (0 available).`, {
          productName: pieceMatch.name,
          barcode: rawBarcode,
        });
        setErrorMessage(`Cannot add "${pieceMatch.name}": Out of stock!`);
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }

      const added = addToCart(pieceMatch, true);
      if (added) {
        triggerScanFeedback('success', `Valid barcode scanned: Added "${pieceMatch.name} (${pieceMatch.pieceName || 'Piece'})" to cart!`, {
          productName: pieceMatch.name,
          barcode: rawBarcode,
        });
        clearAndFocusSearchInput();
      } else {
        triggerScanFeedback('out-of-stock', `Cannot add "${pieceMatch.name}": Insufficient stock in inventory!`, {
          productName: pieceMatch.name,
          barcode: rawBarcode,
        });
        clearAndFocusSearchInput();
      }
      return;
    }

    // 2. Check full product barcode or product code
    const product = products.find(
      (p) => (p.barcode || '').toLowerCase() === cleanScan || (p.code || '').toLowerCase() === cleanScan
    );
    if (product) {
      if (!isUnrealInvoice && product.stockQuantity <= 0) {
        triggerScanFeedback('out-of-stock', `"${product.name}" is not found in stock (0 available).`, {
          productName: product.name,
          barcode: rawBarcode,
        });
        setErrorMessage(`Cannot add "${product.name}": Out of stock!`);
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }

      const added = addToCart(product, false);
      if (added) {
        triggerScanFeedback('success', `Valid barcode scanned: Added "${product.name}" to cart!`, {
          productName: product.name,
          barcode: rawBarcode,
        });
        clearAndFocusSearchInput();
      } else {
        triggerScanFeedback('out-of-stock', `Cannot add "${product.name}": Insufficient stock in inventory!`, {
          productName: product.name,
          barcode: rawBarcode,
        });
        clearAndFocusSearchInput();
      }
      return;
    }

    // 3. Barcode not related to any product in inventory
    triggerScanFeedback('not-found', `Scanned barcode "${rawBarcode}" is not found in stock or related to any product.`, {
      barcode: rawBarcode,
    });
    setErrorMessage(`Barcode "${rawBarcode}" is not related to any product in inventory.`);
    setTimeout(() => setErrorMessage(null), 3000);
    setSearchQuery(rawBarcode);
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 50);
  }, [leftPanelMode, products, isUnrealInvoice, addToCart, triggerScanFeedback, clearAndFocusSearchInput]);

  // Global barcode scanner listener configured for continuous hand-scanning
  useBarcodeScanner({
    onScan: (barcode) => {
      handleBarcodeScan(barcode);
    },
    cooldownMs: 180,
    blurOnScan: false,
  });

  // Filtered products: search is expensive (multi-word + Arabic normalization), so it only
  // runs off the debounced query. Cart sorting is split out so cart changes don't re-scan 5600 products.
  const searchedProducts = useMemo(() => {
    return filterProductsByMultiWordQuery(products, debouncedSearchQuery, selectedCategory);
  }, [products, debouncedSearchQuery, selectedCategory]);

  const cartProductIds = useMemo(() => new Set(cart.map(item => item.product.id)), [cart]);

  const cartInfoById = useMemo(() => {
    const map = new Map<string, { boxes: number; pieces: number }>();
    for (const item of cart) {
      const entry = map.get(item.product.id) || { boxes: 0, pieces: 0 };
      if (item.isPiece) entry.pieces += item.quantity;
      else entry.boxes += item.quantity;
      map.set(item.product.id, entry);
    }
    return map;
  }, [cart]);

  const filteredProducts = useMemo(() => {
    if (!searchedProducts.length) return searchedProducts;
    const sorted = [...searchedProducts];
    sorted.sort((a, b) => {
      const aInCart = cartProductIds.has(a.id);
      const bInCart = cartProductIds.has(b.id);
      if (aInCart && !bInCart) return -1;
      if (!aInCart && bInCart) return 1;
      return 0;
    });
    return sorted;
  }, [searchedProducts, cartProductIds]);

  // Virtualize the product grid: only renders the visible cards (3-col rows)
  const productGridVirtualizer = useVirtualizer({
    count: Math.ceil(filteredProducts.length / numCols),
    getScrollElement: () => catalogContainerRef.current,
    estimateSize: () => (catalogViewMode === 'advanced' ? 245 : 105),
    overscan: 4,
    getItemKey: (index) => `${catalogViewMode}-${index}`,
    useFlushSync: false,
  });

  // Reset focus when filters change
  useEffect(() => {
    setFocusedItemIndex(-1);
  }, [searchQuery, selectedCategory]);

  // Handle global keyboard shortcuts for navigation and selection
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput) {
        if ((e.target as HTMLInputElement).type !== 'text') return;
      }

      if (e.key === 'Escape') {
        setSearchQuery('');
        setFocusedItemIndex(-1);
        return;
      }

      if (leftPanelMode !== 'catalog') return;
      if (filteredProducts.length === 0) return;

      const currentCols = numCols;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedItemIndex(prev => {
          if (prev === -1) return 0;
          const next = prev < filteredProducts.length - currentCols ? prev + currentCols : prev;
          setTimeout(() => productGridVirtualizer.scrollToIndex(Math.floor(next / currentCols), { align: 'auto', behavior: 'smooth' }), 0);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedItemIndex(prev => {
          if (prev === -1) return 0;
          const next = prev >= currentCols ? prev - currentCols : 0;
          setTimeout(() => productGridVirtualizer.scrollToIndex(Math.floor(next / currentCols), { align: 'auto', behavior: 'smooth' }), 0);
          return next;
        });
      } else if (e.key === 'ArrowRight') {
        if (isInput && focusedItemIndex === -1) return; // Allow text cursor movement if user hasn't started grid navigation
        e.preventDefault();
        setFocusedItemIndex(prev => {
          if (prev === -1) return 0;
          const next = prev < filteredProducts.length - 1 ? prev + 1 : prev;
          setTimeout(() => productGridVirtualizer.scrollToIndex(Math.floor(next / currentCols), { align: 'auto', behavior: 'smooth' }), 0);
          return next;
        });
      } else if (e.key === 'ArrowLeft') {
        if (isInput && focusedItemIndex === -1) return; // Allow text cursor movement if user hasn't started grid navigation
        e.preventDefault();
        setFocusedItemIndex(prev => {
          if (prev === -1) return 0;
          const next = prev > 0 ? prev - 1 : 0;
          setTimeout(() => productGridVirtualizer.scrollToIndex(Math.floor(next / currentCols), { align: 'auto', behavior: 'smooth' }), 0);
          return next;
        });
      } else if (e.key === 'Enter') {
        // If they are in the search bar but haven't selected anything in the grid, we don't want to add the first item arbitrarily 
        // unless they actually focused an item.
        if (focusedItemIndex >= 0 && focusedItemIndex < filteredProducts.length) {
          const prod = filteredProducts[focusedItemIndex];
          if ((prod.stockQuantity > 0 || isUnrealInvoice) && addToCartRef.current) {
            e.preventDefault();
            addToCartRef.current(prod);
          }
        }
      } else if (e.key === 'F8' || (e.altKey && (e.key === 'h' || e.key === 'H'))) {
        e.preventDefault();
        if (cart.length > 0) {
          holdCurrentSaleRef.current?.();
        } else {
          restoreWindow('pos-parked-sales-modal');
          setIsParkedModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [leftPanelMode, filteredProducts, focusedItemIndex, isUnrealInvoice]);


  // Global key listener that detects rapid input sequences consistent with USB barcode scanners
  // to automatically switch to catalog, focus the search input, and trigger search in SaleView
  useEffect(() => {
    let rapidBuffer = '';
    let lastKeyTime = 0;
    let rapidCount = 0;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const handleRapidScannerKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (showPaymentConfirmModal || isStockCardOpen || lastCompletedSale) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

      if (isPrintable) {
        if (timeDiff <= 50) {
          rapidCount++;
          rapidBuffer += e.key;
        } else {
          rapidCount = 1;
          rapidBuffer = e.key;
        }

        // Hardware scanners output characters at <= 50ms intervals.
        // Once 2 consecutive rapid keys are detected, it's a USB barcode scanner.
        if (rapidCount >= 2) {
          // Switch to catalog if currently showing sales log
          if (leftPanelMode !== 'catalog') {
            setLeftPanelMode('catalog');
          }

          // Automatically focus the search input so subsequent keystrokes route directly to search
          if (document.activeElement !== searchInputRef.current) {
            searchInputRef.current?.focus();
            setSearchQuery((prev) => {
              if (!prev.includes(rapidBuffer)) {
                return rapidBuffer;
              }
              return prev;
            });
          }
        }

        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(() => {
          // If scanner does not emit Enter, process the scanned buffer through handleBarcodeScan
          if (rapidCount >= 3 && rapidBuffer.length >= 3) {
            const codeToScan = rapidBuffer;
            rapidCount = 0;
            rapidBuffer = '';
            handleBarcodeScan(codeToScan);
          } else {
            rapidCount = 0;
            rapidBuffer = '';
          }
        }, 80);
      } else if (e.key === 'Enter') {
        if (flushTimer) clearTimeout(flushTimer);
        if (rapidCount >= 2 && rapidBuffer.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          const scannedText = rapidBuffer;
          rapidCount = 0;
          rapidBuffer = '';
          handleBarcodeScan(scannedText);
        }
      }
    };

    window.addEventListener('keydown', handleRapidScannerKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleRapidScannerKeyDown, { capture: true });
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [leftPanelMode, showPaymentConfirmModal, isStockCardOpen, lastCompletedSale, handleBarcodeScan]);

  const updateBatch = (cartItemId: string, batchStr: string) => {
    setCart((prev) => {
      return prev.map((item) => {
         if (item.cartItemId === cartItemId) {
            if (batchStr === '') {
              return { ...item, selectedBatchNumber: undefined, selectedExpiryDate: undefined };
            }
            const [batchNumber, expiryDate] = batchStr.split('||');
            return { ...item, selectedBatchNumber: batchNumber, selectedExpiryDate: expiryDate };
         }
         return item;
      });
    });
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const nextQty = item.quantity + delta;
            
            // Check usage
            if (!isUnrealInvoice) {
              const otherUsage = prev
                 .filter(i => i.product.id === item.product.id && i.cartItemId !== cartItemId)
                 .reduce((sum, i) => sum + (i.isPiece && i.product.piecesPerBox ? i.quantity / i.product.piecesPerBox : i.quantity), 0);
              
              const thisUsage = item.isPiece && item.product.piecesPerBox ? nextQty / item.product.piecesPerBox : nextQty;

              if (otherUsage + thisUsage > item.product.stockQuantity) {
                setErrorMessage(`Stock maximum reached (${formatStockDisplay(item.product.stockQuantity, item.product.isDivisible, item.product.piecesPerBox, item.product.pieceName)})`);
                setTimeout(() => setErrorMessage(null), 2500);
                return item;
              }
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const setAbsoluteQuantity = (cartItemId: string, qty: number) => {
    if (isNaN(qty) || qty < 0) return;
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            // Check usage
            if (!isUnrealInvoice) {
              const otherUsage = prev
                 .filter(i => i.product.id === item.product.id && i.cartItemId !== cartItemId)
                 .reduce((sum, i) => sum + (i.isPiece && i.product.piecesPerBox ? i.quantity / i.product.piecesPerBox : i.quantity), 0);
              
              const thisUsage = item.isPiece && item.product.piecesPerBox ? qty / item.product.piecesPerBox : qty;
              
              if (otherUsage + thisUsage > item.product.stockQuantity) {
                setErrorMessage(`Stock maximum reached (${formatStockDisplay(item.product.stockQuantity, item.product.isDivisible, item.product.piecesPerBox, item.product.pieceName)})`);
                setTimeout(() => setErrorMessage(null), 2500);
                return item;
              }
            }
            return { ...item, quantity: qty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setEditingQuantities((prev) => {
      const next = { ...prev };
      delete next[cartItemId];
      return next;
    });
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const updateDiscount = (cartItemId: string, discount: number) => {
    if (isNaN(discount)) discount = 0;
    const clamped = Math.max(-1000, Math.min(100, Math.round(discount)));
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId ? { ...item, discountPercent: clamped } : item
      )
    );
  };


  const updateUnitPrice = (cartItemId: string, newPriceUSD: number) => {
    if (isNaN(newPriceUSD) || newPriceUSD < 0) return;
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId
          ? {
              ...item,
              unitPriceUSD: newPriceUSD,
              unitPriceLBP: Math.round(newPriceUSD * exchangeRate),
            }
          : item
      )
    );
  };

  const updateUnitPriceLBP = (cartItemId: string, newPriceLBP: number) => {
    if (isNaN(newPriceLBP) || newPriceLBP < 0) return;
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId
          ? {
              ...item,
              unitPriceLBP: Math.round(newPriceLBP),
              unitPriceUSD: exchangeRate > 0 ? Number((newPriceLBP / exchangeRate).toFixed(2)) : item.unitPriceUSD,
            }
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setEditingQuantities({});
    setEditingUnitPriceLBP({});
    setTenderedUSD('');
    setTenderedLBP('');
    setChangeCurrency('auto');
    setCustomChangeUSD('');
    setCustomChangeLBP('');
    setIsCustomChange(false);
    setWriteOffDifferences(false);
    setErrorMessage(null);
  };

  // Calculations
  const subtotalUSD = useMemo(() => {
    return Number(
      cart
        .reduce((sum, item) => sum + item.unitPriceUSD * item.quantity * (1 - item.discountPercent / 100), 0)
        .toFixed(2)
    );
  }, [cart]);

  const totalTaxUSD = useMemo(() => {
    return Number(
      cart
        .reduce((sum, item) => {
          const rate = settings.vatRates?.[item.product.category] || 0;
          const preTaxTotal = item.unitPriceUSD * item.quantity * (1 - (item.discountPercent || 0) / 100);
          // Tax is levied on the selling price, never on the purchase cost.
          return sum + (preTaxTotal * (rate / 100));
        }, 0)
        .toFixed(2)
    );
  }, [cart, settings.vatRates]);

  const totalTaxLBP = useMemo(() => {
    return Math.round(totalTaxUSD * exchangeRate);
  }, [totalTaxUSD, exchangeRate]);

  const totalUSD = useMemo(() => {
    return Number((subtotalUSD + totalTaxUSD).toFixed(2));
  }, [subtotalUSD, totalTaxUSD]);

  const totalDiscountUSD = useMemo(() => {
    return Number(
      cart
        .reduce((sum, item) => sum + item.unitPriceUSD * item.quantity * (item.discountPercent / 100), 0)
        .toFixed(2)
    );
  }, [cart]);

  const totalDiscountLBP = useMemo(() => {
    return Math.round(totalDiscountUSD * exchangeRate);
  }, [totalDiscountUSD, exchangeRate]);

  const totalLBP = useMemo(() => {
    return Math.round(totalUSD * exchangeRate);
  }, [totalUSD, exchangeRate]);

  const totalCostUSD = useMemo(() => {
    return Number(
      cart
        .reduce((sum, item) => {
          const divisor = item.isPiece && item.product.piecesPerBox ? item.product.piecesPerBox : 1;
          const costPerUnit = (item.product.costPriceUSD || 0) / divisor;
          return sum + (costPerUnit * item.quantity);
        }, 0)
        .toFixed(2)
    );
  }, [cart]);

  const marginPercent = useMemo(() => {
    if (totalUSD <= 0) return 0;
    return ((totalUSD - totalCostUSD) / totalUSD) * 100;
  }, [totalUSD, totalCostUSD]);

  // Robust Number Parsing for Lebanese Dual-Currency POS
  const parseLBP = (val: string): number => {
    if (!val) return 0;
    // Normalize Arabic-Indic digits if entered
    const arabicIndic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let norm = val;
    arabicIndic.forEach((d, i) => {
      norm = norm.replaceAll(d, i.toString());
    });
    // Remove all non-numeric characters (commas, dots, spaces, LBP, etc.)
    const clean = norm.replace(/[^0-9]/g, '');
    return parseInt(clean, 10) || 0;
  };

  const parseUSD = (val: string): number => {
    if (!val) return 0;
    const arabicIndic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let norm = val;
    arabicIndic.forEach((d, i) => {
      norm = norm.replaceAll(d, i.toString());
    });
    let clean = norm.replace(/[^0-9.,]/g, '');
    if (clean.includes(',') && clean.includes('.')) {
      if (clean.lastIndexOf('.') > clean.lastIndexOf(',')) {
        clean = clean.replace(/,/g, '');
      } else {
        clean = clean.replace(/\./g, '').replace(',', '.');
      }
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    return parseFloat(clean) || 0;
  };

  // Payment Calculation
  const paidUSD = parseUSD(tenderedUSD);
  const paidLBP = parseLBP(tenderedLBP);
  const hasEnteredPayment = tenderedUSD.trim() !== '' || tenderedLBP.trim() !== '';

  // Total paid converted to USD and LBP
  const totalPaidInUSD = Number((paidUSD + (exchangeRate > 0 ? paidLBP / exchangeRate : 0)).toFixed(4));
  const totalPaidInLBP = Math.round(paidUSD * exchangeRate) + paidLBP;

  // Exact difference between received and total due
  let isExactPayment = false;
  let isOverpaid = false;
  let isUnderpaid = false;
  let changeUSD = 0;
  let changeLBP = 0;
  let remainingUSD = 0;
  let remainingLBP = 0;

  if (hasEnteredPayment) {
    if (paidUSD > 0 && paidLBP === 0) {
      // Pure USD Payment
      const diffUSD = paidUSD - totalUSD;
      if (Math.abs(diffUSD) < 0.005) {
        isExactPayment = true;
      } else if (diffUSD >= 0.005) {
        isOverpaid = true;
        changeUSD = Number(diffUSD.toFixed(2));
        changeLBP = Math.round(changeUSD * exchangeRate);
      } else {
        isUnderpaid = true;
        remainingUSD = Number(Math.abs(diffUSD).toFixed(2));
        remainingLBP = Math.round(remainingUSD * exchangeRate);
      }
    } else {
      // Pure LBP or Mixed Payment (LBP is involved)
      const diffLBP = totalPaidInLBP - totalLBP;

      if (diffLBP === 0) {
        isExactPayment = true;
      } else if (diffLBP > 0) {
        isOverpaid = true;
        changeLBP = diffLBP;
        changeUSD = Number((diffLBP / (exchangeRate || 89500)).toFixed(2));
      } else {
        isUnderpaid = true;
        remainingLBP = Math.abs(diffLBP);
        remainingUSD = Number((remainingLBP / (exchangeRate || 89500)).toFixed(2));
      }
    }
  }

  const effectiveChangeCurrency: 'USD' | 'LBP' =
    changeCurrency === 'USD' || changeCurrency === 'LBP'
      ? changeCurrency
      : (paidUSD > 0 && paidLBP === 0 && changeUSD >= 0.01)
      ? 'USD'
      : 'LBP';

  let actualChangeUSD = 0;
  let actualChangeLBP = 0;

  if (isOverpaid) {
    if (isCustomChange) {
      actualChangeUSD = customChangeUSD.trim() !== '' ? parseUSD(customChangeUSD) : 0;
      actualChangeLBP = customChangeLBP.trim() !== '' ? parseLBP(customChangeLBP) : 0;
    } else if (changeCurrency === 'keep_extra') {
      actualChangeUSD = 0;
      actualChangeLBP = 0;
    } else {
      actualChangeUSD = effectiveChangeCurrency === 'USD' ? changeUSD : 0;
      actualChangeLBP = effectiveChangeCurrency === 'LBP' ? changeLBP : 0;
    }
  }

  // Maximum change customer is entitled to
  const maxChangeUSD = changeUSD;
  const maxChangeLBP = changeLBP;

  // Total change returned to customer in USD equivalent
  const totalChangeReturnedUSD = Number((actualChangeUSD + (exchangeRate > 0 ? actualChangeLBP / exchangeRate : 0)).toFixed(2));
  const totalChangeReturnedLBP = Math.round(actualChangeUSD * (exchangeRate || 89500)) + actualChangeLBP;

  // Has cashier entered more change than overpayment?
  const isChangeExceeding = isOverpaid && (totalChangeReturnedUSD > maxChangeUSD + 0.009);

  // Extra money retained by the pharmacy and added to the cash drawer
  const retainedUSD = isOverpaid && !isChangeExceeding
    ? Math.max(0, Number((maxChangeUSD - totalChangeReturnedUSD).toFixed(2)))
    : 0;
  const retainedLBP = isOverpaid && !isChangeExceeding
    ? Math.max(0, Math.round(maxChangeLBP - totalChangeReturnedLBP))
    : 0;

  // Hold / Park sale operations
  const holdCurrentSale = useCallback((optionalNote?: string) => {
    if (cart.length === 0) {
      addNotification('alert', 'Cart is empty. Add items before holding a sale.');
      return;
    }
    const custName = isUnrealInvoice
      ? 'Unreal Invoice'
      : selectedCust
      ? selectedCust.name
      : 'Cash Client';

    const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const newParked: ParkedSale = {
      id: `parked_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      label: optionalNote || `${custName} (${totalItemsCount} ${totalItemsCount === 1 ? 'item' : 'items'})`,
      customerId: selectedCustomerId,
      customerName: custName,
      isUnreal: isUnrealInvoice,
      items: [...cart],
      tenderedUSD,
      tenderedLBP,
      paymentMethod,
      totalUSD,
      totalLBP,
      totalItems: totalItemsCount,
      notes: optionalNote || '',
    };

    setParkedSales(prev => [newParked, ...prev]);

    clearCart();
    setSelectedCustomerId('');
    addNotification('success', `Sale held: "${newParked.label}". Ready for next customer.`);
  }, [cart, isUnrealInvoice, selectedCust, selectedCustomerId, tenderedUSD, tenderedLBP, paymentMethod, totalUSD, totalLBP, addNotification]);

  useEffect(() => {
    holdCurrentSaleRef.current = holdCurrentSale;
  }, [holdCurrentSale]);

  const resumeParkedSale = useCallback((parked: ParkedSale, swapCurrentCart: boolean) => {
    if (swapCurrentCart && cart.length > 0) {
      const custName = isUnrealInvoice
        ? 'Unreal Invoice'
        : selectedCust
        ? selectedCust.name
        : 'Cash Client';
      const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

      const autoHeld: ParkedSale = {
        id: `parked_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        label: `${custName} (${totalItemsCount} ${totalItemsCount === 1 ? 'item' : 'items'})`,
        customerId: selectedCustomerId,
        customerName: custName,
        isUnreal: isUnrealInvoice,
        items: [...cart],
        tenderedUSD,
        tenderedLBP,
        paymentMethod,
        totalUSD,
        totalLBP,
        totalItems: totalItemsCount,
      };

      setParkedSales(prev => [autoHeld, ...prev.filter(p => p.id !== parked.id)]);
    } else {
      setParkedSales(prev => prev.filter(p => p.id !== parked.id));
    }

    setCart(parked.items || []);
    setEditingQuantities({});
    setSelectedCustomerId(parked.customerId || '');
    setTenderedUSD(parked.tenderedUSD || '');
    setTenderedLBP(parked.tenderedLBP || '');
    setPaymentMethod(parked.paymentMethod || 'cash_lbp');
    setChangeCurrency('auto');
    setCustomChangeUSD('');
    setCustomChangeLBP('');
    setIsCustomChange(false);
    setWriteOffDifferences(false);
    setErrorMessage(null);

    addNotification('info', `Resumed sale: "${parked.label || parked.customerName}".`);
  }, [cart, isUnrealInvoice, selectedCust, selectedCustomerId, tenderedUSD, tenderedLBP, paymentMethod, totalUSD, totalLBP, addNotification]);

  const deleteParkedSale = useCallback((parkedId: string) => {
    setParkedSales(prev => prev.filter(p => p.id !== parkedId));
    addNotification('info', 'Parked sale discarded.');
  }, [addNotification]);

  const updateParkedNote = useCallback((parkedId: string, note: string) => {
    setParkedSales(prev => prev.map(p => p.id === parkedId ? { ...p, notes: note } : p));
  }, []);

  // Complete checkout

  const resolveCartItemBatches = (item: CartItem): { batchNumber?: string; expiryDate?: string; quantity: number }[] => {
    const prod = item.product;
    if (!prod.batches || prod.batches.length === 0) {
      if (item.selectedBatchNumber || item.selectedExpiryDate) {
        return [{
          batchNumber: item.selectedBatchNumber || prod.batchNumber,
          expiryDate: item.selectedExpiryDate || prod.expiryDate,
          quantity: item.quantity,
        }];
      }
      return [];
    }

    const qtyDeduct = item.isPiece && prod.piecesPerBox ? item.quantity / prod.piecesPerBox : item.quantity;
    let remaining = qtyDeduct;
    const result: { batchNumber?: string; expiryDate?: string; quantity: number }[] = [];

    // 1. If explicit batch selected, match it first
    if (item.selectedBatchNumber && item.selectedExpiryDate) {
      const matching = prod.batches.find(
        b => b.batchNumber === item.selectedBatchNumber && b.expiryDate === item.selectedExpiryDate
      );
      if (matching && (matching.quantity || 0) > 0) {
        const take = Math.min(matching.quantity || 0, remaining);
        result.push({
          batchNumber: matching.batchNumber,
          expiryDate: matching.expiryDate,
          quantity: item.isPiece && prod.piecesPerBox ? Math.round(take * prod.piecesPerBox) : take,
        });
        remaining -= take;
      }
    }

    // 2. FIFO across remaining available batches
    if (remaining > 0) {
      const sorted = [...prod.batches]
        .filter(b => (b.quantity || 0) > 0)
        .sort((a, b) => {
          const tA = parseExpiryDate(a.expiryDate).timestamp;
          const tB = parseExpiryDate(b.expiryDate).timestamp;
          if (tA === 0 && tB === 0) return 0;
          if (tA === 0) return 1;
          if (tB === 0) return -1;
          return tA - tB;
        });

      for (const b of sorted) {
        if (remaining <= 0) break;
        const alreadyTaken = result.find(r => r.batchNumber === b.batchNumber && r.expiryDate === b.expiryDate);
        const alreadyTakenBox = alreadyTaken ? (item.isPiece && prod.piecesPerBox ? alreadyTaken.quantity / prod.piecesPerBox : alreadyTaken.quantity) : 0;
        const available = Math.max(0, (b.quantity || 0) - alreadyTakenBox);
        if (available > 0) {
          const take = Math.min(available, remaining);
          if (alreadyTaken) {
            alreadyTaken.quantity += item.isPiece && prod.piecesPerBox ? Math.round(take * prod.piecesPerBox) : take;
          } else {
            result.push({
              batchNumber: b.batchNumber,
              expiryDate: b.expiryDate,
              quantity: item.isPiece && prod.piecesPerBox ? Math.round(take * prod.piecesPerBox) : take,
            });
          }
          remaining -= take;
        }
      }
    }

    // 3. Fallback for remaining (e.g. overselling or single batch)
    if (remaining > 0) {
      const fallbackBatch = item.selectedBatchNumber || prod.batchNumber || '';
      const fallbackExp = item.selectedExpiryDate || prod.expiryDate || '';
      const existing = result.find(r => r.batchNumber === fallbackBatch && r.expiryDate === fallbackExp);
      const remQty = item.isPiece && prod.piecesPerBox ? Math.round(remaining * prod.piecesPerBox) : remaining;
      if (existing) {
        existing.quantity += remQty;
      } else {
        result.push({
          batchNumber: fallbackBatch,
          expiryDate: fallbackExp,
          quantity: remQty,
        });
      }
    }

    return result;
  };

  const handlePrintClick = () => {
    if (cart.length === 0) return;
    
    if (isUnrealInvoice) {
      handleCheckout(true);
      return;
    }

    const isInvalid = (!selectedCustomerId && !hasEnteredPayment) || (hasEnteredPayment && isUnderpaid && !writeOffDifferences) || (isOverpaid && isChangeExceeding);
    
    if (isInvalid) {
      // Print Draft
      const currentCustomer = customers.find((c) => c.id === selectedCustomerId);
      let finalPaidUSD = paidUSD;
      let finalPaidLBP = paidLBP;
      let finalMethod: 'cash_lbp' | 'cash_usd' | 'mixed' = 'cash_lbp';

      if (!hasEnteredPayment) {
        finalPaidUSD = 0;
        finalPaidLBP = totalLBP;
        finalMethod = 'cash_lbp';
      } else {
        if (finalPaidUSD > 0 && finalPaidLBP > 0) {
          finalMethod = 'mixed';
        } else if (finalPaidUSD > 0 && finalPaidLBP === 0) {
          finalMethod = 'cash_usd';
        } else if (finalPaidLBP > 0 && finalPaidUSD === 0) {
          finalMethod = 'cash_lbp';
        }
      }

      const draftSale: SaleTransaction = {
        id: 'DRAFT-' + Date.now(),
        invoiceNumber: 'DRAFT',
        date: new Date().toISOString(),
        timestamp: Date.now(),
        items: cart.map((item) => {
          const rate = settings.vatRates?.[item.product.category] || 0;
          const preTaxUSD = item.unitPriceUSD * item.quantity * (1 - item.discountPercent / 100);
          const taxUSD = preTaxUSD * (rate / 100);
          const finalItemTotalUSD = Number((preTaxUSD + taxUSD).toFixed(2));
          return {
            productId: item.product.id,
            productCode: item.product.code,
            productName: item.product.name,
            category: item.product.category,
            quantity: item.quantity,
            discountPercent: item.discountPercent,
            unitPriceUSD: item.unitPriceUSD,
            unitPriceLBP: item.unitPriceLBP,
            costPriceUSD: item.product.costPriceUSD,
            totalUSD: finalItemTotalUSD,
            totalLBP: Math.round(finalItemTotalUSD * exchangeRate),
            isPiece: item.isPiece,
            selectedBatchNumber: item.selectedBatchNumber,
            selectedExpiryDate: item.selectedExpiryDate,
            batches: resolveCartItemBatches(item),
          };
        }),
        totalUSD,
        totalLBP,
        exchangeRate,
        customerId: currentCustomer?.id,
        customerName: currentCustomer?.name || 'Cash Client',
        cashierId: currentUser?.id || 'admin',
        cashierName: currentUser?.name || 'Administrator',
        paymentMethod: finalMethod,
        amountPaidUSD: finalPaidUSD,
        amountPaidLBP: finalPaidLBP,
        changeGivenUSD: actualChangeUSD,
        changeGivenLBP: actualChangeLBP,
        writeOffUSD: 0,
        writeOffLBP: 0,
        retainedUSD,
        retainedLBP,
        notes: (retainedUSD >= 0.01 || retainedLBP > 0)
          ? `Retained extra in drawer: ${retainedUSD >= 0.01 ? `${retainedUSD.toFixed(2)} ` : ''}(+${formatLBPValue(retainedLBP)} LBP)`
          : undefined,
        synced: false,
      };
      
      printAfterSaleRef.current = false; // It's a draft, don't clear cart later
      setLastCompletedSale(draftSale);
    } else {
      handleCheckout(true);
    }
  };

  const handleCheckout = (shouldPrint: boolean) => {
    printAfterSaleRef.current = shouldPrint;
    if (cart.length === 0) {
      setErrorMessage('Cart is empty. Add at least one item to proceed.');
      return;
    }

    if (!selectedCustomerId && !isUnrealInvoice && !hasEnteredPayment) {
      setErrorMessage('Please enter the received cash amount (USD or LBP) for Cash Client.');
      return;
    }

    if (hasEnteredPayment && isUnderpaid && !writeOffDifferences) {
      const shortageDisplay = remainingUSD >= 0.01
        ? `${remainingUSD.toFixed(2)} (${formatLBPValue(remainingLBP)} LBP)`
        : `${formatLBPValue(remainingLBP)} LBP`;
      setErrorMessage(
        `Received payment is short by ${shortageDisplay}. Check "Write off differences" to forgive the shortage and accept this transaction.`
      );
      return;
    }

    if (isOverpaid && isChangeExceeding) {
      setErrorMessage(
        `Change to return (${totalChangeReturnedUSD.toFixed(2)}) cannot exceed customer overpayment (${maxChangeUSD.toFixed(2)}).`
      );
      return;
    }

    if (!isUnrealInvoice) {
      const exceedingItem = cart.find((item) => {
        const usage = cart
          .filter((i) => i.product.id === item.product.id)
          .reduce((sum, i) => sum + (i.isPiece && i.product.piecesPerBox ? i.quantity / i.product.piecesPerBox : i.quantity), 0);
        return usage > item.product.stockQuantity;
      });
      if (exceedingItem) {
        setErrorMessage(`"${exceedingItem.product.name}" exceeds available stock. Switch to "Unreal Invoice" to proceed without stock deduction.`);
        return;
      }
    }

    // If "Cash Client" or "Unreal Invoice" is chosen, it is always a payment paid with cash directly (not a debt)
    if (!selectedCustomerId || isUnrealInvoice) {
      executeCompleteSale('cash');
      return;
    }

    // If any other customer is chosen, prompt confirmation message to choose cash or debt
    setShowPaymentConfirmModal(true);
  };

  const executeCompleteSale = (chosenType: 'cash' | 'debt') => {
    if (cart.length === 0) return;

    if (isUnrealInvoice) {
      if (hasEnteredPayment && isUnderpaid && !writeOffDifferences) {
        const shortageDisplay = remainingUSD >= 0.01
          ? `$${remainingUSD.toFixed(2)} (${formatLBPValue(remainingLBP)} LBP)`
          : `${formatLBPValue(remainingLBP)} LBP`;
        setErrorMessage(
          `Tendered cash is less than total due. Remaining: ${shortageDisplay}. Please check "Write off differences" to accept.`
        );
        setShowPaymentConfirmModal(false);
        return;
      }

      let finalPaidUSD = paidUSD;
      let finalPaidLBP = paidLBP;
      let finalMethod: 'cash_lbp' | 'cash_usd' | 'mixed' = 'cash_lbp';

      if (!hasEnteredPayment) {
        finalPaidUSD = 0;
        finalPaidLBP = totalLBP;
        finalMethod = 'cash_lbp';
      } else {
        if (finalPaidUSD > 0 && finalPaidLBP > 0) {
          finalMethod = 'mixed';
        } else if (finalPaidUSD > 0 && finalPaidLBP === 0) {
          finalMethod = 'cash_usd';
        } else if (finalPaidLBP > 0 && finalPaidUSD === 0) {
          finalMethod = 'cash_lbp';
        }
      }

      const unrealSaleRecord = recordSale({
        date: new Date().toISOString(),
        items: cart.map((item) => {
          const rate = settings.vatRates?.[item.product.category] || 0;
          const preTaxUSD = item.unitPriceUSD * item.quantity * (1 - item.discountPercent / 100);
          const taxUSD = preTaxUSD * (rate / 100);
          const finalItemTotalUSD = Number((preTaxUSD + taxUSD).toFixed(2));
          return {
            productId: item.product.id,
            productCode: item.product.code,
            productName: item.product.name,
            category: item.product.category,
            quantity: item.quantity,
            discountPercent: item.discountPercent,
            unitPriceUSD: item.unitPriceUSD,
            unitPriceLBP: item.unitPriceLBP,
            costPriceUSD: item.product.costPriceUSD,
            totalUSD: finalItemTotalUSD,
            totalLBP: Math.round(finalItemTotalUSD * exchangeRate),
            isPiece: item.isPiece,
            selectedBatchNumber: item.selectedBatchNumber,
            selectedExpiryDate: item.selectedExpiryDate,
            batches: resolveCartItemBatches(item),
          };
        }),
        totalUSD,
        totalLBP,
        exchangeRate,
        customerId: undefined,
        customerName: 'Unreal Invoice',
        cashierId: currentUser?.id || 'admin',
        cashierName: currentUser?.name || 'Administrator',
        paymentMethod: finalMethod,
        amountPaidUSD: finalPaidUSD,
        amountPaidLBP: finalPaidLBP,
        changeGivenUSD: actualChangeUSD,
        changeGivenLBP: actualChangeLBP,
        writeOffUSD: 0,
        writeOffLBP: 0,
        retainedUSD,
        retainedLBP,
        notes: (retainedUSD >= 0.01 || retainedLBP > 0)
          ? `Retained extra in drawer: ${retainedUSD >= 0.01 ? `$${retainedUSD.toFixed(2)} ` : ''}(+${formatLBPValue(retainedLBP)} LBP)`
          : undefined,
        isUnreal: true,
      });

      if (printAfterSaleRef.current) {
        setLastCompletedSale(unrealSaleRecord);
      }
      clearCart();
      setTenderedUSD('');
      setTenderedLBP('');
      setShowPaymentConfirmModal(false);
      return;
    }

    const currentCustomer = customers.find((c) => c.id === selectedCustomerId);

    if (chosenType === 'cash') {
      if (hasEnteredPayment && isUnderpaid && !writeOffDifferences) {
        const shortageDisplay = remainingUSD >= 0.01
          ? `$${remainingUSD.toFixed(2)} (${formatLBPValue(remainingLBP)} LBP)`
          : `${formatLBPValue(remainingLBP)} LBP`;
        setErrorMessage(
          `Tendered cash is less than total due. Remaining: ${shortageDisplay}. Please check "Write off differences" to accept.`
        );
        setShowPaymentConfirmModal(false);
        return;
      }

      let finalPaidUSD = paidUSD;
      let finalPaidLBP = paidLBP;
      let finalMethod: 'cash_lbp' | 'cash_usd' | 'mixed' = 'cash_lbp';

      if (!hasEnteredPayment) {
        finalPaidUSD = 0;
        finalPaidLBP = totalLBP;
        finalMethod = 'cash_lbp';
      } else {
        if (finalPaidUSD > 0 && finalPaidLBP > 0) {
          finalMethod = 'mixed';
        } else if (finalPaidUSD > 0 && finalPaidLBP === 0) {
          finalMethod = 'cash_usd';
        } else if (finalPaidLBP > 0 && finalPaidUSD === 0) {
          finalMethod = 'cash_lbp';
        }
      }

      const writeOffUSDAmount = hasEnteredPayment && isUnderpaid && writeOffDifferences ? remainingUSD : 0;
      const writeOffLBPAmount = hasEnteredPayment && isUnderpaid && writeOffDifferences ? remainingLBP : 0;

      const saleRecord = recordSale({
        date: new Date().toISOString(),
        items: cart.map((item) => {
          const rate = settings.vatRates?.[item.product.category] || 0;
          
          const preTaxUSD = item.unitPriceUSD * item.quantity * (1 - item.discountPercent / 100);
          // Tax is levied on the selling price, never on the purchase cost.
          const taxUSD = preTaxUSD * (rate / 100);
          const finalItemTotalUSD = Number((preTaxUSD + taxUSD).toFixed(2));
          
          return {
            productId: item.product.id,
            productCode: item.product.code,
            productName: item.product.name,
            category: item.product.category,
            quantity: item.quantity,
            discountPercent: item.discountPercent,
            unitPriceUSD: item.unitPriceUSD,
            unitPriceLBP: item.unitPriceLBP,
            costPriceUSD: item.product.costPriceUSD,
            totalUSD: finalItemTotalUSD,
            totalLBP: Math.round(finalItemTotalUSD * exchangeRate),
            isPiece: item.isPiece,
            selectedBatchNumber: item.selectedBatchNumber,
            selectedExpiryDate: item.selectedExpiryDate,
            batches: resolveCartItemBatches(item),
          };
        }),
        totalUSD,
        totalLBP,
        exchangeRate,
        customerId: currentCustomer?.id,
        customerName: currentCustomer?.name || 'Cash Client',
        cashierId: currentUser?.id || 'admin',
        cashierName: currentUser?.name || 'Administrator',
        paymentMethod: finalMethod,
        amountPaidUSD: finalPaidUSD,
        amountPaidLBP: finalPaidLBP,
        changeGivenUSD: actualChangeUSD,
        changeGivenLBP: actualChangeLBP,
        writeOffUSD: writeOffUSDAmount,
        writeOffLBP: writeOffLBPAmount,
        retainedUSD,
        retainedLBP,
        notes: (writeOffUSDAmount > 0 || writeOffLBPAmount > 0)
          ? `Difference written off: ${writeOffUSDAmount >= 0.01 ? `$${writeOffUSDAmount.toFixed(2)} ` : ''}(${formatLBPValue(writeOffLBPAmount)} LBP)`
          : (retainedUSD >= 0.01 || retainedLBP > 0)
          ? `Retained extra in drawer: ${retainedUSD >= 0.01 ? `$${retainedUSD.toFixed(2)} ` : ''}(+${formatLBPValue(retainedLBP)} LBP)`
          : undefined,
      });

      if (printAfterSaleRef.current) { setLastCompletedSale(saleRecord); }
      clearCart();
      setTenderedUSD('');
      setTenderedLBP('');
      setSelectedCustomerId('');
      setWriteOffDifferences(false);
      setShowPaymentConfirmModal(false);
      setLeftPanelMode('log');
    } else {
      // Registered as Debt for this customer
      const saleRecord = recordSale({
        date: new Date().toISOString(),
        items: cart.map((item) => {
          const rate = settings.vatRates?.[item.product.category] || 0;
          
          const preTaxUSD = item.unitPriceUSD * item.quantity * (1 - item.discountPercent / 100);
          // Tax is levied on the selling price, never on the purchase cost.
          const taxUSD = preTaxUSD * (rate / 100);
          const finalItemTotalUSD = Number((preTaxUSD + taxUSD).toFixed(2));
          
          return {
            productId: item.product.id,
            productCode: item.product.code,
            productName: item.product.name,
            category: item.product.category,
            quantity: item.quantity,
            discountPercent: item.discountPercent,
            unitPriceUSD: item.unitPriceUSD,
            unitPriceLBP: item.unitPriceLBP,
            costPriceUSD: item.product.costPriceUSD,
            totalUSD: finalItemTotalUSD,
            totalLBP: Math.round(finalItemTotalUSD * exchangeRate),
            isPiece: item.isPiece,
            selectedBatchNumber: item.selectedBatchNumber,
            selectedExpiryDate: item.selectedExpiryDate,
            batches: resolveCartItemBatches(item),
          };
        }),
        totalUSD,
        totalLBP,
        exchangeRate,
        customerId: currentCustomer?.id,
        customerName: currentCustomer?.name || 'Customer',
        cashierId: currentUser?.id || 'admin',
        cashierName: currentUser?.name || 'Administrator',
        paymentMethod: 'credit_debt',
        amountPaidUSD: 0,
        amountPaidLBP: 0,
        changeGivenUSD: 0,
        changeGivenLBP: 0,
        writeOffUSD: 0,
        writeOffLBP: 0,
        notes: 'Charged to customer debt account',
      });

      if (printAfterSaleRef.current) { setLastCompletedSale(saleRecord); }
      clearCart();
      setTenderedUSD('');
      setTenderedLBP('');
      setSelectedCustomerId('');
      setWriteOffDifferences(false);
      setShowPaymentConfirmModal(false);
      setLeftPanelMode('log');
    }
  };

  return (
    <div className={`flex h-full flex-col overflow-hidden bg-[#f8fafc] dark:bg-slate-950 ${cartPosition === 'left' ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
      {/* LEFT PANEL: Sales Transactions Log & Product Directory */}
      <div className={`flex flex-1 flex-col ${cartPosition === 'right' ? 'border-r' : 'border-l'} border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden`}>
        {/* View Mode Switcher Header Toolbar */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/90 px-3 py-2 shrink-0 flex-wrap gap-2">
          <div className="flex items-center space-x-1.5 flex-wrap gap-1">
            <SectionRestoreButton section="sale" className="mr-1" />
            <button
              onClick={() => setLeftPanelMode('log')}
              className={`flex items-center space-x-1.5 rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                leftPanelMode === 'log'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Sales Transactions Log</span>
            </button>

            <button
              onClick={() => setLeftPanelMode('catalog')}
              className={`flex items-center space-x-1.5 rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                leftPanelMode === 'catalog'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Medications Catalog</span>
            </button>
          </div>

          {/* Quick Toggle: POS Mode vs Advanced Mode */}
          {leftPanelMode === 'catalog' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400 hidden sm:inline-block">
                View:
              </span>
              <div className="flex items-center rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 shadow-2xs text-xs">
                <button
                  type="button"
                  onClick={() => handleSetCatalogViewMode('pos')}
                  className={`flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    catalogViewMode === 'pos'
                      ? 'bg-teal-700 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                  title="POS Mode: Streamlined, high-speed retail checkout view"
                >
                  <Zap className="h-3 w-3 text-amber-300" />
                  <span>POS Mode</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetCatalogViewMode('advanced')}
                  className={`flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    catalogViewMode === 'advanced'
                      ? 'bg-teal-700 text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                  title="Advanced Mode: Full inventory details, batch/expiry, cost prices, margins & agents"
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  <span>Advanced Mode</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Selected Component: Sales Transactions Log with Viewing, Editing & Printing */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {leftPanelMode === 'log' ? (
            <SalesTransactionLog onSwitchToCatalog={() => setLeftPanelMode('catalog')} />
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Search & Category Filter Toolbar */}
              <div className="p-3 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/80 space-y-2 shrink-0">
                <div className="relative">
                  {/* Status-aware left icon */}
                  <div className="absolute left-3 top-2.5 flex items-center pointer-events-none transition-transform duration-200">
                    {scanFeedback.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 animate-bounce" />
                    ) : scanFeedback.type === 'out-of-stock' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 animate-pulse" />
                    ) : scanFeedback.type === 'not-found' ? (
                      <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 animate-pulse" />
                    ) : (
                      <Search className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </div>

                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        e.preventDefault();
                        e.stopPropagation();
                        const raw = searchQuery.trim();
                        const trimmed = raw.toLowerCase();
                        const exactPiece = products.find(
                          p => p.isDivisible && (p.pieceBarcode || '').toLowerCase() === trimmed
                        );
                        if (exactPiece) {
                          handleBarcodeScan(raw);
                          return;
                        }
                        const exactProduct = products.find(
                          p => (p.barcode || '').toLowerCase() === trimmed || (p.code || '').toLowerCase() === trimmed
                        );
                        if (exactProduct) {
                          handleBarcodeScan(raw);
                          return;
                        }
                        if (filteredProducts.length > 0) {
                          const topProduct = filteredProducts[0];
                          if (!isUnrealInvoice && topProduct.stockQuantity <= 0) {
                            triggerScanFeedback('out-of-stock', `"${topProduct.name}" is not found in stock (0 available).`, {
                              productName: topProduct.name,
                            });
                            setErrorMessage(`Cannot add "${topProduct.name}": Out of stock!`);
                            setTimeout(() => setErrorMessage(null), 3000);
                            return;
                          }
                          const added = addToCart(topProduct);
                          if (added) {
                            triggerScanFeedback('success', `Added "${topProduct.name}" to cart!`, {
                              productName: topProduct.name,
                            });
                            clearAndFocusSearchInput();
                          }
                        } else {
                          triggerScanFeedback('not-found', `No product found matching "${raw}".`);
                          setErrorMessage(`No product found matching "${raw}".`);
                          setTimeout(() => setErrorMessage(null), 3000);
                          if (searchInputRef.current) {
                            searchInputRef.current.select();
                          }
                        }
                      }
                    }}
                    onFocus={(e) => {
                      // Select existing text on focus so any new scan or keystroke cleanly overwrites rather than appends
                      e.target.select();
                    }}
                    placeholder="Search by multi-word name, Code, or scan Barcode..."
                    className={`w-full rounded pl-9 pr-8 py-1.5 text-xs transition-all duration-200 focus:outline-hidden ${
                      scanFeedback.type === 'success'
                        ? 'border-2 border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-400/50 shadow-xs shadow-emerald-500/20 scan-success-anim text-emerald-950 placeholder-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100'
                        : scanFeedback.type === 'out-of-stock'
                        ? 'border-2 border-amber-500 bg-amber-50/80 ring-2 ring-amber-400/50 shadow-xs shadow-amber-500/20 scan-error-anim text-amber-950 placeholder-amber-700 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100'
                        : scanFeedback.type === 'not-found'
                        ? 'border-2 border-red-500 bg-red-50/80 ring-2 ring-red-400/50 shadow-xs shadow-red-500/20 scan-error-anim text-red-950 placeholder-red-700 dark:border-red-500 dark:bg-red-950/40 dark:text-red-100'
                        : 'border border-gray-300 bg-white text-slate-800 placeholder-gray-400 focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                    }`}
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Filter Pills (Requirement 21) */}
                <div className="flex items-center gap-1 overflow-x-auto text-xs">
                  {(['all', 'drug', 'vitamins', 'cosmetics', 'para'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded px-2.5 py-1 font-bold uppercase text-[10px] transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-teal-700 text-white shadow-2xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {cat === 'all' ? 'All Items' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Grid / Cards */}
              <div ref={catalogContainerRef} className="flex-1 overflow-y-auto p-3">
                {filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-xs">
                    <ShoppingBag className="h-8 w-8 text-gray-300 mb-2 dark:text-slate-700" />
                    <span>No products match the search query.</span>
                  </div>
                ) : (
                  <div
                    style={{ height: productGridVirtualizer.getTotalSize(), position: 'relative' }}
                  >
                    {productGridVirtualizer.getVirtualItems().map((virtualRow) => {
                      const startIdx = virtualRow.index * numCols;
                      const rowItems = filteredProducts.slice(startIdx, startIdx + numCols);
                      return (
                        <div
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          ref={productGridVirtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                            display: 'grid',
                            gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
                            gap: catalogViewMode === 'pos' ? '0.5rem' : '0.625rem',
                          }}
                        >
                          {rowItems.map((prod, j) => {
                            const realIndex = startIdx + j;
                            const cartInfo = cartInfoById.get(prod.id);
                            return (
                              <ProductCard
                                key={prod.id}
                                prod={prod}
                                index={realIndex}
                                isFocused={focusedItemIndex === realIndex}
                                inCartBoxes={cartInfo?.boxes || 0}
                                inCartPieces={cartInfo?.pieces || 0}
                                onAdd={addToCart}
                                onAddPiece={(p) => addToCart(p, true)}
                                onViewScientific={onViewScientific}
                                onOpenStockCard={handleOpenStockCard}
                                isUnreal={isUnrealInvoice}
                                viewMode={catalogViewMode}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Active Sale Cart & Lebanese Dual-Currency Checkout */}
      <div
        style={isDesktop ? { width: `${cartWidth}px` } : undefined}
        className={`relative flex w-full shrink-0 flex-col ${
          cartPosition === 'right' ? 'border-l' : 'border-r'
        } border-gray-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 ${
          isDraggingCartResizer ? 'transition-none select-none' : 'transition-[width] duration-75'
        }`}
      >
        {/* Splitter / Resizer handle between Catalog and Sale Cart */}
        <div
          onMouseDown={handleResizerMouseDown}
          onDoubleClick={handleResizerDoubleClick}
          className={`absolute top-0 bottom-0 z-30 hidden lg:flex items-center justify-center cursor-col-resize select-none ${
            cartPosition === 'right' ? '-left-2.5 w-5 hover:-left-2.5' : '-right-2.5 w-5 hover:-right-2.5'
          } group`}
          title="Drag left or right to increase/decrease Sale Cart width (Double-click to reset)"
        >
          {/* Subtle grab bar with grip icon */}
          <div
            className={`rounded-full transition-all flex items-center justify-center shadow-xs ${
              isDraggingCartResizer
                ? 'bg-teal-600 dark:bg-teal-500 w-3 h-16 ring-2 ring-teal-400/50'
                : 'bg-gray-300 dark:bg-slate-600 w-2 h-10 group-hover:bg-teal-500 dark:group-hover:bg-teal-400 group-hover:w-3 group-hover:h-14'
            }`}
          >
            <GripVertical className="h-3 w-3 text-white dark:text-slate-900 shrink-0" />
          </div>
        </div>

        {/* Live Width Indicator while actively dragging */}
        {isDraggingCartResizer && (
          <div
            className={`absolute top-2 z-40 bg-teal-800 dark:bg-teal-700 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap ${
              cartPosition === 'right' ? 'left-3' : 'right-3'
            }`}
          >
            Cart: {cartWidth}px
          </div>
        )}
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-slate-800 bg-gray-50 dark:bg-slate-900">
          <div className="flex items-center space-x-1.5 min-w-0">
            <ShoppingBag className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <h2 className="font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-slate-200 truncate">
              Sale ({cart.reduce((sum, item) => sum + item.quantity, 0)})
            </h2>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {parkedSales.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  restoreWindow('pos-parked-sales-modal');
                  setIsParkedModalOpen(true);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700/60 text-[10px] font-bold hover:bg-amber-200 dark:hover:bg-amber-900/80 transition-colors cursor-pointer"
                title="View Held Transactions"
              >
                <PauseCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                <span>Held ({parkedSales.length})</span>
              </button>
            )}
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => holdCurrentSale()}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                title="Hold current sale to assist another customer (F8)"
              >
                <PauseCircle className="h-3.5 w-3.5" />
                <span>Hold</span>
              </button>
            )}
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400 cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => {
                const newPos = cartPosition === 'right' ? 'left' : 'right';
                setCartPosition(newPos);
                localStorage.setItem('pos_cart_position', newPos);
              }}
              title={`Move Cart to ${cartPosition === 'right' ? 'Left' : 'Right'}`}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-slate-700 transition-colors"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Held Sales Strip */}
        {parkedSales.length > 0 && (
          <div className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between text-xs gap-1.5">
            <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <PauseCircle className="h-3 w-3" />
                Held:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {parkedSales.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (cart.length > 0) {
                        restoreWindow('pos-parked-sales-modal');
                        setIsParkedModalOpen(true);
                      } else {
                        resumeParkedSale(p, false);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700/60 text-[10px] text-slate-800 dark:text-slate-200 font-medium hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-400 shadow-2xs shrink-0 cursor-pointer"
                    title={`Click to resume ${p.label || p.customerName} ($${p.totalUSD.toFixed(2)})`}
                  >
                    <span className="font-bold text-amber-800 dark:text-amber-300 truncate max-w-[80px]">
                      {p.label || p.customerName}
                    </span>
                    <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">
                      ${p.totalUSD.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                restoreWindow('pos-parked-sales-modal');
                setIsParkedModalOpen(true);
              }}
              className="text-[10px] font-bold text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100 hover:underline shrink-0 cursor-pointer"
            >
              All ({parkedSales.length})
            </button>
          </div>
        )}

        {/* Customer Selector */}
        <div className={`p-2.5 border-b transition-colors ${
          isUnrealInvoice
            ? 'border-amber-300 bg-amber-50/70 dark:border-amber-700/50 dark:bg-amber-950/30'
            : 'border-gray-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
        }`}>
          <div className="flex items-center space-x-2">
            <User className={`h-3.5 w-3.5 shrink-0 ${isUnrealInvoice ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className={`w-full rounded border px-2 py-1 text-xs transition-colors focus:outline-hidden ${
                isUnrealInvoice
                  ? 'border-amber-400 bg-white font-semibold text-amber-900 focus:border-amber-500 dark:border-amber-600 dark:bg-slate-900 dark:text-amber-200'
                  : 'border-gray-300 bg-white text-slate-800 focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
              }`}
            >
              <option value="">Cash Client</option>
              <option value={UNREAL_INVOICE_ID}>Unreal Invoice</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.balanceUSD > 0 ? `• Debt: $${c.balanceUSD}` : ''}
                </option>
              ))}
            </select>
          </div>
          {isUnrealInvoice && (
            <div className="mt-1.5 flex items-center justify-between rounded bg-amber-100/70 px-2 py-1 text-[10px] text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              <span className="font-semibold">Fictitious invoice mode</span>
              <span className="opacity-80">No stock deduction • Excluded from reports</span>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-3 mt-2 flex items-center rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-xs">
              <Receipt className="h-8 w-8 text-gray-300 mb-2 dark:text-slate-700" />
              <span>Cart is empty. Select medications or search items.</span>
            </div>
          ) : (
            cart.map((item) => {
              const isDrug = (item.product.category || '').toLowerCase() === 'drug';
              const unitPriceLBP = item.unitPriceLBP ?? Math.round((item.unitPriceUSD || 0) * exchangeRate);
              const unitPriceUSD = item.unitPriceUSD ?? (exchangeRate > 0 ? Number((unitPriceLBP / exchangeRate).toFixed(2)) : 0);
              const lineTotalLBP = Math.round(unitPriceLBP * item.quantity * (1 - item.discountPercent / 100));
              const lineTotalUSD = (unitPriceUSD * item.quantity * (1 - item.discountPercent / 100)).toFixed(2);
              const originalLBP = Math.round(unitPriceLBP * item.quantity);
              const originalUSD = (unitPriceUSD * item.quantity).toFixed(2);

              const prodMoleculesCount =
                (item.product.molecules && item.product.molecules.length > 0)
                  ? item.product.molecules.length
                  : (item.product.ingredients ? extractCleanMolecules(item.product.ingredients).length : 0);
              const hasMultipleMolecules = prodMoleculesCount > 1;

              const itemDosage = item.product.dosage?.trim();
              const itemPresentation = item.product.presentation?.trim();
              const itemForm = item.product.form?.trim();

              return (
                <div
                  key={item.cartItemId || `${item.product.id}-${item.isPiece ? 'piece' : 'box'}-${Math.random()}`}
                  className="flex flex-col md:flex-row md:items-center justify-between rounded border border-gray-200 bg-slate-50/50 p-1 text-xs dark:border-slate-800 dark:bg-slate-800/40 gap-1"
                >
                  <div className="flex-1 pr-1 min-w-0">
                    <div className="flex items-center gap-1 overflow-hidden flex-wrap">
                      <span className="font-bold text-[10px] text-slate-900 dark:text-slate-100 truncate shrink-0 max-w-[140px] 2xl:max-w-[180px]" title={item.product.name}>
                        {item.product.name}
                        {item.isPiece && (
                          <span className="ml-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                            ({item.product.pieceName || 'Pc'})
                          </span>
                        )}
                      </span>

                      {/* Dosage (if single molecule/ingredient, not multi-molecule) */}
                      {!hasMultipleMolecules && itemDosage && (
                        <span className="text-[9px] font-semibold text-teal-700 dark:text-teal-400 shrink-0" title={`Dosage: ${itemDosage}`}>
                          {itemDosage}
                        </span>
                      )}

                      {/* Presentation */}
                      {itemPresentation && (
                        <span className="text-[9px] font-medium text-slate-700 dark:text-slate-300 shrink-0" title={`Presentation: ${itemPresentation}`}>
                          {itemPresentation}
                        </span>
                      )}

                      {/* Form */}
                      {itemForm && (
                        <span className="text-[9px] font-normal text-slate-500 dark:text-slate-400 shrink-0" title={`Form: ${itemForm}`}>
                          {itemForm}
                        </span>
                      )}

                      <span
                        className="inline-flex items-center rounded bg-teal-50 px-1 py-0 text-[8px] font-bold text-teal-800 border border-teal-200/80 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/80 shrink-0 font-mono"
                        title="Pharmacist Margin Profit"
                      >
                        {item.product.pharmacistMarginProfit ?? 0}%
                      </span>
                    </div>
                    {item.product.batches && item.product.batches.length > 0 && (
                      <div className="mt-1 flex items-center w-full">
                        <select
                          value={item.selectedBatchNumber && item.selectedExpiryDate ? `${item.selectedBatchNumber}||${item.selectedExpiryDate}` : ''}
                          onChange={(e) => updateBatch(item.cartItemId!, e.target.value)}
                          style={{ minHeight: '22px', display: 'block' }}
                          className="w-full max-w-[220px] appearance-auto text-[10px] bg-white border border-gray-300 rounded px-1.5 py-0.5 text-slate-700 focus:outline-hidden focus:border-teal-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs"
                        >
                          <option value="">Auto-Select Expiry</option>
                          {(() => {
                            const seen = new Set<string>();
                            const distinctBatches: typeof item.product.batches = [];
                            for (const b of (item.product.batches || [])) {
                              const pairKey = `${b.batchNumber || ''}||${b.expiryDate || ''}`;
                              if (!seen.has(pairKey)) {
                              seen.add(pairKey);
                              distinctBatches.push(b);
                            }
                          }
                          return distinctBatches.map((b, bIdx) => (
                            <option key={`${b.batchNumber || 'NA'}-${b.expiryDate || 'NA'}-${bIdx}`} value={`${b.batchNumber}||${b.expiryDate}`}>
                              Exp: {b.expiryDate} (Batch: {b.batchNumber})
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  {(() => {
                    const isEditing = editingQuantities[item.cartItemId!] !== undefined;
                    const displayVal = isEditing
                      ? editingQuantities[item.cartItemId!]
                      : (item.quantity === 0 ? '' : item.quantity);

                    return (
                      <input
                        type="number"
                        value={displayVal}
                        placeholder="0"
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const val = e.target.value;
                          // If quantity is cleared by user, don't remove item directly; wait until user defines new quantity
                          if (val === '') {
                            setEditingQuantities((prev) => ({ ...prev, [item.cartItemId!]: '' }));
                            return;
                          }

                          const parsed = parseInt(val, 10);
                          if (isNaN(parsed)) {
                            setEditingQuantities((prev) => ({ ...prev, [item.cartItemId!]: val }));
                            return;
                          }

                          // If it's 0 then remove the item
                          if (parsed === 0) {
                            setEditingQuantities((prev) => {
                              const next = { ...prev };
                              delete next[item.cartItemId!];
                              return next;
                            });
                            removeFromCart(item.cartItemId!);
                            return;
                          }

                          // If it's more than 0, then keep it in the cart
                          if (parsed > 0) {
                            setEditingQuantities((prev) => ({ ...prev, [item.cartItemId!]: val }));
                            setAbsoluteQuantity(item.cartItemId!, parsed);
                          }
                        }}
                        onBlur={() => {
                          const currentEdit = editingQuantities[item.cartItemId!];
                          if (currentEdit !== undefined) {
                            setEditingQuantities((prev) => {
                              const next = { ...prev };
                              delete next[item.cartItemId!];
                              return next;
                            });
                            // If blurred while empty or 0, remove the item
                            if (currentEdit === '' || parseInt(currentEdit, 10) === 0) {
                              removeFromCart(item.cartItemId!);
                            } else {
                              const parsed = parseInt(currentEdit, 10);
                              if (!isNaN(parsed) && parsed > 0) {
                                setAbsoluteQuantity(item.cartItemId!, parsed);
                              }
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        min="0"
                        max={isUnrealInvoice ? undefined : (item.isPiece && item.product.piecesPerBox ? item.product.stockQuantity * item.product.piecesPerBox : item.product.stockQuantity)}
                        className="w-8 text-center font-bold text-[10px] text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded h-4 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    );
                  })()}

                  {/* Unit Price Editor */}
                  {isDrug ? (
                    <div
                      className="flex items-center rounded border border-gray-300 bg-white px-0.5 h-4 text-xs focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 shadow-2xs"
                      title="Unit Price (LBP)"
                    >
                      <span className="text-[8px] font-bold text-gray-400 select-none mr-0.5 dark:text-slate-500">LBP</span>
                      {(() => {
                        const isEditing = editingUnitPriceLBP[item.cartItemId!] !== undefined;
                        const displayVal = isEditing
                          ? editingUnitPriceLBP[item.cartItemId!]
                          : unitPriceLBP === 0
                          ? ''
                          : unitPriceLBP.toLocaleString('en-US');

                        const checkStockPriceChangeLBP = (enteredPriceLBP: number) => {
                          const originalStockPriceLBP = item.isPiece && item.product.piecePriceLBP
                            ? item.product.piecePriceLBP
                            : item.product.priceLBP;
                          const originalStockPriceUSD = item.isPiece && item.product.piecePriceUSD
                            ? item.product.piecePriceUSD
                            : item.product.priceUSD;

                          if (
                            enteredPriceLBP > 0 &&
                            Math.round(enteredPriceLBP) !== Math.round(originalStockPriceLBP)
                          ) {
                            const newUSD = exchangeRate > 0 ? Number((enteredPriceLBP / exchangeRate).toFixed(2)) : 0;
                            setPriceChangePrompt({
                              product: item.product,
                              isPiece: item.isPiece,
                              oldPriceLBP: Math.round(originalStockPriceLBP),
                              newPriceLBP: Math.round(enteredPriceLBP),
                              oldPriceUSD: originalStockPriceUSD,
                              newPriceUSD: newUSD,
                            });
                          }
                        };

                        return (
                          <input
                            type="text"
                            inputMode="numeric"
                            value={displayVal}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => {
                              const rawVal = e.target.value.replace(/,/g, '');
                              if (rawVal === '') {
                                setEditingUnitPriceLBP((prev) => ({ ...prev, [item.cartItemId!]: '' }));
                                updateUnitPriceLBP(item.cartItemId!, 0);
                                return;
                              }
                              const parsed = parseInt(rawVal, 10);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setEditingUnitPriceLBP((prev) => ({
                                  ...prev,
                                  [item.cartItemId!]: parsed.toLocaleString('en-US'),
                                }));
                                updateUnitPriceLBP(item.cartItemId!, parsed);
                              }
                            }}
                            onBlur={() => {
                              const currentEdit = editingUnitPriceLBP[item.cartItemId!];
                              if (currentEdit !== undefined) {
                                const parsed = parseInt(currentEdit.replace(/,/g, ''), 10);
                                if (!isNaN(parsed) && parsed > 0) {
                                  checkStockPriceChangeLBP(parsed);
                                }
                              }
                              setEditingUnitPriceLBP((prev) => {
                                const next = { ...prev };
                                delete next[item.cartItemId!];
                                return next;
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            placeholder="0"
                            className="w-16 text-center font-mono text-[9px] font-bold text-slate-800 bg-transparent focus:outline-hidden dark:text-slate-100"
                          />
                        );
                      })()}
                    </div>
                  ) : (
                    <div
                      className="flex items-center rounded border border-gray-300 bg-white px-0.5 h-4 text-xs focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 shadow-2xs"
                      title="Unit Price (USD)"
                    >
                      <span className="text-[9px] font-bold text-gray-400 select-none mr-0.5 dark:text-slate-500">$</span>
                      {(() => {
                        const checkStockPriceChangeUSD = (enteredPriceUSD: number) => {
                          const originalStockPriceUSD = item.isPiece && item.product.piecePriceUSD
                            ? item.product.piecePriceUSD
                            : item.product.priceUSD;
                          const originalStockPriceLBP = item.isPiece && item.product.piecePriceLBP
                            ? item.product.piecePriceLBP
                            : item.product.priceLBP;

                          if (
                            enteredPriceUSD > 0 &&
                            Math.abs(enteredPriceUSD - originalStockPriceUSD) > 0.009
                          ) {
                            const newLBP = Math.round(enteredPriceUSD * exchangeRate);
                            setPriceChangePrompt({
                              product: item.product,
                              isPiece: item.isPiece,
                              oldPriceLBP: Math.round(originalStockPriceLBP),
                              newPriceLBP: newLBP,
                              oldPriceUSD: originalStockPriceUSD,
                              newPriceUSD: enteredPriceUSD,
                            });
                          }
                        };

                        return (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={unitPriceUSD === 0 ? '' : Number(unitPriceUSD.toString())}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateUnitPrice(item.cartItemId!, val === '' ? 0 : parseFloat(val));
                            }}
                            onBlur={(e) => {
                              const val = e.target.value;
                              if (val !== '') {
                                const parsed = parseFloat(val);
                                if (!isNaN(parsed) && parsed > 0) {
                                  checkStockPriceChangeUSD(parsed);
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            placeholder="0.00"
                            className="w-9 text-center font-mono text-[9px] font-bold text-slate-800 bg-transparent focus:outline-hidden dark:text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        );
                      })()}
                    </div>
                  )}

                  {/* Discount per item box */}
                  <div
                    className={`flex items-center rounded border px-0.5 h-4 text-xs transition-all shadow-2xs ${
                      item.discountPercent > 0
                        ? 'border-teal-400 bg-teal-50 dark:border-teal-600 dark:bg-teal-950/60 ring-1 ring-teal-400/40'
                        : item.discountPercent < 0
                        ? 'border-rose-400 bg-rose-50 dark:border-rose-600 dark:bg-rose-950/60 ring-1 ring-rose-400/40'
                        : 'border-gray-300 bg-white dark:border-slate-700 dark:bg-slate-800 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500'
                    }`}
                    title="Item Discount Percentage (%)"
                  >
                    <span className={`text-[9px] font-bold select-none mr-0.5 ${
                      item.discountPercent > 0 ? 'text-teal-700 dark:text-teal-300' : item.discountPercent < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-gray-400 dark:text-slate-400'
                    }`}>
                      %
                    </span>
                    <input
                      type="number"
                      max="100"
                      value={item.discountPercent === 0 ? '' : item.discountPercent}
                      onChange={(e) => {
                        // The browser's number input natively handles the minus sign while typing
                        const val = e.target.value;
                        updateDiscount(item.cartItemId!, val === '' ? 0 : parseFloat(val));
                      }}
                      placeholder="0"
                      className="w-5 text-center font-mono text-[9px] font-bold text-slate-800 dark:text-slate-100 bg-transparent focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* Line Total with applied discount display */}
                  <div className="min-w-[56px] text-right font-mono font-bold text-blue-600 dark:text-blue-400 flex flex-col items-end justify-center leading-none shrink-0">
                    {isDrug ? (
                      <>
                        {item.discountPercent > 0 && (
                          <span className="text-[8px] font-medium text-gray-400 line-through dark:text-slate-500 whitespace-nowrap">
                            {formatLBPValue(originalLBP)} LBP
                          </span>
                        )}
                        <span className={`text-[10px] whitespace-nowrap ${item.discountPercent > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                          {formatLBPValue(lineTotalLBP)} LBP
                        </span>
                      </>
                    ) : (
                      <>
                        {item.discountPercent > 0 && (
                          <span className="text-[8px] font-medium text-gray-400 line-through dark:text-slate-500 whitespace-nowrap">
                            ${originalUSD}
                          </span>
                        )}
                        <span className={`text-[10px] whitespace-nowrap ${item.discountPercent > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                          ${lineTotalUSD}
                        </span>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => removeFromCart(item.cartItemId!)}
                    className="rounded p-0.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

        {/* Totals & Payment Drawer */}
        <div 
          className="border-t border-gray-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-900/90 space-y-1"
        >
          {/* Dual Currency Totals */}
          <div 
            className="rounded-lg border border-teal-200 bg-teal-50/80 p-1.5 shadow-2xs dark:border-teal-900/50 dark:bg-teal-950/35"
          >
            {/* Total Discount Row placed directly at top of Total USD */}
            <div className={`flex items-baseline justify-between pb-1 mb-1 border-b transition-colors ${
              totalDiscountUSD > 0
                ? 'border-emerald-200/90 dark:border-emerald-800/60'
                : 'border-teal-200/50 dark:border-teal-900/30'
            }`}>
              <span className={`text-[10px] font-semibold flex items-center gap-1.5 ${
                totalDiscountUSD > 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-500 dark:text-slate-400'
              }`}>
                <Tag className="h-2.5 w-2.5" />
                Total Discount:
              </span>
              <div className="text-right">
                <span className={`text-[10px] font-mono font-bold ${
                  totalDiscountUSD > 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-gray-500 dark:text-slate-400'
                }`}>
                  {totalDiscountUSD > 0 ? `-$${totalDiscountUSD.toFixed(2)} USD` : '$0.00 USD'}
                </span>
                {totalDiscountLBP > 0 && (
                  <span className="ml-1 text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-mono">
                    (-{formatLBPValue(totalDiscountLBP)} LBP)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] font-bold text-teal-900 dark:text-teal-200">
                Subtotal (Excl. Tax):
              </span>
              <span className="text-[11px] font-mono font-bold text-teal-700 dark:text-teal-400 leading-none">
                ${subtotalUSD.toFixed(2)}
              </span>
            </div>

            {totalTaxUSD > 0 && (
              <div className="flex items-baseline justify-between mb-1 pb-1 border-b border-teal-200/50 dark:border-teal-900/30">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Percent className="h-2.5 w-2.5" />
                  VAT Added:
                </span>
                <div className="text-right">
                  <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400 leading-none">
                    +${totalTaxUSD.toFixed(2)}
                  </span>
                  <span className="ml-1 text-[9px] text-amber-600/80 dark:text-amber-400/80 font-mono">
                    (+{formatLBPValue(totalTaxLBP)} LBP)
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-900 dark:text-teal-200">
                Total (USD):
              </span>
              <span className="text-base font-mono font-extrabold text-teal-700 dark:text-teal-400 leading-none">
                ${totalUSD.toFixed(2)}
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1 pt-0.5 border-t border-teal-200/50 dark:border-teal-900/30">
              <span className="text-[10px] font-semibold text-gray-600 dark:text-slate-400">
                Total (L.L.):
              </span>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
{formatLBPValue(totalLBP)}
              </span>
            </div>

            {/* When money received is more than invoice total, show exact amount received */}
            {isOverpaid && (
              <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-dashed border-teal-300 dark:border-teal-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-900 dark:text-teal-200">
                  Received:
                </span>
                <span className="text-xs font-mono font-extrabold text-teal-800 dark:text-teal-300">
                  {paidUSD > 0 ? `$${paidUSD.toFixed(2)} ` : ''}
                  {paidUSD > 0 && paidLBP > 0 ? '+ ' : ''}
                  {paidLBP > 0 ? `${formatLBPValue(paidLBP)} LBP` : ''}
                </span>
              </div>
            )}
            
            {marginPercent > 0 && (
              <div className="flex items-baseline justify-between mt-0.5 pt-0.5 border-t border-teal-200/50 dark:border-teal-900/30">
                <span className="text-[10px] font-semibold text-gray-600 dark:text-slate-400">
                  Margin:
                </span>
                <span className="text-[10px] font-mono font-bold text-green-600 dark:text-green-400">
                  {marginPercent.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Tendered Cash Inputs */}
          <div className="space-y-1 mt-1">
            <div className="flex gap-1 text-[10px] w-full">
              {/* USD Input Card */}
              <div 
                className="flex-1 bg-white dark:bg-slate-800/80 p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
                    Given USD ($)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {tenderedUSD && (
                      <button
                        type="button"
                        onClick={() => setTenderedUSD('')}
                        className="text-[9px] font-semibold text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Clear USD"
                      >
                        Clear
                      </button>
                    )}
                    {totalUSD > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTenderedUSD(totalUSD.toFixed(2));
                          setTenderedLBP('');
                          setPaymentMethod('cash_usd');
                        }}
                        className="text-[9px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                        title="Set exact total in USD"
                      >
                        Exact ${totalUSD.toFixed(2)}
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-1.5 top-1 text-[10px] text-gray-400 font-bold">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tenderedUSD}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTenderedUSD(val);
                      if (val && !tenderedLBP) {
                        setPaymentMethod('cash_usd');
                      } else if (val && tenderedLBP) {
                        setPaymentMethod('mixed');
                      }
                    }}
                    placeholder={totalUSD > 0 ? totalUSD.toFixed(2) : '0.00'}
                    className="w-full rounded border border-gray-300 bg-gray-50 pl-4 pr-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* LBP Input Card */}
              <div 
                className="flex-1 bg-white dark:bg-slate-800/80 p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
                    Given LBP (L.L.)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {tenderedLBP && (
                      <button
                        type="button"
                        onClick={() => setTenderedLBP('')}
                        className="text-[9px] font-semibold text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Clear LBP"
                      >
                        Clear
                      </button>
                    )}
                    {totalLBP > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTenderedLBP(formatLBPValue(totalLBP));
                          setTenderedUSD('');
                          setPaymentMethod('cash_lbp');
                        }}
                        className="text-[9px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                        title="Set exact total in LBP"
                      >
                        Exact L.L.
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tenderedLBP}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (!raw.trim()) {
                        setTenderedLBP('');
                        return;
                      }
                      // Strip all non-digit characters
                      const digits = raw.replace(/\D/g, '');
                      if (!digits) {
                        setTenderedLBP('');
                        return;
                      }
                      // Detect if backspace deleted a comma without altering digits
                      const prevDigits = tenderedLBP.replace(/\D/g, '');
                      let finalDigits = digits;
                      if (raw.length < tenderedLBP.length && digits === prevDigits && digits.length > 0) {
                        finalDigits = digits.slice(0, -1);
                      }
                      // Automatically insert comma every 3 digits
                      const formatted = finalDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                      setTenderedLBP(formatted);
                      if (formatted && !tenderedUSD) {
                        setPaymentMethod('cash_lbp');
                      } else if (formatted && tenderedUSD) {
                        setPaymentMethod('mixed');
                      }
                    }}
                    placeholder={totalLBP > 0 ? formatLBPValue(totalLBP) : '0'}
                    className="w-full rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-wider text-slate-900 placeholder:text-gray-400 placeholder:font-normal focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Change Display */}
          <div 
            className="transition-all"
          >
            {isOverpaid ? (
              <div className="flex flex-col gap-1 rounded-lg border border-emerald-300 bg-emerald-50/95 p-1.5 text-[10px] text-emerald-950 shadow-xs dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-100">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1 shrink-0">
                    <Banknote className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    Change:
                  </span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setChangeCurrency('USD');
                        setIsCustomChange(false);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                        !isCustomChange && changeCurrency === 'USD'
                          ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-700'
                          : 'bg-white/80 text-emerald-800 hover:bg-white border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
                      }`}
                      title="Return full change in USD ($)"
                    >
                      ${changeUSD.toFixed(2)} USD
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChangeCurrency('LBP');
                        setIsCustomChange(false);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                        !isCustomChange && (changeCurrency === 'LBP' || (changeCurrency === 'auto' && effectiveChangeCurrency === 'LBP'))
                          ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-700'
                          : 'bg-white/80 text-emerald-800 hover:bg-white border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
                      }`}
                      title="Return full change in Lebanese Pounds (LBP)"
                    >
                      {formatLBPValue(changeLBP)} LBP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChangeCurrency('keep_extra');
                        setIsCustomChange(false);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        !isCustomChange && changeCurrency === 'keep_extra'
                          ? 'bg-teal-700 text-white shadow-xs ring-1 ring-teal-800'
                          : 'bg-white/80 text-teal-800 hover:bg-white border border-teal-300 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800'
                      }`}
                      title="Keep extra money in cash drawer (Return 0 change to customer)"
                    >
                      Keep in Drawer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isCustomChange;
                        setIsCustomChange(next);
                        if (next) {
                          // Auto-calculate split: USD whole bills + remaining fractional cents in LBP
                          const wholeUSD = Math.floor(changeUSD);
                          const fractionUSD = Number((changeUSD - wholeUSD).toFixed(2));
                          const fractionLBP = Math.round(fractionUSD * (exchangeRate || 89500));

                          if (wholeUSD > 0 && fractionLBP > 0) {
                            setCustomChangeUSD(wholeUSD.toFixed(2));
                            setCustomChangeLBP(formatLBPValue(fractionLBP));
                          } else if (changeUSD < 1.0 && fractionLBP > 0) {
                            setCustomChangeUSD('0.00');
                            setCustomChangeLBP(formatLBPValue(fractionLBP));
                          } else {
                            setCustomChangeUSD(changeUSD.toFixed(2));
                            setCustomChangeLBP('0');
                          }
                        }
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all cursor-pointer ${
                        isCustomChange
                          ? 'bg-slate-700 text-white dark:bg-slate-600 shadow-xs'
                          : 'bg-white/80 text-slate-700 hover:bg-white border border-gray-300 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                      title="Enter custom or partial change to return (auto-calculates balance)"
                    >
                      Custom...
                    </button>
                  </div>
                </div>

                {isCustomChange && (
                  <div className="flex flex-col gap-1.5 pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-100/60 dark:bg-emerald-950/70 p-1.5 rounded">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-1 shrink-0">
                        Custom Split Change:
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const wholeUSD = Math.floor(changeUSD);
                            const fractionUSD = Number((changeUSD - wholeUSD).toFixed(2));
                            const fractionLBP = Math.round(fractionUSD * (exchangeRate || 89500));
                            setCustomChangeUSD(wholeUSD > 0 ? wholeUSD.toFixed(2) : '0.00');
                            setCustomChangeLBP(fractionLBP > 0 ? formatLBPValue(fractionLBP) : '0');
                          }}
                          className="px-1 py-0.2 rounded bg-white/90 dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-[9px] font-semibold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-50 cursor-pointer"
                          title="Auto-split: USD bills + LBP cents"
                        >
                          Auto-Split ($+L.L.)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomChangeUSD(changeUSD.toFixed(2));
                            setCustomChangeLBP('0');
                          }}
                          className="px-1 py-0.2 rounded bg-white/90 dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-[9px] font-semibold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-50 cursor-pointer"
                          title="All in USD"
                        >
                          All $
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomChangeUSD('0.00');
                            setCustomChangeLBP(formatLBPValue(changeLBP));
                          }}
                          className="px-1 py-0.2 rounded bg-white/90 dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-[9px] font-semibold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-50 cursor-pointer"
                          title="All in LBP"
                        >
                          All L.L.
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-0.5">
                          <span>$ (USD):</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customChangeUSD}
                          onChange={(e) => {
                            const valStr = e.target.value;
                            setCustomChangeUSD(valStr);
                            if (valStr.trim() === '') {
                              setCustomChangeLBP(formatLBPValue(changeLBP));
                              return;
                            }
                            const valUSD = parseUSD(valStr);
                            if (!isNaN(valUSD)) {
                              const remUSD = Math.max(0, Number((changeUSD - valUSD).toFixed(2)));
                              const remLBP = Math.round(remUSD * (exchangeRate || 89500));
                              setCustomChangeLBP(remLBP > 0 ? formatLBPValue(remLBP) : '0');
                            }
                          }}
                          placeholder="0.00"
                          className="w-16 rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-[11px] font-mono font-bold dark:bg-slate-900 dark:border-emerald-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">+</span>

                      <div className="flex items-center gap-1">
                        <label className="text-[10px] font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-0.5">
                          <span>L.L. (LBP):</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={customChangeLBP}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const digits = raw.replace(/\D/g, '');
                            const formatted = digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
                            setCustomChangeLBP(formatted);
                            if (!digits || digits === '0') {
                              setCustomChangeUSD(changeUSD.toFixed(2));
                              return;
                            }
                            const valLBP = parseLBP(digits);
                            const rate = exchangeRate || 89500;
                            const lbpInUSD = rate > 0 ? valLBP / rate : 0;
                            const remUSD = Math.max(0, Number((changeUSD - lbpInUSD).toFixed(2)));
                            setCustomChangeUSD(remUSD > 0.009 ? remUSD.toFixed(2) : '0.00');
                          }}
                          placeholder="0"
                          className="w-24 rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-[11px] font-mono font-bold dark:bg-slate-900 dark:border-emerald-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[9px] pt-0.5 border-t border-emerald-200/60 dark:border-emerald-800/40">
                  {changeCurrency === 'keep_extra' && !isCustomChange ? (
                    <span className="text-teal-900 dark:text-teal-200 font-bold">
                      Kept in drawer: <strong className="underline">+{paidUSD > 0 && paidLBP === 0 ? `$${changeUSD.toFixed(2)} USD` : `${formatLBPValue(changeLBP)} LBP`}</strong> (Full tendered cash added to drawer)
                    </span>
                  ) : (
                    <span className="text-emerald-800/80 dark:text-emerald-300/80">
                      Giving back: <strong className="font-bold">{actualChangeUSD > 0 ? `$${actualChangeUSD.toFixed(2)} USD` : ''} {actualChangeLBP > 0 ? `${formatLBPValue(actualChangeLBP)} LBP` : ''}{actualChangeUSD === 0 && actualChangeLBP === 0 ? 'None ($0.00)' : ''}</strong>
                      {(retainedUSD >= 0.01 || retainedLBP > 0) && (
                        <span className="ml-1 text-teal-800 dark:text-teal-300 font-bold">
                          • Retaining in drawer: +{retainedUSD >= 0.01 ? `$${retainedUSD.toFixed(2)}` : ''}{retainedLBP > 0 ? ` +${formatLBPValue(retainedLBP)} LBP` : ''}
                        </span>
                      )}
                    </span>
                  )}
                  {isChangeExceeding ? (
                    <span className="text-rose-600 dark:text-rose-400 font-bold text-[9px]">
                      Exceeds received amount!
                    </span>
                  ) : (
                    <span className="text-emerald-700/70 dark:text-emerald-400/70 italic text-[9px]">
                      {changeCurrency === 'keep_extra' ? 'Click USD/LBP to return change' : 'Click to change mode'}
                    </span>
                  )}
                </div>
              </div>
            ) : isExactPayment ? (
              <div className="flex items-center justify-between rounded-lg border border-teal-300 bg-teal-50/90 p-1.5 text-[10px] text-teal-900 shadow-xs dark:border-teal-700/60 dark:bg-teal-950/40 dark:text-teal-200">
                <span className="font-bold text-[10px] uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1">
                  <Banknote className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                  Exact Payment:
                </span>
                <span className="font-bold text-teal-700 dark:text-teal-300">
                  No Change Required ($0.00 / 0 LBP)
                </span>
              </div>
            ) : isUnderpaid ? (
              <div className="flex flex-col gap-0.5 rounded-lg border border-amber-300 bg-amber-50/90 p-1.5 text-[10px] text-amber-950 shadow-xs dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    Remaining Balance Due:
                  </span>
                  <span className="font-mono font-bold text-amber-900 dark:text-amber-200 text-xs">
{formatLBPValue(remainingLBP)} LBP
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-amber-800/90 dark:text-amber-300/90 pt-0.5 border-t border-amber-200/60 dark:border-amber-900/40">
                  <span>Shortage:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {remainingUSD >= 0.01
                      ? `-$${remainingUSD.toFixed(2)} USD`
                      : `-${formatLBPValue(remainingLBP)} LBP`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-gray-300 bg-gray-50/70 px-2 py-1 text-[10px] text-gray-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                <span className="text-[10px] font-medium flex items-center gap-1">
                  <Banknote className="h-3 w-3 text-gray-400" />
                  Change Calculator:
                </span>
                <span className="text-[10px] italic">Enter received cash in USD or LBP</span>
              </div>
            )}
          </div>

          {/* Checkout & Write Off Option */}
          <div className="flex gap-1.5 items-stretch h-8 mt-1">
            {/* Checkout Buttons */}
            <button
              onClick={() => handleCheckout(false)}
              disabled={cart.length === 0 || (isUnderpaid && !writeOffDifferences) || (!selectedCustomerId && !isUnrealInvoice && !hasEnteredPayment)}
              className={`flex-1 flex items-center justify-center space-x-1 rounded-lg px-2 text-[10px] font-bold shadow-xs transition-all cursor-pointer uppercase tracking-wider ${
                isUnderpaid && !writeOffDifferences
                  ? 'bg-amber-600 text-white opacity-50'
                  : isUnrealInvoice
                  ? 'bg-amber-600 text-white hover:bg-amber-700 active:scale-[0.99]'
                  : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-[0.99]'
              } disabled:opacity-40`}
            >
              <span className="truncate">
                {isUnderpaid && !writeOffDifferences
                  ? `Check "Write Off"`
                  : isUnrealInvoice
                  ? 'Fictitious Sale'
                  : 'Sale'}
              </span>
              <ArrowRight className="h-3 w-3 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => holdCurrentSale()}
              disabled={cart.length === 0}
              className="flex items-center justify-center space-x-1 rounded-lg px-2.5 text-[10px] font-bold shadow-xs transition-all cursor-pointer uppercase tracking-wider bg-amber-600 text-white hover:bg-amber-700 active:scale-[0.99] disabled:opacity-40 shrink-0"
              title="Hold current sale to assist another customer (F8)"
            >
              <PauseCircle className="h-3 w-3 shrink-0" />
              <span className="truncate">Hold</span>
            </button>
            
            <button
              onClick={handlePrintClick}
              disabled={cart.length === 0}
              className="flex-1 flex items-center justify-center space-x-1 rounded-lg px-2 text-[10px] font-bold shadow-xs transition-all cursor-pointer uppercase tracking-wider bg-slate-700 text-white hover:bg-slate-800 active:scale-[0.99] dark:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-40"
            >
              <span className="truncate">Print</span>
              <Printer className="h-3 w-3 shrink-0" />
            </button>

            {/* Option: Write Off Differences */}
            <div
              className={`flex items-center rounded-lg border px-2 transition-all shrink-0 ${
                isUnderpaid
                  ? writeOffDifferences
                    ? 'border-teal-400 bg-teal-50/90 text-teal-950 dark:border-teal-700/60 dark:bg-teal-950/40 dark:text-teal-100 ring-1 ring-teal-400/40 shadow-xs'
                    : 'border-amber-400 bg-amber-50/90 text-amber-950 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100 ring-1 ring-amber-400/50 shadow-xs'
                  : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-800/40'
              }`}
            >
              <label className="flex items-center gap-2 cursor-pointer select-none h-full">
                <input
                  type="checkbox"
                  checked={writeOffDifferences}
                  onChange={(e) => {
                    setWriteOffDifferences(e.target.checked);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="h-3 w-3 rounded border-gray-300 text-teal-600 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 cursor-pointer accent-teal-600"
                />
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider leading-none">
                    Write off
                  </span>
                  {isUnderpaid && (
                    <span className="font-mono text-[9px] font-extrabold text-rose-600 dark:text-rose-400 leading-none mt-0.5">
                      {remainingUSD >= 0.01 ? `-$${remainingUSD.toFixed(2)}` : `-${formatLBPValue(remainingLBP)} L.L.`}
                    </span>
                  )}
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Payment Type Confirmation Modal */}
      {showPaymentConfirmModal && selectedCust && (
        <DesktopWindow
          id="sale-payment-confirm-modal"
          title="Payment Confirmation"
          isOpen={true}
          section="sale"
          onClose={() => setShowPaymentConfirmModal(false)}
          width="480px"
          height="auto"
        >
          <div className="p-5 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
            <div className="flex items-center space-x-2.5">
              <div className="rounded-lg bg-teal-100 p-2 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Record Transaction
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose how to record this transaction for {selectedCust.name}
                </p>
              </div>
            </div>

            {/* Customer & Sale Summary */}
            <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-slate-400">Customer:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedCust.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-slate-400">Current Outstanding Debt:</span>
                <span className={`font-mono font-bold ${selectedCust.balanceUSD > 0 || selectedCust.balanceLBP > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
                  ${selectedCust.balanceUSD.toFixed(2)} / {formatLBPValue(selectedCust.balanceLBP)} LBP
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/80 dark:border-slate-700/80">
                <span className="font-bold text-slate-700 dark:text-slate-300">Transaction Total:</span>
                <div className="text-right font-mono">
                  <span className="text-sm font-extrabold text-teal-700 dark:text-teal-400">
                    ${totalUSD.toFixed(2)}
                  </span>
                  <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
{formatLBPValue(totalLBP)} LBP
                  </span>
                </div>
              </div>
              {hasEnteredPayment && (
                <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-200 dark:border-slate-700 text-[11px]">
                  <span className="text-gray-500 dark:text-slate-400">Tendered Cash:</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                    {paidUSD > 0 ? `$${paidUSD.toFixed(2)} ` : ''}
                    {paidLBP > 0 ? `${formatLBPValue(paidLBP)} LBP` : ''}
                    {isOverpaid && (
                      actualChangeUSD === 0 && actualChangeLBP === 0
                        ? ` (No Change • Kept in drawer: +${retainedUSD >= 0.01 ? `$${retainedUSD.toFixed(2)}` : ''}${retainedLBP > 0 ? ` +${formatLBPValue(retainedLBP)} LBP` : ''})`
                        : ` (Change: ${actualChangeUSD > 0 ? `$${actualChangeUSD.toFixed(2)} USD` : ''} ${actualChangeLBP > 0 ? `${formatLBPValue(actualChangeLBP)} LBP` : ''}${retainedUSD >= 0.01 || retainedLBP > 0 ? ` • Kept: +${retainedUSD >= 0.01 ? `$${retainedUSD.toFixed(2)}` : ''}` : ''})`
                    )}
                  </span>
                </div>
              )}
              {hasEnteredPayment && isUnderpaid && (
                <div className="flex justify-between items-center pt-1 border-t border-dashed border-amber-300 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 font-bold">
                  <span>Payment Difference:</span>
                  <span>
                    {remainingUSD >= 0.01 ? `-$${remainingUSD.toFixed(2)} ` : ''}
                    (-{formatLBPValue(remainingLBP)} LBP)
                  </span>
                </div>
              )}
              {hasEnteredPayment && isUnderpaid && writeOffDifferences && (
                <div className="text-[10px] text-teal-800 dark:text-teal-200 font-semibold bg-teal-50 dark:bg-teal-950/60 p-2 rounded border border-teal-200 dark:border-teal-900">
                  ✓ "Write off differences" is active. The shortage of {remainingUSD >= 0.01 ? `$${remainingUSD.toFixed(2)} ` : ''}({formatLBPValue(remainingLBP)} LBP) will be forgiven upon saving as cash.
                </div>
              )}
              {hasEnteredPayment && isUnderpaid && !writeOffDifferences && (
                <div className="text-[10px] text-amber-800 dark:text-amber-200 font-semibold bg-amber-50 dark:bg-amber-950/60 p-2 rounded border border-amber-200 dark:border-amber-900">
                  ⚠ Payment is short. To accept as cash, close and check "Write off differences", or choose "Save as Debt Transaction" below.
                </div>
              )}
            </div>

            {/* Action Selection */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => executeCompleteSale('cash')}
                className="w-full flex items-center justify-between p-3 rounded-lg border-2 border-teal-500/80 bg-teal-50/50 hover:bg-teal-100/70 dark:bg-teal-950/30 dark:hover:bg-teal-950/50 transition-all cursor-pointer text-left group"
              >
                <div className="flex items-center space-x-3">
                  <div className="rounded-md bg-teal-600 p-2 text-white group-hover:scale-105 transition-transform">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-extrabold text-teal-950 dark:text-teal-200">
                      Save as Cash Transaction
                    </span>
                    <span className="block text-[11px] text-teal-700/80 dark:text-teal-300/80">
                      Payment received in cash. Customer debt balance will not be charged.
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0 ml-2" />
              </button>

              <button
                type="button"
                onClick={() => executeCompleteSale('debt')}
                className="w-full flex items-center justify-between p-3 rounded-lg border-2 border-purple-500/80 bg-purple-50/50 hover:bg-purple-100/70 dark:bg-purple-950/30 dark:hover:bg-purple-950/50 transition-all cursor-pointer text-left group"
              >
                <div className="flex items-center space-x-3">
                  <div className="rounded-md bg-purple-600 p-2 text-white group-hover:scale-105 transition-transform">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-extrabold text-purple-950 dark:text-purple-200">
                      Save as Debt Transaction
                    </span>
                    <span className="block text-[11px] text-purple-700/80 dark:text-purple-300/80">
                      Total ${totalUSD.toFixed(2)} ({formatLBPValue(totalLBP)} LBP) will be registered as debt for this customer.
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 ml-2" />
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentConfirmModal(false)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel & Back to Cart
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}

      {/* Printable Receipt Modal */}
      {lastCompletedSale && (
        <ReceiptModal
          sale={lastCompletedSale}
          settings={settings}
          onClose={() => setLastCompletedSale(null)}
        />
      )}

      {/* Stock Card & Details Modal */}
      <DrugDetailsModal
        product={selectedStockCardProduct}
        isOpen={isStockCardOpen}
        onClose={() => setIsStockCardOpen(false)}
        onViewScientific={onViewScientific}
        exchangeRate={exchangeRate}
      />

      {/* Held / Parked Transactions Modal */}
      <ParkedSalesModal
        isOpen={isParkedModalOpen}
        onClose={() => setIsParkedModalOpen(false)}
        parkedSales={parkedSales}
        onResume={resumeParkedSale}
        onDelete={deleteParkedSale}
        onHoldCurrent={() => holdCurrentSale()}
        hasActiveCart={cart.length > 0}
        formatUSD={formatUSD}
        formatLBP={formatLBP}
        onUpdateNote={updateParkedNote}
      />

      {/* Stock Selling Price Change Confirmation Dialog */}
      {priceChangePrompt && (
        <DesktopWindow
          id="pos-stock-price-change-modal"
          title="Update Stock Selling Price?"
          isOpen={true}
          section="sale"
          onClose={() => setPriceChangePrompt(null)}
          width="460px"
          height="auto"
          minWidth={360}
          minHeight={260}
        >
          <div className="p-4 flex flex-col justify-between h-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-teal-100 dark:bg-teal-950/80 p-2 text-teal-700 dark:text-teal-300 shrink-0">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Update Original Price in Stock?
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    You changed the selling price of{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {priceChangePrompt.product.name}
                      {priceChangePrompt.isPiece ? ' (Piece)' : ''}
                    </span>{' '}
                    in the sale cart.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-teal-200 dark:border-teal-800/60 bg-teal-50/50 dark:bg-teal-950/40 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Current Stock Price:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {priceChangePrompt.oldPriceLBP.toLocaleString('en-US')} LBP
                    <span className="text-[10px] text-slate-500 font-normal ml-1">
                      (${priceChangePrompt.oldPriceUSD.toFixed(2)})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-teal-200/60 dark:border-teal-800/40">
                  <span className="font-semibold text-teal-900 dark:text-teal-200">New Price Entered:</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-300 text-sm">
                    {priceChangePrompt.newPriceLBP.toLocaleString('en-US')} LBP
                    <span className="text-xs text-teal-600 dark:text-teal-400 font-semibold ml-1">
                      (${priceChangePrompt.newPriceUSD.toFixed(2)})
                    </span>
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Do you want to permanently update the product's selling price in stock to this new price, or keep it only for this sale?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPriceChangePrompt(null)}
                className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shadow-2xs"
              >
                No, this sale only
              </button>
              <button
                type="button"
                onClick={confirmUpdateStockPrice}
                className="px-3.5 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer shadow-xs transition-colors"
              >
                Yes, update stock price
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}

      {/* Global drag overlay to prevent text selection and ensure smooth dragging */}
      {isDraggingCartResizer && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none" />
      )}
    </div>
  );
};
