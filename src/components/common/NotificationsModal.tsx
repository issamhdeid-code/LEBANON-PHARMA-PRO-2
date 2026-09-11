import React from 'react';
import { Bell, X, Check, Trash2, AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { AppNotification } from '../../types/pharmacy';
import { DesktopWindow } from './DesktopWindow';

interface NotificationsModalProps {
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ onClose }) => {
  const { notifications, dismissNotification, markAllNotificationsRead } = usePharmacy();

  const getIcon = (type: AppNotification['type'], severity: AppNotification['severity']) => {
    if (severity === 'warning' || severity === 'error') {
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    }
    if (type === 'sale' || severity === 'success') {
      return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
    }
    return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
  };

  return (
    <DesktopWindow title="System Notifications & Inventory Alerts" isOpen={true} onClose={onClose} width="500px" height="85vh">
      <div className="flex flex-col h-full">
        {/* Action bar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 bg-slate-50/40">
          <span>{notifications.length} Total Alerts</span>
          {notifications.length > 0 && (
            <button
              onClick={markAllNotificationsRead}
              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 dark:divide-slate-800/80">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No recent notifications or alerts.
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start justify-between rounded-xl p-3 text-xs transition-colors ${
                  notif.read
                    ? 'bg-transparent text-slate-600 dark:text-slate-400'
                    : 'bg-slate-50 font-medium text-slate-900 dark:bg-slate-800/60 dark:text-slate-100'
                }`}
              >
                <div className="flex items-start space-x-2.5">
                  {getIcon(notif.type, notif.severity)}
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {notif.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {notif.message}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {notif.type.toUpperCase()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => dismissNotification(notif.id)}
                  className="rounded p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-right dark:border-slate-800 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 dark:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </DesktopWindow>
  );
};
