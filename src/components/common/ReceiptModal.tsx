import React, { useState } from 'react';
import { Printer, X, CheckCircle, ShieldCheck, FileText, Receipt, Check } from 'lucide-react';
import { SaleTransaction, PharmacySettings } from '../../types/pharmacy';
import { DesktopWindow } from './DesktopWindow';
import { formatLBPValue } from '../../utils/priceUtils';
import { formatDateTime } from '../../utils/dateUtils';

export type PrintFormat = 'invoice' | 'receipt';

interface ReceiptModalProps {
  sale: SaleTransaction | null;
  settings: PharmacySettings;
  onClose: () => void;
  initialFormat?: PrintFormat;
  onFormatChange?: (format: PrintFormat) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  settings,
  onClose,
  initialFormat,
  onFormatChange,
}) => {
  if (!sale) return null;

  const [printFormat, setPrintFormat] = useState<PrintFormat>(() => {
    if (initialFormat) return initialFormat;
    try {
      const saved = localStorage.getItem('pos_print_format');
      if (saved === 'invoice' || saved === 'receipt') return saved;
    } catch {
      // ignore
    }
    return settings.invoiceTemplate?.enabled ? 'invoice' : 'receipt';
  });

  const handleFormatSelect = (fmt: PrintFormat) => {
    setPrintFormat(fmt);
    try {
      localStorage.setItem('pos_print_format', fmt);
    } catch {
      // ignore
    }
    onFormatChange?.(fmt);
  };

  const handlePrint = () => {
    window.print();
  };

  const isInvoice = printFormat === 'invoice';

  return (
    <DesktopWindow
      id="sale-receipt-modal"
      section="sale"
      title={
        sale.isUnreal
          ? (isInvoice ? `Unreal Official Invoice: ${sale.invoiceNumber}` : `Unreal Receipt: ${sale.invoiceNumber}`)
          : (isInvoice ? `Official Invoice: ${sale.invoiceNumber}` : `Sale Receipt: ${sale.invoiceNumber}`)
      }
      isOpen={true}
      onClose={onClose}
      width={isInvoice ? "820px" : "460px"}
      height="85vh"
    >
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
        {/* Print Format Selector Bar (Hidden in Print) */}
        <div className="no-print flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Print Format:
            </span>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-200/90 dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleFormatSelect('receipt')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  printFormat === 'receipt'
                    ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Thermal Receipt Format (80mm POS slip)"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>Receipt Format</span>
                <span className="text-[10px] font-normal opacity-70">(Thermal)</span>
              </button>

              <button
                type="button"
                onClick={() => handleFormatSelect('invoice')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  printFormat === 'invoice'
                    ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Official Invoice Printing Template (MoPH / CNSS / Syndicate A4 format)"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Official Invoice</span>
                <span className="text-[10px] font-normal opacity-70">(A4 Template)</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-1.5">
            {isInvoice ? (
              <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                Official MoPH & CNSS Syndicate format
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                Standard customer POS slip
              </span>
            )}
          </div>
        </div>

        {/* Printable Area */}
        <div
          id="printable-receipt"
          className={`p-6 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 flex-1 overflow-y-auto ${
            isInvoice ? 'font-sans text-sm' : 'font-mono text-xs'
          }`}
        >
          {isInvoice ? (
            <A4Invoice sale={sale} settings={settings} />
          ) : (
            <ThermalReceipt sale={sale} settings={settings} />
          )}
        </div>

        {/* Action Controls (Hidden in Print) */}
        <div className="no-print flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-[11px]">Active Format:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {isInvoice ? 'Official Invoice (A4 Template)' : 'Thermal Receipt Format'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-900 dark:bg-emerald-600 dark:hover:bg-emerald-700 cursor-pointer"
              title="Print document or save as PDF"
            >
              <Printer className="h-4 w-4" />
              <span>{isInvoice ? 'Print Official Receipt' : 'Print Receipt'}</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              Close / New Sale
            </button>
          </div>
        </div>
      </div>
    </DesktopWindow>
  );
};

const ThermalReceipt: React.FC<{ sale: SaleTransaction, settings: PharmacySettings }> = ({ sale, settings }) => {
  const rTpl = settings.receiptTemplate;
  const isCustom = Boolean(rTpl?.enabled);

  const pharmacyName = (isCustom && rTpl?.header?.pharmacyName?.trim()) || settings.pharmacyName || 'Pharmacy';
  const tagline = isCustom ? rTpl?.header?.tagline?.trim() : '';
  const pharmacyAddress = (isCustom && rTpl?.header?.address?.trim()) || settings.pharmacyAddress || '';
  const pharmacyPhone = (isCustom && rTpl?.header?.phone?.trim()) || settings.pharmacyPhone || '';
  const licenseNumber = (isCustom && rTpl?.header?.licenseNumber?.trim()) || settings.licenseNumber || '';
  const headerNote = isCustom ? rTpl?.header?.headerNote?.trim() : '';

  const thankYouMessage = (isCustom && rTpl?.footer?.thankYouMessage?.trim()) || (pharmacyName ? `Thank you for trusting ${pharmacyName}!` : 'Thank you for your visit!');
  const policyNote = isCustom && rTpl?.footer?.policyNote !== undefined && rTpl?.footer?.policyNote !== ''
    ? rTpl.footer.policyNote.trim()
    : 'Medications cannot be exchanged or returned per MOPH regulations.';
  const recoveryGreeting = isCustom && rTpl?.footer?.recoveryGreeting !== undefined && rTpl?.footer?.recoveryGreeting !== ''
    ? rTpl.footer.recoveryGreeting.trim()
    : 'Health & Recovery / بالشفاء العاجل';
  const customNote = isCustom ? rTpl?.footer?.customNote?.trim() : '';

  const showCashier = isCustom ? (rTpl?.options?.showCashier ?? true) : true;
  const showCustomer = isCustom ? (rTpl?.options?.showCustomer ?? true) : true;
  const showExchangeRate = isCustom ? (rTpl?.options?.showExchangeRate ?? true) : true;
  const showItemCode = isCustom ? (rTpl?.options?.showItemCode ?? true) : true;
  const showPaymentBreakdown = isCustom ? (rTpl?.options?.showPaymentBreakdown ?? true) : true;
  const showLoyaltyPoints = isCustom ? (rTpl?.options?.showLoyaltyPoints ?? true) : true;
  const showLicenseNumber = isCustom ? (rTpl?.options?.showLicenseNumber ?? true) : true;
  const is58mm = isCustom && rTpl?.options?.paperWidth === '58mm';

  return (
    <div className={`mx-auto ${is58mm ? 'max-w-[270px] text-[11px]' : 'max-w-[360px] text-xs'}`}>
      {/* Pharmacy Info Header */}
      <div className="text-center pb-4 border-b border-dashed border-slate-300 dark:border-slate-700">
        <div className="font-bold text-base uppercase font-sans tracking-wide">
          {pharmacyName}
        </div>
        {tagline && (
          <div className="text-xs font-medium text-teal-700 dark:text-teal-400 mt-0.5 font-sans">
            {tagline}
          </div>
        )}
        {pharmacyAddress && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {pharmacyAddress}
          </div>
        )}
        {pharmacyPhone && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Tel: {pharmacyPhone}
          </div>
        )}
        {showLicenseNumber && licenseNumber && (
          <div className="text-[10px] text-slate-400 mt-1">
            Ministry of Public Health License: {licenseNumber}
          </div>
        )}
        {headerNote && (
          <div className="mt-2 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-sans italic border border-slate-200 dark:border-slate-700">
            {headerNote}
          </div>
        )}
      </div>

      {/* Invoice Meta */}
      <div className="py-3 border-b border-dashed border-slate-300 dark:border-slate-700 space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Invoice:</span>
          <span className="font-bold">{sale.invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Date:</span>
          <span>{formatDateTime(sale.date)}</span>
        </div>
        {showCashier && (
          <div className="flex justify-between">
            <span className="text-slate-500">Cashier:</span>
            <span>{sale.cashierName}</span>
          </div>
        )}
        {showCustomer && sale.customerName && (
          <div className="flex justify-between">
            <span className="text-slate-500">Customer:</span>
            <span className="font-semibold">{sale.customerName}</span>
          </div>
        )}
        {showExchangeRate && (
          <div className="flex justify-between text-amber-700 dark:text-amber-400">
            <span>Applied Rate:</span>
            <span className="font-bold">1$ = {formatLBPValue(sale.exchangeRate)} L.L.</span>
          </div>
        )}
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
                {showItemCode ? <span>Code: {item.productCode}</span> : <span />}
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

        {showPaymentBreakdown && (
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
            {((sale.retainedUSD && sale.retainedUSD >= 0.01) || (sale.retainedLBP && sale.retainedLBP > 0)) && (
              <div className="flex justify-between font-bold text-teal-700 dark:text-teal-400">
                <span>Extra Retained:</span>
                <span>
                  {sale.retainedUSD && sale.retainedUSD >= 0.01 ? `+$${sale.retainedUSD.toFixed(2)} ` : ''}
                  {sale.retainedLBP && sale.retainedLBP > 0 ? `(+${formatLBPValue(sale.retainedLBP)} L.L.)` : ''}
                </span>
              </div>
            )}
            {(sale.writeOffUSD && sale.writeOffUSD >= 0.01) || (sale.writeOffLBP && sale.writeOffLBP > 0) ? (
              <div className="flex justify-between font-bold text-rose-600 dark:text-rose-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Difference Written Off:</span>
                <span>
                  {sale.writeOffUSD && sale.writeOffUSD >= 0.01 ? `-$${sale.writeOffUSD.toFixed(2)} ` : ''}
                  ({formatLBPValue(sale.writeOffLBP || 0)} L.L.)
                </span>
              </div>
            ) : null}
            {showLoyaltyPoints && ((sale.pointsRedeemed && sale.pointsRedeemed > 0) || (sale.pointsEarned && sale.pointsEarned > 0)) && (
              <div className="pt-1.5 border-t border-dashed border-amber-300 dark:border-amber-700/80 text-[10px] space-y-0.5 text-amber-900 dark:text-amber-300 font-sans">
                <div className="font-bold flex items-center justify-between">
                  <span>⭐ Patient Loyalty Rewards</span>
                </div>
                {sale.pointsRedeemed && sale.pointsRedeemed > 0 && (
                  <div className="flex justify-between text-rose-700 dark:text-rose-400 font-semibold">
                    <span>Redeemed Points:</span>
                    <span>-{sale.pointsRedeemed} pts (-${(sale.pointsDiscountUSD || 0).toFixed(2)})</span>
                  </div>
                )}
                {sale.pointsEarned !== undefined && sale.pointsEarned > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                    <span>Points Earned Today:</span>
                    <span>+{sale.pointsEarned} pts</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="text-center pt-4 text-[10px] text-slate-400 dark:text-slate-500 space-y-1 font-sans">
        {thankYouMessage && <p>{thankYouMessage}</p>}
        {policyNote && <p className="text-[9px]">{policyNote}</p>}
        {recoveryGreeting && <p className="text-[9px]">{recoveryGreeting}</p>}
        {customNote && <p className="text-[9px] text-slate-500 font-medium">{customNote}</p>}
      </div>
    </div>
  );
};

const A4Invoice: React.FC<{ sale: SaleTransaction, settings: PharmacySettings }> = ({ sale, settings }) => {
  const tpl = settings.invoiceTemplate;

  const englishPharmacyName = tpl?.headerEnglish?.pharmacyName?.trim() || settings.pharmacyName || 'Pharmacy';
  const arabicPharmacyName = tpl?.headerArabic?.pharmacyName?.trim() || settings.pharmacyName || 'صيدلية';
  const englishAddress = tpl?.headerEnglish?.address?.trim() || settings.pharmacyAddress || '';
  const arabicAddress = tpl?.headerArabic?.address?.trim() || settings.pharmacyAddress || '';
  const englishTel = tpl?.headerEnglish?.tel?.trim() || settings.pharmacyPhone || '';
  const arabicTel = tpl?.headerArabic?.tel?.trim() || settings.pharmacyPhone || '';
  const amendedDegreeNoEng = tpl?.headerEnglish?.amendedDegreeNo?.trim() || settings.licenseNumber || '';
  const amendedDegreeNoAr = tpl?.headerArabic?.amendedDegreeNo?.trim() || settings.licenseNumber || '';
  const orderRegNoEng = tpl?.headerEnglish?.orderRegNo?.trim() || '';
  const orderRegNoAr = tpl?.headerArabic?.orderRegNo?.trim() || '';
  const cnssNoEng = tpl?.headerEnglish?.cnssNo?.trim() || '';
  const cnssNoAr = tpl?.headerArabic?.cnssNo?.trim() || '';
  const vatNo = tpl?.centerInfo?.vatNo?.trim() || '';
  const invoiceNo = tpl?.centerInfo?.no?.trim() || sale.invoiceNumber;
  const pharmacistNameEng = tpl?.headerEnglish?.pharmacistName?.trim() || sale.cashierName || '';
  const pharmacistNameAr = tpl?.headerArabic?.pharmacistName?.trim() || '';

  const totalQty = (sale.items || []).reduce((sum, item) => sum + item.quantity, 0);
  
  // Check if any real discount was actually applied by the user while items were in the cart
  const hasRealDiscount = (sale.items || []).some((item) => (item.discountPercent || 0) > 0);

  // If real discount was applied, calculate the discount amount in LBP
  const totalDiscountUSD = hasRealDiscount
    ? (sale.items || []).reduce((sum, item) => {
        const disc = item.discountPercent || 0;
        if (disc <= 0) return sum;
        return sum + (item.unitPriceUSD || 0) * item.quantity * (disc / 100);
      }, 0)
    : 0;

  const totalDiscountLBP = hasRealDiscount
    ? Math.round(totalDiscountUSD * (sale.exchangeRate || 89500))
    : 0;

  const totalBeforeDiscountLBP = hasRealDiscount && totalDiscountLBP > 0
    ? sale.totalLBP + totalDiscountLBP
    : sale.totalLBP;

  return (
    <div className="bg-white text-black p-4 w-[750px] mx-auto text-[13px]" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header Grid */}
      <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
        {/* Left: English */}
        <div className="w-1/3 text-left font-bold text-[11px] space-y-1">
          <h2 className="text-lg uppercase">{englishPharmacyName}</h2>
          <p>Pharmacist</p>
          <p>{pharmacistNameEng}</p>
          {amendedDegreeNoEng ? <p>Amended Degree No : {amendedDegreeNoEng}</p> : null}
          {orderRegNoEng ? <p>Order Reg No : {orderRegNoEng}</p> : null}
          {cnssNoEng ? <p>CNSS no. {cnssNoEng}</p> : null}
          {englishAddress ? <p>{englishAddress}</p> : null}
          {englishTel ? <p>Tel : {englishTel}</p> : null}
        </div>

        {/* Center: Logo & Details */}
        <div className="w-1/3 text-center flex flex-col items-center">
          <img
            src="/logo.png"
            alt="Pharmacy Logo"
            className="h-24 w-auto object-contain mb-2"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          {vatNo ? <p className="font-bold text-sm">Vat# {vatNo}</p> : null}
          <p className="font-bold text-sm">No: {invoiceNo}</p>
        </div>

        {/* Right: Arabic */}
        <div className="w-1/3 text-right font-bold text-[11px] space-y-1" dir="rtl">
          <h2 className="text-lg">{arabicPharmacyName}</h2>
          <p>الصيدلي</p>
          <p>{pharmacistNameAr || pharmacistNameEng}</p>
          {amendedDegreeNoAr ? <p>إجازة رقم : {amendedDegreeNoAr}</p> : null}
          {orderRegNoAr ? <p>رقم التسجيل في النقابة : {orderRegNoAr}</p> : null}
          {cnssNoAr ? <p>رقم الضمان : {cnssNoAr}</p> : null}
          {arabicAddress ? <p>{arabicAddress}</p> : null}
          {arabicTel ? <p>تلفون : {arabicTel}</p> : null}
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
             const discountPerc = item.discountPercent || 0;
             const unitPrice = discountPerc > 0
               ? (item.unitPriceLBP || Math.round((item.unitPriceUSD || 0) * (sale.exchangeRate || 89500)))
               : (item.quantity > 0 ? Math.round(item.totalLBP / item.quantity) : (item.unitPriceLBP || 0));
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
            <div className="w-1/2 flex items-center justify-end pr-2">
              {hasRealDiscount && totalDiscountLBP > 0 ? formatLBPValue(totalDiscountLBP) : ''}
            </div>
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
