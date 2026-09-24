import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Printer,
  X,
  ScanBarcode,
  Layers,
  Settings2,
  SlidersHorizontal,
  Plus,
  Minus,
  Trash2,
  Eye,
  RefreshCw,
  Search,
  Check,
  Tag,
  Building2,
  Calendar,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Info,
  Copy,
} from 'lucide-react';
import { Product } from '../../types/pharmacy';
import { usePharmacy } from '../../context/PharmacyContext';
import { DesktopWindow } from '../common/DesktopWindow';
import { formatLBPValue } from '../../utils/priceUtils';
import { BarcodeSvg } from '../../utils/barcodeGenerator';
import {
  BarcodeLabelTemplate,
  DEFAULT_BARCODE_TEMPLATE,
  LABEL_PRESETS,
  LabelPresetId,
  BarcodePrintItem,
} from '../../types/barcodeLabel';

interface BarcodeLabelGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProducts: Product[];
}

const TEMPLATE_STORAGE_KEY = 'lebanon_pharma_barcode_template_prefs';

function loadSavedTemplate(): BarcodeLabelTemplate {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return DEFAULT_BARCODE_TEMPLATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_BARCODE_TEMPLATE, ...parsed };
  } catch {
    return DEFAULT_BARCODE_TEMPLATE;
  }
}

function saveTemplatePrefs(template: BarcodeLabelTemplate): void {
  try {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(template));
  } catch (e) {
    console.warn('Could not save barcode label template preferences:', e);
  }
}

