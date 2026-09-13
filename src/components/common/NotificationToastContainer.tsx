import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, AlertCircle, CheckCircle2, Info, X, Bell } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { AppNotification } from '../../types/pharmacy';

interface NotificationToastContainerProps {
  onOpenCenter?: () => void;
}

export const NotificationToastContainer: React.FC<NotificationToastContainerProps> = ({ onOpenCenter }) => {
  const { notifications, dismissNotification } = usePharmacy();
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (initialLoadRef.current) {
      // Mark all existing notifications as already seen on initial page mount so we don't spam toasts
      notifications.forEach((n) => seenIdsRef.current.add(n.id));
      initialLoadRef.current = false;
      return;
    }

    // Find any new notifications not yet seen
    const newOnes = notifications.filter((n) => !seenIdsRef.current.has(n.id));
    if (newOnes.length > 0) {
      newOnes.forEach((n) => seenIdsRef.current.add(n.id));
      setToasts((prev) => [...prev, ...newOnes]);

      // Schedule auto-dismiss for each new toast
      newOnes.forEach((n) => {
        setTimeout(() => {
          setToasts((current) => current.filter((t) => t.id !== n.id));
        }, 5000);
      });
    }
  }, [notifications]);

  const handleCloseToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDismissForever = (id: string) => {
    handleCloseToast(id);
    dismissNotification(id);
  };

  const getIcon = (severity: AppNotification['severity']) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-teal-500 shrink-0" />;
    }
  };

  const getBorderColor = (severity: AppNotification['severity']) => {
    switch (severity) {
      case 'error':
        return 'border-rose-300 dark:border-rose-800 bg-rose-50/95 dark:bg-rose-950/90 text-rose-950 dark:text-rose-100';
      case 'warning':
        return 'border-amber-300 dark:border-amber-800 bg-amber-50/95 dark:bg-amber-950/90 text-amber-950 dark:text-amber-100';
      case 'success':
        return 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-100';
      case 'info':
      default:
        return 'border-teal-300 dark:border-teal-800 bg-teal-50/95 dark:bg-teal-950/90 text-teal-950 dark:text-teal-100';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div
      id="in-app-toast-container"
      className="fixed top-14 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-auto rounded-xl border p-3.5 shadow-xl backdrop-blur-sm transition-all ${getBorderColor(
              toast.severity
            )}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getIcon(toast.severity)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-bold leading-tight truncate">
                    {toast.title}
                  </h4>
                  <button
                    onClick={() => handleDismissForever(toast.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed line-clamp-3 opacity-90">
                  {toast.message}
                </p>
                {onOpenCenter && (
                  <div className="mt-2 flex items-center justify-between pt-1 border-t border-current/10">
                    <button
                      onClick={() => {
                        handleCloseToast(toast.id);
                        onOpenCenter();
                      }}
                      className="text-[10px] font-bold underline hover:opacity-80 flex items-center gap-1 cursor-pointer"
                    >
                      <Bell className="w-3 h-3" />
                      Open Notification Center
                    </button>
                    <span className="text-[9px] opacity-70">Just now</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
