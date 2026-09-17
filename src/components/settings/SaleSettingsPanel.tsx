import React, { useState, useEffect } from 'react';
import { ShoppingCart, Printer, Save, CheckCircle2 } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';

export const SaleSettingsPanel: React.FC = () => {
  const { settings, updateSettings, addNotification } = usePharmacy();
  const [isSaving, setIsSaving] = useState(false);

  const [invoiceTemplate, setInvoiceTemplate] = useState(
    settings.invoiceTemplate || {
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
        address: '',
        tel: '',
      },
      centerInfo: {
        vatNo: '',
        no: '',
      },
    }
  );

  useEffect(() => {
    if (settings.invoiceTemplate) {
      setInvoiceTemplate(settings.invoiceTemplate);
    }
  }, [settings.invoiceTemplate]);

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
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Printer className="h-4 w-4 text-slate-500" /> Official Invoice Print Template
          </h3>
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
          
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 p-5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 transition-opacity ${!invoiceTemplate.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            
            {/* English Header */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">English Info (Left)</h4>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Pharmacy Name</label>
                <input type="text" name="pharmacyName" value={invoiceTemplate.headerEnglish.pharmacyName} onChange={handleChangeEnglish} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" placeholder="e.g. Amar Pharmacy" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Pharmacist</label>
                <input type="text" name="pharmacistName" value={invoiceTemplate.headerEnglish.pharmacistName} onChange={handleChangeEnglish} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" placeholder="Pharmacist Name" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Amended Degree No</label>
                <input type="text" name="amendedDegreeNo" value={invoiceTemplate.headerEnglish.amendedDegreeNo} onChange={handleChangeEnglish} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Order Reg No</label>
                <input type="text" name="orderRegNo" value={invoiceTemplate.headerEnglish.orderRegNo} onChange={handleChangeEnglish} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">CNSS no.</label>
                <input type="text" name="cnssNo" value={invoiceTemplate.headerEnglish.cnssNo} onChange={handleChangeEnglish} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Address</label>
                <input type="text" name="address" value={invoiceTemplate.headerEnglish.address} onChange={handleChangeEnglish} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tel</label>
                <input type="text" name="tel" value={invoiceTemplate.headerEnglish.tel} onChange={handleChangeEnglish} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
            </div>

            {/* Center Info */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Center Info</h4>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Vat#</label>
                <input type="text" name="vatNo" value={invoiceTemplate.centerInfo.vatNo} onChange={handleChangeCenter} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">No</label>
                <input type="text" name="no" value={invoiceTemplate.centerInfo.no} onChange={handleChangeCenter} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
            </div>

            {/* Arabic Header */}
            <div className="space-y-3" dir="rtl">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2" dir="ltr">Arabic Info (Right)</h4>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Pharmacy Name (صيدلية)</label>
                <input type="text" name="pharmacyName" value={invoiceTemplate.headerArabic.pharmacyName} onChange={handleChangeArabic} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Pharmacist (الصيدلي)</label>
                <input type="text" name="pharmacistName" value={invoiceTemplate.headerArabic.pharmacistName} onChange={handleChangeArabic} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Degree No (إجازة رقم)</label>
                <input type="text" name="amendedDegreeNo" value={invoiceTemplate.headerArabic.amendedDegreeNo} onChange={handleChangeArabic} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Reg No (رقم التسجيل)</label>
                <input type="text" name="orderRegNo" value={invoiceTemplate.headerArabic.orderRegNo} onChange={handleChangeArabic} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Address (العنوان)</label>
                <input type="text" name="address" value={invoiceTemplate.headerArabic.address} onChange={handleChangeArabic} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tel (تلفون)</label>
                <input type="text" name="tel" value={invoiceTemplate.headerArabic.tel} onChange={handleChangeArabic} className="w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
