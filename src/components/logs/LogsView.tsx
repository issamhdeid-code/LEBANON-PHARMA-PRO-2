import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Clock,
  User as UserIcon,
  Laptop,
  Eye,
  RefreshCw,
  PlusCircle,
  ArrowUpDown,
  Layers,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { AppLogEntry, LogComponent, LogLevel } from '../../types/pharmacy';
import { LogDetailModal } from './LogDetailModal';
import { DesktopWindow } from '../common/DesktopWindow';
import { SectionRestoreButton } from '../common/SectionRestoreButton';

const ALL_COMPONENTS: LogComponent[] = [
  'POS / Sale',
  'Inventory / Stock',
  'Purchases',
  'Sync / Network',
  'Auth / Security',
  'System',
];

export const LogsView: React.FC = () => {
  const { logs, addLog, clearLogs, exportLogs, currentUser, settings } = usePharmacy();

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComponent, setSelectedComponent] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '24h' | '7d'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Selected log for detailed inspection modal
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = logs.length;
    let info = 0;
    let success = 0;
    let warning = 0;
    let error = 0;

    for (const log of logs) {
      if (log.level === 'info') info++;
      else if (log.level === 'success') success++;
      else if (log.level === 'warning') warning++;
      else if (log.level === 'error') error++;
    }

    return { total, info, success, warning, error };
  }, [logs]);

  // Filtered and sorted logs
  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const query = searchTerm.toLowerCase().trim();

    return logs
      .filter((log) => {
        // Component filter
        if (selectedComponent !== 'ALL' && log.component !== selectedComponent) {
          return false;
        }

        // Level filter
        if (selectedLevel !== 'ALL' && log.level !== selectedLevel) {
          return false;
        }

        // Date range filter
        if (dateRange === 'today') {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          if (log.timestamp < startOfToday.getTime()) return false;
        } else if (dateRange === '24h') {
          if (now - log.timestamp > 24 * 3600 * 1000) return false;
        } else if (dateRange === '7d') {
          if (now - log.timestamp > 7 * 24 * 3600 * 1000) return false;
        }

        // Search term query
        if (query) {
          const matchTitle = (log.title || '').toLowerCase().includes(query);
          const matchDesc = (log.description || '').toLowerCase().includes(query);
          const matchAction = (log.action || '').toLowerCase().includes(query);
          const matchUser = (log.user?.name || '').toLowerCase().includes(query) ||
            (log.user?.username || '').toLowerCase().includes(query);
          const matchComp = (log.component || '').toLowerCase().includes(query);
          const matchId = (log.id || '').toLowerCase().includes(query);
          const matchEntity = (log.entityId || '').toLowerCase().includes(query);
          const matchDetails = log.details
            ? JSON.stringify(log.details).toLowerCase().includes(query)
            : false;

          return (
            matchTitle ||
            matchDesc ||
            matchAction ||
            matchUser ||
            matchComp ||
            matchId ||
            matchEntity ||
            matchDetails
          );
        }

        return true;
      })
      .sort((a, b) => {
        return sortOrder === 'desc'
          ? b.timestamp - a.timestamp
          : a.timestamp - b.timestamp;
      });
  }, [logs, selectedComponent, selectedLevel, dateRange, searchTerm, sortOrder]);

  // Current active log object and index for modal navigation
  const activeLogIndex = useMemo(() => {
    if (!selectedLogId) return -1;
    return filteredLogs.findIndex((l) => l.id === selectedLogId);
  }, [selectedLogId, filteredLogs]);

  const activeLog = useMemo(() => {
    if (activeLogIndex === -1) return null;
    return filteredLogs[activeLogIndex];
  }, [activeLogIndex, filteredLogs]);

  const handleNavigateModal = (direction: 'prev' | 'next') => {
    if (activeLogIndex === -1) return;
    if (direction === 'prev' && activeLogIndex > 0) {
      setSelectedLogId(filteredLogs[activeLogIndex - 1].id);
    } else if (direction === 'next' && activeLogIndex < filteredLogs.length - 1) {
      setSelectedLogId(filteredLogs[activeLogIndex + 1].id);
    }
  };

  const handleTestEvent = () => {
    const modules: LogComponent[] = [
      'POS / Sale',
      'Inventory / Stock',
      'Purchases',
      'Sync / Network',
    ];
    const randomModule = modules[Math.floor(Math.random() * modules.length)];
    const levels: LogLevel[] = ['info', 'success', 'warning'];
    const randomLevel = levels[Math.floor(Math.random() * levels.length)];

    addLog({
      component: randomModule,
      action: 'SYSTEM_DIAGNOSTIC_PING',
      level: randomLevel,
      title: `Manual Audit Ping across [${randomModule}]`,
      description: `Component health check and event registration triggered by ${currentUser?.name || 'Administrator'}.`,
      details: {
        triggeredBy: currentUser?.name,
        terminal: settings.deviceName,
        timestampISO: new Date().toISOString(),
        networkStatus: 'Operational Offline',
        activeModulesCount: modules.length,
      },
    });
  };

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case 'error':
        return <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
      case 'info':
      default:
        return <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getComponentBadgeColor = (comp: LogComponent) => {
    switch (comp) {
      case 'POS / Sale':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'Inventory / Stock':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
      case 'Purchases':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
      case 'Sync / Network':
        return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800';
      case 'Auth / Security':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
      case 'System':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-slate-950 overflow-hidden">
      
      {/* Top Header & Metrics Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <SectionRestoreButton section="logs" />
              <div className="p-1.5 rounded-lg bg-teal-600 text-white shadow-xs">
                <FileText className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                System & Component Audit Logs
              </h1>
              <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                Offline Event Stream
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Real-time audit trail and state telemetry tracking dispensing, stock movements, supplier invoices, scientific lookups, and system configurations.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestEvent}
              className="px-3 py-1.5 rounded-lg border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Add a quick diagnostic log event"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Log Test Event</span>
            </button>

            <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => exportLogs('json')}
                className="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1 cursor-pointer"
                title="Export logs as formatted JSON"
              >
                <Download className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                <span>JSON</span>
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={() => exportLogs('csv')}
                className="px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1 cursor-pointer"
                title="Export logs as CSV Spreadsheet"
              >
                <Download className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                <span>CSV</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsConfirmClearOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Clear all recorded logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>
          </div>
        </div>

        {/* Metric Pill Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4">
          <div
            onClick={() => setSelectedLevel('ALL')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              selectedLevel === 'ALL'
                ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-1 ring-teal-500'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Entries</div>
            <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{stats.total}</div>
          </div>

          <div
            onClick={() => setSelectedLevel('info')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              selectedLevel === 'info'
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Info className="w-3 h-3" /> Info
            </div>
            <div className="text-lg font-extrabold text-blue-700 dark:text-blue-300">{stats.info}</div>
          </div>

          <div
            onClick={() => setSelectedLevel('success')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              selectedLevel === 'success'
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Success
            </div>
            <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{stats.success}</div>
          </div>

          <div
            onClick={() => setSelectedLevel('warning')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              selectedLevel === 'warning'
                ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-500'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Warnings
            </div>
            <div className="text-lg font-extrabold text-amber-700 dark:text-amber-300">{stats.warning}</div>
          </div>

          <div
            onClick={() => setSelectedLevel('error')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              selectedLevel === 'error'
                ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 ring-1 ring-rose-500'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Errors
            </div>
            <div className="text-lg font-extrabold text-rose-700 dark:text-rose-300">{stats.error}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Search Bar */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search action code, title, user, entity ID, or keyword..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Right: Component & Date Dropdowns */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Component Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <select
              value={selectedComponent}
              onChange={(e) => setSelectedComponent(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="ALL">All Components ({logs.length})</option>
              {ALL_COMPONENTS.map((comp) => {
                const count = logs.filter((l) => l.component === comp).length;
                return (
                  <option key={comp} value={comp}>
                    {comp} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="ALL">All Levels</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Time Range Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="24h">Past 24 Hours</option>
              <option value="7d">Past 7 Days</option>
            </select>
          </div>

          {/* Sort Order Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
            title={`Sort: ${sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}`}
          >
            <ArrowUpDown className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
          </button>
        </div>
      </div>

      {/* Main Logs Table Container */}
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4 w-12 text-center">Level</th>
                <th className="py-2.5 px-4 w-44">Time</th>
                <th className="py-2.5 px-4 w-40">Component</th>
                <th className="py-2.5 px-4 w-44">Action Code</th>
                <th className="py-2.5 px-4">Event Summary & Description</th>
                <th className="py-2.5 px-4 w-40">Operator</th>
                <th className="py-2.5 px-4 w-28 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        No audit logs match current filters.
                      </p>
                      <p className="text-xs text-slate-400">
                        Try broadening your search query or reset component and level filters.
                      </p>
                      {(searchTerm || selectedComponent !== 'ALL' || selectedLevel !== 'ALL' || dateRange !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm('');
                            setSelectedComponent('ALL');
                            setSelectedLevel('ALL');
                            setDateRange('all');
                          }}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const dateStr = new Date(log.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  const dayStr = new Date(log.timestamp).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLogId(log.id)}
                      className="hover:bg-teal-50/40 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    >
                      {/* Level Icon */}
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex justify-center" title={`Level: ${log.level.toUpperCase()}`}>
                          {getLevelIcon(log.level)}
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-800 dark:text-slate-200 text-[11px] font-medium">
                          {dayStr} {dateStr}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {log.id.slice(0, 14)}
                        </div>
                      </td>

                      {/* Component */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getComponentBadgeColor(
                            log.component
                          )}`}
                        >
                          {log.component}
                        </span>
                      </td>

                      {/* Action Code */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                          {log.action}
                        </span>
                      </td>

                      {/* Summary & Description */}
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors line-clamp-1">
                          {log.title}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px] line-clamp-1 mt-0.5">
                          {log.description}
                        </div>
                      </td>

                      {/* Operator */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200 text-[11px] font-medium">
                          <UserIcon className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[120px]">
                            {log.user?.name || 'Staff'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {log.device || 'Counter 1'}
                        </div>
                      </td>

                      {/* View Action */}
                      <td className="py-2.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedLogId(log.id)}
                          className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-600 text-slate-700 dark:text-slate-300 font-medium text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

        </div>
      </div>

      {/* Detail Inspection Modal */}
      {selectedLogId && (
        <LogDetailModal
          log={activeLog}
          onClose={() => setSelectedLogId(null)}
          onNavigate={handleNavigateModal}
          hasPrev={activeLogIndex > 0}
          hasNext={activeLogIndex < filteredLogs.length - 1}
          currentIndex={activeLogIndex}
          totalLogs={filteredLogs.length}
        />
      )}

      {/* Clear Logs Confirmation Modal */}
      {isConfirmClearOpen && (
        <DesktopWindow
          title="Clear Audit History"
          isOpen={true}
          section="logs"
          onClose={() => setIsConfirmClearOpen(false)}
          width="420px"
          height="auto"
        >
          <div className="p-5 space-y-4 flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Clear Audit Logs?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This will wipe all {logs.length} logged records from your offline database.
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-900/40">
                Tip: You can export your audit logs to JSON or CSV before clearing for regulatory or historical archiving.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsConfirmClearOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearLogs();
                  setIsConfirmClearOpen(false);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs"
              >
                Yes, Clear All Logs
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}

    </div>
  );
};
