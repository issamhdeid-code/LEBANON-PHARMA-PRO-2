import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Trash2,
  X,
  Search,
  Check,
  RefreshCw,
  Building2,
  Calendar,
  Hash,
  Layers,
  ArrowRight,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';
import { DesktopWindow } from '../common/DesktopWindow';
import { Product, Supplier, PurchaseItem } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';
import {
  ExtractedInvoiceData,
  MatchedInvoiceItem,
  matchExtractedInvoice,
  convertToPurchaseItem,
  sendInvoiceToIDPApi,
  getSampleDemoInvoice,
  normalizeExtractedExpiry,
} from '../../services/idpService';
import { isProductExpired } from './PurchaseView';

interface IDPInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  suppliers: Supplier[];
  exchangeRate: number;
  onApplyInvoice: (data: {
    supplierId: string;
    supplierName: string;
    invoiceNumber: string;
    invoiceDate: string;
    currency: 'USD' | 'LBP';
    invoiceDiscount: number;
    items: PurchaseItem[];
  }) => void;
}

export const IDPInvoiceModal: React.FC<IDPInvoiceModalProps> = ({
  isOpen,
  onClose,
  products,
  suppliers,
  exchangeRate,
  onApplyInvoice,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  // Extracted and matched data state
  const [extractedData, setExtractedData] = useState<ExtractedInvoiceData | null>(null);
  const [matchedSupplierId, setMatchedSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [currency, setCurrency] = useState<'USD' | 'LBP'>('USD');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [items, setItems] = useState<MatchedInvoiceItem[]>([]);

  // Item catalog selector state (for manually changing/linking an item)
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setFilePreviewUrl(null);
    setIsProcessing(false);
    setProcessingStatus('');
    setErrorMessage(null);
    setInfoNotice(null);
    setExtractedData(null);
    setMatchedSupplierId('');
    setInvoiceNumber('');
    setInvoiceDate('');
    setItems([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (file: File) => {
    setErrorMessage(null);
    setInfoNotice(null);
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('File size exceeds 15MB limit. Please upload a smaller image or compressed PDF.');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const processFileWithAI = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setInfoNotice(null);
    setProcessingStatus('Converting document for AI processing...');

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(selectedFile);
      });

      setProcessingStatus('Gemini Vision is parsing distributor lines, batches & expiry dates...');
      const extracted = await sendInvoiceToIDPApi(base64, selectedFile.type);

      setProcessingStatus('Matching items against pharmacy inventory catalog...');
      const matched = matchExtractedInvoice(extracted, products, suppliers, exchangeRate);

      setExtractedData(extracted);
      setMatchedSupplierId(matched.supplierId);
      setInvoiceNumber(matched.invoiceNumber);
      setInvoiceDate(matched.invoiceDate);
      setCurrency(matched.currency);
      setDiscountPercent(matched.invoiceDiscount);
      setItems(matched.items);
      setIsProcessing(false);
    } catch (err: any) {
      console.info('[IDP] File processing notice:', err?.message || err);
      setIsProcessing(false);

      if (err?.isHighDemand || String(err?.message || '').toLowerCase().includes('high demand') || String(err?.message || '').toLowerCase().includes('503')) {
        setErrorMessage('Google Gemini Vision is temporarily experiencing high traffic. You can click "Retry with AI" or try the sample demo invoice.');
        return;
      }

      // If server responded that GEMINI_API_KEY is missing or fallback is needed
      if (err?.fallbackNeeded || String(err?.message || '').toLowerCase().includes('api key')) {
        const sample = getSampleDemoInvoice();
        const matched = matchExtractedInvoice(sample, products, suppliers, exchangeRate);
        setExtractedData(sample);
        setMatchedSupplierId(matched.supplierId);
        setInvoiceNumber(matched.invoiceNumber);
        setInvoiceDate(matched.invoiceDate);
        setCurrency(matched.currency);
        setDiscountPercent(matched.invoiceDiscount);
        setItems(matched.items);
        setInfoNotice(
          'Gemini Vision key is not configured on the server. You can add GEMINI_API_KEY in the environment / Settings. Meanwhile, loaded sample distributor invoice template for verification and editing.'
        );
        return;
      }

      setErrorMessage(
        err.message || 'Failed to extract invoice data. Please verify your file or try sample demo mode.'
      );
    }
  };

  const handleLoadDemoInvoice = () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStatus('Loading sample Lebanese distributor invoice (Demo Mode)...');

    setTimeout(() => {
      const sample = getSampleDemoInvoice();
      const matched = matchExtractedInvoice(sample, products, suppliers, exchangeRate);
      setExtractedData(sample);
      setMatchedSupplierId(matched.supplierId);
      setInvoiceNumber(matched.invoiceNumber);
      setInvoiceDate(matched.invoiceDate);
      setCurrency(matched.currency);
      setDiscountPercent(matched.invoiceDiscount);
      setItems(matched.items);
      setIsProcessing(false);
    }, 350);
  };

  // Filtered products for quick linker
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm.trim()) return products.slice(0, 10);
    const q = productSearchTerm.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q)) || (p.barcode && p.barcode.includes(q)))
      .slice(0, 15);
  }, [products, productSearchTerm]);

  const handleLinkProduct = (itemIdx: number, product: Product) => {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== itemIdx) return it;
        return {
          ...it,
          matchedProductId: product.id,
          matchedProductName: product.name,
          matchedProductCode: product.code,
          matchType: 'exact',
          calculatedSellingPriceLBP: product.priceLBP || it.calculatedSellingPriceLBP,
          calculatedSellingPriceUSD: product.priceUSD || it.calculatedSellingPriceUSD,
        };
      })
    );
    setEditingItemIdx(null);
    setProductSearchTerm('');
  };

  const handleUpdateItemField = (idx: number, field: keyof MatchedInvoiceItem, value: any) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: value };

        // Recalculate cost if unitCost changed
        if (field === 'unitCost') {
          const cost = Math.max(0, Number(value) || 0);
          if (currency === 'USD') {
            updated.calculatedUnitCostUSD = cost;
            updated.calculatedUnitCostLBP = Math.round(cost * exchangeRate);
          } else {
            updated.calculatedUnitCostLBP = Math.round(cost);
            updated.calculatedUnitCostUSD = exchangeRate > 0 ? Number((cost / exchangeRate).toFixed(2)) : 0;
          }
        }

        // Recalculate expiry validation if expiry changed
        if (field === 'displayExpiry' || field === 'expiryDate') {
          const { displayExpiry, isoExpiry } = normalizeExtractedExpiry(String(value));
          updated.displayExpiry = displayExpiry;
          updated.normalizedExpiryISO = isoExpiry;
          updated.isExpired = isProductExpired(displayExpiry || isoExpiry);
        }

        return updated;
      })
    );
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleApply = () => {
    if (items.length === 0) {
      setErrorMessage('Please ensure at least one line item is present before applying.');
      return;
    }

    const supplierObj = suppliers.find((s) => s.id === matchedSupplierId);
    const finalSupplierName = supplierObj?.name || extractedData?.supplierName || 'Unknown Supplier';

    // Convert all items to standard PurchaseItem
    const purchaseItems: PurchaseItem[] = items.map((it) => {
      const pMatch = products.find((p) => p.id === it.matchedProductId);
      return convertToPurchaseItem(it, pMatch);
    });

    onApplyInvoice({
      supplierId: matchedSupplierId,
      supplierName: finalSupplierName,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
      currency,
      invoiceDiscount: discountPercent,
      items: purchaseItems,
    });

    handleClose();
  };

  // Calculations for summary footer
  const totalCostUSD = useMemo(() => {
    return items.reduce((sum, it) => {
      const lineCost = (it.calculatedUnitCostUSD || 0) * (it.quantity || 1) * (1 - (it.discount || 0) / 100);
      return sum + lineCost;
    }, 0);
  }, [items]);

  const totalCostLBP = useMemo(() => {
    return items.reduce((sum, it) => {
      const lineCost = (it.calculatedUnitCostLBP || 0) * (it.quantity || 1) * (1 - (it.discount || 0) / 100);
      return sum + lineCost;
    }, 0);
  }, [items]);

  const matchedCount = useMemo(() => items.filter((it) => it.matchType !== 'none').length, [items]);

  if (!isOpen) return null;

  return (
    <DesktopWindow
      title="Intelligent Document Processing (IDP) — Supplier Invoices"
      id="idp-invoice-modal"
      isOpen={isOpen}
      onClose={handleClose}
      width="960px"
      minWidth={600}
      height="auto"
    >
      <div className="flex flex-col max-h-[85vh] bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
        {/* Step 1: Upload View (When nothing is extracted yet) */}
        {!extractedData ? (
          <div className="p-6 space-y-4">
            <div className="text-center max-w-xl mx-auto space-y-1.5">
              <div className="inline-flex items-center justify-center p-2.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 mb-1">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Automatic Invoice Extraction & Auto-Fill
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Upload or drop a supplier purchase invoice (Mersaco, Omnipharma, Sadco, Benta, Fattal, etc.) as a PDF or image.
                Gemini Vision extracts items, lot numbers, expiry dates, and costs directly into your purchase form.
              </p>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                selectedFile
                  ? 'border-teal-500 bg-teal-50/40 dark:bg-teal-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-teal-500 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />

              {selectedFile ? (
                <div className="flex flex-col items-center space-y-2">
                  {selectedFile.type.startsWith('image/') ? (
                    <div className="relative group">
                      <img
                        src={filePreviewUrl || ''}
                        alt="Invoice preview"
                        className="max-h-48 rounded border border-slate-200 dark:border-slate-700 object-contain shadow-xs"
                      />
                    </div>
                  ) : (
                    <FileText className="w-16 h-16 text-teal-600 dark:text-teal-400" />
                  )}
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB • Click or drop to change</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  <UploadCloud className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                  <div className="text-xs">
                    <span className="font-bold text-teal-600 dark:text-teal-400">Click to upload</span> or drag and drop
                  </div>
                  <p className="text-[11px] text-slate-500">PDF, JPG, PNG, or WebP up to 15MB</p>
                </div>
              )}
            </div>

            {/* Error Display */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{errorMessage}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedFile && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={processFileWithAI}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                      Retry with AI
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleLoadDemoInvoice}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-100 dark:bg-rose-900/60 hover:bg-rose-200 text-rose-800 dark:text-rose-200 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    Try Demo Invoice
                  </button>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleLoadDemoInvoice}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800/80 bg-teal-50/50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 text-xs font-semibold hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                <span>Load Sample Invoice (Demo)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedFile || isProcessing}
                  onClick={processFileWithAI}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing Document...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Extract Invoice with AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Processing Spinner Overlay */}
            {isProcessing && (
              <div className="p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 text-center space-y-2">
                <RefreshCw className="w-5 h-5 text-teal-600 dark:text-teal-400 animate-spin mx-auto" />
                <p className="text-xs font-bold text-teal-800 dark:text-teal-200">{processingStatus}</p>
                <p className="text-[11px] text-teal-600/80 dark:text-teal-400/80">
                  This takes ~4 to 8 seconds depending on invoice complexity.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Review & Verification View */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header Form Controls */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 grid grid-cols-2 sm:grid-cols-5 gap-2 items-center shrink-0">
              {/* Supplier Selector */}
              <div className="col-span-2 sm:col-span-2 space-y-0.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-teal-600" />
                  Supplier / Distributor
                </label>
                <select
                  value={matchedSupplierId}
                  onChange={(e) => setMatchedSupplierId(e.target.value)}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100"
                >
                  <option value="">-- Select or link supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code || 'No Code'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice Number */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-teal-600" />
                  Invoice #
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium"
                />
              </div>

              {/* Invoice Date */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-teal-600" />
                  Date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium"
                />
              </div>

              {/* Currency & Discount */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Currency & Disc.
                </label>
                <div className="flex gap-1">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'USD' | 'LBP')}
                    className="w-16 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1 py-1 text-xs font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="LBP">LBP</option>
                  </select>
                  <input
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                    placeholder="Disc %"
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-1 text-xs"
                    title="Global Invoice Discount %"
                  />
                </div>
              </div>
            </div>

            {/* Informative Fallback Banner */}
            {infoNotice && (
              <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-medium">{infoNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoNotice(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Quick Status Bar */}
            <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-3 text-[11px]">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {items.length} items extracted
                </span>
                <span className="inline-flex items-center text-teal-600 dark:text-teal-400 font-semibold">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {matchedCount} matched to stock
                </span>
                {items.length - matchedCount > 0 && (
                  <span className="inline-flex items-center text-amber-600 dark:text-amber-400 font-semibold">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {items.length - matchedCount} need linking
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={resetState}
                className="text-[11px] text-teal-600 hover:text-teal-700 font-bold hover:underline cursor-pointer"
              >
                Scan another document
              </button>
            </div>

            {/* Table of Extracted Items */}
            <div className="flex-1 overflow-auto max-h-[50vh] p-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 z-10 font-bold text-[11px]">
                  <tr>
                    <th className="p-1.5 w-8">#</th>
                    <th className="p-1.5 min-w-[200px]">Invoice Product & Stock Match</th>
                    <th className="p-1.5 w-16 text-center">Qty</th>
                    <th className="p-1.5 w-14 text-center">Free</th>
                    <th className="p-1.5 w-24">Batch #</th>
                    <th className="p-1.5 w-24">Expiry</th>
                    <th className="p-1.5 w-20 text-right">Cost ({currency})</th>
                    <th className="p-1.5 w-14 text-center">Disc%</th>
                    <th className="p-1.5 w-24 text-right">Total</th>
                    <th className="p-1.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-normal">
                  {items.map((it, idx) => {
                    const isLinkingThis = editingItemIdx === idx;
                    const lineTotal = (it.unitCost || 0) * (it.quantity || 1) * (1 - (it.discount || 0) / 100);

                    return (
                      <tr
                        key={it.id || idx}
                        className={`hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition-colors ${
                          it.isExpired ? 'bg-rose-50/70 dark:bg-rose-950/20' : ''
                        }`}
                      >
                        <td className="p-1.5 text-slate-400 text-center">{idx + 1}</td>

                        {/* Product Name & Match status */}
                        <td className="p-1.5 relative">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800 dark:text-slate-100 text-[11px] leading-snug">
                              {it.productName}
                            </p>
                            {it.matchedProductId ? (
                              <div className="flex items-center gap-1">
                                <span className="inline-block px-1.5 py-0.2 rounded text-[10px] bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 font-medium">
                                  ✓ {it.matchedProductName}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItemIdx(isLinkingThis ? null : idx);
                                    setProductSearchTerm('');
                                  }}
                                  className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-1"
                                >
                                  Change
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemIdx(isLinkingThis ? null : idx);
                                  setProductSearchTerm(it.productName.slice(0, 15));
                                }}
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-bold hover:bg-amber-200 cursor-pointer"
                              >
                                <Search className="w-2.5 h-2.5" />
                                Link to Catalog
                              </button>
                            )}
                          </div>

                          {/* Linker dropdown */}
                          {isLinkingThis && (
                            <div className="absolute left-0 top-full mt-1 w-80 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl p-2 z-30 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-bold">
                                <span>Search Pharmacy Product</span>
                                <button
                                  type="button"
                                  onClick={() => setEditingItemIdx(null)}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <input
                                type="text"
                                autoFocus
                                value={productSearchTerm}
                                onChange={(e) => setProductSearchTerm(e.target.value)}
                                placeholder="Type drug name or code..."
                                className="w-full px-2 py-1 text-xs border rounded dark:bg-slate-900 dark:border-slate-700"
                              />
                              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 text-[11px]">
                                {filteredProducts.map((p) => (
                                  <div
                                    key={p.id}
                                    onClick={() => handleLinkProduct(idx, p)}
                                    className="p-1.5 hover:bg-teal-50 dark:hover:bg-slate-700 cursor-pointer flex justify-between"
                                  >
                                    <span className="font-medium truncate">{p.name}</span>
                                    <span className="text-slate-400 shrink-0 ml-2">{p.dosage}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="p-1.5 text-center">
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => handleUpdateItemField(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-14 px-1 py-0.5 text-center border rounded dark:bg-slate-800 dark:border-slate-700 font-bold"
                          />
                        </td>

                        {/* Free / Bonus */}
                        <td className="p-1.5 text-center">
                          <input
                            type="number"
                            min="0"
                            value={it.freeQty || 0}
                            onChange={(e) => handleUpdateItemField(idx, 'freeQty', Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="w-12 px-1 py-0.5 text-center border rounded dark:bg-slate-800 dark:border-slate-700"
                          />
                        </td>

                        {/* Batch */}
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={it.batchNumber || ''}
                            onChange={(e) => handleUpdateItemField(idx, 'batchNumber', e.target.value)}
                            className="w-full px-1.5 py-0.5 font-mono text-[11px] border rounded dark:bg-slate-800 dark:border-slate-700"
                          />
                        </td>

                        {/* Expiry */}
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={it.displayExpiry || ''}
                            onChange={(e) => handleUpdateItemField(idx, 'displayExpiry', e.target.value)}
                            placeholder="MM/YYYY"
                            className={`w-full px-1.5 py-0.5 font-mono text-[11px] border rounded text-center font-bold ${
                              it.isExpired
                                ? 'bg-rose-100 border-rose-400 text-rose-700 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-300'
                                : 'dark:bg-slate-800 dark:border-slate-700'
                            }`}
                            title={it.isExpired ? 'Warning: Expired date!' : 'Expiry date (MM/YYYY)'}
                          />
                        </td>

                        {/* Unit Cost */}
                        <td className="p-1.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={it.unitCost || 0}
                            onChange={(e) => handleUpdateItemField(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                            className="w-16 px-1.5 py-0.5 text-right font-mono border rounded dark:bg-slate-800 dark:border-slate-700"
                          />
                        </td>

                        {/* Discount */}
                        <td className="p-1.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={it.discount || 0}
                            onChange={(e) => handleUpdateItemField(idx, 'discount', parseFloat(e.target.value) || 0)}
                            className="w-12 px-1 py-0.5 text-center border rounded dark:bg-slate-800 dark:border-slate-700 text-[11px]"
                          />
                        </td>

                        {/* Line Total */}
                        <td className="p-1.5 text-right font-mono font-bold text-[11px]">
                          {currency === 'USD' ? `$${lineTotal.toFixed(2)}` : `${formatLBPValue(Math.round(lineTotal))} L.L.`}
                        </td>

                        {/* Delete row */}
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Summary & Actions */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Total Lines: </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{items.length}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Calculated Total: </span>
                  <span className="font-bold text-teal-700 dark:text-teal-300 font-mono text-sm">
                    {currency === 'USD'
                      ? `$${(totalCostUSD * (1 - discountPercent / 100)).toFixed(2)}`
                      : `${formatLBPValue(Math.round(totalCostLBP * (1 - discountPercent / 100)))} L.L.`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply to Purchase Invoice Form</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DesktopWindow>
  );
};
