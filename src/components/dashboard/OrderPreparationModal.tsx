import React, { useState, useMemo, useRef } from 'react';
import {
  FileText,
  ClipboardList,
  Copy,
  Printer,
  Download,
  Send,
  Check,
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  TrendingDown,
  Package,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import { ProductStockForecast } from '../../utils/stockForecast';
import { Supplier, PurchaseItem } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';
import { formatStockDisplay } from '../../utils/stockUtils';
import { usePharmacy } from '../../context/PharmacyContext';

interface OrderPreparationModalProps {
  isOpen: boolean;
  onClose: () => void;
  forecastItems: ProductStockForecast[];
  initialSelectedIds: Set<string>;
  initialQuantities: Record<string, number>;
  suppliers: Supplier[];
  exchangeRate: number;
  onSendToPurchase?: (orderData: {
    supplierId?: string;
    supplierName?: string;
    items: PurchaseItem[];
  }) => void;
}

export const OrderPreparationModal: React.FC<OrderPreparationModalProps> = ({
  isOpen,
  onClose,
  forecastItems,
  initialSelectedIds,
  initialQuantities,
  suppliers,
  exchangeRate,
  onSendToPurchase,
}) => {
  const { settings, formatUSD, addNotification } = usePharmacy();

  // If user opened with no items selected, default to all forecast items
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => {
    if (initialSelectedIds.size > 0) {
      return new Set(initialSelectedIds);
    }
    return new Set(forecastItems.map((i) => i.product.id));
  });

  // Quantities for each product
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {};
    forecastItems.forEach((item) => {
      q[item.product.id] = initialQuantities[item.product.id] ?? item.suggestedReorderQty;
    });
    return q;
  });

  // Order reference ID & Date
  const orderRef = useMemo(() => `ORD-${Date.now().toString().slice(-6)}`, []);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [orderDate, setOrderDate] = useState<string>(todayStr);
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Filters inside order form
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);

  // List of unique agents in these items
  const agentList = useMemo(() => {
    const set = new Set<string>();
    forecastItems.forEach((i) => {
      const ag = i.product.agent?.trim() || 'Direct / General';
      set.add(ag);
    });
    return Array.from(set).sort();
  }, [forecastItems]);

  // Filtered list of items
  const displayItems = useMemo(() => {
    return forecastItems.filter((item) => {
      const agent = item.product.agent?.trim() || 'Direct / General';
      if (selectedAgentFilter !== 'ALL' && agent !== selectedAgentFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.product.name.toLowerCase().includes(q);
        const matchesCode = (item.product.code || '').toLowerCase().includes(q);
        const matchesBarcode = (item.product.barcode || '').toLowerCase().includes(q);
        const matchesAgent = agent.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesBarcode && !matchesAgent) {
          return false;
        }
      }
      return true;
    });
  }, [forecastItems, selectedAgentFilter, searchQuery]);

  // Toggle item selection
  const toggleItem = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedProductIds.size === displayItems.length && displayItems.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(displayItems.map((i) => i.product.id)));
    }
  };

  const updateQuantity = (productId: string, val: number) => {
    const valid = Math.max(0, isNaN(val) ? 0 : Math.round(val));
    setOrderQuantities((prev) => ({
      ...prev,
      [productId]: valid,
    }));
  };

  const handleQtyChange = (productId: string, strVal: string) => {
    const num = parseInt(strVal, 10);
    updateQuantity(productId, isNaN(num) || num < 0 ? 0 : num);
  };

  // Quick batch adjustments
  const handleSetAllToSuggested = () => {
    setOrderQuantities((prev) => {
      const next = { ...prev };
      displayItems.forEach((i) => {
        next[i.product.id] = i.suggestedReorderQty;
      });
      return next;
    });
  };

  const handleSetAllToZero = () => {
    setOrderQuantities((prev) => {
      const next = { ...prev };
      displayItems.forEach((i) => {
        next[i.product.id] = 0;
      });
      return next;
    });
  };

  // Active items included in the order (selected AND quantity > 0)
  const orderedItems = useMemo(() => {
    return forecastItems.filter((item) => {
      if (!selectedProductIds.has(item.product.id)) return false;
      const qty = orderQuantities[item.product.id] ?? item.suggestedReorderQty;
      return qty > 0;
    });
  }, [forecastItems, selectedProductIds, orderQuantities]);

  // Financial and unit totals
  const orderSummary = useMemo(() => {
    let totalUnits = 0;
    let totalCostUSD = 0;

    orderedItems.forEach((item) => {
      const qty = orderQuantities[item.product.id] ?? item.suggestedReorderQty;
      const unitCost = item.product.costPriceUSD || 0;
      totalUnits += qty;
      totalCostUSD += qty * unitCost;
    });

    const totalCostLBP = Math.round(totalCostUSD * exchangeRate);

    return {
      distinctItemCount: orderedItems.length,
      totalUnits,
      totalCostUSD,
      totalCostLBP,
    };
  }, [orderedItems, orderQuantities, exchangeRate]);

  // WhatsApp formatted string
  const handleCopyWhatsApp = () => {
    if (orderedItems.length === 0) {
      alert('Please select at least one item with quantity greater than 0.');
      return;
    }

    const pharmacyName = settings?.pharmacyName || 'Pharmacy';
    const agentTitle = selectedAgentFilter !== 'ALL' ? selectedAgentFilter : 'All Suppliers Order';

    let text = `📦 *${pharmacyName.toUpperCase()} - ORDER PREPARATION*\n`;
    text += `📋 *Ref:* ${orderRef} | *Date:* ${orderDate}\n`;
    text += `🏢 *Supplier / Agent:* ${agentTitle}\n`;
    if (orderNotes.trim()) {
      text += `📝 *Notes:* ${orderNotes.trim()}\n`;
    }
    text += `----------------------------------------\n`;

    orderedItems.forEach((item, index) => {
      const qty = orderQuantities[item.product.id] ?? item.suggestedReorderQty;
      const agent = item.product.agent ? ` [${item.product.agent}]` : '';
      text += `${index + 1}. *${item.product.name}* ➔ *Qty: ${qty} Boxes*${agent}\n`;
      if (item.product.barcode) {
        text += `   Code: ${item.product.code} | Barcode: ${item.product.barcode}\n`;
      }
    });

    text += `----------------------------------------\n`;
    text += `📊 *Total Items:* ${orderSummary.distinctItemCount} | *Total Units:* ${orderSummary.totalUnits} Boxes\n`;
    text += `💵 *Est. Total:* $${orderSummary.totalCostUSD.toFixed(2)} USD (${formatLBPValue(orderSummary.totalCostLBP)} L.L.)\n`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 3000);
      addNotification(
        'Order Copied',
        `Formatted order (${orderSummary.distinctItemCount} items) copied for WhatsApp.`,
        'inventory',
        'info'
      );
    });
  };

  // Print Order Form
  const handlePrint = () => {
    window.print();
  };

  // Export CSV
  const handleExportCSV = () => {
    if (orderedItems.length === 0) {
      alert('No items selected for export.');
      return;
    }

    const headers = [
      'Product Code',
      'Barcode',
      'Medication Name',
      'Agent / Importer',
      'Current Stock',
      'Daily Velocity (units/day)',
      'Estimated Stockout',
      'Order Qty (Boxes)',
      'Unit Cost USD',
      'Total Cost USD',
      'Total Cost LBP',
    ];

    const rows = orderedItems.map((item) => {
      const qty = orderQuantities[item.product.id] ?? item.suggestedReorderQty;
      const unitCostUSD = item.product.costPriceUSD || 0;
      const lineCostUSD = qty * unitCostUSD;
      const lineCostLBP = Math.round(lineCostUSD * exchangeRate);
      const stockoutStr = item.currentStock === 0 ? 'Depleted' : `~${Math.round(item.daysUntilStockout)}d`;

      return [
        `"${item.product.code || ''}"`,
        `"${item.product.barcode || ''}"`,
        `"${item.product.name.replace(/"/g, '""')}"`,
        `"${(item.product.agent || '').replace(/"/g, '""')}"`,
        item.currentStock,
        item.dailyVelocity,
        `"${stockoutStr}"`,
        qty,
        unitCostUSD.toFixed(2),
        lineCostUSD.toFixed(2),
        lineCostLBP,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Order_Preparation_${selectedAgentFilter !== 'ALL' ? selectedAgentFilter + '_' : ''}${orderDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Transfer to Purchase Invoice (if requested)
  const handleTransferToPurchase = () => {
    if (!onSendToPurchase || orderedItems.length === 0) return;

    const purchaseItems: PurchaseItem[] = orderedItems.map((item) => {
      const qty = orderQuantities[item.product.id] ?? item.suggestedReorderQty;
      const unitCostUSD = item.product.costPriceUSD || 0;
      const unitCostLBP = Math.round(unitCostUSD * exchangeRate);
      const sellingUSD = item.product.priceUSD || 0;
      const sellingLBP = item.product.priceLBP || Math.round(sellingUSD * exchangeRate);

      return {
        productId: item.product.id,
        productCode: item.product.code,
        productName: item.product.name,
        quantity: Math.max(1, qty),
        freeQty: 0,
        unitCostUSD,
        unitCostLBP,
        unitPriceUSD: unitCostUSD,
        unitPriceLBP: unitCostLBP,
        sellingPriceUSD: sellingUSD,
        sellingPriceLBP: sellingLBP,
        discount: 0,
        batchNumber: item.product.batchNumber || '',
        expiryDate: item.product.expiryDate || '',
        isPiece: false,
      };
    });

    // Match top agent to supplier
    const agentCounts: Record<string, number> = {};
    for (const it of orderedItems) {
      const agent = it.product.agent?.trim();
      if (agent) {
        agentCounts[agent] = (agentCounts[agent] || 0) + 1;
      }
    }

    let topAgent = '';
    let topCount = 0;
    for (const [agent, count] of Object.entries(agentCounts)) {
      if (count > topCount) {
        topCount = count;
        topAgent = agent;
      }
    }

    const matchedSupplier = topAgent
      ? suppliers.find(
          (s) =>
            s.name.toLowerCase().includes(topAgent.toLowerCase()) ||
            topAgent.toLowerCase().includes(s.name.toLowerCase())
        )
      : undefined;

    onSendToPurchase({
      supplierId: matchedSupplier?.id,
      supplierName: matchedSupplier?.name || topAgent || undefined,
      items: purchaseItems,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Printable Order Sheet Header (Visible only when printing) */}
        <div className="hidden print:block p-6 border-b border-gray-300">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold uppercase">{settings?.pharmacyName || 'PHARMACY'}</h1>
              <p className="text-xs text-gray-600">OFFICIAL SUPPLIER PURCHASE ORDER</p>
              <p className="text-xs text-gray-500">Reference: {orderRef} • Date: {orderDate}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">Supplier: {selectedAgentFilter !== 'ALL' ? selectedAgentFilter : 'General'}</p>
              <p className="text-xs text-gray-500">Currency: USD / LBP ({formatLBPValue(exchangeRate)} L.L./$)</p>
            </div>
          </div>
          {orderNotes && (
            <div className="mt-3 p-2 bg-gray-50 border border-gray-200 text-xs">
              <span className="font-bold">Order Instructions: </span>
              {orderNotes}
            </div>
          )}
        </div>

        {/* Modal Top Bar (Hidden when printing) */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between no-print">
          <div className="flex items-center space-x-2.5">
            <div className="rounded-lg bg-teal-600 p-2 text-white shadow-2xs">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">
                  Order Preparation Form
                </h2>
                <span className="rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                  Ref: {orderRef}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                Prepare restock orders for Lebanese agents based on predicted sales depletion and minimum safety thresholds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
              title="Close Order Preparation Form"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Order Details & Filter Bar (Hidden when printing) */}
        <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
          <div className="flex flex-wrap items-center gap-3">
            {/* Agent / Supplier Selector */}
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Agent / Importer:</span>
              <select
                value={selectedAgentFilter}
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
                className="rounded border border-gray-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-teal-700 dark:text-teal-400 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">All Agents ({forecastItems.length} items)</option>
                {agentList.map((agent) => {
                  const count = forecastItems.filter((i) => (i.product.agent?.trim() || 'Direct / General') === agent).length;
                  return (
                    <option key={agent} value={agent}>
                      {agent} ({count} items)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Order Date */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Date:</span>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="rounded border border-gray-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* In-form search */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2 text-gray-400" />
              <input
                type="text"
                placeholder="Search medication or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-2 py-1 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs w-48 text-slate-800 dark:text-slate-200 placeholder-gray-400 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Quick adjustment buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSetAllToSuggested}
              className="px-2 py-1 text-[11px] font-semibold rounded border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300 transition-colors cursor-pointer"
            >
              Reset to Suggested
            </button>
            <button
              type="button"
              onClick={handleSetAllToZero}
              className="px-2 py-1 text-[11px] font-semibold rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Zero All
            </button>
          </div>
        </div>

        {/* Order Items Table */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-slate-900">
          {displayItems.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400">
              <Package className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-slate-700" />
              <p className="font-semibold text-slate-600 dark:text-slate-400">No items matching the selected filters.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 border-b border-gray-200 dark:border-slate-700 text-[10px] font-bold uppercase text-gray-600 dark:text-slate-300 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center no-print">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="cursor-pointer text-slate-500 hover:text-slate-700"
                      title="Select / Deselect all"
                    >
                      {selectedProductIds.size > 0 && selectedProductIds.size === displayItems.length ? (
                        <CheckSquare className="h-4 w-4 text-teal-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">Medication & Barcode</th>
                  <th className="py-2.5 px-3">Agent / Importer</th>
                  <th className="py-2.5 px-3 text-center">Stock</th>
                  <th className="py-2.5 px-3 text-center">Velocity</th>
                  <th className="py-2.5 px-3 text-center">Stockout</th>
                  <th className="py-2.5 px-3 text-center">Order Qty (Boxes)</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Line Total</th>
                  <th className="py-2.5 px-3 text-center w-10 no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-sans">
                {displayItems.map((item) => {
                  const isSelected = selectedProductIds.has(item.product.id);
                  const orderQty = orderQuantities[item.product.id] ?? item.suggestedReorderQty;
                  const unitCostUSD = item.product.costPriceUSD || 0;
                  const lineCostUSD = orderQty * unitCostUSD;
                  const lineCostLBP = Math.round(lineCostUSD * exchangeRate);

                  return (
                    <tr
                      key={item.product.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        isSelected && orderQty > 0 ? 'bg-teal-50/40 dark:bg-teal-950/20' : ''
                      }`}
                    >
                      {/* Checkbox (no-print) */}
                      <td className="py-2 px-3 text-center no-print">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleItem(item.product.id)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                      </td>

                      {/* Name & Barcode */}
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{item.product.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          Code: {item.product.code} {item.product.barcode ? `• Barcode: ${item.product.barcode}` : ''}
                        </div>
                      </td>

                      {/* Agent */}
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 font-medium">
                        {item.product.agent || 'Direct / General'}
                      </td>

                      {/* Current Stock */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            item.currentStock === 0
                              ? 'text-rose-600 font-extrabold'
                              : item.currentStock <= item.minStockAlert
                              ? 'text-amber-600'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {formatStockDisplay(
                            item.currentStock,
                            item.product.isDivisible,
                            item.product.piecesPerBox,
                            item.product.pieceName
                          )}
                        </span>
                        <div className="text-[9px] text-gray-400">Min: {item.minStockAlert}</div>
                      </td>

                      {/* Sales Velocity */}
                      <td className="py-2 px-3 text-center whitespace-nowrap font-mono">
                        <div className="font-bold text-slate-700 dark:text-slate-300">
                          {item.dailyVelocity > 0 ? `${item.dailyVelocity}/d` : '0/d'}
                        </div>
                        <div className="text-[9px] text-gray-400">{item.unitsSold30d} sold 30d</div>
                      </td>

                      {/* Est Stockout */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {item.currentStock === 0 ? (
                          <span className="font-bold text-rose-600">Depleted</span>
                        ) : (
                          <div>
                            <span
                              className={`font-bold ${
                                item.daysUntilStockout <= 3
                                  ? 'text-rose-600'
                                  : item.daysUntilStockout <= 7
                                  ? 'text-amber-600'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              ~{Math.round(item.daysUntilStockout)}d
                            </span>
                            {item.stockoutDate && (
                              <div className="text-[9px] text-gray-400">
                                {item.stockoutDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Order Quantity Controller */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, Math.max(0, orderQty - 1))}
                            className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 no-print cursor-pointer"
                            title="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={orderQty}
                            onChange={(e) => handleQtyChange(item.product.id, e.target.value)}
                            className="w-16 px-1.5 py-1 text-center font-bold text-xs rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, orderQty + 1)}
                            className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 no-print cursor-pointer"
                            title="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* Unit Cost */}
                      <td className="py-2 px-3 text-right whitespace-nowrap font-mono text-slate-700 dark:text-slate-300">
                        ${unitCostUSD.toFixed(2)}
                      </td>

                      {/* Line Total */}
                      <td className="py-2 px-3 text-right whitespace-nowrap font-mono">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          ${lineCostUSD.toFixed(2)}
                        </div>
                        <div className="text-[9px] text-gray-400">
                          {formatLBPValue(lineCostLBP)} L.L.
                        </div>
                      </td>

                      {/* Trash action (no-print) */}
                      <td className="py-2 px-3 text-center no-print">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, 0)}
                          className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          title="Set order quantity to zero"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Order Instructions Textarea (no-print) */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 no-print">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
              Delivery Notes / Special Instructions:
            </span>
            <input
              type="text"
              placeholder="e.g., Deliver urgent morning items first, contact on arrival..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="flex-1 px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* Order Preparation Summary & Output Actions (no-print) */}
        <div className="p-3.5 border-t border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-3 no-print">
          {/* Totals */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="text-gray-500 dark:text-slate-400">Total Items:</span>
              <span className="font-extrabold text-slate-900 dark:text-slate-100">
                {orderSummary.distinctItemCount}
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-gray-500 dark:text-slate-400">Total Units:</span>
              <span className="font-extrabold text-teal-700 dark:text-teal-400">
                {orderSummary.totalUnits} Boxes
              </span>
            </div>
            <div className="flex items-center space-x-1.5 font-mono">
              <span className="text-gray-500 dark:text-slate-400">Estimated Total:</span>
              <span className="font-extrabold text-slate-900 dark:text-slate-100">
                ${orderSummary.totalCostUSD.toFixed(2)} USD
              </span>
              <span className="text-gray-400 font-sans">
                ({formatLBPValue(orderSummary.totalCostLBP)} L.L.)
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* WhatsApp Copy */}
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              disabled={orderSummary.distinctItemCount === 0}
              className={`flex items-center space-x-1.5 rounded px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                copiedWhatsApp
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="Copy formatted order to paste directly into WhatsApp for sales representatives"
            >
              {copiedWhatsApp ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedWhatsApp ? 'Copied WhatsApp!' : 'Copy for WhatsApp'}</span>
            </button>

            {/* Print Order */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={orderSummary.distinctItemCount === 0}
              className="flex items-center space-x-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 px-3 py-1.5 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Print Order Preparation Sheet"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Slip</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={orderSummary.distinctItemCount === 0}
              className="flex items-center space-x-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 px-3 py-1.5 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Download Order as CSV spreadsheet"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>

            {/* Transfer to Purchase Invoice (if supported) */}
            {onSendToPurchase && (
              <button
                type="button"
                onClick={handleTransferToPurchase}
                disabled={orderSummary.distinctItemCount === 0}
                className="flex items-center space-x-1.5 rounded bg-teal-600 hover:bg-teal-700 active:scale-95 text-white px-3.5 py-1.5 text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Create a draft purchase invoice in the Purchase tab"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Create Purchase Invoice</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
