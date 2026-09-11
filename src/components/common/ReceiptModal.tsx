import React from 'react';
import { Printer, X, CheckCircle, ShieldCheck } from 'lucide-react';
import { SaleTransaction, PharmacySettings } from '../../types/pharmacy';
import { DesktopWindow } from './DesktopWindow';
import { formatLBPValue } from '../../utils/priceUtils';

interface ReceiptModalProps {
  sale: SaleTransaction | null;
  settings: PharmacySettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, settings, onClose }) => {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <DesktopWindow title="Sale Completed & Receipt" isOpen={true} onClose={onClose} width="450px" height="85vh">
      <div className="flex flex-col h-full">
        {/* Printable Receipt Area */}
        <div id="printable-receipt" className="p-6 font-mono text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 flex-1 overflow-y-auto">
          {/* Pharmacy Info Header */}
          <div className="text-center pb-4 border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="font-bold text-base uppercase font-sans tracking-wide">
              {settings.pharmacyName}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {settings.pharmacyAddress}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Tel: {settings.pharmacyPhone}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Ministry of Public Health License: {settings.licenseNumber}
            </div>
          </div>

          {/* Invoice Meta */}
          <div className="py-3 border-b border-dashed border-slate-300 dark:border-slate-700 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice:</span>
              <span className="font-bold">{sale.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date:</span>
              <span>{new Date(sale.date).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cashier:</span>
              <span>{sale.cashierName}</span>
            </div>
            {sale.customerName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold">{sale.customerName}</span>
              </div>
            )}
            <div className="flex justify-between text-amber-700 dark:text-amber-400">
              <span>Applied Rate:</span>
              <span className="font-bold">1$ = {formatLBPValue(sale.exchangeRate)} L.L.</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-3 border-b border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex justify-between font-bold pb-1 text-[11px] border-b border-slate-200 dark:border-slate-800">
              <span className="w-1/2">Item</span>
              <span className="w-1/6 text-center">Qty</span>
              <span className="w-1/3 text-right">Total ($ / L.L.)</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 pt-1 space-y-1">
              {sale.items.map((item, idx) => (
                <div key={idx} className="pt-1">
                  <div className="flex justify-between font-semibold">
                    <span className="w-1/2 truncate font-sans">{item.productName}</span>
                    <span className="w-1/6 text-center">{item.quantity}</span>
                    <span className="w-1/3 text-right">${item.totalUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span>Code: {item.productCode}</span>
                    <span>{formatLBPValue(item.totalLBP)} L.L.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals in Both Currencies */}
          <div className="py-3 border-b border-dashed border-slate-300 dark:border-slate-700 space-y-1.5 font-sans">
            <div className="flex justify-between items-center text-sm font-bold">
              <span>Total USD:</span>
              <span className="text-base text-emerald-600 dark:text-emerald-400">
                ${sale.totalUSD.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold">
              <span>Total Lebanese Pounds:</span>
              <span className="text-base text-slate-900 dark:text-slate-100">
                {formatLBPValue(sale.totalLBP)} L.L.
              </span>
            </div>

            <div className="pt-2 text-[11px] space-y-0.5 text-slate-600 dark:text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <span className="capitalize">{sale.paymentMethod.replace('_', ' ')}</span>
              </div>
              {sale.amountPaidUSD > 0 && (
                <div className="flex justify-between">
                  <span>Cash USD Received:</span>
                  <span>${sale.amountPaidUSD.toFixed(2)}</span>
                </div>
              )}
              {sale.amountPaidLBP > 0 && (
                <div className="flex justify-between">
                  <span>Cash L.L. Received:</span>
                  <span>{formatLBPValue(sale.amountPaidLBP)} L.L.</span>
                </div>
              )}
              {sale.changeGivenLBP > 0 && (
                <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                  <span>Change Given (L.L.):</span>
                  <span>{formatLBPValue(sale.changeGivenLBP)} L.L.</span>
                </div>
              )}
              {sale.changeGivenUSD > 0 && (
                <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                  <span>Change Given (USD):</span>
                  <span>${sale.changeGivenUSD.toFixed(2)}</span>
                </div>
              )}
              {sale.writeOffUSD && sale.writeOffUSD > 0.001 ? (
                <div className="flex justify-between font-bold text-rose-600 dark:text-rose-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Difference Written Off:</span>
                  <span>-${sale.writeOffUSD.toFixed(2)} ({formatLBPValue(sale.writeOffLBP || 0)} L.L.)</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center pt-4 text-[10px] text-slate-400 dark:text-slate-500 space-y-1 font-sans">
            <p>Thank you for trusting {settings.pharmacyName}!</p>
            <p className="text-[9px]">Medications cannot be exchanged or returned per MOPH regulations.</p>
            <p className="text-[9px]">Health & Recovery / بالشفاء العاجل</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end space-x-2 border-t border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-900 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            <Printer className="h-4 w-4" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            New Sale
          </button>
        </div>
      </div>
    </DesktopWindow>
  );
};
