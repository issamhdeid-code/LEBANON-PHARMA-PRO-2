import React from 'react';
import { X, Printer, Edit, Calendar, User, Clock, CheckCircle2, ShieldAlert, CreditCard } from 'lucide-react';
import { SaleTransaction } from '../../types/pharmacy';
import { usePharmacy } from '../../context/PharmacyContext';
import { DesktopWindow } from '../common/DesktopWindow';
import { formatLBPValue } from '../../utils/priceUtils';
import { formatDateTime } from '../../utils/dateUtils';

interface ViewSaleModalProps {
  sale: SaleTransaction;
  onClose: () => void;
  onEdit: () => void;
  onPrint: () => void;
}

export const ViewSaleModal: React.FC<ViewSaleModalProps> = ({ sale, onClose, onEdit, onPrint }) => {
  const { customers, formatUSD, formatLBP, settings } = usePharmacy();
  const customer = customers.find((c) => c.id === sale.customerId);

  return (
    <DesktopWindow
      id="view-sale-modal"
      section="sale"
      title={sale.isUnreal ? `Unreal Invoice Details: ${sale.invoiceNumber}` : `Sale Transaction Details: ${sale.invoiceNumber}`}
      isOpen={true}
      onClose={onClose}
      width="620px"
      height="auto"
    >
      <div className="w-full flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="p-4 space-y-3.5 text-xs flex-1 flex flex-col justify-between">
          {sale.isUnreal && (
            <div className="flex items-center justify-between rounded bg-amber-50 border border-amber-300 dark:border-amber-700/60 dark:bg-amber-950/40 p-2 text-amber-900 dark:text-amber-200">
              <span className="font-bold">Fictitious / Unreal Invoice</span>
              <span className="text-[10px]">No real stock deducted • Excluded from official financial reports</span>
            </div>
          )}

          {/* Metadata Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-gray-200 dark:border-slate-800 text-[11px]">
            <div>
              <span className="text-gray-400 block uppercase font-semibold text-[9px]">Date & Time</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formatDateTime(sale.timestamp || sale.date)}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block uppercase font-semibold text-[9px]">Dispensing Pharmacist</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{sale.cashierName}</span>
            </div>
            <div>
              <span className="text-gray-400 block uppercase font-semibold text-[9px]">Payment Method</span>
              <span className="font-bold uppercase text-teal-700 dark:text-teal-300">
                {sale.paymentMethod.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block uppercase font-semibold text-[9px]">Applied Exchange Rate</span>
              <span className="font-bold text-blue-700 dark:text-blue-300">
                1$ = {formatLBPValue(sale.exchangeRate)} L.L.
              </span>
            </div>
          </div>

          {/* Customer / Patient Information */}
          <div className="rounded border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-gray-700 dark:text-slate-200 flex items-center">
                <User className="h-3.5 w-3.5 mr-1 text-gray-400" />
                Customer: {sale.customerName || (sale.isUnreal ? 'Unreal Invoice' : 'Cash Client')}
              </span>
            </div>
            {customer?.allergies && (
              <div className="mt-1 flex items-center text-[10px] text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                <ShieldAlert className="h-3 w-3 mr-1 shrink-0" />
                <span>Known Patient Allergy: <strong>{customer.allergies}</strong></span>
              </div>
            )}
          </div>

          {/* Sold Items Table */}
          <div>
            <div className="font-bold text-[11px] uppercase tracking-wider text-gray-700 dark:text-slate-200 mb-1.5">
              Sold Medications ({(sale.items || []).length} items)
            </div>
            <div className="rounded border border-gray-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase text-gray-500 border-b border-gray-200 dark:border-slate-800">
                  <tr>
                    <th className="py-1.5 px-3">Item / MoPH Code</th>
                    <th className="py-1.5 px-2 text-center">Qty</th>
                    <th className="py-1.5 px-2 text-right">Unit ($)</th>
                    <th className="py-1.5 px-3 text-right">Total ($ / L.L.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                  {(sale.items || []).map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-1.5 px-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {item.productName}
                          {item.isPiece && (
                            <span className="ml-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                              (Piece)
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[9px] text-gray-400">{item.productCode}</span>
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                        {item.quantity}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-gray-600 dark:text-slate-300">
                        ${item.unitPriceUSD.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <div className="font-bold text-blue-600 dark:text-blue-400">
                          ${item.totalUSD.toFixed(2)}
                        </div>
                        <div className="text-[9px] text-gray-400">
                          {formatLBPValue(item.totalLBP)} LBP
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {sale.notes && (
            <div className="p-2 rounded bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-[11px]">
              <strong className="font-semibold">Notes: </strong>
              {sale.notes}
            </div>
          )}

          {/* Financial Totals */}
          <div className="rounded bg-teal-50 border border-teal-200 dark:bg-teal-950/40 dark:border-teal-900 p-3">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs font-bold uppercase text-teal-900 dark:text-teal-200">
                Total Transaction Amount:
              </span>
              <div className="text-right">
                <span className="text-base font-bold text-teal-900 dark:text-teal-200 block">
                  {formatUSD(sale.totalUSD)}
                </span>
                <span className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                  {formatLBP(sale.totalLBP)}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-teal-200/60 dark:border-teal-900 text-[11px] grid grid-cols-2 gap-2 text-teal-800 dark:text-teal-300">
              <div>
                <span>Amount Paid: </span>
                <strong>
                  {sale.amountPaidUSD > 0 && `$${sale.amountPaidUSD.toFixed(2)} `}
                  {sale.amountPaidLBP > 0 && `${formatLBPValue(sale.amountPaidLBP)} LBP`}
                  {sale.amountPaidUSD === 0 && sale.amountPaidLBP === 0 && (sale.paymentMethod === 'credit_debt' ? 'Debt Charged' : '$0.00')}
                </strong>
              </div>
              <div className="text-right">
                <span>Change Returned: </span>
                <strong>
                  {sale.changeGivenUSD > 0 && `$${sale.changeGivenUSD.toFixed(2)} `}
                  {sale.changeGivenLBP > 0 && `${formatLBPValue(sale.changeGivenLBP)} LBP`}
                  {sale.changeGivenUSD === 0 && sale.changeGivenLBP === 0 && 'None'}
                </strong>
              </div>
            </div>

            {((sale.retainedUSD && sale.retainedUSD >= 0.01) || (sale.retainedLBP && sale.retainedLBP > 0)) && (
              <div className="mt-2 flex items-center justify-between rounded bg-teal-50 px-2.5 py-1.5 text-[11px] font-bold text-teal-800 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900">
                <span>Extra Kept in Cash Drawer:</span>
                <span>
                  {sale.retainedUSD && sale.retainedUSD >= 0.01 ? `+$${sale.retainedUSD.toFixed(2)} ` : ''}
                  {sale.retainedLBP && sale.retainedLBP > 0 ? `(+${formatLBPValue(sale.retainedLBP)} LBP)` : ''}
                </span>
              </div>
            )}

            {(sale.writeOffUSD && sale.writeOffUSD >= 0.01) || (sale.writeOffLBP && sale.writeOffLBP > 0) ? (
              <div className="mt-2 flex items-center justify-between rounded bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                <span>Difference Written Off:</span>
                <span>
                  {sale.writeOffUSD && sale.writeOffUSD >= 0.01 ? `-$${sale.writeOffUSD.toFixed(2)} ` : ''}
                  (-{formatLBPValue(sale.writeOffLBP || 0)} LBP)
                </span>
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onPrint}
                className="flex items-center space-x-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5 text-teal-600" />
                <span>Print Official Receipt</span>
              </button>

              <button
                type="button"
                onClick={onEdit}
                className="flex items-center space-x-1.5 rounded border border-teal-300 bg-teal-50 px-3 py-1.5 font-bold text-teal-800 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300 cursor-pointer shadow-2xs"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Edit Sale</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 bg-white px-4 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </DesktopWindow>
  );
};
