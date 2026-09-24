import React, { useState, useEffect, lazy, Suspense } from 'react';
import { PharmacyProvider, usePharmacyUi } from './context/PharmacyContext';
import { WindowProvider } from './context/WindowContext';
import { TopRibbon } from './components/layout/TopRibbon';
import { LoginModal } from './components/auth/LoginModal';
import { SecondaryUserPicker } from './components/auth/SecondaryUserPicker';
import { FirstRunSetup } from './components/setup/FirstRunSetup';
// Dashboard is the default landing view: loaded eagerly so first paint is synchronous.
import { DashboardView } from './components/dashboard/DashboardView';
import { PriceUpdaterModal } from './components/stock/PriceUpdaterModal';
import { CSVImportModal } from './components/stock/CSVImportModal';
import { MOPHPriceUpdaterModal } from './components/stock/MOPHPriceUpdaterModal';
import { Product } from './types/pharmacy';
import { NotificationToastContainer } from './components/common/NotificationToastContainer';
import { NotificationsModal } from './components/common/NotificationsModal';
import { useWindowContext } from './context/WindowContext';
import { useAutomatedLocalBackup } from './hooks/useAutomatedLocalBackup';

// Code-splitting (F4): every secondary view loads its own chunk only on first visit,
// so startup parses just the shell + dashboard. Combined with lazy mounting (F1),
// inactive views are not mounted at all and never re-render on context changes.
const SaleView = lazy(() => import('./components/sale/SaleView').then((m) => ({ default: m.SaleView })));
const StockView = lazy(() => import('./components/stock/StockView').then((m) => ({ default: m.StockView })));
const QuantityAdjustmentsView = lazy(() =>
  import('./components/stock/QuantityAdjustmentsView').then((m) => ({ default: m.QuantityAdjustmentsView }))
);
const PurchaseView = lazy(() => import('./components/purchase/PurchaseView').then((m) => ({ default: m.PurchaseView })));
const SupplierView = lazy(() => import('./components/supplier/SupplierView').then((m) => ({ default: m.SupplierView })));
const CustomerView = lazy(() => import('./components/customer/CustomerView').then((m) => ({ default: m.CustomerView })));
const FinanceView = lazy(() => import('./components/finance/FinanceView').then((m) => ({ default: m.FinanceView })));
const ReportsView = lazy(() => import('./components/reports/ReportsView').then((m) => ({ default: m.ReportsView })));
const ScientificsView = lazy(() =>
  import('./components/scientifics/ScientificsView').then((m) => ({ default: m.ScientificsView }))
);
const LogsView = lazy(() => import('./components/logs/LogsView').then((m) => ({ default: m.LogsView })));
const SettingsView = lazy(() => import('./components/settings/SettingsView').then((m) => ({ default: m.SettingsView })));

function ViewLoadingFallback() {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center bg-[#f8fafc] dark:bg-slate-950">
      <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
        <span className="text-xs font-semibold">Loading…</span>
      </div>
    </div>
  );
}

