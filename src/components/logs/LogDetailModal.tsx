import React, { useState } from 'react';
import {
  X,
  FileText,
  User as UserIcon,
  Laptop,
  Clock,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Database
} from 'lucide-react';
import { AppLogEntry, LogLevel } from '../../types/pharmacy';
import { DesktopWindow } from '../common/DesktopWindow';

interface LogDetailModalProps {
  log: AppLogEntry | null;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalLogs?: number;
}

export const LogDetailModal: React.FC<LogDetailModalProps> = ({
  log,
  onClose,
  onNavigate,
  hasPrev = false,
  hasNext = false,
  currentIndex,
  totalLogs,
}) => {
  const [copied, setCopied] = useState(false);

  if (!log) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            SUCCESS
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            WARNING
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            ERROR
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            INFO
          </span>
        );
    }
  };

  const formattedDate = new Date(log.timestamp).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const getRelativeTime = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const navHeader = onNavigate && totalLogs !== undefined && currentIndex !== undefined ? (
    <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200/80 dark:bg-slate-700/80 text-[11px] font-medium text-slate-600 dark:text-slate-300">
      <button
        type="button"
        onClick={() => onNavigate('prev')}
        disabled={!hasPrev}
        className="p-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        title="Previous log entry"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <span>
        {currentIndex + 1} of {totalLogs}
      </span>
      <button
        type="button"
        onClick={() => onNavigate('next')}
        disabled={!hasNext}
        className="p-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        title="Next log entry"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null;

  return (
    <DesktopWindow 
      title={`Log Record: ${log.title}`} 
      isOpen={true} 
      onClose={onClose} 
      width="750px" 
      height="80vh"
      extraHeader={navHeader}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Scrollable Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          
          <div className="flex items-center gap-3 mb-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
                {log.id}
              </span>
              {getLevelBadge(log.level)}
              <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[11px] font-mono font-medium text-slate-700 dark:text-slate-200">
                {log.action}
              </span>
            </div>
          </div>
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Timestamp */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
                <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Logged At</span>
              </div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {formattedDate}
              </div>
              <div className="text-[10px] text-teal-600 dark:text-teal-400 font-mono mt-0.5">
                {getRelativeTime(log.timestamp)}
              </div>
            </div>

            {/* Component */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
                <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Component</span>
              </div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {log.component}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Application Module
              </div>
            </div>

            {/* User */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
                <UserIcon className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Operator</span>
              </div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {log.user?.name || 'Staff User'}
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {log.user?.role || 'user'} {log.user?.username ? `(@${log.user.username})` : ''}
              </div>
            </div>

            {/* Terminal / Device */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
                <Laptop className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Terminal Device</span>
              </div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {log.device || 'Counter 1 (Main POS)'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Offline Desktop Client
              </div>
            </div>
          </div>

          {/* Description Card */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Event Description & Summary
            </h3>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
              {log.description}
            </p>

            {log.entityId && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Target Entity:</span>
                <span className="font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px]">
                  {log.entityType ? `[${log.entityType.toUpperCase()}] ` : ''}{log.entityId}
                </span>
              </div>
            )}
          </div>

          {/* Structured Details Inspector */}
          {log.details && Object.keys(log.details).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  Contextual Payload Details
                </h3>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="flex items-center gap-1 text-[11px] font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Full JSON</span>
                    </>
                  )}
                </button>
              </div>

              {/* Primary Key-Value Properties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(log.details).map(([key, value]) => {
                  const displayVal =
                    typeof value === 'object' && value !== null
                      ? Array.isArray(value)
                        ? `${value.length} items (${value
                            .map((v) =>
                              typeof v === 'object' && v !== null
                                ? (v as Record<string, unknown>).name ||
                                  (v as Record<string, unknown>).code ||
                                  JSON.stringify(v)
                                : String(v)
                            )
                            .slice(0, 3)
                            .join(', ')}${value.length > 3 ? '...' : ''})`
                        : JSON.stringify(value)
                      : String(value);

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 text-xs"
                    >
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] font-medium">
                        {key}:
                      </span>
                      <span
                        className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px] text-right font-mono text-[11px]"
                        title={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                      >
                        {displayVal}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Audit log record registered in local offline database.
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyJson}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </DesktopWindow>
  );
};