export const BarcodeLabelGeneratorModal: React.FC<BarcodeLabelGeneratorModalProps> = ({
  isOpen,
  onClose,
  initialProducts,
}) => {
  const { products, settings, exchangeRate, addNotification } = usePharmacy();

  // Template state
  const [template, setTemplate] = useState<BarcodeLabelTemplate>(loadSavedTemplate);

  // Active items in print queue with per-item quantity
  const [printItems, setPrintItems] = useState<BarcodePrintItem[]>([]);

  // Search filter inside modal to add more items
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingAdd, setIsSearchingAdd] = useState(false);

  // Preview zoom level
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // Tab in configuration panel
  const [configTab, setConfigTab] = useState<'template' | 'items'>('template');

  // Initialize or update print items when initialProducts change
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setPrintItems((prev) => {
        // Keep existing quantities for items already in queue
        const existingMap = new Map<string, number>();
        prev.forEach((item) => existingMap.set(item.product.id, item.quantity));

        return initialProducts.map((p) => ({
          product: p,
          quantity: existingMap.get(p.id) || 1,
        }));
      });
    } else {
      setPrintItems([]);
    }
  }, [initialProducts]);

  // Persist template changes
  const updateTemplate = (updates: Partial<BarcodeLabelTemplate>) => {
    setTemplate((prev) => {
      const next = { ...prev, ...updates };
      saveTemplatePrefs(next);
      return next;
    });
  };

  // Preset selector
  const handleSelectPreset = (presetId: LabelPresetId) => {
    const presetDef = LABEL_PRESETS[presetId];
    if (presetDef) {
      updateTemplate({
        preset: presetId,
        labelWidthMm: presetDef.widthMm,
        labelHeightMm: presetDef.heightMm,
      });
    }
  };

  // Quantity updates
  const handleUpdateQuantity = (productId: string, delta: number) => {
    setPrintItems((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = Math.max(1, item.quantity + delta);
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleSetExactQuantity = (productId: string, qty: number) => {
    const safeQty = Math.max(1, Math.floor(qty) || 1);
    setPrintItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: safeQty } : item))
    );
  };

  const handleRemoveItem = (productId: string) => {
    setPrintItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleSetAllQuantitiesToOne = () => {
    setPrintItems((prev) => prev.map((item) => ({ ...item, quantity: 1 })));
  };

  const handleSetAllQuantitiesToStock = () => {
    setPrintItems((prev) =>
      prev.map((item) => ({
        ...item,
        quantity: Math.max(1, Math.floor(item.product.stockQuantity || 1)),
      }))
    );
  };

  const handleAddProductToQueue = (prod: Product) => {
    setPrintItems((prev) => {
      const exists = prev.find((item) => item.product.id === prod.id);
      if (exists) {
        return prev.map((item) =>
          item.product.id === prod.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
    setSearchQuery('');
    setIsSearchingAdd(false);
  };

  // Filtered products for addition search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [products, searchQuery]);

  // Total label count
  const totalLabelsToPrint = useMemo(() => {
    return printItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [printItems]);

  // Flattened labels list for rendering (expanding quantity into individual label units)
  const flattenedLabels = useMemo(() => {
    const list: Product[] = [];
    printItems.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        list.push(item.product);
      }
    });
    return list;
  }, [printItems]);

  // Print execution
  const handlePrint = () => {
    if (flattenedLabels.length === 0) {
      addNotification(
        'No Labels to Print',
        'Please select at least one item and set a quantity greater than zero.',
        'system',
        'warning'
      );
      return;
    }

    addNotification(
      'Printing Barcode Labels',
      `Sending ${totalLabelsToPrint} label(s) to printer...`,
      'system',
      'info'
    );

    // Give DOM a microtask to ensure everything is flushed, then trigger window.print()
    setTimeout(() => {
      window.print();
    }, 50);
  };

  if (!isOpen) return null;

  const currentPreset = LABEL_PRESETS[template.preset] || LABEL_PRESETS['shelf-50x25'];

  return (
    <DesktopWindow
      id="stock_barcode_label_printer"
      section="stock"
      title={`Barcode Label Studio — ${totalLabelsToPrint} Label${totalLabelsToPrint === 1 ? '' : 's'}`}
      isOpen={isOpen}
      onClose={onClose}
      width="1120px"
      height="88vh"
      minWidth={850}
      minHeight={550}
    >
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden select-none">
        {/* Top Action & Summary Bar */}
        <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <ScanBarcode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>Custom Barcode Label Studio</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300">
                  {currentPreset.name}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate and print shelf price tags or product stickers with name, price, and barcode.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setConfigTab('template')}
                className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  configTab === 'template'
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Template &amp; Layout</span>
              </button>
              <button
                type="button"
                onClick={() => setConfigTab('items')}
                className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  configTab === 'items'
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Items &amp; Copies ({printItems.length})</span>
              </button>
            </div>

            <button
              id="btn-print-barcode-labels"
              type="button"
              onClick={handlePrint}
              disabled={flattenedLabels.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:ring-2 focus:ring-teal-500 focus:outline-none"
              title="Send formatted barcode labels to printer"
            >
              <Printer className="h-4 w-4" />
              <span>Print {totalLabelsToPrint} Label{totalLabelsToPrint === 1 ? '' : 's'}</span>
            </button>
          </div>
        </div>

        {/* Main 2-Column Studio Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Configuration & Items Panel */}
          <div className="w-80 md:w-96 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 overflow-hidden">
            {/* Tab switch for mobile/small screens */}
            <div className="flex sm:hidden border-b border-slate-200 dark:border-slate-800 p-2 gap-1 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setConfigTab('template')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded ${
                  configTab === 'template' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                Template
              </button>
              <button
                type="button"
                onClick={() => setConfigTab('items')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded ${
                  configTab === 'items' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                Items ({printItems.length})
              </button>
            </div>

            {configTab === 'template' ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
                {/* 1. Preset Selector */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1.5">
                    <Tag className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Label Format &amp; Preset</span>
                  </label>
                  <select
                    id="select-barcode-preset"
                    value={template.preset}
                    onChange={(e) => handleSelectPreset(e.target.value as LabelPresetId)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {Object.values(LABEL_PRESETS).map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                    {currentPreset.description}
                  </p>
                </div>

                {/* 2. Product Name Template Options */}
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={template.showProductName}
                        onChange={(e) => updateTemplate({ showProductName: e.target.checked })}
                        className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                      />
                      <span>Product Name</span>
                    </label>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold uppercase">
                      Required
                    </span>
                  </div>

                  {template.showProductName && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                      <div>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                          Font Size:
                        </span>
                        <select
                          value={template.productNameSize}
                          onChange={(e) =>
                            updateTemplate({ productNameSize: e.target.value as 'xs' | 'sm' | 'base' })
                          }
                          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-100"
                        >
                          <option value="xs">Small</option>
                          <option value="sm">Standard</option>
                          <option value="base">Prominent</option>
                        </select>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                          Max Lines:
                        </span>
                        <select
                          value={template.productNameLines}
                          onChange={(e) =>
                            updateTemplate({ productNameLines: Number(e.target.value) as 1 | 2 })
                          }
                          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-100"
                        >
                          <option value={1}>1 line</option>
                          <option value={2}>2 lines</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Price Template Options */}
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={template.showPrice}
                        onChange={(e) => updateTemplate({ showPrice: e.target.checked })}
                        className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                      />
                      <span>Price Display</span>
                    </label>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold uppercase">
                      Dual Currency
                    </span>
                  </div>

                  {template.showPrice && (
                    <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                      <div>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                          Currency Mode:
                        </span>
                        <select
                          id="select-price-currency"
                          value={template.priceCurrency}
                          onChange={(e) =>
                            updateTemplate({ priceCurrency: e.target.value as 'both' | 'usd' | 'lbp' })
                          }
                          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-100"
                        >
                          <option value="both">Both (USD &amp; LBP)</option>
                          <option value="usd">USD Only ($)</option>
                          <option value="lbp">LBP Only (L.L.)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                            Price Size:
                          </span>
                          <select
                            value={template.priceSize}
                            onChange={(e) =>
                              updateTemplate({ priceSize: e.target.value as 'sm' | 'base' | 'lg' })
                            }
                            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-100"
                          >
                            <option value="sm">Small</option>
                            <option value="base">Standard</option>
                            <option value="lg">Bold Highlight</option>
                          </select>
                        </div>

                        <div>
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                            Exchange Rate:
                          </span>
                          <div className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                            {formatLBPValue(exchangeRate)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Barcode Graphics & Code Source */}
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={template.showBarcodeGraphic}
                        onChange={(e) => updateTemplate({ showBarcodeGraphic: e.target.checked })}
                        className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                      />
                      <span>Barcode Graphics (Code 128 / EAN)</span>
                    </label>
                  </div>

                  {template.showBarcodeGraphic && (
                    <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                            Barcode Height:
                          </span>
                          <select
                            value={template.barcodeHeight}
                            onChange={(e) =>
                              updateTemplate({ barcodeHeight: Number(e.target.value) })
                            }
                            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-100"
                          >
                            <option value={24}>Compact (24px)</option>
                            <option value={32}>Standard (32px)</option>
                            <option value={42}>Tall (42px)</option>
                          </select>
                        </div>

                        <div>
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                            Code Source:
                          </span>
                          <select
                            value={template.barcodeSource}
                            onChange={(e) =>
                              updateTemplate({
                                barcodeSource: e.target.value as 'auto' | 'barcode_only' | 'code_only',
                              })
                            }
                            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-100"
                          >
                            <option value="auto">Auto (Barcode or Code)</option>
                            <option value="barcode_only">Product Barcode Only</option>
                            <option value="code_only">Product Code Only</option>
                          </select>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={template.showBarcodeText}
                          onChange={(e) => updateTemplate({ showBarcodeText: e.target.checked })}
                          className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                        />
                        <span className="text-slate-700 dark:text-slate-300">
                          Show numbers underneath barcode
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 5. Pharmacy Header & Details */}
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Additional Label Details
                  </span>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={template.showPharmacyName}
                        onChange={(e) => updateTemplate({ showPharmacyName: e.target.checked })}
                        className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                      />
                      <span className="text-slate-700 dark:text-slate-300">Pharmacy Header</span>
                    </label>

                    {template.showPharmacyName && (
                      <input
                        type="text"
                        placeholder={settings.pharmacyName || 'Pharmacy Name'}
                        value={template.customPharmacyName}
                        onChange={(e) => updateTemplate({ customPharmacyName: e.target.value })}
                        className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100"
                      />
                    )}

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={template.showDosageForm}
                        onChange={(e) => updateTemplate({ showDosageForm: e.target.checked })}
                        className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                      />
                      <span className="text-slate-700 dark:text-slate-300">
                        Dosage &amp; Form (e.g. 500mg • Tablet)
                      </span>
                    </label>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.showExpiryDate}
                          onChange={(e) => updateTemplate({ showExpiryDate: e.target.checked })}
                          className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                        />
                        <span className="text-slate-700 dark:text-slate-300">Expiry Date</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.showBatchNumber}
                          onChange={(e) => updateTemplate({ showBatchNumber: e.target.checked })}
                          className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                        />
                        <span className="text-slate-700 dark:text-slate-300">Batch / Lot #</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 6. Border & Cut Guides */}
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                    Label Outline / Cut Guide:
                  </span>
                  <select
                    value={template.borderStyle}
                    onChange={(e) =>
                      updateTemplate({
                        borderStyle: e.target.value as 'solid' | 'dashed' | 'none',
                      })
                    }
                    className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-100"
                  >
                    <option value="solid">Solid Line (Visible border/cut line)</option>
                    <option value="dashed">Dashed Guide (For scissors cutting)</option>
                    <option value="none">None (For die-cut sticker sheets)</option>
                  </select>
                </div>
              </div>
            ) : (
              /* Items Queue & Quantity Tab */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      Selected Items ({printItems.length})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSetAllQuantitiesToOne}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                        title="Set 1 label for each item"
                      >
                        All 1
                      </button>
                      <button
                        type="button"
                        onClick={handleSetAllQuantitiesToStock}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                        title="Match label count to current stock on hand"
                      >
                        Match Stock
                      </button>
                    </div>
                  </div>

                  {/* Add Product Search Input */}
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Add another product to queue..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsSearchingAdd(true);
                      }}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />

                    {isSearchingAdd && searchResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-20">
                        {searchResults.map((prod) => (
                          <div
                            key={prod.id}
                            onClick={() => handleAddProductToQueue(prod)}
                            className="p-2 hover:bg-teal-50 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 last:border-b-0"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
                                {prod.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {prod.code || prod.barcode || 'No Code'} &bull; ${prod.priceUSD.toFixed(2)}
                              </div>
                            </div>
                            <span className="shrink-0 text-teal-600 dark:text-teal-400 p-1 hover:bg-teal-100 dark:hover:bg-teal-950/60 rounded">
                              <Plus className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-1">
                  {printItems.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">
                      <ScanBarcode className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No items currently queued for printing.</p>
                      <p className="text-[11px] mt-1">Search above to add products.</p>
                    </div>
                  ) : (
                    printItems.map((item) => (
                      <div
                        key={item.product.id}
                        className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                            {item.product.name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <span className="font-mono">{item.product.barcode || item.product.code || '—'}</span>
                            <span>&bull;</span>
                            <span className="font-semibold text-teal-600 dark:text-teal-400">
                              ${item.product.priceUSD.toFixed(2)}
                            </span>
                            <span>&bull;</span>
                            <span>Stock: {item.product.stockQuantity}</span>
                          </div>
                        </div>

                        {/* Stepper */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, -1)}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer"
                            title="Decrease copies"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="999"
                            value={item.quantity}
                            onChange={(e) =>
                              handleSetExactQuantity(item.product.id, parseInt(e.target.value, 10))
                            }
                            className="w-10 text-center text-xs font-bold py-0.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, 1)}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer"
                            title="Increase copies"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.product.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer ml-1"
                            title="Remove from print list"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Interactive Label Preview */}
          <div className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden">
            {/* Preview Toolbar */}
            <div className="px-4 py-2 bg-slate-200/70 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                <Eye className="h-4 w-4 text-teal-600" />
                <span>Real-Time Label Preview</span>
                <span className="text-slate-400">&bull;</span>
                <span className="font-mono text-[11px] text-slate-500">
                  {template.labelWidthMm}mm × {template.labelHeightMm}mm
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px]">Zoom:</span>
                <button
                  type="button"
                  onClick={() => setPreviewZoom((z) => Math.max(75, z - 25))}
                  className="p-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                  title="Zoom out"
                >
                  <ZoomOut className="h-3 w-3" />
                </button>
                <span className="font-mono text-[11px] w-9 text-center font-semibold text-slate-700 dark:text-slate-300">
                  {previewZoom}%
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewZoom((z) => Math.min(150, z + 25))}
                  className="p-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                  title="Zoom in"
                >
                  <ZoomIn className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Scrollable Preview Canvas */}
            <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
              {flattenedLabels.length === 0 ? (
                <div className="m-auto text-center p-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-sm">
                  <ScanBarcode className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                    No Labels to Preview
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Select products from your inventory or add items using the left panel.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    transform: `scale(${previewZoom / 100})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="flex flex-wrap gap-4 items-start justify-center max-w-4xl"
                >
                  {flattenedLabels.map((prod, index) => (
                    <LabelCard
                      key={`${prod.id}-${index}`}
                      product={prod}
                      template={template}
                      exchangeRate={exchangeRate}
                      pharmacyName={template.customPharmacyName || settings.pharmacyName}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Printable Container targeted by @media print */}
      <div id="printable-barcode-labels" className="hidden">
        <div
          className={`grid gap-2 p-2 ${
            template.preset === 'shelf-50x25'
              ? 'grid-cols-3'
              : template.preset === 'compact-38x20'
              ? 'grid-cols-4'
              : template.preset === 'box-70x35'
              ? 'grid-cols-2'
              : template.preset === 'a4-grid-24'
              ? 'grid-cols-3'
              : 'grid-cols-1'
          }`}
          style={{ width: '100%' }}
        >
          {flattenedLabels.map((prod, index) => (
            <div
              key={`print-${prod.id}-${index}`}
              style={{
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                marginBottom: template.preset === 'thermal-58mm' ? '4mm' : undefined,
              }}
            >
              <LabelCard
                product={prod}
                template={template}
                exchangeRate={exchangeRate}
                pharmacyName={template.customPharmacyName || settings.pharmacyName}
                isPrintMode={true}
              />
            </div>
          ))}
        </div>
      </div>
    </DesktopWindow>
  );
};

interface LabelCardProps {
  product: Product;
  template: BarcodeLabelTemplate;
  exchangeRate: number;
  pharmacyName?: string;
  isPrintMode?: boolean;
}

const LabelCard: React.FC<LabelCardProps> = ({
  product,
  template,
  exchangeRate,
  pharmacyName = 'PHARMACIE',
  isPrintMode = false,
}) => {
  // Resolve barcode value according to source option
  const barcodeValue = useMemo(() => {
    if (template.barcodeSource === 'barcode_only') {
      return product.barcode || '';
    }
    if (template.barcodeSource === 'code_only') {
      return product.code || '';
    }
    // Auto: prefer barcode, fall back to code, fall back to pieceBarcode
    return product.barcode || product.code || product.pieceBarcode || '000000';
  }, [product, template.barcodeSource]);

  // Calculate prices
  const priceUSDFormatted = `$ ${product.priceUSD.toFixed(2)}`;
  const priceLBP = product.priceLBP ?? product.priceUSD * exchangeRate;
  const priceLBPFormatted = `${formatLBPValue(priceLBP)} L.L.`;

  // Dynamic dimensions based on mm
  const cardWidthPx = `${template.labelWidthMm * 3.78}px`;
  const minHeightPx = `${template.labelHeightMm * 3.78}px`;

  const borderClass =
    template.borderStyle === 'solid'
      ? 'border border-slate-900'
      : template.borderStyle === 'dashed'
      ? 'border border-dashed border-slate-600'
      : 'border-0';

  return (
    <div
      style={{
        width: cardWidthPx,
        minHeight: minHeightPx,
        boxSizing: 'border-box',
      }}
      className={`bg-white text-slate-950 p-2 rounded-sm flex flex-col justify-between overflow-hidden ${borderClass} ${
        !isPrintMode ? 'shadow-md dark:shadow-slate-900/50' : ''
      }`}
    >
      {/* 1. Header: Pharmacy Name & Optional Expiry */}
      {(template.showPharmacyName || template.showExpiryDate) && (
        <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1 leading-tight text-[10px]">
          {template.showPharmacyName && (
            <span className="font-extrabold uppercase tracking-wide truncate max-w-[70%]">
              {pharmacyName}
            </span>
          )}
          {template.showExpiryDate && product.expiryDate && (
            <span className="font-mono font-bold text-[9px] text-slate-700 shrink-0">
              EXP: {product.expiryDate}
            </span>
          )}
        </div>
      )}

      {/* 2. Product Name & Dosage */}
      {template.showProductName && (
        <div className="mb-1 leading-snug">
          <div
            className={`text-slate-950 ${
              template.productNameBold ? 'font-bold' : 'font-medium'
            } ${
              template.productNameSize === 'xs'
                ? 'text-[11px]'
                : template.productNameSize === 'base'
                ? 'text-[14px]'
                : 'text-[12.5px]'
            } ${template.productNameLines === 1 ? 'truncate' : 'line-clamp-2'}`}
            title={product.name}
          >
            {product.name}
          </div>

          {template.showDosageForm && (product.dosage || product.form) && (
            <div className="text-[10px] text-slate-600 truncate mt-0.5">
              {[product.dosage, product.form].filter(Boolean).join(' • ')}
            </div>
          )}
        </div>
      )}

      {/* 3. Barcode Graphics */}
      {template.showBarcodeGraphic && barcodeValue && (
        <div className="my-1 flex justify-center w-full overflow-hidden">
          <BarcodeSvg
            value={barcodeValue}
            height={template.barcodeHeight}
            moduleWidth={template.labelWidthMm < 45 ? 1.0 : 1.25}
            showText={template.showBarcodeText}
            fontSize={9}
            className="w-full"
            textColor="#0f172a"
            barColor="#000000"
          />
        </div>
      )}

      {/* 4. Price & Footer Metadata */}
      {template.showPrice && (
        <div className="mt-1 pt-1 border-t border-slate-200 flex items-center justify-between gap-1">
          {template.showBatchNumber && product.batchNumber && (
            <span className="text-[9px] font-mono text-slate-500 truncate">
              LOT: {product.batchNumber}
            </span>
          )}

          <div
            className={`flex items-baseline gap-1.5 ml-auto ${
              template.priceBold ? 'font-black' : 'font-bold'
            }`}
          >
            {/* Dual or Single Currency */}
            {(template.priceCurrency === 'both' || template.priceCurrency === 'usd') && (
              <span
                className={`${
                  template.priceSize === 'lg'
                    ? 'text-base text-slate-950 font-black'
                    : template.priceSize === 'sm'
                    ? 'text-xs text-slate-950'
                    : 'text-sm text-slate-950'
                }`}
              >
                {priceUSDFormatted}
              </span>
            )}

            {template.priceCurrency === 'both' && (
              <span className="text-slate-400 text-[10px] font-normal">/</span>
            )}

            {(template.priceCurrency === 'both' || template.priceCurrency === 'lbp') && (
              <span
                className={`font-mono ${
                  template.priceSize === 'lg'
                    ? 'text-xs text-slate-800'
                    : 'text-[11px] text-slate-700'
                }`}
              >
                {priceLBPFormatted}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
