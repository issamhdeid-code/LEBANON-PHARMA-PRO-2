import React from 'react';
import {
  Calendar,
  User,
  Boxes,
  Clock,
  CheckCircle2,
  Building2,
  Package,
  ArrowRightLeft,
  DollarSign,
  FileText,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { DesktopWindow } from '../common/DesktopWindow';
import { Product, PurchaseInvoice, SaleTransaction, AppLogEntry, PurchaseReturn, PurchaseReturnItem } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';
import { formatStockDisplay, parseExpiryDate } from '../../utils/stockUtils';
import { usePharmacy } from '../../context/PharmacyContext';

export interface ProductOperationItem {
  id: string; // ID assigned by the system
  referenceId: string;
  invoiceNumber?: string;
  operationType: 'Purchase' | 'Sale' | 'Qty Adj' | 'Purchase Return';
  type: 'purchase' | 'sale' | 'adjustment' | 'purchase_return';
  quantity: number;
  formattedQuantity: string;
  expiry: string;
  rawExpiry?: string;
  batchNumber?: string;
  date: string;
  timestamp: number;
  purchase?: PurchaseInvoice;
  sale?: SaleTransaction;
  log?: AppLogEntry;
  purchaseReturn?: PurchaseReturn;
  purchaseReturnItem?: PurchaseReturnItem;
  initialAdj?: boolean;
}

interface OperationDetailModalProps {
  operation: ProductOperationItem;
  product: Product;
  onClose: () => void;
}

export const OperationDetailModal: React.FC<OperationDetailModalProps> = ({
  operation,
  product,
  onClose,
}) => {
  const { suppliers, customers, formatUSD } = usePharmacy();

  const title =
    operation.type === 'purchase'
      ? `Purchase Operation: ${operation.invoiceNumber || operation.referenceId}`
      : operation.type === 'sale'
      ? `Sale Operation: ${operation.invoiceNumber || operation.referenceId}`
      : operation.type === 'purchase_return'
      ? `Purchase Return Voucher: ${operation.invoiceNumber || operation.referenceId}`
      : `Stock Adjustment Operation: ${operation.referenceId}`;

  return (
    <DesktopWindow id="operation-detail-modal" section="stock" title={title} isOpen={true} onClose={onClose} width="640px" height="auto">
      <div className="w-full flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="p-4 space-y-4 text-xs">
          
          {/* Header summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px]">
            <div>
              <span className="text-slate-400 block uppercase font-semibold text-[9px]">Operation Type</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1 mt-0.5">
                {operation.type === 'purchase' ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Purchase</span>
                ) : operation.type === 'sale' ? (
                  <span className="text-blue-600 dark:text-blue-400 font-bold">Sale</span>
                ) : operation.type === 'purchase_return' ? (
                  <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" />
                    {operation.purchaseReturn?.returnType === 'replace_expiry' ? 'Expiry Swap' : 'Return (Purch)'}
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">Qty Adjustment</span>
                )}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block uppercase font-semibold text-[9px]">System Reference ID</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 block truncate" title={operation.referenceId}>
                {operation.referenceId}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block uppercase font-semibold text-[9px]">Operation Date</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                {new Date(operation.timestamp || operation.date).toLocaleDateString()}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block uppercase font-semibold text-[9px]">Item Quantity</span>
              <span className={`font-mono font-extrabold text-xs mt-0.5 block ${
                operation.type === 'purchase'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : operation.type === 'sale'
                  ? 'text-blue-600 dark:text-blue-400'
                  : operation.type === 'purchase_return'
                  ? 'text-rose-600 dark:text-rose-400'
                  : operation.formattedQuantity.startsWith('-')
                  ? 'text-rose-600 dark:text-rose-400'
                  : operation.formattedQuantity.startsWith('+')
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {operation.formattedQuantity}
              </span>
            </div>
          </div>

          {/* Focused Item Snapshot */}
          <div className="rounded-lg border border-teal-200/80 bg-teal-50/40 p-3 dark:border-teal-900/50 dark:bg-teal-950/20">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4 text-teal-600 shrink-0" />
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {product.name}
                </span>
                <span className="font-mono text-[10px] text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {product.code}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Operation Expiry</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {operation.expiry}
                </span>
                {operation.batchNumber && (
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Batch: {operation.batchNumber}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* TYPE-SPECIFIC OPERATION VIEWS */}
          {/* 1. PURCHASE INVOICE DETAILS */}
          {operation.type === 'purchase' && operation.purchase && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Building2 className="h-4 w-4 text-teal-600" />
                  <span>Supplier & Invoice Details</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-500">Invoice:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {operation.purchase.invoiceNumber || 'PINV'}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded font-semibold ${
                    operation.purchase.paid
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {operation.purchase.paid ? 'PAID' : 'UNPAID'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 text-[10px] block">Supplier Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {operation.purchase.supplierName || 'General Supplier'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">Total Invoice Cost</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-400 text-sm">
                    ${(operation.purchase.totalCostUSD || 0).toFixed(2)}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    ({formatLBPValue(operation.purchase.totalCostLBP || 0)} LBP)
                  </span>
                </div>
              </div>

              {/* Items in this purchase */}
              <div>
                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 block">
                  Invoice Items ({(operation.purchase.items || []).length})
                </span>
                <div className="rounded border border-slate-200 dark:border-slate-800 overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-1.5 px-2.5">Medication</th>
                        <th className="py-1.5 px-2">Batch / Expiry</th>
                        <th className="py-1.5 px-2 text-center">Qty</th>
                        <th className="py-1.5 px-2.5 text-right">Cost ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(operation.purchase.items || []).map((it, itIdx) => {
                        const isCurrentItem = it.productId === product.id || it.productCode === product.code;
                        const { displayMMYYYY } = parseExpiryDate(it.expiryDate);
                        return (
                          <tr
                            key={itIdx}
                            className={isCurrentItem ? 'bg-teal-50/70 dark:bg-teal-950/40 font-semibold' : ''}
                          >
                            <td className="py-1.5 px-2.5">
                              <span className="block text-slate-800 dark:text-slate-200">
                                {it.productName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {it.productCode}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 font-mono text-[11px]">
                              <span>{displayMMYYYY}</span>
                              {it.batchNumber && (
                                <span className="block text-[10px] text-slate-400">
                                  #{it.batchNumber}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold">
                              {it.quantity}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono">
                              ${(it.unitCostUSD || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. SALE TRANSACTION DETAILS */}
          {operation.type === 'sale' && operation.sale && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <User className="h-4 w-4 text-blue-600" />
                  <span>Customer & Cashier Details</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-500">Invoice:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {operation.sale.invoiceNumber}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 text-[10px] block">Customer</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {operation.sale.customerName || 'Cash Client'}
                  </span>
                  <span className="text-slate-400 text-[10px] block mt-1">Dispensing Pharmacist</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {operation.sale.cashierName || 'Pharmacist'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">Payment Method</span>
                  <span className="font-bold uppercase text-slate-800 dark:text-slate-200 text-xs">
                    {operation.sale.paymentMethod.replace('_', ' ')}
                  </span>
                  <span className="text-slate-400 text-[10px] block mt-1">Total Sale</span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-400 text-sm">
                    ${(operation.sale.totalUSD || 0).toFixed(2)}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    ({formatLBPValue(operation.sale.totalLBP || 0)} LBP)
                  </span>
                </div>
              </div>

              {/* Items in this sale */}
              <div>
                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 block">
                  Sold Medications ({(operation.sale.items || []).length})
                </span>
                <div className="rounded border border-slate-200 dark:border-slate-800 overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-1.5 px-2.5">Medication</th>
                        <th className="py-1.5 px-2">Batch / Expiry</th>
                        <th className="py-1.5 px-2 text-center">Qty</th>
                        <th className="py-1.5 px-2.5 text-right">Total ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(operation.sale.items || []).map((it, itIdx) => {
                        const isCurrentItem = it.productId === product.id || it.productCode === product.code;
                        const { displayMMYYYY } = parseExpiryDate(it.selectedExpiryDate || product.expiryDate);
                        return (
                          <tr
                            key={itIdx}
                            className={isCurrentItem ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold' : ''}
                          >
                            <td className="py-1.5 px-2.5">
                              <span className="block text-slate-800 dark:text-slate-200">
                                {it.productName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {it.productCode}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 font-mono text-[11px]">
                              <span>{displayMMYYYY}</span>
                              {it.selectedBatchNumber && (
                                <span className="block text-[10px] text-slate-400">
                                  #{it.selectedBatchNumber}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold">
                              {it.quantity}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono">
                              ${(it.totalUSD || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. QUANTITY ADJUSTMENT DETAILS */}
          {operation.type === 'adjustment' && (
            <div className="space-y-3">
              <div className="flex items-center space-x-1.5 font-bold text-slate-700 dark:text-slate-300">
                <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                <span>Quantity Adjustment Audit Record</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Adjustment Reference:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {operation.referenceId}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Logged Action:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {operation.log?.action || 'QTY_ADJUSTMENT'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Description / Notes:</span>
                  <span className="text-slate-600 dark:text-slate-400 text-right">
                    {operation.log?.description || 'Stock quantity and batch adjustment'}
                  </span>
                </div>

                {operation.log?.user && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Performed By:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {operation.log.user.name} ({operation.log.user.role})
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. PURCHASE RETURN DETAILS */}
          {operation.type === 'purchase_return' && operation.purchaseReturn && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <RotateCcw className="h-4 w-4 text-rose-600" />
                  <span>Purchase Return & Supplier Credit</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-500">Voucher:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    #{operation.purchaseReturn.returnNumber || operation.purchaseReturn.id}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded font-semibold ${
                    operation.purchaseReturn.returnType === 'replace_expiry'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                    {operation.purchaseReturn.returnType === 'replace_expiry' ? 'EXPIRY SWAP' : 'CASH REFUND'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 text-[10px] block">Returned To Supplier</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {operation.purchaseReturn.supplierName || 'Supplier'}
                  </span>
                  <span className="text-slate-400 text-[10px] block mt-1">Reason / Notes</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {operation.purchaseReturnItem?.reason || operation.purchaseReturn.reason || operation.purchaseReturn.notes || 'Return on purchase'}
                  </span>
                </div>
                <div className="text-right">
                  {operation.purchaseReturn.returnType === 'replace_expiry' ? (
                    <div>
                      <span className="text-slate-400 text-[10px] block">Action Type</span>
                      <span className="font-bold text-blue-700 dark:text-blue-400 text-xs">
                        Expiry Lot Exchange
                      </span>
                      {operation.purchaseReturnItem?.newExpiryDate && (
                        <span className="block text-[10px] text-slate-500 mt-1">
                          New Expiry: {operation.purchaseReturnItem.newExpiryDate}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span className="text-slate-400 text-[10px] block">Total Refund Value</span>
                      <span className="font-mono font-bold text-rose-700 dark:text-rose-400 text-sm">
                        ${(operation.purchaseReturn.totalRefundUSD || 0).toFixed(2)}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        ({formatLBPValue(operation.purchaseReturn.totalRefundLBP || 0)} LBP)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items in this return voucher */}
              <div>
                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 block">
                  Returned Products ({(operation.purchaseReturn.items || []).length})
                </span>
                <div className="rounded border border-slate-200 dark:border-slate-800 overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-1.5 px-2.5">Medication</th>
                        <th className="py-1.5 px-2">Old Lot / Expiry</th>
                        {operation.purchaseReturn.returnType === 'replace_expiry' && (
                          <th className="py-1.5 px-2">New Lot / Expiry</th>
                        )}
                        <th className="py-1.5 px-2 text-center">Qty</th>
                        {operation.purchaseReturn.returnType !== 'replace_expiry' && (
                          <th className="py-1.5 px-2.5 text-right">Refund ($)</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(operation.purchaseReturn.items || []).map((it, itIdx) => {
                        const isCurrentItem = it.productId === product.id || it.productCode === product.code;
                        const { displayMMYYYY: oldExp } = parseExpiryDate(it.oldExpiryDate);
                        const { displayMMYYYY: newExp } = parseExpiryDate(it.newExpiryDate);
                        return (
                          <tr
                            key={itIdx}
                            className={isCurrentItem ? 'bg-rose-50/70 dark:bg-rose-950/40 font-semibold' : ''}
                          >
                            <td className="py-1.5 px-2.5">
                              <span className="block text-slate-800 dark:text-slate-200">
                                {it.productName || it.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {it.productCode}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 font-mono text-[11px]">
                              <span>{oldExp}</span>
                              {it.oldBatchNumber && (
                                <span className="block text-[10px] text-slate-400">
                                  #{it.oldBatchNumber}
                                </span>
                              )}
                            </td>
                            {operation.purchaseReturn?.returnType === 'replace_expiry' && (
                              <td className="py-1.5 px-2 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                                <span>{newExp || '—'}</span>
                                {it.newBatchNumber && (
                                  <span className="block text-[10px] text-slate-400">
                                    #{it.newBatchNumber}
                                  </span>
                                )}
                              </td>
                            )}
                            <td className="py-1.5 px-2 text-center font-bold text-rose-600 dark:text-rose-400">
                              -{it.quantity}
                            </td>
                            {operation.purchaseReturn?.returnType !== 'replace_expiry' && (
                              <td className="py-1.5 px-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                                ${(it.refundAmountUSD || it.totalUSD || 0).toFixed(2)}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Close button */}
          <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer text-xs"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </DesktopWindow>
  );
};
