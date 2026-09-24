import React, { useState } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { usePharmacyData } from '../../context/PharmacyContext';
import { DesktopWindow } from '../common/DesktopWindow';

interface CSVImportModalProps {
  onClose: () => void;
  section?: string;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({ onClose, section }) => {
  const { importProductsFromCSV, exchangeRate } = usePharmacyData();

  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState<{
    success?: boolean;
    message?: string;
    errors?: string[];
    count?: number;
  } | null>(null);
  const [enrichAfterImport, setEnrichAfterImport] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      // Excel on Windows commonly saves CSV as Windows-1252 rather than UTF-8.
      // Detect the U+FFFD replacement char produced by a wrong decode and re-read.
      if (text.includes('\uFFFD')) {
        const fallbackReader = new FileReader();
        fallbackReader.onload = (evt2) => {
          const fallbackText = evt2.target?.result as string;
          setCsvContent(fallbackText.includes('\uFFFD') ? text : fallbackText);
          setStatus(null);
        };
        fallbackReader.readAsText(file, 'windows-1252');
        return;
      }
      setCsvContent(text);
      setStatus(null);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleProcessImport = () => {
    if (!csvContent.trim()) {
      setStatus({ success: false, message: 'Please upload a CSV file first.' });
      return;
    }

    const res = importProductsFromCSV(csvContent, { enrichAfterImport });
    if (res.success) {
      const skippedNote = res.skippedLowerPricesCount && res.skippedLowerPricesCount > 0
        ? ` (${res.skippedLowerPricesCount} price decrease${res.skippedLowerPricesCount > 1 ? 's were' : ' was'} skipped to preserve higher selling price, marked with red indicator)`
        : '';
      setStatus({
        success: true,
        message: `Successfully processed ${res.importedCount} medications!${skippedNote}`,
        count: res.importedCount,
        errors: res.errors,
      });
      // Window stays open per user preference so results and content can be inspected
    } else {
      setStatus({
        success: false,
        message: 'Import encountered errors.',
        errors: res.errors,
      });
    }
  };

  return (
    <DesktopWindow title="Bulk Inventory CSV Import" isOpen={true} section={section} onClose={onClose} width="680px" height="auto">
      <div className="w-full flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Content */}
        <div className="p-6 space-y-4 text-xs flex-1 flex flex-col justify-between">
          {status && (
            <div
              className={`rounded-xl p-3 text-xs ${
                status.success
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center font-bold">
                {status.success ? (
                  <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="mr-2 h-4 w-4 text-rose-600" />
                )}
                <span>{status.message}</span>
              </div>
              {status.errors && status.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 space-y-0.5 text-[11px]">
                  {status.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Upload Box */}
          <div className="grid grid-cols-1 gap-3">
            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-4 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/20 dark:border-slate-700 dark:bg-slate-800/30">
              <Upload className="h-6 w-6 text-slate-400 mb-1" />
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {fileName ? fileName : 'Choose CSV file'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">Click or drag & drop</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <label className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
              <input
                type="checkbox"
                checked={enrichAfterImport}
                onChange={(e) => setEnrichAfterImport(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <span className="font-bold">Enrich scientific monographs online after import</span>
              <span className="text-[10px] text-slate-400">(network): fetch indications, contraindications, side effects & dosing for new drugs</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {status?.success ? 'Close' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleProcessImport}
              disabled={!csvContent.trim()}
              className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40"
            >
              <Upload className="h-4 w-4" />
              <span>Import to Inventory</span>
            </button>
          </div>
        </div>
      </div>
    </DesktopWindow>
  );
};
