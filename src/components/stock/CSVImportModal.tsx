import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Sparkles
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { DesktopWindow } from '../common/DesktopWindow';
import { formatLBPValue } from '../../utils/priceUtils';

interface CSVImportModalProps {
  onClose: () => void;
  section?: string;
}

const SAMPLE_CSV_CONTENT = `code, Name, Ingredients, Dosage, Presentation, Form, Price in LBP, Agent, Pharmacist Margin
PAN500, Panadol Extra, Paracetamol + Caffeine, 500mg/65mg, 24 Film-Coated Tablets, Tablet, 315000, Mersaco Sal, 18
AUG1G, Augmentin 1g, Amoxicillin + Clavulanate, 1g, 14 Film-Coated Tablets, Tablet, 895000, Omnipharma S.A.L., 20
LIP20, Lipitor 20mg, Atorvastatin Calcium, 20mg, 30 Tablets, Tablet, 1253000, Khalil Fattal & Fils, 20
CON5, Concor 5mg, Bisoprolol Fumarate, 5mg, 30 Tablets, Tablet, 537000, Droguerie de l'Union, 19
NEX40, Nexium 40mg, Esomeprazole Magnesium, 40mg, 28 Tablets, Tablet, 1074000, Mersaco Sal, 20
VEN100, Ventolin Evohaler, Salbutamol, 100mcg/puff, 200 Doses, Inhaler, 447500, Mersaco Sal, 18
CLAR500, Klacid 500mg, Clarithromycin, 500mg, 14 Tablets, Tablet, 984500, Omnipharma S.A.L., 20
PROF400, Brufen 400mg, Ibuprofen, 400mg, 30 Tablets, Tablet, 340000, Khalil Fattal & Fils, 18`;

export const CSVImportModal: React.FC<CSVImportModalProps> = ({ onClose, section }) => {
  const { importProductsFromCSV, exchangeRate } = usePharmacy();

  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState<{
    success?: boolean;
    message?: string;
    errors?: string[];
    count?: number;
  } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvContent(text);
      setStatus(null);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setCsvContent(SAMPLE_CSV_CONTENT);
    setFileName('sample_lebanon_drugs.csv');
    setStatus(null);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'lebanon_pharmacy_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProcessImport = () => {
    if (!csvContent.trim()) {
      setStatus({ success: false, message: 'Please upload a CSV file or paste data below.' });
      return;
    }

    const res = importProductsFromCSV(csvContent);
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
          {/* Headline Requirements Banner (Requirement 19) */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
            <span className="font-bold block mb-1">
              Required CSV Header Format (Requirement 19):
            </span>
            <code className="block rounded bg-white/80 p-2 font-mono text-[11px] font-semibold text-blue-800 dark:bg-slate-900 dark:text-blue-300 overflow-x-auto">
              code, Name, Ingredients, Dosage, Presentation, Form, Price in LBP, Agent, Pharmacist Margin
            </code>
            <p className="mt-1.5 text-[11px] text-blue-700 dark:text-blue-300">
              * All medicines imported will have category automatically set to <span className="font-bold">drug</span>, default stock quantity set to <span className="font-bold">0</span> with blank expiry, and USD prices calculated via current rate ($1 = {formatLBPValue(exchangeRate)} L.L.).
            </p>
            <p className="mt-1 text-[11px] text-blue-700 dark:text-blue-300">
              * <span className="font-semibold">Price Safeguard:</span> If a new price in the CSV is lower than the existing price, the price update is skipped to preserve your current inventory value, while displaying the decrease indicator (red arrow and % change).
            </p>
            <div className="mt-2 flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded border border-emerald-200 dark:border-emerald-800">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>
                Automatic Online Scientific Monograph: Active ingredients are automatically queried online to populate indications, contraindications, side effects, and in-stock generic bio-equivalents.
              </span>
            </div>
          </div>

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

          {/* Upload Box & Sample Action */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="flex flex-col justify-center space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Quick Actions & Template
              </span>
              <button
                type="button"
                onClick={handleLoadSample}
                className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Load Demo Lebanese CSV</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Download className="h-3.5 w-3.5 text-blue-500" />
                <span>Download Sample .CSV Template</span>
              </button>
            </div>
          </div>

          {/* Raw CSV Text Preview / Editor */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              CSV Content Preview / Manual Paste
            </label>
            <textarea
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Paste comma-separated rows here..."
              rows={7}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
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
