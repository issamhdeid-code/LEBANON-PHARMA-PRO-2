import { formatNumber } from './PurchaseView';
import { formatLBPValue } from '../../utils/priceUtils';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Check, Search, Receipt, ChevronDown, Wallet, ExternalLink, ArrowRightLeft, Info } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { DesktopWindow } from '../common/DesktopWindow';

import { SupplierPayment, PaymentFundingSource } from '../../types/pharmacy';

interface SupplierPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentToEdit?: SupplierPayment;
  initialSupplierId?: string;
}

export const SupplierPaymentModal: React.FC<SupplierPaymentModalProps> = ({ isOpen, onClose, paymentToEdit, initialSupplierId }) => {
  const { suppliers, purchases, recordSupplierPayment, updateSupplierPayment, exchangeRate } = usePharmacy();

  const [selectedSupplierId, setSelectedSupplierId] = useState(paymentToEdit?.supplierId || initialSupplierId || '');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [supplierHighlightedIndex, setSupplierHighlightedIndex] = useState(0);

  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const supplierInputRef = useRef<HTMLInputElement>(null);
  const supplierListContainerRef = useRef<HTMLDivElement>(null);
  const supplierItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [currency, setCurrency] = useState<'USD' | 'LBP' | 'MIXED'>(paymentToEdit?.currency || 'LBP');
  const [receiptNumber, setReceiptNumber] = useState(paymentToEdit?.receiptNumber || '');
  const [paymentDate, setPaymentDate] = useState(paymentToEdit?.date || new Date().toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState<'full' | 'account'>(paymentToEdit ? (paymentToEdit.isPaymentOnAccount ? 'account' : 'full') : 'account');
  const [amountInput, setAmountInput] = useState(paymentToEdit?.amount.toString() || '');
  const [amountUSDInput, setAmountUSDInput] = useState(paymentToEdit?.amountUSD != null ? paymentToEdit.amountUSD.toString() : '');
  const [amountLBPInput, setAmountLBPInput] = useState(paymentToEdit?.amountLBP != null ? formatLBPValue(paymentToEdit.amountLBP) : '');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>(paymentToEdit?.invoices || []);

  // Funding source state (Cash drawer vs Outside vs Mixed)
  const [fundingSource, setFundingSource] = useState<PaymentFundingSource>(paymentToEdit?.fundingSource || 'drawer');
  const [drawerUSDInput, setDrawerUSDInput] = useState<string>('');
  const [drawerLBPInput, setDrawerLBPInput] = useState<string>('');
  const [outsideUSDInput, setOutsideUSDInput] = useState<string>('');
  const [outsideLBPInput, setOutsideLBPInput] = useState<string>('');
  const [outsideSourceNote, setOutsideSourceNote] = useState<string>(paymentToEdit?.outsideSourceNote || '');

  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      const aHasBalance = (a.balanceUSD || 0) >= 0.01 || (a.balanceLBP || 0) >= 1;
      const bHasBalance = (b.balanceUSD || 0) >= 0.01 || (b.balanceLBP || 0) >= 1;

      if (aHasBalance && !bHasBalance) return -1;
      if (!aHasBalance && bHasBalance) return 1;

      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchQuery.trim()) return sortedSuppliers;
    const query = supplierSearchQuery.toLowerCase().trim();
    return sortedSuppliers.filter(s =>
      s.name.toLowerCase().includes(query) ||
      (s.code && s.code.toLowerCase().includes(query))
    );
  }, [sortedSuppliers, supplierSearchQuery]);

  useEffect(() => {
    if (paymentToEdit) {
      setSelectedSupplierId(paymentToEdit.supplierId);
      const s = suppliers.find(sup => sup.id === paymentToEdit.supplierId);
      setSupplierSearchQuery(s ? s.name : '');
      setCurrency(paymentToEdit.currency);
      setReceiptNumber(paymentToEdit.receiptNumber || '');
      setPaymentDate(paymentToEdit.date || new Date().toISOString().split('T')[0]);
      setPaymentType(paymentToEdit.isPaymentOnAccount ? 'account' : 'full');
      if (paymentToEdit.currency === 'MIXED') {
        setAmountUSDInput(paymentToEdit.amountUSD != null ? paymentToEdit.amountUSD.toString() : '');
        setAmountLBPInput(paymentToEdit.amountLBP != null ? formatLBPValue(paymentToEdit.amountLBP) : '');
      } else {
        setAmountInput(paymentToEdit.amount.toString());
        setAmountUSDInput('');
        setAmountLBPInput('');
      }
      setSelectedInvoiceIds(paymentToEdit.invoices || []);
      setFundingSource(paymentToEdit.fundingSource || 'drawer');
      setOutsideSourceNote(paymentToEdit.outsideSourceNote || '');
      if (paymentToEdit.fundingSource === 'mixed') {
        setDrawerUSDInput(paymentToEdit.drawerAmountUSD != null ? paymentToEdit.drawerAmountUSD.toString() : '');
        setDrawerLBPInput(paymentToEdit.drawerAmountLBP != null ? formatNumber(paymentToEdit.drawerAmountLBP) : '');
        setOutsideUSDInput(paymentToEdit.outsideAmountUSD != null ? paymentToEdit.outsideAmountUSD.toString() : '');
        setOutsideLBPInput(paymentToEdit.outsideAmountLBP != null ? formatNumber(paymentToEdit.outsideAmountLBP) : '');
      } else {
        setDrawerUSDInput('');
        setDrawerLBPInput('');
        setOutsideUSDInput('');
        setOutsideLBPInput('');
      }
    } else if (initialSupplierId) {
      setSelectedSupplierId(initialSupplierId);
      const s = suppliers.find(sup => sup.id === initialSupplierId);
      setSupplierSearchQuery(s ? s.name : '');
      setCurrency('LBP');
      setAmountInput('');
      setAmountUSDInput('');
      setAmountLBPInput('');
      setSelectedInvoiceIds([]);
      setFundingSource('drawer');
      setOutsideSourceNote('');
      setDrawerUSDInput('');
      setDrawerLBPInput('');
      setOutsideUSDInput('');
      setOutsideLBPInput('');
    } else {
      setSelectedSupplierId('');
      setSupplierSearchQuery('');
      setCurrency('LBP');
      setAmountInput('');
      setAmountUSDInput('');
      setAmountLBPInput('');
      setSelectedInvoiceIds([]);
      setFundingSource('drawer');
      setOutsideSourceNote('');
      setDrawerUSDInput('');
      setDrawerLBPInput('');
      setOutsideUSDInput('');
      setOutsideLBPInput('');
    }
  }, [paymentToEdit, initialSupplierId, isOpen, suppliers]);

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

  useEffect(() => {
    if (
      isSupplierDropdownOpen &&
      supplierItemRefs.current[supplierHighlightedIndex]
    ) {
      supplierItemRefs.current[supplierHighlightedIndex]?.scrollIntoView({
        block: 'nearest',
      });
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
      if (isSupplierDropdownOpen && filteredSuppliers[supplierHighlightedIndex]) {
        e.preventDefault();
        const s = filteredSuppliers[supplierHighlightedIndex];
        setSelectedSupplierId(s.id);
        setSelectedInvoiceIds([]);
        setSupplierSearchQuery(s.name);
        setIsSupplierDropdownOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsSupplierDropdownOpen(false);
    }
  };
  
  const supplierInvoices = useMemo(() => {
    if (!selectedSupplierId) return [];
    return purchases.filter(p => p.supplierId === selectedSupplierId && (!p.paid || (paymentToEdit && paymentToEdit.invoices.includes(p.id))));
  }, [purchases, selectedSupplierId]);

  const selectedInvoicesTotal = useMemo(() => {
    let usd = 0;
    let lbp = 0;
    selectedInvoiceIds.forEach(id => {
      const inv = supplierInvoices.find(i => i.id === id);
      if (inv) {
        const leftUSD = inv.paid ? 0 : (inv.totalCostUSD - (inv.paidAmountUSD || 0) - ((inv.paidAmountLBP || 0) / (inv.exchangeRate || 1)));
        const leftLBP = inv.paid ? 0 : (inv.totalCostLBP - (inv.paidAmountLBP || 0) - ((inv.paidAmountUSD || 0) * (inv.exchangeRate || 1)));
        
        if (inv.currency === 'USD') {
          usd += Math.max(0, leftUSD);
          lbp += Math.max(0, leftUSD * (inv.exchangeRate || exchangeRate));
        } else {
          lbp += Math.max(0, leftLBP);
          usd += Math.max(0, leftLBP / (inv.exchangeRate || exchangeRate));
        }
      }
    });
    return { usd, lbp };
  }, [selectedInvoiceIds, supplierInvoices, exchangeRate]);

  const currentSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  const targetAmount = useMemo(() => {
    if (paymentType === 'full' || selectedInvoiceIds.length > 0) {
      return {
        usd: selectedInvoicesTotal.usd,
        lbp: selectedInvoicesTotal.lbp,
      };
    }
    const supBalUSD = currentSupplier?.balanceUSD || 0;
    const supBalLBP = currentSupplier?.balanceLBP || 0;
    const totalUSD = Math.max(0, supBalUSD + (supBalLBP / (exchangeRate || 1)));
    const totalLBP = Math.max(0, supBalLBP + (supBalUSD * (exchangeRate || 1)));
    return {
      usd: totalUSD,
      lbp: totalLBP,
    };
  }, [paymentType, selectedInvoiceIds, selectedInvoicesTotal, currentSupplier, exchangeRate]);

  const currentEnteredUSD = parseFloat(amountUSDInput.replace(/,/g, '')) || 0;
  const currentEnteredLBP = parseFloat(amountLBPInput.replace(/,/g, '')) || 0;
  const totalEnteredInUSD = currentEnteredUSD + (currentEnteredLBP / (exchangeRate || 1));
  const totalEnteredInLBP = currentEnteredLBP + (currentEnteredUSD * (exchangeRate || 1));
  const remainingToSettleUSD = Math.max(0, Number((targetAmount.usd - totalEnteredInUSD).toFixed(2)));
  const remainingToSettleLBP = Math.max(0, Math.round(targetAmount.lbp - totalEnteredInLBP));

  const handleUSDChange = (rawVal: string) => {
    const clean = rawVal.replace(/[^0-9.]/g, '');
    setAmountUSDInput(clean);

    // Only automatically calculate companion currency if paying invoices in full
    if (paymentType === 'full' && targetAmount.usd > 0) {
      if (clean.trim() === '') {
        setAmountLBPInput(formatLBPValue(Math.round(targetAmount.lbp)));
      } else {
        const numUSD = parseFloat(clean);
        if (!isNaN(numUSD)) {
          const remUSD = Math.max(0, targetAmount.usd - numUSD);
          const remLBP = Math.round(remUSD * (exchangeRate || 1));
          setAmountLBPInput(formatLBPValue(remLBP));
        }
      }
    }
  };

  const handleLBPChange = (rawVal: string) => {
    const clean = rawVal.replace(/[^0-9]/g, '');
    const formatted = clean ? formatNumber(clean) : '';
    setAmountLBPInput(formatted);

    // Only automatically calculate companion currency if paying invoices in full
    if (paymentType === 'full' && targetAmount.lbp > 0) {
      if (clean.trim() === '') {
        setAmountUSDInput(targetAmount.usd.toFixed(2));
      } else {
        const numLBP = parseFloat(clean);
        if (!isNaN(numLBP)) {
          const remLBP = Math.max(0, targetAmount.lbp - numLBP);
          const remUSD = Number((remLBP / (exchangeRate || 1)).toFixed(2));
          setAmountUSDInput(remUSD.toFixed(2));
        }
      }
    }
  };

  const computedPaymentTotals = useMemo(() => {
    let finalUSD = 0;
    let finalLBP = 0;
    let finalAmount = 0;

    if (currency === 'MIXED') {
      finalUSD = currentEnteredUSD;
      finalLBP = currentEnteredLBP;
      finalAmount = Number((finalUSD + (finalLBP / (exchangeRate || 1))).toFixed(2));
    } else if (paymentType === 'full') {
      finalAmount = currency === 'USD' ? selectedInvoicesTotal.usd : selectedInvoicesTotal.lbp;
      if (currency === 'USD') finalUSD = finalAmount;
      else finalLBP = finalAmount;
    } else {
      const parsed = parseFloat(amountInput.replace(/,/g, '')) || 0;
      finalAmount = parsed;
      if (currency === 'USD') finalUSD = parsed;
      else finalLBP = parsed;
    }
    return { finalUSD, finalLBP, finalAmount };
  }, [currency, paymentType, currentEnteredUSD, currentEnteredLBP, selectedInvoicesTotal, amountInput, exchangeRate]);

  const handleDrawerUSDSplitChange = (raw: string) => {
    const clean = raw.replace(/[^0-9.]/g, '');
    setDrawerUSDInput(clean);
    const parsed = parseFloat(clean);
    if (!isNaN(parsed) && computedPaymentTotals.finalUSD > 0) {
      const rem = Math.max(0, Number((computedPaymentTotals.finalUSD - parsed).toFixed(2)));
      setOutsideUSDInput(rem > 0 ? rem.toFixed(2) : '0');
    }
  };

  const handleOutsideUSDSplitChange = (raw: string) => {
    const clean = raw.replace(/[^0-9.]/g, '');
    setOutsideUSDInput(clean);
    const parsed = parseFloat(clean);
    if (!isNaN(parsed) && computedPaymentTotals.finalUSD > 0) {
      const rem = Math.max(0, Number((computedPaymentTotals.finalUSD - parsed).toFixed(2)));
      setDrawerUSDInput(rem > 0 ? rem.toFixed(2) : '0');
    }
  };

  const handleDrawerLBPSplitChange = (raw: string) => {
    const clean = raw.replace(/[^0-9]/g, '');
    setDrawerLBPInput(clean ? formatNumber(clean) : '');
    const parsed = parseFloat(clean);
    if (!isNaN(parsed) && computedPaymentTotals.finalLBP > 0) {
      const rem = Math.max(0, Math.round(computedPaymentTotals.finalLBP - parsed));
      setOutsideLBPInput(rem ? formatNumber(rem) : '0');
    }
  };

  const handleOutsideLBPSplitChange = (raw: string) => {
    const clean = raw.replace(/[^0-9]/g, '');
    setOutsideLBPInput(clean ? formatNumber(clean) : '');
    const parsed = parseFloat(clean);
    if (!isNaN(parsed) && computedPaymentTotals.finalLBP > 0) {
      const rem = Math.max(0, Math.round(computedPaymentTotals.finalLBP - parsed));
      setDrawerLBPInput(rem ? formatNumber(rem) : '0');
    }
  };

  const handleSetSplitPreset = (preset: '50_50' | 'all_drawer' | 'all_outside') => {
    if (preset === '50_50') {
      if (computedPaymentTotals.finalUSD > 0) {
        const half = Number((computedPaymentTotals.finalUSD / 2).toFixed(2));
        setDrawerUSDInput(half.toFixed(2));
        setOutsideUSDInput(Number((computedPaymentTotals.finalUSD - half).toFixed(2)).toFixed(2));
      }
      if (computedPaymentTotals.finalLBP > 0) {
        const halfLbp = Math.round(computedPaymentTotals.finalLBP / 2);
        setDrawerLBPInput(formatNumber(halfLbp));
        setOutsideLBPInput(formatNumber(computedPaymentTotals.finalLBP - halfLbp));
      }
    } else if (preset === 'all_drawer') {
      if (computedPaymentTotals.finalUSD > 0) {
        setDrawerUSDInput(computedPaymentTotals.finalUSD.toFixed(2));
        setOutsideUSDInput('0');
      }
      if (computedPaymentTotals.finalLBP > 0) {
        setDrawerLBPInput(formatNumber(computedPaymentTotals.finalLBP));
        setOutsideLBPInput('0');
      }
    } else if (preset === 'all_outside') {
      if (computedPaymentTotals.finalUSD > 0) {
        setDrawerUSDInput('0');
        setOutsideUSDInput(computedPaymentTotals.finalUSD.toFixed(2));
      }
      if (computedPaymentTotals.finalLBP > 0) {
        setDrawerLBPInput('0');
        setOutsideLBPInput(formatNumber(computedPaymentTotals.finalLBP));
      }
    }
  };

  if (!isOpen) return null;

  const handleToggleInvoice = (id: string) => {
    setSelectedInvoiceIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) return;

    let finalAmount = 0;
    let finalUSD = 0;
    let finalLBP = 0;

    if (currency === 'MIXED') {
      finalUSD = currentEnteredUSD;
      finalLBP = currentEnteredLBP;
      if (finalUSD <= 0 && finalLBP <= 0) return;
      finalAmount = Number((finalUSD + (finalLBP / (exchangeRate || 1))).toFixed(2));
    } else if (paymentType === 'full') {
      finalAmount = currency === 'USD' ? selectedInvoicesTotal.usd : selectedInvoicesTotal.lbp;
      if (currency === 'USD') finalUSD = finalAmount;
      else finalLBP = finalAmount;
    } else {
      finalAmount = parseFloat(amountInput.replace(/,/g, ''));
      if (isNaN(finalAmount) || finalAmount <= 0) return;
      if (currency === 'USD') finalUSD = finalAmount;
      else finalLBP = finalAmount;
    }

    let computedDrawerUSD = 0;
    let computedDrawerLBP = 0;
    let computedOutsideUSD = 0;
    let computedOutsideLBP = 0;

    if (fundingSource === 'drawer') {
      computedDrawerUSD = finalUSD;
      computedDrawerLBP = finalLBP;
      computedOutsideUSD = 0;
      computedOutsideLBP = 0;
    } else if (fundingSource === 'outside') {
      computedDrawerUSD = 0;
      computedDrawerLBP = 0;
      computedOutsideUSD = finalUSD;
      computedOutsideLBP = finalLBP;
    } else {
      // mixed
      computedDrawerUSD = parseFloat(drawerUSDInput.replace(/,/g, '')) || 0;
      computedDrawerLBP = parseFloat(drawerLBPInput.replace(/,/g, '')) || 0;
      computedOutsideUSD = parseFloat(outsideUSDInput.replace(/,/g, '')) || 0;
      computedOutsideLBP = parseFloat(outsideLBPInput.replace(/,/g, '')) || 0;
    }

    const supplier = suppliers.find(s => s.id === selectedSupplierId);

    const payload = {
      receiptNumber: receiptNumber.trim() || `REC-${Date.now().toString().slice(-6)}`,
      date: paymentDate,
      supplierId: selectedSupplierId,
      supplierName: supplier?.name || 'Unknown',
      amount: finalAmount,
      currency,
      amountUSD: finalUSD,
      amountLBP: finalLBP,
      invoices: selectedInvoiceIds, // Send invoices regardless of payment type so it allocates
      isPaymentOnAccount: selectedInvoiceIds.length === 0, // It's only on-account if no invoices are selected
      fundingSource,
      drawerAmountUSD: computedDrawerUSD,
      drawerAmountLBP: computedDrawerLBP,
      outsideAmountUSD: computedOutsideUSD,
      outsideAmountLBP: computedOutsideLBP,
      outsideSourceNote: outsideSourceNote.trim() || undefined,
    };
    
    if (paymentToEdit) {
      updateSupplierPayment(paymentToEdit.id, payload);
    } else {
      recordSupplierPayment(payload);
    }
    
    onClose();
  };

  return (
    <DesktopWindow
      id="supplier_payment_window"
      title={paymentToEdit ? 'Edit Supplier Payment' : 'Record Supplier Payment'}
      isOpen={isOpen}
      onClose={onClose}
      section="purchase"
      width="700px"
      height="auto"
      minWidth={360}
      minHeight={180}
      maxHeight={2000}
    >
      <div className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <form id="payment-form" onSubmit={handleSave} className="space-y-5 text-sm">
            
            {/* Top Row: Supplier & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div ref={supplierDropdownRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Supplier</label>
                <div className="relative">
                  <input
                    ref={supplierInputRef}
                    type="text"
                    value={supplierSearchQuery}
                    onChange={(e) => {
                      setSupplierSearchQuery(e.target.value);
                      setIsSupplierDropdownOpen(true);
                      setSupplierHighlightedIndex(0);
                    }}
                    onFocus={() => setIsSupplierDropdownOpen(true)}
                    onClick={() => setIsSupplierDropdownOpen(true)}
                    onKeyDown={handleSupplierKeyDown}
                    placeholder="Search or select supplier..."
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 pr-8 text-slate-800 dark:text-slate-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 placeholder-slate-400 font-medium"
                    required={!selectedSupplierId}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setIsSupplierDropdownOpen(prev => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                {isSupplierDropdownOpen && (
                  <div
                    ref={supplierListContainerRef}
                    className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-56 overflow-y-auto"
                  >
                    {filteredSuppliers.length === 0 ? (
                      <div className="px-3 py-4 text-center text-slate-400 text-xs">
                        No suppliers match "{supplierSearchQuery}"
                      </div>
                    ) : (
                      filteredSuppliers.map((s, index) => {
                        const hasBalance = Math.abs(s.balanceUSD || 0) > 0.001 || Math.abs(s.balanceLBP || 0) > 0.001;
                        const isSelected = selectedSupplierId === s.id;
                        const isHighlighted = supplierHighlightedIndex === index;

                        return (
                          <div
                            key={s.id}
                            ref={(el) => { supplierItemRefs.current[index] = el; }}
                            className={`px-3 py-2 cursor-pointer text-xs flex items-center justify-between transition-colors ${
                              isHighlighted
                                ? 'bg-teal-50 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 font-semibold'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-800 dark:text-slate-200'
                            } ${isSelected && !isHighlighted ? 'font-semibold bg-teal-50/50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300' : ''}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSelectedSupplierId(s.id);
                              setSelectedInvoiceIds([]);
                              setSupplierSearchQuery(s.name);
                              setIsSupplierDropdownOpen(false);
                            }}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {s.name}
                              </span>
                              {s.code && !s.code.toUpperCase().startsWith('MOPH-') && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {s.code}
                                </span>
                              )}
                            </div>
                            <div>
                              {hasBalance ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                  Balance: {(s.balanceUSD || 0) >= 0.01 ? '$' + formatNumber(s.balanceUSD) : ''}
                                  {(s.balanceUSD || 0) >= 0.01 && (s.balanceLBP || 0) >= 1 ? ' | ' : ''}
                                  {(s.balanceLBP || 0) >= 1 ? formatNumber(s.balanceLBP) + ' LBP' : ''}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                  No Balance
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    setSelectedSupplierId(e.target.value);
                    setSelectedInvoiceIds([]);
                    const found = suppliers.find(s => s.id === e.target.value);
                    if (found) setSupplierSearchQuery(found.name);
                  }}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  required
                >
                  <option value="" disabled>Select Supplier</option>
                  {sortedSuppliers.map(s => {
                    const hasUsd = (s.balanceUSD || 0) >= 0.01;
                    const hasLbp = (s.balanceLBP || 0) >= 1;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} {hasUsd || hasLbp ? `(Balance: ${hasUsd ? '$' + formatNumber(s.balanceUSD) : ''}${hasUsd && hasLbp ? ' | ' : ''}${hasLbp ? formatNumber(s.balanceLBP) + ' LBP' : ''})` : '(No Balance)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>
            </div>

            {/* Middle Row: Receipt & Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Receipt Number</label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="e.g. RCPT-12345"
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Payment Currency</label>
                <select
                  value={currency}
                  onChange={(e) => {
                    const newCurr = e.target.value as 'USD' | 'LBP' | 'MIXED';
                    setCurrency(newCurr);
                    if (newCurr === 'MIXED') {
                      if (currentEnteredUSD <= 0 && currentEnteredLBP <= 0 && targetAmount.usd > 0) {
                        setAmountUSDInput(targetAmount.usd.toFixed(2));
                        setAmountLBPInput('0');
                      }
                    }
                  }}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-bold"
                >
                  <option value="LBP">LBP (ل.ل)</option>
                  <option value="USD">USD ($)</option>
                  <option value="MIXED">Mixed</option>
                </select>
              </div>
            </div>

            {/* Invoices Selection */}
            {selectedSupplierId && (
              <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Unpaid Invoices</h3>
                  {selectedInvoiceIds.length > 0 && (
                    <div className="text-xs font-bold text-teal-700 dark:text-teal-400">
                      Selected Total: {currency === 'MIXED'
                        ? `$${formatNumber(selectedInvoicesTotal.usd)} / ${formatLBPValue(selectedInvoicesTotal.lbp)} LBP`
                        : currency === 'USD'
                          ? `$${formatNumber(selectedInvoicesTotal.usd)}`
                          : `${formatNumber(selectedInvoicesTotal.lbp)} LBP`}
                    </div>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto p-2 space-y-1 bg-white dark:bg-slate-900">
                  {supplierInvoices.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">No unpaid invoices found for this supplier.</div>
                  ) : (
                    supplierInvoices.map(inv => (
                      <label key={inv.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedInvoiceIds.includes(inv.id)}
                          onChange={() => handleToggleInvoice(inv.id)}
                          className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                        />
                        <div className="flex-1 flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            {inv.invoiceNumber || 'No Ref'} - {inv.date}
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {inv.currency === 'LBP' ? 'LBP' : 'USD ($)'}
                            </span>
                          </span>
                          <span className="font-bold text-teal-700 dark:text-teal-400">
                            {(() => {
                              const leftUSD = inv.paid ? 0 : (inv.totalCostUSD - (inv.paidAmountUSD || 0) - ((inv.paidAmountLBP || 0) / (inv.exchangeRate || 1)));
                              const leftLBP = inv.paid ? 0 : (inv.totalCostLBP - (inv.paidAmountLBP || 0) - ((inv.paidAmountUSD || 0) * (inv.exchangeRate || 1)));
                              return inv.currency === 'USD' ? `$${formatNumber(Math.max(0, leftUSD))}` : `${formatNumber(Math.max(0, leftLBP))} LBP`;
                            })()}
                          </span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Payment Amount & Type */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentType"
                    checked={paymentType === 'full'}
                    onChange={() => setPaymentType('full')}
                    className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                    disabled={selectedInvoiceIds.length === 0}
                  />
                  <span className={`text-sm font-semibold ${selectedInvoiceIds.length === 0 ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>Pay Selected Invoices in Full</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentType"
                    checked={paymentType === 'account'}
                    onChange={() => setPaymentType('account')}
                    className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Payment on Account (Custom Amount)</span>
                </label>
              </div>

              {currency === 'MIXED' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Amount in USD ($)
                      </label>
                      <input
                        type="text"
                        value={amountUSDInput}
                        onChange={(e) => handleUSDChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Amount in LBP (ل.ل)
                      </label>
                      <input
                        type="text"
                        value={amountLBPInput}
                        onChange={(e) => handleLBPChange(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 font-bold"
                      />
                    </div>
                  </div>

                  {/* Summary & Automatic calculation indicator */}
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        {paymentType === 'full' || selectedInvoiceIds.length > 0 ? 'Target Invoices Total:' : 'Target Balance:'}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        ${formatNumber(targetAmount.usd)} <span className="text-slate-400">/</span> {formatLBPValue(targetAmount.lbp)} LBP
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Total Tendered:</span>
                      <span className="font-bold text-teal-700 dark:text-teal-400">
                        ${formatNumber(currentEnteredUSD)} + {formatLBPValue(currentEnteredLBP)} LBP
                        <span className="text-slate-400 font-normal"> (≈ ${formatNumber(totalEnteredInUSD)})</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      {paymentType === 'full' ? (
                        <>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">Remaining Amount:</span>
                          {remainingToSettleUSD <= 0.01 && targetAmount.usd > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              ✓ Target Fully Covered
                            </span>
                          ) : totalEnteredInUSD > targetAmount.usd + 0.01 && targetAmount.usd > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              Over target (+${formatNumber(totalEnteredInUSD - targetAmount.usd)})
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                ${formatNumber(remainingToSettleUSD)} ({formatLBPValue(remainingToSettleLBP)} LBP)
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newUSD = Number((currentEnteredUSD + remainingToSettleUSD).toFixed(2));
                                  setAmountUSDInput(newUSD.toString());
                                }}
                                className="px-1.5 py-0.5 text-[10px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 dark:text-teal-300 rounded border border-teal-200 dark:border-teal-800 cursor-pointer"
                              >
                                +Fill USD
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newLBP = Math.round(currentEnteredLBP + remainingToSettleLBP);
                                  setAmountLBPInput(formatNumber(newLBP));
                                }}
                                className="px-1.5 py-0.5 text-[10px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 dark:text-teal-300 rounded border border-teal-200 dark:border-teal-800 cursor-pointer"
                              >
                                +Fill LBP
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">Balance After Payment:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            ${formatNumber(Math.max(0, Number((targetAmount.usd - totalEnteredInUSD).toFixed(2))))}
                            <span className="text-slate-400 font-normal"> ({formatLBPValue(Math.max(0, Math.round(targetAmount.lbp - totalEnteredInLBP)))} LBP)</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : paymentType === 'full' ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-slate-500">Total to pay:</span>
                  <span className="text-xl font-extrabold text-teal-700 dark:text-teal-400">
                    {currency === 'USD' ? `$${formatNumber(selectedInvoicesTotal.usd)}` : `${formatNumber(selectedInvoicesTotal.lbp)} LBP`}
                  </span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Amount Paid ({currency})</label>
                  <input
                    type="text"
                    value={amountInput}
                    onChange={(e) => setAmountInput(formatNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full sm:w-1/2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 font-bold"
                    required
                  />
                </div>
              )}
            </div>

            {/* Money Source (Cash Drawer vs Outside vs Mixed) */}
            <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    Payment Money Source
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select where the payment funds originate to keep your cash drawer ledger accurate.
                  </p>
                </div>
              </div>

              {/* Source Option Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Cash Drawer */}
                <button
                  type="button"
                  onClick={() => setFundingSource('drawer')}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    fundingSource === 'drawer'
                      ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-100 ring-2 ring-teal-500/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Wallet className={`w-3.5 h-3.5 ${fundingSource === 'drawer' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                      <span>Cash Drawer</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      fundingSource === 'drawer'
                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      Ledger
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    100% taken from physical drawer. Deducts from drawer balance.
                  </p>
                </button>

                {/* 2. Outside Drawer */}
                <button
                  type="button"
                  onClick={() => setFundingSource('outside')}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    fundingSource === 'outside'
                      ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-100 ring-2 ring-purple-500/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <ExternalLink className={`w-3.5 h-3.5 ${fundingSource === 'outside' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
                      <span>Outside Drawer</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      fundingSource === 'outside'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      0 Impact
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Paid from personal pocket, bank, or safe. Zero drawer deduction.
                  </p>
                </button>

                {/* 3. Mixed Sources */}
                <button
                  type="button"
                  onClick={() => {
                    setFundingSource('mixed');
                    if (!drawerUSDInput && !outsideUSDInput && computedPaymentTotals.finalUSD > 0) {
                      const half = Number((computedPaymentTotals.finalUSD / 2).toFixed(2));
                      setDrawerUSDInput(half.toFixed(2));
                      setOutsideUSDInput(Number((computedPaymentTotals.finalUSD - half).toFixed(2)).toFixed(2));
                    }
                    if (!drawerLBPInput && !outsideLBPInput && computedPaymentTotals.finalLBP > 0) {
                      const halfLbp = Math.round(computedPaymentTotals.finalLBP / 2);
                      setDrawerLBPInput(formatNumber(halfLbp));
                      setOutsideLBPInput(formatNumber(computedPaymentTotals.finalLBP - halfLbp));
                    }
                  }}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    fundingSource === 'mixed'
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 ring-2 ring-amber-500/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <ArrowRightLeft className={`w-3.5 h-3.5 ${fundingSource === 'mixed' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
                      <span>Mixed Sources</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      fundingSource === 'mixed'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      Split
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Custom split between cash drawer and external funds.
                  </p>
                </button>
              </div>

              {/* Outside Details (When Outside) */}
              {fundingSource === 'outside' && (
                <div className="bg-purple-50/60 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-200/80 dark:border-purple-800/40 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900 dark:text-purple-200">
                    <Info className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Outside Funding Details (Optional)</span>
                  </div>
                  <input
                    type="text"
                    value={outsideSourceNote}
                    onChange={(e) => setOutsideSourceNote(e.target.value)}
                    placeholder="e.g. Owner personal wallet, Bank transfer, External safe, Cheque"
                    className="w-full text-xs rounded-md border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-purple-700 dark:text-purple-300">
                    The supplier balance will be credited, but zero amount will be subtracted from the cash drawer register.
                  </p>
                </div>
              )}

              {/* Mixed Split Breakdown (When Mixed) */}
              {fundingSource === 'mixed' && (
                <div className="bg-amber-50/60 dark:bg-amber-950/20 p-3.5 rounded-lg border border-amber-200/80 dark:border-amber-800/40 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Allocate Split Amounts</span>
                    </div>
                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => handleSetSplitPreset('50_50')}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        50% / 50%
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetSplitPreset('all_drawer')}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        All Drawer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetSplitPreset('all_outside')}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        All Outside
                      </button>
                    </div>
                  </div>

                  {/* USD split inputs if payment includes USD */}
                  {(currency === 'USD' || (currency === 'MIXED' && computedPaymentTotals.finalUSD > 0)) && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        <span>USD Portion to allocate:</span>
                        <span className="font-mono font-bold text-teal-700 dark:text-teal-400">${computedPaymentTotals.finalUSD.toFixed(2)}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            From Cash Drawer ($)
                          </label>
                          <input
                            type="text"
                            value={drawerUSDInput}
                            onChange={(e) => handleDrawerUSDSplitChange(e.target.value)}
                            placeholder="0.00"
                            className="w-full text-xs font-mono font-bold rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            From Outside Drawer ($)
                          </label>
                          <input
                            type="text"
                            value={outsideUSDInput}
                            onChange={(e) => handleOutsideUSDSplitChange(e.target.value)}
                            placeholder="0.00"
                            className="w-full text-xs font-mono font-bold rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LBP split inputs if payment includes LBP */}
                  {(currency === 'LBP' || (currency === 'MIXED' && computedPaymentTotals.finalLBP > 0)) && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        <span>LBP Portion to allocate:</span>
                        <span className="font-mono font-bold text-teal-700 dark:text-teal-400">{formatLBPValue(computedPaymentTotals.finalLBP)} LBP</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            From Cash Drawer (LBP)
                          </label>
                          <input
                            type="text"
                            value={drawerLBPInput}
                            onChange={(e) => handleDrawerLBPSplitChange(e.target.value)}
                            placeholder="0"
                            className="w-full text-xs font-mono font-bold rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            From Outside Drawer (LBP)
                          </label>
                          <input
                            type="text"
                            value={outsideLBPInput}
                            onChange={(e) => handleOutsideLBPSplitChange(e.target.value)}
                            placeholder="0"
                            className="w-full text-xs font-mono font-bold rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Optional Outside Note */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Outside Funding Note / Source (Optional)
                    </label>
                    <input
                      type="text"
                      value={outsideSourceNote}
                      onChange={(e) => setOutsideSourceNote(e.target.value)}
                      placeholder="e.g. Paid part from owner personal funds, bank transfer"
                      className="w-full text-xs rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Split Summary / Verification */}
                  <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded border border-amber-200 dark:border-amber-800/40 text-[11px] flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-600 dark:text-slate-400">Cash Drawer Deduction: </span>
                      <span className="font-bold text-teal-700 dark:text-teal-400">
                        ${(parseFloat(drawerUSDInput.replace(/,/g, '')) || 0).toFixed(2)}
                        {currency !== 'USD' && ` + ${formatLBPValue(parseFloat(drawerLBPInput.replace(/,/g, '')) || 0)} LBP`}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600 dark:text-slate-400">External / Outside: </span>
                      <span className="font-bold text-purple-700 dark:text-purple-400">
                        ${(parseFloat(outsideUSDInput.replace(/,/g, '')) || 0).toFixed(2)}
                        {currency !== 'USD' && ` + ${formatLBPValue(parseFloat(outsideLBPInput.replace(/,/g, '')) || 0)} LBP`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-5 pr-8 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="payment-form"
            disabled={
              !selectedSupplierId ||
              (currency === 'MIXED'
                ? currentEnteredUSD <= 0 && currentEnteredLBP <= 0
                : (paymentType === 'full' && selectedInvoiceIds.length === 0) || (paymentType === 'account' && !amountInput)
              )
            }
            className="px-5 py-2 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{paymentToEdit ? 'Update Payment' : 'Record Payment'}</span>
          </button>
        </div>
      </div>
    </DesktopWindow>
  );
};
