import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  AlertTriangle,
  Clock,
  ShoppingCart,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Info,
  Package,
  Calendar,
  DollarSign,
  ArrowRight,
  Filter,
  ClipboardList,
} from 'lucide-react';
import { Product, SaleTransaction, PurchaseItem, Supplier } from '../../types/pharmacy';
import { calculateStockForecast, ProductStockForecast } from '../../utils/stockForecast';
import { formatLBPValue } from '../../utils/priceUtils';
import { formatStockDisplay } from '../../utils/stockUtils';
import { OrderPreparationModal } from './OrderPreparationModal';

interface LowStockForecastWidgetProps {
  products: Product[];
  sales: SaleTransaction[];
  suppliers: Supplier[];
  exchangeRate: number;
  onSendToPurchase: (orderData: {
    supplierId?: string;
    supplierName?: string;
    items: PurchaseItem[];
  }) => void;
  onViewProduct?: (product: Product) => void;
}

export const LowStockForecastWidget: React.FC<LowStockForecastWidgetProps> = ({
  products,
  sales,
  suppliers,
  exchangeRate,
  onSendToPurchase,
  onViewProduct,
}) => {
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'critical' | 'warning' | 'attention'>('all');
  const [targetDaysBuffer, setTargetDaysBuffer] = useState<number>(30);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isOrderPreparationOpen, setIsOrderPreparationOpen] = useState<boolean>(false);

  // Compute forecast with memoization
  const forecast = useMemo(() => {
    return calculateStockForecast(products, sales, exchangeRate, targetDaysBuffer);
  }, [products, sales, exchangeRate, targetDaysBuffer]);

  // Filtered forecast items
  const filteredItems = useMemo(() => {
    if (filterUrgency === 'all') return forecast.items;
    return forecast.items.filter((item) => item.urgency === filterUrgency);
  }, [forecast.items, filterUrgency]);

  // Toggle selection for an item
  const toggleSelect = (productId: string) => {
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

  // Select all or deselect all
  const selectAll = () => {
    if (selectedProductIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredItems.map((i) => i.product.id)));
    }
  };

  const handleQtyChange = (productId: string, val: string) => {
    const num = parseInt(val, 10);
    setCustomQuantities((prev) => ({
      ...prev,
      [productId]: isNaN(num) || num < 0 ? 0 : num,
    }));
  };

  // Compute order payload for selected items
  const selectedItemsList = useMemo(() => {
    return forecast.items.filter((item) => selectedProductIds.has(item.product.id));
  }, [forecast.items, selectedProductIds]);

  const selectedCount = selectedItemsList.length;
  const selectedTotalUnits = selectedItemsList.reduce((acc, item) => {
    const qty = customQuantities[item.product.id] ?? item.suggestedReorderQty;
    return acc + qty;
  }, 0);

  const selectedTotalUSD = selectedItemsList.reduce((acc, item) => {
    const qty = customQuantities[item.product.id] ?? item.suggestedReorderQty;
    const cost = item.product.costPriceUSD || 0;
    return acc + qty * cost;
  }, 0);

  const selectedTotalLBP = selectedItemsList.reduce((acc, item) => {
    const qty = customQuantities[item.product.id] ?? item.suggestedReorderQty;
    const cost = Math.round((item.product.costPriceUSD || 0) * exchangeRate);
    return acc + qty * cost;
  }, 0);

  const getUrgencyBadge = (item: ProductStockForecast) => {
    switch (item.urgency) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            <AlertTriangle className="h-3 w-3 text-rose-600 animate-pulse" />
            {item.currentStock === 0
              ? 'Out of Stock'
              : item.daysUntilStockout <= 1
              ? 'Depletes Today'
              : `Depletes in ${Math.round(item.daysUntilStockout)}d`}
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <Clock className="h-3 w-3 text-amber-600" />
            Depletes in {Math.round(item.daysUntilStockout)}d
          </span>
        );
      case 'attention':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <TrendingDown className="h-3 w-3 text-blue-600" />
            ~{Math.round(item.daysUntilStockout)} days buffer
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 transition-all">
      {/* Header with Title, Stats & Controls */}
      <div className="p-3.5 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="rounded bg-teal-50 p-2 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Low Stock Predictive Forecast
              </h3>
              <span className="rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                AI / Sales Velocity Model
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Analyzes historical dispensing rates (30 & 90 days) to predict stockout dates and generate smart purchase reorders.
            </p>
          </div>
        </div>

        {/* Actions & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Buffer setting */}
          <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Safety Buffer:</span>
            <select
              value={targetDaysBuffer}
              onChange={(e) => setTargetDaysBuffer(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-teal-700 dark:text-teal-400 focus:outline-none cursor-pointer"
            >
              <option value={15}>15 Days</option>
              <option value={30}>30 Days (Standard)</option>
              <option value={45}>45 Days</option>
              <option value={60}>60 Days</option>
            </select>
          </div>

          {/* Urgency Filter buttons */}
          <div className="inline-flex rounded-md shadow-2xs" role="group">
            <button
              onClick={() => setFilterUrgency('all')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-l border cursor-pointer transition-colors ${
                filterUrgency === 'all'
                  ? 'bg-slate-800 text-white border-slate-800 dark:bg-teal-600 dark:border-teal-600'
                  : 'bg-white text-slate-700 border-gray-300 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              All ({forecast.items.length})
            </button>
            <button
              onClick={() => setFilterUrgency('critical')}
              className={`px-2.5 py-1 text-[10px] font-bold border-t border-b cursor-pointer transition-colors ${
                filterUrgency === 'critical'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white text-rose-700 border-gray-300 hover:bg-rose-50 dark:bg-slate-800 dark:text-rose-400 dark:border-slate-700'
              }`}
            >
              Critical ({forecast.criticalCount})
            </button>
            <button
              onClick={() => setFilterUrgency('warning')}
              className={`px-2.5 py-1 text-[10px] font-bold border-t border-b cursor-pointer transition-colors ${
                filterUrgency === 'warning'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-amber-700 border-gray-300 hover:bg-amber-50 dark:bg-slate-800 dark:text-amber-400 dark:border-slate-700'
              }`}
            >
              Warning ({forecast.warningCount})
            </button>
            <button
              onClick={() => setFilterUrgency('attention')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-r border cursor-pointer transition-colors ${
                filterUrgency === 'attention'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-blue-700 border-gray-300 hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-400 dark:border-slate-700'
              }`}
            >
              Attention ({forecast.attentionCount})
            </button>
          </div>

          {/* Order Preparation Quick Action */}
          <button
            type="button"
            onClick={() => setIsOrderPreparationOpen(true)}
            className="flex items-center space-x-1 rounded bg-teal-600 hover:bg-teal-700 active:scale-95 text-white px-2.5 py-1 text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
            title="Open Order Preparation Form"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span>Order Preparation Form</span>
          </button>

          {/* Toggle Expand */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer"
            title={isExpanded ? 'Collapse forecast list' : 'Expand forecast list'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isExpanded && (
        <div>
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-gray-100 dark:border-slate-800 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-500 dark:text-slate-400">At-Risk Items:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{forecast.items.length}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-rose-600 dark:text-rose-400">Critical (&le;3d):</span>
              <span className="font-bold text-rose-700 dark:text-rose-300">{forecast.criticalCount}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Total Suggested Units:</span>
              <span className="font-bold text-teal-700 dark:text-teal-400">{forecast.totalSuggestedUnits} Boxes</span>
            </div>
            <div className="flex items-center space-x-2 sm:justify-end">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Est. Restock Cost:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                ${forecast.totalEstimatedCostUSD.toFixed(2)}
              </span>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              <Package className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-slate-700" />
              <p className="font-semibold text-slate-600 dark:text-slate-400">
                No items matching the selected forecast threshold.
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                All medications are currently projecting adequate stock levels for the next {targetDaysBuffer} days.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 dark:border-slate-800 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-gray-600 dark:text-slate-300">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <button
                        onClick={selectAll}
                        className="cursor-pointer text-slate-500 hover:text-slate-700 dark:text-slate-400"
                        title="Select/Deselect all filtered items"
                      >
                        {selectedProductIds.size > 0 && selectedProductIds.size === filteredItems.length ? (
                          <CheckSquare className="h-4 w-4 text-teal-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3">Product Name & Agent</th>
                    <th className="py-2.5 px-3 text-center">Current Stock</th>
                    <th className="py-2.5 px-3 text-center">Sales Velocity</th>
                    <th className="py-2.5 px-3">Forecast Status</th>
                    <th className="py-2.5 px-3 text-center">Est. Stockout</th>
                    <th className="py-2.5 px-3 text-center">Suggested Order</th>
                    <th className="py-2.5 px-3 text-right">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 font-sans">
                  {filteredItems.map((item) => {
                    const isSelected = selectedProductIds.has(item.product.id);
                    const orderQty = customQuantities[item.product.id] ?? item.suggestedReorderQty;
                    const itemCostUSD = (item.product.costPriceUSD || 0) * orderQty;
                    const itemCostLBP = Math.round((item.product.costPriceUSD || 0) * exchangeRate) * orderQty;

                    return (
                      <tr
                        key={item.product.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                          isSelected ? 'bg-teal-50/50 dark:bg-teal-950/20' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.product.id)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                        </td>

                        {/* Name & Agent */}
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>{item.product.name}</span>
                            {onViewProduct && (
                              <button
                                onClick={() => onViewProduct(item.product)}
                                className="text-[10px] text-teal-600 hover:underline cursor-pointer"
                                title="View scientific & stock details"
                              >
                                ℹ
                              </button>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-slate-400">
                            Code: {item.product.code} • Agent: {item.supplierName}
                          </div>
                        </td>

                        {/* Current Stock */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block font-bold text-xs ${
                              item.currentStock === 0
                                ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                                : item.currentStock <= item.minStockAlert
                                ? 'text-amber-600 dark:text-amber-400'
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
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            {item.dailyVelocity > 0 ? `${item.dailyVelocity} / day` : '0 / day'}
                          </div>
                          <div className="text-[9px] text-gray-400">
                            {item.unitsSold30d} sold (30d) • {item.unitsSold90d} (90d)
                          </div>
                        </td>

                        {/* Forecast Status Badge */}
                        <td className="py-2 px-3 whitespace-nowrap">{getUrgencyBadge(item)}</td>

                        {/* Est. Stockout Date */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          {item.currentStock === 0 ? (
                            <span className="font-bold text-rose-600 dark:text-rose-400">Empty</span>
                          ) : item.stockoutDate ? (
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {item.stockoutDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </div>
                              <div className="text-[9px] text-gray-400">
                                ~{Math.round(item.daysUntilStockout)} days left
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">&gt; 60 days</span>
                          )}
                        </td>

                        {/* Suggested Reorder Qty */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={orderQty}
                              onChange={(e) => handleQtyChange(item.product.id, e.target.value)}
                              className="w-16 px-1.5 py-1 text-center font-bold text-xs rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                            />
                            <span className="text-[10px] text-gray-500 font-medium">Boxes</span>
                          </div>
                        </td>

                        {/* Est Cost */}
                        <td className="py-2 px-3 text-right whitespace-nowrap font-mono">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            ${itemCostUSD.toFixed(2)}
                          </div>
                          <div className="text-[9px] text-gray-400">
                            {formatLBPValue(itemCostLBP)} LBP
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Bar: Action to Send to Purchase Tab */}
          <div className="p-3 border-t border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-gray-500 dark:text-slate-400">Selected for Reorder:</span>
              <span className="font-extrabold text-teal-700 dark:text-teal-400">
                {selectedCount} item{selectedCount === 1 ? '' : 's'} ({selectedTotalUnits} boxes)
              </span>
              {selectedCount > 0 && (
                <span className="text-gray-400 font-mono">
                  • Total: ${selectedTotalUSD.toFixed(2)} USD ({formatLBPValue(selectedTotalLBP)} LBP)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="px-2.5 py-1.5 text-xs font-semibold rounded border border-gray-300 bg-white hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
              >
                {selectedProductIds.size === filteredItems.length && filteredItems.length > 0
                  ? 'Deselect All'
                  : 'Select All Filtered'}
              </button>

              <button
                type="button"
                onClick={() => setIsOrderPreparationOpen(true)}
                className="flex items-center space-x-1.5 rounded bg-teal-600 hover:bg-teal-700 active:scale-95 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition-all cursor-pointer"
                title="Open Order Preparation Form to adjust quantities, filter by supplier, copy for WhatsApp, print, or export"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>
                  Order Preparation Form {selectedCount > 0 ? `(${selectedCount})` : `(${filteredItems.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Preparation Form Modal */}
      {isOrderPreparationOpen && (
        <OrderPreparationModal
          isOpen={isOrderPreparationOpen}
          onClose={() => setIsOrderPreparationOpen(false)}
          forecastItems={forecast.items}
          initialSelectedIds={
            selectedProductIds.size > 0
              ? selectedProductIds
              : new Set(filteredItems.map((i) => i.product.id))
          }
          initialQuantities={customQuantities}
          suppliers={suppliers}
          exchangeRate={exchangeRate}
          onSendToPurchase={onSendToPurchase}
        />
      )}
    </div>
  );
};
