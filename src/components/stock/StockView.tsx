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
  ArrowDown
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePharmacy } from '../../context/PharmacyContext';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useDebounce } from '../../hooks/useDebounce';
import { Product, ProductCategory, ScientificDrugInfo } from '../../types/pharmacy';
import { formatStockDisplay } from '../../utils/stockUtils';
import { resolveStraightforwardScientificInfo } from '../../services/scientificDataService';
import { getPriceChangeInfoUSD, getPriceChangeInfoLBP, formatLBPValue } from '../../utils/priceUtils';
import { PriceUpdaterModal } from './PriceUpdaterModal';
import { DrugDetailsModal } from './DrugDetailsModal';
import { BulkEditStockModal } from './BulkEditStockModal';
import { DesktopWindow } from '../common/DesktopWindow';
import { SectionRestoreButton } from '../common/SectionRestoreButton';

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

const STOCK_GRID_COLUMNS = '40px 90px 110px minmax(130px, 1.6fr) minmax(125px, 1.2fr) 120px 105px 115px 75px 100px 100px 105px';
const STOCK_MIN_WIDTH = 1215;

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
}

const StockTableRow = React.memo(React.forwardRef<HTMLDivElement, StockTableRowProps & { dataIndex?: number; style?: React.CSSProperties }>(function StockTableRow({
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
  dataIndex,
  style,
}, ref) {
  const isLow = prod.stockQuantity <= prod.minStockAlert;
  const isOut = prod.stockQuantity <= 0;

  const renderExpiryCellView = React.useCallback((prod: Product) => {
    const expiry = prod.expiryDate || prod.batches?.[0]?.expiryDate;
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

    // Filter active batches with quantity > 0 (omit zero quantity batches)
    const activeBatches = prod.batches && prod.batches.length > 0
      ? prod.batches.filter((b) => (b.quantity || 0) > 0)
      : (prod.stockQuantity > 0
          ? [{ batchNumber: prod.batchNumber || 'N/A', expiryDate: expiry, quantity: prod.stockQuantity }]
          : []);

    // Tooltip format in exact requested order: (batch number, expiry, quantity of each batch)
    const tooltipText = activeBatches.length > 0
      ? activeBatches
          .map((b) => {
            const expFormatted = parseExpiryDate(b.expiryDate).displayMMYYYY || b.expiryDate || 'N/A';
            return `Batch: ${b.batchNumber || 'N/A'}, Expiry: ${expFormatted}, Quantity: ${formatStockDisplay(b.quantity || 0, prod.isDivisible, prod.piecesPerBox, prod.pieceName)}`;
          })
          .join('\n')
      : undefined;

    const extraBatchesCount = activeBatches.length > 1 ? activeBatches.length - 1 : 0;

    return (
      <div className="flex flex-col py-0.5" title={tooltipText}>
        <div className="flex items-center gap-1.5 cursor-default">
          <span
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
              className="text-[9px] px-1 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded font-medium"
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
  }, []);

  return (
    <div
      role="row"
      ref={ref}
      data-index={dataIndex}
      style={{ gridTemplateColumns: STOCK_GRID_COLUMNS, ...style }}
      id={`stock-table-row-${prod.id}`}
      onClick={() => onOpenDetails(prod)}
      className={`grid items-center text-xs hover:bg-blue-50/70 dark:hover:bg-slate-800/60 cursor-pointer border-b transition-colors ${
        isRowSelected
          ? 'bg-teal-50/80 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800'
          : isSelected
          ? 'bg-blue-50/50 dark:bg-slate-800/40 border-gray-100 dark:border-slate-800/80'
          : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800/80'
      }`}
    >
      <div role="cell"
        className="px-3 py-2 text-center"
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
      </div>
      <div role="cell" className="px-3 py-2 font-mono text-gray-500 dark:text-slate-400">
        {prod.code}
      </div>
      <div role="cell" className="px-3 py-2 font-mono text-gray-500 dark:text-slate-400">
        {prod.barcode || '-'}
      </div>
      <div role="cell" className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100">
        <div>{prod.name}</div>
        <div className="text-[10px] font-normal text-gray-400">
          {prod.dosage} • {prod.form}
        </div>
      </div>
      <div role="cell"
        id={`td-stock-presentation-${prod.id}`}
        className="px-3 py-2 text-slate-700 dark:text-slate-300 min-w-0 truncate"
        title={prod.presentation || ''}
      >
        {prod.presentation ? (
          <span>{prod.presentation}</span>
        ) : (
          <span className="text-gray-400 dark:text-slate-500 italic">-</span>
        )}
      </div>
      <div role="cell" className="px-3 py-2">
        <span
          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
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
      </div>
      <div role="cell" className="px-3 py-2 text-right font-medium text-blue-600 dark:text-blue-400">
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
      </div>
      <div role="cell" className="px-3 py-2 text-right font-medium text-green-700 dark:text-green-400">
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
      </div>
      <div role="cell" className="px-3 py-2 text-center">
        <span
          className={`font-bold ${
            prod.stockQuantity === 0
              ? 'text-red-600 dark:text-red-400 font-extrabold'
              : prod.stockQuantity <= 3
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-green-600 dark:text-green-400'
          }`}
        >
          {formatStockDisplay(prod.stockQuantity, prod.isDivisible, prod.piecesPerBox, prod.pieceName)}
        </span>
      </div>
      <div role="cell" className="px-3 py-2 whitespace-nowrap">
        {renderExpiryCellView(prod)}
      </div>
      <div role="cell" className="px-3 py-2 text-gray-500 dark:text-slate-400 min-w-0 truncate">
        {prod.agent}
      </div>
      <div role="cell" className="px-3 py-2 text-right">
        <div className="flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
          {/* Quick Price Update by Code Button */}
          <button
            onClick={() => onOpenPrice(prod.code)}
            className="rounded p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"
            title="Update price for this drug"
          >
            <Tag className="h-3.5 w-3.5" />
          </button>

          {/* Scientific Info Button */}
          {prod.category === 'drug' && (
            <button
              onClick={() => onViewScientific(prod)}
              className="rounded p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              title="View Full Scientific Dossier"
            >
              <BookOpen className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Edit Product */}
          <button
            onClick={() => onEdit(prod)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Edit Item Details"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}));

export const StockView: React.FC<StockViewProps> = ({ onViewScientific, onOpenCSVImport, onOpenMOPHUpdater }) => {
  const {
    products,
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
  } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);

  useBarcodeScanner({
    onScan: (barcode) => {
      setSearchQuery(barcode);
    }
  });

  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' } | null>(null);

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

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ProductCategory>('drug');
  const [formIngredients, setFormIngredients] = useState('');
  const [formDosage, setFormDosage] = useState('');
  const [formPediatricDosage, setFormPediatricDosage] = useState('');
  const [formPresentation, setFormPresentation] = useState('');
  const [formIsDivisible, setFormIsDivisible] = useState(false);
  const [formPiecesPerBox, setFormPiecesPerBox] = useState<string | number>('');
  const [formPieceName, setFormPieceName] = useState('');
  const [formPiecePriceUSD, setFormPiecePriceUSD] = useState('');
  const [isPiecePriceManual, setIsPiecePriceManual] = useState(false);
  const [formForm, setFormForm] = useState('Tablet');
  const [formPriceLBP, setFormPriceLBP] = useState('');
  const [formPriceUSD, setFormPriceUSD] = useState('');
  const [formMargin, setFormMargin] = useState('20');
  const [formAgent, setFormAgent] = useState('Mersaco Sal');
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  
  const [formBatches, setFormBatches] = useState<{batchNumber: string, expiryDate: string, quantity?: number}[]>([{ batchNumber: '', expiryDate: '', quantity: 0 }]);

  // Scientific Fields (for Category: Drug)
  const [formIndications, setFormIndications] = useState('');
  const [formContraindications, setFormContraindications] = useState('');
  const [formSideEffects, setFormSideEffects] = useState('');
  const [formGenerics, setFormGenerics] = useState('');

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchCat = selectedCategory === 'all' || prod.category === selectedCategory;
      const matchLow = !showLowStockOnly || prod.stockQuantity <= prod.minStockAlert;
      const q = debouncedSearchQuery.trim().toLowerCase();
      const rawExpiry = prod.expiryDate || prod.batches?.[0]?.expiryDate || '';
      const formattedExp = rawExpiry ? parseExpiryDate(rawExpiry).displayMMYYYY.toLowerCase() : '';
      const matchSearch =
        !q ||
        (prod.code || '').toLowerCase().includes(q) ||
        (prod.barcode || '').toLowerCase().includes(q) ||
        (prod.name || '').toLowerCase().includes(q) ||
        (prod.presentation || '').toLowerCase().includes(q) ||
        (prod.ingredients || '').toLowerCase().includes(q) ||
        (prod.agent || '').toLowerCase().includes(q) ||
        rawExpiry.toLowerCase().includes(q) ||
        formattedExp.includes(q);
      return matchCat && matchLow && matchSearch;
    });
  }, [products, selectedCategory, showLowStockOnly, debouncedSearchQuery]);

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

  const openAddModal = () => {
    setEditingProductId(null);
    setFormCode(`DRUG-${Math.floor(100 + Math.random() * 900)}`);
    setFormBarcode('');
    setFormName('');
    setFormCategory('drug');
    setFormIngredients('');
    setFormDosage('');
    setFormPresentation('');
    setFormIsDivisible(false);
    setFormPiecesPerBox('');
    setFormPieceName('');
    setFormPiecePriceUSD('');
    setIsPiecePriceManual(false);
    setFormForm('Tablet');
    setFormPriceLBP('350000');
    setFormPriceUSD((350000 / exchangeRate).toFixed(2));
    setFormMargin('20');
    setFormAgent(suppliers[0]?.name || 'Mersaco Sal');
    setFormBatches([]);
    setFormIndications('');
    setFormContraindications('');
    setFormSideEffects('');
    setFormGenerics('');
    setIsEditModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProductId(prod.id);
    setFormCode(prod.code);
    setFormBarcode(prod.barcode || '');
    setFormName(prod.name);
    setFormCategory(prod.category);
    setFormIngredients(prod.ingredients);
    setFormDosage(prod.dosage);
    setFormPresentation(prod.presentation);
    setFormIsDivisible(prod.isDivisible || false);
    setFormPiecesPerBox(prod.piecesPerBox || '');
    setFormPieceName(prod.pieceName || '');
    setFormPiecePriceUSD(prod.piecePriceUSD ? prod.piecePriceUSD.toString() : '');
    setIsPiecePriceManual(!!prod.piecePriceUSD);
    setFormForm(prod.form);
    setFormPriceLBP(prod.priceLBP.toString());
    setFormPriceUSD(prod.priceUSD.toString());
    setFormMargin(prod.pharmacistMarginProfit.toString());
    setFormAgent(prod.agent);
    if (prod.batches && prod.batches.length > 0) {
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
    const term = formIngredients.trim() || formName.trim();
    if (!term) return;
    setIsFetchingScientifics(true);
    try {
      const res = await searchScientificDataOnline(term, formName.trim());
      if (res.scientificInfo) {
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
          setFormDosage(res.scientificInfo.dosage);
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

    let scientificInfo: ScientificDrugInfo | undefined = undefined;
    if (formCategory === 'drug') {
       const baseProd: Product = {
         id: editingProductId || 'temp',
         code: formCode.trim().toUpperCase(),
         barcode: formBarcode.trim(),
         name: formName.trim(),
         category: formCategory,
         ingredients: formIngredients,
         dosage: formDosage,
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
        code: formCode.trim().toUpperCase(),
        barcode: formBarcode.trim(),
        name: formName.trim(),
        category: formCategory,
        ingredients: formIngredients,
        dosage: formDosage,
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
        batches,
        scientificInfo,
      });
    } else {
      addProduct({
        code: formCode.trim().toUpperCase(),
        barcode: formBarcode.trim(),
        name: formName.trim(),
        category: formCategory,
        ingredients: formIngredients,
        dosage: formDosage,
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
        batches,
        scientificInfo,
      });
    }

    setIsEditModalOpen(false);
  };

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
              onClick={() => setIsDeleteAllModalOpen(true)}
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
              onClick={onOpenCSVImport}
              className="text-xs border border-gray-300 dark:border-slate-700 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded cursor-pointer font-medium text-gray-700 dark:text-gray-200"
            >
              Import CSV
            </button>
            <button
              onClick={onOpenMOPHUpdater}
              className="text-xs border border-teal-300 dark:border-teal-700/60 px-2.5 py-1 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 rounded cursor-pointer font-medium text-teal-700 dark:text-teal-300 flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Update prices directly from the official MOPH price list"
            >
              <Globe className="h-3.5 w-3.5" />
              Update from MOPH
            </button>
            <button
              onClick={() => {
                setSelectedProductCode('');
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
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Barcode, Code, Name, Agent..."
              className="border border-gray-300 dark:border-slate-700 rounded pl-8 pr-3 py-1 w-full focus:outline-hidden focus:ring-1 focus:ring-teal-500 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1">
            {(['all', 'drug', 'vitamins', 'cosmetics', 'para'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase transition-colors ${
                  selectedCategory === cat
                    ? 'bg-teal-700 text-white shadow-2xs'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                {cat === 'all' ? 'All Stock' : cat}
              </button>
            ))}
            <button
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`ml-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold border transition-colors ${
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

        {/* High-Density Stock Table */}
        <div ref={parentRef} className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          <div style={{ minWidth: STOCK_MIN_WIDTH }}>
            <div
              role="rowgroup"
              className="sticky top-0 z-10 grid items-center text-xs bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700"
              style={{ gridTemplateColumns: STOCK_GRID_COLUMNS }}
            >
              <div className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  title={allFilteredSelected ? 'Deselect all in view' : 'Select all in view'}
                  checked={allFilteredSelected}
                  ref={headerCheckboxRef}
                  onChange={handleToggleSelectAll}
                  className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5 cursor-pointer align-middle"
                />
              </div>
              <div
                role="columnheader"
                className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('code')}
              >
                <div className="flex items-center gap-1">CODE <ArrowUpDown className="h-3 w-3" /></div>
              </div>
              <div
                role="columnheader"
                className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('barcode')}
              >
                <div className="flex items-center gap-1">BARCODE <ArrowUpDown className="h-3 w-3" /></div>
              </div>
              <div
                role="columnheader"
                className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">NAME <ArrowUpDown className="h-3 w-3" /></div>
              </div>
              <div
                role="columnheader"
                id="th-stock-presentation"
                className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('presentation')}
              >
                <div className="flex items-center gap-1">PRESENTATION <ArrowUpDown className="h-3 w-3" /></div>
              </div>
              <div
                role="columnheader"
                className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center gap-1">CATEGORY <ArrowUpDown className="h-3 w-3" /></div>
              </div>
              <div
                role="columnheader"
                className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-right cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('priceUSD')}
              >
                <div className="flex items-center justify-end gap-1"><ArrowUpDown className="h-3 w-3" /> PRICE ($)</div>
              </div>
              <div role="columnheader" className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-right">PRICE (LBP)</div>
              <div
                role="columnheader"
                className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-center cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('stockQuantity')}
              >
                <div className="flex items-center justify-center gap-1"><ArrowUpDown className="h-3 w-3" /> QTY</div>
              </div>
              <div
                role="columnheader"
                className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('expiryDate')}
              >
                <div className="flex items-center gap-1">EXPIRY <ArrowUpDown className="h-3 w-3" /></div>
              </div>
              <div
                role="columnheader"
                className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('agent')}
              >
                <div className="flex items-center gap-1">AGENT <ArrowUpDown className="h-3 w-3" /></div>
              </div>
              <div role="columnheader" className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 text-right">ACTIONS</div>
            </div>
            <div
              className="relative"
              style={{ height: rowVirtualizer.getTotalSize() }}
            >
              {sortedProducts.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No items found matching the current criteria.
                </div>
              ) : (
                rowVirtualItems.map((virtualRow) => {
                  const prod = sortedProducts[virtualRow.index];
                  const change = priceChangeInfo.get(prod.id);
                  return (
                    <StockTableRow
                      key={prod.id}
                      ref={rowVirtualizer.measureElement}
                      data-index={virtualRow.index}
                      style={{ transform: `translateY(${virtualRow.start}px)`, position: 'absolute', top: 0, left: 0, width: '100%' }}
                      prod={prod}
                      index={virtualRow.index}
                      isSelected={selectedStockProduct?.id === prod.id}
                      isRowSelected={selectedProductIds.has(prod.id)}
                      changeUSD={change?.usd}
                      changeLBP={change?.lbp}
                      onToggleRowSelect={handleToggleRowSelect}
                      onOpenDetails={(p) => {
                        setSelectedStockProduct(p);
                        setIsDetailsModalOpen(true);
                      }}
                      onOpenPrice={(code) => {
                        setSelectedProductCode(code);
                        setIsPriceModalOpen(true);
                      }}
                      onViewScientific={onViewScientific}
                      onEdit={openEditModal}
                    />
                  );
                })
              )}
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
          title={editingProductId ? 'Edit Pharmacy Item' : 'Add New Inventory Item'}
          isOpen={true}
          section="stock"
          onClose={() => setIsEditModalOpen(false)}
          width="700px"
          height="85vh"
        >
          <form onSubmit={handleSaveProduct} className="p-6 space-y-4 flex-1 overflow-y-auto text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Drug Code
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold uppercase focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Barcode
                </label>
                <input
                  type="text"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Product Trade Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="e.g. Panadol Extra"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Requirement 21: Category Selection (drug, vitamins, cosmetics, para) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as ProductCategory)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-bold uppercase focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="drug">Drug (Medicines)</option>
                  <option value="vitamins">Vitamins</option>
                  <option value="cosmetics">Cosmetics</option>
                  <option value="para">Para (Medical / Diagnostic)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dosage / Strength
                </label>
                <input
                  type="text"
                  value={formDosage}
                  onChange={(e) => setFormDosage(e.target.value)}
                  placeholder="e.g. 500mg, 1000 IU"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Form
                </label>
                <input
                  type="text"
                  value={formForm}
                  onChange={(e) => setFormForm(e.target.value)}
                  placeholder="e.g. Tablet, Syrup, Cream"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Presentation
                </label>
                <input
                  type="text"
                  value={formPresentation}
                  onChange={(e) => setFormPresentation(e.target.value)}
                  placeholder="e.g. 24 Film-Coated Tablets"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6 border-l-2 border-teal-200 dark:border-teal-900 mt-2">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                      placeholder="e.g. 30"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      required={formIsDivisible}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Piece Name
                    </label>
                    <input
                      type="text"
                      value={formPieceName}
                      onChange={(e) => setFormPieceName(e.target.value)}
                      placeholder="e.g. Sachet, Ampoule, Pen"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      required={formIsDivisible}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                      placeholder="e.g. 1.50"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Active Ingredients / Molecule
                  </label>

                </div>
                <input
                  type="text"
                  value={formIngredients}
                  onChange={(e) => setFormIngredients(e.target.value)}
                  placeholder="e.g. Paracetamol + Caffeine, Amoxicillin"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="relative">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Agent / Lebanese Distributor
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formAgent}
                    onChange={(e) => {
                      setFormAgent(e.target.value);
                      setShowAgentDropdown(true);
                    }}
                    onFocus={() => setShowAgentDropdown(true)}
                    onBlur={() => setTimeout(() => setShowAgentDropdown(false), 200)}
                    placeholder="e.g. Mersaco, Omnipharma, Fattal"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {showAgentDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {suppliers
                        .filter(s => s.name.toLowerCase().includes(formAgent.toLowerCase()))
                        .slice(0, 5)
                        .map(agent => (
                          <div
                            key={agent.id}
                            className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm"
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent blur
                              setFormAgent(agent.name);
                              setShowAgentDropdown(false);
                            }}
                          >
                            {agent.name}
                          </div>
                      ))}
                      <div
                        className="px-3 py-2 cursor-pointer bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 font-medium text-sm flex items-center justify-between sticky bottom-0 border-t border-teal-100 dark:border-teal-800/50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setNewSupplierName(formAgent);
                          setIsAddSupplierModalOpen(true);
                          setShowAgentDropdown(false);
                        }}
                      >
                        + Add Custom Supplier
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
                      if (!isNaN(num)) {
                        const usdVal = num / exchangeRate;
                        setFormPriceUSD(usdVal.toFixed(2));
                        if (formPiecesPerBox && !formPiecePriceUSD) {
                          setFormPiecePriceUSD((usdVal / Number(formPiecesPerBox)).toFixed(2));
                        }
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
                      if (!isNaN(num)) {
                        setFormPriceLBP(Math.round(num * exchangeRate).toString());
                        if (formPiecesPerBox && !formPiecePriceUSD) {
                          setFormPiecePriceUSD((num / Number(formPiecesPerBox)).toFixed(2));
                        }
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
                    placeholder="20"
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
              {(!formBatches || formBatches.length === 0 || (formBatches.length === 1 && !formBatches[0].batchNumber)) ? (
                <div className="text-sm text-gray-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  No batches configured yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {formBatches.filter(b => b.batchNumber).map((batch, index) => (
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
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
              >
                <Check className="h-4 w-4" />
                <span>{editingProductId ? 'Update Item' : 'Save to Inventory'}</span>
              </button>
            </div>
          </form>
        </DesktopWindow>
      )}

      {/* Add Custom Supplier Modal */}
      {isAddSupplierModalOpen && (
        <DesktopWindow
          title="Add New Supplier"
          isOpen={true}
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
          title="Confirm Global Stock Clearance"
          isOpen={true}
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
