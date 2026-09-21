import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  RefreshCw,
  Banknote,
  Plus,
  Trash2,
  Check,
  X,
  Search,
  Calendar,
  AlertCircle,
  Package,
  FileText,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { DesktopWindow } from '../common/DesktopWindow';
import { Product, PurchaseReturnItem, Supplier } from '../../types/pharmacy';
import { filterProductsByMultiWordQuery } from '../../utils/searchUtils';
import { formatLBPValue } from '../../utils/priceUtils';
import { formatExpiryInput, parseExpiryDate, formatExpiryToMMYYYY, formatNumber } from './PurchaseView';

interface NewPurchaseReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSupplierId?: string;
}

export const NewPurchaseReturnModal: React.FC<NewPurchaseReturnModalProps> = ({
  isOpen,
  onClose,
  initialSupplierId,
}) => {
  const {
    suppliers,
    products,
    purchases,
    recordPurchaseReturn,
    exchangeRate,
    settings,
  } = usePharmacy();

  // Header State
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId || '');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [supplierHighlightedIndex, setSupplierHighlightedIndex] = useState(0);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const supplierInputRef = useRef<HTMLInputElement>(null);

  const [returnType, setReturnType] = useState<'replace_expiry' | 'cash_refund'>('replace_expiry');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('Expired / Near Expiry');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'LBP'>('USD');
  const [cashRefundStatus, setCashRefundStatus] = useState<'received' | 'credit'>('received');

  // Return Items Table
  const [items, setItems] = useState<PurchaseReturnItem[]>([]);

  // Item Draft Form
  const [currentProductId, setCurrentProductId] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [productHighlightedIndex, setProductHighlightedIndex] = useState(0);
  const [itemCode, setItemCode] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemUnitCost, setItemUnitCost] = useState('0');
  const [itemReason, setItemReason] = useState('');
  
  // Expiry replacement fields
  const [oldBatchNumber, setOldBatchNumber] = useState('');
  const [oldExpiryDate, setOldExpiryDate] = useState('');
  const [oldDisplayExpiry, setOldDisplayExpiry] = useState('');
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newDisplayExpiry, setNewDisplayExpiry] = useState('');
  const [replacementQty, setReplacementQty] = useState('1');

  const [scanStatusMessage, setScanStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const productSearchRef = useRef<HTMLInputElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const productListContainerRef = useRef<HTMLDivElement>(null);
  const productItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);
  const selectedProduct = products.find((p) => p.id === currentProductId);

  // Sync initial supplier
  useEffect(() => {
    if (initialSupplierId) {
      setSelectedSupplierId(initialSupplierId);
      const sup = suppliers.find((s) => s.id === initialSupplierId);
      if (sup) setSupplierSearchQuery(sup.name);
    }
  }, [initialSupplierId, suppliers]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(e.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchQuery.trim()) return suppliers;
    const q = supplierSearchQuery.toLowerCase().trim();
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.code && s.code.toLowerCase().includes(q))
    );
  }, [suppliers, supplierSearchQuery]);

  // Filter products (prioritize matching supplier's products if supplier is selected)
  const filteredProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) {
      const supName = selectedSupplier?.name.toLowerCase() || '';
      return [...products]
        .sort((a, b) => {
          const aMatch = supName && (a.agent || '').toLowerCase().includes(supName) ? -1 : 1;
          const bMatch = supName && (b.agent || '').toLowerCase().includes(supName) ? -1 : 1;
          return aMatch - bMatch;
        })
        .slice(0, 30);
    }
    return filterProductsByMultiWordQuery(products, q, 'all').slice(0, 40);
  }, [products, productSearchQuery, selectedSupplier]);

  const selectProduct = (prod: Product) => {
    setCurrentProductId(prod.id);
    setItemCode(prod.code || '');
    setItemBarcode(prod.barcode || '');
    setProductSearchQuery(`${prod.name} ${prod.dosage || ''}`.trim());
    setIsProductDropdownOpen(false);

    // Default cost
    const defaultCostUSD = prod.costPriceUSD || 0;
    setItemUnitCost(currency === 'USD' ? defaultCostUSD.toString() : Math.round(defaultCostUSD * exchangeRate).toString());

    // Auto-populate old batch & expiry from product or latest batch
    if (prod.batches && prod.batches.length > 0) {
      const b = prod.batches[0];
      setOldBatchNumber(b.batchNumber || '');
      setOldExpiryDate(b.expiryDate || '');
      setOldDisplayExpiry(formatExpiryToMMYYYY(b.expiryDate) || b.expiryDate || '');
    } else {
      setOldBatchNumber(prod.batchNumber || '');
      setOldExpiryDate(prod.expiryDate || '');
      setOldDisplayExpiry(formatExpiryToMMYYYY(prod.expiryDate) || prod.expiryDate || '');
    }

    // Default replacement quantity to 1
    setItemQty('1');
    setReplacementQty('1');
    setNewBatchNumber('');
    setNewExpiryDate('');
    setNewDisplayExpiry('');

    setScanStatusMessage({
      type: 'success',
      text: `Selected "${prod.name}" (Stock: ${prod.stockQuantity} box${prod.stockQuantity !== 1 ? 'es' : ''})`,
    });
  };

  const handleOldExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const formatted = formatExpiryInput(val, oldDisplayExpiry, false);
    setOldDisplayExpiry(formatted);
    const parsed = parseExpiryDate(formatted);
    if (parsed) {
      setOldExpiryDate(parsed.fullDate);
    } else if (!formatted.trim()) {
      setOldExpiryDate('');
    }
  };

  const handleNewExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const formatted = formatExpiryInput(val, newDisplayExpiry, false);
    setNewDisplayExpiry(formatted);
    const parsed = parseExpiryDate(formatted);
    if (parsed) {
      setNewExpiryDate(parsed.fullDate);
    } else if (!formatted.trim()) {
      setNewExpiryDate('');
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      setScanStatusMessage({ type: 'error', text: 'Please select a product first.' });
      productSearchRef.current?.focus();
      return;
    }

    const qty = parseInt(itemQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setScanStatusMessage({ type: 'error', text: 'Quantity must be at least 1.' });
      return;
    }

    const unitCostVal = parseFloat(itemUnitCost) || 0;
    const unitCostUSD = currency === 'USD' ? unitCostVal : unitCostVal / exchangeRate;
    const unitCostLBP = currency === 'LBP' ? Math.round(unitCostVal) : Math.round(unitCostVal * exchangeRate);

    const replQty = parseInt(replacementQty, 10);
    const validReplQty = isNaN(replQty) || replQty <= 0 ? qty : replQty;

    const newItem: PurchaseReturnItem = {
      productId: selectedProduct.id,
      name: selectedProduct.name,
      productName: selectedProduct.name,
      productCode: selectedProduct.code,
      barcode: selectedProduct.barcode,
      quantity: qty,
      unitCostUSD,
      unitCostLBP,
      refundAmountUSD: unitCostUSD * qty,
      refundAmountLBP: unitCostLBP * qty,
      totalUSD: unitCostUSD * qty,
      totalLBP: unitCostLBP * qty,
      reason: itemReason || (reason === 'Other' ? customReason : reason),
      oldBatchNumber: oldBatchNumber.trim() || undefined,
      oldExpiryDate: oldExpiryDate.trim() || undefined,
      newBatchNumber: returnType === 'replace_expiry' ? (newBatchNumber.trim() || undefined) : undefined,
      newExpiryDate: returnType === 'replace_expiry' ? (newExpiryDate.trim() || undefined) : undefined,
      replacementQuantity: returnType === 'replace_expiry' ? validReplQty : undefined,
    };

    setItems((prev) => [...prev, newItem]);

    // Reset draft form
    setCurrentProductId('');
    setProductSearchQuery('');
    setItemCode('');
    setItemBarcode('');
    setItemQty('1');
    setItemUnitCost('0');
    setItemReason('');
    setOldBatchNumber('');
    setOldExpiryDate('');
    setOldDisplayExpiry('');
    setNewBatchNumber('');
    setNewExpiryDate('');
    setNewDisplayExpiry('');
    setReplacementQty('1');
    setScanStatusMessage({
      type: 'success',
      text: `Added "${selectedProduct.name}" to return list.`,
    });
    productSearchRef.current?.focus();
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalRefundUSD = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.refundAmountUSD || 0), 0);
  }, [items]);

  const totalRefundLBP = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.refundAmountLBP || 0), 0);
  }, [items]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      setScanStatusMessage({ type: 'error', text: 'Please select a supplier.' });
      supplierInputRef.current?.focus();
      return;
    }
    if (items.length === 0) {
      setScanStatusMessage({ type: 'error', text: 'Please add at least one item to return.' });
      return;
    }

    const effectiveReason = reason === 'Other' ? customReason.trim() : reason;

    recordPurchaseReturn({
      date: returnDate,
      supplierId: selectedSupplierId,
      supplierName: selectedSupplier?.name || 'Unknown Supplier',
      returnType,
      items,
      totalRefundUSD,
      totalRefundLBP,
      exchangeRate,
      currency,
      reason: effectiveReason,
      notes: notes.trim(),
      status: 'completed',
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <DesktopWindow
      id="new_purchase_return_window"
      title="New Return On Purchase to Supplier"
      isOpen={isOpen}
      onClose={onClose}
      minWidth={840}
      minHeight={580}
      width="960px"
      height="680px"
      section="purchase"
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs">
        {/* Top Control Bar */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3 flex flex-wrap items-center gap-3 shrink-0 shadow-2xs">
          {/* Supplier Selector */}
          <div className="flex-1 min-w-[240px] relative" ref={supplierDropdownRef}>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Supplier / Agent <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={supplierInputRef}
                type="text"
                value={supplierSearchQuery}
                onChange={(e) => {
                  setSupplierSearchQuery(e.target.value);
                  setIsSupplierDropdownOpen(true);
                }}
                onFocus={() => setIsSupplierDropdownOpen(true)}
                placeholder="Search or choose supplier..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
              />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>

            {isSupplierDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg max-h-48 overflow-y-auto z-50">
                {filteredSuppliers.map((s) => (
                  <div
                    key={s.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedSupplierId(s.id);
                      setSupplierSearchQuery(s.name);
                      setIsSupplierDropdownOpen(false);
                    }}
                    className={`px-3 py-2 cursor-pointer hover:bg-amber-50 dark:hover:bg-slate-700/60 flex items-center justify-between ${
                      selectedSupplierId === s.id ? 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold' : ''
                    }`}
                  >
                    <span>{s.name}</span>
                    <span className="text-[10px] text-slate-400">{s.code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Return Type Selection */}
          <div className="min-w-[230px]">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Return Method <span className="text-red-500">*</span>
            </label>
            <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setReturnType('replace_expiry')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 text-[11px] font-bold rounded-md transition-colors ${
                  returnType === 'replace_expiry'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Replace Expiry</span>
              </button>
              <button
                type="button"
                onClick={() => setReturnType('cash_refund')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 text-[11px] font-bold rounded-md transition-colors ${
                  returnType === 'cash_refund'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Banknote className="h-3.5 w-3.5" />
                <span>Return for Cash</span>
              </button>
            </div>
          </div>

          {/* Return Date */}
          <div className="w-36">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Date
            </label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
            />
          </div>

          {/* Primary Reason */}
          <div className="w-44">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
            >
              <option value="Expired / Near Expiry">Expired / Near Expiry</option>
              <option value="Damaged Stock">Damaged Stock</option>
              <option value="Product Recall">Product Recall</option>
              <option value="Overstock / Unsold">Overstock / Unsold</option>
              <option value="Wrong Shipment / Batch">Wrong Shipment / Batch</option>
              <option value="Other">Other (Custom)</option>
            </select>
          </div>

          {reason === 'Other' && (
            <div className="w-48">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Custom Reason
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Specify reason..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
              />
            </div>
          )}

          {/* Currency (for cash refund calculation) */}
          <div className="w-24">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'USD' | 'LBP')}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
            >
              <option value="USD">USD ($)</option>
              <option value="LBP">LBP</option>
            </select>
          </div>
        </div>

        {/* Scan / Status Alert Feedback */}
        {scanStatusMessage && (
          <div
            className={`px-3 py-1.5 text-xs font-medium flex items-center justify-between border-b ${
              scanStatusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
            }`}
          >
            <span>{scanStatusMessage.text}</span>
            <button type="button" onClick={() => setScanStatusMessage(null)}>
              <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden min-h-0 gap-3">
          {/* Add Item Section Box */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-3 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-amber-500" />
                Select Product to Return
              </span>
              {selectedProduct && (
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200/60 dark:border-amber-900/60">
                  Current Stock: {selectedProduct.stockQuantity} box{selectedProduct.stockQuantity !== 1 ? 'es' : ''}
                </span>
              )}
            </div>

            {/* Item selection row */}
            <div className="grid grid-cols-12 gap-2 items-end">
              {/* Product search */}
              <div className="col-span-5 relative" ref={productDropdownRef}>
                <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                  Medication / Barcode
                </label>
                <div className="relative">
                  <input
                    ref={productSearchRef}
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setIsProductDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (productSearchQuery.trim()) setIsProductDropdownOpen(true);
                    }}
                    placeholder="Search name, barcode, code..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
                  />
                  {isProductDropdownOpen && (
                    <div
                      ref={productListContainerRef}
                      className="absolute left-0 top-full mt-1 w-[460px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-lg max-h-52 overflow-y-auto z-50 divide-y divide-slate-100 dark:divide-slate-700"
                    >
                      {filteredProducts.map((p, idx) => (
                        <div
                          key={p.id}
                          ref={(el) => { productItemRefs.current[idx] = el; }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectProduct(p);
                          }}
                          className="px-3 py-2 cursor-pointer hover:bg-amber-50 dark:hover:bg-slate-700/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100">{p.name}</div>
                            <div className="text-[10px] text-slate-400 flex gap-2">
                              <span>Code: {p.code}</span>
                              {p.barcode && <span>BC: {p.barcode}</span>}
                              {p.agent && <span className="text-teal-600 dark:text-teal-400">({p.agent})</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              Stock: {p.stockQuantity}
                            </span>
                            <div className="text-[10px] text-slate-400">
                              Cost: ${p.costPriceUSD?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity to return */}
              <div className="col-span-2">
                <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                  Return Qty (Boxes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={itemQty}
                  onChange={(e) => {
                    setItemQty(e.target.value);
                    if (returnType === 'replace_expiry') {
                      setReplacementQty(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none text-center"
                />
              </div>

              {/* Old Batch / Expiry being returned */}
              <div className="col-span-2">
                <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                  Old Batch / Lot
                </label>
                <input
                  type="text"
                  value={oldBatchNumber}
                  onChange={(e) => setOldBatchNumber(e.target.value)}
                  placeholder="LOT-XXX"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>

              <div className="col-span-3">
                <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                  Old Expiry (MM/YYYY)
                </label>
                <input
                  type="text"
                  value={oldDisplayExpiry}
                  onChange={handleOldExpiryChange}
                  placeholder="MM/YYYY"
                  maxLength={7}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Secondary Row: Specific to Return Type */}
            <div className="grid grid-cols-12 gap-2 items-end mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              {returnType === 'replace_expiry' ? (
                <>
                  <div className="col-span-3">
                    <label className="block text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400 mb-0.5">
                      New Batch / Lot Number
                    </label>
                    <input
                      type="text"
                      value={newBatchNumber}
                      onChange={(e) => setNewBatchNumber(e.target.value)}
                      placeholder="e.g. LOT-2027A"
                      className="w-full bg-amber-50/50 dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400 mb-0.5">
                      New Expiry Date (MM/YYYY) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newDisplayExpiry}
                      onChange={handleNewExpiryChange}
                      placeholder="e.g. 12/2028"
                      maxLength={7}
                      className="w-full bg-amber-50/50 dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400 mb-0.5">
                      Replacement Qty
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={replacementQty}
                      onChange={(e) => setReplacementQty(e.target.value)}
                      className="w-full bg-amber-50/50 dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none text-center"
                    />
                  </div>

                  <div className="col-span-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedProduct}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-3 text-xs shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add to Expiry Swap</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-3">
                    <label className="block text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-0.5">
                      Unit Refund Cost ({currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={itemUnitCost}
                      onChange={(e) => setItemUnitCost(e.target.value)}
                      className="w-full bg-emerald-50/50 dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 rounded px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-emerald-500 outline-none text-right"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-0.5">
                      Total Refund ({currency})
                    </label>
                    <div className="w-full bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 rounded px-2 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 text-right">
                      {currency === 'USD'
                        ? `$${((parseFloat(itemUnitCost) || 0) * (parseInt(itemQty, 10) || 0)).toFixed(2)}`
                        : `${formatLBPValue(Math.round((parseFloat(itemUnitCost) || 0) * (parseInt(itemQty, 10) || 0)))} LBP`}
                    </div>
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                      Item Note / Reason
                    </label>
                    <input
                      type="text"
                      value={itemReason}
                      onChange={(e) => setItemReason(e.target.value)}
                      placeholder="Optional notes..."
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div className="col-span-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedProduct}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 text-xs shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add to Cash Return</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Items Table in Return */}
          <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden flex flex-col">
            <div className="bg-slate-100 dark:bg-slate-800/90 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span>Items to Return ({items.length})</span>
                {returnType === 'replace_expiry' ? (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200">
                    Stock will swap old batch for new batch
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200">
                    Stock count will decrease by returned quantity
                  </span>
                )}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                  <RotateCcw className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2 stroke-[1.5]" />
                  <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No items added to this return yet.</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Search and select medications above, specify return quantities and batch/expiry details, then click add.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                    <tr>
                      <th className="p-2 font-bold">Code</th>
                      <th className="p-2 font-bold">Product Name</th>
                      <th className="p-2 font-bold text-center">Return Qty</th>
                      <th className="p-2 font-bold">Old Batch / Expiry</th>
                      {returnType === 'replace_expiry' ? (
                        <th className="p-2 font-bold text-amber-600 dark:text-amber-400">New Batch / Expiry</th>
                      ) : (
                        <th className="p-2 font-bold text-right text-emerald-600 dark:text-emerald-400">Refund Value</th>
                      )}
                      <th className="p-2 font-bold">Reason</th>
                      <th className="p-2 font-bold text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                        <td className="p-2 font-mono text-slate-600 dark:text-slate-300">{it.productCode || '—'}</td>
                        <td className="p-2 font-bold text-slate-900 dark:text-slate-100">{it.productName || it.name}</td>
                        <td className="p-2 text-center font-bold text-amber-600 dark:text-amber-400">
                          {it.quantity} box{it.quantity !== 1 ? 'es' : ''}
                        </td>
                        <td className="p-2 text-slate-600 dark:text-slate-300">
                          {it.oldBatchNumber && <span className="font-mono">{it.oldBatchNumber} </span>}
                          {it.oldExpiryDate && <span className="text-slate-400">({it.oldExpiryDate})</span>}
                          {!it.oldBatchNumber && !it.oldExpiryDate && <span className="text-slate-400 italic">Current stock</span>}
                        </td>
                        {returnType === 'replace_expiry' ? (
                          <td className="p-2 text-amber-700 dark:text-amber-300 font-semibold">
                            {it.newBatchNumber && <span className="font-mono">{it.newBatchNumber} </span>}
                            {it.newExpiryDate && <span>(Exp: {it.newExpiryDate})</span>}
                            {it.replacementQuantity && it.replacementQuantity !== it.quantity && (
                              <span className="ml-1 text-slate-500">[{it.replacementQuantity} repl]</span>
                            )}
                          </td>
                        ) : (
                          <td className="p-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {currency === 'USD'
                              ? `$${(it.refundAmountUSD || 0).toFixed(2)}`
                              : `${formatLBPValue(it.refundAmountLBP || 0)} LBP`}
                          </td>
                        )}
                        <td className="p-2 text-slate-500">{it.reason || reason}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Remove item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer Summary & Action */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-500">
              Total Items: <span className="font-bold text-slate-800 dark:text-slate-100">{items.length}</span>
            </div>
            {returnType === 'cash_refund' && (
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Total Refund: {currency === 'USD' ? `$${totalRefundUSD.toFixed(2)}` : `${formatLBPValue(totalRefundLBP)} LBP`}
                {currency === 'USD' && totalRefundUSD > 0 && (
                  <span className="text-[10px] text-slate-400 ml-1.5">
                    ({formatLBPValue(Math.round(totalRefundUSD * exchangeRate))} LBP)
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={items.length === 0 || !selectedSupplierId}
              className="flex items-center gap-1.5 px-6 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>Confirm & Process Return</span>
            </button>
          </div>
        </div>
      </form>
    </DesktopWindow>
  );
};
