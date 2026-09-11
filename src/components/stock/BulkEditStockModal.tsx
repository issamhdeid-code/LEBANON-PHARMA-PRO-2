import React, { useState, useMemo } from 'react';
import {
  Layers,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Boxes,
  Tag,
  Building2,
  Calendar,
  Percent,
  Split,
  Pill,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Product, ProductCategory } from '../../types/pharmacy';
import { DesktopWindow } from '../common/DesktopWindow';
import { formatLBPValue } from '../../utils/priceUtils';

interface BulkEditStockModalProps {
  selectedProducts: Product[];
  onClose: () => void;
  onSuccess?: () => void;
}

type PriceAdjustmentType = 'percentage' | 'fixed_add_usd' | 'set_fixed_usd' | 'recalc_lbp_from_usd';
type StockAdjustmentType = 'add' | 'subtract' | 'set';

export const BulkEditStockModal: React.FC<BulkEditStockModalProps> = ({
  selectedProducts,
  onClose,
  onSuccess,
}) => {
  const { bulkUpdateProducts, exchangeRate, formatLBP, formatUSD, suppliers } = usePharmacy();

  // Field activation toggles
  const [applyCategory, setApplyCategory] = useState(false);
  const [categoryValue, setCategoryValue] = useState<ProductCategory>('drug');

  const [applyAgent, setApplyAgent] = useState(false);
  const [agentValue, setAgentValue] = useState(suppliers[0]?.name || 'Mersaco Sal');
  const [customAgent, setCustomAgent] = useState('');

  const [applyForm, setApplyForm] = useState(false);
  const [formValue, setFormValue] = useState('Tablet');

  const [applyPriceAdjustment, setApplyPriceAdjustment] = useState(false);
  const [priceAdjustmentType, setPriceAdjustmentType] = useState<PriceAdjustmentType>('percentage');
  const [priceAdjustmentValue, setPriceAdjustmentValue] = useState<string>('10');

  const [applyMargin, setApplyMargin] = useState(false);
  const [marginValue, setMarginValue] = useState<string>('20');

  const [applyStockQuantity, setApplyStockQuantity] = useState(false);
  const [stockAdjustmentType, setStockAdjustmentType] = useState<StockAdjustmentType>('add');
  const [stockAdjustmentValue, setStockAdjustmentValue] = useState<string>('10');

  const [applyMinStockAlert, setApplyMinStockAlert] = useState(false);
  const [minStockAlertValue, setMinStockAlertValue] = useState<string>('5');

  const [applyDivisible, setApplyDivisible] = useState(false);
  const [isDivisibleValue, setIsDivisibleValue] = useState<boolean>(true);
  const [piecesPerBoxValue, setPiecesPerBoxValue] = useState<string>('20');
  const [pieceNameValue, setPieceNameValue] = useState<string>('Strip');

  const [applyExpiryBatch, setApplyExpiryBatch] = useState(false);
  const [expiryValue, setExpiryValue] = useState<string>('');
  const [batchValue, setBatchValue] = useState<string>('');

  const [isApplying, setIsApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Common dosage forms
  const commonForms = [
    'Tablet',
    'Capsule',
    'Syrup',
    'Suspension',
    'Injectable',
    'Ampoule',
    'Cream',
    'Ointment',
    'Drops',
    'Gel',
    'Spray',
    'Suppository',
    'Sachet',
  ];

  // Helper function to calculate new values for a given product
  const computeProductUpdates = (prod: Product): Partial<Product> => {
    const updates: Partial<Product> = {};

    if (applyCategory) {
      updates.category = categoryValue;
    }

    if (applyAgent) {
      const finalAgent = customAgent.trim() || agentValue;
      if (finalAgent) updates.agent = finalAgent;
    }

    if (applyForm) {
      updates.form = formValue.trim();
    }

    let nextPriceUSD = prod.priceUSD;
    let nextPriceLBP = prod.priceLBP;

    if (applyPriceAdjustment) {
      const val = parseFloat(priceAdjustmentValue) || 0;
      if (priceAdjustmentType === 'percentage') {
        const factor = 1 + val / 100;
        nextPriceUSD = Math.max(0, Number((prod.priceUSD * factor).toFixed(2)));
        nextPriceLBP = Math.max(0, Math.round(nextPriceUSD * exchangeRate));
      } else if (priceAdjustmentType === 'fixed_add_usd') {
        nextPriceUSD = Math.max(0, Number((prod.priceUSD + val).toFixed(2)));
        nextPriceLBP = Math.max(0, Math.round(nextPriceUSD * exchangeRate));
      } else if (priceAdjustmentType === 'set_fixed_usd') {
        nextPriceUSD = Math.max(0, Number(val.toFixed(2)));
        nextPriceLBP = Math.max(0, Math.round(nextPriceUSD * exchangeRate));
      } else if (priceAdjustmentType === 'recalc_lbp_from_usd') {
        nextPriceLBP = Math.max(0, Math.round(prod.priceUSD * exchangeRate));
      }
      updates.priceUSD = nextPriceUSD;
      updates.priceLBP = nextPriceLBP;
    }

    if (applyMargin) {
      const margin = parseFloat(marginValue) || 20;
      updates.pharmacistMarginProfit = margin;
      const targetUSD = updates.priceUSD !== undefined ? updates.priceUSD : prod.priceUSD;
      updates.costPriceUSD = Number((targetUSD * (1 - margin / 100)).toFixed(2));
    }

    if (applyStockQuantity) {
      const val = parseInt(stockAdjustmentValue, 10) || 0;
      let newStock = prod.stockQuantity;
      if (stockAdjustmentType === 'add') {
        newStock = Math.max(0, prod.stockQuantity + val);
      } else if (stockAdjustmentType === 'subtract') {
        newStock = Math.max(0, prod.stockQuantity - val);
      } else if (stockAdjustmentType === 'set') {
        newStock = Math.max(0, val);
      }
      updates.stockQuantity = newStock;
    }

    if (applyMinStockAlert) {
      const alertVal = parseInt(minStockAlertValue, 10) || 0;
      updates.minStockAlert = Math.max(0, alertVal);
    }

    if (applyDivisible) {
      updates.isDivisible = isDivisibleValue;
      if (isDivisibleValue) {
        const pieces = parseInt(piecesPerBoxValue, 10) || 0;
        updates.piecesPerBox = pieces > 0 ? pieces : undefined;
        updates.pieceName = pieceNameValue.trim() || undefined;
        const currentUSD = updates.priceUSD !== undefined ? updates.priceUSD : prod.priceUSD;
        if (pieces > 0 && currentUSD > 0) {
          updates.piecePriceUSD = Number((currentUSD / pieces).toFixed(2));
        }
      } else {
        updates.piecesPerBox = undefined;
        updates.pieceName = undefined;
        updates.piecePriceUSD = undefined;
      }
    }

    if (applyExpiryBatch) {
      if (expiryValue.trim()) {
        updates.expiryDate = expiryValue.trim();
      }
      if (batchValue.trim()) {
        updates.batchNumber = batchValue.trim();
      }
    }

    return updates;
  };

  // Check how many changes are enabled
  const activeChangesCount = [
    applyCategory,
    applyAgent,
    applyForm,
    applyPriceAdjustment,
    applyMargin,
    applyStockQuantity,
    applyMinStockAlert,
    applyDivisible,
    applyExpiryBatch,
  ].filter(Boolean).length;

  // Preview sample of first 3 items
  const previewItems = useMemo(() => {
    return selectedProducts.slice(0, 3).map((prod) => {
      const updates = computeProductUpdates(prod);
      return {
        original: prod,
        updates,
      };
    });
  }, [
    selectedProducts,
    applyCategory,
    categoryValue,
    applyAgent,
    agentValue,
    customAgent,
    applyForm,
    formValue,
    applyPriceAdjustment,
    priceAdjustmentType,
    priceAdjustmentValue,
    applyMargin,
    marginValue,
    applyStockQuantity,
    stockAdjustmentType,
    stockAdjustmentValue,
    applyMinStockAlert,
    minStockAlertValue,
    applyDivisible,
    isDivisibleValue,
    piecesPerBoxValue,
    pieceNameValue,
    applyExpiryBatch,
    expiryValue,
    batchValue,
  ]);

  const handleApply = () => {
    if (activeChangesCount === 0) return;
    setIsApplying(true);

    try {
      const ids = selectedProducts.map((p) => p.id);
      bulkUpdateProducts(ids, (product) => computeProductUpdates(product));
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Bulk update error:', err);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <DesktopWindow
      id="stock-bulk-edit-modal"
      title={`Bulk Edit Inventory — ${selectedProducts.length} Items Selected`}
      isOpen={true}
      section="stock"
      onClose={onClose}
      width="820px"
      height="85vh"
      minWidth={550}
      minHeight={450}
    >
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
        {/* Top Info Banner */}
        <div className="px-4 py-2.5 bg-teal-50/80 dark:bg-teal-950/40 border-b border-teal-200 dark:border-teal-900/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-teal-600 text-white shadow-2xs">
              {selectedProducts.length} Products
            </span>
            <span className="text-xs text-teal-900 dark:text-teal-200 font-medium">
              Only checked sections below will be updated. Unchecked fields remain unchanged.
            </span>
          </div>
          <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">
            {activeChangesCount} {activeChangesCount === 1 ? 'action' : 'actions'} armed
          </span>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {/* Section: Category */}
          <div
            className={`p-3 rounded-lg border transition-all ${
              applyCategory
                ? 'bg-white dark:bg-slate-800/90 border-teal-500/80 shadow-xs'
                : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={applyCategory}
                  onChange={(e) => setApplyCategory(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                />
                <Tag className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>Update Category / Classification</span>
              </label>
              {applyCategory && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Armed
                </span>
              )}
            </div>

            {applyCategory && (
              <div className="pl-6 pt-1 flex flex-wrap gap-2">
                {(['drug', 'vitamins', 'cosmetics', 'para'] as ProductCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryValue(cat)}
                    className={`px-3 py-1.5 rounded-md font-bold uppercase text-[11px] transition-all cursor-pointer ${
                      categoryValue === cat
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section: Agent / Importer */}
          <div
            className={`p-3 rounded-lg border transition-all ${
              applyAgent
                ? 'bg-white dark:bg-slate-800/90 border-teal-500/80 shadow-xs'
                : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={applyAgent}
                  onChange={(e) => setApplyAgent(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                />
                <Building2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>Update Agent / Importer / Supplier</span>
              </label>
              {applyAgent && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Armed
                </span>
              )}
            </div>

            {applyAgent && (
              <div className="pl-6 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium mb-1">
                    Select from Registered Suppliers:
                  </span>
                  <select
                    value={agentValue}
                    onChange={(e) => {
                      setAgentValue(e.target.value);
                      setCustomAgent('');
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                    <option value="Mersaco Sal">Mersaco Sal</option>
                    <option value="Fattal">Fattal</option>
                    <option value="Omnipharma">Omnipharma</option>
                    <option value="Benta Pharma">Benta Pharma</option>
                  </select>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium mb-1">
                    Or Enter Custom Agent / Importer:
                  </span>
                  <input
                    type="text"
                    value={customAgent}
                    onChange={(e) => setCustomAgent(e.target.value)}
                    placeholder="e.g. Mediphar, Algorithm..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section: Dosage Form */}
          <div
            className={`p-3 rounded-lg border transition-all ${
              applyForm
                ? 'bg-white dark:bg-slate-800/90 border-teal-500/80 shadow-xs'
                : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={applyForm}
                  onChange={(e) => setApplyForm(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                />
                <Pill className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>Update Dosage Form</span>
              </label>
              {applyForm && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Armed
                </span>
              )}
            </div>

            {applyForm && (
              <div className="pl-6 pt-1 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {commonForms.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormValue(f)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        formValue.toLowerCase() === f.toLowerCase()
                          ? 'bg-teal-700 text-white font-bold'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">Custom Form:</span>
                  <input
                    type="text"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="flex-1 max-w-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section: Price Adjustment */}
          <div
            className={`p-3 rounded-lg border transition-all ${
              applyPriceAdjustment
                ? 'bg-white dark:bg-slate-800/90 border-teal-500/80 shadow-xs'
                : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={applyPriceAdjustment}
                  onChange={(e) => setApplyPriceAdjustment(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                />
                <DollarSign className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>Adjust Selling Prices</span>
              </label>
              {applyPriceAdjustment && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Armed
                </span>
              )}
            </div>

            {applyPriceAdjustment && (
              <div className="pl-6 pt-1 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-medium mb-1">
                      Adjustment Mode:
                    </span>
                    <select
                      value={priceAdjustmentType}
                      onChange={(e) => setPriceAdjustmentType(e.target.value as PriceAdjustmentType)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="percentage">Percentage Change (%)</option>
                      <option value="fixed_add_usd">Add/Subtract Fixed USD ($)</option>
                      <option value="set_fixed_usd">Set Exact Fixed USD ($)</option>
                      <option value="recalc_lbp_from_usd">
                        Recalculate LBP from Current USD ({formatLBPValue(exchangeRate)} LBP/$)
                      </option>
                    </select>
                  </div>

                  {priceAdjustmentType !== 'recalc_lbp_from_usd' && (
                    <div>
                      <span className="block text-[10px] text-slate-400 font-medium mb-1">
                        {priceAdjustmentType === 'percentage'
                          ? 'Percentage (e.g. 10 for +10%, -5 for -5%):'
                          : priceAdjustmentType === 'fixed_add_usd'
                          ? 'Fixed Amount (e.g. 1.50 for +$1.50, -0.50):'
                          : 'Exact Fixed USD Price ($):'}
                      </span>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={priceAdjustmentValue}
                          onChange={(e) => setPriceAdjustmentValue(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded pl-7 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                        />
                        <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold">
                          {priceAdjustmentType === 'percentage' ? '%' : '$'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-2 rounded">
                  <Sparkles className="h-3 w-3 text-teal-500 shrink-0" />
                  <span>
                    When USD prices are updated, corresponding LBP prices are automatically synchronized
                    at current official rate ({formatLBPValue(exchangeRate)} LBP/$).
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section: Profit Margin */}
          <div
            className={`p-3 rounded-lg border transition-all ${
              applyMargin
                ? 'bg-white dark:bg-slate-800/90 border-teal-500/80 shadow-xs'
                : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={applyMargin}
                  onChange={(e) => setApplyMargin(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                />
                <Percent className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>Update Pharmacist Profit Margin (%)</span>
              </label>
              {applyMargin && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Armed
                </span>
              )}
            </div>

            {applyMargin && (
              <div className="pl-6 pt-1 flex items-center gap-3">
                <div className="w-48">
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      value={marginValue}
                      onChange={(e) => setMarginValue(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded pl-7 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                    />
                    <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold">%</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500">
                  Automatically recalculates Cost Price USD = Selling Price USD × (1 - Margin / 100)
                </span>
              </div>
            )}
          </div>

          {/* Section: Stock Quantities */}
          <div
            className={`p-3 rounded-lg border transition-all ${
              applyStockQuantity
                ? 'bg-white dark:bg-slate-800/90 border-teal-500/80 shadow-xs'
                : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={applyStockQuantity}
                  onChange={(e) => setApplyStockQuantity(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                />
                <Boxes className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>Adjust Stock Quantities</span>
              </label>
              {applyStockQuantity && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Armed
                </span>
              )}
            </div>

            {applyStockQuantity && (
              <div className="pl-6 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium mb-1">Action:</span>
                  <select
                    value={stockAdjustmentType}
                    onChange={(e) => setStockAdjustmentType(e.target.value as StockAdjustmentType)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="add">Add Units to Current Stock (+)</option>
                    <option value="subtract">Subtract Units from Stock (-)</option>
                    <option value="set">Set Exact Stock Count (=)</option>
                  </select>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium mb-1">
                    Number of Units:
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={stockAdjustmentValue}
                    onChange={(e) => setStockAdjustmentValue(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section: Minimum Stock Alert */}
          <div
            className={`p-3 rounded-lg border transition-all ${
              applyMinStockAlert
                ? 'bg-white dark:bg-slate-800/90 border-teal-500/80 shadow-xs'
                : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={applyMinStockAlert}
                  onChange={(e) => setApplyMinStockAlert(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                />
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span>Update Low Stock Alert Threshold</span>
              </label>
              {applyMinStockAlert && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Armed
                </span>
              )}
            </div>

            {applyMinStockAlert && (
              <div className="pl-6 pt-1 flex items-center gap-3">
                <div className="w-40">
                  <input
                    type="number"
                    min="0"
                    value={minStockAlertValue}
                    onChange={(e) => setMinStockAlertValue(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <span className="text-[11px] text-slate-500">
                  Items will trigger a yellow low-stock alert when stock falls below this quantity.
                </span>
              </div>
            )}
          </div>

          {/* Section: Divisible / Piece Selling */}
          <div
            className={`p-3 rounded-lg border transition-all ${
              applyDivisible
                ? 'bg-white dark:bg-slate-800/90 border-teal-500/80 shadow-xs'
                : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={applyDivisible}
                  onChange={(e) => setApplyDivisible(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                />
                <Split className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>Divisible / Selling by Piece or Strip</span>
              </label>
              {applyDivisible && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Armed
                </span>
              )}
            </div>

            {applyDivisible && (
              <div className="pl-6 pt-1 space-y-2">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="isDivisibleRadio"
                      checked={isDivisibleValue}
                      onChange={() => setIsDivisibleValue(true)}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span>Enable Piece Selling (Can be broken down)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="isDivisibleRadio"
                      checked={!isDivisibleValue}
                      onChange={() => setIsDivisibleValue(false)}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <span>Disable Piece Selling (Box only)</span>
                  </label>
                </div>

                {isDivisibleValue && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-medium mb-1">
                        Pieces Per Box:
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={piecesPerBoxValue}
                        onChange={(e) => setPiecesPerBoxValue(e.target.value)}
                        placeholder="e.g. 20"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-medium mb-1">
                        Piece Unit Name:
                      </span>
                      <input
                        type="text"
                        value={pieceNameValue}
                        onChange={(e) => setPieceNameValue(e.target.value)}
                        placeholder="e.g. Strip, Sachet, Ampoule"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section: Batch & Expiry */}
          <div
            className={`p-3 rounded-lg border transition-all ${
              applyExpiryBatch
                ? 'bg-white dark:bg-slate-800/90 border-teal-500/80 shadow-xs'
                : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={applyExpiryBatch}
                  onChange={(e) => setApplyExpiryBatch(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                />
                <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>Assign Default Expiry Date / Batch Number</span>
              </label>
              {applyExpiryBatch && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Armed
                </span>
              )}
            </div>

            {applyExpiryBatch && (
              <div className="pl-6 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium mb-1">
                    Expiry Date (MM-YYYY or YYYY-MM):
                  </span>
                  <input
                    type="text"
                    value={expiryValue}
                    onChange={(e) => setExpiryValue(e.target.value)}
                    placeholder="e.g. 12-2027"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium mb-1">
                    Batch Number (Optional):
                  </span>
                  <input
                    type="text"
                    value={batchValue}
                    onChange={(e) => setBatchValue(e.target.value)}
                    placeholder="e.g. BATCH-2025"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Live Impact Preview Table */}
          {activeChangesCount > 0 && previewItems.length > 0 && (
            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-300 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[11px] text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Live Preview (First {previewItems.length} items of {selectedProducts.length}):
                </span>
                <span className="text-[10px] text-slate-400">
                  Hover to verify before saving
                </span>
              </div>
              <div className="space-y-1.5">
                {previewItems.map(({ original, updates }) => (
                  <div
                    key={original.id}
                    className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                  >
                    <div>
                      <span className="font-mono font-semibold text-teal-600 dark:text-teal-400 mr-2">
                        {original.code}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {original.name}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 font-medium">
                      {applyPriceAdjustment && updates.priceUSD !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 line-through">
                            ${original.priceUSD.toFixed(2)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-teal-500" />
                          <span className="text-teal-600 dark:text-teal-400 font-bold">
                            ${updates.priceUSD.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({formatLBPValue(updates.priceLBP ?? 0)} LBP)
                          </span>
                        </div>
                      )}

                      {applyStockQuantity && updates.stockQuantity !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">Stock: {original.stockQuantity}</span>
                          <ArrowRight className="h-3 w-3 text-teal-500" />
                          <span className="text-blue-600 dark:text-blue-400 font-bold">
                            {updates.stockQuantity}
                          </span>
                        </div>
                      )}

                      {applyCategory && updates.category && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 uppercase text-[9px]">{original.category}</span>
                          <ArrowRight className="h-3 w-3 text-teal-500" />
                          <span className="text-purple-600 font-bold uppercase text-[9px]">
                            {updates.category}
                          </span>
                        </div>
                      )}

                      {applyAgent && updates.agent && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 truncate max-w-[80px]">
                            {original.agent}
                          </span>
                          <ArrowRight className="h-3 w-3 text-teal-500" />
                          <span className="text-indigo-600 font-bold truncate max-w-[100px]">
                            {updates.agent}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {activeChangesCount === 0 ? (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Check at least one section above to proceed
              </span>
            ) : null}

            <button
              type="button"
              disabled={activeChangesCount === 0 || isApplying}
              onClick={handleApply}
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              {isApplying ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Apply Changes to {selectedProducts.length} Items</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </DesktopWindow>
  );
};
