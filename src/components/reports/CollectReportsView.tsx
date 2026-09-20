import React, { useState } from 'react';
import {
  FileText,
  ChevronDown,
  Layers,
  Sparkles,
  Info,
  CalendarCheck,
  PackageCheck,
  CheckCircle2
} from 'lucide-react';
import { DailySalesItemsReport } from './DailySalesItemsReport';
import { DailyCashierSummaryReport } from './DailyCashierSummaryReport';
import { CategoryProfitMarginReport } from './CategoryProfitMarginReport';
import { ControlledDispensationReport } from './ControlledDispensationReport';
import { CustomerDebtAgingReport } from './CustomerDebtAgingReport';

export type CollectReportType =
  | 'daily_sales_items'
  | 'daily_cashier_summary'
  | 'category_profit_margin'
  | 'controlled_dispensation'
  | 'customer_debt_aging';

interface ReportOptionMeta {
  id: CollectReportType;
  title: string;
  description: string;
  badge?: string;
  isAvailable: boolean;
}

const REPORT_OPTIONS: ReportOptionMeta[] = [
  {
    id: 'daily_sales_items',
    title: 'Daily Sales Items',
    description:
      'Detailed item-by-item dispensing audit for the selected day, capturing unit prices, batch numbers, expiry dates, discounts, gross margin profits, dispensers, and patients in dual currency ($ & L.L.).',
    badge: 'Operational Log',
    isAvailable: true,
  },
  {
    id: 'daily_cashier_summary',
    title: 'Daily Cashier & Register Summary',
    description:
      'Audit drawer reconciliations, breakdown of collections by dispenser across cash LBP, cash USD, card, and credit debt accounts with variance analysis.',
    badge: 'Cash Register Audit',
    isAvailable: true,
  },
  {
    id: 'category_profit_margin',
    title: 'Sales by Category & Margin Analysis',
    description:
      'Profitability breakdown across Drugs, Vitamins, Cosmetics, and Para-pharmaceutical items with weighted average margins and top contributors.',
    badge: 'Margin Analysis',
    isAvailable: true,
  },
  {
    id: 'controlled_dispensation',
    title: 'Prescriptions & Controlled Drugs Dispensing Log',
    description:
      'Official regulatory register for scheduled psychotropics, narcotics, and restricted antibiotics requiring prescription verification and doctor notes.',
    badge: 'MOPH Regulatory',
    isAvailable: true,
  },
  {
    id: 'customer_debt_aging',
    title: 'Customer Credit & Debt Aging Report',
    description:
      'Comprehensive ledger of unpaid patient accounts ("Daftar el Zabayen"), partial payments, and overdue balances categorized by aging brackets.',
    badge: 'Receivables Ledger',
    isAvailable: true,
  },
];

export const CollectReportsView: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<CollectReportType>('daily_sales_items');

  const activeOption = REPORT_OPTIONS.find((r) => r.id === selectedReport) || REPORT_OPTIONS[0];

  return (
    <div className="flex flex-col space-y-3">
      {/* Top Report Selector Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[300px]">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span>Select Report to Collect:</span>
              <span className="ml-1.5 rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800">
                5 Active Reports
              </span>
            </label>
            <div className="relative max-w-lg">
              <select
                value={selectedReport}
                onChange={(e) => setSelectedReport(e.target.value as CollectReportType)}
                className="w-full appearance-none rounded-lg border border-teal-300/80 bg-white py-2 pl-3.5 pr-10 text-xs font-bold text-slate-900 shadow-xs hover:border-teal-500 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-teal-700/80 dark:bg-slate-800 dark:text-slate-100 cursor-pointer transition-all"
              >
                {REPORT_OPTIONS.map((opt) => (
                  <option
                    key={opt.id}
                    value={opt.id}
                    className="py-1 text-xs font-medium text-slate-900 dark:text-slate-100 dark:bg-slate-800"
                  >
                    {opt.title} ({opt.badge})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-teal-600 dark:text-teal-400">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Quick Info Chip */}
          <div className="flex items-center gap-2.5 rounded-lg border border-teal-200/80 bg-teal-50/70 px-3.5 py-2.5 text-xs text-teal-950 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-200 max-w-xl">
            <Info className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
            <div className="text-[11px] leading-tight">
              <span className="font-bold">{activeOption.title}:</span> {activeOption.description}
            </div>
          </div>
        </div>
      </div>

      {/* Render Selected Report in the Same Window */}
      {selectedReport === 'daily_sales_items' && <DailySalesItemsReport />}
      {selectedReport === 'daily_cashier_summary' && <DailyCashierSummaryReport />}
      {selectedReport === 'category_profit_margin' && <CategoryProfitMarginReport />}
      {selectedReport === 'controlled_dispensation' && <ControlledDispensationReport />}
      {selectedReport === 'customer_debt_aging' && <CustomerDebtAgingReport />}
    </div>
  );
};
