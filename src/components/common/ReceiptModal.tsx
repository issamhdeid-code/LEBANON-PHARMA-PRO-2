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

  const isCustomFormat = settings.invoiceTemplate?.enabled;

  return (
    <DesktopWindow id="sale-receipt-modal" section="sale" title="Sale Completed & Receipt" isOpen={true} onClose={onClose} width={isCustomFormat ? "800px" : "450px"} height="85vh">
      <div className="flex flex-col h-full">
        {/* Printable Receipt Area */}
        <div id="printable-receipt" className={`p-6 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 flex-1 overflow-y-auto ${isCustomFormat ? 'font-sans text-sm' : 'font-mono text-xs'}`}>
          {isCustomFormat ? (
            <A4Invoice sale={sale} settings={settings} />
          ) : (
            <ThermalReceipt sale={sale} settings={settings} />
          )}
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
            Close / New Sale
          </button>
        </div>
      </div>
    </DesktopWindow>
  );
};

const ThermalReceipt: React.FC<{ sale: SaleTransaction, settings: PharmacySettings }> = ({ sale, settings }) => {
  return (
    <>
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
    </>
  );
};

const A4Invoice: React.FC<{ sale: SaleTransaction, settings: PharmacySettings }> = ({ sale, settings }) => {
  const tpl = settings.invoiceTemplate;
  if (!tpl) return null;

  const totalQty = sale.items.reduce((sum, item) => sum + item.quantity, 0);
  
  const totalBeforeDiscountLBP = sale.items.reduce((sum, item) => {
    const unitPrice = item.unitPriceLBP || (item.totalLBP / item.quantity);
    return sum + (unitPrice * item.quantity);
  }, 0);

  const totalDiscountLBP = totalBeforeDiscountLBP - sale.totalLBP;

  return (
    <div className="bg-white text-black p-4 w-[750px] mx-auto text-[13px]" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header Grid */}
      <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
        {/* Left: English */}
        <div className="w-1/3 text-left font-bold text-[11px] space-y-1">
          <h2 className="text-lg">{tpl.headerEnglish.pharmacyName}</h2>
          <p>Pharmacist</p>
          <p>{tpl.headerEnglish.pharmacistName}</p>
          <p>Amended Degree No : {tpl.headerEnglish.amendedDegreeNo}</p>
          <p>Order Reg No : {tpl.headerEnglish.orderRegNo}</p>
          <p>CNSS no. {tpl.headerEnglish.cnssNo}</p>
          <p>{tpl.headerEnglish.address}</p>
          <p>Tel : {tpl.headerEnglish.tel}</p>
        </div>

        {/* Center: Logo & Details */}
        <div className="w-1/3 text-center flex flex-col items-center">
          <img src="/logo.png" alt="Pharmacy Logo" className="h-24 w-auto object-contain mb-2" />
          <p className="font-bold text-sm">Vat# {tpl.centerInfo.vatNo}</p>
          <p className="font-bold text-sm">No:{tpl.centerInfo.no}</p>
        </div>

        {/* Right: Arabic */}
        <div className="w-1/3 text-right font-bold text-[11px] space-y-1" dir="rtl">
          <h2 className="text-lg">{tpl.headerArabic.pharmacyName}</h2>
          <p>الصيدلي</p>
          <p>{tpl.headerArabic.pharmacistName}</p>
          <p>إجازة رقم : {tpl.headerArabic.amendedDegreeNo}</p>
          <p>رقم التسجيل في النقابة : {tpl.headerArabic.orderRegNo}</p>
          <p>{tpl.headerArabic.address}</p>
          <p>تلفون : {tpl.headerArabic.tel}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="flex justify-between mb-4">
        <div className="w-1/2 space-y-2 font-semibold">
          <div className="flex">
            <span className="w-24">Date</span>
            <span>{new Date(sale.date).toLocaleDateString('en-GB')}</span>
          </div>
          <div className="flex">
            <span className="w-24">Due M. :</span>
            <span>{sale.customerName || ''}</span>
          </div>
          <div className="flex">
            <span className="w-24">Address :</span>
            <span></span>
          </div>
        </div>
        <div className="w-1/2 space-y-2 text-right font-semibold" dir="rtl">
          <div className="flex">
            <span className="w-32">التاريخ</span>
            <span className="mr-4" dir="ltr">{new Date(sale.date).toLocaleDateString('en-GB')}</span>
          </div>
          <div className="flex">
            <span className="w-32">المطلوب من السيد(ة)</span>
            <span className="mr-4">{sale.customerName || ''}</span>
          </div>
          <div className="flex">
            <span className="w-32">العنوان</span>
            <span className="mr-4"></span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-black mb-1">
        <thead>
          <tr className="border-b border-black text-center font-bold">
            <th className="border-r border-black p-1 text-xs">الكمية<br/>Qty</th>
            <th className="border-r border-black p-1 text-xs">رقم الوزارة<br/>MOH</th>
            <th className="border-r border-black p-1 text-xs w-2/5">الشرح<br/>Brand name</th>
            <th className="border-r border-black p-1 text-xs">Unit</th>
            <th className="border-r border-black p-1 text-xs">السعر الإفرادي<br/>Unit Price</th>
            <th className="border-r border-black p-1 text-xs">Disc<br/>%</th>
            <th className="p-1 text-xs">السعر الإجمالي<br/>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, idx) => {
             const unitPrice = item.unitPriceLBP || (item.totalLBP / item.quantity);
             const discountPerc = item.discountPercent || 0;
             return (
              <tr key={idx} className="border-b border-gray-300">
                <td className="border-r border-black p-1 text-center font-semibold">{item.quantity}</td>
                <td className="border-r border-black p-1 text-center">{item.productCode}</td>
                <td className="border-r border-black p-1 font-bold">{item.productName}</td>
                <td className="border-r border-black p-1 text-center"></td>
                <td className="border-r border-black p-1 text-right">{formatLBPValue(unitPrice)}</td>
                <td className="border-r border-black p-1 text-center">{discountPerc > 0 ? discountPerc : ''}</td>
                <td className="p-1 text-right font-bold">{formatLBPValue(item.totalLBP)}</td>
              </tr>
            );
          })}
          {/* Fill empty rows to make it look like a standard page block */}
          {Array.from({ length: Math.max(0, 10 - sale.items.length) }).map((_, i) => (
            <tr key={'empty-'+i}>
              <td className="border-r border-black p-4"></td>
              <td className="border-r border-black p-4"></td>
              <td className="border-r border-black p-4"></td>
              <td className="border-r border-black p-4"></td>
              <td className="border-r border-black p-4"></td>
              <td className="border-r border-black p-4"></td>
              <td className="p-4"></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer Totals & Stamp */}
      <div className="flex border border-black mb-12">
        {/* Left part: Total Qty */}
        <div className="flex-1 flex border-r border-black">
          <div className="w-1/3 flex items-center justify-end pr-2 font-bold text-sm">TOTAL Qty</div>
          <div className="w-16 border-l border-r border-black flex items-center justify-center font-bold">
            {totalQty}
          </div>
          <div className="flex-1 flex items-end justify-start pl-4 pb-2 text-[10px]">
             الختم والتوقيع<br/>Sig. & Stamp
          </div>
        </div>

        {/* Right part: Amount Totals */}
        <div className="w-1/3 flex flex-col font-bold">
          <div className="flex border-b border-black h-8">
            <div className="w-1/2 border-r border-black flex items-center pl-2 text-xs">Total</div>
            <div className="w-1/2 flex items-center justify-end pr-2">{formatLBPValue(totalBeforeDiscountLBP)}</div>
          </div>
          <div className="flex border-b border-black h-8">
            <div className="w-1/2 border-r border-black flex items-center pl-2 text-xs">Discount</div>
            <div className="w-1/2 flex items-center justify-end pr-2">{formatLBPValue(totalDiscountLBP)}</div>
          </div>
          <div className="flex border-b border-black h-8">
            <div className="w-1/2 border-r border-black flex items-center pl-2 text-xs">VAT 11%</div>
            <div className="w-1/2 flex items-center justify-end pr-2">0</div>
          </div>
          <div className="flex h-8">
            <div className="w-1/2 border-r border-black flex items-center pl-2 text-xs">TOTAL</div>
            <div className="w-1/2 flex items-center justify-end pr-2">{formatLBPValue(sale.totalLBP)}</div>
          </div>
        </div>
      </div>

    </div>
  );
};
