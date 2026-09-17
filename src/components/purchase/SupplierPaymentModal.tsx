import { formatNumber } from './PurchaseView';
import React, { useState, useMemo } from 'react';
import { X, Check, Search, Receipt } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';

import { SupplierPayment } from '../../types/pharmacy';

interface SupplierPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentToEdit?: SupplierPayment;
}

export const SupplierPaymentModal: React.FC<SupplierPaymentModalProps> = ({ isOpen, onClose, paymentToEdit }) => {
  const { suppliers, purchases, recordSupplierPayment, updateSupplierPayment, exchangeRate } = usePharmacy();

  const [selectedSupplierId, setSelectedSupplierId] = useState(paymentToEdit?.supplierId || '');
  const [currency, setCurrency] = useState<'USD' | 'LBP'>(paymentToEdit?.currency || 'LBP');
  const [receiptNumber, setReceiptNumber] = useState(paymentToEdit?.receiptNumber || '');
  const [paymentDate, setPaymentDate] = useState(paymentToEdit?.date || new Date().toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState<'full' | 'account'>(paymentToEdit ? (paymentToEdit.isPaymentOnAccount ? 'account' : 'full') : 'account');
  const [amountInput, setAmountInput] = useState(paymentToEdit?.amount.toString() || '');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>(paymentToEdit?.invoices || []);
  
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
    if (paymentType === 'full') {
      finalAmount = currency === 'USD' ? selectedInvoicesTotal.usd : selectedInvoicesTotal.lbp;
    } else {
      finalAmount = parseFloat(amountInput.replace(/,/g, ''));
      if (isNaN(finalAmount) || finalAmount <= 0) return;
    }

    const supplier = suppliers.find(s => s.id === selectedSupplierId);

    const payload = {
      receiptNumber: receiptNumber.trim() || `REC-${Date.now().toString().slice(-6)}`,
      date: paymentDate,
      supplierId: selectedSupplierId,
      supplierName: supplier?.name || 'Unknown',
      amount: finalAmount,
      currency,
      invoices: selectedInvoiceIds, // Send invoices regardless of payment type so it allocates
      isPaymentOnAccount: selectedInvoiceIds.length === 0, // It's only on-account if no invoices are selected
    };
    
    if (paymentToEdit) {
      updateSupplierPayment(paymentToEdit.id, payload);
    } else {
      recordSupplierPayment(payload);
    }
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-0">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{paymentToEdit ? 'Edit Supplier Payment' : 'Record Supplier Payment'}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <form id="payment-form" onSubmit={handleSave} className="space-y-5 text-sm">
            
            {/* Top Row: Supplier & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Supplier</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    setSelectedSupplierId(e.target.value);
                    setSelectedInvoiceIds([]);
                  }}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  required
                >
                  <option value="" disabled>Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {(s.balanceUSD || 0) !== 0 || (s.balanceLBP || 0) !== 0 ? `(Balance: ${(s.balanceUSD || 0) !== 0 ? '$' + formatNumber(s.balanceUSD) : ''}${(s.balanceUSD || 0) !== 0 && (s.balanceLBP || 0) !== 0 ? ' | ' : ''}${(s.balanceLBP || 0) !== 0 ? formatNumber(s.balanceLBP) + ' LBP' : ''})` : '(No Balance)'}
                    </option>
                  ))}
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
                  onChange={(e) => setCurrency(e.target.value as 'USD' | 'LBP')}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-800 dark:text-slate-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-bold"
                >
                  <option value="LBP">LBP (ل.ل)</option>
                  <option value="USD">USD ($)</option>
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
                      Selected Total: {currency === 'USD' ? `$${formatNumber(selectedInvoicesTotal.usd)}` : `${formatNumber(selectedInvoicesTotal.lbp)} LBP`}
                    </div>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto p-2 space-y-1 bg-white dark:bg-slate-900">
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
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{inv.invoiceNumber || 'No Ref'} - {inv.date}</span>
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

              {paymentType === 'full' ? (
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

          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
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
            disabled={!selectedSupplierId || (paymentType === 'full' && selectedInvoiceIds.length === 0) || (paymentType === 'account' && !amountInput)}
            className="px-5 py-2 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            <span>{paymentToEdit ? 'Update Payment' : 'Record Payment'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
