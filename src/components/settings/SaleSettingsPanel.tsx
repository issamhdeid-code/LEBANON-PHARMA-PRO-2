import React, { useState, useEffect } from 'react';
import { ShoppingCart, Printer, Save, CheckCircle2 } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';

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

  const [invoiceTemplate, setInvoiceTemplate] = useState(getCleanTemplate);

  useEffect(() => {
    setInvoiceTemplate(getCleanTemplate());
  }, [settings.invoiceTemplate]);

  const handleClearAllInputs = () => {
    setInvoiceTemplate((prev) => ({
      ...BLANK_TEMPLATE,
      enabled: prev.enabled,
    }));
    addNotification('Official invoice print template fields cleared', 'info');
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

  const handleToggle = () => {
    setInvoiceTemplate((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateSettings({ invoiceTemplate });
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
            Configure settings related to the point of sale and transactions.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center space-x-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
        >
          {isSaving ? <CheckCircle2 className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
          <span>{isSaving ? 'Saved!' : 'Save Settings'}</span>
        </button>
      </div>
      
      <div className="p-5 space-y-6">
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
      </div>
    </div>
  );
};
