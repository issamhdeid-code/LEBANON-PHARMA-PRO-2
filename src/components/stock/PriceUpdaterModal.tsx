import React, { useState } from 'react';
import { Tag, Check, X, Search, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Product } from '../../types/pharmacy';

import { DesktopWindow } from '../common/DesktopWindow';
import { formatLBPValue } from '../../utils/priceUtils';

interface PriceUpdaterModalProps {
  initialCode?: string;
  onClose: () => void;
  section?: string;
}

export const PriceUpdaterModal: React.FC<PriceUpdaterModalProps> = ({ initialCode = '', onClose, section }) => {
  const { products, updateDrugPriceByCode, exchangeRate, formatLBP, formatUSD } = usePharmacy();

  const [code, setCode] = useState(initialCode);
  const [targetProduct, setTargetProduct] = useState<Product | null>(() => {
    if (initialCode) {
      return products.find((p) => p.code.toUpperCase() === initialCode.toUpperCase()) || null;
    }
    return null;
  });

  const [newLBP, setNewLBP] = useState<string>(targetProduct ? targetProduct.priceLBP.toString() : '');
  const [newUSD, setNewUSD] = useState<string>(targetProduct ? targetProduct.priceUSD.toString() : '');
  const [resultMessage, setResultMessage] = useState<{ success: boolean; text: string } | null>(null);

  // When code changes, look up product
  const handleCodeSearch = (inputCode: string) => {
    setCode(inputCode);
    const found = products.find((p) => p.code.toUpperCase() === inputCode.trim().toUpperCase());
    if (found) {
      setTargetProduct(found);
      setNewLBP(found.priceLBP.toString());
      setNewUSD(found.priceUSD.toString());
      setResultMessage(null);
    } else {
      setTargetProduct(null);
    }
  };

  // Convert LBP to USD live
  const handleLBPChange = (val: string) => {
    setNewLBP(val);
    const num = parseFloat(val.replace(/[^\d.]/g, ''));
    if (!isNaN(num) && num >= 0) {
      setNewUSD((num / exchangeRate).toFixed(2));
    }
  };

  // Convert USD to LBP live
  const handleUSDChange = (val: string) => {
    setNewUSD(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setNewLBP(Math.round(num * exchangeRate).toString());
    }
  };

  const handleApplyUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProduct) {
      setResultMessage({ success: false, text: `No medication found with code "${code}".` });
      return;
    }

    const priceLBPNum = parseFloat(newLBP.replace(/[^\d.]/g, ''));
    const priceUSDNum = parseFloat(newUSD);

    if (isNaN(priceLBPNum) || priceLBPNum <= 0) {
      setResultMessage({ success: false, text: 'Please enter a valid selling price.' });
      return;
    }

    const res = updateDrugPriceByCode(targetProduct.code, priceLBPNum, priceUSDNum);
    setResultMessage({ success: res.success, text: res.message });

    if (res.success) {
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  return (
    <DesktopWindow title="Update Drug Price by Code" isOpen={true} section={section} onClose={onClose} width="480px" height="auto">
      <form onSubmit={handleApplyUpdate} className="p-6 space-y-4 text-xs flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
          {resultMessage && (
            <div
              className={`flex items-center rounded-xl p-3 text-xs ${
                resultMessage.success
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              {resultMessage.success ? (
                <CheckCircle2 className="mr-2 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mr-2 h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{resultMessage.text}</span>
            </div>
          )}

          {/* Drug Code Lookup Field */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Drug Code (Code de Médicament / Barcode)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={code}
                onChange={(e) => handleCodeSearch(e.target.value)}
                placeholder="e.g. PAN500, AUG1G, LIP20..."
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm font-mono font-bold text-slate-800 uppercase focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                autoFocus
              />
            </div>
          </div>

          {/* Drug Details Card */}
          {targetProduct ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {targetProduct.name}
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                  {targetProduct.category.toUpperCase()}
                </span>
              </div>
              <div className="mt-1 text-slate-600 dark:text-slate-400">
                {targetProduct.ingredients} • {targetProduct.dosage}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                <span>Current Price:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formatLBPValue(targetProduct.priceLBP)} L.L. (${targetProduct.priceUSD.toFixed(2)})
                </span>
              </div>
            </div>
          ) : code.trim() ? (
            <div className="text-center py-2 text-slate-400">
              No registered drug with code "{code}". Type a valid code or browse the Stock list.
            </div>
          ) : null}

          {/* Price In LBP and USD inputs */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Price in LBP (L.L.)
              </label>
              <input
                type="text"
                value={newLBP}
                onChange={(e) => handleLBPChange(e.target.value)}
                placeholder="e.g. 350000"
                disabled={!targetProduct}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-hidden disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/40"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Price in USD ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={newUSD}
                onChange={(e) => handleUSDChange(e.target.value)}
                placeholder="e.g. 3.91"
                disabled={!targetProduct}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-hidden disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/40"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            * Converted automatically based on current rate (1$ = {formatLBPValue(exchangeRate)} L.L.). Price change synchronizes immediately across connected PCs and updates sale totals.
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!targetProduct}
              className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              <span>Apply Price Update</span>
            </button>
          </div>
        </form>
    </DesktopWindow>
  );
};
