import React from 'react';
import { Archive, Lock, ArrowRight, ShieldAlert } from 'lucide-react';
import { usePharmacyUi } from '../../context/PharmacyContext';

export const ReadOnlyArchiveBanner: React.FC = () => {
  const { workingYear, isArchiveReadOnly, logout } = usePharmacyUi();

  if (!isArchiveReadOnly) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-3 py-1.5 flex items-center justify-between text-xs font-semibold shadow-xs border-b border-amber-600/40 select-none z-30 shrink-0">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded bg-amber-600/30 px-1.5 py-0.5 text-[11px] font-bold text-amber-950">
          <Archive className="h-3.5 w-3.5" />
          <span>ARCHIVED FISCAL YEAR: {workingYear}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          <Lock className="h-3 w-3 text-amber-900" />
          <span>Read-Only Mode: Historical lookup only. Modifications, sales, and purchases are disabled.</span>
        </div>
      </div>
      <button
        onClick={logout}
        className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-900 text-amber-50 hover:bg-amber-950 transition-colors text-[11px] font-bold cursor-pointer"
        title="Sign out and choose current active year"
      >
        <span>Exit Archive</span>
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
};
