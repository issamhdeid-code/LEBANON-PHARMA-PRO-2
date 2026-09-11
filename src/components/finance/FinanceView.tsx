import React, { useState, useMemo } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { DollarSign, Percent, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, FileSpreadsheet, Building2, Calculator, Settings, Receipt } from 'lucide-react';
import { ProductCategory } from '../../types/pharmacy';

export const FinanceView: React.FC = () => {
  const { sales, purchases, settings, updateSettings, formatUSD, formatLBP } = usePharmacy();
  const [activeTab, setActiveTab] = useState<'overview' | 'vat' | 'transactions'>('overview');

  const vatRates = settings.vatRates || { drug: 0, vitamins: 11, cosmetics: 11, para: 11 };

  // Calculate totals
  const financials = useMemo(() => {
    let totalRevenueUSD = 0;
    let totalCostUSD = 0;
    let totalProfitUSD = 0;
    
    // Add vat tracking
    let totalVATCollectedUSD = 0;

    sales.forEach(s => {
      // Basic revenue
      totalRevenueUSD += s.totalUSD;
      // Detailed profit & VAT
      s.items.forEach(item => {
        const cost = item.costPriceUSD * item.quantity;
        totalCostUSD += cost;
        totalProfitUSD += (item.totalUSD - cost);
        
        // Calculate VAT if applicable
        const rate = vatRates[item.category] || 0;
        if (rate > 0) {
          // VAT amount is calculated based on the item cost, not retail price
          const vatAmount = cost * (rate / 100);
          totalVATCollectedUSD += vatAmount;
        }
      });
    });

    let totalPurchasesUSD = 0;
    let pendingPurchasesUSD = 0;
    purchases.forEach(p => {
      totalPurchasesUSD += p.totalCostUSD;
      if (!p.paid) {
        pendingPurchasesUSD += p.totalCostUSD;
      }
    });

    return {
      totalRevenueUSD,
      totalCostUSD,
      totalProfitUSD,
      totalPurchasesUSD,
      pendingPurchasesUSD,
      totalVATCollectedUSD
    };
  }, [sales, purchases, vatRates]);

  const handleUpdateVat = (category: ProductCategory, rateStr: string) => {
    const rate = parseFloat(rateStr) || 0;
    updateSettings({
      vatRates: {
        ...vatRates,
        [category]: Math.max(0, Math.min(100, rate))
      }
    });
  };

  const categories: { key: ProductCategory; label: string }[] = [
    { key: 'drug', label: 'Drugs / Medications' },
    { key: 'vitamins', label: 'Vitamins & Supplements' },
    { key: 'cosmetics', label: 'Cosmetics' },
    { key: 'para', label: 'Parapharmacy / Supplies' }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 p-4 lg:p-6 overflow-y-auto min-h-0">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Wallet className="h-7 w-7 text-teal-600 dark:text-teal-400" />
            Financial Dashboard
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Track revenue, margins, expenses, and tax configurations
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 mb-6 shrink-0 w-full">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'overview'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span>Performance Overview</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('vat')}
          className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'vat'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            <span>VAT Configuration</span>
          </div>
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between mb-2">
                <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs tracking-wider uppercase">Gross Revenue (Sales)</span>
                <div className="p-2 bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 rounded-lg">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatUSD(financials.totalRevenueUSD)}</div>
                <div className="text-xs text-slate-400 font-medium mt-1">{formatLBP(financials.totalRevenueUSD * settings.exchangeRate)}</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between mb-2">
                <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs tracking-wider uppercase">Net Profit (Est.)</span>
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatUSD(financials.totalProfitUSD)}</div>
                <div className="text-xs text-emerald-500 font-bold mt-1">
                  Margin: {financials.totalRevenueUSD > 0 ? ((financials.totalProfitUSD / financials.totalRevenueUSD) * 100).toFixed(1) : '0.0'}%
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between mb-2">
                <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs tracking-wider uppercase">Total Purchases (COGS)</span>
                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatUSD(financials.totalPurchasesUSD)}</div>
                <div className="text-xs text-slate-400 font-medium mt-1">Total supplier invoices</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between mb-2">
                <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs tracking-wider uppercase">Pending Supplier Payables</span>
                <div className="p-2 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-lg">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatUSD(financials.pendingPurchasesUSD)}</div>
                <div className="text-xs text-rose-500 font-medium mt-1">Unpaid invoices</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  Recent Sales Activity
                </h2>
                <span className="text-xs font-semibold text-slate-500">{sales.length} Total</span>
              </div>
              <div className="p-0 overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Invoice #</th>
                      <th className="px-4 py-2 font-semibold">Date</th>
                      <th className="px-4 py-2 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sales.slice().sort((a,b) => b.timestamp - a.timestamp).slice(0, 10).map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5 font-mono">{sale.invoiceNumber}</td>
                        <td className="px-4 py-2.5 text-slate-500">{new Date(sale.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">{formatUSD(sale.totalUSD)}</td>
                      </tr>
                    ))}
                    {sales.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-slate-400">No sales recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  Recent Supplier Invoices
                </h2>
                <span className="text-xs font-semibold text-slate-500">{purchases.length} Total</span>
              </div>
              <div className="p-0 overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Ref #</th>
                      <th className="px-4 py-2 font-semibold">Supplier</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                      <th className="px-4 py-2 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {purchases.slice().sort((a,b) => b.timestamp - a.timestamp).slice(0, 10).map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5 font-mono">{p.invoiceNumber}</td>
                        <td className="px-4 py-2.5 font-medium">{p.supplierName}</td>
                        <td className="px-4 py-2.5">
                          {p.paid ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">PAID</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">UNPAID</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100">{formatUSD(p.totalCostUSD)}</td>
                      </tr>
                    ))}
                    {purchases.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">No purchases recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vat' && (
        <div className="max-w-3xl space-y-6">
          <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl p-4 flex items-start gap-3">
            <Calculator className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-teal-900 dark:text-teal-100">Tax & VAT Configuration</h3>
              <p className="text-xs text-teal-700 dark:text-teal-300 mt-1">
                Configure the Value Added Tax (VAT) percentage applied to each product category. 
                This helps in estimating the tax obligations from your total gross sales. 
                Currently, it estimates that out of the total sales, this percentage is the tax portion.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Category VAT Rates (%)</h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {categories.map((cat) => (
                <div key={cat.key} className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {cat.label}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={vatRates[cat.key]}
                      onChange={(e) => handleUpdateVat(cat.key, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm font-semibold text-slate-800 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <div className="absolute right-3 top-2.5 text-slate-400 font-bold">%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <div className="flex items-start justify-between mb-2">
                <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs tracking-wider uppercase">Est. VAT Collected</span>
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Percent className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatUSD(financials.totalVATCollectedUSD)}</div>
                <div className="text-xs text-slate-400 font-medium mt-1">Based on historical sales</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
