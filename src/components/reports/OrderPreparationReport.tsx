import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Calendar,
  Download,
  Printer,
  Search,
  Filter,
  Layers,
  FileSpreadsheet,
  DollarSign,
  PackageCheck,
  Building2,
  Copy,
  Check,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  ArrowUpDown,
  RefreshCw,
  HelpCircle,
  Clock,
  Sparkles,
  ChevronDown,
  X,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Product, ProductCategory } from '../../types/pharmacy';
import { formatLBPValue } from '../../utils/priceUtils';
import { formatStockDisplay } from '../../utils/stockUtils';
import { formatDateTime } from '../../utils/dateUtils';

interface OrderItemRow {
  productId: string;
  productCode: string;
  barcode: string;
  productName: string;
  dosage: string;
  presentation: string;
  form: string;
  category: ProductCategory;
  agent: string;
  currentStock: number;
  minStockAlert: number;
  soldQuantity: number;
  soldBoxes: number;
  soldPieces: number;
  unitCostUSD: number;
  orderQuantity: number;
}

export const OrderPreparationReport: React.FC = () => {
  const { sales, products, purchases, suppliers, settings, exchangeRate, formatUSD } = usePharmacy();

  // Date Range Filters
  const todayStr = new Date().toISOString().split('T')[0];
  const [datePreset, setDatePreset] = useState<
    'today' | 'yesterday' | 'last3' | 'last7' | 'last14' | 'thisMonth' | 'custom'
  >('last7');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Additional Filters
  const [selectedAgent, setSelectedAgent] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'any_stock' | 'sold_unsold' | 'zero_stock' | 'all'>('any_stock');
  const [sortBy, setSortBy] = useState<'sold_desc' | 'name_asc' | 'cost_desc' | 'stock_asc'>('sold_desc');

  // Order Quantities State: Map<productId, orderQuantity>
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  
  // Active row index for keyboard navigation
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);

  // Clipboard copy state
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState<boolean>(false);

  // References to input elements for keyboard arrow navigation
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  // Handle preset date changes
  const handlePresetChange = (preset: 'today' | 'yesterday' | 'last3' | 'last7' | 'last14' | 'thisMonth' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yest = d.toISOString().split('T')[0];
      setStartDate(yest);
      setEndDate(yest);
    } else if (preset === 'last3') {
      const d = new Date();
      d.setDate(d.getDate() - 3);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(today);
    } else if (preset === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(today);
    } else if (preset === 'last14') {
      const d = new Date();
      d.setDate(d.getDate() - 14);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(today);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(today);
    }
  };

  // Product quick lookup
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Importers / Agents / Suppliers list
  const agentsList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.agent && p.agent.trim()) {
        set.add(p.agent.trim());
      }
    });
    suppliers.forEach((s) => {
      if (s.name && s.name.trim()) {
        set.add(s.name.trim());
      }
    });
    purchases.forEach((inv) => {
      if (inv.supplierName && inv.supplierName.trim()) {
        set.add(inv.supplierName.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products, suppliers, purchases]);

  // Aggregate items sold in the defined date period
  const rawSoldItems = useMemo(() => {
    const startTimestamp = new Date(`${startDate}T00:00:00`).getTime();
    const endTimestamp = new Date(`${endDate}T23:59:59.999`).getTime();

    // Map of productId -> aggregation
    const map = new Map<
      string,
      {
        productId: string;
        productCode: string;
        barcode: string;
        productName: string;
        dosage: string;
        presentation: string;
        form: string;
        category: ProductCategory;
        agent: string;
        currentStock: number;
        minStockAlert: number;
        soldQuantity: number;
        soldBoxes: number;
        soldPieces: number;
        unitCostUSD: number;
      }
    >();

    sales.forEach((sale) => {
      if (sale.isUnreal) return;
      const saleTime = sale.timestamp || new Date(sale.date).getTime();
      if (saleTime < startTimestamp || saleTime > endTimestamp) return;

      sale.items.forEach((item) => {
        const prod = productMap.get(item.productId);
        const agent = prod?.agent || 'Unassigned';
        const currentStock = prod ? prod.stockQuantity : 0;
        const minStockAlert = prod ? prod.minStockAlert : 0;
        const unitCostUSD = prod?.costPriceUSD || item.costPriceUSD || 0;

        const existing = map.get(item.productId);
        if (existing) {
          existing.soldQuantity += item.quantity;
          if (item.isPiece) {
            existing.soldPieces += item.quantity;
          } else {
            existing.soldBoxes += item.quantity;
          }
        } else {
          map.set(item.productId, {
            productId: item.productId,
            productCode: item.productCode || prod?.code || '',
            barcode: prod?.barcode || '',
            productName: item.productName || prod?.name || 'Unknown Product',
            dosage: prod?.dosage || '',
            presentation: prod?.presentation || '',
            form: prod?.form || '',
            category: item.category || prod?.category || 'drug',
            agent,
            currentStock,
            minStockAlert,
            soldQuantity: item.quantity,
            soldBoxes: item.isPiece ? 0 : item.quantity,
            soldPieces: item.isPiece ? item.quantity : 0,
            unitCostUSD,
          });
        }
      });
    });

    return Array.from(map.values());
  }, [sales, startDate, endDate, productMap]);

  // Synchronize default suggested order quantities (defaulting to quantity sold)
  useEffect(() => {
    setOrderQuantities((prev) => {
      const next = { ...prev };
      rawSoldItems.forEach((item) => {
        // If user hasn't explicitly set or cleared it yet, default to the sold quantity
        if (next[item.productId] === undefined) {
          next[item.productId] = Math.max(0, Math.ceil(item.soldQuantity));
        }
      });
      return next;
    });
  }, [rawSoldItems]);

  // Combine raw aggregation with current order quantities and apply UI filters
  const filteredOrderRows = useMemo(() => {
    let list: OrderItemRow[] = [];

    if (stockStatusFilter === 'sold_unsold') {
      // Map of items sold in the defined period
      const soldMap = new Map<string, (typeof rawSoldItems)[0]>();
      rawSoldItems.forEach((item) => soldMap.set(item.productId, item));

      // Filter catalog products based on the selected supplier / importer agent
      const candidateProducts = products.filter((p) => {
        if (selectedAgent === 'ALL') return true;
        const agent = (p.agent || '').trim().toLowerCase();
        return agent === selectedAgent.trim().toLowerCase();
      });

      // Include all items (both sold and unsold) for the chosen agent
      list = candidateProducts.map((prod) => {
        const soldRecord = soldMap.get(prod.id);
        const soldQty = soldRecord ? soldRecord.soldQuantity : 0;
        const soldBoxes = soldRecord ? soldRecord.soldBoxes : 0;
        const soldPieces = soldRecord ? soldRecord.soldPieces : 0;

        const defaultQty = soldRecord ? Math.max(0, Math.ceil(soldQty)) : 0;
        const qty = orderQuantities[prod.id] !== undefined ? orderQuantities[prod.id] : defaultQty;

        return {
          productId: prod.id,
          productCode: prod.code || '',
          barcode: prod.barcode || '',
          productName: prod.name,
          dosage: prod.dosage || '',
          presentation: prod.presentation || '',
          form: prod.form || '',
          category: prod.category || 'drug',
          agent: prod.agent || 'Unassigned',
          currentStock: prod.stockQuantity,
          minStockAlert: prod.minStockAlert ?? 0,
          soldQuantity: soldQty,
          soldBoxes,
          soldPieces,
          unitCostUSD: prod.costPriceUSD || 0,
          orderQuantity: Math.max(0, qty),
        };
      });
    } else {
      // Standard sold items mode
      list = rawSoldItems.map((item) => {
        const qty = orderQuantities[item.productId] !== undefined ? orderQuantities[item.productId] : item.soldQuantity;
        return {
          ...item,
          orderQuantity: Math.max(0, qty),
        };
      });

      // Agent / Supplier filter
      if (selectedAgent !== 'ALL') {
        list = list.filter((r) => r.agent.toLowerCase() === selectedAgent.toLowerCase());
      }

      // Stock status filter ('any_stock' includes all items despite their stock quantity; 'zero_stock' isolates stock = 0)
      if (stockStatusFilter === 'zero_stock') {
        list = list.filter((r) => r.currentStock <= 0);
      }
    }

    // Category filter
    if (selectedCategory !== 'ALL') {
      list = list.filter((r) => r.category === selectedCategory);
    }

    // Search query filter (name, barcode, code, dosage)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.barcode.toLowerCase().includes(q) ||
          r.productCode.toLowerCase().includes(q) ||
          r.dosage.toLowerCase().includes(q) ||
          r.agent.toLowerCase().includes(q)
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'sold_desc') return b.soldQuantity - a.soldQuantity;
      if (sortBy === 'name_asc') return a.productName.localeCompare(b.productName);
      if (sortBy === 'cost_desc') return b.orderQuantity * b.unitCostUSD - a.orderQuantity * a.unitCostUSD;
      if (sortBy === 'stock_asc') return a.currentStock - b.currentStock;
      return 0;
    });

    return list;
  }, [rawSoldItems, products, orderQuantities, selectedAgent, selectedCategory, searchQuery, stockStatusFilter, sortBy]);

  // Overall order financial summary
  const orderSummary = useMemo(() => {
    let totalItemsOrdered = 0;
    let totalUnitsOrdered = 0;
    let totalOrderCostUSD = 0;
    let totalSoldUnits = 0;
    let distinctSoldItemsCount = 0;

    filteredOrderRows.forEach((row) => {
      if (row.soldQuantity > 0) {
        distinctSoldItemsCount += 1;
        totalSoldUnits += row.soldQuantity;
      }
      if (row.orderQuantity > 0) {
        totalItemsOrdered += 1;
        totalUnitsOrdered += row.orderQuantity;
        totalOrderCostUSD += row.orderQuantity * row.unitCostUSD;
      }
    });

    const totalOrderCostLBP = Math.round(totalOrderCostUSD * exchangeRate);

    return {
      distinctSoldItemsCount,
      totalSoldUnits,
      totalItemsOrdered,
      totalUnitsOrdered,
      totalOrderCostUSD,
      totalOrderCostLBP,
    };
  }, [filteredOrderRows, exchangeRate]);

  // Update order quantity for a specific product
  const updateQuantity = useCallback((productId: string, qty: number) => {
    const validQty = Math.max(0, isNaN(qty) ? 0 : Math.round(qty));
    setOrderQuantities((prev) => ({
      ...prev,
      [productId]: validQty,
    }));
  }, []);

  // Batch actions
  const handleSetAllToSold = () => {
    setOrderQuantities((prev) => {
      const next = { ...prev };
      filteredOrderRows.forEach((r) => {
        next[r.productId] = Math.max(0, Math.ceil(r.soldQuantity));
      });
      return next;
    });
  };

  const handleSetAllToDeficit = () => {
    setOrderQuantities((prev) => {
      const next = { ...prev };
      filteredOrderRows.forEach((r) => {
        const deficit = Math.max(0, r.minStockAlert - r.currentStock);
        next[r.productId] = deficit > 0 ? deficit : Math.max(0, Math.ceil(r.soldQuantity));
      });
      return next;
    });
  };

  const handleClearAllQuantities = () => {
    setOrderQuantities((prev) => {
      const next = { ...prev };
      filteredOrderRows.forEach((r) => {
        next[r.productId] = 0;
      });
      return next;
    });
  };

  // Focus input helper with automatic text selection
  const focusRowInput = useCallback((index: number) => {
    if (index < 0 || index >= filteredOrderRows.length) return;
    setActiveRowIndex(index);
    const el = inputRefs.current.get(index);
    if (el) {
      el.focus();
      el.select();
    }
  }, [filteredOrderRows.length]);

  // Keyboard navigation handler for the order table
  const handleKeyDown = (e: React.KeyboardEvent, index: number, productId: string, currentQty: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = Math.min(filteredOrderRows.length - 1, index + 1);
      focusRowInput(nextIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = Math.max(0, index - 1);
      focusRowInput(prevIdx);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Enter goes up
        const prevIdx = Math.max(0, index - 1);
        focusRowInput(prevIdx);
      } else {
        // Enter advances to the next row and selects text
        const nextIdx = index + 1;
        if (nextIdx < filteredOrderRows.length) {
          focusRowInput(nextIdx);
        } else {
          // Wrap or stay on last row
          focusRowInput(0);
        }
      }
    } else if (e.key === ' ' && e.ctrlKey) {
      // Ctrl+Space toggles between 0 and sold quantity
      e.preventDefault();
      const row = filteredOrderRows[index];
      const newQty = currentQty > 0 ? 0 : Math.max(1, Math.ceil(row.soldQuantity));
      updateQuantity(productId, newQty);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Product Code',
      'Barcode',
      'Product Name',
      'Dosage',
      'Presentation',
      'Form',
      'Category',
      'Supplier / Agent',
      'Current Stock',
      'Min Stock Alert',
      `Sold in Period (${startDate} to ${endDate})`,
      'ORDER QUANTITY',
      'Unit Cost USD',
      'Total Cost USD',
    ];

    const rows = filteredOrderRows.map((r) => [
      `"${r.productCode}"`,
      `"${r.barcode}"`,
      `"${r.productName.replace(/"/g, '""')}"`,
      `"${r.dosage.replace(/"/g, '""')}"`,
      `"${r.presentation.replace(/"/g, '""')}"`,
      `"${r.form.replace(/"/g, '""')}"`,
      `"${r.category}"`,
      `"${r.agent.replace(/"/g, '""')}"`,
      r.currentStock,
      r.minStockAlert,
      r.soldQuantity,
      r.orderQuantity,
      r.unitCostUSD.toFixed(2),
      (r.orderQuantity * r.unitCostUSD).toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Supplier_Order_Preparation_${selectedAgent !== 'ALL' ? selectedAgent + '_' : ''}${startDate}_to_${endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy order formatted for WhatsApp
  const handleCopyWhatsApp = () => {
    const orderedItems = filteredOrderRows.filter((r) => r.orderQuantity > 0);
    if (orderedItems.length === 0) {
      alert('No items have an order quantity greater than 0.');
      return;
    }

    const supplierTitle = selectedAgent !== 'ALL' ? selectedAgent : 'Suppliers Order';
    const pharmacyName = settings.pharmacyName || 'PharmaLeb';
    const today = new Date().toLocaleDateString('en-GB');

    let text = `📦 *${pharmacyName.toUpperCase()} - ORDER PREPARATION*\n`;
    text += `🏢 *Supplier / Agent:* ${supplierTitle}\n`;
    text += `📅 *Date:* ${today} (Based on sales: ${startDate} to ${endDate})\n`;
    text += `----------------------------------------\n`;

    orderedItems.forEach((item, idx) => {
      const presentationStr = item.dosage ? ` (${item.dosage})` : '';
      text += `${idx + 1}. *${item.productName}${presentationStr}* ➔ *Qty: ${item.orderQuantity}*\n`;
      if (item.barcode) {
        text += `   [Barcode: ${item.barcode}]\n`;
      }
    });

    text += `----------------------------------------\n`;
    text += `📊 *Total Items:* ${orderedItems.length} | *Total Units:* ${orderSummary.totalUnitsOrdered}\n`;
    text += `💵 *Est. Cost:* $${orderSummary.totalOrderCostUSD.toFixed(2)} (${formatLBPValue(orderSummary.totalOrderCostLBP)} L.L.)\n`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 3000);
    });
  };

  // Print Order
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* Control & Filter Card (Hidden when printing) */}
      <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        {/* Date Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'last3', label: 'Last 3 Days' },
                  { id: 'last7', label: 'Last 7 Days' },
                  { id: 'last14', label: 'Last 14 Days' },
                  { id: 'thisMonth', label: 'This Month' },
                  { id: 'custom', label: 'Custom' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetChange(preset.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    datePreset === preset.id
                      ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-[11px] uppercase tracking-wider">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <span className="font-semibold text-[11px] uppercase tracking-wider">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Action Buttons: Print, Export, WhatsApp */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowKeyboardHelp((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              title="Toggle Keyboard Shortcuts"
            >
              <HelpCircle className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span>Shortcuts</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer transition-all active:scale-95"
              title="Copy Order formatted for WhatsApp/SMS to clipboard"
            >
              {copiedWhatsApp ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-emerald-600" />}
              <span>{copiedWhatsApp ? 'Copied Order!' : 'Copy for WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              title="Download CSV for Excel"
            >
              <Download className="h-3.5 w-3.5 text-teal-600" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 active:bg-teal-800 dark:bg-teal-600 cursor-pointer transition-all"
              title="Print Order Sheet (Ctrl+P)"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Order</span>
            </button>
          </div>
        </div>

        {/* Secondary Filter Row: Supplier/Agent, Category, Status, Search, Batch Quantity Presets */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3">
          {/* Supplier / Agent Dropdown */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Building2 className="h-3 w-3 text-teal-600" /> Supplier / Importer Agent:
            </label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">All Suppliers / Agents ({agentsList.length})</option>
              {agentsList.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Filter: Status */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Filter className="h-3 w-3 text-teal-600" /> Stock Filter:
            </label>
            <select
              id="order-stock-status-filter"
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className={`w-full rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-xs transition-all duration-150 focus:outline-none focus:ring-2 cursor-pointer ${
                stockStatusFilter === 'sold_unsold'
                  ? 'border-teal-500/80 bg-teal-50/70 text-teal-900 focus:border-teal-600 focus:ring-teal-500/20 dark:border-teal-500/60 dark:bg-teal-950/40 dark:text-teal-200'
                  : 'border-slate-300/90 bg-white text-slate-800 hover:border-teal-500/70 focus:border-teal-600 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-teal-400 dark:focus:border-teal-500'
              }`}
            >
              <option value="any_stock">Any Stock</option>
              <option value="zero_stock">Out of Stock (Stock = 0)</option>
              <option value="sold_unsold">Sold/Unsold</option>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Search className="h-3 w-3 text-teal-600" /> Search Item / Barcode:
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Product name, barcode, code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-7 py-1.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Batch Quick Adjustments */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-teal-600" /> Quick Quantity Setup:
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSetAllToSold}
                className="flex-1 rounded-md bg-teal-50 hover:bg-teal-100 border border-teal-200 py-1.5 px-2 text-[11px] font-bold text-teal-800 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-300 cursor-pointer transition-all active:scale-95"
                title="Set Order Quantity to exact Quantity Sold during this period"
              >
                Set to Sold Qty
              </button>
              <button
                type="button"
                onClick={handleSetAllToDeficit}
                className="flex-1 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-200 py-1.5 px-2 text-[11px] font-bold text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 cursor-pointer transition-all active:scale-95"
                title="Fill stock deficit to minimum alert level"
              >
                Fill Min Stock
              </button>
              <button
                type="button"
                onClick={handleClearAllQuantities}
                className="rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 py-1.5 px-2.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 cursor-pointer transition-all active:scale-95"
                title="Reset all order quantities to 0"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts Helper Ribbon */}
        {showKeyboardHelp && (
          <div className="mt-3 p-2.5 rounded-md bg-teal-900 text-teal-100 text-[11px] flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="font-bold text-teal-300">Keyboard Rapid Entry:</span>
              <span>Use your keyboard to adjust quantities effortlessly without touching the mouse:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
              <span className="bg-teal-800 px-2 py-0.5 rounded border border-teal-700">↑ / ↓ : Navigate Rows</span>
              <span className="bg-teal-800 px-2 py-0.5 rounded border border-teal-700">Enter : Save &amp; Next Row</span>
              <span className="bg-teal-800 px-2 py-0.5 rounded border border-teal-700">Shift+Enter : Previous Row</span>
              <span className="bg-teal-800 px-2 py-0.5 rounded border border-teal-700">Ctrl+Space : Toggle 0 / Sold</span>
            </div>
          </div>
        )}
      </div>

      {/* KPI Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Clock className="h-3 w-3 text-teal-600" /> Items Sold in Period
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 dark:text-slate-100">
              {orderSummary.distinctSoldItemsCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({orderSummary.totalSoldUnits} units dispensed)
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ShoppingCart className="h-3 w-3 text-teal-600" /> Selected for Order
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-teal-700 dark:text-teal-400">
              {orderSummary.totalItemsOrdered}
            </span>
            <span className="text-xs font-semibold text-teal-800 dark:text-teal-300">
              products ({orderSummary.totalUnitsOrdered} total boxes/units)
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-teal-600" /> Estimated Cost (USD)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 dark:text-slate-100">
              ${orderSummary.totalOrderCostUSD.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Building2 className="h-3 w-3 text-teal-600" /> Estimated Cost (LBP)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 dark:text-slate-100">
              {formatLBPValue(orderSummary.totalOrderCostLBP)}
            </span>
            <span className="text-[11px] font-medium text-slate-400">L.L.</span>
          </div>
        </div>
      </div>

      {/* Printable Purchase Order Sheet Header (Visible when printing or on desktop) */}
      <div className="hidden print:block mb-4 p-4 border-b border-slate-300 text-slate-900">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide">
              {settings.pharmacyName || 'PharmaLeb'} - Order Preparation Sheet
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {settings.pharmacyAddress && <span>{settings.pharmacyAddress} • </span>}
              {settings.pharmacyPhone && <span>Tel: {settings.pharmacyPhone}</span>}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">Printed: {formatDateTime(new Date())}</p>
            <p className="text-slate-600">Period: {startDate} to {endDate}</p>
            <p className="text-slate-600">Supplier / Agent: {selectedAgent !== 'ALL' ? selectedAgent : 'All Suppliers'}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-4 text-xs bg-slate-100 p-2 rounded">
          <div><strong>Items to Order:</strong> {orderSummary.totalItemsOrdered}</div>
          <div><strong>Total Units:</strong> {orderSummary.totalUnitsOrdered}</div>
          <div><strong>Estimated Cost USD:</strong> ${orderSummary.totalOrderCostUSD.toFixed(2)}</div>
          <div><strong>Estimated Cost LBP:</strong> {formatLBPValue(orderSummary.totalOrderCostLBP)} L.L.</div>
        </div>
      </div>

      {/* Interactive Order Table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
                <th className="py-2.5 px-3 w-10 text-center no-print">#</th>
                <th className="py-2.5 px-3 w-28">Barcode / Code</th>
                <th className="py-2.5 px-3 min-w-[200px]">Product Description</th>
                <th className="py-2.5 px-3 w-32">Supplier / Agent</th>
                <th className="py-2.5 px-3 w-20 text-center">Stock</th>
                <th
                  className="py-2.5 px-3 w-20 text-center cursor-help"
                  title="Minimum Stock Alert Threshold: Safety buffer defined per medication"
                >
                  Min Alert
                </th>
                <th className="py-2.5 px-3 w-24 text-center bg-teal-50/50 dark:bg-teal-950/20">
                  Sold in Period
                </th>
                <th className="py-2.5 px-3 w-36 text-center bg-teal-100/60 dark:bg-teal-900/40 text-teal-950 dark:text-teal-200">
                  Order Qty
                </th>
                <th className="py-2.5 px-3 w-24 text-right">Cost (USD)</th>
                <th className="py-2.5 px-3 w-28 text-right">Total (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filteredOrderRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <AlertCircle className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                      No sold items found matching the selected period and filters.
                    </p>
                    <p className="text-xs mt-1 text-slate-400">
                      Try choosing a wider date range or clearing your supplier/search filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrderRows.map((row, index) => {
                  const isActive = activeRowIndex === index;
                  const isOrdered = row.orderQuantity > 0;
                  const totalRowCostUSD = row.orderQuantity * row.unitCostUSD;

                  // Stock warning pills
                  const isOutOfStock = row.currentStock <= 0;
                  const isLowStock = row.currentStock <= row.minStockAlert;

                  return (
                    <tr
                      key={row.productId}
                      onClick={() => focusRowInput(index)}
                      className={`transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-teal-50/80 dark:bg-teal-950/40 ring-1 ring-inset ring-teal-500'
                          : isOrdered
                          ? 'bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Row Index */}
                      <td className="py-2 px-3 text-center text-[11px] font-mono text-slate-400 no-print">
                        {index + 1}
                      </td>

                      {/* Barcode & Code */}
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{row.barcode || '—'}</div>
                        <div className="text-[10px] text-slate-400">{row.productCode}</div>
                      </td>

                      {/* Product Name, Dosage, Form */}
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{row.productName}</span>
                          {row.dosage && (
                            <span className="rounded bg-slate-100 px-1 py-0.2 text-[10px] font-normal text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              {row.dosage}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                          {row.form && <span>{row.form}</span>}
                          {row.presentation && <span>• {row.presentation}</span>}
                        </div>
                      </td>

                      {/* Supplier / Agent */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                          <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[120px]">{row.agent}</span>
                        </span>
                      </td>

                      {/* Stock Level */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {formatStockDisplay(row.currentStock)}
                        </span>
                      </td>

                      {/* Min Stock Alert */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                            isLowStock || isOutOfStock
                              ? 'bg-amber-100/80 text-amber-900 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                          title={`Safety buffer threshold: ${row.minStockAlert} units (${
                            isLowStock ? 'Triggered: current stock is at or below this threshold' : 'Stock is above minimum threshold'
                          })`}
                        >
                          {row.minStockAlert}
                        </span>
                      </td>

                      {/* Sold in Period */}
                      <td className="py-2 px-3 text-center font-bold text-teal-800 dark:text-teal-300 bg-teal-50/40 dark:bg-teal-950/20">
                        {row.soldQuantity > 0 ? (
                          row.soldQuantity
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-500">
                            0 (Unsold)
                          </span>
                        )}
                      </td>

                      {/* Order Quantity Input with Stepper Buttons (Keyboard-First target) */}
                      <td className="py-1.5 px-3 text-center bg-teal-50/60 dark:bg-teal-900/20">
                        <div
                          className="inline-flex items-center justify-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => updateQuantity(row.productId, row.orderQuantity - 1)}
                            className="rounded p-1 text-slate-500 hover:bg-teal-200/60 hover:text-teal-900 dark:hover:bg-teal-800 dark:hover:text-white cursor-pointer no-print"
                            title="Decrease quantity by 1"
                            tabIndex={-1}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>

                          <input
                            ref={(el) => {
                              if (el) inputRefs.current.set(index, el);
                              else inputRefs.current.delete(index);
                            }}
                            type="number"
                            min="0"
                            step="1"
                            value={row.orderQuantity}
                            onFocus={() => setActiveRowIndex(index)}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              updateQuantity(row.productId, isNaN(val) ? 0 : val);
                            }}
                            onKeyDown={(e) => handleKeyDown(e, index, row.productId, row.orderQuantity)}
                            className={`w-16 rounded border text-center font-bold text-xs py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                              isOrdered
                                ? 'border-teal-500 bg-white dark:bg-slate-800 text-teal-900 dark:text-teal-100 font-black shadow-2xs'
                                : 'border-slate-300 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800 text-slate-400'
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => updateQuantity(row.productId, row.orderQuantity + 1)}
                            className="rounded p-1 text-slate-500 hover:bg-teal-200/60 hover:text-teal-900 dark:hover:bg-teal-800 dark:hover:text-white cursor-pointer no-print"
                            title="Increase quantity by 1"
                            tabIndex={-1}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Unit Cost USD */}
                      <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        ${row.unitCostUSD.toFixed(2)}
                      </td>

                      {/* Ext Total Cost USD */}
                      <td className="py-2 px-3 text-right font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">
                        ${totalRowCostUSD.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer Totals */}
            {filteredOrderRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100/80 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <td colSpan={6} className="py-3 px-3 text-right text-xs uppercase tracking-wider">
                    Total Order Value ({orderSummary.totalItemsOrdered} items selected):
                  </td>
                  <td className="py-3 px-3 text-center text-xs font-black text-teal-800 dark:text-teal-300">
                    {orderSummary.totalSoldUnits}
                  </td>
                  <td className="py-3 px-3 text-center text-sm font-black text-teal-900 dark:text-teal-200 bg-teal-200/40 dark:bg-teal-900/60">
                    {orderSummary.totalUnitsOrdered}
                  </td>
                  <td className="py-3 px-3 text-right text-xs text-slate-500">—</td>
                  <td className="py-3 px-3 text-right text-sm font-black text-slate-900 dark:text-white whitespace-nowrap">
                    <div>${orderSummary.totalOrderCostUSD.toFixed(2)}</div>
                    <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                      {formatLBPValue(orderSummary.totalOrderCostLBP)} L.L.
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer Navigation Bar (Hidden when printing) */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400 no-print">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Showing {filteredOrderRows.length} {stockStatusFilter === 'sold_unsold' ? 'items (sold & unsold)' : 'sold items'}
            </span>
            <span>•</span>
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px] text-slate-800 dark:text-slate-200">Enter</kbd> to edit &amp; advance to next item</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Order Ready:</span>
            <span className="font-bold text-teal-700 dark:text-teal-300">
              {orderSummary.totalUnitsOrdered} units (${orderSummary.totalOrderCostUSD.toFixed(2)})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
