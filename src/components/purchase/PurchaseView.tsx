import { motion } from "motion/react";
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  Search,
  Calendar,
  DollarSign,
  Package,
  Check,
  X,
  FileText,
  Barcode,
  Edit2,
  ScanBarcode,
  ChevronDown,
  AlertCircle,
  Sparkles,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { Product, PurchaseItem, PurchaseInvoice } from '../../types/pharmacy';
import { filterProductsByMultiWordQuery } from '../../utils/searchUtils';
import { DesktopWindow } from '../common/DesktopWindow';
import { formatLBPValue } from '../../utils/priceUtils';
import { SectionRestoreButton } from '../common/SectionRestoreButton';
import { AddStockProductModal } from '../stock/AddStockProductModal';

const formatWithCommas = (val: string | number) => {
  if (val === null || val === undefined) return '';
  const parts = val.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

interface PurchaseAddedItemRowProps {
  item: PurchaseItem;
  index: number;
  productDetails?: Product;
  purchaseCurrency: 'USD' | 'LBP';
  exchangeRate: number;
  vatRate: number;
  onChange: (index: number, updated: PurchaseItem) => void;
  onRemove: (index: number) => void;
}

const PurchaseAddedItemRow: React.FC<PurchaseAddedItemRowProps> = ({
  item,
  index,
  productDetails,
  purchaseCurrency,
  exchangeRate,
  vatRate,
  onChange,
  onRemove
}) => {
  const [costInput, setCostInput] = useState(() => (purchaseCurrency === 'USD' ? item.unitCostUSD : item.unitCostLBP).toString());
  const [discountInput, setDiscountInput] = useState(() => (item.discount || 0).toString());
  const [priceInput, setPriceInput] = useState(() => {
    const val = purchaseCurrency === 'USD' ? item.sellingPriceUSD : item.sellingPriceLBP;
    return (val || 0).toString();
  });

  const total = (purchaseCurrency === 'USD' ? item.unitCostUSD : item.unitCostLBP) * item.quantity;
  const [totalInput, setTotalInput] = useState(total.toString());

  useEffect(() => {
    setCostInput((purchaseCurrency === 'USD' ? item.unitCostUSD : item.unitCostLBP).toString());
    setPriceInput(((purchaseCurrency === 'USD' ? item.sellingPriceUSD : item.sellingPriceLBP) || 0).toString());
    setDiscountInput((item.discount || 0).toString());
  }, [purchaseCurrency, item.unitCostUSD, item.unitCostLBP, item.sellingPriceUSD, item.sellingPriceLBP, item.discount]);

  useEffect(() => {
    setTotalInput(((purchaseCurrency === 'USD' ? item.unitCostUSD : item.unitCostLBP) * item.quantity).toString());
  }, [purchaseCurrency, item.unitCostUSD, item.unitCostLBP, item.quantity]);

  const flushCost = (str: string) => {
    const val = parseFloat(str) || 0;
    let costUSD = 0, costLBP = 0;
    if (purchaseCurrency === 'USD') {
      costUSD = val; costLBP = Math.round(val * exchangeRate);
    } else {
      costLBP = val; costUSD = val / exchangeRate;
    }
    onChange(index, { ...item, unitCostUSD: costUSD, unitCostLBP: costLBP });
  };
  
  const flushPrice = (str: string) => {
    const val = parseFloat(str) || 0;
    let pUSD = 0, pLBP = 0;
    if (purchaseCurrency === 'USD') {
      pUSD = val; pLBP = Math.round(val * exchangeRate);
    } else {
      pLBP = val; pUSD = val / exchangeRate;
    }
    onChange(index, { ...item, sellingPriceUSD: pUSD, sellingPriceLBP: pLBP });
  };

  return (
    <div className="p-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[repeat(19,minmax(0,1fr))] gap-2 items-end min-w-[900px]">
        <div className="sm:col-span-3 relative">
          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 flex items-center justify-between">
            <span className="truncate font-medium flex-1 mr-2">
              <span>{item.productName}</span>
              {productDetails && (
                <span className="font-normal text-slate-500 text-[10px] ml-1.5">
                  {productDetails.dosage} {productDetails.presentation} {productDetails.form}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="p-1 text-rose-500 hover:bg-rose-100 rounded-md transition-colors dark:hover:bg-rose-900/40 cursor-pointer"
              title="Remove Item"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
        
        <div>
          <select
            value={item.isPiece ? 'piece' : 'box'}
            onChange={(e) => onChange(index, { ...item, isPiece: e.target.value === 'piece' })}
            disabled={!productDetails?.isDivisible}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50"
          >
            <option value="box">Box</option>
            {productDetails?.isDivisible && <option value="piece">{productDetails.pieceName || 'Piece'}</option>}
          </select>
        </div>

        <div className="md:col-span-2">
          <input
            type="text"
            value={item.expiryDate ? item.expiryDate.split('-').reverse().join('/') : ''}
            onChange={(e) => {
               const val = e.target.value;
               // simple passthrough for now, complex parsing can be added if needed on blur
               onChange(index, { ...item, expiryDate: val });
            }}
            onBlur={(e) => {
               let val = e.target.value.trim();
               const digits = val.replace(/[^\d]/g, '');
               let d = 0, m = 0, y = 0;
               if (digits.length === 4) { m = parseInt(digits.slice(0, 2), 10); y = 2000 + parseInt(digits.slice(2, 4), 10); }
               else if (digits.length === 6) {
                 const p1 = parseInt(digits.slice(0, 2), 10), p2 = parseInt(digits.slice(2, 4), 10), p3 = parseInt(digits.slice(4, 6), 10);
                 if (p1 <= 12 && p2 === 20) { m = p1; y = parseInt(digits.slice(2, 6), 10); }
                 else if (p2 <= 12) { d = p1; m = p2; y = 2000 + p3; }
                 else { m = p1; y = parseInt(digits.slice(2, 6), 10); }
               } else if (digits.length === 8) {
                 d = parseInt(digits.slice(0, 2), 10); m = parseInt(digits.slice(2, 4), 10); y = parseInt(digits.slice(4, 8), 10);
               } else { return; }
               if (m >= 1 && m <= 12) {
                 if (d === 0 || d > 31) d = new Date(y, m, 0).getDate();
                 onChange(index, { ...item, expiryDate: `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}` });
               }
            }}
            placeholder="DD/MM/YYYY"
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 text-center"
          />
        </div>

        <div>
          <input
            type="text"
            value={item.batchNumber}
            onChange={(e) => onChange(index, { ...item, batchNumber: e.target.value })}
            placeholder="Batch"
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <input
            type="number"
            value={item.quantity === 0 ? '' : item.quantity}
            onChange={(e) => onChange(index, { ...item, quantity: parseInt(e.target.value) || 0 })}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400 cursor-not-allowed">
            {vatRate > 0 ? `${vatRate}%` : '0 VAT'}
          </div>
        </div>

        <div className="md:col-span-2">
          <input
            type="text"
            value={formatWithCommas(priceInput.split('.')[0])}
            onChange={(e) => setPriceInput(e.target.value.replace(/,/g, '').split('.')[0])}
            onBlur={() => flushPrice(priceInput)}
            onFocus={(e) => e.target.select()}
            style={{ fieldSizing: "content", minWidth: "100%" } as any}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <input
            type="text"
            value={formatWithCommas(discountInput.split('.')[0])}
            onChange={(e) => setDiscountInput(e.target.value.replace(/,/g, '').split('.')[0])}
            onBlur={() => onChange(index, { ...item, discount: parseFloat(discountInput) || 0 })}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="md:col-span-2">
          <input
            type="text"
            value={formatWithCommas(costInput.split('.')[0])}
            onChange={(e) => setCostInput(e.target.value.replace(/,/g, '').split('.')[0])}
            onBlur={() => flushCost(costInput)}
            onFocus={(e) => e.target.select()}
            style={{ fieldSizing: "content", minWidth: "100%" } as any}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="md:col-span-2">
          <input
            type="text"
            value={formatWithCommas(totalInput.split('.')[0])}
            onChange={(e) => setTotalInput(e.target.value.replace(/,/g, '').split('.')[0])}
            onBlur={() => {
              const newTotal = parseFloat(totalInput) || 0;
              const safeQty = item.quantity <= 0 ? 1 : item.quantity;
              let newCost = newTotal / safeQty;
              if (purchaseCurrency === 'LBP') newCost = Math.round(newCost);
              setCostInput(newCost.toString());
              flushCost(newCost.toString());
            }}
            onFocus={(e) => e.target.select()}
            style={{ fieldSizing: "content", minWidth: "100%" } as any}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-bold"
          />
        </div>
      </div>


    </div>
  );
};

export const PurchaseView: React.FC = () => {
  const { purchases, suppliers, products, recordPurchase, updatePurchase, deletePurchase, exchangeRate, formatLBP, formatUSD, settings, addNotification } = usePharmacy();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editRowData, setEditRowData] = useState<{
    code: string;
    barcode: string;
    name: string;
    unit: 'box' | 'piece';
    qty: string;
    free: string;
    batch: string;
    expiry: string;
    displayExpiry: string;
    pubPrice: string;
    discount: string;
    cost: string;
    vat: string;
    profit: string;
    total: string;
  } | null>(null);
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseInvoice | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [supplierHighlightedIndex, setSupplierHighlightedIndex] = useState(0);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const supplierListContainerRef = useRef<HTMLDivElement>(null);
  const supplierItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(supplierSearchQuery.toLowerCase())
    );
  }, [suppliers, supplierSearchQuery]);

  useEffect(() => {
    setSupplierHighlightedIndex(0);
  }, [supplierSearchQuery]);

  useEffect(() => {
    if (!isSupplierDropdownOpen) return;
    const activeEl = supplierItemRefs.current[supplierHighlightedIndex];
    const container = supplierListContainerRef.current;
    if (!activeEl || !container) return;

    const activeTop = activeEl.offsetTop;
    const activeHeight = activeEl.offsetHeight;
    const activeBottom = activeTop + activeHeight;
    const containerScrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    if (activeTop < containerScrollTop) {
      container.scrollTop = activeTop;
    } else if (activeBottom > containerScrollTop + containerHeight) {
      container.scrollTop = activeBottom - containerHeight;
    }
  }, [supplierHighlightedIndex, isSupplierDropdownOpen]);

  const handleSupplierKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSupplierDropdownOpen) {
        setIsSupplierDropdownOpen(true);
        setSupplierHighlightedIndex(0);
      } else if (filteredSuppliers.length > 0) {
        setSupplierHighlightedIndex((prev) =>
          Math.min(prev + 1, filteredSuppliers.length - 1)
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isSupplierDropdownOpen) {
        setSupplierHighlightedIndex((prev) => Math.max(prev - 1, 0));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isSupplierDropdownOpen && filteredSuppliers[supplierHighlightedIndex]) {
        const s = filteredSuppliers[supplierHighlightedIndex];
        setSelectedSupplierId(s.id);
        setSupplierSearchQuery(s.name);
        setIsSupplierDropdownOpen(false);
      }
      setTimeout(() => invoiceDateRef.current?.focus(), 0);
    } else if (e.key === 'Escape') {
      setIsSupplierDropdownOpen(false);
    }
  };

  const invoiceDateRef = useRef<HTMLInputElement>(null);
  const paymentStatusRef = useRef<HTMLSelectElement>(null);
  const currencyRef = useRef<HTMLSelectElement>(null);

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPaid, setIsPaid] = useState(true);

  useEffect(() => {
    if (!isSupplierDropdownOpen) {
      const sel = suppliers.find(s => s.id === selectedSupplierId);
      if (sel) {
        setSupplierSearchQuery(sel.name);
      }
    }
  }, [selectedSupplierId, isSupplierDropdownOpen, suppliers]);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        supplierDropdownRef.current &&
        !supplierDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSupplierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // New Purchase Items
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [currentProductId, setCurrentProductId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');

  const [itemQty, setItemQty] = useState('0');
  const [itemFree, setItemFree] = useState('0');
  const [itemProfitPercent, setItemProfitPercent] = useState('0');

  const [itemVATChoice, setItemVATChoice] = useState<'setting' | 'none'>('setting');
  const [itemCostUSD, setItemCostUSD] = useState('0');
  const [itemTotalInput, setItemTotalInput] = useState('0');
  const [isTotalFocused, setIsTotalFocused] = useState(false);
  const [isPublicPriceFocused, setIsPublicPriceFocused] = useState(false);
  const [isDiscountFocused, setIsDiscountFocused] = useState(false);
  const [itemDiscount, setItemDiscount] = useState('0');
  const [itemPublicPrice, setItemPublicPrice] = useState('0');
  const [itemBatch, setItemBatch] = useState('');
  const [itemExpiry, setItemExpiry] = useState('');
  const [displayExpiry, setDisplayExpiry] = useState('');
  const [itemUnit, setItemUnit] = useState<'box' | 'piece'>('box');
  const [purchaseCurrency, setPurchaseCurrency] = useState<'USD' | 'LBP'>('LBP');

  // Medication Search & Barcode Scanner State
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [scanStatusMessage, setScanStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Add Stock Product from Purchase Form
  const [isAddStockProductModalOpen, setIsAddStockProductModalOpen] = useState(false);
  const [addStockInitialData, setAddStockInitialData] = useState<{
    barcode?: string;
    code?: string;
    name?: string;
    batch?: string;
    expiry?: string;
  }>({});

  const handleOpenAddStockProduct = () => {
    setAddStockInitialData({
      barcode: itemBarcode.trim(),
      code: itemCode.trim(),
      name: productSearchQuery.trim(),
      batch: itemBatch.trim(),
      expiry: itemExpiry.trim() || displayExpiry.trim(),
    });
    setIsAddStockProductModalOpen(true);
  };

  const handleStockProductAdded = (newProd: Product) => {
    selectProduct(newProd, true);
    setScanStatusMessage({
      type: 'success',
      text: `Added "${newProd.name}" (${newProd.code}) to stock inventory and loaded to purchase invoice!`,
    });
    setTimeout(() => {
      setScanStatusMessage((curr) => (curr?.text.includes(newProd.name) ? null : curr));
    }, 5000);
  };

  const showFeedback = (type: 'success' | 'error', text: string, duration = type === 'error' ? 8000 : 4000) => {
    setScanStatusMessage({ type, text });

    setTimeout(() => {
      setScanStatusMessage((curr) => (curr?.text === text ? null : curr));
    }, duration);
  };

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const unitInputRef = useRef<HTMLSelectElement | null>(null);
  const expiryInputRef = useRef<HTMLInputElement | null>(null);
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);
  const freeInputRef = useRef<HTMLInputElement | null>(null);
  const profitPercentInputRef = useRef<HTMLInputElement | null>(null);
  const vatInputRef = useRef<HTMLSelectElement | null>(null);
  const costInputRef = useRef<HTMLInputElement | null>(null);
  const discountInputRef = useRef<HTMLInputElement | null>(null);
  const publicPriceInputRef = useRef<HTMLInputElement | null>(null);
  const totalInputRef = useRef<HTMLInputElement | null>(null);

  const selectedProduct = products.find((p) => p.id === currentProductId);

  const formatWithCommas = (val: string) => {
    if (!val) return '';
    const parts = val.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to find the expiry date and batch number from the most recent purchase for a given product
  const getLastPurchaseDetails = (prod: Product): { expiryDate: string, batchNumber: string, lastItem?: PurchaseItem } => {
    let expiryDate = '';
    let batchNumber = '';
    let lastItem: PurchaseItem | undefined;
    
    if (!purchases || purchases.length === 0) return { expiryDate, batchNumber };

    // Sort purchases by timestamp or date descending (newest first)
    const sorted = [...purchases].sort((a, b) => {
      const timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
      const timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
      return timeB - timeA;
    });

    for (const p of sorted) {
      if (!p.items || p.items.length === 0) continue;
      const foundItem = p.items.find(
        (it) =>
          (it.productId && it.productId === prod.id) ||
          (it.productCode && prod.code && it.productCode.toLowerCase() === prod.code.toLowerCase())
      );
      if (foundItem) {
        if (!lastItem) {
          lastItem = foundItem;
        }
        if (!expiryDate && foundItem.expiryDate && foundItem.expiryDate.trim()) {
          expiryDate = foundItem.expiryDate.trim();
        }
        if (!batchNumber && foundItem.batchNumber && foundItem.batchNumber.trim()) {
          batchNumber = foundItem.batchNumber.trim();
        }
        
        // If we found both, we can break early
        if (expiryDate && batchNumber) break;
      }
    }

    return { expiryDate, batchNumber, lastItem };
  };

  // Helper to format stock in "X box Y pieces" format using product's pieceName
  const formatStockBoxesAndPieces = (prod: Product): string => {
    const isDivisible = Boolean(prod.isDivisible && prod.piecesPerBox && prod.piecesPerBox > 1);

    if (!isDivisible) {
      const qty = Number.isInteger(prod.stockQuantity) ? prod.stockQuantity : prod.stockQuantity.toFixed(2);
      return `${qty} box`;
    }

    const piecesPerBox = prod.piecesPerBox || 1;
    const totalPieces = Math.round((prod.stockQuantity || 0) * piecesPerBox);
    const boxes = Math.floor(totalPieces / piecesPerBox);
    const pieces = totalPieces % piecesPerBox;

    const rawPieceName = prod.pieceName?.trim() || 'piece';
    const pieceLabel =
      pieces > 1 && !rawPieceName.toLowerCase().endsWith('s')
        ? `${rawPieceName}s`
        : rawPieceName;

    if (pieces > 0) {
      return `${boxes} box ${pieces} ${pieceLabel}`;
    }
    return `${boxes} box`;
  };

  const selectProduct = (prod: Product, autoFocusQty = true) => {
    setCurrentProductId(prod.id);
    const defaultCost = prod.costPriceUSD != null ? prod.costPriceUSD : 0;
    setItemCostUSD(purchaseCurrency === 'USD' ? defaultCost.toString() : Math.round(defaultCost * exchangeRate).toString());
    setItemUnit('box');

    setItemCode(prod.code || '');
    setItemBarcode(prod.barcode || '');

    const additionalDetails = [prod.dosage, prod.presentation, prod.form].filter(Boolean).join(' ');
    setProductSearchQuery(`${prod.name}${additionalDetails ? ` ${additionalDetails}` : ''}`);
    setIsSearchDropdownOpen(false);
    setScanStatusMessage(null);

    // Fetch last purchase details (batch and expiry)
    const lastDetails = getLastPurchaseDetails(prod);

    // Auto-fill batch
    if (lastDetails.batchNumber) {
      setItemBatch(lastDetails.batchNumber);
    } else if (prod.batches && prod.batches.length > 0) {
      setItemBatch(prod.batches[0].batchNumber || '');
    } else {
      setItemBatch(prod.batchNumber || '');
    }

    // Expiry date: use expiry from the last purchase for this product directly, or keep blank if not found
    const lastExpiry = lastDetails.expiryDate;

    if (lastExpiry) {
      if (lastExpiry.includes('-')) {
        const parts = lastExpiry.split('-');
        let year = parts[0].trim();
        let month = parts[1] ? parts[1].trim() : '01';
        if (year.length <= 2 && month.length === 4) {
          const tmp = year;
          year = month;
          month = tmp;
        }
        if (year.length === 2) year = `20${year}`;
        month = month.padStart(2, '0');
        setItemExpiry(`${year}-${month}-01`);
        setDisplayExpiry(`${month}/${year}`);
      } else if (lastExpiry.includes('/')) {
        const parts = lastExpiry.split('/');
        const month = parts[0].trim().padStart(2, '0');
        let year = parts[1].trim();
        if (year.length === 2) year = `20${year}`;
        setItemExpiry(`${year}-${month}-01`);
        setDisplayExpiry(`${month}/${year}`);
      } else {
        const digits = lastExpiry.replace(/\D/g, '');
        if (digits.length === 4) {
          const month = digits.slice(0, 2);
          const year = `20${digits.slice(2, 4)}`;
          setItemExpiry(`${year}-${month}-01`);
          setDisplayExpiry(`${month}/${year}`);
        } else if (digits.length === 6) {
          const month = digits.slice(0, 2);
          const year = digits.slice(2, 6);
          setItemExpiry(`${year}-${month}-01`);
          setDisplayExpiry(`${month}/${year}`);
        } else {
          setItemExpiry(lastExpiry);
          setDisplayExpiry(lastExpiry);
        }
      }
    } else {
      // If not found, keep it blank
      setItemExpiry('');
      setDisplayExpiry('');
    }

    if (autoFocusQty) {
      // Always focus the expiry input so user can review or enter the date
      setTimeout(() => {
        expiryInputRef.current?.focus();
        expiryInputRef.current?.select();
      }, 50);
    }

    // Discount & Public Price logic
    let initialDiscount = 0;
    if (lastDetails.lastItem && lastDetails.lastItem.discount !== undefined) {
      initialDiscount = lastDetails.lastItem.discount;
    } else {
      initialDiscount = prod.pharmacistMarginProfit || 0;
    }
    setItemDiscount(initialDiscount.toString());

    const lastPurchasedPublicPriceUSD = lastDetails.lastItem?.sellingPriceUSD || 0;
    const lastPurchasedPublicPriceLBP = lastDetails.lastItem?.sellingPriceLBP || 0;
    const stockPublicPriceUSD = prod.priceUSD || 0;
    const stockPublicPriceLBP = prod.priceLBP || 0;

    let derivedPublicPrice = 0;
    if (purchaseCurrency === 'USD') {
      derivedPublicPrice = lastPurchasedPublicPriceUSD > 0 ? lastPurchasedPublicPriceUSD : stockPublicPriceUSD;
    } else {
      derivedPublicPrice = lastPurchasedPublicPriceLBP > 0 ? lastPurchasedPublicPriceLBP : stockPublicPriceLBP;
    }
    
    if (derivedPublicPrice === 0) {
      const parsedCost = purchaseCurrency === 'USD' ? defaultCost : Math.round(defaultCost * exchangeRate);
      if (initialDiscount < 100) {
        derivedPublicPrice = parsedCost / (1 - initialDiscount / 100);
      } else {
        derivedPublicPrice = parsedCost;
      }

      // Add VAT if chosen
      if (itemVATChoice === 'setting') {
        const vatRate = settings.vatRates?.[prod.category] || 0;
        derivedPublicPrice += parsedCost * (vatRate / 100);
      }

      if (purchaseCurrency === 'LBP') {
        derivedPublicPrice = Math.round(derivedPublicPrice);
      } else {
        derivedPublicPrice = Math.round(derivedPublicPrice);
      }
    }
    
    setItemPublicPrice(derivedPublicPrice.toString());

    if (autoFocusQty) {
      setTimeout(() => unitInputRef.current?.focus(), 50);
    }
  };

  // Comprehensive product lookup by barcode or code with fuzzy / clean matching
  const findProductByBarcode = useCallback((query: string): Product | undefined => {
    const clean = query.trim().toLowerCase();
    if (!clean) return undefined;

    // 1. Direct barcode match
    let found = products.find((p) => (p.barcode || '').trim().toLowerCase() === clean);
    if (found) return found;

    // 2. Direct code match
    found = products.find((p) => p.code.trim().toLowerCase() === clean);
    if (found) return found;

    // 3. Match without spaces, hyphens, or underscores
    const noDashes = clean.replace(/[\s-_]/g, '');
    if (noDashes.length >= 3) {
      found = products.find((p) => {
        const pBarcode = (p.barcode || '').trim().toLowerCase().replace(/[\s-_]/g, '');
        const pCode = p.code.trim().toLowerCase().replace(/[\s-_]/g, '');
        return pBarcode === noDashes || pCode === noDashes;
      });
      if (found) return found;
    }

    // 4. Strip leading zeros (common with UPC-A vs EAN-13 conversions)
    const noLeadingZeros = clean.replace(/^0+/, '');
    if (noLeadingZeros.length >= 4) {
      found = products.find((p) => {
        const pBarcode = (p.barcode || '').trim().toLowerCase().replace(/^0+/, '');
        const pCode = p.code.trim().toLowerCase().replace(/^0+/, '');
        return (pBarcode && pBarcode === noLeadingZeros) || (pCode && pCode === noLeadingZeros);
      });
      if (found) return found;
    }

    return undefined;
  }, [products]);

  // Barcode input scanner tracking & processing
  const barcodeLastKeyTimeRef = useRef<number>(0);
  const barcodeKeyCountRef = useRef<number>(0);
  const barcodeScanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleProcessBarcode = useCallback((rawInputVal?: string) => {
    if (barcodeScanTimeoutRef.current) {
      clearTimeout(barcodeScanTimeoutRef.current);
      barcodeScanTimeoutRef.current = null;
    }

    const inputEl = barcodeInputRef.current;
    const raw = (rawInputVal !== undefined ? rawInputVal : (inputEl ? inputEl.value : itemBarcode)).trim();
    if (!raw) {
      searchInputRef.current?.focus();
      return;
    }

    const match = findProductByBarcode(raw);
    if (match) {
      selectProduct(match, false);
      showFeedback('success', `Found: ${match.name} (${match.barcode || match.code})`);
      setTimeout(() => {
        unitInputRef.current?.focus();
      }, 60);
    } else {
      showFeedback('error', `Barcode "${raw}" not found in stock list.`);
      if (inputEl) {
        inputEl.select();
      }
    }
  }, [findProductByBarcode, itemBarcode, selectProduct, showFeedback]);

  // Global Barcode Scanner Listener when New Purchase modal is open
  useBarcodeScanner({
    onScan: (scanned) => {
      if (!isCreateOpen) return;
      const clean = scanned.trim();
      if (!clean) return;

      const match = findProductByBarcode(clean);
      if (match) {
        selectProduct(match, false);
        showFeedback('success', `Scanned: ${match.name} (${match.barcode || match.code})`);
        setTimeout(() => unitInputRef.current?.focus(), 60);
      } else {
        showFeedback('error', `Barcode "${clean}" not found in inventory. You can search by name or code.`);
      }
    },
  });

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    const interval = now - barcodeLastKeyTimeRef.current;
    if (interval < 60) {
      barcodeKeyCountRef.current += 1;
    } else {
      barcodeKeyCountRef.current = 1;
    }
    barcodeLastKeyTimeRef.current = now;

    if (e.key === 'Enter' || e.key === 'Tab') {
      const val = (e.currentTarget.value || itemBarcode).trim();
      if (val) {
        e.preventDefault();
        e.stopPropagation();
        handleProcessBarcode(val);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
  };

  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setItemBarcode(newVal);

    if (barcodeScanTimeoutRef.current) {
      clearTimeout(barcodeScanTimeoutRef.current);
    }

    const trimmed = newVal.trim();
    const isRapid = barcodeKeyCountRef.current >= 3;

    if (trimmed.length >= 4) {
      const delay = isRapid ? 80 : 350;
      barcodeScanTimeoutRef.current = setTimeout(() => {
        const match = findProductByBarcode(trimmed);
        if (match && (isRapid || trimmed === match.barcode || trimmed === match.code)) {
          handleProcessBarcode(trimmed);
        }
      }, delay);
    }
  };

  const handleBarcodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (pasted) {
      e.preventDefault();
      setItemBarcode(pasted);
      handleProcessBarcode(pasted);
    }
  };

  useEffect(() => {
    if (itemPublicPrice === '0' || itemPublicPrice === '') {
      const parsedCost = parseFloat(itemCostUSD) || 0;
      const parsedDiscount = parseFloat(itemDiscount) || 0;
      if (parsedCost > 0 && parsedDiscount < 100) {
        let calc = parsedCost / (1 - parsedDiscount / 100);
        
        const vatRate = itemVATChoice === 'setting' && selectedProduct ? (settings.vatRates?.[selectedProduct.category] || 0) : 0;
        calc += parsedCost * (vatRate / 100);

        if (purchaseCurrency === 'LBP') calc = Math.round(calc);
        else calc = Math.round(calc);
        setItemPublicPrice(calc.toString());
      }
    }
    // We explicitly omit `itemPublicPrice` from dependencies.
    // This effect should only recalculate the public price when the COST or DISCOUNT
    // changes from their source, AND the public price is currently blank/zero.
    // Including `itemPublicPrice` causes a bug where the user deleting the last digit 
    // triggers this effect, which sees '' and instantly repopulates it with the calculation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCostUSD, itemDiscount, purchaseCurrency, itemVATChoice, selectedProduct, settings]);

  useEffect(() => {
    if (isPublicPriceFocused || isDiscountFocused) {
      const pubPrice = parseFloat(itemPublicPrice) || 0;
      const discount = parseFloat(itemDiscount) || 0;
      
      let newCost = pubPrice - (pubPrice * (discount / 100));
      
      if (purchaseCurrency === 'LBP') newCost = Math.round(newCost);
      else newCost = Number(newCost.toFixed(2));
      
      setItemCostUSD(newCost.toString());
    }
  }, [itemPublicPrice, itemDiscount, isPublicPriceFocused, isDiscountFocused, purchaseCurrency]);

  useEffect(() => {
    if (!isTotalFocused) {
      const qty = parseInt(itemQty, 10) || 0;
      const cost = parseFloat(itemCostUSD) || 0;
      let calculated = qty * cost;
      if (purchaseCurrency !== 'USD') {
        calculated = Math.round(calculated);
      }
      setItemTotalInput(calculated.toString());
    }
  }, [itemCostUSD, itemQty, isTotalFocused, purchaseCurrency]);

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    let digits = input.replace(/[^\d]/g, '');
    if (digits.length > 8) digits = digits.slice(0, 8);

    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else if (digits.length === 2 && input.endsWith('/')) {
      formatted = `${digits}/`;
    } else if (digits.length === 4 && input.endsWith('/')) {
      formatted = `${digits.slice(0,2)}/${digits.slice(2)}/`;
    }

    setDisplayExpiry(formatted);
  };

  const handleExpiryBlur = () => {
    let input = displayExpiry.trim();
    if (!input) {
      setItemExpiry('');
      return;
    }

    const digits = input.replace(/[^\d]/g, '');
    let d = 0, m = 0, y = 0;

    if (digits.length === 4) {
      m = parseInt(digits.slice(0, 2), 10);
      y = 2000 + parseInt(digits.slice(2, 4), 10);
    } else if (digits.length === 6) {
      const p1 = parseInt(digits.slice(0, 2), 10);
      const p2 = parseInt(digits.slice(2, 4), 10);
      const p3 = parseInt(digits.slice(4, 6), 10);
      if (p1 <= 12 && p2 === 20) {
         m = p1;
         y = parseInt(digits.slice(2, 6), 10);
      } else if (p2 <= 12) {
         d = p1;
         m = p2;
         y = 2000 + p3;
      } else {
         m = p1;
         y = parseInt(digits.slice(2, 6), 10);
      }
    } else if (digits.length === 8) {
      d = parseInt(digits.slice(0, 2), 10);
      m = parseInt(digits.slice(2, 4), 10);
      y = parseInt(digits.slice(4, 8), 10);
    } else {
      return;
    }

    if (m >= 1 && m <= 12) {
      if (d === 0 || d > 31) {
        d = new Date(y, m, 0).getDate();
      }
      const dd = d.toString().padStart(2, '0');
      const mm = m.toString().padStart(2, '0');
      const yyyy = y.toString();
      
      setDisplayExpiry(`${dd}/${mm}/${yyyy}`);
      setItemExpiry(`${yyyy}-${mm}-${dd}`);
    }
  };

  // Filter products by query: name, code, barcode, ingredients, or agent
  const filteredProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) {
      const supplier = suppliers.find((s) => s.id === selectedSupplierId);
      const supplierName = supplier?.name.toLowerCase() || '';
      return [...products]
        .sort((a, b) => {
          const aMatchesSupplier =
            supplierName && (a.agent || '').toLowerCase().includes(supplierName) ? -1 : 1;
          const bMatchesSupplier =
            supplierName && (b.agent || '').toLowerCase().includes(supplierName) ? -1 : 1;
          return aMatchesSupplier - bMatchesSupplier;
        })
        .slice(0, 30);
    }

    return filterProductsByMultiWordQuery(products, q, 'all').slice(0, 50);
  }, [products, productSearchQuery, selectedSupplierId, suppliers]);

  // Auto-scroll highlighted item into view within the dropdown so it is 100% visible at all times
  useEffect(() => {
    if (!isSearchDropdownOpen) return;
    const activeEl = itemRefs.current[highlightedIndex];
    const container = listContainerRef.current;
    if (!activeEl || !container) return;

    const activeTop = activeEl.offsetTop;
    const activeHeight = activeEl.offsetHeight;
    const activeBottom = activeTop + activeHeight;
    const containerScrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const containerScrollBottom = containerScrollTop + containerHeight;

    if (activeTop < containerScrollTop) {
      // Scrolled above visible viewport: align with top plus comfortable cushion
      container.scrollTo({
        top: Math.max(0, activeTop - 6),
        behavior: 'auto',
      });
    } else if (activeBottom > containerScrollBottom) {
      // Scrolled below visible viewport: align with bottom plus comfortable cushion
      container.scrollTo({
        top: activeBottom - containerHeight + 8,
        behavior: 'auto',
      });
    }
  }, [highlightedIndex, isSearchDropdownOpen]);

  // Reset highlight index to 0 when search query or supplier changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [productSearchQuery, selectedSupplierId]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSearchDropdownOpen) {
        setIsSearchDropdownOpen(true);
        setHighlightedIndex(0);
      } else if (filteredProducts.length > 0) {
        setHighlightedIndex((prev) =>
          prev < filteredProducts.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isSearchDropdownOpen) {
        setIsSearchDropdownOpen(true);
        setHighlightedIndex(filteredProducts.length > 0 ? filteredProducts.length - 1 : 0);
      } else if (filteredProducts.length > 0) {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredProducts.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = productSearchQuery.trim().toLowerCase();

      // If nothing is typed, just open the dropdown and do not auto-select
      if (!q) {
        setIsSearchDropdownOpen(true);
        return;
      }

      // 1. Exact barcode or code match takes priority if user typed or scanned
      const exactMatch = products.find(
        (p) =>
          (p.barcode || '').toLowerCase() === q ||
          p.code.toLowerCase() === q
      );

      if (exactMatch) {
        selectProduct(exactMatch, true);
        setScanStatusMessage({
          type: 'success',
          text: `Found: ${exactMatch.name} (${exactMatch.barcode || exactMatch.code})`,
        });
        setTimeout(() => setScanStatusMessage(null), 3000);
        return;
      }

      // 2. Select highlighted item from dropdown list
      // BUT ONLY IF the dropdown was already open and user is explicitly highlighting something.
      // If they just typed "a" and pressed enter, we should open the dropdown so they can see the list.
      if (filteredProducts.length > 0 && isSearchDropdownOpen) {
        const safeIndex =
          highlightedIndex >= 0 && highlightedIndex < filteredProducts.length
            ? highlightedIndex
            : 0;
        const targetProduct = filteredProducts[safeIndex];
        if (targetProduct) {
          selectProduct(targetProduct, true);
          setScanStatusMessage({
            type: 'success',
            text: `Selected: ${targetProduct.name} (${targetProduct.code})`,
          });
          setTimeout(() => setScanStatusMessage(null), 2500);
          return;
        }
      } else {
         // Open dropdown if it wasn't open so user can pick
         setIsSearchDropdownOpen(true);
         return;
      }

      // 3. Fallback message if no match found
      if (q) {
        setScanStatusMessage({
          type: 'error',
          text: `No item matches "${productSearchQuery.trim()}". Try another name, code, or barcode.`,
        });
        setTimeout(() => setScanStatusMessage(null), 3500);
      }
    } else if (e.key === 'Escape') {
      setIsSearchDropdownOpen(false);
    }
  };

  
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    code: 80,
    barcode: 100,
    name: 200,
    unit: 70,
    qty: 70,
    free: 70,
    batch: 80,
    expiry: 80,
    pubPrice: 80,
    discount: 70,
    cost: 80,
    vat: 70,
    profit: 70,
    total: 90,
    action: 60,
  });

  const handleColResizeStart = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.pageX;
    const startWidth = colWidths[col] || 100;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.pageX - startX;
      setColWidths(prev => ({
        ...prev,
        [col]: Math.max(40, startWidth + delta)
      }));
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

  const handleAddItemToInvoice = () => {
    if (!selectedProduct) {
      setScanStatusMessage({
        type: 'error',
        text: 'Please select or scan an item first.',
      });
      searchInputRef.current?.focus();
      return;
    }
    const parsedQty = parseInt(itemQty, 10);
    const qty = isNaN(parsedQty) ? 0 : parsedQty;
    const parsedCost = parseFloat(itemCostUSD);
    const parsedDiscount = parseFloat(itemDiscount) || 0;
    const parsedPublicPrice = parseFloat(itemPublicPrice) || 0;
    
    let costUSD = 0;
    let costLBP = 0;
    let publicPriceUSD = 0;
    let publicPriceLBP = 0;
    
    if (purchaseCurrency === 'USD') {
      costUSD = isNaN(parsedCost) ? (selectedProduct.costPriceUSD || 0) : parsedCost;
      costLBP = Math.round(costUSD * exchangeRate);
      publicPriceUSD = parsedPublicPrice;
      publicPriceLBP = Math.round(parsedPublicPrice * exchangeRate);
    } else {
      costLBP = isNaN(parsedCost) ? Math.round((selectedProduct.costPriceUSD || 0) * exchangeRate) : parsedCost;
      costUSD = costLBP / exchangeRate;
      publicPriceLBP = parsedPublicPrice;
      publicPriceUSD = parsedPublicPrice / exchangeRate;
    }

    let finalExpiry = itemExpiry;
    if (!finalExpiry && displayExpiry.trim()) {
      const digits = displayExpiry.replace(/\D/g, '');
      let d = 0, m = 0, y = 0;
      if (digits.length === 4) {
        m = parseInt(digits.slice(0, 2), 10);
        y = 2000 + parseInt(digits.slice(2, 4), 10);
      } else if (digits.length === 6) {
        const p1 = parseInt(digits.slice(0, 2), 10);
        const p2 = parseInt(digits.slice(2, 4), 10);
        const p3 = parseInt(digits.slice(4, 6), 10);
        if (p1 <= 12 && p2 === 20) {
           m = p1; y = parseInt(digits.slice(2, 6), 10);
        } else if (p2 <= 12) {
           d = p1; m = p2; y = 2000 + p3;
        } else {
           m = p1; y = parseInt(digits.slice(2, 6), 10);
        }
      } else if (digits.length === 8) {
        d = parseInt(digits.slice(0, 2), 10);
        m = parseInt(digits.slice(2, 4), 10);
        y = parseInt(digits.slice(4, 8), 10);
      }
      if (m >= 1 && m <= 12) {
        if (d === 0 || d > 31) d = new Date(y, m, 0).getDate();
        finalExpiry = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      } else {
        finalExpiry = displayExpiry.trim();
      }
    }

    setItems((prev) => [
      ...prev,
      {
        productId: selectedProduct.id,
        productCode: selectedProduct.code,
        productName: selectedProduct.name,
        quantity: qty,
        unitCostUSD: costUSD,
        unitCostLBP: costLBP,
        sellingPriceLBP: publicPriceLBP,
        sellingPriceUSD: publicPriceUSD,
        discount: parsedDiscount,
        batchNumber: itemBatch || selectedProduct.batchNumber || '',
        expiryDate: finalExpiry || '',
        isPiece: itemUnit === 'piece',
      },
    ]);

    // Reset current item inputs & search query for fast next entry
    setCurrentProductId('');
    setProductSearchQuery('');
    setItemQty('0');
    setItemCode('');
    setItemBarcode('');
    setItemFree('0');
    setItemProfitPercent('0');
    setItemVATChoice('setting');
    setItemCostUSD('0');
    setItemTotalInput('0');
    setItemDiscount('0');
    setItemPublicPrice('0');
    setItemBatch('');
    setItemExpiry('');
    setDisplayExpiry('');
    setItemUnit('box');
    setScanStatusMessage(null);
    setIsSearchDropdownOpen(false);

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditItem = (index: number) => {
    const item = items[index];
    const match = products.find(p => p.id === item.productId);
    const vatRate = match ? (settings.vatRates?.[match.category] || 0) : 0;
    const unitCost = purchaseCurrency === 'USD' ? item.unitCostUSD : item.unitCostLBP;
    const pubPrice = purchaseCurrency === 'USD' ? (item.sellingPriceUSD || 0) : item.sellingPriceLBP;
    const total = unitCost * item.quantity;
    let profit = pubPrice - unitCost;
    if (purchaseCurrency !== 'LBP') profit = Number(profit.toFixed(2));
    const profitPerc = unitCost > 0 ? ((profit / unitCost) * 100).toFixed(1) : '0.0';

    setEditingRowIndex(index);
    setEditRowData({
      code: item.productCode,
      barcode: match?.barcode || '',
      name: item.productName,
      unit: item.isPiece ? 'piece' : 'box',
      qty: item.quantity.toString(),
      free: (item.freeQty || 0).toString(),
      cost: unitCost.toString(),
      pubPrice: pubPrice.toString(),
      discount: (item.discount || 0).toString(),
      batch: item.batchNumber || '',
      expiry: item.expiryDate || '',
      displayExpiry: item.expiryDate || '',
      vat: vatRate.toString(),
      profit: profitPerc.toString(),
      total: total.toString()
    });
  };

  const handleSaveEditRow = () => {
    if (editingRowIndex === null || !editRowData) return;
    const item = items[editingRowIndex];
    const match = products.find(p => p.id === item.productId);
    if (!match) return;

    const parsedQty = parseInt(editRowData.qty, 10);
    const qty = isNaN(parsedQty) ? 0 : parsedQty;
    const parsedFree = parseInt(editRowData.free, 10);
    const freeQty = isNaN(parsedFree) ? 0 : parsedFree;
    const parsedCost = parseFloat(editRowData.cost);
    const parsedDiscount = parseFloat(editRowData.discount) || 0;
    const parsedPublicPrice = parseFloat(editRowData.pubPrice) || 0;
    
    let costUSD = 0;
    let costLBP = 0;
    let publicPriceUSD = 0;
    let publicPriceLBP = 0;
    
    if (purchaseCurrency === 'USD') {
      costUSD = isNaN(parsedCost) ? (match.costPriceUSD || 0) : parsedCost;
      costLBP = Math.round(costUSD * exchangeRate);
      publicPriceUSD = parsedPublicPrice;
      publicPriceLBP = Math.round(parsedPublicPrice * exchangeRate);
    } else {
      costLBP = isNaN(parsedCost) ? Math.round((match.costPriceUSD || 0) * exchangeRate) : parsedCost;
      costUSD = costLBP / exchangeRate;
      publicPriceLBP = parsedPublicPrice;
      publicPriceUSD = parsedPublicPrice / exchangeRate;
    }

    let finalExpiry = editRowData.expiry;
    if (!finalExpiry && editRowData.displayExpiry.trim()) {
      const digits = editRowData.displayExpiry.replace(/\D/g, '');
      let d = 0, m = 0, y = 0;
      if (digits.length === 4) {
        m = parseInt(digits.slice(0, 2), 10);
        y = 2000 + parseInt(digits.slice(2, 4), 10);
      } else if (digits.length === 6) {
        const p1 = parseInt(digits.slice(0, 2), 10);
        const p2 = parseInt(digits.slice(2, 4), 10);
        const p3 = parseInt(digits.slice(4, 6), 10);
        if (p1 <= 12 && p2 === 20) {
           m = p1; y = parseInt(digits.slice(2, 6), 10);
        } else if (p2 <= 12) {
           d = p1; m = p2; y = 2000 + p3;
        } else {
           m = p1; y = parseInt(digits.slice(2, 6), 10);
        }
      } else if (digits.length === 8) {
        d = parseInt(digits.slice(0, 2), 10);
        m = parseInt(digits.slice(2, 4), 10);
        y = parseInt(digits.slice(4, 8), 10);
      }
      
      if (m >= 1 && m <= 12) {
        if (d === 0 || d > 31) d = new Date(y, m, 0).getDate();
        finalExpiry = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      } else {
        finalExpiry = editRowData.displayExpiry.trim();
      }
    }

    setItems((prev) => {
      const updated = [...prev];
      updated[editingRowIndex] = {
        ...updated[editingRowIndex],
        productCode: editRowData.code,
        productName: editRowData.name,
        quantity: qty,
        freeQty: freeQty,
        isPiece: editRowData.unit === 'piece',
        unitCostUSD: costUSD,
        unitCostLBP: costLBP,
        sellingPriceLBP: publicPriceLBP,
        sellingPriceUSD: publicPriceUSD,
        discount: parsedDiscount,
        batchNumber: editRowData.batch || match.batchNumber || '',
        expiryDate: finalExpiry || ''
      };
      return updated;
    });

    setEditingRowIndex(null);
    setEditRowData(null);
  };

  const totalCostUSD = items.reduce((sum, item) => sum + item.unitCostUSD * item.quantity, 0);
  const totalCostLBP = Math.round(totalCostUSD * exchangeRate);

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);

    if (editingPurchaseId) {
      updatePurchase(editingPurchaseId, {
        supplierId: selectedSupplierId,
        supplierName: supplier?.name || 'General Supplier',
        date: invoiceDate,
        items,
        totalCostUSD,
        totalCostLBP,
        paid: isPaid,
        currency: purchaseCurrency,
      });
    } else {
      recordPurchase({
        supplierId: selectedSupplierId,
        supplierName: supplier?.name || 'General Supplier',
        date: invoiceDate,
        items,
        totalCostUSD,
        totalCostLBP,
        exchangeRate,
        status: 'received',
        paid: isPaid,
        currency: purchaseCurrency,
      });
    }

    setItems([]);
    setEditingPurchaseId(null);
    setIsCreateOpen(false);
  };

  const handleOpenCreate = () => {
    setIsCreateOpen(true);
    setEditingPurchaseId(null);
    setItems([]);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setIsPaid(true);
    setPurchaseCurrency('LBP');
    setCurrentProductId('');
    setProductSearchQuery('');
    setItemQty('0');
    setItemCode('');
    setItemBarcode('');
    setItemVATChoice('setting');
    setItemCostUSD('0');
    setItemTotalInput('0');
    setItemDiscount('0');
    setItemPublicPrice('0');
    setItemBatch('');
    setItemExpiry('');
    setDisplayExpiry('');
    setScanStatusMessage(null);
    setIsSearchDropdownOpen(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleEditPurchase = (inv: PurchaseInvoice) => {
    setEditingPurchaseId(inv.id);
    setSelectedSupplierId(inv.supplierId);
    setInvoiceDate(inv.date);
    setIsPaid(inv.paid);
    setPurchaseCurrency(inv.currency || 'LBP');
    setItems(inv.items || []);
    setCurrentProductId('');
    setProductSearchQuery('');
    setItemQty('0');
    setItemCode('');
    setItemBarcode('');
    setItemVATChoice('setting');
    setItemCostUSD('0');
    setItemTotalInput('0');
    setItemDiscount('0');
    setItemPublicPrice('0');
    setItemBatch('');
    setItemExpiry('');
    setDisplayExpiry('');
    setScanStatusMessage(null);
    setIsSearchDropdownOpen(false);
    setIsCreateOpen(true);
  };

  const handleDeletePurchase = (id: string) => {
    if (confirm('Are you sure you want to delete this purchase? This will revert the stock added.')) {
      deletePurchase(id);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f8fafc] dark:bg-slate-950 p-3.5 space-y-3 select-none">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center space-x-2">
            <SectionRestoreButton section="purchase" />
            <Truck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
              Purchases & Supplier Invoices
            </h2>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Restock inventory from Lebanese agents (Mersaco, Omnipharma, Fattal) & track shipment arrivals.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center space-x-1 rounded bg-teal-600 px-2 py-1 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Purchase Invoice</span>
        </button>
      </div>

      {/* Invoices Table */}
      <div className="flex-1 overflow-hidden rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="py-2 px-3">Invoice #</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Supplier</th>
                <th className="py-2 px-3">Items Received</th>
                <th className="py-2 px-3">Total USD ($)</th>
                <th className="py-2 px-3">Total LBP</th>
                <th className="py-2 px-3">Rate Applied</th>
                <th className="py-2 px-3">Payment Status</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-400">
                    No purchase invoices registered yet.
                  </td>
                </tr>
              ) : (
                purchases.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-slate-300">
                      {inv.date}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {inv.supplierName}
                    </td>
                    <td className="py-2 px-3">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                        {(inv.items || []).reduce((s, i) => s + i.quantity, 0)} units ({(inv.items || []).length} items)
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-blue-600 dark:text-blue-400">
                      ${inv.totalCostUSD.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 font-medium text-green-700 dark:text-green-400">
                      {formatLBPValue(inv.totalCostLBP)} LBP
                    </td>
                    <td className="py-2 px-3 text-gray-500 font-mono text-[10px]">
                      1$ = {formatLBPValue(inv.exchangeRate)} LBP
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          inv.paid
                            ? 'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-300'
                            : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {inv.paid ? 'Settled (Paid)' : 'Pending Debt'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setViewingPurchase(inv)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditPurchase(inv)}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 hover:text-teal-700 dark:text-teal-400 dark:hover:bg-teal-900/30 rounded"
                          title="Edit Purchase"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePurchase(inv.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30 rounded"
                          title="Delete Purchase"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingPurchase && (
        <DesktopWindow
          title={`Purchase Invoice Details - ${viewingPurchase.invoiceNumber}`}
          isOpen={true}
          section="purchase"
          onClose={() => setViewingPurchase(null)}
          width="600px"
          height="auto"
        >
          <div className="p-5 space-y-4 text-sm text-slate-800 dark:text-slate-200">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500">Supplier</span>
                <span className="font-semibold">{viewingPurchase.supplierName}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500">Date</span>
                <span className="font-semibold">{viewingPurchase.date}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500">Payment Status</span>
                <span className={`inline-block mt-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  viewingPurchase.paid
                    ? 'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-300'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {viewingPurchase.paid ? 'Paid' : 'Unpaid Debt'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500">Exchange Rate</span>
                <span className="font-semibold">{formatLBPValue(viewingPurchase.exchangeRate)} LBP</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">Items</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {viewingPurchase.items.map((it, idx) => {
                  const productDetails = products.find(p => p.id === it.productId);
                  return (
                  <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                    <div>
                      <div className="font-bold">
                        {it.productName}
                        {productDetails && (
                          <span className="ml-1.5 font-normal text-slate-500 text-[11px]">
                            {productDetails.dosage} {productDetails.presentation} {productDetails.form}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {it.quantity} {it.isPiece ? 'pieces' : 'units'} • Batch: {it.batchNumber} • Exp: {it.expiryDate}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-600 dark:text-blue-400">${(it.quantity * it.unitCostUSD).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500">@ ${it.unitCostUSD.toFixed(2)} / ea</div>
                    </div>
                  </div>
                )})}
              </div>
            </div>

            <div className="flex justify-end items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-lg space-x-4">
              <div className="text-right">
                <span className="block text-[10px] uppercase font-bold text-slate-500">Total USD</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">${viewingPurchase.totalCostUSD.toFixed(2)}</span>
              </div>
              <div className="text-right border-l border-slate-200 dark:border-slate-700 pl-4">
                <span className="block text-[10px] uppercase font-bold text-slate-500">Total LBP</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">{formatLBPValue(viewingPurchase.totalCostLBP)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold transition-colors dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}

      {/* New Purchase Modal */}
      {isCreateOpen && (
        <DesktopWindow
          title={editingPurchaseId ? "Edit Purchase Invoice" : "Receive Supplier Shipment (Restock Inventory)"}
          isOpen={true}
          section="purchase"
          onClose={() => {
            if (items.length > 0) {
              setShowCloseConfirm(true);
            } else {
              setIsCreateOpen(false);
            }
          }}
          width="700px"
          height="auto"
        >
          <form 
            onSubmit={handleSavePurchase} 
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                e.preventDefault();
              }
            }}
            className="px-3 pt-2 pb-3 space-y-2 text-xs flex-1 flex flex-col justify-start overflow-auto min-h-0"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div ref={supplierDropdownRef} className="relative">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={supplierSearchQuery}
                    onChange={(e) => {
                      setSupplierSearchQuery(e.target.value);
                      setIsSupplierDropdownOpen(true);
                      setSupplierHighlightedIndex(0);
                    }}
                    onFocus={() => setIsSupplierDropdownOpen(true)}
                    onKeyDown={handleSupplierKeyDown}
                    placeholder="Search supplier..."
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <ChevronDown className="absolute right-2 top-1.5 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                  
                {isSupplierDropdownOpen && (
                  <div 
                    ref={supplierListContainerRef}
                    className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                  >
                    {filteredSuppliers.map((s, index) => (
                        <div
                          key={s.id}
                          ref={(el) => { supplierItemRefs.current[index] = el; }}
                          className={`px-3 py-2 cursor-pointer text-sm flex items-center justify-between ${
                            supplierHighlightedIndex === index
                              ? 'bg-teal-50 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 font-semibold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                          } ${selectedSupplierId === s.id && supplierHighlightedIndex !== index ? 'font-semibold text-teal-700 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/20' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedSupplierId(s.id);
                            setSupplierSearchQuery(s.name);
                            setIsSupplierDropdownOpen(false);
                          }}
                        >
                          <span>{s.name}</span>
                          {!s.code.toUpperCase().startsWith('MOPH-') && (
                            <span className="text-[10px] text-slate-400 font-mono">{s.code}</span>
                          )}
                        </div>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <div className="px-3 py-4 text-center text-slate-400 text-xs">No suppliers found</div>
                    )}
                  </div>
                )}
                {/* Fallback to keep the value in DOM */}
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Invoice Date
                </label>
                <input
                  ref={invoiceDateRef}
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      currencyRef.current?.focus();
                    }
                  }}
                  required
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Currency
                </label>
                <select
                  ref={currencyRef}
                  value={purchaseCurrency}
                  onChange={(e) => {
                    const newCurrency = e.target.value as 'USD' | 'LBP';
                    setPurchaseCurrency(newCurrency);
                    // Update input if a product is selected
                    if (selectedProduct) {
                      const defaultCost = selectedProduct.costPriceUSD != null ? selectedProduct.costPriceUSD : 0;
                      setItemCostUSD(newCurrency === 'USD' ? defaultCost.toString() : Math.round(defaultCost * exchangeRate).toString());
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // Next focus
                    }
                  }}
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="LBP">LBP (ل.ل)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            {scanStatusMessage && (
              <div
                id="scan-status-alert"
                className={`flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 shadow-2xs ${
                  scanStatusMessage.type === 'error'
                    ? 'bg-rose-50/95 border border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200 ring-1 ring-rose-500/10'
                    : 'bg-emerald-50/95 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500/10'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {scanStatusMessage.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <span className="truncate">{scanStatusMessage.text}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    id="scan-status-add-stock-btn"
                    onClick={handleOpenAddStockProduct}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md shadow-2xs transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                      scanStatusMessage.type === 'error'
                        ? 'bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 border border-rose-700/50'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 border border-emerald-700/50'
                    }`}
                    title="Open form to add new item in Stock"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Add to Stock</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanStatusMessage(null)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer transition-colors"
                    title="Dismiss alert"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
            {/* Items Input/Import Table */}
            <div className="flex-1 w-full overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/40 shadow-sm flex flex-col">
              <div className="flex-1 w-full overflow-auto">
                
<table className="w-max min-w-full text-left border-collapse table-fixed">
  <colgroup>
    <col style={{ width: colWidths.code }} />
    <col style={{ width: colWidths.barcode }} />
    <col style={{ width: colWidths.name }} />
    <col style={{ width: colWidths.unit }} />
    <col style={{ width: colWidths.qty }} />
    <col style={{ width: colWidths.free }} />
    <col style={{ width: colWidths.batch }} />
    <col style={{ width: colWidths.expiry }} />
    <col style={{ width: colWidths.pubPrice }} />
    <col style={{ width: colWidths.discount }} />
    <col style={{ width: colWidths.cost }} />
    <col style={{ width: colWidths.vat }} />
    <col style={{ width: colWidths.profit }} />
    <col style={{ width: colWidths.total }} />
    <col style={{ width: colWidths.action }} />
  </colgroup>
  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
    <tr>
      {[
        { id: 'code', label: 'Code' },
        { id: 'barcode', label: 'Barcode' },
        { id: 'name', label: 'Name' },
        { id: 'unit', label: 'Unit' },
        { id: 'qty', label: 'Qty' },
        { id: 'free', label: 'Free' },
        { id: 'batch', label: 'Batch' },
        { id: 'expiry', label: 'Expiry' },
        { id: 'pubPrice', label: 'Pub Price' },
        { id: 'discount', label: 'Disc %' },
        { id: 'cost', label: 'Cost' },
        { id: 'vat', label: 'VAT' },
        { id: 'profit', label: 'Profit' },
        { id: 'total', label: 'Total' },
      ].map(col => (
        <th key={col.id} className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap relative group border-r border-slate-200 dark:border-slate-800 select-none">
          {col.label}
          <div
            onMouseDown={(e) => handleColResizeStart(e, col.id)}
            className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500/80 transition-colors z-10"
            title="Drag to resize"
          />
        </th>
      ))}
      <th className="p-1 pb-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
        {/* Actions empty header */}
      </th>
    </tr>
  </thead>
  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((it, idx) => {
                      const productDetails = products.find(p => p.id === it.productId);
                      const vatRate = it.vatRate !== undefined ? it.vatRate : (productDetails ? (settings.vatRates?.[productDetails.category] || 0) : 0);
                      
                      const unitCost = purchaseCurrency === 'USD' ? it.unitCostUSD : it.unitCostLBP;
                      const pubPrice = purchaseCurrency === 'USD' ? (it.sellingPriceUSD || 0) : it.sellingPriceLBP;
                      const total = unitCost * it.quantity;
                      
                      let profit = pubPrice - unitCost;
                      if (purchaseCurrency !== 'LBP') profit = Number(profit.toFixed(2));
                      const profitPerc = unitCost > 0 ? ((profit / unitCost) * 100).toFixed(1) : '0.0';

                      const isEditing = editingRowIndex === idx && editRowData;

                      return (
                        <tr key={idx} className={isEditing ? 'bg-teal-50/20 dark:bg-teal-900/10 ring-1 ring-inset ring-teal-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editRowData.code}
                                onChange={(e) => setEditRowData({ ...editRowData, code: e.target.value })}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{it.productCode}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editRowData.barcode}
                                onChange={(e) => setEditRowData({ ...editRowData, barcode: e.target.value })}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{productDetails?.barcode || ''}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editRowData.name}
                                onChange={(e) => setEditRowData({ ...editRowData, name: e.target.value })}
                                className="w-full px-1 py-1 text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 font-semibold text-slate-800 dark:text-slate-100 ">{it.productName}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <select
                                value={editRowData.unit}
                                onChange={(e) => setEditRowData({ ...editRowData, unit: e.target.value as 'box' | 'piece' })}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-teal-500 rounded outline-none"
                              >
                                <option value="box">Box</option>
                                <option value="piece">Piece</option>
                              </select>
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{it.isPiece ? 'Piece' : 'Box'}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="number"
                                min="1"
                                value={editRowData.qty}
                                onChange={(e) => {
                                  const newQty = e.target.value;
                                  const q = parseInt(newQty, 10) || 0;
                                  const c = parseFloat(editRowData.cost) || 0;
                                  setEditRowData({ ...editRowData, qty: newQty, total: (q * c).toFixed(2) });
                                }}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 font-medium text-slate-800 dark:text-slate-200">{it.quantity}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                value={editRowData.free}
                                onChange={(e) => setEditRowData({ ...editRowData, free: e.target.value })}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{it.freeQty || '-'}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editRowData.batch}
                                onChange={(e) => setEditRowData({ ...editRowData, batch: e.target.value })}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{it.batchNumber}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editRowData.displayExpiry}
                                onChange={(e) => setEditRowData({ ...editRowData, displayExpiry: e.target.value, expiry: '' })}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{it.expiryDate}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={editRowData.pubPrice}
                                onChange={(e) => {
                                  const newPubPrice = e.target.value;
                                  const p = parseFloat(newPubPrice) || 0;
                                  const c = parseFloat(editRowData.cost) || 0;
                                  const pr = p - c;
                                  const profitPerc = c > 0 ? ((pr / c) * 100).toFixed(1) : '0.0';
                                  setEditRowData({ ...editRowData, pubPrice: newPubPrice, profit: profitPerc });
                                }}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 font-medium text-slate-800 dark:text-slate-200">{pubPrice}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={editRowData.discount}
                                onChange={(e) => setEditRowData({ ...editRowData, discount: e.target.value })}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 font-medium text-teal-600 dark:text-teal-400">{it.discount || 0}%</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={editRowData.cost}
                                onChange={(e) => {
                                  const newCost = e.target.value;
                                  const c = parseFloat(newCost) || 0;
                                  const q = parseInt(editRowData.qty, 10) || 0;
                                  const p = parseFloat(editRowData.pubPrice) || 0;
                                  const pr = p - c;
                                  const profitPerc = c > 0 ? ((pr / c) * 100).toFixed(1) : '0.0';
                                  setEditRowData({ ...editRowData, cost: newCost, total: (c * q).toFixed(2), profit: profitPerc });
                                }}
                                className="w-full px-1 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none"
                              />
                            ) : (
                              <span className="px-2 font-medium text-slate-800 dark:text-slate-200">{unitCost}</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  value={editRowData.vat}
                                  onChange={(e) => setEditRowData({ ...editRowData, vat: e.target.value })}
                                  className="w-full px-1 py-1 pr-4 text-[11px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none text-right"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
                              </div>
                            ) : (
                              <span className="px-2 text-slate-600 dark:text-slate-300">{vatRate}%</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  value={editRowData.profit}
                                  onChange={(e) => {
                                    const newProfit = e.target.value;
                                    const c = parseFloat(editRowData.cost) || 0;
                                    const pr = c + (c * (parseFloat(newProfit) || 0) / 100);
                                    setEditRowData({ ...editRowData, profit: newProfit, pubPrice: pr.toFixed(2) });
                                  }}
                                  className="w-full px-1 py-1 pr-4 text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none text-right text-emerald-600 dark:text-emerald-400"
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-emerald-600/70 dark:text-emerald-400/70">%</span>
                              </div>
                            ) : (
                              <span className="px-2 font-medium text-emerald-600 dark:text-emerald-400">{profitPerc}%</span>
                            )}
                          </td>
                          <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={editRowData.total}
                                onChange={(e) => {
                                  const newTotal = e.target.value;
                                  const q = parseInt(editRowData.qty, 10) || 1;
                                  const newCost = (parseFloat(newTotal) || 0) / q;
                                  setEditRowData({ ...editRowData, total: newTotal, cost: newCost.toFixed(2) });
                                }}
                                className="w-full px-1 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-teal-500 rounded outline-none text-right"
                              />
                            ) : (
                              <span className="px-2 font-bold text-slate-800 dark:text-slate-200">{total}</span>
                            )}
                          </td>
                          <td className="p-1 px-2 whitespace-nowrap text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={handleSaveEditRow}
                                  className="text-white bg-teal-600 hover:bg-teal-700 p-1 rounded shadow-sm"
                                  title="Save changes"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRowIndex(null);
                                    setEditRowData(null);
                                  }}
                                  className="text-slate-500 hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                                  title="Cancel edit"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditItem(idx)}
                                  className="text-teal-600 hover:text-teal-800 p-1 rounded hover:bg-teal-50 dark:hover:bg-teal-900/30"
                                  title="Edit item"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                                  title="Remove item"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Active Input Row */}
                    <tr className="bg-teal-50/40 dark:bg-teal-900/20">
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          ref={codeInputRef}
                          type="text"
                          value={itemCode}
                          onChange={(e) => setItemCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = itemCode.trim().toLowerCase();
                              if (val) {
                                const match = products.find(p => p.code.toLowerCase() === val);
                                if (match) {
                                  selectProduct(match, false);
                                  showFeedback('success', `Found: ${match.name}`);
                                  // Skip barcode/name, go straight to unit
                                  setTimeout(() => unitInputRef.current?.focus(), 50);
                                } else {
                                  showFeedback('error', `Code "${itemCode}" not found in stock list.`);
                                  e.currentTarget.select();
                                }
                              } else {
                                barcodeInputRef.current?.focus();
                              }
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          id="purchase-item-barcode-input"
                          ref={barcodeInputRef}
                          type="text"
                          value={itemBarcode}
                          onChange={handleBarcodeChange}
                          onKeyDown={handleBarcodeKeyDown}
                          onPaste={handleBarcodePaste}
                          placeholder="Scan barcode..."
                          title="Scan barcode with hardware scanner or enter barcode / code and press Enter or Tab"
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-[11px] font-mono tracking-wider text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs hover:border-teal-400 dark:hover:border-teal-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25 focus:outline-hidden transition-all"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700 relative">
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={productSearchQuery}
                          onChange={(e) => {
                            setProductSearchQuery(e.target.value);
                            setIsSearchDropdownOpen(true);
                          }}
                          onFocus={() => { if (productSearchQuery.trim()) setIsSearchDropdownOpen(true); }}
                          onKeyDown={handleSearchKeyDown}
                          placeholder="Search product..."
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                        {isSearchDropdownOpen && (
                          <div
                            ref={listContainerRef}
                            className="absolute left-0 top-full mt-1 w-[300px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-50 rounded-lg max-h-48 overflow-y-auto"
                          >
                            {filteredProducts.map((p, idx) => (
                              <div
                                key={p.id}
                                ref={(el) => { itemRefs.current[idx] = el; }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  selectProduct(p, false); // select without auto-add
                                }}
                                className={`px-2 py-1.5 cursor-pointer flex justify-between items-center text-[11px] ${
                                  highlightedIndex === idx
                                    ? 'bg-teal-50 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 font-semibold'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                <span className="flex-1 overflow-hidden whitespace-nowrap text-ellipsis pr-2">
                                  {p.name}
                                  {p.dosage && ` ${p.dosage}`}
                                  {p.presentation && ` ${p.presentation}`}
                                  {p.form && ` ${p.form}`}
                                </span>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{p.code}</span>
                              </div>
                            ))}
                            {filteredProducts.length === 0 && (
                              <div className="px-3 py-3 text-center text-[11px] text-slate-500">No products found</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <select
                          ref={unitInputRef}
                          value={itemUnit}
                          onChange={(e) => setItemUnit(e.target.value as 'box' | 'piece')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              qtyInputRef.current?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        >
                          <option value="box">Box</option>
                          <option value="piece">Piece</option>
                        </select>
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          ref={qtyInputRef}
                          type="number"
                          value={itemQty}
                          onChange={(e) => setItemQty(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              freeInputRef.current?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          ref={freeInputRef}
                          type="number"
                          value={itemFree}
                          onChange={(e) => setItemFree(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              batchInputRef.current?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          ref={batchInputRef}
                          type="text"
                          value={itemBatch}
                          onChange={(e) => setItemBatch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              expiryInputRef.current?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100 uppercase"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          ref={expiryInputRef}
                          type="text"
                          value={displayExpiry}
                          onChange={handleExpiryChange}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('input-pub-price')?.focus();
                            }
                          }}
                          placeholder="MM/YYYY"
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          id="input-pub-price"
                          type="number"
                          value={itemPublicPrice}
                          onChange={(e) => setItemPublicPrice(e.target.value)}
                          onFocus={(e) => { setIsPublicPriceFocused(true); e.target.select(); }}
                          onBlur={() => setIsPublicPriceFocused(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('input-discount')?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          id="input-discount"
                          type="number"
                          value={itemDiscount}
                          onChange={(e) => setItemDiscount(e.target.value)}
                          onFocus={(e) => { setIsDiscountFocused(true); e.target.select(); }}
                          onBlur={() => setIsDiscountFocused(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('input-cost')?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          id="input-cost"
                          type="number"
                          value={itemCostUSD}
                          onChange={(e) => setItemCostUSD(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('input-vat')?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <select
                          id="input-vat"
                          value={itemVATChoice}
                          onChange={(e) => setItemVATChoice(e.target.value as 'setting' | 'none')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              document.getElementById('input-total')?.focus();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        >
                          <option value="setting">{selectedProduct && settings.vatRates?.[selectedProduct.category] ? `${settings.vatRates[selectedProduct.category]}%` : '0%'}</option>
                          <option value="none">0%</option>
                        </select>
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700 align-middle">
                        <div className="px-1.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {(() => {
                            const cost = parseFloat(itemCostUSD) || 0;
                            const pubPrice = parseFloat(itemPublicPrice) || 0;
                            const p = pubPrice - cost;
                            if (cost > 0) return ((p / cost) * 100).toFixed(1) + '%';
                            return '0.0%';
                          })()}
                        </div>
                      </td>
                      <td className="p-1 border-r border-slate-200 dark:border-slate-700">
                        <input
                          id="input-total"
                          type="number"
                          value={itemTotalInput}
                          onChange={(e) => setItemTotalInput(e.target.value)}
                          onFocus={(e) => { setIsTotalFocused(true); e.target.select(); }}
                          onBlur={() => setIsTotalFocused(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddItemToInvoice();
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 text-[11px] font-bold text-slate-800 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-1 text-center align-middle">
                        <button
                          type="button"
                          onClick={handleAddItemToInvoice}
                          className="text-teal-600 hover:text-teal-800 dark:text-teal-400 p-1 rounded hover:bg-teal-100 dark:hover:bg-teal-900/50"
                          title="Add Item (Enter)"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-auto flex items-end justify-between w-full pt-2">
              <button
                type="submit"
                disabled={items.length === 0}
                className="w-fit flex items-center gap-1.5 rounded-lg bg-teal-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{editingPurchaseId ? 'Save Changes' : 'Receive & Restock Items'}</span>
              </button>

              {/* Total Summary */}
              {items.length > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-teal-50 border border-teal-100 px-3 py-2 text-teal-950 dark:bg-teal-950/40 dark:text-teal-300 shadow-sm w-fit gap-4 shrink-0">
                  <span className="shrink-0 uppercase text-[10px] font-bold tracking-wider text-teal-700/80 dark:text-teal-400/80">
                    Grand Total
                  </span>
                  <div className="flex flex-col items-end">
                    <div className="text-[14px] font-extrabold leading-none flex items-baseline gap-1">
                      {formatLBPValue(totalCostLBP)} <span className="text-[10px] font-semibold text-teal-800/60 dark:text-teal-300/60">LBP</span>
                    </div>
                    <div className="w-full h-px bg-teal-200/80 dark:bg-teal-800/80 my-1" />
                    <div className="text-[12px] font-bold leading-none text-teal-800/90 dark:text-teal-300/90">
                      ${totalCostUSD.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
        </DesktopWindow>
      )}
      {/* Close Confirm Modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Unsaved Changes</h3>
            </div>
            <div className="p-5 text-sm text-slate-600 dark:text-slate-300">
              <p>You have items in this invoice.</p>
              <p className="mt-1">Are you sure you want to close without saving?</p>
            </div>
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
              >
                Discard the close process
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseConfirm(false);
                  setIsCreateOpen(false);
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
              >
                Close without save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Product Modal directly from Purchase Form */}
      {isAddStockProductModalOpen && (
        <AddStockProductModal
          isOpen={isAddStockProductModalOpen}
          onClose={() => setIsAddStockProductModalOpen(false)}
          initialBarcode={addStockInitialData.barcode}
          initialCode={addStockInitialData.code}
          initialName={addStockInitialData.name}
          initialBatch={addStockInitialData.batch}
          initialExpiry={addStockInitialData.expiry}
          onProductAdded={handleStockProductAdded}
        />
      )}
    </div>
  );
};
