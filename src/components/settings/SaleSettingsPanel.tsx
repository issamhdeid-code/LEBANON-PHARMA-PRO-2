import React, { useState, useEffect } from 'react';
import { ShoppingCart, Printer, Save, CheckCircle2, Receipt } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { ReceiptTemplate } from '../../types/pharmacy';

const BLANK_TEMPLATE = {
  enabled: false,
  headerEnglish: {
    pharmacyName: '',
    pharmacistName: '',
    amendedDegreeNo: '',
    orderRegNo: '',
    cnssNo: '',
    address: '',
    tel: '',
  },
  headerArabic: {
    pharmacyName: '',
    pharmacistName: '',
    amendedDegreeNo: '',
    orderRegNo: '',
    cnssNo: '',
    address: '',
    tel: '',
  },
  centerInfo: {
    vatNo: '',
    no: '',
  },
};

export const SaleSettingsPanel: React.FC = () => {
  const { settings, updateSettings, addNotification } = usePharmacy();
  const [isSaving, setIsSaving] = useState(false);

  const getCleanTemplate = () => {
    const tpl = settings.invoiceTemplate;
    if (!tpl || tpl.headerEnglish?.pharmacyName === 'Pharmacie Al-Arz') {
      return { ...BLANK_TEMPLATE };
    }
    return {
      enabled: Boolean(tpl.enabled),
      headerEnglish: {
        pharmacyName: tpl.headerEnglish?.pharmacyName || '',
        pharmacistName: tpl.headerEnglish?.pharmacistName || '',
        amendedDegreeNo: tpl.headerEnglish?.amendedDegreeNo || '',
        orderRegNo: tpl.headerEnglish?.orderRegNo || '',
        cnssNo: tpl.headerEnglish?.cnssNo || '',
        address: tpl.headerEnglish?.address || '',
        tel: tpl.headerEnglish?.tel || '',
      },
      headerArabic: {
        pharmacyName: tpl.headerArabic?.pharmacyName || '',
        pharmacistName: tpl.headerArabic?.pharmacistName || '',
        amendedDegreeNo: tpl.headerArabic?.amendedDegreeNo || '',
        orderRegNo: tpl.headerArabic?.orderRegNo || '',
        cnssNo: tpl.headerArabic?.cnssNo || '',
        address: tpl.headerArabic?.address || '',
        tel: tpl.headerArabic?.tel || '',
      },
      centerInfo: {
        vatNo: tpl.centerInfo?.vatNo || '',
        no: tpl.centerInfo?.no || '',
      },
    };
  };

  const getCleanThermalTemplate = (): ReceiptTemplate => {
    const rTpl = settings.receiptTemplate;
    if (!rTpl) {
      return {
        enabled: false,
        header: {
          pharmacyName: '',
          address: '',
          phone: '',
          licenseNumber: '',
          tagline: '',
          headerNote: '',
        },
        footer: {
          thankYouMessage: '',
          policyNote: '',
          recoveryGreeting: '',
          customNote: '',
        },
        options: {
          paperWidth: '80mm',
          showCashier: true,
          showCustomer: true,
          showExchangeRate: true,
          showItemCode: true,
          showPaymentBreakdown: true,
          showLoyaltyPoints: true,
          showLicenseNumber: true,
        },
      };
    }
    return {
      enabled: Boolean(rTpl.enabled),
      header: {
        pharmacyName: rTpl.header?.pharmacyName ?? '',
        address: rTpl.header?.address ?? '',
        phone: rTpl.header?.phone ?? '',
        licenseNumber: rTpl.header?.licenseNumber ?? '',
        tagline: rTpl.header?.tagline ?? '',
        headerNote: rTpl.header?.headerNote ?? '',
      },
      footer: {
        thankYouMessage: rTpl.footer?.thankYouMessage ?? '',
        policyNote: rTpl.footer?.policyNote ?? '',
        recoveryGreeting: rTpl.footer?.recoveryGreeting ?? '',
        customNote: rTpl.footer?.customNote ?? '',
      },
      options: {
        paperWidth: rTpl.options?.paperWidth || '80mm',
        showCashier: rTpl.options?.showCashier ?? true,
        showCustomer: rTpl.options?.showCustomer ?? true,
        showExchangeRate: rTpl.options?.showExchangeRate ?? true,
        showItemCode: rTpl.options?.showItemCode ?? true,
        showPaymentBreakdown: rTpl.options?.showPaymentBreakdown ?? true,
        showLoyaltyPoints: rTpl.options?.showLoyaltyPoints ?? true,
        showLicenseNumber: rTpl.options?.showLicenseNumber ?? true,
      },
    };
  };

  const [invoiceTemplate, setInvoiceTemplate] = useState(getCleanTemplate);
  const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplate>(getCleanThermalTemplate);
  const [defaultPrintFormat, setDefaultPrintFormat] = useState<'receipt' | 'invoice'>(() => {
    return settings.defaultPrintFormat || (settings.invoiceTemplate?.enabled ? 'invoice' : 'receipt');
  });

  useEffect(() => {
    setInvoiceTemplate(getCleanTemplate());
    setReceiptTemplate(getCleanThermalTemplate());
    if (settings.defaultPrintFormat) {
      setDefaultPrintFormat(settings.defaultPrintFormat);
    }
  }, [
    settings.invoiceTemplate,
    settings.receiptTemplate,
    settings.defaultPrintFormat,
    settings.pharmacyName,
    settings.pharmacyAddress,
    settings.pharmacyPhone,
    settings.licenseNumber,
  ]);

  const handleClearAllInputs = () => {
    setInvoiceTemplate((prev) => ({
      ...BLANK_TEMPLATE,
      enabled: prev.enabled,
    }));
    addNotification('Official invoice print template fields cleared', 'info');
  };

  const handleClearAllThermal = () => {
    setReceiptTemplate((prev) => ({
      ...prev,
      header: {
        pharmacyName: '',
        address: '',
        phone: '',
        licenseNumber: '',
        tagline: '',
        headerNote: '',
      },
      footer: {
        thankYouMessage: '',
        policyNote: '',
        recoveryGreeting: '',
        customNote: '',
      },
    }));
    addNotification('Thermal receipt fields cleared', 'info');
  };

  const handleFillDefaultsThermal = () => {
    setReceiptTemplate((prev) => ({
      ...prev,
      header: {
        pharmacyName: settings.pharmacyName || '',
        address: settings.pharmacyAddress || '',
        phone: settings.pharmacyPhone || '',
        licenseNumber: settings.licenseNumber || '',
        tagline: prev.header?.tagline || '',
        headerNote: prev.header?.headerNote || '',
      },
      footer: {
        thankYouMessage: settings.pharmacyName ? `Thank you for trusting ${settings.pharmacyName}!` : 'Thank you for trusting our pharmacy!',
        policyNote: 'Medications cannot be exchanged or returned per MOPH regulations.',
        recoveryGreeting: 'Health & Recovery / بالشفاء العاجل',
        customNote: prev.footer?.customNote || '',
      },
      options: {
        ...prev.options,
        paperWidth: '80mm',
        showCashier: true,
        showCustomer: true,
        showExchangeRate: true,
        showItemCode: true,
        showPaymentBreakdown: true,
        showLoyaltyPoints: true,
        showLicenseNumber: true,
      },
    }));
    addNotification('Loaded pharmacy defaults into thermal receipt format', 'info');
  };

  const handleChangeEnglish = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInvoiceTemplate((prev) => ({
      ...prev,
      headerEnglish: { ...prev.headerEnglish, [name]: value },
    }));
  };

  const handleChangeArabic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInvoiceTemplate((prev) => ({
      ...prev,
      headerArabic: { ...prev.headerArabic, [name]: value },
    }));
  };

  const handleChangeCenter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInvoiceTemplate((prev) => ({
      ...prev,
      centerInfo: { ...prev.centerInfo, [name]: value },
    }));
  };

  const handleChangeThermalHeader = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setReceiptTemplate((prev) => ({
      ...prev,
      header: { ...prev.header, [name]: value },
    }));
  };

  const handleChangeThermalFooter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setReceiptTemplate((prev) => ({
      ...prev,
      footer: { ...prev.footer, [name]: value },
    }));
  };

  const handleToggleThermalOption = (key: keyof ReceiptTemplate['options']) => {
    setReceiptTemplate((prev) => ({
      ...prev,
      options: { ...prev.options, [key]: !prev.options[key] },
    }));
  };

  const handleToggle = () => {
    setInvoiceTemplate((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleToggleThermal = () => {
    setReceiptTemplate((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateSettings({
      invoiceTemplate,
      receiptTemplate,
      defaultPrintFormat,
    });
    try {
      localStorage.setItem('pos_print_format', defaultPrintFormat);
    } catch {}
    addNotification('Sale Settings saved successfully', 'success');
    setTimeout(() => setIsSaving(false), 800);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-teal-600" /> Sale Settings
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure settings related to the point of sale, receipts, and invoice printing templates.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center space-x-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50 cursor-pointer shadow-xs"
        >
          {isSaving ? <CheckCircle2 className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
          <span>{isSaving ? 'Saved!' : 'Save Settings'}</span>
        </button>
      </div>
      
      <div className="p-5 space-y-8">
        {/* Default POS Checkout Print Action */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Default POS Checkout Print Action
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Choose which format is triggered by default when clicking the "Print" button on checkout.
            </div>
          </div>
          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 p-1 bg-white dark:bg-slate-800 shadow-2xs">
            <button
              type="button"
              onClick={() => setDefaultPrintFormat('receipt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all ${
                defaultPrintFormat === 'receipt'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Receipt Format (Thermal)</span>
            </button>
            <button
              type="button"
              onClick={() => setDefaultPrintFormat('invoice')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all ${
                defaultPrintFormat === 'invoice'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Official Invoice (A4)</span>
            </button>
          </div>
        </div>

        {/* Section 1: Official Invoice Print Template */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Printer className="h-4 w-4 text-teal-600 dark:text-teal-400" /> Official Invoice Print Template
            </h3>
            <button
              type="button"
              onClick={handleClearAllInputs}
              className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer shadow-2xs transition"
            >
              Clear All Fields (Keep Blank)
            </button>
          </div>
          
          <div className="flex items-center space-x-3 mb-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={invoiceTemplate.enabled}
                onChange={handleToggle}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                Use official invoice template for printing receipts
              </span>
            </label>
          </div>
          
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 p-5 border border-teal-200/80 dark:border-teal-900/50 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 shadow-2xs transition-all duration-200 ${!invoiceTemplate.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            
            {/* English Header */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Pharmacy Name</label>
                <input type="text" name="pharmacyName" value={invoiceTemplate.headerEnglish.pharmacyName || ''} onChange={handleChangeEnglish} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Pharmacist</label>
                <input type="text" name="pharmacistName" value={invoiceTemplate.headerEnglish.pharmacistName || ''} onChange={handleChangeEnglish} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Amended Degree No</label>
                <input type="text" name="amendedDegreeNo" value={invoiceTemplate.headerEnglish.amendedDegreeNo || ''} onChange={handleChangeEnglish} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Order Reg No</label>
                <input type="text" name="orderRegNo" value={invoiceTemplate.headerEnglish.orderRegNo || ''} onChange={handleChangeEnglish} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">CNSS no.</label>
                <input type="text" name="cnssNo" value={invoiceTemplate.headerEnglish.cnssNo || ''} onChange={handleChangeEnglish} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Address</label>
                <input type="text" name="address" value={invoiceTemplate.headerEnglish.address || ''} onChange={handleChangeEnglish} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tel</label>
                <input type="text" name="tel" value={invoiceTemplate.headerEnglish.tel || ''} onChange={handleChangeEnglish} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
            </div>

            {/* Center Info */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Vat#</label>
                <input type="text" name="vatNo" value={invoiceTemplate.centerInfo.vatNo || ''} onChange={handleChangeCenter} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">No</label>
                <input type="text" name="no" value={invoiceTemplate.centerInfo.no || ''} onChange={handleChangeCenter} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
            </div>

            {/* Arabic Header */}
            <div className="space-y-3" dir="rtl">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">صيدلية</label>
                <input type="text" name="pharmacyName" value={invoiceTemplate.headerArabic.pharmacyName || ''} onChange={handleChangeArabic} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">الصيدلي</label>
                <input type="text" name="pharmacistName" value={invoiceTemplate.headerArabic.pharmacistName || ''} onChange={handleChangeArabic} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">إجازة رقم</label>
                <input type="text" name="amendedDegreeNo" value={invoiceTemplate.headerArabic.amendedDegreeNo || ''} onChange={handleChangeArabic} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">رقم التسجيل</label>
                <input type="text" name="orderRegNo" value={invoiceTemplate.headerArabic.orderRegNo || ''} onChange={handleChangeArabic} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">رقم الضمان</label>
                <input type="text" name="cnssNo" value={invoiceTemplate.headerArabic.cnssNo || ''} onChange={handleChangeArabic} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">العنوان</label>
                <input type="text" name="address" value={invoiceTemplate.headerArabic.address || ''} onChange={handleChangeArabic} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">تلفون</label>
                <input type="text" name="tel" value={invoiceTemplate.headerArabic.tel || ''} onChange={handleChangeArabic} className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all" />
              </div>
            </div>

          </div>
        </div>

        {/* Section 2: Receipt Format (Thermal) Print Template */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-teal-600 dark:text-teal-400" /> Receipt Format (Thermal) Print Template
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300 font-semibold">
                Thermal 80mm / 58mm POS Slip
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFillDefaultsThermal}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-900 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-900 cursor-pointer shadow-2xs transition"
              >
                Use Pharmacy Defaults
              </button>
              <button
                type="button"
                onClick={handleClearAllThermal}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer shadow-2xs transition"
              >
                Clear Fields (Keep Blank)
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3 mb-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={receiptTemplate.enabled}
                onChange={handleToggleThermal}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                Customize thermal receipt header, footer notes & slip options
              </span>
            </label>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 p-5 border border-teal-200/80 dark:border-teal-900/50 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 shadow-2xs transition-all duration-200 ${!receiptTemplate.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            
            {/* Column 1: Header Information */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 pb-1 border-b border-teal-200/60 dark:border-teal-800/40">
                Header Information
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Pharmacy Name
                </label>
                <input
                  type="text"
                  name="pharmacyName"
                  value={receiptTemplate.header.pharmacyName || ''}
                  onChange={handleChangeThermalHeader}
                  className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Tagline / Subheading
                </label>
                <input
                  type="text"
                  name="tagline"
                  value={receiptTemplate.header.tagline || ''}
                  onChange={handleChangeThermalHeader}
                  className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={receiptTemplate.header.address || ''}
                  onChange={handleChangeThermalHeader}
                  className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Telephone / Hotline
                </label>
                <input
                  type="text"
                  name="phone"
                  value={receiptTemplate.header.phone || ''}
                  onChange={handleChangeThermalHeader}
                  className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Ministry License No. (MoPH)
                </label>
                <input
                  type="text"
                  name="licenseNumber"
                  value={receiptTemplate.header.licenseNumber || ''}
                  onChange={handleChangeThermalHeader}
                  className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Announcement / Header Note
                </label>
                <input
                  type="text"
                  name="headerNote"
                  value={receiptTemplate.header.headerNote || ''}
                  onChange={handleChangeThermalHeader}
                  className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all"
                />
              </div>
            </div>

            {/* Column 2: Receipt Options & Layout */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 pb-1 border-b border-teal-200/60 dark:border-teal-800/40">
                Slip Options & Layout
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Thermal Paper Width
                </label>
                <select
                  value={receiptTemplate.options.paperWidth}
                  onChange={(e) =>
                    setReceiptTemplate((prev) => ({
                      ...prev,
                      options: { ...prev.options, paperWidth: e.target.value as '80mm' | '58mm' },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all cursor-pointer"
                >
                  <option value="80mm">80mm Standard POS Slip (Default)</option>
                  <option value="58mm">58mm Compact POS Slip</option>
                </select>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptTemplate.options.showCashier}
                    onChange={() => handleToggleThermalOption('showCashier')}
                    className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 dark:border-slate-600"
                  />
                  <span>Show Cashier Name</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptTemplate.options.showCustomer}
                    onChange={() => handleToggleThermalOption('showCustomer')}
                    className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 dark:border-slate-600"
                  />
                  <span>Show Customer Name</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptTemplate.options.showExchangeRate}
                    onChange={() => handleToggleThermalOption('showExchangeRate')}
                    className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 dark:border-slate-600"
                  />
                  <span>Show Applied Exchange Rate (1$ = L.L.)</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptTemplate.options.showItemCode}
                    onChange={() => handleToggleThermalOption('showItemCode')}
                    className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 dark:border-slate-600"
                  />
                  <span>Show Item Barcode / Code</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptTemplate.options.showPaymentBreakdown}
                    onChange={() => handleToggleThermalOption('showPaymentBreakdown')}
                    className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 dark:border-slate-600"
                  />
                  <span>Show Cash & Change Breakdown</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptTemplate.options.showLoyaltyPoints}
                    onChange={() => handleToggleThermalOption('showLoyaltyPoints')}
                    className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 dark:border-slate-600"
                  />
                  <span>Show Patient Loyalty Points Rewards</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptTemplate.options.showLicenseNumber}
                    onChange={() => handleToggleThermalOption('showLicenseNumber')}
                    className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 dark:border-slate-600"
                  />
                  <span>Show Ministry License Line</span>
                </label>
              </div>
            </div>

            {/* Column 3: Footer & Policy Notes */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 pb-1 border-b border-teal-200/60 dark:border-teal-800/40">
                Footer & Policy Notes
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Thank You Message
                </label>
                <input
                  type="text"
                  name="thankYouMessage"
                  value={receiptTemplate.footer.thankYouMessage || ''}
                  onChange={handleChangeThermalFooter}
                  className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Return Policy Note
                </label>
                <input
                  type="text"
                  name="policyNote"
                  value={receiptTemplate.footer.policyNote || ''}
                  onChange={handleChangeThermalFooter}
                  className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Health & Recovery Blessing
                </label>
                <input
                  type="text"
                  name="recoveryGreeting"
                  value={receiptTemplate.footer.recoveryGreeting || ''}
                  onChange={handleChangeThermalFooter}
                  className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Custom Footer / Social / Hotline
                </label>
                <input
                  type="text"
                  name="customNote"
                  value={receiptTemplate.footer.customNote || ''}
                  onChange={handleChangeThermalFooter}
                  className="w-full rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 transition-all"
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

