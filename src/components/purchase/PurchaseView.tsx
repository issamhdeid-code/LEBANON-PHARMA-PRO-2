import React, { useState, useMemo, useRef, useEffect } from 'react';
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
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[minmax(0,3fr)_repeat(8,minmax(0,1fr))_auto] gap-3">
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

        <div>
          <input
            type="text"
            value={item.expiryDate}
            onChange={(e) => onChange(index, { ...item, expiryDate: e.target.value })}
            placeholder="MM/YY"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <input
            type="text"
            value={item.batchNumber}
            onChange={(e) => onChange(index, { ...item, batchNumber: e.target.value })}
            placeholder="Batch"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <input
            type="number"
            value={item.quantity === 0 ? '' : item.quantity}
            onChange={(e) => onChange(index, { ...item, quantity: parseInt(e.target.value) || 0 })}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400 cursor-not-allowed">
            {vatRate > 0 ? `${vatRate}%` : '0 VAT'}
          </div>
        </div>

        <div>
          <input
            type="text"
            value={formatWithCommas(priceInput.split('.')[0])}
            onChange={(e) => setPriceInput(e.target.value.replace(/,/g, '').split('.')[0])}
            onBlur={() => flushPrice(priceInput)}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <input
            type="text"
            value={formatWithCommas(discountInput.split('.')[0])}
            onChange={(e) => setDiscountInput(e.target.value.replace(/,/g, '').split('.')[0])}
            onBlur={() => onChange(index, { ...item, discount: parseFloat(discountInput) || 0 })}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <input
            type="text"
            value={formatWithCommas(costInput.split('.')[0])}
            onChange={(e) => setCostInput(e.target.value.replace(/,/g, '').split('.')[0])}
            onBlur={() => flushCost(costInput)}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
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
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-bold"
          />
        </div>
      </div>


    </div>
  );
};

