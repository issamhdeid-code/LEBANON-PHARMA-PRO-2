import React, { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  BookOpen,
  Search,
  CheckCircle,
  AlertTriangle,
  Flame,
  Shuffle,
  Pill,
  Sparkles,
  Layers,
  Thermometer,
  ExternalLink,
  Tag,
  RefreshCw,
  Globe,
  PackageCheck,
  PackageX,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { useDebounce } from '../../hooks/useDebounce';
import { Product } from '../../types/pharmacy';
import { formatStockDisplay } from '../../utils/stockUtils';
import { formatLBPValue } from '../../utils/priceUtils';
import { SectionRestoreButton } from '../common/SectionRestoreButton';
import {
  findInStockGenericAlternatives,
  findOutOfStockGenericAlternatives,
  extractCleanMolecules,
  resolveStraightforwardScientificInfo,
} from '../../services/scientificDataService';

interface ScientificsViewProps {
  initialSelectedProduct?: Product | null;
  onOpenPriceUpdater: (code: string) => void;
  onSelectForSale?: (product: Product) => void;
}

export const ScientificsView: React.FC<ScientificsViewProps> = ({
  initialSelectedProduct,
  onOpenPriceUpdater,
  onSelectForSale,
}) => {
  const {
    products,
    formatLBP,
    formatUSD,
    enrichProductWithOnlineScientifics,
    enrichAllProductsOnline,
    isSearchingScientifics,
  } = usePharmacy();

  // Filter only items with category 'drug'
  const drugProducts = useMemo(() => {
    return products.filter((p) => p.category === 'drug');
  }, [products]);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(() => {
    if (initialSelectedProduct && initialSelectedProduct.category === 'drug') {
      return initialSelectedProduct.id;
    }
    return drugProducts[0]?.id || null;
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);

  // Keep selected product synchronized with global products state
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return drugProducts[0] || null;
    return products.find((p) => p.id === selectedProductId) || drugProducts[0] || null;
  }, [products, selectedProductId, drugProducts]);

  // Guaranteed straightforward, concise scientific dossier (formatted consistently like Adol Extra)
  const currentScientificInfo = useMemo(() => {
    if (!selectedProduct) return null;
    return resolveStraightforwardScientificInfo(selectedProduct);
  }, [selectedProduct]);

  // Clean molecule list for display
  const activeMolecules = useMemo(() => {
    if (!selectedProduct) return [];
    return extractCleanMolecules(selectedProduct.ingredients || selectedProduct.name);
  }, [selectedProduct]);

  // Requirement: Generic Alternatives in Lebanon - show ONLY drugs available in stock with the same active ingredients / molecule
  const inStockGenericAlternatives = useMemo(() => {
    if (!selectedProduct) return [];
    return findInStockGenericAlternatives(selectedProduct, products);
  }, [selectedProduct, products]);

  // Out of stock alternatives for transparency
  const outOfStockGenericAlternatives = useMemo(() => {
    if (!selectedProduct) return [];
    return findOutOfStockGenericAlternatives(selectedProduct, products);
  }, [selectedProduct, products]);

  const filteredDrugs = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (!q) return drugProducts;
    return drugProducts.filter((p) => {
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const codeMatch = (p.code || '').toLowerCase().includes(q);
      const ingMatch = (p.ingredients || '').toLowerCase().includes(q);
      const indMatch = (p.scientificInfo?.indications || '').toLowerCase().includes(q);
      const genMatch = p.scientificInfo?.generics?.some((g) => (g || '').toLowerCase().includes(q));
      return nameMatch || codeMatch || ingMatch || indMatch || genMatch;
    });
  }, [drugProducts, debouncedSearchQuery]);

  // Virtualize the drug sidebar list (renders only visible rows)
  const drugListRef = useRef<HTMLDivElement | null>(null);
  const drugListVirtualizer = useVirtualizer({
    count: filteredDrugs.length,
    getScrollElement: () => drugListRef.current,
    estimateSize: () => 52,
    overscan: 8,
    getItemKey: (index) => filteredDrugs[index]?.id || index,
  });

  const handleRefreshOnlineData = async () => {
    if (!selectedProduct) return;
    setIsRefreshing(true);
    try {
      await enrichProductWithOnlineScientifics(selectedProduct.id, true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEnrichAllOnline = async () => {
    if (isEnrichingAll || isSearchingScientifics) return;
    setIsEnrichingAll(true);
    try {
      await enrichAllProductsOnline();
    } finally {
      setIsEnrichingAll(false);
    }
  };

  const renderClinicalIndications = (text?: string) => {
    const fallback = 'Therapeutic management of clinical conditions indicated for this active molecule.';
    const content = text && text.trim().length > 5 ? text : fallback;
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);

    if (lines.length <= 1 && !lines[0]?.includes('•')) {
      return (
        <p className="text-xs leading-relaxed font-medium text-slate-700 dark:text-slate-200">
          {content}
        </p>
      );
    }

    return (
      <div className="space-y-1.5">
        {lines.map((line, idx) => {
          const bulletCleaned = line.replace(/^[•*–-]\s*/, '').trim();
          const colonIdx = bulletCleaned.indexOf(':');
          if (colonIdx > 0 && colonIdx < 35) {
            const label = bulletCleaned.substring(0, colonIdx).trim();
            const detail = bulletCleaned.substring(colonIdx + 1).trim();
            return (
              <div key={idx} className="text-xs leading-relaxed flex items-start space-x-1.5">
                <span className="text-teal-600 dark:text-teal-400 font-bold shrink-0 mt-0.5">•</span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{label}: </span>
                  <span className="text-slate-700 dark:text-slate-300 font-normal">{detail}</span>
                </div>
              </div>
            );
          }
          return (
            <div key={idx} className="text-xs leading-relaxed flex items-start space-x-1.5 text-slate-700 dark:text-slate-300">
              <span className="text-teal-600 dark:text-teal-400 font-bold shrink-0 mt-0.5">•</span>
              <span>{bulletCleaned}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderClinicalContraindications = (text?: string) => {
    const fallback = 'Hypersensitivity to active substance; severe hepatic or renal impairment.';
    const content = text && text.trim().length > 5 ? text : fallback;
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);

    return (
      <div className="text-xs leading-relaxed text-rose-950 dark:text-rose-200 bg-rose-50/80 dark:bg-rose-950/40 p-2.5 rounded-lg border border-rose-200/70 dark:border-rose-900/50 font-medium space-y-1.5">
        {lines.map((line, idx) => {
          const bulletCleaned = line.replace(/^[•*–-]\s*/, '').trim();
          const colonIdx = bulletCleaned.indexOf(':');
          if (colonIdx > 0 && colonIdx < 35) {
            const label = bulletCleaned.substring(0, colonIdx).trim();
            const detail = bulletCleaned.substring(colonIdx + 1).trim();
            return (
              <div key={idx} className="flex items-start space-x-1.5">
                <span className="text-rose-600 dark:text-rose-400 font-bold shrink-0 mt-0.5">•</span>
                <div>
                  <span className="font-bold text-rose-900 dark:text-rose-100">{label}: </span>
                  <span className="text-rose-800 dark:text-rose-300 font-normal">{detail}</span>
                </div>
              </div>
            );
          }
          return (
            <div key={idx} className="flex items-start space-x-1.5 text-rose-900 dark:text-rose-200">
              <span className="text-rose-600 dark:text-rose-400 font-bold shrink-0 mt-0.5">•</span>
              <span>{bulletCleaned}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderClinicalSideEffects = (text?: string) => {
    const fallback = 'GI discomfort, nausea, headache, dizziness, mild allergic skin reaction.';
    const content = text && text.trim().length > 5 ? text : fallback;
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);

    if (lines.length <= 1 && !lines[0]?.includes('•')) {
      return (
        <p className="text-xs leading-relaxed font-medium text-slate-700 dark:text-slate-200">
          {content}
        </p>
      );
    }

    return (
      <div className="space-y-1.5">
        {lines.map((line, idx) => {
          const bulletCleaned = line.replace(/^[•*–-]\s*/, '').trim();
          const colonIdx = bulletCleaned.indexOf(':');
          if (colonIdx > 0 && colonIdx < 35) {
            const label = bulletCleaned.substring(0, colonIdx).trim();
            const detail = bulletCleaned.substring(colonIdx + 1).trim();
            return (
              <div key={idx} className="text-xs leading-relaxed flex items-start space-x-1.5">
                <span className="text-amber-600 dark:text-amber-400 font-bold shrink-0 mt-0.5">•</span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{label}: </span>
                  <span className="text-slate-700 dark:text-slate-300 font-normal">{detail}</span>
                </div>
              </div>
            );
          }
          return (
            <div key={idx} className="text-xs leading-relaxed flex items-start space-x-1.5 text-slate-700 dark:text-slate-300">
              <span className="text-amber-600 dark:text-amber-400 font-bold shrink-0 mt-0.5">•</span>
              <span>{bulletCleaned}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col lg:flex-row overflow-hidden bg-[#f8fafc] dark:bg-slate-950 select-none">
      {/* LEFT LIST: Drug Catalog */}
      <div className="flex w-full lg:w-80 flex-col border-r border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden shrink-0">
        <div className="p-3 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <SectionRestoreButton section="scientifics" />
              <BookOpen className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <h2 className="font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-slate-200">
                Drug Directory ({drugProducts.length})
              </h2>
            </div>
            <button
              onClick={handleEnrichAllOnline}
              disabled={isEnrichingAll || isSearchingScientifics || drugProducts.length === 0}
              className="flex items-center space-x-1 text-[10px] font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800 cursor-pointer disabled:opacity-50 transition-colors"
              title="Search and enrich online scientific monographs for all imported drugs"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${isEnrichingAll ? 'animate-spin' : ''}`} />
              <span>{isEnrichingAll ? 'Enriching...' : 'Fetch All'}</span>
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drug, molecule, generic..."
              className="w-full rounded border border-gray-300 bg-white pl-8 pr-3 py-1 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Drug list */}
        <div ref={drugListRef} className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
          {filteredDrugs.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-400">
              No registered medications found.
            </div>
          ) : (
            <div style={{ height: drugListVirtualizer.getTotalSize(), position: 'relative' }}>
              {drugListVirtualizer.getVirtualItems().map((virtualRow) => {
                const prod = filteredDrugs[virtualRow.index];
                const isSelected = selectedProduct?.id === prod.id;
                return (
                  <button
                    key={prod.id}
                    data-index={virtualRow.index}
                    ref={drugListVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => setSelectedProductId(prod.id)}
                    className={`w-full text-left p-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50/90 border-l-3 border-teal-600 dark:bg-slate-800/80 text-teal-950 dark:text-teal-100 font-medium'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{prod.name}</span>
                      <span className="font-mono text-[10px] text-gray-400">
                        {prod.code}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-slate-400 truncate flex items-center justify-between gap-1">
                      <span className="truncate">{prod.ingredients} • {prod.dosage}</span>
                      {extractCleanMolecules(prod.ingredients || prod.name).length > 1 && (
                        <span className="shrink-0 px-1 py-0.2 text-[9px] rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
                          Multi
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                      <span className="flex items-center space-x-1">
                        <span>{prod.form}</span>
                        {prod.scientificInfo?.onlineEnriched && (
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
                            title={`Online enriched via ${prod.scientificInfo.onlineSource || 'online source'}`}
                          />
                        )}
                      </span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        ${prod.priceUSD.toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT VIEW: Comprehensive Scientific Dossier */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#f8fafc] dark:bg-slate-950/40">
        {selectedProduct ? (
          <div className="max-w-4xl space-y-3">
            {/* Drug Header Card */}
            <div className="rounded border border-gray-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-teal-50 px-2 py-0.5 font-mono text-[11px] font-bold text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800">
                      {selectedProduct.code}
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300 uppercase">
                      Category: Drug
                    </span>
                    {activeMolecules.length > 1 && (
                      <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 flex items-center space-x-1">
                        <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                        <span>Combination ({activeMolecules.length} Actives)</span>
                      </span>
                    )}
                    {currentScientificInfo?.onlineEnriched ? (
                      <span className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {currentScientificInfo.onlineSource?.includes('AI') ? (
                          <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Globe className="h-3 w-3 text-emerald-600" />
                        )}
                        <span>{currentScientificInfo.onlineSource || 'AI Clinical Reference'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                        <ShieldCheck className="h-3 w-3 text-slate-500" />
                        <span>Standard Monograph (Offline)</span>
                      </span>
                    )}
                  </div>

                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {selectedProduct.name}
                  </h1>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {activeMolecules.length > 1 ? 'Active Molecules (Combination):' : 'Active Molecule:'}
                    </span>
                    {activeMolecules.length > 0 ? (
                      activeMolecules.map((m, idx) => (
                        <React.Fragment key={idx}>
                          <span
                            className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                          >
                            {m}
                          </span>
                          {idx < activeMolecules.length - 1 && (
                            <span className="text-purple-600 dark:text-purple-400 font-bold text-xs">+</span>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        {selectedProduct.ingredients || selectedProduct.name}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">({selectedProduct.dosage})</span>
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-2">
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      ${selectedProduct.priceUSD.toFixed(2)}
                    </div>
                    <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      {formatLBPValue(selectedProduct.priceLBP)} LBP
                    </div>
                    <div className="text-[10px] font-medium text-slate-400">
                      Stock: {formatStockDisplay(selectedProduct.stockQuantity, selectedProduct.isDivisible, selectedProduct.piecesPerBox, selectedProduct.pieceName)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                    <button
                      onClick={handleRefreshOnlineData}
                      disabled={isRefreshing || isSearchingScientifics}
                      className="flex items-center space-x-1.5 rounded border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200 cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
                      title="Search online scientific data using AI and NIH multi-ingredient synthesis"
                    >
                      <RefreshCw className={`h-3 w-3 text-teal-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                      <span>{isRefreshing ? 'AI Analyzing Monograph...' : 'Search Online Data (AI)'}</span>
                    </button>

                    <button
                      onClick={() => onOpenPriceUpdater(selectedProduct.code)}
                      className="flex items-center space-x-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                      title="Update Price"
                    >
                      <Tag className="h-3 w-3 text-teal-600" />
                      <span>Update Price</span>
                    </button>

                    {onSelectForSale && (
                      <button
                        onClick={() => onSelectForSale(selectedProduct)}
                        className="flex items-center space-x-1 rounded bg-teal-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs cursor-pointer"
                      >
                        <Pill className="h-3.5 w-3.5" />
                        <span>Dispense</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Formulation specs bar */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-gray-100 pt-3 text-xs dark:border-slate-800">
                <div>
                  <span className="block text-[10px] uppercase font-semibold text-gray-400">Form</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedProduct.form}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-semibold text-gray-400">Packaging</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedProduct.presentation}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-semibold text-gray-400">Agent / Importer</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedProduct.agent}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Core Scientific Sections Filled via Online Search & Stock Engine */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 1. CLINICAL INDICATIONS & USES */}
              <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5 text-teal-800 dark:text-teal-300 font-bold text-xs">
                      <CheckCircle className="h-4 w-4 text-teal-600 shrink-0" />
                      <h3>1. Clinical Indications & Uses</h3>
                    </div>
                    <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800 px-1.5 py-0.5 rounded flex items-center space-x-1">
                      {currentScientificInfo?.onlineEnriched ? (
                        currentScientificInfo.onlineSource?.includes('AI') ? (
                          <>
                            <Sparkles className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400" />
                            <span>AI Clinical Indications</span>
                          </>
                        ) : (
                          <span>NIH MedlinePlus (AHFS)</span>
                        )
                      ) : (
                        <span>Clinical Indications</span>
                      )}
                    </span>
                  </div>
                  {renderClinicalIndications(currentScientificInfo?.indications)}
                </div>
                {currentScientificInfo?.dosage && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <div className="rounded-lg bg-teal-50/80 px-2.5 py-1.5 text-[11px] text-teal-950 dark:bg-teal-950/40 dark:text-teal-200 border border-teal-200/60 dark:border-teal-900/50 flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold">Standard Regimen:</span>
                      <span className="font-medium text-right">{currentScientificInfo.dosage}</span>
                    </div>
                    {currentScientificInfo?.pediatricDosage && (
                      <div className="rounded-lg bg-amber-50/80 px-2.5 py-1.5 text-[11px] text-amber-950 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200/60 dark:border-amber-900/50 flex flex-wrap items-center justify-between gap-1">
                        <span className="font-bold">Pediatric Regimen:</span>
                        <span className="font-medium text-right">{currentScientificInfo.pediatricDosage}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. CONTRAINDICATION WARNINGS */}
              <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5 text-rose-800 dark:text-rose-300 font-bold text-xs">
                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                      <h3>2. Contraindication Warnings</h3>
                    </div>
                    <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 px-1.5 py-0.5 rounded flex items-center space-x-1">
                      {currentScientificInfo?.onlineEnriched ? (
                        currentScientificInfo.onlineSource?.includes('AI') ? (
                          <>
                            <Sparkles className="h-2.5 w-2.5 text-rose-600 dark:text-rose-400" />
                            <span>AI Combination Safety Guard</span>
                          </>
                        ) : (
                          <span>NIH MED-RT Verified</span>
                        )
                      ) : (
                        <span>Contraindications</span>
                      )}
                    </span>
                  </div>
                  {renderClinicalContraindications(currentScientificInfo?.contraindications)}
                </div>
                {currentScientificInfo?.pregnancyCategory && (
                  <div className="mt-3 flex items-center space-x-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <span>Pregnancy Category:</span>
                    <span className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-200 dark:border-rose-900">
                      Class {currentScientificInfo.pregnancyCategory}
                    </span>
                  </div>
                )}
              </div>

              {/* 3. ADVERSE REACTIONS & SIDE EFFECTS */}
              <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs">
                      <Flame className="h-4 w-4 text-amber-600 shrink-0" />
                      <h3>3. Adverse Reactions & Side Effects</h3>
                    </div>
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded flex items-center space-x-1">
                      {currentScientificInfo?.onlineEnriched ? (
                        currentScientificInfo.onlineSource?.includes('AI') ? (
                          <>
                            <Sparkles className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                            <span>AI Synergistic Profile</span>
                          </>
                        ) : (
                          <span>Pharmacovigilance Profile</span>
                        )
                      ) : (
                        <span>Side Effects</span>
                      )}
                    </span>
                  </div>
                  {renderClinicalSideEffects(currentScientificInfo?.sideEffects)}
                </div>
                {currentScientificInfo?.storageConditions && (
                  <div className="mt-3 flex items-center space-x-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 border-t border-gray-100 dark:border-slate-800 pt-2">
                    <Thermometer className="h-3 w-3 text-slate-400" />
                    <span>Storage: {currentScientificInfo.storageConditions}</span>
                  </div>
                )}
              </div>

              {/* 4. GENERIC ALTERNATIVES IN LEBANON - STRICTLY IN-STOCK WITH SAME MOLECULE */}
              <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5 text-teal-800 dark:text-teal-300 font-bold text-xs">
                    <Shuffle className="h-4 w-4 text-teal-600 shrink-0" />
                    <h3>4. Generic Alternatives in Lebanon</h3>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded">
                    Only In-Stock
                  </span>
                </div>

                <div className="mb-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Available stock sharing active molecule ({activeMolecules.join(', ') || selectedProduct.ingredients}):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {inStockGenericAlternatives.length} brand{inStockGenericAlternatives.length !== 1 ? 's' : ''} available
                  </span>
                </div>

                {inStockGenericAlternatives.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {inStockGenericAlternatives.map((alt) => (
                      <div
                        key={alt.id}
                        className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-2.5 transition-all hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                {alt.name}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 bg-white dark:bg-slate-800 px-1 rounded border border-slate-200 dark:border-slate-700">
                                {alt.code}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">
                              {alt.ingredients} • {alt.dosage} • {alt.form}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Agent: {alt.agent}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-bold text-xs text-blue-600 dark:text-blue-400">
                              ${alt.priceUSD.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {formatLBPValue(alt.priceLBP)} L.L.
                            </div>
                            <div className="mt-1">
                              <span className="inline-flex items-center space-x-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200">
                                <PackageCheck className="h-3 w-3" />
                                <span>{formatStockDisplay(alt.stockQuantity, alt.isDivisible, alt.piecesPerBox, alt.pieceName)} in stock</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-end space-x-1.5 border-t border-emerald-100 pt-1.5 dark:border-emerald-900/40">
                          <button
                            type="button"
                            onClick={() => setSelectedProductId(alt.id)}
                            className="flex items-center space-x-1 text-[11px] font-medium text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100 cursor-pointer"
                          >
                            <span>Inspect Dossier</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                          {onSelectForSale && (
                            <button
                              type="button"
                              onClick={() => onSelectForSale(alt)}
                              className="rounded bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-teal-700 cursor-pointer"
                            >
                              Dispense Alternative
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-900/50">
                    <PackageX className="mx-auto h-6 w-6 text-slate-400 mb-1" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      No other alternative brand available in stock
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      No matching generic formulations for "{activeMolecules[0] || selectedProduct.ingredients}" are currently available in inventory (0 units).
                    </p>
                  </div>
                )}

                {/* Transparency notice for out of stock items */}
                {outOfStockGenericAlternatives.length > 0 && (
                  <div className="mt-2.5 rounded bg-slate-50 p-2 text-[10px] text-slate-500 dark:bg-slate-800/40 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Excluded (Out of Stock):{' '}
                    </span>
                    {outOfStockGenericAlternatives.map((o) => `${o.name} [0 in stock]`).join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* Scientific Monograph Metadata Footer */}
            <div className="flex flex-wrap items-center justify-between rounded border border-gray-200 bg-white p-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <div className="flex items-center space-x-1.5">
                <ShieldCheck className="h-4 w-4 text-teal-600" />
                <span>
                  Clinical Reference: <strong>Lebanese MoPH & U.S. National Library of Medicine (NIH MedlinePlus Connect & RxNav / MED-RT)</strong>
                </span>
              </div>
              <div className="text-[10px]">
                Active Molecule Index: <strong>{activeMolecules.join(' + ') || selectedProduct.ingredients}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-xs">
            <BookOpen className="h-8 w-8 text-gray-300 mb-2 dark:text-slate-700" />
            <span>Select a medication from the left directory to view scientific details.</span>
          </div>
        )}
      </div>
    </div>
  );
};

