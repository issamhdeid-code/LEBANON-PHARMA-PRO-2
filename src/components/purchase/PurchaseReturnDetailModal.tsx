import React from 'react';
import {
  RotateCcw,
  RefreshCw,
  Banknote,
  Printer,
  Calendar,
  Package,
  Building2,
  FileText,
  Clock,
  CheckCircle,
  X,
} from 'lucide-react';
import { DesktopWindow } from '../common/DesktopWindow';
import { PurchaseReturn } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';
import { usePharmacy } from '../../context/PharmacyContext';

interface PurchaseReturnDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnTransaction: PurchaseReturn | null;
}

export const PurchaseReturnDetailModal: React.FC<PurchaseReturnDetailModalProps> = ({
  isOpen,
  onClose,
  returnTransaction,
}) => {
  const { exchangeRate, settings } = usePharmacy();

  if (!isOpen || !returnTransaction) return null;

  const isReplaceExpiry = returnTransaction.returnType === 'replace_expiry';

  const handlePrint = () => {
    window.print();
  };

  return (
    <DesktopWindow
      id={`return_detail_${returnTransaction.id}`}
      title={`Return Voucher #${returnTransaction.returnNumber}`}
      isOpen={isOpen}
      onClose={onClose}
      minWidth={680}
      minHeight={480}
      width="760px"
      height="540px"
      section="purchase"
    >
      <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs">
        {/* Header Info */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Return #{returnTransaction.returnNumber}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    isReplaceExpiry
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}
                >
                  {isReplaceExpiry ? (
                    <>
                      <RefreshCw className="h-3 w-3" />
                      <span>Expiry Replacement</span>
                    </>
                  ) : (
                    <>
                      <Banknote className="h-3 w-3" />
                      <span>Return for Cash / Credit</span>
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  <strong className="text-slate-700 dark:text-slate-300">{returnTransaction.supplierName}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>{returnTransaction.date}</span>
                </span>
                {returnTransaction.reason && (
                  <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px] font-medium">
                    Reason: {returnTransaction.reason}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Voucher</span>
            </button>
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-2.5 font-bold">Code</th>
                  <th className="p-2.5 font-bold">Product Name</th>
                  <th className="p-2.5 font-bold text-center">Returned Qty</th>
                  <th className="p-2.5 font-bold">Old Batch / Expiry</th>
                  {isReplaceExpiry ? (
                    <th className="p-2.5 font-bold text-amber-600 dark:text-amber-400">New Batch / Expiry</th>
                  ) : (
                    <th className="p-2.5 font-bold text-right text-emerald-600 dark:text-emerald-400">Refund Value</th>
                  )}
                  <th className="p-2.5 font-bold">Item Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {returnTransaction.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                    <td className="p-2.5 font-mono text-slate-600 dark:text-slate-300">{item.productCode || '—'}</td>
                    <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{item.productName || item.name}</td>
                    <td className="p-2.5 text-center font-bold text-amber-600 dark:text-amber-400">
                      {item.quantity} box{item.quantity !== 1 ? 'es' : ''}
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">
                      {item.oldBatchNumber && <span className="font-mono">{item.oldBatchNumber} </span>}
                      {item.oldExpiryDate && <span className="text-slate-400">({item.oldExpiryDate})</span>}
                      {!item.oldBatchNumber && !item.oldExpiryDate && <span className="text-slate-400 italic">Standard batch</span>}
                    </td>
                    {isReplaceExpiry ? (
                      <td className="p-2.5 text-amber-700 dark:text-amber-300 font-semibold">
                        {item.newBatchNumber && <span className="font-mono">{item.newBatchNumber} </span>}
                        {item.newExpiryDate && <span>(Exp: {item.newExpiryDate})</span>}
                        {item.replacementQuantity && item.replacementQuantity !== item.quantity && (
                          <span className="ml-1 text-slate-500">[{item.replacementQuantity} repl]</span>
                        )}
                        {!item.newBatchNumber && !item.newExpiryDate && <span>(Replaced with fresh stock)</span>}
                      </td>
                    ) : (
                      <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {(returnTransaction.currency || 'USD') === 'USD'
                          ? `$${(item.refundAmountUSD || item.totalUSD || 0).toFixed(2)}`
                          : `${formatLBPValue(item.refundAmountLBP || item.totalLBP || 0)} LBP`}
                      </td>
                    )}
                    <td className="p-2.5 text-slate-500">{item.reason || returnTransaction.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {returnTransaction.notes && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
              <div className="font-bold text-[11px] text-amber-800 dark:text-amber-300 mb-0.5">Notes:</div>
              <p className="text-xs text-amber-900 dark:text-amber-200">{returnTransaction.notes}</p>
            </div>
          )}
        </div>

        {/* Footer summary */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Total Items: <span className="font-bold text-slate-800 dark:text-slate-200">{returnTransaction.items.length}</span>
          </div>

          {!isReplaceExpiry && (
            <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              Total Refund:{' '}
              {(returnTransaction.currency || 'USD') === 'USD'
                ? `$${(returnTransaction.totalRefundUSD || 0).toFixed(2)}`
                : `${formatLBPValue(returnTransaction.totalRefundLBP || 0)} LBP`}
            </div>
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </DesktopWindow>
  );
};
