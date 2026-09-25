import React, { useState } from 'react';
import { CalendarClock, Archive, Lock } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';

/**
 * Global fiscal year selector: switches the app between the active working year
 * and archived (closed) fiscal years. Archived years are loaded from IndexedDB
 * in read-only mode via switchWorkingYear (same mechanism as the login screen).
 */
export const FiscalYearSelect: React.FC = () => {
  const { workingYear, closedYears, isArchiveReadOnly, switchWorkingYear } = usePharmacy();
  const [switching, setSwitching] = useState(false);

  const activeYear = closedYears.length > 0 ? Math.max(...closedYears.map((r) => r.year)) + 1 : workingYear;
  const years = Array.from(new Set([activeYear, ...closedYears.map((r) => r.year).sort((a, b) => b - a)]));
  const viewingArchive = isArchiveReadOnly && closedYears.some((r) => r.year === workingYear);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const target = Number(e.target.value);
    if (target === workingYear || switching) return;
    setSwitching(true);
    try {
      await switchWorkingYear(target);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="flex items-center space-x-1.5" title="Switch fiscal year (archived years are read-only)">
      {viewingArchive ? (
        <Archive className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      ) : (
        <CalendarClock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
      )}
      <select
        value={workingYear}
        onChange={handleChange}
        disabled={switching}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-hidden disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y} {y === activeYear ? '(Active)' : '(Archived)'}
          </option>
        ))}
      </select>
      {viewingArchive && (
        <span className="flex items-center space-x-1 rounded bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <Lock className="h-2.5 w-2.5" />
          <span>Read Only</span>
        </span>
      )}
    </div>
  );
};