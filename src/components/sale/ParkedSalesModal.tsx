import React, { useState } from 'react';
import {
  PauseCircle,
  Play,
  Trash2,
  Clock,
  User,
  ShoppingBag,
  Plus,
  AlertCircle,
  Edit2,
  Check,
  X,
  FileText
} from 'lucide-react';
import { DesktopWindow } from '../common/DesktopWindow';
import { ParkedSale } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';

interface ParkedSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  parkedSales: ParkedSale[];
  onResume: (parked: ParkedSale, swapCurrentCart: boolean) => void;
  onDelete: (parkedId: string) => void;
  onHoldCurrent: () => void;
  hasActiveCart: boolean;
  formatUSD: (val: number) => string;
  formatLBP: (val: number) => string;
  onUpdateNote?: (parkedId: string, note: string) => void;
}

export const ParkedSalesModal: React.FC<ParkedSalesModalProps> = ({
  isOpen,
  onClose,
  parkedSales,
  onResume,
  onDelete,
  onHoldCurrent,
  hasActiveCart,
  formatUSD,
  formatLBP,
  onUpdateNote,
}) => {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [resumePromptSale, setResumePromptSale] = useState<ParkedSale | null>(null);

  if (!isOpen) return null;

  const getTimeElapsed = (timestamp: number) => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour}h ago`;
  };

  const handleStartEditNote = (parked: ParkedSale) => {
    setEditingNoteId(parked.id);
    setNoteText(parked.notes || '');
  };

  const handleSaveNote = (parkedId: string) => {
    if (onUpdateNote) {
      onUpdateNote(parkedId, noteText.trim());
    }
    setEditingNoteId(null);
  };

  const handleResumeClick = (parked: ParkedSale) => {
    if (hasActiveCart) {
      setResumePromptSale(parked);
    } else {
      onResume(parked, false);
      onClose();
    }
  };

  return (
    <DesktopWindow
      id="pos-parked-sales-modal"
      title={`Held / Parked Transactions (${parkedSales.length})`}
      isOpen={isOpen}
      onClose={onClose}
      width="680px"
      minWidth={520}
      maxWidth={800}
    >
      <div className="flex flex-col h-full max-h-[82vh] bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-3 space-y-3">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <PauseCircle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800 dark:text-slate-200">
                Temporary Held Invoices
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Resume any held cart when the customer returns.
              </p>
            </div>
          </div>

          {hasActiveCart && (
            <button
              type="button"
              onClick={() => {
                onHoldCurrent();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Hold Current Cart</span>
            </button>
          )}
        </div>

        {/* Prompt Dialog when active cart is not empty */}
        {resumePromptSale && (
          <div className="rounded-lg border-2 border-indigo-400 bg-indigo-50/95 dark:bg-indigo-950/80 dark:border-indigo-600 p-3 shadow-sm space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                  Active Cart in Progress
                </span>
              </div>
              <button
                type="button"
                onClick={() => setResumePromptSale(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-indigo-900/90 dark:text-indigo-300/90">
              Your active cart currently contains items. What would you like to do with the current customer&apos;s cart before resuming &quot;{resumePromptSale.label || resumePromptSale.customerName || 'Held Ticket'}&quot;?
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onResume(resumePromptSale, true);
                  setResumePromptSale(null);
                  onClose();
                }}
                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
              >
                Park Current Cart &amp; Resume This
              </button>
              <button
                type="button"
                onClick={() => {
                  onResume(resumePromptSale, false);
                  setResumePromptSale(null);
                  onClose();
                }}
                className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Discard Current &amp; Resume
              </button>
              <button
                type="button"
                onClick={() => setResumePromptSale(null)}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Parked Sales List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {parkedSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
              <PauseCircle className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">
                No Transactions On Hold
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mt-0.5">
                When you need to pause an active sale to serve another customer, click &quot;Hold (F8)&quot; in the sale screen.
              </p>
            </div>
          ) : (
            parkedSales.map((sale, index) => {
              const timeStr = new Date(sale.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={sale.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs hover:border-teal-400 dark:hover:border-teal-600 transition-all flex flex-col gap-2"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 font-bold text-[10px]">
                        #{index + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          {sale.label || sale.customerName || 'Cash Client'}
                        </span>
                        {sale.isUnreal && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 text-[9px] font-bold">
                            Unreal
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <Clock className="h-3 w-3" />
                        <span>{timeStr}</span>
                        <span className="opacity-70">({getTimeElapsed(sale.timestamp)})</span>
                      </div>
                    </div>
                  </div>

                  {/* Items Preview Chips */}
                  <div className="flex flex-wrap gap-1 items-center max-h-20 overflow-y-auto bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800/80">
                    {sale.items.map((item, itmIdx) => (
                      <span
                        key={itmIdx}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs"
                      >
                        <span className="font-bold text-teal-700 dark:text-teal-400">
                          {item.quantity}x
                        </span>
                        <span className="truncate max-w-[140px] font-medium" title={item.product.name}>
                          {item.product.name}
                        </span>
                        {item.isPiece && (
                          <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold">
                            (pc)
                          </span>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* Notes Area */}
                  <div className="flex items-center justify-between text-xs">
                    {editingNoteId === sale.id ? (
                      <div className="flex items-center gap-1 flex-1 mr-2">
                        <input
                          type="text"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add note (e.g. Waiting for cash/doctor)..."
                          className="flex-1 rounded border border-teal-400 px-2 py-0.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNote(sale.id);
                            if (e.key === 'Escape') setEditingNoteId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveNote(sale.id)}
                          className="p-1 rounded bg-teal-600 text-white hover:bg-teal-700"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <FileText className="h-3 w-3 text-slate-400" />
                        {sale.notes ? (
                          <span className="italic text-slate-700 dark:text-slate-300 font-medium truncate max-w-[280px]">
                            &quot;{sale.notes}&quot;
                          </span>
                        ) : (
                          <span className="opacity-70">No note</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEditNote(sale)}
                          className="hover:text-teal-600 dark:hover:text-teal-400 ml-1 cursor-pointer"
                          title="Edit note"
                        >
                          <Edit2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}

                    {/* Totals & Quick Actions */}
                    <div className="flex items-center gap-3 shrink-0 ml-auto">
                      <div className="text-right font-mono">
                        <span className="font-extrabold text-xs text-teal-700 dark:text-teal-400 block">
                          ${sale.totalUSD.toFixed(2)}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                          {formatLBPValue(sale.totalLBP)} LBP
                        </span>
                      </div>

                      {confirmDeleteId === sale.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(sale.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold shadow-2xs cursor-pointer"
                          >
                            Confirm Discard
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(sale.id)}
                            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:border-red-300 dark:hover:border-red-800 transition-colors cursor-pointer"
                            title="Discard parked sale"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResumeClick(sale)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>Resume</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">Tip:</span>
            <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">F8</kbd> or click Hold in the sale panel to park transactions anytime.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </DesktopWindow>
  );
};
