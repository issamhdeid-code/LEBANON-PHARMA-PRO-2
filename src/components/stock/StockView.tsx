import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Tag,
  Upload,
  AlertTriangle,
  Boxes,
  Edit2,
  Trash2,
  BookOpen,
  Check,
  X,
  FileSpreadsheet,
  DollarSign,
  Layers,
  Filter,
  ArrowUpDown,
  Globe,
  Sparkles,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Dices,
  ChevronDown
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePharmacy } from '../../context/PharmacyContext';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useDebounce } from '../../hooks/useDebounce';
import { Product, ProductCategory, ScientificDrugInfo, PurchaseInvoice, MoleculeStrength } from '../../types/pharmacy';
import { getSubcategoryOptions, suggestSubcategory } from '../../constants/subcategories';
import { formatStockDisplay, generateRandomBarcode, resolveProductBatches, splitProductMolecule } from '../../utils/stockUtils';
import { resolveStraightforwardScientificInfo } from '../../services/scientificDataService';
import { getPriceChangeInfoUSD, getPriceChangeInfoLBP, formatLBPValue } from '../../utils/priceUtils';
import { PriceUpdaterModal } from './PriceUpdaterModal';
import { DrugDetailsModal } from './DrugDetailsModal';
import { BulkEditStockModal } from './BulkEditStockModal';
import { DesktopWindow } from '../common/DesktopWindow';
import { SectionRestoreButton } from '../common/SectionRestoreButton';
import { useWindowContext } from '../../context/WindowContext';
import {
  getStandardPharmaceuticalForms,
  normalizePharmaceuticalForm,
  isCanonicalPharmaceuticalForm,
} from '../../utils/pharmaceuticalFormUtils';
import {
  getStandardPresentations,
  normalizePresentation,
} from '../../utils/presentationUtils';

interface StockViewProps {
  onViewScientific: (product: Product) => void;
  onOpenCSVImport: () => void;
  onOpenMOPHUpdater: () => void;
}

type SortKey = 'code' | 'barcode' | 'name' | 'presentation' | 'category' | 'stockQuantity' | 'expiryDate' | 'priceUSD' | 'agent';

// Helper to parse diverse date formats (DD-MM-YYYY, YYYY-MM-DD, MM-YYYY) and output MM-YYYY format
const parseExpiryDate = (dateStr?: string): { date: Date | null; displayMMYYYY: string } => {
  if (!dateStr) return { date: null, displayMMYYYY: '' };
  const str = dateStr.trim();

  // Pattern: DD-MM-YYYY or D-M-YYYY (e.g. 31-10-2026, 31/10/2026)
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    const year = parseInt(dmy[3], 10);
    const d = new Date(year, month - 1, day);
    const mm = String(month).padStart(2, '0');
    return { date: d, displayMMYYYY: `${mm}-${year}` };
  }

  // Pattern: YYYY-MM-DD (e.g. 2026-10-31)
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10);
    const day = parseInt(ymd[3], 10);
    const d = new Date(year, month - 1, day);
    const mm = String(month).padStart(2, '0');
    return { date: d, displayMMYYYY: `${mm}-${year}` };
  }

  // Pattern: MM-YYYY or M-YYYY (e.g. 10-2026, 10/2026)
  const my = str.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (my) {
    const month = parseInt(my[1], 10);
    const year = parseInt(my[2], 10);
    const d = new Date(year, month, 0); // Last day of month
    const mm = String(month).padStart(2, '0');
    return { date: d, displayMMYYYY: `${mm}-${year}` };
  }

  // Pattern: YYYY-MM (e.g. 2026-10)
  const ym = str.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (ym) {
    const year = parseInt(ym[1], 10);
    const month = parseInt(ym[2], 10);
    const d = new Date(year, month, 0);
    const mm = String(month).padStart(2, '0');
    return { date: d, displayMMYYYY: `${mm}-${year}` };
  }

  // Fallback to native Date parser
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return { date: d, displayMMYYYY: `${mm}-${year}` };
  }

  return { date: null, displayMMYYYY: str };
};

const DEFAULT_STOCK_COL_WIDTHS: Record<string, number> = {
  select: 36,
  code: 80,
  barcode: 100,
  name: 200,
  presentation: 140,
  category: 110,
  priceUSD: 85,
  priceLBP: 110,
  stockQuantity: 70,
  expiryDate: 90,
  agent: 120,
  actions: 85,
};

interface StockTableRowProps {
  prod: Product;
  index: number;
  isSelected: boolean;
  isRowSelected: boolean;
  changeUSD?: ReturnType<typeof getPriceChangeInfoUSD>;
  changeLBP?: ReturnType<typeof getPriceChangeInfoLBP>;
  onToggleRowSelect: (id: string, index: number, isShift: boolean) => void;
  onOpenDetails: (prod: Product) => void;
  onOpenPrice: (code: string) => void;
  onViewScientific: (prod: Product) => void;
  onEdit: (prod: Product) => void;
  onFilterSubcategory?: (subcat: string) => void;
  purchases?: PurchaseInvoice[];
}

