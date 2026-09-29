import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import {
  SectionKey,
  exportSectionCsv,
  downloadSectionCsv,
} from '../../utils/sectionCsv';

const SECTION_LABELS: { key: SectionKey; label: string; recordCount: (ctx: ReturnType<typeof usePharmacy>) => number }[] = [
  { key: 'sales', label: 'Sales / Checkout', recordCount: (ctx) => ctx.sales.length },
  { key: 'purchases', label: 'Purchase Invoices', recordCount: (ctx) => ctx.purchases.length },
  { key: 'purchaseReturns', label: 'Purchase Returns', recordCount: (ctx) => ctx.purchaseReturns.length },
  { key: 'saleReturns', label: 'Sale Returns / Refunds', recordCount: (ctx) => ctx.saleReturns.length },
  { key: 'supplierPayments', label: 'Supplier Payments', recordCount: (ctx) => ctx.supplierPayments.length },
  { key: 'customerPayments', label: 'Customer Payments', recordCount: (ctx) => ctx.customerPayments.length },
  { key: 'expenses', label: 'Expenses', recordCount: (ctx) => ctx.expenses.length },
];

export const SectionCSVPanel: React.FC = () => {
  const pharmacy = usePharmacy();
  const { importSectionFromCSV, exportSectionCSV, addNotification } = pharmacy;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingSection, setPendingSection] = useState<SectionKey | null>(null);
  const [fileName, setFileName] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    section?: SectionKey;
    success?: boolean;
    message?: string;
    errors?: string[];
  } | null>(null);

  const handleExport = (section: SectionKey) => {
    const csv = exportSectionCSV(section);
    if (!csv.trim()) {
      addNotification('Export Empty', `No ${SECTION_LABELS.find((s) => s.key === section)?.label} records to export.`, 'system', 'info');
      return;
    }
    downloadSectionCsv(csv, section);
  };

  const handlePickFile = (section: SectionKey) => {
    setPendingSection(section);
    setResult(null);
    setFileName('');
    setCsvContent('');
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingSection) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      let text = evt.target?.result as string;
      if (text.includes('\uFFFD')) {
        const fallbackReader = new FileReader();
        fallbackReader.onload = (evt2) => {
          const fallbackText = evt2.target?.result as string;
          setCsvContent(fallbackText.includes('\uFFFD') ? text : fallbackText);
        };
        fallbackReader.readAsText(file, 'windows-1252');
        return;
      }
      setCsvContent(text);
    };
    reader.readAsText(file, 'utf-8');
  };

  const confirmAndImport = async () => {
    if (!pendingSection || !csvContent.trim()) return;
    setImporting(true);
    try {
      const res = importSectionFromCSV(pendingSection, csvContent);
      setResult({
        section: pendingSection,
        success: res.success,
        message: res.success
          ? `Successfully imported ${res.importedCount} record${res.importedCount === 1 ? '' : 's'}.`
            + (res.skippedCount > 0
              ? ` ${res.skippedCount} already existed and were not older, so they were left unchanged.`
              : '')
          : 'Import failed — no records were added.',
        errors: res.errors,
      });
    } finally {
      setImporting(false);
      setPendingSection(null);
      setFileName('');
      setCsvContent('');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        accept=".csv,text/csv"
        className="hidden"
      />
      <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-teal-600" /> Per-Section CSV Import / Export
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Export or import one data section at a time as a spreadsheet (.csv). Import merges by record id — safe to re-run.
          </p>
        </div>
        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
          Section Tools
        </span>
      </div>

      <div className="p-6">
        {fileName && csvContent && (
          <div className="mb-4 p-3.5 rounded-lg border border-teal-200 bg-teal-50/70 dark:border-teal-800 dark:bg-teal-900/20">
            <div className="flex items-start gap-2.5 text-xs text-teal-800 dark:text-teal-200">
              <AlertCircle className="h-4 w-4 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  Ready to import <span className="font-mono">{fileName}</span> into{' '}
                  <strong>{SECTION_LABELS.find((s) => s.key === pendingSection)?.label}</strong>.
                </p>
                <p className="text-teal-700 dark:text-teal-300 mt-0.5">
                  Existing records with the same id will be updated; new ids are appended. This cannot be undone with the imported file.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setFileName(''); setCsvContent(''); }}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAndImport}
                disabled={importing}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 px-4 py-1.5 text-xs font-semibold text-white cursor-pointer"
              >
                {importing ? (
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {importing ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        )}

        {result && result.success && (
          <div className="mb-4 p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5 text-emerald-800 dark:text-emerald-200 text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{result.message}</p>
              {result.errors && result.errors.length > 0 && (
                <ul className="mt-1.5 list-disc pl-5 space-y-0.5 text-[11px]">
                  {result.errors.slice(0, 15).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {result && !result.success && (
          <div className="mb-4 p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-rose-800 dark:text-rose-200 text-xs">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{result.message}</p>
              {result.errors && result.errors.length > 0 && (
                <ul className="mt-1.5 list-disc pl-5 space-y-0.5 text-[11px]">
                  {result.errors.slice(0, 15).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-3 font-semibold">Section</th>
                <th className="py-2 pr-3 font-semibold text-right">Records</th>
                <th className="py-2 pl-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {SECTION_LABELS.map(({ key, label, recordCount }) => (
                <tr
                  key={key}
                  className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <td className="py-2.5 pr-3 font-semibold text-slate-700 dark:text-slate-200">{label}</td>
                  <td className="py-2.5 pr-3 text-right font-mono text-slate-500 dark:text-slate-400">{recordCount(pharmacy)}</td>
                  <td className="py-2.5 pl-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleExport(key)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" /> Export CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePickFile(key)}
                        className="flex items-center gap-1.5 rounded-lg bg-slate-800 dark:bg-slate-600 hover:bg-slate-900 dark:hover:bg-slate-500 px-3 py-1.5 text-[11px] font-semibold text-white cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5" /> Import CSV
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11px] text-slate-400 dark:text-slate-500">
          Import header must be the first row. Complex fields (sale items, purchase items, payment allocations) are JSON strings in their column.
        </p>
      </div>
    </div>
  );
};