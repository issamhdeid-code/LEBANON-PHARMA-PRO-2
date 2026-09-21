import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  RotateCcw,
  Banknote,
  CreditCard,
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
  Receipt,
  Users
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { DesktopWindow } from '../common/DesktopWindow';
import { Product, SaleReturnItem, Customer, SaleTransaction } from '../../types/pharmacy';
import { filterProductsByMultiWordQuery } from '../../utils/searchUtils';
import { formatLBPValue } from '../../utils/priceUtils';

interface NewCustomerReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomerId?: string;
}

export const NewCustomerReturnModal: React.FC<NewCustomerReturnModalProps> = ({
  isOpen,
  onClose,
  initialCustomerId,
}) => {
  const {
    customers,
    products,
    sales,
    recordSaleReturn,
    exchangeRate,
    settings,
  } = usePharmacy();

  // Header State
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || '');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerHighlightedIndex, setCustomerHighlightedIndex] = useState(0);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  const [refundMethod, setRefundMethod] = useState<'cash_drawer' | 'customer_credit'>('cash_drawer');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('Customer Changed Mind / Unopened');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'LBP'>('USD');
  const [receivedBy, setReceivedBy] = useState('Pharmacist on Duty');

  // Link to original sale invoice (optional)
  const [originalSaleInvoiceNumber, setOriginalSaleInvoiceNumber] = useState('');
  const [originalSaleId, setOriginalSaleId] = useState('');

  // Return Items Table
  const [items, setItems] = useState<SaleReturnItem[]>([]);

  // Item Draft Form
  const [currentProductId, setCurrentProductId] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [productHighlightedIndex, setProductHighlightedIndex] = useState(0);
  const [itemCode, setItemCode] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemUnitPriceUSD, setItemUnitPriceUSD] = useState('0');
  const [itemUnitPriceLBP, setItemUnitPriceLBP] = useState('0');
  const [itemReason, setItemReason] = useState('');
  const [itemBatchNumber, setItemBatchNumber] = useState('');
  const [itemExpiryDate, setItemExpiryDate] = useState('');

  // Available batches for currently chosen product
  const currentSelectedProduct = useMemo(() => {
    return products.find(p => p.id === currentProductId);
  }, [products, currentProductId]);

  const productBatches = useMemo(() => {
    if (!currentSelectedProduct) return [];
    if (currentSelectedProduct.batches && currentSelectedProduct.batches.length > 0) {
      return currentSelectedProduct.batches;
    }
    if (currentSelectedProduct.batchNumber || currentSelectedProduct.expiryDate) {
      return [{
        batchNumber: currentSelectedProduct.batchNumber || '',
        expiryDate: currentSelectedProduct.expiryDate || '',
        quantity: currentSelectedProduct.stockQuantity
      }];
    }
    return [];
  }, [currentSelectedProduct]);

  // When initialCustomerId changes
  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
      const cust = customers.find(c => c.id === initialCustomerId);
      if (cust) {
        setCustomerSearchQuery(cust.name);
      }
    }
  }, [initialCustomerId, customers]);

  // Customer search filtering
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers.slice(0, 15);
    const q = customerSearchQuery.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q))
    ).slice(0, 15);
  }, [customers, customerSearchQuery]);

  // Product search filtering
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return [];
    return filterProductsByMultiWordQuery(products, productSearchQuery).slice(0, 20);
  }, [products, productSearchQuery]);

  // Customer selection
  const handleSelectCustomer = (cust: Customer | null) => {
    if (cust) {
      setSelectedCustomerId(cust.id);
      setCustomerSearchQuery(cust.name);
    } else {
      setSelectedCustomerId('');
      setCustomerSearchQuery('Walk-in Patient (No Account)');
    }
    setIsCustomerDropdownOpen(false);
  };

  // Select Product
  const handleSelectProduct = (prod: Product) => {
    setCurrentProductId(prod.id);
    setProductSearchQuery(`${prod.name} ${prod.dosage || ''}`);
    setItemCode(prod.code || '');
    setItemBarcode(prod.barcode || '');
    
    // Set prices
    const usdPrice = prod.priceUSD || 0;
    const lbpPrice = prod.priceLBP || Math.round(usdPrice * (exchangeRate || 1));
    setItemUnitPriceUSD(usdPrice.toFixed(2));
    setItemUnitPriceLBP(lbpPrice.toString());

    // Set batch/expiry defaults from product
    if (prod.batches && prod.batches.length > 0) {
      const b = prod.batches[0];
      setItemBatchNumber(b.batchNumber);
      setItemExpiryDate(b.expiryDate);
    } else {
      setItemBatchNumber(prod.batchNumber || '');
      setItemExpiryDate(prod.expiryDate || '');
    }

    setIsProductDropdownOpen(false);
  };

  // Autofill from original invoice if user enters one
  const handleLookupInvoice = () => {
    if (!originalSaleInvoiceNumber.trim()) return;
    const foundSale = sales.find(s => 
      s.invoiceNumber.toLowerCase() === originalSaleInvoiceNumber.trim().toLowerCase() ||
      s.id.toLowerCase() === originalSaleInvoiceNumber.trim().toLowerCase()
    );

    if (foundSale) {
      setOriginalSaleId(foundSale.id);
      if (foundSale.customerId) {
        setSelectedCustomerId(foundSale.customerId);
        const c = customers.find(cust => cust.id === foundSale.customerId);
        if (c) setCustomerSearchQuery(c.name);
      } else if (foundSale.customerName) {
        setCustomerSearchQuery(foundSale.customerName);
      }

      // Preload items from that sale
      const loadedItems: SaleReturnItem[] = foundSale.items.map(it => {
        const uUSD = it.unitPriceUSD || 0;
        const uLBP = it.unitPriceLBP || Math.round(uUSD * (exchangeRate || 1));
        const totalU = Number((uUSD * it.quantity).toFixed(2));
        const totalL = Math.round(uLBP * it.quantity);

        return {
          productId: it.productId,
          productCode: it.productCode,
          productName: it.productName,
          category: it.category,
          quantity: it.quantity,
          isPiece: it.isPiece,
          unitPriceUSD: uUSD,
          unitPriceLBP: uLBP,
          totalUSD: totalU,
          totalLBP: totalL,
          totalRefundUSD: totalU,
          totalRefundLBP: totalL,
          selectedBatchNumber: it.selectedBatchNumber,
          selectedExpiryDate: it.selectedExpiryDate,
          batchNumber: it.selectedBatchNumber,
          expiryDate: it.selectedExpiryDate,
          reason: 'Returned from invoice #' + foundSale.invoiceNumber,
        };
      });

      setItems(loadedItems);
    }
  };

  // Add Item to Return List
  const handleAddItem = () => {
    if (!productSearchQuery.trim()) return;
    const qty = parseFloat(itemQty) || 1;
    if (qty <= 0) return;

    const uUSD = parseFloat(itemUnitPriceUSD) || 0;
    const uLBP = parseInt(itemUnitPriceLBP, 10) || Math.round(uUSD * (exchangeRate || 1));
    const totalU = Number((uUSD * qty).toFixed(2));
    const totalL = Math.round(uLBP * qty);

    const newItem: SaleReturnItem = {
      productId: currentProductId || `CUSTOM-${Date.now()}`,
      productCode: itemCode,
      productName: productSearchQuery.trim(),
      barcode: itemBarcode,
      quantity: qty,
      unitPriceUSD: uUSD,
      unitPriceLBP: uLBP,
      totalUSD: totalU,
      totalLBP: totalL,
      totalRefundUSD: totalU,
      totalRefundLBP: totalL,
      selectedBatchNumber: itemBatchNumber,
      selectedExpiryDate: itemExpiryDate,
      batchNumber: itemBatchNumber,
      expiryDate: itemExpiryDate,
      reason: itemReason || reason,
    };

    setItems(prev => [...prev, newItem]);

    // Reset draft fields
    setCurrentProductId('');
    setProductSearchQuery('');
    setItemCode('');
    setItemBarcode('');
    setItemQty('1');
    setItemUnitPriceUSD('0');
    setItemUnitPriceLBP('0');
    setItemReason('');
    setItemBatchNumber('');
    setItemExpiryDate('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Totals
  const totals = useMemo(() => {
    let usd = 0;
    let lbp = 0;
    for (const item of items) {
      usd += item.totalRefundUSD || 0;
      lbp += item.totalRefundLBP || 0;
    }
    return {
      usd: Number(usd.toFixed(2)),
      lbp: Math.round(lbp),
    };
  }, [items]);

  // Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const custObj = customers.find(c => c.id === selectedCustomerId);
    const finalCustomerName = custObj ? custObj.name : (customerSearchQuery.trim() || 'Walk-in Patient');

    recordSaleReturn({
      date: returnDate,
      originalSaleId: originalSaleId || undefined,
      originalSaleInvoiceNumber: originalSaleInvoiceNumber.trim() || undefined,
      customerId: selectedCustomerId || undefined,
      customerName: finalCustomerName,
      items,
      totalRefundUSD: totals.usd,
      totalRefundLBP: totals.lbp,
      refundMethod,
      currency,
      reason: customReason.trim() || reason,
      notes: notes.trim() || undefined,
      receivedBy: receivedBy.trim() || 'Pharmacist',
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <DesktopWindow
      id="new_customer_return_modal"
      title="Return On Sale — Customer Good Return Form"
      isOpen={isOpen}
      onClose={onClose}
      minWidth={780}
      minHeight={580}
      width="900px"
      height="680px"
      section="customer"
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col bg-slate-50 dark:bg-slate-900 text-xs">
        {/* Top Controls Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 p-4 shrink-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Customer Selector */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Customer / Patient
              </label>
              <div className="relative">
                <input
                  ref={customerInputRef}
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setIsCustomerDropdownOpen(true);
                  }}
                  onFocus={() => setIsCustomerDropdownOpen(true)}
                  placeholder="Search customer or Walk-in Patient..."
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-teal-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {isCustomerDropdownOpen && (
                <div
                  ref={customerDropdownRef}
                  className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-30 divide-y divide-slate-100 dark:divide-slate-700/50"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectCustomer(null)}
                    className="w-full text-left px-3 py-2 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-between"
                  >
                    <span>Walk-in Patient (No Account)</span>
                    <span className="text-[10px] text-slate-400">Cash only</span>
                  </button>
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full text-left px-3 py-2 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-slate-900 dark:text-slate-100 font-medium text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold">{c.name}</div>
                        {c.phone && <div className="text-[10px] text-slate-400">{c.phone}</div>}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400">Debt: </span>
                        <span className={`font-mono font-bold ${c.balanceUSD > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                          ${c.balanceUSD.toFixed(2)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Refund Method */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Refund Execution Method
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setRefundMethod('cash_drawer')}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-bold transition-colors cursor-pointer ${
                    refundMethod === 'cash_drawer'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-500'
                  }`}
                >
                  <Banknote className="h-3.5 w-3.5" />
                  <span>Cash Drawer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRefundMethod('customer_credit')}
                  disabled={!selectedCustomerId}
                  title={!selectedCustomerId ? 'Select a patient account to enable customer credit' : 'Deduct from patient debt'}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-bold transition-colors cursor-pointer ${
                    refundMethod === 'customer_credit'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : !selectedCustomerId
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-500'
                  }`}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Customer Credit</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {refundMethod === 'cash_drawer'
                  ? 'Reimburses cash & deducts directly from Cash Drawer.'
                  : 'Reduces patient outstanding credit debt balance.'}
              </p>
            </div>

            {/* Link Original Invoice */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Original Sale Invoice # (Optional)
              </label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Receipt className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={originalSaleInvoiceNumber}
                    onChange={(e) => setOriginalSaleInvoiceNumber(e.target.value)}
                    placeholder="e.g. 25-001 or S-123"
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleLookupInvoice}
                  title="Search and load items from this invoice"
                  className="rounded bg-slate-100 dark:bg-slate-750 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Find
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Return Date
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Return Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
              >
                <option value="Customer Changed Mind / Unopened">Customer Changed Mind / Unopened</option>
                <option value="Doctor Changed Prescription / Dosage">Doctor Changed Prescription / Dosage</option>
                <option value="Allergic Reaction / Adverse Effect">Allergic Reaction / Adverse Effect</option>
                <option value="Defective / Damaged Packaging">Defective / Damaged Packaging</option>
                <option value="Dispensing Error / Wrong Item Sold">Dispensing Error / Wrong Item Sold</option>
                <option value="Custom">Custom / Other</option>
              </select>
            </div>
            {reason === 'Custom' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Specify Reason
                </label>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter details..."
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Received & Handled By
              </label>
              <input
                type="text"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Pharmacist name..."
                className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Item Entry Draft Form */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 p-3 shrink-0">
          <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-teal-600" />
              <span>Add Good / Drug to Return</span>
            </span>
            <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold">
              Stock will be restored directly upon submission
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            {/* Product Selector */}
            <div className="md:col-span-5 relative">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                Item Name / Barcode / Code
              </label>
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => {
                  setProductSearchQuery(e.target.value);
                  setIsProductDropdownOpen(true);
                }}
                onFocus={() => setIsProductDropdownOpen(true)}
                placeholder="Type drug name or scan barcode..."
                className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-teal-500 focus:outline-none"
              />

              {isProductDropdownOpen && filteredProducts.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 shadow-xl z-40 divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProduct(p)}
                      className="w-full text-left px-3 py-2 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-slate-900 dark:text-slate-100 font-medium text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold">{p.name} {p.dosage || ''}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Code: {p.code || 'N/A'} • Barcode: {p.barcode || 'N/A'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-teal-600">${(p.priceUSD || 0).toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">Stock: {p.stockQuantity}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="md:col-span-1">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                Qty
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 text-center font-bold focus:border-teal-500 focus:outline-none"
              />
            </div>

            {/* Unit Price USD */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                Unit Refund ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={itemUnitPriceUSD}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemUnitPriceUSD(val);
                  const num = parseFloat(val) || 0;
                  setItemUnitPriceLBP(Math.round(num * (exchangeRate || 1)).toString());
                }}
                className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-teal-500 focus:outline-none"
              />
            </div>

            {/* Batch & Expiry */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                Batch #
              </label>
              {productBatches.length > 0 ? (
                <select
                  value={itemBatchNumber}
                  onChange={(e) => {
                    const selBatch = productBatches.find(b => b.batchNumber === e.target.value);
                    setItemBatchNumber(e.target.value);
                    if (selBatch) setItemExpiryDate(selBatch.expiryDate);
                  }}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-teal-500 focus:outline-none"
                >
                  <option value="">Select Batch...</option>
                  {productBatches.map(b => (
                    <option key={b.batchNumber} value={b.batchNumber}>
                      {b.batchNumber} (Exp: {b.expiryDate})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={itemBatchNumber}
                  onChange={(e) => setItemBatchNumber(e.target.value)}
                  placeholder="Batch code..."
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-teal-500 focus:outline-none"
                />
              )}
            </div>

            {/* Action button */}
            <div className="md:col-span-2 flex items-end">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!productSearchQuery.trim()}
                className={`w-full flex items-center justify-center gap-1 rounded py-1.5 px-3 text-xs font-bold transition-colors cursor-pointer ${
                  productSearchQuery.trim()
                    ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-2xs'
                    : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Item</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table of Returned Items */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Item Description</th>
                  <th className="py-2 px-3 text-center">Qty</th>
                  <th className="py-2 px-3 text-right">Unit Refund ($)</th>
                  <th className="py-2 px-3 text-right">Total Refund ($)</th>
                  <th className="py-2 px-3 text-right">Total (LBP)</th>
                  <th className="py-2 px-3">Batch / Expiry</th>
                  <th className="py-2 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                {items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{it.productName}</div>
                      {it.productCode && <div className="text-[10px] text-slate-400 font-mono">Code: {it.productCode}</div>}
                    </td>
                    <td className="py-2 px-3 text-center font-bold font-mono">{it.quantity}</td>
                    <td className="py-2 px-3 text-right font-mono">${(it.unitPriceUSD || 0).toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-bold font-mono text-teal-600 dark:text-teal-400">
                      ${(it.totalRefundUSD || 0).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                      {formatLBPValue(it.totalRefundLBP || 0)} LBP
                    </td>
                    <td className="py-2 px-3 text-[11px] font-mono text-slate-500">
                      {it.batchNumber ? `${it.batchNumber}${it.expiryDate ? ` (${it.expiryDate})` : ''}` : 'Default batch'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No items added to this return yet. Use the product search above to add items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Summary & Actions */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 p-4 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500">Total Items</div>
              <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                {items.length} ({items.reduce((sum, i) => sum + i.quantity, 0)} units)
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500">Total Refund USD</div>
              <div className="text-base font-extrabold text-teal-600 dark:text-teal-400 font-mono">
                ${totals.usd.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500">Total Refund LBP</div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">
                {formatLBPValue(totals.lbp)} LBP
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={items.length === 0}
              className={`flex items-center gap-1.5 rounded px-5 py-2 text-xs font-bold text-white transition-colors cursor-pointer ${
                items.length > 0
                  ? 'bg-teal-600 hover:bg-teal-700 shadow-md'
                  : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-500'
              }`}
            >
              <Check className="h-4 w-4" />
              <span>Confirm Return & Restock</span>
            </button>
          </div>
        </div>
      </form>
    </DesktopWindow>
  );
};