export const PurchaseView: React.FC = () => {
  const { purchases, suppliers, products, recordPurchase, updatePurchase, deletePurchase, exchangeRate, formatLBP, formatUSD, settings } = usePharmacy();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
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
  const [itemQty, setItemQty] = useState('0');
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

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const unitInputRef = useRef<HTMLSelectElement | null>(null);
  const expiryInputRef = useRef<HTMLInputElement | null>(null);
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);
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

  // Global Barcode Scanner Listener when New Purchase modal is open
  useBarcodeScanner({
    onScan: (scanned) => {
      if (!isCreateOpen) return;
      const clean = scanned.trim();
      if (!clean) return;

      const found = products.find(
        (p) =>
          (p.barcode || '').toLowerCase() === clean.toLowerCase() ||
          p.code.toLowerCase() === clean.toLowerCase()
      );

      if (found) {
        selectProduct(found, true);
        setScanStatusMessage({
          type: 'success',
          text: `Scanned: ${found.name} (${found.barcode || found.code})`,
        });
        setTimeout(() => setScanStatusMessage(null), 3500);
      } else {
        setScanStatusMessage({
          type: 'error',
          text: `Barcode "${clean}" not found in inventory. You can search by name or code.`,
        });
        setTimeout(() => setScanStatusMessage(null), 4000);
      }
    },
  });

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
    setProductSearchQuery(prod.name);
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
    if (digits.length > 6) digits = digits.slice(0, 6);

    let formatted = digits;
    if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else if (digits.length === 2 && input.endsWith('/')) {
      formatted = `${digits}/`;
    }

    setDisplayExpiry(formatted);

    if (digits.length === 6) {
      const month = digits.slice(0, 2);
      const year = digits.slice(2, 6);
      setItemExpiry(`${year}-${month}-01`);
    } else if (digits.length === 4) {
      const month = digits.slice(0, 2);
      const year = `20${digits.slice(2, 4)}`;
      setItemExpiry(`${year}-${month}-01`);
    } else {
      setItemExpiry('');
    }
  };

  const handleExpiryBlur = () => {
    const digits = displayExpiry.replace(/[^\d]/g, '');
    if (digits.length === 4) {
      const month = digits.slice(0, 2);
      const year = `20${digits.slice(2, 4)}`;
      setDisplayExpiry(`${month}/${year}`);
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
      if (digits.length === 4) {
        finalExpiry = `20${digits.slice(2, 4)}-${digits.slice(0, 2)}-01`;
      } else if (digits.length === 6) {
        finalExpiry = `${digits.slice(2, 6)}-${digits.slice(0, 2)}-01`;
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
          className="flex items-center space-x-1 rounded bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition-colors cursor-pointer"
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
            className="p-5 space-y-4 text-xs flex-1 flex flex-col justify-start overflow-y-auto min-h-0"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div ref={supplierDropdownRef} className="relative">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Supplier / Agent
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={supplierSearchQuery}
                    onChange={(e) => {
                      setSupplierSearchQuery(e.target.value);
                      setIsSupplierDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setIsSupplierDropdownOpen(true);
                      const sel = suppliers.find(s => s.id === selectedSupplierId);
                      if (sel && supplierSearchQuery === sel.name) {
                        setSupplierSearchQuery('');
                      }
                    }}
                    onKeyDown={handleSupplierKeyDown}
                    placeholder="Type to search supplier..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
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
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
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
                      paymentStatusRef.current?.focus();
                    }
                  }}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Payment Status
                </label>
                <select
                  ref={paymentStatusRef}
                  value={isPaid ? 'paid' : 'debt'}
                  onChange={(e) => setIsPaid(e.target.value === 'paid')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      currencyRef.current?.focus();
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="paid">Paid (Cash / Bank)</option>
                  <option value="debt">Unpaid (Add to Supplier Debt)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
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
                      searchInputRef.current?.focus();
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="LBP">LBP (ل.ل)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            {/* Add Items Row */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100 block text-xs flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-teal-600" />
                  Add Medication / Item to Shipment
                </span>
                
              </div>

              {scanStatusMessage && (
                <div
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                    scanStatusMessage.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300'
                  }`}
                >
                  {scanStatusMessage.type === 'success' ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{scanStatusMessage.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[minmax(0,3fr)_repeat(8,minmax(0,1fr))_auto] gap-3 items-end">
                <div className="sm:col-span-3 relative" ref={searchDropdownRef}>
                  

                  {/* Primary searchable input with live matching by Name, Drug Code, or Barcode */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="h-3.5 w-3.5" />
                    </div>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProductSearchQuery(val);
                        if (val.trim().length > 0) {
                          setIsSearchDropdownOpen(true);
                          setHighlightedIndex(0);
                        } else {
                          setIsSearchDropdownOpen(false);
                        }
                      }}
                      onFocus={() => {
                        if (productSearchQuery.trim().length > 0) {
                          setIsSearchDropdownOpen(true);
                        }
                      }}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Type name, code, barcode, or scan box..."
                      className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-16 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center gap-1">
                      {productSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductSearchQuery('');
                            setCurrentProductId('');
                            setIsSearchDropdownOpen(false);
                            searchInputRef.current?.focus();
                          }}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                          title="Clear search"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchDropdownOpen((prev) => !prev);
                          searchInputRef.current?.focus();
                        }}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        title="Browse medication list"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fallback & accessible select element to maintain exact DOM structure */}
                  <select
                    value={currentProductId}
                    onChange={(e) => {
                      const prod = products.find((p) => p.id === e.target.value);
                      if (prod) {
                        selectProduct(prod, true);
                      }
                    }}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <option value="">-- Choose Medication --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) {p.barcode ? `[${p.barcode}]` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Dropdown Suggestions Menu */}
                  {isSearchDropdownOpen && (
                    <div
                      id="purchase-product-suggestions-dropdown"
                      className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white/98 dark:border-slate-700 dark:bg-slate-900/98 shadow-2xl flex flex-col overflow-hidden text-xs backdrop-blur-xs"
                    >
                      {filteredProducts.length === 0 ? (
                        <div className="p-4 text-center text-slate-400">
                          <AlertCircle className="h-5 w-5 mx-auto mb-1.5 text-slate-400" />
                          <span className="font-semibold">No products match "{productSearchQuery}"</span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Try searching by code, barcode, or Lebanese supplier
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            ref={listContainerRef}
                            className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
                          >
                            {filteredProducts.map((prod, index) => {
                              const isHighlighted = index === highlightedIndex;
                              const isSelected = prod.id === currentProductId;
                              return (
                                <div
                                  key={prod.id}
                                  ref={(el) => {
                                    itemRefs.current[index] = el;
                                  }}
                                  id={`purchase-product-option-${prod.id}`}
                                  role="option"
                                  aria-selected={isHighlighted}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    selectProduct(prod, true);
                                  }}
                                  onMouseEnter={() => setHighlightedIndex(index)}
                                  className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between gap-2 select-none ${
                                    isHighlighted
                                      ? 'bg-teal-600 text-white dark:bg-teal-600 dark:text-white shadow-xs'
                                      : isSelected
                                      ? 'bg-teal-50/80 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100 border-l-2 border-teal-500 font-semibold'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold truncate flex items-center gap-1.5">
                                      <span className={isHighlighted ? 'text-white' : 'text-slate-900 dark:text-slate-100'}>
                                        {prod.name}
                                      </span>
                                      <span className={`text-[10px] font-normal ${isHighlighted ? 'text-teal-100' : 'text-slate-400'}`}>
                                        {prod.dosage} {prod.presentation} {prod.form}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] mt-0.5 font-mono">
                                      {prod.agent && (
                                        <span className={`font-sans text-[9px] ${isHighlighted ? 'text-teal-100' : 'text-slate-400'}`}>
                                          {prod.agent}
                                        </span>
                                      )}
                                      {prod.barcode && (
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[9px] flex items-center gap-0.5 ${
                                            isHighlighted
                                              ? 'bg-teal-700/90 text-teal-100 border border-teal-500/40'
                                              : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                                          }`}
                                        >
                                          <Barcode className="h-2.5 w-2.5" />
                                          {prod.barcode}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0 flex items-center gap-2">
                                    <div>
                                      <div className={`font-bold ${isHighlighted ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                        ${(prod.costPriceUSD || 5).toFixed(2)}
                                      </div>
                                      <div className={`text-[9px] font-bold ${
                                        isHighlighted 
                                          ? 'text-white/90' 
                                          : prod.stockQuantity === 0 
                                            ? 'text-red-600 dark:text-red-400' 
                                            : prod.stockQuantity <= 3 
                                              ? 'text-amber-600 dark:text-amber-400' 
                                              : 'text-green-600 dark:text-green-400'
                                      }`}>
                                        Stock: {prod.stockQuantity}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Keyboard Navigation Footer Hint */}
                          <div className="bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-end shrink-0">
                            <span className="text-[9px] text-slate-400">
                              {filteredProducts.length} items
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                                    <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Unit
                    </label>
                  </div>
                  <select
                    ref={unitInputRef}
                    id="purchase-item-unit"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value as 'box' | 'piece')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        expiryInputRef.current?.focus();
                        expiryInputRef.current?.select();
                      }
                    }}
                    disabled={!selectedProduct?.isDivisible}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                  >
                    <option value="box">Box</option>
                    {selectedProduct?.isDivisible && (
                      <option value="piece">{selectedProduct.pieceName || 'Piece'}</option>
                    )}
                  </select>
                </div>

                <div>
                                    <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Expiry
                    </label>
                  </div>
                  <input
                    ref={expiryInputRef}
                    id="purchase-item-expiry"
                    type="text"
                    value={displayExpiry}
                    onChange={handleExpiryChange}
                    onFocus={(e) => e.target.select()}
                    onBlur={handleExpiryBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleExpiryBlur();
                        batchInputRef.current?.focus();
                        batchInputRef.current?.select();
                      }
                    }}
                    placeholder="MM/YY"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                                    <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Batch
                    </label>
                  </div>
                  <input
                    ref={batchInputRef}
                    id="purchase-item-batch"
                    type="text"
                    value={itemBatch}
                    onChange={(e) => setItemBatch(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        qtyInputRef.current?.focus();
                        qtyInputRef.current?.select();
                      }
                    }}
                    placeholder="Batch"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                                    <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Qty
                    </label>
                  </div>
                  <input
                    ref={qtyInputRef}
                    id="purchase-item-qty"
                    type="number"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        vatInputRef.current?.focus();
                      }
                    }}
                    placeholder="Qty"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                                    <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      VAT
                    </label>
                  </div>
                  <div className="relative">
                    <select
                      ref={vatInputRef}
                      value={itemVATChoice}
                      onChange={(e) => setItemVATChoice(e.target.value as 'setting' | 'none')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          publicPriceInputRef.current?.focus();
                          publicPriceInputRef.current?.select();
                        }
                      }}
                      className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="setting">
                        {selectedProduct && (settings.vatRates?.[selectedProduct.category] || 0) > 0
                          ? `${settings.vatRates?.[selectedProduct.category]}%`
                          : '0 VAT'}
                      </option>
                      <option value="none">0 VAT</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                                    <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Pub Price
                    </label>
                  </div>
                  <input
                    ref={publicPriceInputRef}
                    type="text"
                    value={formatWithCommas(itemPublicPrice.split('.')[0])}
                    onChange={(e) => setItemPublicPrice(e.target.value.replace(/,/g, '').split('.')[0])}
                    onFocus={(e) => {
                      setIsPublicPriceFocused(true);
                      e.target.select();
                    }}
                    onBlur={() => setIsPublicPriceFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        discountInputRef.current?.focus();
                        discountInputRef.current?.select();
                      }
                    }}
                    placeholder="Pub Price"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                                    <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Disc %
                    </label>
                  </div>
                  <input
                    ref={discountInputRef}
                    type="text"
                    value={formatWithCommas(itemDiscount.split('.')[0])}
                    onChange={(e) => setItemDiscount(e.target.value.replace(/,/g, '').split('.')[0])}
                    onFocus={(e) => {
                      setIsDiscountFocused(true);
                      e.target.select();
                    }}
                    onBlur={() => setIsDiscountFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        costInputRef.current?.focus();
                        costInputRef.current?.select();
                      }
                    }}
                    placeholder="Disc %"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                                    <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Cost
                    </label>
                  </div>
                  <input
                    ref={costInputRef}
                    id="purchase-item-cost"
                    type="text"
                    value={formatWithCommas(itemCostUSD.split('.')[0])}
                    onChange={(e) => setItemCostUSD(e.target.value.replace(/,/g, '').split('.')[0])}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        totalInputRef.current?.focus();
                        totalInputRef.current?.select();
                      }
                    }}
                    placeholder="Cost"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                                    <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Total
                    </label>
                  </div>
                  <input
                    ref={totalInputRef}
                    type="text"
                    value={formatWithCommas(itemTotalInput.split('.')[0])}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, '').split('.')[0];
                      setItemTotalInput(raw);
                      const newTotal = parseFloat(raw);
                      if (!isNaN(newTotal)) {
                        const qty = parseInt(itemQty, 10);
                        const safeQty = isNaN(qty) || qty <= 0 ? 1 : qty;
                        let newCost = newTotal / safeQty;
                        if (purchaseCurrency === 'LBP') newCost = Math.round(newCost);
                        setItemCostUSD(newCost.toString());
                      }
                    }}
                    onFocus={(e) => {
                      setIsTotalFocused(true);
                      e.target.select();
                    }}
                    onBlur={() => {
                      setIsTotalFocused(false);
                      const raw = itemTotalInput.replace(/,/g, '');
                      const val = parseFloat(raw) || 0;
                      setItemTotalInput(val.toString());
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddItemToInvoice();
                      }
                    }}
                    placeholder="Total"
                    style={{ width: `${Math.max(6, formatWithCommas(itemTotalInput.split('.')[0]).length + 3)}ch` }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 min-w-full"
                  />
                </div>
              </div>

              {/* Selected Product Info & Lot Details */}
              {selectedProduct && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {selectedProduct.name}
                    </span>
                    {(selectedProduct.dosage || selectedProduct.presentation || selectedProduct.form) && (
                      <span className="text-slate-600 dark:text-slate-400 font-medium">
                        {[selectedProduct.dosage, selectedProduct.presentation, selectedProduct.form]
                          .map((s) => s?.trim())
                          .filter(Boolean)
                          .join(' ')}
                      </span>
                    )}
                    {selectedProduct.barcode && (
                      <span className="font-mono text-[10px] bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Barcode className="h-3 w-3" />
                        {selectedProduct.barcode}
                      </span>
                    )}
                    <span id="purchase-item-stock-qty" className="text-slate-500">
                      In Stock: <strong className="text-slate-700 dark:text-slate-200">{formatStockBoxesAndPieces(selectedProduct)}</strong>
                    </span>
                    {selectedProduct.agent && (
                      <span className="text-slate-500">
                        Agent: <strong className="text-slate-700 dark:text-slate-200">{selectedProduct.agent}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Items List in New Purchase */}
            <div className="flex-1 min-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/40 shadow-sm">
              {items.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="mb-2 flex justify-center">
                    <FileText className="h-8 w-8 opacity-20" />
                  </div>
                  No items added to invoice yet.
                </div>
              ) : (
                items.map((it, idx) => {
                  const productDetails = products.find(p => p.id === it.productId);
                  const vatRate = productDetails ? (settings.vatRates?.[productDetails.category] || 0) : 0;
                  return (
                    <PurchaseAddedItemRow
                      key={idx}
                      item={it}
                      index={idx}
                      productDetails={productDetails}
                      purchaseCurrency={purchaseCurrency}
                      exchangeRate={exchangeRate}
                      vatRate={vatRate}
                      onChange={(index, updated) => {
                        setItems(prev => {
                          const newItems = [...prev];
                          newItems[index] = updated;
                          return newItems;
                        });
                      }}
                      onRemove={handleRemoveItem}
                    />
                  );
                })
              )}
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
    </div>
  );
};