const StockTableRow = React.memo(React.forwardRef<HTMLTableRowElement, StockTableRowProps & { dataIndex?: number; style?: React.CSSProperties }>(function StockTableRow({
  prod,
  index,
  isSelected,
  isRowSelected,
  changeUSD,
  changeLBP,
  onToggleRowSelect,
  onOpenDetails,
  onOpenPrice,
  onViewScientific,
  onEdit,
  onFilterSubcategory,
  purchases,
  dataIndex,
  style,
}, ref) {
  const isLow = prod.stockQuantity <= prod.minStockAlert;
  const isOut = prod.stockQuantity <= 0;

  const resolvedBatches = React.useMemo(() => {
    return resolveProductBatches(prod, purchases || []);
  }, [prod, purchases]);

  const renderExpiryCellView = React.useCallback((targetProd: Product = prod) => {
    // Filter active batches with quantity > 0 (omit zero quantity batches)
    const activeBatches = resolvedBatches.filter((b) => (b.quantity || 0) > 0);

    // Primary expiry to display on the shelf/row:
    // If there are active batches in stock, show the EARLIEST expiring active batch (FIFO/FEFO).
    // If out of stock, fallback to the first resolved batch or targetProd.expiryDate.
    const primaryBatch = activeBatches.length > 0
      ? activeBatches[0]
      : (resolvedBatches.length > 0 ? resolvedBatches[0] : null);

    const expiry = primaryBatch?.expiryDate || targetProd.expiryDate;
    if (!expiry || !expiry.trim()) {
      return null;
    }

    const { date: expDate, displayMMYYYY } = parseExpiryDate(expiry);

    let isExpired = false;
    let isNearExpiry = false;
    let monthsLeft = 0;

    if (expDate && !isNaN(expDate.getTime())) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diffTime = expDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isExpired = diffDays < 0;
      isNearExpiry = diffDays >= 0 && diffDays <= 90;
      monthsLeft = Math.max(1, Math.round(diffDays / 30));
    }

    // Build comprehensive, accurate tooltip displaying real batches, expiries and quantities:
    let tooltipText: string | undefined;

    if (activeBatches.length > 0) {
      const lines = activeBatches.map((b) => {
        const expFormatted = parseExpiryDate(b.expiryDate).displayMMYYYY || b.expiryDate || 'N/A';
        const qtyFormatted = formatStockDisplay(b.quantity || 0, targetProd.isDivisible, targetProd.piecesPerBox, targetProd.pieceName);
        return `Batch: ${b.batchNumber || 'N/A'}, Expiry: ${expFormatted}, Quantity: ${qtyFormatted}`;
      });

      if (activeBatches.length > 1) {
        lines.push(`Total: ${formatStockDisplay(targetProd.stockQuantity, targetProd.isDivisible, targetProd.piecesPerBox, targetProd.pieceName)} (${activeBatches.length} batches)`);
      }
      tooltipText = lines.join('\n');
    } else if (targetProd.stockQuantity <= 0) {
      if (resolvedBatches.length > 0) {
        const lines = [`Out of stock (0 in stock)`];
        resolvedBatches.forEach((b) => {
          const expFormatted = parseExpiryDate(b.expiryDate).displayMMYYYY || b.expiryDate || 'N/A';
          lines.push(`Batch: ${b.batchNumber || 'N/A'}, Expiry: ${expFormatted} (Depleted)`);
        });
        tooltipText = lines.join('\n');
      } else {
        tooltipText = `Out of stock`;
      }
    }

    const extraBatchesCount = activeBatches.length > 1 ? activeBatches.length - 1 : 0;

    return (
      <div className="flex flex-col py-0.5" title={tooltipText}>
        <div className="flex items-center gap-1.5 cursor-default" title={tooltipText}>
          <span
            title={tooltipText}
            className={`font-mono text-xs ${
              isExpired
                ? 'font-bold text-red-600 dark:text-red-400'
                : isNearExpiry
                ? 'font-semibold text-amber-600 dark:text-amber-400'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {displayMMYYYY}
          </span>
          {extraBatchesCount > 0 && (
            <span
              className="text-[9px] px-1 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded font-medium cursor-help"
              title={tooltipText}
            >
              +{extraBatchesCount}
            </span>
          )}
        </div>
        {isExpired ? (
          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 leading-tight">
            Expired
          </span>
        ) : isNearExpiry ? (
          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 leading-tight">
            Expiring in {monthsLeft}m
          </span>
        ) : null}
      </div>
    );
  }, [prod, resolvedBatches]);

  return (
    <tr
      ref={ref}
      data-index={dataIndex}
      id={`stock-table-row-${prod.id}`}
      onClick={() => onOpenDetails(prod)}
      style={style}
      className={`text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
        isRowSelected
          ? 'bg-teal-50/80 dark:bg-teal-950/50'
          : isSelected
          ? 'bg-slate-100/70 dark:bg-slate-800/70'
          : 'bg-white dark:bg-slate-900'
      }`}
    >
      <td
        className="p-1 px-2 text-center border-r border-slate-200 dark:border-slate-700 whitespace-nowrap"
        onClick={(e) => {
          e.stopPropagation();
          onToggleRowSelect(prod.id, index, e.shiftKey);
        }}
      >
        <input
          type="checkbox"
          checked={isRowSelected}
          onChange={() => {}}
          onClick={(e) => {
            e.stopPropagation();
            onToggleRowSelect(prod.id, index, e.shiftKey);
          }}
          className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5 cursor-pointer align-middle"
        />
      </td>
      <td className="p-1 px-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">
        {prod.code || '-'}
      </td>
      <td className="p-1 px-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">
        {prod.barcode || '-'}
      </td>
      <td className="p-1 px-2 border-r border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100 min-w-0">
        <div className="truncate">{prod.name}</div>
        <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500 truncate">
          {prod.dosage} • {prod.form}
        </div>
      </td>
      <td
        id={`td-stock-presentation-${prod.id}`}
        className="p-1 px-2 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 min-w-0 truncate"
        title={prod.presentation || ''}
      >
        {prod.presentation ? (
          <span>{prod.presentation}</span>
        ) : (
          <span className="text-gray-400 dark:text-slate-500 italic">-</span>
        )}
      </td>
      <td className="p-1 px-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
        <div className="flex flex-col gap-0.5 items-start">
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
              prod.category === 'drug'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                : prod.category === 'vitamins'
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300'
                : prod.category === 'cosmetics'
                ? 'bg-pink-100 text-pink-800 dark:bg-pink-950/70 dark:text-pink-300'
                : 'bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300'
            }`}
          >
            {prod.category}
          </span>
          {prod.subcategory && (
            <span
              className="inline-block text-[9.5px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 px-1 py-0.2 rounded truncate max-w-[120px] cursor-pointer transition-colors"
              title={`Subcategory: ${prod.subcategory} (Click to filter)`}
              onClick={(e) => {
                e.stopPropagation();
                onFilterSubcategory?.(prod.subcategory!);
              }}
            >
              {prod.subcategory}
            </span>
          )}
        </div>
      </td>
      <td className="p-1 px-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-right font-medium text-slate-800 dark:text-slate-200">
        <div className="flex items-center justify-end gap-1">
          <span>${prod.priceUSD.toFixed(2)}</span>
          {changeUSD && (
            <span
              className={`flex items-center text-[10px] font-semibold ${
                changeUSD.direction === 'up' ? 'text-green-500' : 'text-red-500'
              }`}
              title={
                changeUSD.isSkippedDecrease
                  ? `Lower CSV price ($${changeUSD.importedPrice?.toFixed(2)}) was skipped to preserve selling price (-${changeUSD.percentFormatted}%)`
                  : changeUSD.direction === 'up'
                  ? `Price increased by ${changeUSD.percentFormatted}% (was $${prod.previousPriceUSD?.toFixed(2)})`
                  : `Price decreased by ${changeUSD.percentFormatted}% (was $${prod.previousPriceUSD?.toFixed(2)})`
              }
            >
              {changeUSD.direction === 'up' ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
              {changeUSD.percentFormatted}%
            </span>
          )}
        </div>
      </td>
      <td className="p-1 px-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-right font-medium text-slate-800 dark:text-slate-200">
        <div className="flex items-center justify-end gap-1">
          <span>{formatLBPValue(prod.priceLBP)}</span>
          {changeLBP && (
            <span
              className={`flex items-center text-[10px] font-semibold ${
                changeLBP.direction === 'up' ? 'text-green-500' : 'text-red-500'
              }`}
              title={
                changeLBP.isSkippedDecrease
                  ? `Lower CSV price (${formatLBPValue(changeLBP.importedPrice ?? 0)} LBP) was skipped to preserve selling price (-${changeLBP.percentFormatted}%)`
                  : changeLBP.direction === 'up'
                  ? `Price increased by ${changeLBP.percentFormatted}% (was ${formatLBPValue(prod.previousPriceLBP ?? 0)} LBP)`
                  : `Price decreased by ${changeLBP.percentFormatted}% (was ${formatLBPValue(prod.previousPriceLBP ?? 0)} LBP)`
              }
            >
              {changeLBP.direction === 'up' ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
              {changeLBP.percentFormatted}%
            </span>
          )}
        </div>
      </td>
      <td className="p-1 px-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-center font-medium">
        <div
          className={`flex flex-col items-center leading-tight ${
            prod.stockQuantity === 0
              ? 'text-red-600 dark:text-red-400 font-extrabold'
              : prod.stockQuantity <= 3
              ? 'text-amber-600 dark:text-amber-400 font-bold'
              : 'text-slate-800 dark:text-slate-200 font-bold'
          }`}
        >
          {(() => {
            if (!prod.isDivisible || !prod.piecesPerBox || prod.piecesPerBox <= 1) {
              const qty = Number.isInteger(prod.stockQuantity) ? prod.stockQuantity.toString() : prod.stockQuantity.toFixed(2);
              return <span>{qty} box</span>;
            }
            
            const totalPieces = Math.round(prod.stockQuantity * prod.piecesPerBox);
            const boxes = Math.floor(totalPieces / prod.piecesPerBox);
            const pieces = totalPieces % prod.piecesPerBox;
            const pieceLabel = prod.pieceName || 'Piece';
            const pieceLabelPlural = pieces > 1 || pieces === 0 ? 's' : '';
            const boxLabel = `box${boxes > 1 || boxes === 0 ? 'es' : ''}`;
            
            if (boxes === 0 && pieces > 0) return <span>{pieces} {pieceLabel}{pieceLabelPlural}</span>;
            if (pieces === 0) return <span>{boxes} {boxLabel}</span>;
            
            return (
              <>
                <span>{boxes} {boxLabel}</span>
                <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold">{pieces} {pieceLabel}{pieceLabelPlural}</span>
              </>
            );
          })()}
        </div>
      </td>
      <td className="p-1 px-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
        {renderExpiryCellView(prod)}
      </td>
      <td className="p-1 px-2 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 min-w-0 truncate" title={prod.agent || ''}>
        {prod.agent || '-'}
      </td>
      <td className="p-1 px-2 whitespace-nowrap text-right">
        <div className="flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
          {/* Quick Price Update by Code Button */}
          <button
            onClick={() => onOpenPrice(prod.code)}
            className="rounded p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer transition-colors"
            title="Update price for this drug"
          >
            <Tag className="h-3.5 w-3.5" />
          </button>

          {/* Scientific Info Button */}
          {prod.category === 'drug' && (
            <button
              onClick={() => onViewScientific(prod)}
              className="rounded p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer transition-colors"
              title="View Full Scientific Dossier"
            >
              <BookOpen className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Edit Product */}
          <button
            onClick={() => onEdit(prod)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
            title="Edit Item Details"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}));

export const StockView: React.FC<StockViewProps> = ({ onViewScientific, onOpenCSVImport, onOpenMOPHUpdater }) => {
  const {
    products,
    purchases,
    addProduct,
    updateProduct,
    bulkDeleteProducts,
    deleteProduct,
    deleteAllProducts,
    clearPriceChangeIndicators,
    exchangeRate,
    formatLBP,
    formatUSD,
    currentUser,
    suppliers,
    addSupplier,
    searchScientificDataOnline,
    settings,
    updateSettings,
    addNotification,
  } = usePharmacy();
  const { restoreWindow, restoreSectionWindows } = useWindowContext();

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 250);

  useBarcodeScanner({
    onScan: (barcode) => {
      setSearchQuery(barcode);
    }
  });

  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' } | null>(null);

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('stock_table_col_widths');
      if (saved) return { ...DEFAULT_STOCK_COL_WIDTHS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_STOCK_COL_WIDTHS;
  });

  const handleColResizeStart = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.pageX;
    const startWidth = colWidths[col] || 100;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.pageX - startX;
      setColWidths((prev) => {
        const updated = {
          ...prev,
          [col]: Math.max(35, startWidth + delta),
        };
        try {
          localStorage.setItem('stock_table_col_widths', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [selectedProductCode, setSelectedProductCode] = useState<string>('');
  const [selectedStockProduct, setSelectedStockProduct] = useState<Product | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Bulk Edit & Selection State
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

  // Add/Edit Product Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isFetchingScientifics, setIsFetchingScientifics] = useState(false);
  const [showDiscardConfirmModal, setShowDiscardConfirmModal] = useState(false);

  // Form State
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [formCode, setFormCode] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ProductCategory | string>('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [formSubcategory, setFormSubcategory] = useState('');
  const [isSubcategoryDropdownOpen, setIsSubcategoryDropdownOpen] = useState(false);
  const [subcategorySearchQuery, setSubcategorySearchQuery] = useState('');
  const [isAddingCustomSubcategory, setIsAddingCustomSubcategory] = useState(false);
  const [customSubcategoryInput, setCustomSubcategoryInput] = useState('');
  const subcategoryDropdownRef = useRef<HTMLDivElement>(null);

  const [formMolecules, setFormMolecules] = useState<MoleculeStrength[]>([{ name: '', strength: '' }]);
  const formIngredients = formMolecules.map((m) => m.name.trim()).filter(Boolean).join(' + ');
  const formDosage = formMolecules.map((m) => m.strength.trim()).filter(Boolean).join(', ');
  const [formPediatricDosage, setFormPediatricDosage] = useState('');
  const [formPresentation, setFormPresentation] = useState('');
  const [isPresentationDropdownOpen, setIsPresentationDropdownOpen] = useState(false);
  const [presentationSearchQuery, setPresentationSearchQuery] = useState('');
  const [isAddingCustomPresentation, setIsAddingCustomPresentation] = useState(false);
  const [customPresentationInput, setCustomPresentationInput] = useState('');
  const presentationDropdownRef = useRef<HTMLDivElement>(null);

  const [formIsDivisible, setFormIsDivisible] = useState(false);
  const [formPiecesPerBox, setFormPiecesPerBox] = useState<string | number>('');
  const [formPieceName, setFormPieceName] = useState('');
  const [formPiecePriceUSD, setFormPiecePriceUSD] = useState('');
  const [isPiecePriceManual, setIsPiecePriceManual] = useState(false);
  const [formForm, setFormForm] = useState('');
  const [isFormDropdownOpen, setIsFormDropdownOpen] = useState(false);
  const [formSearchQuery, setFormSearchQuery] = useState('');
  const [isAddingCustomForm, setIsAddingCustomForm] = useState(false);
  const [customFormInput, setCustomFormInput] = useState('');
  const formDropdownRef = useRef<HTMLDivElement>(null);

  // Agent / Distributor Dropdown State
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [isAddingCustomAgent, setIsAddingCustomAgent] = useState(false);
  const [customAgentInput, setCustomAgentInput] = useState('');
  const agentDropdownRef = useRef<HTMLDivElement>(null);

  const [formPriceLBP, setFormPriceLBP] = useState('');
  const [formPriceUSD, setFormPriceUSD] = useState('');
  const [formMargin, setFormMargin] = useState('20');
  const [formAgent, setFormAgent] = useState('Mersaco Sal');
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  
  const [formBatches, setFormBatches] = useState<{batchNumber: string, expiryDate: string, quantity?: number}[]>([{ batchNumber: '', expiryDate: '', quantity: 0 }]);

  // Scientific Fields (for Category: Drug)
  const [formIndications, setFormIndications] = useState('');
  const [formContraindications, setFormContraindications] = useState('');
  const [formSideEffects, setFormSideEffects] = useState('');
  const [formGenerics, setFormGenerics] = useState('');

  // Available subcategories for filtering based on current category
  const availableFilterSubcategories = useMemo(() => {
    return getSubcategoryOptions(selectedCategory, products, settings.customGlobalSubcategories);
  }, [selectedCategory, products, settings.customGlobalSubcategories]);

  // All subcategories for the active modal form (shows all subcategories with custom support)
  const allFormSubcategories = useMemo(() => {
    const list = getSubcategoryOptions('all', products, settings.customGlobalSubcategories);
    if (formSubcategory && !list.includes(formSubcategory)) {
      return [formSubcategory, ...list];
    }
    return list;
  }, [products, formSubcategory, settings.customGlobalSubcategories]);

  const filteredSubcategories = useMemo(() => {
    if (!subcategorySearchQuery.trim()) return allFormSubcategories;
    const q = subcategorySearchQuery.toLowerCase().trim();
    return allFormSubcategories.filter((s) => s.toLowerCase().includes(q));
  }, [allFormSubcategories, subcategorySearchQuery]);

  const handleSelectSubcategory = (sub: string) => {
    setFormSubcategory(sub);
    setIsSubcategoryDropdownOpen(false);
    setSubcategorySearchQuery('');
  };

  const handleAddCustomSubcategory = (newSub: string) => {
    const trimmed = newSub.trim();
    if (!trimmed) return;
    const currentCustom = settings.customGlobalSubcategories || [];
    if (!currentCustom.includes(trimmed)) {
      updateSettings({ customGlobalSubcategories: [...currentCustom, trimmed] });
    }
    handleSelectSubcategory(trimmed);
    setIsAddingCustomSubcategory(false);
    setCustomSubcategoryInput('');
  };

  // Smart suggestion for form subcategory
  const suggestedFormSubcategory = useMemo(() => {
    if (!formCategory) return '';
    return suggestSubcategory(formName, formCategory as ProductCategory, formIngredients);
  }, [formName, formCategory, formIngredients]);

  // 24 standard canonical forms + genuine custom forms from settings
  const allAvailableForms = useMemo(() => {
    return getStandardPharmaceuticalForms(settings.customForms);
  }, [settings.customForms]);

  const filteredForms = useMemo(() => {
    if (!formSearchQuery.trim()) return allAvailableForms;
    const q = formSearchQuery.toLowerCase().trim();
    return allAvailableForms.filter((f) => f.toLowerCase().includes(q));
  }, [allAvailableForms, formSearchQuery]);

  const handleSelectForm = (f: string) => {
    setFormForm(f);
    setIsFormDropdownOpen(false);
    setFormSearchQuery('');
  };

  const handleAddCustomForm = (newForm: string) => {
    const trimmed = newForm.trim();
    if (!trimmed) return;
    const normalized = normalizePharmaceuticalForm(trimmed);
    setFormForm(normalized);
    setIsAddingCustomForm(false);
    setCustomFormInput('');
    setIsFormDropdownOpen(false);
    setFormSearchQuery('');
    // If no new form other than the 24 standard forms, don't add anything to customForms
    if (!isCanonicalPharmaceuticalForm(normalized)) {
      const existing = settings.customForms || [];
      if (!existing.some((f) => f.toLowerCase() === normalized.toLowerCase())) {
        updateSettings({ customForms: [...existing, normalized] });
      }
    }
  };

  // Canonical presentation standards + custom presentations from settings
  const allAvailablePresentations = useMemo(() => {
    return getStandardPresentations(settings.customPresentations);
  }, [settings.customPresentations]);

  const filteredPresentations = useMemo(() => {
    if (!presentationSearchQuery.trim()) return allAvailablePresentations;
    const q = presentationSearchQuery.toLowerCase().trim();
    return allAvailablePresentations.filter((p) => p.toLowerCase().includes(q));
  }, [allAvailablePresentations, presentationSearchQuery]);

  const handleSelectPresentation = (p: string) => {
    setFormPresentation(p);
    setIsPresentationDropdownOpen(false);
    setPresentationSearchQuery('');
  };

  const handleAddCustomPresentation = (newPres: string) => {
    const trimmed = newPres.trim();
    if (!trimmed) return;
    setFormPresentation(trimmed);
    setIsAddingCustomPresentation(false);
    setCustomPresentationInput('');
    setIsPresentationDropdownOpen(false);
    setPresentationSearchQuery('');
    const existing = settings.customPresentations || [];
    if (!existing.includes(trimmed)) {
      updateSettings({ customPresentations: [...existing, trimmed] });
    }
  };

  // Click outside category/subcategory/form/presentation dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
      if (subcategoryDropdownRef.current && !subcategoryDropdownRef.current.contains(e.target as Node)) {
        setIsSubcategoryDropdownOpen(false);
      }
      if (formDropdownRef.current && !formDropdownRef.current.contains(e.target as Node)) {
        setIsFormDropdownOpen(false);
      }
      if (presentationDropdownRef.current && !presentationDropdownRef.current.contains(e.target as Node)) {
        setIsPresentationDropdownOpen(false);
      }
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target as Node)) {
        setIsAgentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Agent / Lebanese Distributor options
  const allAvailableAgents = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      if (s.name?.trim()) set.add(s.name.trim());
    });
    if (formAgent?.trim()) set.add(formAgent.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [suppliers, formAgent]);

  const filteredAgents = useMemo(() => {
    if (!agentSearchQuery.trim()) return allAvailableAgents;
    const q = agentSearchQuery.toLowerCase().trim();
    return allAvailableAgents.filter((a) => a.toLowerCase().includes(q));
  }, [allAvailableAgents, agentSearchQuery]);

  const handleSelectAgent = (agentName: string) => {
    setFormAgent(agentName);
    setIsAgentDropdownOpen(false);
    setAgentSearchQuery('');
  };

  const handleAddCustomAgent = (newAgent: string) => {
    const trimmed = newAgent.trim();
    if (!trimmed) return;
    const existing = suppliers.some((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      addSupplier({
        name: trimmed,
        code: `SUP-${Math.floor(100 + Math.random() * 900)}`,
        phone: '',
        email: '',
        address: 'Lebanon',
        contactPerson: '',
        paymentTerms: '30 Days Net',
        balanceUSD: 0,
        balanceLBP: 0,
      });
    }
    setFormAgent(trimmed);
    setIsAddingCustomAgent(false);
    setCustomAgentInput('');
    setIsAgentDropdownOpen(false);
    setAgentSearchQuery('');
  };

  const standardCategories: { value: ProductCategory; label: string }[] = useMemo(() => [
    { value: 'cosmetics', label: 'Cosmetics' },
    { value: 'drug', label: 'Drug' },
    { value: 'para', label: 'Para' },
    { value: 'vitamins', label: 'Vitamins' },
  ], []);

  const allCategoryOptions = useMemo(() => {
    const customList = (settings.customCategories || []).map((c) => ({ value: c as ProductCategory, label: c }));
    return [...standardCategories, ...customList].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    );
  }, [settings.customCategories, standardCategories]);

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return allCategoryOptions;
    const q = categorySearchQuery.toLowerCase().trim();
    return allCategoryOptions.filter((c) => c.label.toLowerCase().includes(q));
  }, [allCategoryOptions, categorySearchQuery]);

  const handleSelectCategory = (newCat: string) => {
    setFormCategory(newCat);
    setIsCategoryDropdownOpen(false);
    setCategorySearchQuery('');
    if (!formSubcategory) {
      const suggested = suggestSubcategory(formName, newCat as ProductCategory, formIngredients);
      if (suggested) setFormSubcategory(suggested);
    }
  };

  const handleAddCustomCategory = (newCatName: string) => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const currentCustom = settings.customCategories || [];
    if (!currentCustom.includes(trimmed) && !['drug', 'vitamins', 'cosmetics', 'para'].includes(trimmed.toLowerCase())) {
      updateSettings({ customCategories: [...currentCustom, trimmed] });
    }
    handleSelectCategory(trimmed);
    setIsAddingCustomCategory(false);
    setCustomCategoryInput('');
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchCat = selectedCategory === 'all' || prod.category === selectedCategory;
      const matchSubcat =
        selectedSubcategory === 'all' ||
        (prod.subcategory || '').trim().toLowerCase() === selectedSubcategory.trim().toLowerCase();
      const matchLow = !showLowStockOnly || prod.stockQuantity <= prod.minStockAlert;
      const q = debouncedSearchQuery.trim().toLowerCase();
      const rawExpiry = prod.expiryDate || prod.batches?.[0]?.expiryDate || '';
      const formattedExp = rawExpiry ? parseExpiryDate(rawExpiry).displayMMYYYY.toLowerCase() : '';
      const matchBatch = prod.batches?.some(
        (b) =>
          (b.batchNumber && b.batchNumber.toLowerCase().includes(q)) ||
          (b.expiryDate && (b.expiryDate.toLowerCase().includes(q) || parseExpiryDate(b.expiryDate).displayMMYYYY.toLowerCase().includes(q)))
      );
      const matchSearch =
        !q ||
        (prod.code || '').toLowerCase().includes(q) ||
        (prod.barcode || '').toLowerCase().includes(q) ||
        (prod.name || '').toLowerCase().includes(q) ||
        (prod.subcategory || '').toLowerCase().includes(q) ||
        (prod.presentation || '').toLowerCase().includes(q) ||
        (prod.ingredients || '').toLowerCase().includes(q) ||
        (prod.agent || '').toLowerCase().includes(q) ||
        rawExpiry.toLowerCase().includes(q) ||
        formattedExp.includes(q) ||
        matchBatch;
      return matchCat && matchSubcat && matchLow && matchSearch;
    });
  }, [products, selectedCategory, selectedSubcategory, showLowStockOnly, debouncedSearchQuery]);

  const sortedProducts = useMemo(() => {
    let sortableItems = [...filteredProducts];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key === 'expiryDate') {
          const rawA = a.expiryDate || a.batches?.[0]?.expiryDate || '';
          const rawB = b.expiryDate || b.batches?.[0]?.expiryDate || '';
          const timeA = parseExpiryDate(rawA).date?.getTime() || 0;
          const timeB = parseExpiryDate(rawB).date?.getTime() || 0;
          return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
        }

        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];
        
        // Handle undefined or null for safe comparison
        if (aValue === undefined || aValue === null) aValue = '';
        if (bValue === undefined || bValue === null) bValue = '';

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredProducts, sortConfig]);

  // Selected Products List
  const selectedProductsList = useMemo(() => {
    return products.filter((p) => selectedProductIds.has(p.id));
  }, [products, selectedProductIds]);

  // Pre-compute price change info per product (avoids running inside every row render)
  const priceChangeInfo = useMemo(() => {
    const map = new Map<string, { usd?: ReturnType<typeof getPriceChangeInfoUSD>; lbp?: ReturnType<typeof getPriceChangeInfoLBP> }>();
    for (const p of sortedProducts) {
      map.set(p.id, { usd: getPriceChangeInfoUSD(p), lbp: getPriceChangeInfoLBP(p) });
    }
    return map;
  }, [sortedProducts]);

  // Virtualization for the stock table (renders only visible rows)
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: sortedProducts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  const rowVirtualItems = rowVirtualizer.getVirtualItems();

  const allFilteredSelected =
    sortedProducts.length > 0 && sortedProducts.every((p) => selectedProductIds.has(p.id));
  const someFilteredSelected =
    sortedProducts.some((p) => selectedProductIds.has(p.id)) && !allFilteredSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someFilteredSelected;
    }
  }, [someFilteredSelected]);

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        sortedProducts.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        sortedProducts.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      sortedProducts.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedProductIds(new Set());
    setLastClickedIndex(null);
  };

  const handleToggleRowSelect = (id: string, index: number, isShift: boolean) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (isShift && lastClickedIndex !== null) {
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        for (let i = start; i <= end; i++) {
          const item = sortedProducts[i];
          if (item) next.add(item.id);
        }
      } else {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
    setLastClickedIndex(index);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        selectedProductIds.size > 0 &&
        !isBulkEditModalOpen &&
        !isBulkDeleteModalOpen
      ) {
        setSelectedProductIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProductIds.size, isBulkEditModalOpen, isBulkDeleteModalOpen]);

  const hasAddFormFilledData = useCallback(() => {
    if (editingProductId) {
      return false;
    }
    if (formName.trim() !== '') return true;
    if (formBarcode.trim() !== '') return true;
    if (formDosage.trim() !== '') return true;
    if (formPediatricDosage.trim() !== '') return true;
    if (formPresentation.trim() !== '') return true;
    if (formSubcategory.trim() !== '') return true;
    if (formIngredients.trim() !== '') return true;
    if (formPriceLBP.trim() !== '' && formPriceLBP.trim() !== '0') return true;
    if (formPriceUSD.trim() !== '' && formPriceUSD.trim() !== '0' && formPriceUSD.trim() !== '0.00') return true;
    if (formIsDivisible) return true;
    if (formPiecesPerBox !== '' && formPiecesPerBox !== 0) return true;
    if (formPieceName.trim() !== '') return true;
    if (formPiecePriceUSD.trim() !== '') return true;
    if (formCode.trim() !== '') return true;
    if (formBatches.length > 0 && formBatches.some((b) => !!b.batchNumber?.trim() || !!b.expiryDate?.trim() || (b.quantity && b.quantity > 0))) return true;
    if (
      formIndications.trim() !== '' ||
      formContraindications.trim() !== '' ||
      formSideEffects.trim() !== '' ||
      formGenerics.trim() !== ''
    ) return true;
    if (formCategory !== 'drug') return true;
    if (formForm.trim() !== '') return true;
    if (suppliers.length > 0 && formAgent !== suppliers[0]?.name) return true;

    return false;
  }, [
    editingProductId,
    formName,
    formBarcode,
    formDosage,
    formPediatricDosage,
    formPresentation,
    formSubcategory,
    formIngredients,
    formPriceLBP,
    formPriceUSD,
    formIsDivisible,
    formPiecesPerBox,
    formPieceName,
    formPiecePriceUSD,
    formCode,
    formBatches,
    formIndications,
    formContraindications,
    formSideEffects,
    formGenerics,
    formCategory,
    formForm,
    formAgent,
    suppliers
  ]);

  const handleRequestCloseEditModal = useCallback(() => {
    if (!editingProductId && hasAddFormFilledData()) {
      setShowDiscardConfirmModal(true);
      return;
    }
    setIsEditModalOpen(false);
  }, [editingProductId, hasAddFormFilledData]);

  const openAddModal = () => {
    restoreWindow('stock-product-modal');
    restoreWindow('stock_add_new_inventory_item');
    restoreWindow('add-stock-product-window');
    restoreWindow('add new item');
    restoreSectionWindows('stock');
    if (isEditModalOpen && !editingProductId) {
      return;
    }
    setEditingProductId(null);
    setFormCode('');
    setFormBarcode('');
    setFormName('');
    setFormCategory('');
    setIsCategoryDropdownOpen(false);
    setCategorySearchQuery('');
    setIsAddingCustomCategory(false);
    setCustomCategoryInput('');
    setFormSubcategory('');
    setIsSubcategoryDropdownOpen(false);
    setSubcategorySearchQuery('');
    setIsAddingCustomSubcategory(false);
    setCustomSubcategoryInput('');
    setFormMolecules([{ name: '', strength: '' }]);
    setFormPediatricDosage('');
    setFormPresentation('');
    setIsPresentationDropdownOpen(false);
    setPresentationSearchQuery('');
    setIsAddingCustomPresentation(false);
    setCustomPresentationInput('');
    setFormIsDivisible(false);
    setFormPiecesPerBox('');
    setFormPieceName('');
    setFormPiecePriceUSD('');
    setIsPiecePriceManual(false);
    setFormForm('');
    setIsFormDropdownOpen(false);
    setFormSearchQuery('');
    setIsAddingCustomForm(false);
    setCustomFormInput('');
    setFormPriceLBP('');
    setFormPriceUSD('');
    setFormMargin('20');
    setFormAgent('');
    setIsAgentDropdownOpen(false);
    setAgentSearchQuery('');
    setIsAddingCustomAgent(false);
    setCustomAgentInput('');
    setFormBatches([]);
    setFormIndications('');
    setFormContraindications('');
    setFormSideEffects('');
    setFormGenerics('');
    setShowDiscardConfirmModal(false);
    setIsEditModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    restoreWindow('stock-product-modal');
    restoreWindow('stock_edit_pharmacy_item');
    restoreWindow('edit pharmacy item');
    restoreSectionWindows('stock');
    setShowDiscardConfirmModal(false);
    setEditingProductId(prod.id);
    setFormCode(prod.code);
    setFormBarcode(prod.barcode || '');
    setFormName(prod.name);
    setFormCategory(prod.category);
    setIsCategoryDropdownOpen(false);
    setCategorySearchQuery('');
    setIsAddingCustomCategory(false);
    setCustomCategoryInput('');
    setFormSubcategory(prod.subcategory || '');
    setIsSubcategoryDropdownOpen(false);
    setSubcategorySearchQuery('');
    setIsAddingCustomSubcategory(false);
    setCustomSubcategoryInput('');
    setFormMolecules(splitProductMolecule(prod));
    setFormPediatricDosage(prod.scientificInfo?.pediatricDosage || '');
    setFormPresentation(prod.presentation);
    setIsPresentationDropdownOpen(false);
    setPresentationSearchQuery('');
    setIsAddingCustomPresentation(false);
    setCustomPresentationInput('');
    setFormIsDivisible(prod.isDivisible || false);
    setFormPiecesPerBox(prod.piecesPerBox || '');
    setFormPieceName(prod.pieceName || '');
    setFormPiecePriceUSD(prod.piecePriceUSD ? prod.piecePriceUSD.toString() : '');
    setIsPiecePriceManual(!!prod.piecePriceUSD);
    setFormForm(prod.form ? normalizePharmaceuticalForm(prod.form) : '');
    setIsFormDropdownOpen(false);
    setFormSearchQuery('');
    setIsAddingCustomForm(false);
    setCustomFormInput('');
    setFormPriceLBP(prod.priceLBP.toString());
    setFormPriceUSD(prod.priceUSD.toString());
    setFormMargin(prod.pharmacistMarginProfit.toString());
    setFormAgent(prod.agent);
    setIsAgentDropdownOpen(false);
    setAgentSearchQuery('');
    setIsAddingCustomAgent(false);
    setCustomAgentInput('');
    const resolved = resolveProductBatches(prod, purchases);
    if (resolved && resolved.length > 0) {
      setFormBatches(resolved.map(b => ({ batchNumber: b.batchNumber, expiryDate: b.expiryDate, quantity: b.quantity })));
    } else if (prod.batches && prod.batches.length > 0) {
      setFormBatches(JSON.parse(JSON.stringify(prod.batches)));
    } else {
      setFormBatches([{ batchNumber: prod.batchNumber || '', expiryDate: prod.expiryDate || '', quantity: prod.stockQuantity || 0 }]);
    }

    if (prod.scientificInfo) {
      setFormIndications(prod.scientificInfo.indications || '');
      setFormContraindications(prod.scientificInfo.contraindications || '');
      setFormSideEffects(prod.scientificInfo.sideEffects || '');
      setFormGenerics(prod.scientificInfo.generics?.join(', ') || '');
    } else {
      setFormIndications('');
      setFormContraindications('');
      setFormSideEffects('');
      setFormGenerics('');
    }
    setIsEditModalOpen(true);
  };

  const handleAutoFetchScientificData = async () => {
    const term = formIngredients.trim();
    if (!term) {
      addNotification(
        'Active Ingredient Required',
        'Please define the active ingredient first before fetching scientific data.',
        'inventory',
        'warning'
      );
      return;
    }
    setIsFetchingScientifics(true);
    try {
      const res = await searchScientificDataOnline(term, formName.trim());
      if (res && res.scientificInfo) {
        setFormIndications(res.scientificInfo.indications || '');
        setFormContraindications(res.scientificInfo.contraindications || '');
        setFormSideEffects(res.scientificInfo.sideEffects || '');
        if (res.inStockAlternatives && res.inStockAlternatives.length > 0) {
          setFormGenerics(
            res.inStockAlternatives.map((a) => `${a.name} (${a.stockQuantity} in stock)`).join(', ')
          );
        } else if (res.scientificInfo.generics && res.scientificInfo.generics.length > 0) {
          setFormGenerics(res.scientificInfo.generics.join(', '));
        }
        if (!formDosage && res.scientificInfo.dosage) {
          setFormMolecules((prev) => {
            if (prev.length === 0) return [{ name: '', strength: res.scientificInfo.dosage || '' }];
            return prev.map((m, i) => (i === 0 && !m.strength.trim() ? { ...m, strength: res.scientificInfo.dosage || '' } : m));
          });
        }
        if (!formPediatricDosage && res.scientificInfo.pediatricDosage) {
          setFormPediatricDosage(res.scientificInfo.pediatricDosage);
        }
        if (!formForm && res.scientificInfo.form) {
          setFormForm(res.scientificInfo.form);
        }
        // Note: presentation is strictly imported from CSV or defined by user in the form
      }
    } finally {
      setIsFetchingScientifics(false);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const priceLBP = parseFloat(formPriceLBP.replace(/[^\d.]/g, '')) || 0;
    const priceUSD = parseFloat(formPriceUSD) || Number((priceLBP / exchangeRate).toFixed(2));
    const margin = parseFloat(formMargin) || 20;
    const costPriceUSD = Number((priceUSD * (1 - margin / 100)).toFixed(2));
    const existingProduct = editingProductId ? products.find((p) => p.id === editingProductId) : null;
    const stockQuantity = existingProduct ? existingProduct.stockQuantity : 0;
    const minStockAlert = existingProduct ? existingProduct.minStockAlert : 0;
    const expiryDate = formBatches.length > 0 ? formBatches[0].expiryDate : '';
    const batchNumber = formBatches.length > 0 ? formBatches[0].batchNumber : '';
    const batches = [...formBatches];
    const resolvedCode = formCode.trim().toUpperCase();
    const resolvedCat = (formCategory || 'drug') as ProductCategory;
    const molecules = formMolecules
      .filter((m) => m.name.trim())
      .map((m) => ({ name: m.name.trim(), strength: m.strength.trim() }));

    let scientificInfo: ScientificDrugInfo | undefined = undefined;
    if (resolvedCat === 'drug') {
       const baseProd: Product = {
         id: editingProductId || 'temp',
         code: resolvedCode,
         barcode: formBarcode.trim(),
         name: formName.trim(),
         category: resolvedCat,
         subcategory: formSubcategory.trim() || undefined,
         ingredients: formIngredients,
         dosage: formDosage,
         molecules,
         presentation: formPresentation,
         form: formForm,
         isDivisible: formIsDivisible,
         piecesPerBox: formIsDivisible ? Number(formPiecesPerBox) || 0 : undefined,
         pieceName: formIsDivisible ? formPieceName : undefined,
         piecePriceUSD: formIsDivisible && formPiecePriceUSD ? Number(formPiecePriceUSD) : undefined,
         priceLBP,
         priceUSD,
         costPriceUSD,
         pharmacistMarginProfit: margin,
         agent: formAgent,
         stockQuantity,
         minStockAlert,
         expiryDate,
         batchNumber,
         scientificInfo: existingProduct?.scientificInfo,
         updatedAt: Date.now(),
         version: 1,
       };
       scientificInfo = resolveStraightforwardScientificInfo(baseProd);
    }

    if (editingProductId) {
      updateProduct(editingProductId, {
        code: resolvedCode,
        barcode: formBarcode.trim(),
        name: formName.trim(),
        category: resolvedCat,
        subcategory: formSubcategory.trim() || undefined,
        ingredients: formIngredients,
        dosage: formDosage,
        molecules,
        presentation: formPresentation,
        form: formForm ? normalizePharmaceuticalForm(formForm) : 'Tablet',
        isDivisible: formIsDivisible,
        piecesPerBox: formIsDivisible ? Number(formPiecesPerBox) || 0 : undefined,
        pieceName: formIsDivisible ? formPieceName : undefined,
         piecePriceUSD: formIsDivisible && formPiecePriceUSD ? Number(formPiecePriceUSD) : undefined,
        priceLBP,
        priceUSD,
        costPriceUSD,
        pharmacistMarginProfit: margin,
        agent: formAgent,
        stockQuantity,
        minStockAlert,
        expiryDate,
        batchNumber,
        batches,
        scientificInfo,
      });
    } else {
      addProduct({
        code: resolvedCode,
        barcode: formBarcode.trim(),
        name: formName.trim(),
        category: resolvedCat,
        subcategory: formSubcategory.trim() || undefined,
        ingredients: formIngredients,
        dosage: formDosage,
        molecules,
        presentation: formPresentation,
        form: formForm ? normalizePharmaceuticalForm(formForm) : 'Tablet',
        isDivisible: formIsDivisible,
        piecesPerBox: formIsDivisible ? Number(formPiecesPerBox) || 0 : undefined,
        pieceName: formIsDivisible ? formPieceName : undefined,
         piecePriceUSD: formIsDivisible && formPiecePriceUSD ? Number(formPiecePriceUSD) : undefined,
        priceLBP,
        priceUSD,
        costPriceUSD,
        pharmacistMarginProfit: margin,
        agent: formAgent,
        stockQuantity,
        minStockAlert,
        expiryDate,
        batchNumber,
        batches,
        scientificInfo,
      });
    }

    setIsEditModalOpen(false);
  };

  const handleExportStockCSV = useCallback(() => {
    const escapeCsvCell = (value: string): string => {
      if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
      return value;
    };
    const headers = ['code', 'Name', 'Ingredients', 'Dosage', 'Presentation', 'Form', 'Category', 'Subcategory', 'Barcode', 'Price in LBP', 'Price USD', 'Cost Price USD', 'Pharmacist Margin', 'Agent', 'Stock Quantity', 'Min Stock Alert', 'Expiry Date', 'Batch Number', 'Batches (JSON)', 'Is Divisible', 'Pieces Per Box', 'Piece Name', 'Piece Price USD'];
    const rows = products.map((p) => [
      String(p.code || ''),
      p.name || '',
      p.ingredients || '',
      p.dosage || '',
      p.presentation || '',
      p.form || '',
      p.category || '',
      p.subcategory || '',
      p.barcode || '',
      p.priceLBP > 0 ? String(Math.round(p.priceLBP)) : '',
      p.priceUSD > 0 ? p.priceUSD.toFixed(2) : '',
      p.costPriceUSD != null && p.costPriceUSD > 0 ? p.costPriceUSD.toFixed(2) : '',
      p.pharmacistMarginProfit != null ? String(p.pharmacistMarginProfit) : '',
      p.agent || '',
      String(p.stockQuantity ?? 0),
      String(p.minStockAlert ?? 5),
      p.expiryDate || '',
      p.batchNumber || '',
      JSON.stringify(p.batches || []),
      p.isDivisible != null ? String(p.isDivisible) : '',
      p.piecesPerBox != null ? String(p.piecesPerBox) : '',
      p.pieceName || '',
      p.piecePriceUSD != null ? p.piecePriceUSD.toFixed(2) : '',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmalebanon_stock_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [products]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#f8fafc] dark:bg-slate-950 select-none">
      {/* Main Inventory Table Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header & Quick Action Ribbon */}
        <div className="p-3 bg-gray-50 dark:bg-slate-900 flex justify-between items-center border-b border-gray-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <SectionRestoreButton section="stock" />
            <Boxes className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h2 className="font-bold text-gray-700 dark:text-gray-200 text-sm uppercase tracking-wider">
              Inventory Management
            </h2>
            <span className="text-xs text-gray-400">({filteredProducts.length} items)</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedProductIds.size === 0) {
                  handleSelectAllFiltered();
                }
                restoreWindow('stock_bulk_edit_inventory_items');
                restoreWindow('bulk_edit');
                setIsBulkEditModalOpen(true);
              }}
              className={`text-xs border px-2.5 py-1 rounded cursor-pointer font-medium flex items-center gap-1.5 transition-colors shadow-2xs ${
                selectedProductIds.size > 0
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold'
                  : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200'
              }`}
              title="Bulk edit inventory items (prices, quantities, categories, agent, packaging)"
            >
              <Layers className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span>
                {selectedProductIds.size > 0
                  ? `Bulk Edit (${selectedProductIds.size})`
                  : 'Bulk Edit Stock'}
              </span>
            </button>
            <button
              onClick={() => {
                restoreWindow('confirm_global_stock_clearance');
                setIsDeleteAllModalOpen(true);
              }}
              disabled={products.length === 0}
              className="text-xs border border-rose-300 dark:border-rose-800/60 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded cursor-pointer font-medium text-rose-700 dark:text-rose-300 flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Delete and remove all stock items completely"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              <span>Delete All Stock</span>
            </button>
            <button
              onClick={clearPriceChangeIndicators}
              className="text-xs border border-gray-300 dark:border-slate-700 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded cursor-pointer font-medium text-gray-700 dark:text-gray-200"
              title="Clear all arrows and percentage changes beside prices"
            >
              Clear Price Indicators
            </button>
            <button
              onClick={() => {
                restoreWindow('bulk_inventory_csv_import');
                onOpenCSVImport();
              }}
              className="text-xs border border-gray-300 dark:border-slate-700 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded cursor-pointer font-medium text-gray-700 dark:text-gray-200"
            >
              Import CSV
            </button>
            <button
              onClick={handleExportStockCSV}
              className="text-xs border border-gray-300 dark:border-slate-700 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded cursor-pointer font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1.5"
              title="Export the full stock list with all product details to a CSV file (re-importable via Import CSV)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Export CSV
            </button>
            <button
              onClick={() => {
                restoreWindow('moph_official_drug_price_list');
                restoreWindow('moph');
                onOpenMOPHUpdater();
              }}
              className="text-xs border border-teal-300 dark:border-teal-700/60 px-2.5 py-1 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 rounded cursor-pointer font-medium text-teal-700 dark:text-teal-300 flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Update prices directly from the official MOPH price list"
            >
              <Globe className="h-3.5 w-3.5" />
              Update from MOPH
            </button>
            <button
              onClick={() => {
                setSelectedProductCode('');
                restoreWindow('stock_update_drug_price_by_code');
                restoreWindow('update_drug_price');
                setIsPriceModalOpen(true);
              }}
              className="text-xs border border-gray-300 dark:border-slate-700 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded cursor-pointer font-medium text-gray-700 dark:text-gray-200"
            >
              Update Price [F4]
            </button>
            <button
              onClick={openAddModal}
              className="bg-teal-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-teal-700 cursor-pointer shadow-2xs"
            >
              + Add Item
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-2.5 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-slate-800 text-xs shrink-0">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              id="input-stock-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchQuery) {
                  e.preventDefault();
                  setSearchQuery('');
                }
              }}
              placeholder="Search by Barcode, Code, Name, Agent..."
              className="border border-gray-300 dark:border-slate-700 rounded pl-8 pr-8 py-1 w-full focus:outline-hidden focus:ring-1 focus:ring-teal-500 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
            {searchQuery && (
              <button
                type="button"
                id="btn-clear-stock-search"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer rounded transition-colors"
                title="Clear input"
                aria-label="Clear input"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs & Subcategory Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {(['all', 'drug', 'vitamins', 'cosmetics', 'para', ...(settings.customCategories || [])] as any[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSelectedSubcategory('all');
                  }}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase transition-colors ${
                    selectedCategory === cat
                      ? 'bg-teal-700 text-white shadow-2xs'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {cat === 'all' ? 'All Stock' : cat}
                </button>
              ))}
            </div>

            {/* Subcategory Filter Dropdown */}
            <div className="flex items-center gap-1">
              <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                className={`border rounded px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-hidden focus:ring-1 focus:ring-teal-500 max-w-[170px] truncate ${
                  selectedSubcategory !== 'all'
                    ? 'border-teal-500 bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-200 font-bold'
                    : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300'
                }`}
                title="Filter by Subcategory"
              >
                <option value="all">
                  {selectedCategory === 'all' ? 'All Subcategories' : `All ${selectedCategory} subcategories`}
                </option>
                {availableFilterSubcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
              {selectedSubcategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedSubcategory('all')}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 cursor-pointer"
                  title="Clear subcategory filter"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                showLowStockOnly
                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                  : 'border-gray-200 text-gray-600 dark:border-slate-700 dark:text-gray-300 hover:bg-gray-50'
              }`}
            >
              Low Stock Only
            </button>
          </div>
        </div>

        {/* Bulk Selection Notification Bar */}
        {selectedProductIds.size > 0 && (
          <div className="px-3 py-2 bg-teal-50/90 dark:bg-teal-950/70 border-b border-teal-200 dark:border-teal-800/60 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center bg-teal-600 text-white font-bold px-2 py-0.5 rounded text-[11px] shadow-2xs">
                {selectedProductIds.size} Selected
              </span>
              <span className="text-teal-950 dark:text-teal-100 font-medium">
                out of {sortedProducts.length} items in current view
              </span>
              {selectedProductIds.size < sortedProducts.length && (
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-teal-700 dark:text-teal-300 hover:underline font-semibold text-[11px] cursor-pointer ml-1"
                >
                  Select All Filtered ({sortedProducts.length})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBulkEditModalOpen(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Bulk Edit ({selectedProductIds.size})</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60 px-2.5 py-1 rounded font-medium flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                title="Delete all selected items"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                <span>Delete Selected</span>
              </button>

              <button
                type="button"
                onClick={handleClearSelection}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 px-2 py-1 text-xs font-medium cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* High-Density Stock Table - Purchase View Style */}
        <div className="p-3 flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 w-full overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/40 shadow-sm flex flex-col">
            <div ref={parentRef} className="flex-1 w-full overflow-auto">
              <table className="w-max min-w-full text-left border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: colWidths.select }} />
                  <col style={{ width: colWidths.code }} />
                  <col style={{ width: colWidths.barcode }} />
                  <col style={{ width: colWidths.name }} />
                  <col style={{ width: colWidths.presentation }} />
                  <col style={{ width: colWidths.category }} />
                  <col style={{ width: colWidths.priceUSD }} />
                  <col style={{ width: colWidths.priceLBP }} />
                  <col style={{ width: colWidths.stockQuantity }} />
                  <col style={{ width: colWidths.expiryDate }} />
                  <col style={{ width: colWidths.agent }} />
                  <col style={{ width: colWidths.actions }} />
                </colgroup>
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="p-1 pb-1.5 px-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap relative group border-r border-slate-200 dark:border-slate-800 select-none">
                      <input
                        type="checkbox"
                        title={allFilteredSelected ? 'Deselect all in view' : 'Select all in view'}
                        checked={allFilteredSelected}
                        ref={headerCheckboxRef}
                        onChange={handleToggleSelectAll}
                        className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5 cursor-pointer align-middle"
                      />
                      <div
                        onMouseDown={(e) => handleColResizeStart(e, 'select')}
                        className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500/80 transition-colors z-10"
                        title="Drag to resize"
                      />
                    </th>
                    {[
                      { id: 'code', label: 'Code', sortKey: 'code' as SortKey },
                      { id: 'barcode', label: 'Barcode', sortKey: 'barcode' as SortKey },
                      { id: 'name', label: 'Name', sortKey: 'name' as SortKey },
                      { id: 'presentation', label: 'Presentation', sortKey: 'presentation' as SortKey, elemId: 'th-stock-presentation' },
                      { id: 'category', label: 'Category', sortKey: 'category' as SortKey },
                      { id: 'priceUSD', label: 'Price ($)', sortKey: 'priceUSD' as SortKey, align: 'right' },
                      { id: 'priceLBP', label: 'Price (LBP)', align: 'right' },
                      { id: 'stockQuantity', label: 'Qty', sortKey: 'stockQuantity' as SortKey, align: 'center' },
                      { id: 'expiryDate', label: 'Expiry', sortKey: 'expiryDate' as SortKey },
                      { id: 'agent', label: 'Agent', sortKey: 'agent' as SortKey },
                    ].map((col) => (
                      <th
                        key={col.id}
                        id={col.elemId}
                        className={`p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap relative group border-r border-slate-200 dark:border-slate-800 select-none ${
                          col.sortKey ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors' : ''
                        } ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                        onClick={col.sortKey ? () => handleSort(col.sortKey!) : undefined}
                      >
                        <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                          {col.align === 'right' && col.sortKey && <ArrowUpDown className="h-2.5 w-2.5 shrink-0 opacity-60" />}
                          <span className="truncate">{col.label}</span>
                          {col.align !== 'right' && col.sortKey && <ArrowUpDown className="h-2.5 w-2.5 shrink-0 opacity-60" />}
                        </div>
                        <div
                          onMouseDown={(e) => handleColResizeStart(e, col.id)}
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500/80 transition-colors z-10"
                          title="Drag to resize"
                        />
                      </th>
                    ))}
                    <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap text-right relative group select-none">
                      <span className="truncate">Actions</span>
                      <div
                        onMouseDown={(e) => handleColResizeStart(e, 'actions')}
                        className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500/80 transition-colors z-10"
                        title="Drag to resize"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-gray-400 text-xs">
                    No items found matching the current criteria.
                  </td>
                </tr>
              ) : (
                <>
                  {rowVirtualItems.length > 0 && rowVirtualItems[0].start > 0 && (
                    <tr>
                      <td style={{ height: `${rowVirtualItems[0].start}px`, padding: 0, border: 'none' }} colSpan={12} />
                    </tr>
                  )}
                  {rowVirtualItems.map((virtualRow) => {
                    const prod = sortedProducts[virtualRow.index];
                    const change = priceChangeInfo.get(prod.id);
                    return (
                      <StockTableRow
                        key={prod.id}
                        ref={rowVirtualizer.measureElement}
                        dataIndex={virtualRow.index}
                        prod={prod}
                        purchases={purchases}
                        index={virtualRow.index}
                        isSelected={selectedStockProduct?.id === prod.id}
                        isRowSelected={selectedProductIds.has(prod.id)}
                        changeUSD={change?.usd}
                        changeLBP={change?.lbp}
                        onToggleRowSelect={handleToggleRowSelect}
                        onOpenDetails={(p) => {
                          setSelectedStockProduct(p);
                          restoreWindow('stock_drug_intelligence_details');
                          restoreWindow('drug_intelligence');
                          setIsDetailsModalOpen(true);
                        }}
                        onOpenPrice={(code) => {
                          setSelectedProductCode(code);
                          restoreWindow('stock_update_drug_price_by_code');
                          restoreWindow('update_drug_price');
                          setIsPriceModalOpen(true);
                        }}
                        onViewScientific={onViewScientific}
                        onEdit={openEditModal}
                        onFilterSubcategory={(subcat) => setSelectedSubcategory(subcat)}
                      />
                    );
                  })}
                  {rowVirtualItems.length > 0 &&
                    rowVirtualizer.getTotalSize() - (rowVirtualItems[rowVirtualItems.length - 1]?.end || 0) > 0 && (
                    <tr>
                      <td
                        style={{
                          height: `${rowVirtualizer.getTotalSize() - (rowVirtualItems[rowVirtualItems.length - 1]?.end || 0)}px`,
                          padding: 0,
                          border: 'none',
                        }}
                        colSpan={12}
                      />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

      {/* Price Updater Modal */}
      {isPriceModalOpen && (
        <PriceUpdaterModal
          initialCode={selectedProductCode}
          onClose={() => setIsPriceModalOpen(false)}
        />
      )}

      {/* Add / Edit Product Modal */}
      {isEditModalOpen && (
        <DesktopWindow
          id="stock-product-modal"
          title={editingProductId ? 'Edit Pharmacy Item' : 'Add New Inventory Item'}
          isOpen={true}
          section="stock"
          onClose={handleRequestCloseEditModal}
          width="700px"
          height="85vh"
        >
          <form
            onSubmit={handleSaveProduct}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                handleRequestCloseEditModal();
              }
            }}
            className="p-6 space-y-4 flex-1 overflow-y-auto text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold not-italic text-slate-700 dark:text-slate-300 mb-1">
                  Item Code
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-normal uppercase focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Barcode
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    id="input-stock-barcode"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-9 py-2 font-mono font-normal focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    id="btn-generate-barcode"
                    onClick={() => setFormBarcode(generateRandomBarcode())}
                    title="Generate random barcode"
                    aria-label="Generate random barcode"
                    className="absolute right-1.5 p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-md transition-colors cursor-pointer"
                  >
                    <Dices className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-left text-slate-700 dark:text-slate-300 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Requirement 21: Category Selection (drug, vitamins, cosmetics, para) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative" ref={categoryDropdownRef}>
                <label className="block font-bold leading-4 text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>

                {/* Backwards-compatible select for form DOM query compatibility */}
                <select
                  value={formCategory}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setIsAddingCustomCategory(true);
                      setIsCategoryDropdownOpen(false);
                    } else {
                      handleSelectCategory(val);
                    }
                  }}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <option value="" className="text-slate-400">Choose Category</option>
                  {allCategoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                  <option value="custom">Custom Category</option>
                </select>

                {/* Searchable Combobox Trigger */}
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryDropdownOpen((prev) => !prev);
                    setCategorySearchQuery('');
                  }}
                  className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs normal-case flex items-center justify-between focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 cursor-pointer ${
                    !formCategory
                      ? 'text-slate-400 dark:text-slate-500 font-normal'
                      : 'text-slate-800 dark:text-slate-100 font-normal'
                  }`}
                >
                  <span className="truncate normal-case">
                    {allCategoryOptions.find((c) => c.value === formCategory)?.label || (formCategory ? formCategory : 'Choose Category')}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Searchable Dropdown Menu */}
                {isCategoryDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    {/* Search by typing */}
                    <div className="p-1.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
                      <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search category..."
                          value={categorySearchQuery}
                          onChange={(e) => setCategorySearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (filteredCategories.length > 0) {
                                handleSelectCategory(filteredCategories[0].value);
                              } else if (categorySearchQuery.trim()) {
                                handleAddCustomCategory(categorySearchQuery.trim());
                              }
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setIsCategoryDropdownOpen(false);
                            }
                          }}
                          className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Custom Category Button (at top) */}
                    <div className="border-b border-slate-100 dark:border-slate-700/60 p-1 bg-slate-50/50 dark:bg-slate-800/40">
                      {categorySearchQuery.trim() && !allCategoryOptions.some((c) => c.label.toLowerCase() === categorySearchQuery.trim().toLowerCase()) ? (
                        <button
                          type="button"
                          onClick={() => handleAddCustomCategory(categorySearchQuery.trim())}
                          className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add "{categorySearchQuery.trim()}" as Category</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingCustomCategory(true);
                            setIsCategoryDropdownOpen(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Custom Category</span>
                        </button>
                      )}
                    </div>

                    {/* Options list */}
                    <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                      {filteredCategories.map((cat) => {
                        const isSelected = formCategory === cat.value;
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => handleSelectCategory(cat.value)}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span>{cat.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                          </button>
                        );
                      })}

                      {filteredCategories.length === 0 && (
                        <div className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                          No categories found
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Inline custom category input */}
                {isAddingCustomCategory && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Enter new category name..."
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (customCategoryInput.trim()) {
                            handleAddCustomCategory(customCategoryInput.trim());
                          }
                        } else if (e.key === 'Escape') {
                          setIsAddingCustomCategory(false);
                          setCustomCategoryInput('');
                        }
                      }}
                      className="flex-1 rounded-lg border border-emerald-500 bg-white px-3 py-1.5 text-xs font-medium focus:outline-hidden dark:border-emerald-400 dark:bg-slate-900 dark:text-slate-100 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customCategoryInput.trim()) {
                          handleAddCustomCategory(customCategoryInput.trim());
                        }
                      }}
                      disabled={!customCategoryInput.trim()}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCustomCategory(false);
                        setCustomCategoryInput('');
                      }}
                      className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

            {/* Subcategory */}
            <div className="relative" ref={subcategoryDropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold leading-4 text-slate-700 dark:text-slate-300">
                  Subcategory
                </label>
                {suggestedFormSubcategory && suggestedFormSubcategory !== formSubcategory && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSubcategory(suggestedFormSubcategory);
                    }}
                    className="text-[10px] text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold underline cursor-pointer truncate max-w-[130px]"
                    title={`Click to apply suggestion: ${suggestedFormSubcategory}`}
                  >
                    Suggest: {suggestedFormSubcategory}
                  </button>
                )}
              </div>

              {/* Backwards-compatible select for form DOM query compatibility */}
              <select
                value={formSubcategory}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setIsAddingCustomSubcategory(true);
                    setIsSubcategoryDropdownOpen(false);
                  } else {
                    handleSelectSubcategory(val);
                  }
                }}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                <option value="" className="text-slate-400">Choose Subcategory</option>
                {allFormSubcategories.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
                <option value="custom">Custom Subcategory</option>
              </select>

              {/* Searchable Combobox Trigger */}
              <button
                type="button"
                onClick={() => {
                  setIsSubcategoryDropdownOpen((prev) => !prev);
                  setSubcategorySearchQuery('');
                }}
                className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs normal-case flex items-center justify-between focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 cursor-pointer ${
                  !formSubcategory
                    ? 'text-slate-400 dark:text-slate-500 font-normal'
                    : 'text-slate-800 dark:text-slate-100 font-normal'
                }`}
              >
                <span className="truncate normal-case">
                  {formSubcategory || 'Choose Subcategory'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isSubcategoryDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Searchable Dropdown Menu */}
              {isSubcategoryDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  {/* Search by typing */}
                  <div className="p-1.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search subcategory..."
                        value={subcategorySearchQuery}
                        onChange={(e) => setSubcategorySearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (filteredSubcategories.length > 0) {
                              handleSelectSubcategory(filteredSubcategories[0]);
                            } else if (subcategorySearchQuery.trim()) {
                              handleAddCustomSubcategory(subcategorySearchQuery.trim());
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setIsSubcategoryDropdownOpen(false);
                          }
                        }}
                        className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Custom Subcategory Button (at top) */}
                  <div className="border-b border-slate-100 dark:border-slate-700/60 p-1 bg-slate-50/50 dark:bg-slate-800/40">
                    {subcategorySearchQuery.trim() && !allFormSubcategories.some((s) => s.toLowerCase() === subcategorySearchQuery.trim().toLowerCase()) ? (
                      <button
                        type="button"
                        onClick={() => handleAddCustomSubcategory(subcategorySearchQuery.trim())}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add "{subcategorySearchQuery.trim()}" as Subcategory</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCustomSubcategory(true);
                          setIsSubcategoryDropdownOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Custom Subcategory</span>
                      </button>
                    )}
                  </div>

                  {/* Options list */}
                  <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                    {filteredSubcategories.map((sub) => {
                      const isSelected = formSubcategory === sub;
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleSelectSubcategory(sub)}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{sub}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-600" />}
                        </button>
                      );
                    })}

                    {filteredSubcategories.length === 0 && (
                      <div className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                        No subcategories found
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inline custom subcategory input */}
              {isAddingCustomSubcategory && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter new subcategory..."
                    value={customSubcategoryInput}
                    onChange={(e) => setCustomSubcategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customSubcategoryInput.trim()) {
                          handleAddCustomSubcategory(customSubcategoryInput.trim());
                        }
                      } else if (e.key === 'Escape') {
                        setIsAddingCustomSubcategory(false);
                        setCustomSubcategoryInput('');
                      }
                    }}
                    className="flex-1 rounded-lg border border-teal-500 bg-white px-3 py-1.5 text-xs font-medium focus:outline-hidden dark:border-teal-400 dark:bg-slate-900 dark:text-slate-100 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customSubcategoryInput.trim()) {
                        handleAddCustomSubcategory(customSubcategoryInput.trim());
                      }
                    }}
                    disabled={!customSubcategoryInput.trim()}
                    className="rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomSubcategory(false);
                      setCustomSubcategoryInput('');
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Form */}
            <div className="relative" ref={formDropdownRef}>
              <label className="block font-bold leading-4 text-slate-700 dark:text-slate-300 mb-1">
                Form
              </label>

              {/* Backwards-compatible select for form DOM query compatibility */}
              <select
                value={formForm}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setIsAddingCustomForm(true);
                    setIsFormDropdownOpen(false);
                  } else {
                    handleSelectForm(val);
                  }
                }}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                <option value="" className="text-slate-400">Choose Form</option>
                {allAvailableForms.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
                <option value="custom">Custom Form</option>
              </select>

              {/* Searchable Combobox Trigger */}
              <button
                type="button"
                onClick={() => {
                  setIsFormDropdownOpen((prev) => !prev);
                  setFormSearchQuery('');
                }}
                className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs normal-case flex items-center justify-between focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 cursor-pointer ${
                  !formForm
                    ? 'text-slate-400 dark:text-slate-500 font-normal'
                    : 'text-slate-800 dark:text-slate-100 font-normal'
                }`}
              >
                <span className="truncate normal-case">
                  {formForm || 'Choose Form'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isFormDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Searchable Dropdown Menu */}
              {isFormDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  {/* Search by typing */}
                  <div className="p-1.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search form..."
                        value={formSearchQuery}
                        onChange={(e) => setFormSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (filteredForms.length > 0) {
                              handleSelectForm(filteredForms[0]);
                            } else if (formSearchQuery.trim()) {
                              handleAddCustomForm(formSearchQuery.trim());
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setIsFormDropdownOpen(false);
                          }
                        }}
                        className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Custom Form Button (at top) */}
                  <div className="border-b border-slate-100 dark:border-slate-700/60 p-1 bg-slate-50/50 dark:bg-slate-800/40">
                    {formSearchQuery.trim() && !allAvailableForms.some((f) => f.toLowerCase() === formSearchQuery.trim().toLowerCase()) ? (
                      <button
                        type="button"
                        onClick={() => handleAddCustomForm(formSearchQuery.trim())}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add "{formSearchQuery.trim()}" as Form</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCustomForm(true);
                          setIsFormDropdownOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Custom Form</span>
                      </button>
                    )}
                  </div>

                  {/* Options list */}
                  <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                    {filteredForms.map((f) => {
                      const isSelected = formForm === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => handleSelectForm(f)}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{f}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-600" />}
                        </button>
                      );
                    })}

                    {filteredForms.length === 0 && (
                      <div className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                        No forms found
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inline custom form input */}
              {isAddingCustomForm && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter new form (e.g. Capsule)..."
                    value={customFormInput}
                    onChange={(e) => setCustomFormInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customFormInput.trim()) {
                          handleAddCustomForm(customFormInput.trim());
                        }
                      } else if (e.key === 'Escape') {
                        setIsAddingCustomForm(false);
                        setCustomFormInput('');
                      }
                    }}
                    className="flex-1 rounded-lg border border-teal-500 bg-white px-3 py-1.5 text-xs font-medium focus:outline-hidden dark:border-teal-400 dark:bg-slate-900 dark:text-slate-100 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customFormInput.trim()) {
                        handleAddCustomForm(customFormInput.trim());
                      }
                    }}
                    disabled={!customFormInput.trim()}
                    className="rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomForm(false);
                      setCustomFormInput('');
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Presentation */}
            <div className="relative" ref={presentationDropdownRef}>
              <label className="block font-bold leading-4 text-slate-700 dark:text-slate-300 mb-1">
                Presentation
              </label>

              {/* Backwards-compatible select for form DOM query compatibility */}
              <select
                value={formPresentation}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setIsAddingCustomPresentation(true);
                    setIsPresentationDropdownOpen(false);
                  } else {
                    handleSelectPresentation(val);
                  }
                }}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                <option value="" className="text-slate-400">Choose Presentation</option>
                {allAvailablePresentations.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="custom">Custom Presentation</option>
              </select>

              {/* Searchable Combobox Trigger */}
              <button
                type="button"
                onClick={() => {
                  setIsPresentationDropdownOpen((prev) => !prev);
                  setPresentationSearchQuery('');
                }}
                className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs normal-case flex items-center justify-between focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 cursor-pointer ${
                  !formPresentation
                    ? 'text-slate-400 dark:text-slate-500 font-normal'
                    : 'text-slate-800 dark:text-slate-100 font-normal'
                }`}
              >
                <span className="truncate normal-case">
                  {formPresentation || 'Choose Presentation'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isPresentationDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Searchable Dropdown Menu */}
              {isPresentationDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  {/* Search by typing */}
                  <div className="p-1.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search presentation..."
                        value={presentationSearchQuery}
                        onChange={(e) => setPresentationSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (filteredPresentations.length > 0) {
                              handleSelectPresentation(filteredPresentations[0]);
                            } else if (presentationSearchQuery.trim()) {
                              handleAddCustomPresentation(presentationSearchQuery.trim());
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setIsPresentationDropdownOpen(false);
                          }
                        }}
                        className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Custom Presentation Button (at top) */}
                  <div className="border-b border-slate-100 dark:border-slate-700/60 p-1 bg-slate-50/50 dark:bg-slate-800/40">
                    {presentationSearchQuery.trim() && !allAvailablePresentations.some((p) => p.toLowerCase() === presentationSearchQuery.trim().toLowerCase()) ? (
                      <button
                        type="button"
                        onClick={() => handleAddCustomPresentation(presentationSearchQuery.trim())}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add "{presentationSearchQuery.trim()}" as Presentation</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCustomPresentation(true);
                          setIsPresentationDropdownOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Custom Presentation</span>
                      </button>
                    )}
                  </div>

                  {/* Options list */}
                  <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                    {filteredPresentations.map((p) => {
                      const isSelected = formPresentation === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleSelectPresentation(p)}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{p}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-600" />}
                        </button>
                      );
                    })}

                    {filteredPresentations.length === 0 && (
                      <div className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                        No presentations found
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inline custom presentation input */}
              {isAddingCustomPresentation && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter new presentation (e.g. 30 Tablets)..."
                    value={customPresentationInput}
                    onChange={(e) => setCustomPresentationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customPresentationInput.trim()) {
                          handleAddCustomPresentation(customPresentationInput.trim());
                        }
                      } else if (e.key === 'Escape') {
                        setIsAddingCustomPresentation(false);
                        setCustomPresentationInput('');
                      }
                    }}
                    className="flex-1 rounded-lg border border-teal-500 bg-white px-3 py-1.5 text-xs font-medium focus:outline-hidden dark:border-teal-400 dark:bg-slate-900 dark:text-slate-100 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customPresentationInput.trim()) {
                        handleAddCustomPresentation(customPresentationInput.trim());
                      }
                    }}
                    disabled={!customPresentationInput.trim()}
                    className="rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomPresentation(false);
                      setCustomPresentationInput('');
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <div className="flex items-center gap-2 px-1 mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <span className="flex-1 min-w-0">Ingredient / Molecule</span>
                  <span className="flex-1 min-w-0">Strength / Dosage</span>
                  <span className="w-6 shrink-0" />
                </div>
                <div className="space-y-1.5">
                  {formMolecules.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) => {
                          const next = [...formMolecules];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setFormMolecules(next);
                        }}
                        className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <input
                        type="text"
                        value={m.strength}
                        onChange={(e) => {
                          const next = [...formMolecules];
                          next[idx] = { ...next[idx], strength: e.target.value };
                          setFormMolecules(next);
                        }}
                        className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        title="Remove ingredient"
                        aria-label="Remove ingredient"
                        onClick={() => {
                          if (formMolecules.length === 1) return;
                          setFormMolecules(formMolecules.filter((_, i) => i !== idx));
                        }}
                        disabled={formMolecules.length === 1}
                        className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setFormMolecules((prev) => [...prev, { name: '', strength: '' }])}
                  className="mt-2 flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Add another ingredient
                </button>
              </div>

              <div className="relative" ref={agentDropdownRef}>
                <label className="block font-bold leading-4 text-slate-700 dark:text-slate-300 mb-1">
                  Agent / Lebanese Distributor
                </label>

                {/* Backwards-compatible select for form DOM query compatibility */}
                <select
                  value={formAgent}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setIsAddingCustomAgent(true);
                      setIsAgentDropdownOpen(false);
                    } else {
                      handleSelectAgent(val);
                    }
                  }}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <option value="" className="text-slate-400">Choose Agent</option>
                  {allAvailableAgents.map((agentName) => (
                    <option key={agentName} value={agentName}>{agentName}</option>
                  ))}
                  <option value="custom">Custom Supplier</option>
                </select>

                {/* Searchable Combobox Trigger */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAgentDropdownOpen((prev) => !prev);
                    setAgentSearchQuery('');
                  }}
                  className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs normal-case flex items-center justify-between focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 cursor-pointer ${
                    !formAgent
                      ? 'text-slate-400 dark:text-slate-500 font-normal'
                      : 'text-slate-800 dark:text-slate-100 font-normal'
                  }`}
                >
                  <span className={`truncate normal-case ${!formAgent ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                    {formAgent || 'Choose Agent'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isAgentDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Searchable Dropdown Menu */}
                {isAgentDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    {/* Search by typing */}
                    <div className="p-1.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
                      <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search agent / distributor..."
                          value={agentSearchQuery}
                          onChange={(e) => setAgentSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (filteredAgents.length > 0) {
                                handleSelectAgent(filteredAgents[0]);
                              } else if (agentSearchQuery.trim()) {
                                handleAddCustomAgent(agentSearchQuery.trim());
                              }
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setIsAgentDropdownOpen(false);
                            }
                          }}
                          className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    {/* Options list */}
                    <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                      {filteredAgents.map((agentName) => {
                        const isSelected = formAgent === agentName;
                        return (
                          <button
                            key={agentName}
                            type="button"
                            onClick={() => handleSelectAgent(agentName)}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span className="truncate">{agentName}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 ml-1" />}
                          </button>
                        );
                      })}

                      {filteredAgents.length === 0 && (
                        <div className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                          No agents / distributors found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pieces Division Setup */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDivisibleCheck"
                  checked={formIsDivisible}
                  onChange={(e) => setFormIsDivisible(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                />
                <label htmlFor="isDivisibleCheck" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Divide Box into Pieces
                </label>
              </div>
              {formIsDivisible && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-6 border-l-2 border-teal-200 dark:border-teal-900 mt-2">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Pieces per Box
                    </label>
                    <input
                      type="number"
                      min="2"
                      value={formPiecesPerBox}
                      onChange={(e) => {
                        setFormPiecesPerBox(e.target.value);
                        const val = parseFloat(e.target.value);
                        if (!isPiecePriceManual && !isNaN(val) && val > 0 && formPriceUSD) {
                          setFormPiecePriceUSD((Number(formPriceUSD) / val).toFixed(2));
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      required={formIsDivisible}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Piece Name
                    </label>
                    <input
                      type="text"
                      value={formPieceName}
                      onChange={(e) => setFormPieceName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      required={formIsDivisible}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
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
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Pricing in LBP, USD, Margin */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
              <span className="font-bold text-slate-900 dark:text-slate-100 block">
                Dual-Currency Pricing & Profit Margin
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Price in LBP (L.L.)
                  </label>
                  <input
                    type="text"
                    value={formPriceLBP}
                    onChange={(e) => {
                      setFormPriceLBP(e.target.value);
                      const num = parseFloat(e.target.value.replace(/[^\d.]/g, ''));
                      if (!isNaN(num) && num > 0) {
                        const usdVal = num / exchangeRate;
                        setFormPriceUSD(usdVal.toFixed(2));
                        if (formPiecesPerBox && !formPiecePriceUSD) {
                          setFormPiecePriceUSD((usdVal / Number(formPiecesPerBox)).toFixed(2));
                        }
                      } else if (!e.target.value.trim()) {
                        setFormPriceUSD('');
                      }
                    }}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Price in USD ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPriceUSD}
                    onChange={(e) => {
                      setFormPriceUSD(e.target.value);
                      const num = parseFloat(e.target.value);
                      if (!isNaN(num) && num > 0) {
                        setFormPriceLBP(Math.round(num * exchangeRate).toString());
                        if (formPiecesPerBox && !formPiecePriceUSD) {
                          setFormPiecePriceUSD((num / Number(formPiecesPerBox)).toFixed(2));
                        }
                      } else if (!e.target.value.trim()) {
                        setFormPriceLBP('');
                      }
                    }}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pharmacist Margin
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formMargin}
                    onChange={(e) => setFormMargin(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Batches & Expiry */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Batches & Expiry Dates
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  (Use Qty Adjustments tab to modify)
                </span>
              </div>
              {(() => {
                const activeBatches = (formBatches || []).filter((b) => b.batchNumber && (b.quantity || 0) > 0);
                if (!formBatches || formBatches.length === 0 || (formBatches.length === 1 && !formBatches[0].batchNumber)) {
                  return (
                    <div className="text-sm text-gray-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      No batches configured yet.
                    </div>
                  );
                }
                if (activeBatches.length === 0) {
                  return (
                    <div className="text-sm text-gray-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      No batches with stock remaining.
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeBatches.map((batch, index) => (
                      <div key={index} className="flex flex-col gap-1 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Batch: <span className="text-slate-800 dark:text-slate-200">{batch.batchNumber}</span></span>
                          <span className="text-xs font-bold text-teal-600 dark:text-teal-400">Qty: {formatStockDisplay(batch.quantity || 0, formIsDivisible, Number(formPiecesPerBox), formPieceName)}</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Expires: {batch.expiryDate ? parseExpiryDate(batch.expiryDate).displayMMYYYY : 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                id="btn-cancel-stock-item-modal"
                onClick={handleRequestCloseEditModal}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-save-stock-item-modal"
                className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>{editingProductId ? 'Update Item' : 'Save to Inventory'}</span>
              </button>
            </div>
          </form>
        </DesktopWindow>
      )}

      {/* Discard Confirmation Modal for Add Item */}
      {showDiscardConfirmModal && (
        <div
          id="modal-discard-add-item"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDiscardConfirmModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 pt-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Discard Unsaved Item?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    You have entered information for this new item that has not been saved yet. If you close now, all entered data will be discarded.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="btn-keep-editing-item"
                onClick={() => setShowDiscardConfirmModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
              >
                Keep Editing
              </button>
              <button
                type="button"
                id="btn-discard-and-close-item"
                onClick={() => {
                  setShowDiscardConfirmModal(false);
                  setIsEditModalOpen(false);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer shadow-2xs"
              >
                Discard & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Supplier Modal */}
      {isAddSupplierModalOpen && (
        <DesktopWindow
          id="stock-add-supplier-modal"
          title="Add New Supplier"
          isOpen={true}
          section="stock"
          onClose={() => setIsAddSupplierModalOpen(false)}
          width="480px"
          height="auto"
        >
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-teal-500 focus:outline-hidden dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder="e.g. +961 1 234 567"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-teal-500 focus:outline-hidden dark:text-slate-100"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddSupplierModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newSupplierName.trim()) {
                    addSupplier({
                      name: newSupplierName.trim(),
                      code: `SUP-${Math.floor(100 + Math.random() * 900)}`,
                      phone: newSupplierPhone.trim(),
                      email: '',
                      address: 'Lebanon',
                      contactPerson: '',
                      paymentTerms: '30 Days Net',
                      balanceUSD: 0,
                      balanceLBP: 0,
                    });
                    setFormAgent(newSupplierName.trim());
                    setIsAddSupplierModalOpen(false);
                  }
                }}
                disabled={!newSupplierName.trim()}
                className="px-5 py-2 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                Save Supplier
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}

      {/* Delete All Stock Confirmation Modal */}
      {isDeleteAllModalOpen && (
        <DesktopWindow
          id="stock-delete-all-modal"
          title="Confirm Global Stock Clearance"
          isOpen={true}
          section="stock"
          onClose={() => setIsDeleteAllModalOpen(false)}
          width="450px"
          height="auto"
        >
          <div className="p-6 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Delete All Stock Items?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Permanent inventory wipe
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to completely remove and delete all{' '}
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {products.length} items
                </span>{' '}
                from your stock database? This will clear all products, batches, and inventory records.
              </p>

              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-3 text-[11px] text-rose-800 dark:text-rose-300 font-medium">
                ⚠️ This action is irreversible. All current stock records will be removed immediately.
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteAllProducts();
                  setIsDeleteAllModalOpen(false);
                }}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-1.5 text-xs font-bold text-white shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Yes, Delete All Stock</span>
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}

      {/* Bulk Delete Selected Items Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <DesktopWindow
          id="stock-bulk-delete-modal"
          title={`Delete ${selectedProductIds.size} Selected Items`}
          isOpen={true}
          section="stock"
          onClose={() => setIsBulkDeleteModalOpen(false)}
          width="480px"
          height="auto"
        >
          <div className="p-6 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto min-h-0 text-xs">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400 shrink-0">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Delete {selectedProductIds.size} Selected Items?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Permanent removal from inventory
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to delete{' '}
                <strong className="text-rose-600 dark:text-rose-400">
                  {selectedProductIds.size} selected products
                </strong>{' '}
                from your pharmacy stock? Their records, stock batches, and barcodes will be permanently removed and synchronized.
              </p>

              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-3 text-[11px] text-rose-800 dark:text-rose-300 font-medium">
                ⚠️ This action is irreversible. The selected products will be removed immediately.
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  bulkDeleteProducts(Array.from(selectedProductIds));
                  handleClearSelection();
                  setIsBulkDeleteModalOpen(false);
                }}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-1.5 text-xs font-bold text-white shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Yes, Delete {selectedProductIds.size} Items</span>
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}

      {/* Bulk Edit Stock Modal */}
      {isBulkEditModalOpen && (
        <BulkEditStockModal
          selectedProducts={selectedProductsList.length > 0 ? selectedProductsList : sortedProducts}
          onClose={() => setIsBulkEditModalOpen(false)}
          onSuccess={() => {
            handleClearSelection();
          }}
        />
      )}

      {/* Responsive Drug Information Popup Window (Read-Only) */}
      <DrugDetailsModal
        product={selectedStockProduct}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        onViewScientific={onViewScientific}
        exchangeRate={exchangeRate}
      />
    </div>
  );
};