const PharmacyAppContent: React.FC = () => {
  const {
    currentUser,
    activeTab,
    setActiveTab,
    users,
    settings,
    updateSettings,
    exportBackup,
    addNotification,
  } = usePharmacyUi();
  const { restoreWindow } = useWindowContext();

  // Run automated daily local backup in background
  useAutomatedLocalBackup({
    settings,
    updateSettings,
    exportBackup,
    addNotification,
  });

  // Global modals
  const [isPriceUpdaterOpen, setIsPriceUpdaterOpen] = useState(false);
  const [priceUpdaterCode, setPriceUpdaterCode] = useState('');
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const [isMOPHUpdaterOpen, setIsMOPHUpdaterOpen] = useState(false);
  const [isGlobalNotificationsOpen, setIsGlobalNotificationsOpen] = useState(false);

  // Selected drug for scientifics view
  const [selectedScientificProduct, setSelectedScientificProduct] = useState<Product | null>(null);

  // F1: once the Sale (POS) view has been visited it stays mounted so an in-progress
  // cart / tendered amounts survive tab switches. Other views lazy-mount per visit.
  const [hasVisitedSale, setHasVisitedSale] = useState(false);

  useEffect(() => {
    if (activeTab === 'sale') setHasVisitedSale(true);
  }, [activeTab]);

  // Quick navigation handlers
  const handleViewScientific = (prod: Product) => {
    setSelectedScientificProduct(prod);
    setActiveTab('scientifics');
  };

  const handleOpenPriceUpdater = (code: string = '') => {
    restoreWindow('update_drug_price_by_code');
    restoreWindow('stock_update_drug_price_by_code');
    restoreWindow('price updater');
    setPriceUpdaterCode(code);
    setIsPriceUpdaterOpen(true);
  };

  const handleOpenCSVImport = () => {
    restoreWindow('bulk_inventory_csv_import');
    restoreWindow('csv import');
    setIsCSVImportOpen(true);
  };

  const handleOpenMOPHUpdater = () => {
    restoreWindow('moph_official_drug_price_list');
    restoreWindow('moph');
    setIsMOPHUpdaterOpen(true);
  };

  const handleOpenNotifications = () => {
    restoreWindow('notification_center');
    restoreWindow('notifications');
    setIsGlobalNotificationsOpen(true);
  };

  // Keyboard Shortcuts (e.g. F1 = Sale POS, F2 = Stock, F4 = Price Updater)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('sale');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('stock');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('scientifics');
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleOpenPriceUpdater();
      } else if (e.key === 'Escape') {
        setIsPriceUpdaterOpen(false);
        setIsCSVImportOpen(false);
        setIsMOPHUpdaterOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  // Brand new PC with no accounts yet: run first-time setup (define this PC's role,
  // pharmacy identity, and the first admin account — or sync everything from Main PC).
  if (users.length === 0) {
    return <FirstRunSetup />;
  }

  // Secondary PCs pick which synced account to use instead of typing credentials blind
  if (!currentUser && settings.syncMode === 'secondary') {
    return <SecondaryUserPicker />;
  }

  if (!currentUser) {
    return <LoginModal />;
  }

  // F1: lazy mounting. Only the active non-Sale view is mounted at any time; the Sale
  // (POS) view is kept mounted after first visit so an in-progress cart, tendered amounts
  // and focus are preserved across tab switches.

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[#f8fafc] font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* 9-Tab Ribbon Navigation */}
      <TopRibbon />

      {/* Main View Area */}
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <Suspense fallback={<ViewLoadingFallback />}>
          {activeTab === 'dashboard' && (
            <div className="h-full min-h-0 w-full min-w-0">
              <DashboardView
                onNavigate={(tab) => setActiveTab(tab)}
                onOpenPriceUpdater={() => handleOpenPriceUpdater('')}
                onOpenCSVImport={handleOpenCSVImport}
                onViewScientific={handleViewScientific}
              />
            </div>
          )}

          {activeTab === 'stock' && (
            <div className="h-full min-h-0 w-full min-w-0">
              <StockView
                onViewScientific={handleViewScientific}
                onOpenCSVImport={handleOpenCSVImport}
                onOpenMOPHUpdater={handleOpenMOPHUpdater}
              />
            </div>
          )}

          {activeTab === 'adjustments' && (
            <div className="h-full min-h-0 w-full min-w-0">
              <QuantityAdjustmentsView />
            </div>
          )}

          {activeTab === 'purchase' && (
            <div className="h-full min-h-0 w-full min-w-0">
              <PurchaseView />
            </div>
          )}

          {activeTab === 'supplier' && (
            <div className="h-full min-h-0 w-full min-w-0">
              <SupplierView />
            </div>
          )}

          {activeTab === 'customer' && (
            <div className="h-full min-h-0 w-full min-w-0">
              <CustomerView />
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="h-full min-h-0 w-full min-w-0">
              <FinanceView />
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="h-full min-h-0 w-full min-w-0">
              <ReportsView />
            </div>
          )}

          {activeTab === 'scientifics' && (
            <div className="h-full min-h-0 w-full min-w-0">
              <ScientificsView
                initialSelectedProduct={selectedScientificProduct}
                onOpenPriceUpdater={(code) => handleOpenPriceUpdater(code)}
                onSelectForSale={(prod) => {
                  setActiveTab('sale');
                }}
              />
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="h-full min-h-0 w-full min-w-0">
              <LogsView />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="h-full min-h-0 w-full min-w-0">
              <SettingsView />
            </div>
          )}

          {(hasVisitedSale || activeTab === 'sale') && (
            <div
              className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'sale' ? 'block' : 'hidden'}`}
            >
              <SaleView onViewScientific={handleViewScientific} />
            </div>
          )}
        </Suspense>
      </main>

      {/* Global Modals */}
      {isPriceUpdaterOpen && (
        <PriceUpdaterModal
          initialCode={priceUpdaterCode}
          onClose={() => setIsPriceUpdaterOpen(false)}
          section={activeTab}
        />
      )}

      {isCSVImportOpen && (
        <CSVImportModal 
          onClose={() => setIsCSVImportOpen(false)} 
          section={activeTab}
        />
      )}

      {isMOPHUpdaterOpen && (
        <MOPHPriceUpdaterModal
          onClose={() => setIsMOPHUpdaterOpen(false)}
          section={activeTab}
        />
      )}

      
      {/* Global In-App Notification Toasts */}
      <NotificationToastContainer onOpenCenter={handleOpenNotifications} />

      {/* Global Notifications Center Modal */}
      {isGlobalNotificationsOpen && (
        <NotificationsModal onClose={() => setIsGlobalNotificationsOpen(false)} />
      )}
    </div>
  );
};

export default function App() {
  return (
    <PharmacyProvider>
      <WindowProvider>
        <PharmacyAppContent />
      </WindowProvider>
    </PharmacyProvider>
  );
}
