import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Download,
  Printer,
  Search,
  Filter,
  Layers,
  FileSpreadsheet,
  Building2,
  DollarSign,
  TrendingUp,
  PackageCheck,
  Receipt,
  User,
  CreditCard,
  Hash,
  AlertCircle
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { SaleTransaction, ProductCategory } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';
import { formatStockDisplay } from '../../utils/stockUtils';

interface DailySalesItemsReportProps {
  onBackToOverview?: () => void;
}

export const DailySalesItemsReport: React.FC<DailySalesItemsReportProps> = () => {
  const { sales, products, settings, exchangeRate, formatUSD } = usePharmacy();

  // Filter States
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [selectedCashier, setSelectedCashier] = useState<string>('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'itemized' | 'consolidated'>('itemized');

  // Handle Preset changes
  const handlePresetChange = (preset: 'today' | 'yesterday' | 'custom') => {
    setDatePreset(preset);
    if (preset === 'today') {
      setSelectedDate(todayStr);
    } else if (preset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      setSelectedDate(d.toISOString().split('T')[0]);
    }
  };

  // Distinct Cashiers list from sales
  const cashiersList = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if (!s.isUnreal && s.cashierName) set.add(s.cashierName);
    });
    return Array.from(set).sort();
  }, [sales]);

  // Filtered sales matching date, cashier, and payment method
  const matchingSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.isUnreal) return false;
      // Date matching (compare YYYY-MM-DD)
      const saleDateStr = new Date(s.timestamp || s.date).toISOString().split('T')[0];
      if (saleDateStr !== selectedDate) return false;

      // Cashier
      if (selectedCashier !== 'ALL' && s.cashierName !== selectedCashier) return false;

      // Payment method
      if (selectedPaymentMethod !== 'ALL' && s.paymentMethod !== selectedPaymentMethod) return false;

      return true;
    });
  }, [sales, selectedDate, selectedCashier, selectedPaymentMethod]);

  // Product fast lookup
  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  // Flattened itemized records
  interface ItemizedRow {
    saleId: string;
    invoiceNumber: string;
    time: string;
    timestamp: number;
    cashierName: string;
    customerName: string;
    paymentMethod: string;
    exchangeRate: number;
    productId: string;
    productCode: string;
    barcode: string;
    productName: string;
    dosage: string;
    presentation: string;
    form: string;
    category: ProductCategory;
    quantity: number;
    isPiece: boolean;
    batchNumber: string;
    expiryDate: string;
    unitPriceUSD: number;
    unitPriceLBP: number;
    discountPercent: number;
    totalUSD: number;
    totalLBP: number;
    costUSD: number;
    profitUSD: number;
    profitMarginPct: number;
    currentStockQuantity: number;
    currentStockDisplay: string;
  }

  const itemizedRows = useMemo<ItemizedRow[]>(() => {
    const rows: ItemizedRow[] = [];
    const query = searchQuery.trim().toLowerCase();

    matchingSales.forEach((sale) => {
      const dateObj = new Date(sale.timestamp || sale.date);
      const timeStr = dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      sale.items.forEach((item) => {
        // Category filter
        if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return;

        const prod = productMap.get(item.productId);
        const barcode = prod?.barcode || '';
        const dosage = prod?.dosage || '';
        const presentation = prod?.presentation || '';
        const form = prod?.form || '';
        const currentStockQuantity = prod?.stockQuantity ?? 0;
        const currentStockDisplay = prod
          ? formatStockDisplay(prod.stockQuantity, prod.isDivisible, prod.piecesPerBox, prod.pieceName)
          : '-';

        // Search query filter (matches product name, code, barcode, invoice #, customer name)
        if (query) {
          const matchName = (item.productName || '').toLowerCase().includes(query);
          const matchCode = (item.productCode || '').toLowerCase().includes(query);
          const matchBarcode = barcode.toLowerCase().includes(query);
          const matchInv = (sale.invoiceNumber || sale.receiptNumber || '').toLowerCase().includes(query);
          const matchCust = (sale.customerName || '').toLowerCase().includes(query);

          if (!matchName && !matchCode && !matchBarcode && !matchInv && !matchCust) {
            return;
          }
        }

        // Cost and Profit calculation
        const costPricePerUnitUSD =
          item.costPriceUSD > 0
            ? item.costPriceUSD
            : prod?.costPriceUSD || item.unitPriceUSD * 0.8;
        const totalCostUSD = costPricePerUnitUSD * item.quantity;
        const profitUSD = item.totalUSD - totalCostUSD;
        const profitMarginPct = item.totalUSD > 0 ? (profitUSD / item.totalUSD) * 100 : 0;

        // Batch & Expiry
        const batchNumber = item.selectedBatchNumber || prod?.batches?.[0]?.batchNumber || '-';
        const expiryDate = item.selectedExpiryDate || prod?.batches?.[0]?.expiryDate || '-';

        rows.push({
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber || sale.receiptNumber || 'N/A',
          time: timeStr,
          timestamp: sale.timestamp || dateObj.getTime(),
          cashierName: sale.cashierName || 'Cashier',
          customerName: sale.customerName || 'Walk-in',
          paymentMethod: sale.paymentMethod,
          exchangeRate: sale.exchangeRate || exchangeRate,
          productId: item.productId,
          productCode: item.productCode || prod?.code || '-',
          barcode,
          productName: item.productName || prod?.name || 'Unknown Item',
          dosage,
          presentation,
          form,
          category: item.category,
          quantity: item.quantity,
          isPiece: !!item.isPiece,
          batchNumber,
          expiryDate,
          unitPriceUSD: item.unitPriceUSD,
          unitPriceLBP: item.unitPriceLBP || Math.round(item.unitPriceUSD * (sale.exchangeRate || exchangeRate)),
          discountPercent: item.discountPercent || 0,
          totalUSD: item.totalUSD,
          totalLBP: item.totalLBP || Math.round(item.totalUSD * (sale.exchangeRate || exchangeRate)),
          costUSD: totalCostUSD,
          profitUSD,
          profitMarginPct,
          currentStockQuantity,
          currentStockDisplay,
        });
      });
    });

    // Sort chronologically descending
    return rows.sort((a, b) => b.timestamp - a.timestamp);
  }, [matchingSales, selectedCategory, searchQuery, productMap, exchangeRate]);

  // Consolidated by product
  interface ConsolidatedRow {
    productId: string;
    productCode: string;
    barcode: string;
    productName: string;
    dosage: string;
    presentation: string;
    form: string;
    category: ProductCategory;
    totalBoxes: number;
    totalPieces: number;
    totalUnits: number;
    totalUSD: number;
    totalLBP: number;
    totalCostUSD: number;
    totalProfitUSD: number;
    salesCount: number;
    avgPriceUSD: number;
    currentStockQuantity: number;
    currentStockDisplay: string;
  }

  const consolidatedRows = useMemo<ConsolidatedRow[]>(() => {
    const map = new Map<string, ConsolidatedRow>();

    itemizedRows.forEach((row) => {
      const existing = map.get(row.productId);
      if (existing) {
        if (row.isPiece) {
          existing.totalPieces += row.quantity;
        } else {
          existing.totalBoxes += row.quantity;
        }
        existing.totalUnits += row.quantity;
        existing.totalUSD += row.totalUSD;
        existing.totalLBP += row.totalLBP;
        existing.totalCostUSD += row.costUSD;
        existing.totalProfitUSD += row.profitUSD;
        existing.salesCount += 1;
      } else {
        map.set(row.productId, {
          productId: row.productId,
          productCode: row.productCode,
          barcode: row.barcode,
          productName: row.productName,
          dosage: row.dosage,
          presentation: row.presentation,
          form: row.form,
          category: row.category,
          totalBoxes: row.isPiece ? 0 : row.quantity,
          totalPieces: row.isPiece ? row.quantity : 0,
          totalUnits: row.quantity,
          totalUSD: row.totalUSD,
          totalLBP: row.totalLBP,
          totalCostUSD: row.costUSD,
          totalProfitUSD: row.profitUSD,
          salesCount: 1,
          avgPriceUSD: 0,
          currentStockQuantity: row.currentStockQuantity,
          currentStockDisplay: row.currentStockDisplay,
        });
      }
    });

    const result = Array.from(map.values()).map((r) => {
      r.avgPriceUSD = r.totalUnits > 0 ? r.totalUSD / r.totalUnits : 0;
      return r;
    });

    // Sort by revenue USD descending
    return result.sort((a, b) => b.totalUSD - a.totalUSD);
  }, [itemizedRows]);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalUSD = 0;
    let totalLBP = 0;
    let totalCostUSD = 0;
    let totalProfitUSD = 0;
    let totalBoxes = 0;
    let totalPieces = 0;

    itemizedRows.forEach((r) => {
      totalUSD += r.totalUSD;
      totalLBP += r.totalLBP;
      totalCostUSD += r.costUSD;
      totalProfitUSD += r.profitUSD;
      if (r.isPiece) {
        totalPieces += r.quantity;
      } else {
        totalBoxes += r.quantity;
      }
    });

    const overallMarginPct = totalUSD > 0 ? (totalProfitUSD / totalUSD) * 100 : 0;
    const distinctProducts = new Set(itemizedRows.map((r) => r.productId)).size;
    const distinctReceipts = new Set(itemizedRows.map((r) => r.saleId)).size;

    return {
      totalUSD,
      totalLBP,
      totalCostUSD,
      totalProfitUSD,
      overallMarginPct,
      totalBoxes,
      totalPieces,
      totalItemsCount: itemizedRows.length,
      distinctProducts,
      distinctReceipts,
    };
  }, [itemizedRows]);

  // Export to CSV
  const handleExportCSV = () => {
    let csvContent = '';
    if (viewMode === 'itemized') {
      const headers = [
        'Time',
        'Invoice #',
        'Cashier',
        'Customer',
        'Payment Method',
        'Code',
        'Barcode',
        'Product Name',
        'Dosage',
        'Presentation',
        'Form',
        'Category',
        'Batch #',
        'Expiry Date',
        'Unit Type',
        'Quantity Sold',
        'Qty In Stock',
        'Unit Price USD',
        'Unit Price LBP',
        'Discount %',
        'Total USD',
        'Total LBP',
        'Est Cost USD',
        'Profit USD',
        'Margin %',
      ];

      const rows = itemizedRows.map((r) => [
        `"${r.time}"`,
        `"${r.invoiceNumber}"`,
        `"${r.cashierName.replace(/"/g, '""')}"`,
        `"${r.customerName.replace(/"/g, '""')}"`,
        `"${r.paymentMethod}"`,
        `"${r.productCode}"`,
        `"${r.barcode}"`,
        `"${r.productName.replace(/"/g, '""')}"`,
        `"${r.dosage.replace(/"/g, '""')}"`,
        `"${r.presentation.replace(/"/g, '""')}"`,
        `"${r.form.replace(/"/g, '""')}"`,
        `"${r.category}"`,
        `"${r.batchNumber}"`,
        `"${r.expiryDate}"`,
        `"${r.isPiece ? 'Piece' : 'Box'}"`,
        r.quantity,
        `"${r.currentStockDisplay.replace(/"/g, '""')}"`,
        r.unitPriceUSD.toFixed(2),
        Math.round(r.unitPriceLBP),
        r.discountPercent,
        r.totalUSD.toFixed(2),
        Math.round(r.totalLBP),
        r.costUSD.toFixed(2),
        r.profitUSD.toFixed(2),
        r.profitMarginPct.toFixed(1),
      ]);

      csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    } else {
      const headers = [
        'Code',
        'Barcode',
        'Product Name',
        'Dosage',
        'Presentation',
        'Form',
        'Category',
        'Boxes Sold',
        'Pieces Sold',
        'Total Units',
        'Qty In Stock',
        'Receipts Count',
        'Avg Unit Price USD',
        'Total Revenue USD',
        'Total Revenue LBP',
        'Total Cost USD',
        'Total Profit USD',
        'Gross Margin %',
      ];

      const rows = consolidatedRows.map((r) => {
        const marginPct = r.totalUSD > 0 ? (r.totalProfitUSD / r.totalUSD) * 100 : 0;
        return [
          `"${r.productCode}"`,
          `"${r.barcode}"`,
          `"${r.productName.replace(/"/g, '""')}"`,
          `"${r.dosage.replace(/"/g, '""')}"`,
          `"${r.presentation.replace(/"/g, '""')}"`,
          `"${r.form.replace(/"/g, '""')}"`,
          `"${r.category}"`,
          r.totalBoxes,
          r.totalPieces,
          r.totalUnits,
          `"${r.currentStockDisplay.replace(/"/g, '""')}"`,
          r.salesCount,
          r.avgPriceUSD.toFixed(2),
          r.totalUSD.toFixed(2),
          Math.round(r.totalLBP),
          r.totalCostUSD.toFixed(2),
          r.totalProfitUSD.toFixed(2),
          marginPct.toFixed(1),
        ];
      });

      csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    }

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Daily_Sales_Items_${selectedDate}_${viewMode}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Trigger Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* Control & Filter Ribbon */}
      <div className="rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 rounded border border-gray-200 bg-gray-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => handlePresetChange('today')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  datePreset === 'today'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('yesterday')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  datePreset === 'yesterday'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('custom')}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  datePreset === 'custom'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
              >
                Custom Date
              </button>
            </div>

            <div className="flex items-center space-x-1.5">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* View Mode Toggle & Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded border border-gray-200 bg-gray-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('itemized')}
                className={`flex items-center space-x-1 rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'itemized'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
                title="Detailed log showing every receipt line"
              >
                <Layers className="h-3 w-3" />
                <span>Itemized Log</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('consolidated')}
                className={`flex items-center space-x-1 rounded px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'consolidated'
                    ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-slate-400'
                }`}
                title="Consolidate quantities and totals per unique product"
              >
                <PackageCheck className="h-3 w-3" />
                <span>Group by Product</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={itemizedRows.length === 0}
              className="flex items-center space-x-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={itemizedRows.length === 0}
              className="flex items-center space-x-1.5 rounded bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Second Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2.5">
          {/* Cashier Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Cashier / Dispenser
            </label>
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Dispensers ({cashiersList.length})</option>
              {cashiersList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Payment Method
            </label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="cash_lbp">Cash (L.L.)</option>
              <option value="cash_usd">Cash ($ USD)</option>
              <option value="mixed">Mixed ($ & L.L.)</option>
              <option value="card">Card / Electronic</option>
              <option value="credit_debt">Credit Account (Patient Debt)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Product Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Categories</option>
              <option value="drug">Drugs & Medications</option>
              <option value="vitamins">Vitamins & Supplements</option>
              <option value="cosmetics">Cosmetics & Skin Care</option>
              <option value="para">Para-pharmaceutical</option>
            </select>
          </div>

          {/* Search Query Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Search Item / Receipt / Customer
            </label>
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Product, code, receipt #, patient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded border border-gray-200 bg-white pl-7.5 pr-2 py-1 text-xs font-medium text-gray-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 no-print">
        {/* Total Revenue USD */}
        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Turnover ($)</span>
            <DollarSign className="h-3.5 w-3.5 text-teal-600" />
          </div>
          <div className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
            ${summary.totalUSD.toFixed(2)}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5 truncate">
            {summary.distinctReceipts} Invoices
          </div>
        </div>

        {/* Total Revenue LBP */}
        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Turnover (L.L.)</span>
            <TrendingUp className="h-3.5 w-3.5 text-teal-600" />
          </div>
          <div className="mt-1 text-base font-black text-slate-900 dark:text-slate-100 truncate">
            {formatLBPValue(summary.totalLBP)}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            LBP equivalent
          </div>
        </div>

        {/* Gross Profit Margin */}
        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Gross Profit</span>
            <span className="text-[10px] font-bold text-amber-600">
              {summary.overallMarginPct.toFixed(1)}%
            </span>
          </div>
          <div className="mt-1 text-base font-black text-emerald-600 dark:text-emerald-400">
            +${summary.totalProfitUSD.toFixed(2)}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5 truncate">
            Cost: ${summary.totalCostUSD.toFixed(2)}
          </div>
        </div>

        {/* Quantity Sold */}
        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Units Dispensed</span>
            <PackageCheck className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <div className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
            {summary.totalBoxes + summary.totalPieces} units
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            {summary.totalBoxes} boxes • {summary.totalPieces} pcs
          </div>
        </div>

        {/* Distinct Products */}
        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Distinct Items</span>
            <Hash className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
            {summary.distinctProducts}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            Unique references
          </div>
        </div>

        {/* Total Line Entries */}
        <div className="rounded border border-gray-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500 dark:text-slate-400">
            <span>Dispense Lines</span>
            <Receipt className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <div className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
            {summary.totalItemsCount}
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5 truncate">
            {viewMode === 'itemized' ? 'Transactions' : 'Consolidated'}
          </div>
        </div>
      </div>

      {/* Main Report Container - This has id="printable-report" for clean printing */}
      <div
        id="printable-report"
        className="rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
      >
        {/* Printable Official Header (Shown during Print and in View) */}
        <div className="border-b border-gray-200 bg-gray-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  {settings.pharmacyName || 'Pharmacy'}
                </h3>
              </div>
              <div className="text-[11px] text-gray-600 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                {settings.pharmacyAddress && <span>{settings.pharmacyAddress}</span>}
                {settings.pharmacyPhone && <span>Tel: {settings.pharmacyPhone}</span>}
                {settings.licenseNumber && <span>Lic: #{settings.licenseNumber}</span>}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-black uppercase text-teal-800 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-900 inline-block">
                Daily Sales Items Report
              </div>
              <div className="text-[10px] text-gray-600 dark:text-slate-400 mt-1">
                Date: <span className="font-bold text-slate-900 dark:text-slate-200">{selectedDate}</span>
                {' • '}Rate: <span className="font-mono">1$ = {formatLBPValue(exchangeRate)} L.L.</span>
              </div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500">
                Generated: {new Date().toLocaleString()} • Mode: {viewMode === 'itemized' ? 'Itemized Log' : 'Grouped by Product'}
              </div>
            </div>
          </div>

          {/* Filter Status Badge */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200/60 dark:border-slate-800/60 text-[10px]">
            <span className="font-bold text-gray-500">Active Filters:</span>
            <span className="rounded bg-gray-200/70 dark:bg-slate-700 px-1.5 py-0.5 text-gray-700 dark:text-slate-300">
              Cashier: <strong className="text-slate-900 dark:text-white">{selectedCashier}</strong>
            </span>
            <span className="rounded bg-gray-200/70 dark:bg-slate-700 px-1.5 py-0.5 text-gray-700 dark:text-slate-300">
              Payment: <strong className="text-slate-900 dark:text-white">{selectedPaymentMethod}</strong>
            </span>
            <span className="rounded bg-gray-200/70 dark:bg-slate-700 px-1.5 py-0.5 text-gray-700 dark:text-slate-300">
              Category: <strong className="text-slate-900 dark:text-white">{selectedCategory}</strong>
            </span>
            {searchQuery && (
              <span className="rounded bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 text-amber-800 dark:text-amber-300">
                Search: "{searchQuery}"
              </span>
            )}
            <span className="ml-auto font-bold text-teal-700 dark:text-teal-400">
              {viewMode === 'itemized' ? `${itemizedRows.length} Line Items` : `${consolidatedRows.length} Distinct Products`}
            </span>
          </div>
        </div>

        {/* Report Content Table */}
        <div className="overflow-x-auto">
          {itemizedRows.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 dark:text-slate-500">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No sales items match the selected date and filters.
            </div>
          ) : viewMode === 'itemized' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-gray-200 bg-gray-100/90 text-[10px] font-bold uppercase text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-2.5 w-8 text-center">#</th>
                  <th className="py-2 px-2">Time</th>
                  <th className="py-2 px-2">Receipt #</th>
                  <th className="py-2 px-2">Code</th>
                  <th className="py-2 px-3">Product Name & Presentation</th>
                  <th className="py-2 px-2 text-center">Category</th>
                  <th className="py-2 px-2">Batch / Exp</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap">Qty Sold</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap">Qty In Stock</th>
                  <th className="py-2 px-2 text-right">Unit Price</th>
                  <th className="py-2 px-2 text-right">Total ($)</th>
                  <th className="py-2 px-2 text-right">Total (L.L.)</th>
                  <th className="py-2 px-2 text-right">Profit ($)</th>
                  <th className="py-2 px-2">Cashier</th>
                  <th className="py-2 px-2">Customer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-[11px]">
                {itemizedRows.map((r, idx) => (
                  <tr
                    key={`${r.saleId}-${r.productId}-${idx}`}
                    className="hover:bg-teal-50/40 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-1.5 px-2.5 text-center text-[10px] font-mono text-gray-400">
                      {idx + 1}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-[10px] text-gray-600 dark:text-slate-400 whitespace-nowrap">
                      {r.time}
                    </td>
                    <td className="py-1.5 px-2 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {r.invoiceNumber}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-[10px] text-gray-500 whitespace-nowrap">
                      {r.productCode}
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-1.5 whitespace-nowrap leading-tight">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {r.productName}
                        </span>
                        {r.dosage && (
                          <span className="font-semibold text-teal-700 dark:text-teal-400">
                            {r.dosage}
                          </span>
                        )}
                        {r.presentation && (
                          <span className="text-slate-600 dark:text-slate-300">
                            {r.presentation}
                          </span>
                        )}
                        {r.form && (
                          <span className="text-slate-500 dark:text-slate-400 text-[10.5px]">
                            {r.form}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${
                          r.category === 'drug'
                            ? 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900'
                            : r.category === 'vitamins'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900'
                            : r.category === 'cosmetics'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900'
                        }`}
                      >
                        {r.category}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-[10px] font-mono whitespace-nowrap text-gray-600 dark:text-slate-400">
                      <div>{r.batchNumber}</div>
                      <div className="text-[9px] text-gray-400">{r.expiryDate}</div>
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {r.quantity} {r.isPiece ? 'pc' : 'bx'}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-[10px] whitespace-nowrap">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded font-bold ${
                          r.currentStockQuantity <= 0
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : r.currentStockQuantity <= 5
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                        title={`${r.currentStockQuantity} in stock`}
                      >
                        {r.currentStockDisplay}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-[10px] text-gray-600 dark:text-slate-400 whitespace-nowrap">
                      ${r.unitPriceUSD.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-teal-700 dark:text-teal-400 whitespace-nowrap">
                      ${r.totalUSD.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap text-[10px]">
                      {formatLBPValue(r.totalLBP)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-[10px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      +${r.profitUSD.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-[10px] text-gray-600 dark:text-slate-300 whitespace-nowrap truncate max-w-[100px]">
                      {r.cashierName}
                    </td>
                    <td className="py-1.5 px-2 text-[10px] text-gray-600 dark:text-slate-300 whitespace-nowrap truncate max-w-[100px]">
                      {r.customerName}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <td colSpan={7} className="py-2.5 px-3 text-right uppercase tracking-wider text-gray-700 dark:text-slate-300">
                    Grand Totals ({itemizedRows.length} items):
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-900 dark:text-white">
                    {summary.totalBoxes + summary.totalPieces}
                  </td>
                  <td></td>
                  <td></td>
                  <td className="py-2.5 px-2 text-right text-teal-800 dark:text-teal-300 font-black">
                    ${summary.totalUSD.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-900 dark:text-white">
                    {formatLBPValue(summary.totalLBP)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-emerald-700 dark:text-emerald-300 font-mono">
                    +${summary.totalProfitUSD.toFixed(2)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-gray-200 bg-gray-100/90 text-[10px] font-bold uppercase text-gray-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-2.5 w-8 text-center">#</th>
                  <th className="py-2 px-2">Code</th>
                  <th className="py-2 px-3">Product Name & Presentation</th>
                  <th className="py-2 px-2 text-center">Category</th>
                  <th className="py-2 px-2 text-right">Boxes</th>
                  <th className="py-2 px-2 text-right">Pieces</th>
                  <th className="py-2 px-2 text-right">Total Units</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap">Qty In Stock</th>
                  <th className="py-2 px-2 text-right">Invoices</th>
                  <th className="py-2 px-2 text-right">Avg Price ($)</th>
                  <th className="py-2 px-2 text-right">Total Revenue ($)</th>
                  <th className="py-2 px-2 text-right">Total Revenue (L.L.)</th>
                  <th className="py-2 px-2 text-right">Gross Profit ($)</th>
                  <th className="py-2 px-2 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-[11px]">
                {consolidatedRows.map((r, idx) => {
                  const marginPct = r.totalUSD > 0 ? (r.totalProfitUSD / r.totalUSD) * 100 : 0;
                  return (
                    <tr
                      key={r.productId}
                      className="hover:bg-teal-50/40 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-1.5 px-2.5 text-center text-[10px] font-mono text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[10px] text-gray-500 whitespace-nowrap">
                        {r.productCode}
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5 whitespace-nowrap leading-tight">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {r.productName}
                          </span>
                          {r.dosage && (
                            <span className="font-semibold text-teal-700 dark:text-teal-400">
                              {r.dosage}
                            </span>
                          )}
                          {r.presentation && (
                            <span className="text-slate-600 dark:text-slate-300">
                              {r.presentation}
                            </span>
                          )}
                          {r.form && (
                            <span className="text-slate-500 dark:text-slate-400 text-[10.5px]">
                              {r.form}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${
                            r.category === 'drug'
                              ? 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900'
                              : r.category === 'vitamins'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900'
                              : r.category === 'cosmetics'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900'
                          }`}
                        >
                          {r.category}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">
                        {r.totalBoxes}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">
                        {r.totalPieces}
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-slate-900 dark:text-white">
                        {r.totalUnits}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-[10px] whitespace-nowrap">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded font-bold ${
                            r.currentStockQuantity <= 0
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : r.currentStockQuantity <= 5
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                          title={`${r.currentStockQuantity} in stock`}
                        >
                          {r.currentStockDisplay}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-gray-500 text-[10px]">
                        {r.salesCount}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-[10px] text-gray-600 dark:text-slate-400">
                        ${r.avgPriceUSD.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-teal-700 dark:text-teal-400 whitespace-nowrap">
                        ${r.totalUSD.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap text-[10px]">
                        {formatLBPValue(r.totalLBP)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-[10px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        +${r.totalProfitUSD.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-[10px] text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        {marginPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-gray-50 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider text-gray-700 dark:text-slate-300">
                    Grand Totals ({consolidatedRows.length} Products):
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-900 dark:text-white">
                    {summary.totalBoxes}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-900 dark:text-white">
                    {summary.totalPieces}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-900 dark:text-white font-black">
                    {summary.totalBoxes + summary.totalPieces}
                  </td>
                  <td></td>
                  <td className="py-2.5 px-2 text-right text-gray-600">
                    {summary.distinctReceipts}
                  </td>
                  <td></td>
                  <td className="py-2.5 px-2 text-right text-teal-800 dark:text-teal-300 font-black">
                    ${summary.totalUSD.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-900 dark:text-white">
                    {formatLBPValue(summary.totalLBP)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-emerald-700 dark:text-emerald-300 font-mono">
                    +${summary.totalProfitUSD.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-amber-600">
                    {summary.overallMarginPct.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Printable Footer with Pharmacist Signature Space */}
        <div className="border-t border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-4 text-[10px] text-gray-500 dark:text-slate-400">
          <div>
            Official Lebanon Pharma Pro Report • All sales audited with dual currency conversion.
          </div>
          <div className="flex items-center space-x-6">
            <div>
              Reviewed by: <span className="underline decoration-dotted font-semibold text-slate-800 dark:text-slate-200">________________________</span>
            </div>
            <div>
              Pharmacist In-Charge: <span className="underline decoration-dotted font-semibold text-slate-800 dark:text-slate-200">________________________</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
