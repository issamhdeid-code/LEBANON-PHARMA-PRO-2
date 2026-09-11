import React, { useState, useEffect } from 'react';
import { PharmacyProvider, usePharmacy } from './context/PharmacyContext';
import { WindowProvider } from './context/WindowContext';
import { TopRibbon } from './components/layout/TopRibbon';
import { LoginModal } from './components/auth/LoginModal';
import { SecondaryUserPicker } from './components/auth/SecondaryUserPicker';
import { FirstRunSetup } from './components/setup/FirstRunSetup';
import { DashboardView } from './components/dashboard/DashboardView';
import { SaleView } from './components/sale/SaleView';
import { StockView } from './components/stock/StockView';
import { PurchaseView } from './components/purchase/PurchaseView';
import { QuantityAdjustmentsView } from './components/stock/QuantityAdjustmentsView';
import { SupplierView } from './components/supplier/SupplierView';
import { CustomerView } from './components/customer/CustomerView';
import { FinanceView } from './components/finance/FinanceView';
import { ReportsView } from './components/reports/ReportsView';
import { ScientificsView } from './components/scientifics/ScientificsView';
import { LogsView } from './components/logs/LogsView';
import { SettingsView } from './components/settings/SettingsView';
import { PriceUpdaterModal } from './components/stock/PriceUpdaterModal';
import { CSVImportModal } from './components/stock/CSVImportModal';
import { MOPHPriceUpdaterModal } from './components/stock/MOPHPriceUpdaterModal';
import { Product } from './types/pharmacy';

const PharmacyAppContent: React.FC = () => {
  const { currentUser, activeTab, setActiveTab, users, settings } = usePharmacy();

  // Global modals
  const [isPriceUpdaterOpen, setIsPriceUpdaterOpen] = useState(false);
  const [priceUpdaterCode, setPriceUpdaterCode] = useState('');
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const [isMOPHUpdaterOpen, setIsMOPHUpdaterOpen] = useState(false);

  // Selected drug for scientifics view
  const [selectedScientificProduct, setSelectedScientificProduct] = useState<Product | null>(null);

  // Quick navigation handlers
  const handleViewScientific = (prod: Product) => {
    setSelectedScientificProduct(prod);
    setActiveTab('scientifics');
  };

  const handleOpenPriceUpdater = (code: string = '') => {
    setPriceUpdaterCode(code);
    setIsPriceUpdaterOpen(true);
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

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[#f8fafc] font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* 9-Tab Ribbon Navigation */}
      <TopRibbon />

      {/* Main View Area */}
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'dashboard' ? 'block' : 'hidden'}`}>
          <DashboardView
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenPriceUpdater={() => handleOpenPriceUpdater('')}
            onOpenCSVImport={() => setIsCSVImportOpen(true)}
            onViewScientific={handleViewScientific}
          />
        </div>

        <div className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'sale' ? 'block' : 'hidden'}`}>
          <SaleView onViewScientific={handleViewScientific} />
        </div>

        <div className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'stock' ? 'block' : 'hidden'}`}>
          <StockView
            onViewScientific={handleViewScientific}
            onOpenCSVImport={() => setIsCSVImportOpen(true)}
            onOpenMOPHUpdater={() => setIsMOPHUpdaterOpen(true)}
          />
        </div>

        <div className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'adjustments' ? 'block' : 'hidden'}`}>
          <QuantityAdjustmentsView />
        </div>

        <div className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'purchase' ? 'block' : 'hidden'}`}>
          <PurchaseView />
        </div>

        <div className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'supplier' ? 'block' : 'hidden'}`}>
          <SupplierView />
        </div>

        <div className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'customer' ? 'block' : 'hidden'}`}>
          <CustomerView />
        </div>

        <div className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'finance' ? 'block' : 'hidden'}`}>
          <FinanceView />
        </div>

        <div className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'reports' ? 'block' : 'hidden'}`}>
          <ReportsView />
        </div>

        <div className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'scientifics' ? 'block' : 'hidden'}`}>
          <ScientificsView
            initialSelectedProduct={selectedScientificProduct}
            onOpenPriceUpdater={(code) => handleOpenPriceUpdater(code)}
            onSelectForSale={(prod) => {
              setActiveTab('sale');
            }}
          />
        </div>

        <div className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'logs' ? 'block' : 'hidden'}`}>
          <LogsView />
        </div>
        <div className={`h-full min-h-0 w-full min-w-0 ${activeTab === 'settings' ? 'block' : 'hidden'}`}>
          <SettingsView />
        </div>
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
