import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Plus, Sparkles, AlertTriangle, Dices } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Product, ProductCategory, ScientificDrugInfo, MoleculeStrength } from '../../types/pharmacy';
import { resolveStraightforwardScientificInfo } from '../../services/scientificDataService';
import { generateRandomBarcode } from '../../utils/stockUtils';
import { getSubcategoryOptions, suggestSubcategory } from '../../constants/subcategories';
import { DesktopWindow } from '../common/DesktopWindow';

export interface AddStockProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBarcode?: string;
  initialCode?: string;
  initialName?: string;
  initialBatch?: string;
  initialExpiry?: string;
  onProductAdded?: (product: Product) => void;
}

export const AddStockProductModal: React.FC<AddStockProductModalProps> = ({
  isOpen,
  onClose,
  initialBarcode = '',
  initialCode = '',
  initialName = '',
  initialBatch = '',
  initialExpiry = '',
  onProductAdded,
}) => {
  const {
    settings,
    addProduct,
    products,
    suppliers,
    addSupplier,
    exchangeRate,
    searchScientificDataOnline,
    addNotification,
  } = usePharmacy();

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ProductCategory>('drug');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [isCustomSubcategory, setIsCustomSubcategory] = useState(false);
  const [formMolecules, setFormMolecules] = useState<MoleculeStrength[]>([{ name: '', strength: '' }]);
  const formIngredients = formMolecules.map((m) => m.name.trim()).filter(Boolean).join(' + ');
  const formDosage = formMolecules.map((m) => m.strength.trim()).filter(Boolean).join(', ');
  const [formPediatricDosage, setFormPediatricDosage] = useState('');
  const [formPresentation, setFormPresentation] = useState('');
  const [formIsDivisible, setFormIsDivisible] = useState(false);
  const [formPiecesPerBox, setFormPiecesPerBox] = useState<string | number>('');
  const [formPieceName, setFormPieceName] = useState('');
  const [formPiecePriceUSD, setFormPiecePriceUSD] = useState('');
  const [isPiecePriceManual, setIsPiecePriceManual] = useState(false);
  const [formForm, setFormForm] = useState('Tablet');
  const [formPriceLBP, setFormPriceLBP] = useState('350000');
  const [formPriceUSD, setFormPriceUSD] = useState('3.89');
  const [formMargin, setFormMargin] = useState('20');
  const [formAgent, setFormAgent] = useState('Mersaco Sal');
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);

  // Supplier modal
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

  // Initial Batch & Expiry
  const [formBatchNumber, setFormBatchNumber] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');

  // Discard Confirmation Modal State
  const [showDiscardConfirmModal, setShowDiscardConfirmModal] = useState(false);

  // Scientific fields
  const [isFetchingScientifics, setIsFetchingScientifics] = useState(false);
  const [formIndications, setFormIndications] = useState('');
  const [formContraindications, setFormContraindications] = useState('');
  const [formSideEffects, setFormSideEffects] = useState('');
  const [formGenerics, setFormGenerics] = useState('');

  // Subcategories options & suggestions (shows all subcategories with custom support)
  const allSubcategories = React.useMemo(() => {
    const list = getSubcategoryOptions('all', products, settings.customGlobalSubcategories);
    if (formSubcategory && !list.includes(formSubcategory) && !isCustomSubcategory) {
      return [formSubcategory, ...list];
    }
    return list;
  }, [products, formSubcategory, isCustomSubcategory, settings.customGlobalSubcategories]);

  const suggestedSubcategory = React.useMemo(() => {
    return suggestSubcategory(formName, formCategory, formIngredients);
  }, [formName, formCategory, formIngredients]);

  // Initialize fields on open
  useEffect(() => {
    if (isOpen) {
      setFormCode(initialCode.trim() || '');
      setFormBarcode(initialBarcode.trim());
      setFormName(initialName.trim());
      setFormCategory('drug');
      setFormSubcategory('');
      setIsCustomSubcategory(false);
      setFormMolecules([{ name: '', strength: '' }]);
      setFormPediatricDosage('');
      setFormPresentation('');
      setFormIsDivisible(false);
      setFormPiecesPerBox('');
      setFormPieceName('');
      setFormPiecePriceUSD('');
      setIsPiecePriceManual(false);
      setFormForm('Tablet');
      setFormPriceLBP('');
      setFormPriceUSD('');
      setFormMargin('20');
      setFormAgent(suppliers[0]?.name || 'Mersaco Sal');
      setFormBatchNumber(initialBatch || '');
      setFormExpiryDate(initialExpiry || '');
      setFormIndications('');
      setFormContraindications('');
      setFormSideEffects('');
      setFormGenerics('');
      setShowDiscardConfirmModal(false);
    }
  }, [isOpen, initialBarcode, initialCode, initialName, initialBatch, initialExpiry, exchangeRate, suppliers]);

  const hasFilledData = () => {
    if (formName.trim() !== (initialName || '').trim() && formName.trim() !== '') return true;
    if (formBarcode.trim() !== (initialBarcode || '').trim() && formBarcode.trim() !== '') return true;
    if (formDosage.trim() !== '') return true;
    if (formPediatricDosage.trim() !== '') return true;
    if (formPresentation.trim() !== '') return true;
    if (formIngredients.trim() !== '') return true;
    if (formPriceLBP.trim() !== '' && formPriceLBP.trim() !== '0') return true;
    if (formPriceUSD.trim() !== '' && formPriceUSD.trim() !== '0' && formPriceUSD.trim() !== '0.00') return true;
    if (formIsDivisible) return true;
    if (formPiecesPerBox !== '' && formPiecesPerBox !== 0) return true;
    if (formPieceName.trim() !== '') return true;
    if (formPiecePriceUSD.trim() !== '') return true;
    if (formCode.trim() !== (initialCode || '').trim() && formCode.trim() !== '') return true;
    if (formBatchNumber.trim() !== (initialBatch || '').trim() && formBatchNumber.trim() !== '') return true;
    if (formExpiryDate.trim() !== (initialExpiry || '').trim() && formExpiryDate.trim() !== '') return true;
    if (formSubcategory.trim() !== '' || isCustomSubcategory) return true;
    if (
      formIndications.trim() !== '' ||
      formContraindications.trim() !== '' ||
      formSideEffects.trim() !== '' ||
      formGenerics.trim() !== ''
    ) return true;
    if (formCategory !== 'drug') return true;
    if (formForm !== 'Tablet') return true;
    if (suppliers.length > 0 && formAgent !== suppliers[0]?.name) return true;
    return false;
  };

  const handleRequestClose = () => {
    if (hasFilledData()) {
      setShowDiscardConfirmModal(true);
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  const handleAutoFetchScientificData = async () => {
    const term = formIngredients.trim();
    if (!term) return;
    setIsFetchingScientifics(true);
    try {
      const res = await searchScientificDataOnline(term, formName.trim());
      if (res && res.scientificInfo) {
        setFormIndications(res.scientificInfo.indications || '');
        setFormContraindications(res.scientificInfo.contraindications || '');
        setFormSideEffects(res.scientificInfo.sideEffects || '');
        if (res.scientificInfo.generics && res.scientificInfo.generics.length > 0) {
          setFormGenerics(res.scientificInfo.generics.join(', '));
        }
        if (!formDosage && res.scientificInfo.dosage) {
          setFormMolecules((prev) => {
            if (prev.length === 0) return [{ name: '', strength: res.scientificInfo.dosage || '' }];
            return prev.map((m, i) => (i === 0 && !m.strength.trim() ? { ...m, strength: res.scientificInfo.dosage || '' } : m));
          });
        }
        if (!formPediatricDosage && res.scientificInfo.pediatricDosage) {
          setFormPediatricDosage(res.scientificInfo.pediatricDosage);
        }
        if (!formForm && res.scientificInfo.form) {
          setFormForm(res.scientificInfo.form);
        }
      }
    } finally {
      setIsFetchingScientifics(false);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const priceLBP = parseFloat(formPriceLBP.replace(/[^\d.]/g, '')) || 0;
    const priceUSD = parseFloat(formPriceUSD) || Number((priceLBP / exchangeRate).toFixed(2));
    const margin = parseFloat(formMargin) || 20;
    const costPriceUSD = Number((priceUSD * (1 - margin / 100)).toFixed(2));

    const batches = formBatchNumber.trim()
      ? [{ batchNumber: formBatchNumber.trim(), expiryDate: formExpiryDate.trim(), quantity: 0 }]
      : [];

    const batchNumber = formBatchNumber.trim();
    const expiryDate = formExpiryDate.trim();
    const resolvedCode = formCode.trim().toUpperCase();
    const molecules = formMolecules
      .filter((m) => m.name.trim())
      .map((m) => ({ name: m.name.trim(), strength: m.strength.trim() }));

    let scientificInfo: ScientificDrugInfo | undefined = undefined;
    if (formCategory === 'drug') {
      const baseProd: Product = {
        id: 'temp-preview',
        code: resolvedCode,
        barcode: formBarcode.trim(),
        name: formName.trim(),
        category: formCategory,
        subcategory: formSubcategory.trim() || undefined,
        ingredients: formIngredients,
        dosage: formDosage,
        molecules,
        presentation: formPresentation,
        form: formForm,
        isDivisible: formIsDivisible,
        piecesPerBox: formIsDivisible ? Number(formPiecesPerBox) || 0 : undefined,
        pieceName: formIsDivisible ? formPieceName : undefined,
        piecePriceUSD: formIsDivisible && formPiecePriceUSD ? Number(formPiecePriceUSD) : undefined,
        priceLBP,
        priceUSD,
        costPriceUSD,
        pharmacistMarginProfit: margin,
        agent: formAgent,
        stockQuantity: 0,
        minStockAlert: 5,
        expiryDate: formExpiryDate.trim(),
        batchNumber: formBatchNumber.trim(),
        updatedAt: Date.now(),
        version: 1,
      };
      scientificInfo = resolveStraightforwardScientificInfo(baseProd);
      if (formIndications || formContraindications || formSideEffects || formGenerics) {
        scientificInfo = {
          ...scientificInfo,
          indications: formIndications || scientificInfo?.indications,
          contraindications: formContraindications || scientificInfo?.contraindications,
          sideEffects: formSideEffects || scientificInfo?.sideEffects,
          generics: formGenerics ? formGenerics.split(',').map((s) => s.trim()) : scientificInfo?.generics,
        };
      }
    }

    const productPayload: Omit<Product, 'id' | 'updatedAt' | 'version'> = {
      code: resolvedCode,
      barcode: formBarcode.trim(),
      name: formName.trim(),
      category: formCategory,
      subcategory: formSubcategory.trim() || undefined,
      ingredients: formIngredients,
      dosage: formDosage,
      molecules,
      presentation: formPresentation,
      form: formForm,
      isDivisible: formIsDivisible,
      piecesPerBox: formIsDivisible ? Number(formPiecesPerBox) || 0 : undefined,
      pieceName: formIsDivisible ? formPieceName : undefined,
      piecePriceUSD: formIsDivisible && formPiecePriceUSD ? Number(formPiecePriceUSD) : undefined,
      priceLBP,
      priceUSD,
      costPriceUSD,
      pharmacistMarginProfit: margin,
      agent: formAgent,
      stockQuantity: 0,
      minStockAlert: 5,
      expiryDate: formExpiryDate.trim(),
      batchNumber: formBatchNumber.trim(),
      batches,
      scientificInfo,
    };

    addProduct(productPayload);

    const generatedProduct: Product = {
      ...productPayload,
      id: `prod-${Date.now()}`,
      updatedAt: Date.now(),
      version: 1,
    };

    addNotification(
      'Inventory Updated',
      `Added "${generatedProduct.name}" (${generatedProduct.code}) to stock.`,
      'inventory',
      'success'
    );

    if (onProductAdded) {
      onProductAdded(generatedProduct);
    }

    onClose();
  };

  return (
    <>
      <DesktopWindow
        id="add-stock-product-window"
        title="Add New Inventory Item to Stock"
        isOpen={isOpen}
        section="stock"
        onClose={handleRequestClose}
        width="720px"
        height="85vh"
      >
        <form
          onSubmit={handleSaveProduct}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              handleRequestClose();
            }
          }}
          className="p-6 space-y-4 flex-1 overflow-y-auto text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Drug Code
              </label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="Optional / Manual Code"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold uppercase focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Barcode
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  id="input-add-product-barcode"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  placeholder="Optional / EAN"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-9 py-2 font-mono font-bold focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  id="btn-generate-add-product-barcode"
                  onClick={() => setFormBarcode(generateRandomBarcode())}
                  title="Generate random barcode"
                  aria-label="Generate random barcode"
                  className="absolute right-1.5 p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-md transition-colors cursor-pointer"
                >
                  <Dices className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Product Trade Name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="e.g. Panadol Extra"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={formCategory}
                onChange={(e) => {
                  const newCat = e.target.value as ProductCategory;
                  setFormCategory(newCat);
                  if (!formSubcategory && !isCustomSubcategory) {
                    const suggested = suggestSubcategory(formName, newCat, formIngredients);
                    if (suggested) setFormSubcategory(suggested);
                  }
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-bold uppercase focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="drug">Drug (Medicines)</option>
                <option value="vitamins">Vitamins</option>
                <option value="cosmetics">Cosmetics</option>
                <option value="para">Para (Medical / Diagnostic)</option>
                {settings.customCategories?.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Subcategory
                </label>
                {suggestedSubcategory && suggestedSubcategory !== formSubcategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomSubcategory(false);
                      setFormSubcategory(suggestedSubcategory);
                    }}
                    className="text-[10px] text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold underline cursor-pointer truncate max-w-[130px]"
                    title={`Click to apply suggestion: ${suggestedSubcategory}`}
                  >
                    Suggest: {suggestedSubcategory}
                  </button>
                )}
              </div>
              <select
                value={isCustomSubcategory ? 'custom' : formSubcategory}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setIsCustomSubcategory(true);
                    setFormSubcategory('');
                  } else {
                    setIsCustomSubcategory(false);
                    setFormSubcategory(e.target.value);
                  }
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 text-sm"
              >
                <option value="custom">Custom (Create new subcategory...)</option>
                <option value="">-- None (No subcategory) --</option>
                {allSubcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>

              {isCustomSubcategory && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    value={formSubcategory}
                    onChange={(e) => setFormSubcategory(e.target.value)}
                    placeholder="Type new custom subcategory..."
                    className="flex-1 rounded-lg border border-teal-500 bg-white px-3 py-1.5 text-xs font-medium focus:outline-hidden dark:border-teal-400 dark:bg-slate-900 dark:text-slate-100 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomSubcategory(false);
                      setFormSubcategory('');
                    }}
                    className="px-2 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                    title="Cancel custom subcategory"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Form
              </label>
              <input
                type="text"
                list="forms-list"
                value={formForm}
                onChange={(e) => setFormForm(e.target.value)}
                placeholder="e.g. Tablet, Syrup, Cream"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <datalist id="forms-list">
                <option value="Tablet" />
                <option value="Syrup" />
                <option value="Cream" />
                {settings.customForms?.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Presentation
              </label>
              <input
                type="text"
                list="presentations-list"
                value={formPresentation}
                onChange={(e) => setFormPresentation(e.target.value)}
                placeholder="e.g. 24 Film-Coated Tablets"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <datalist id="presentations-list">
                {settings.customPresentations?.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Pieces Division Setup */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="modalIsDivisibleCheck"
                checked={formIsDivisible}
                onChange={(e) => setFormIsDivisible(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
              />
              <label htmlFor="modalIsDivisibleCheck" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                Divide Box into Pieces
              </label>
            </div>
            {formIsDivisible && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-6 border-l-2 border-teal-200 dark:border-teal-900 mt-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pieces per Box *
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={formPiecesPerBox}
                    onChange={(e) => {
                      setFormPiecesPerBox(e.target.value);
                      const val = parseFloat(e.target.value);
                      if (!isPiecePriceManual && !isNaN(val) && val > 0 && formPriceUSD) {
                        setFormPiecePriceUSD((Number(formPriceUSD) / val).toFixed(2));
                      }
                    }}
                    placeholder="e.g. 30"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    required={formIsDivisible}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Piece Name *
                  </label>
                  <input
                    type="text"
                    value={formPieceName}
                    onChange={(e) => setFormPieceName(e.target.value)}
                    placeholder="e.g. Sachet, Ampoule, Pen"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    required={formIsDivisible}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    1 Piece Price ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formPiecePriceUSD}
                    onChange={(e) => {
                      setFormPiecePriceUSD(e.target.value);
                      setIsPiecePriceManual(true);
                    }}
                    placeholder="e.g. 1.50"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Active Ingredients & Agent */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Active Ingredients / Molecules
                </label>
                <button
                  type="button"
                  onClick={handleAutoFetchScientificData}
                  disabled={isFetchingScientifics || (!formIngredients.trim() && !formName.trim())}
                  className="flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 disabled:opacity-40 cursor-pointer"
                  title="Auto-fetch indications & dosage online"
                >
                  <Sparkles className={`w-3 h-3 ${isFetchingScientifics ? 'animate-spin text-amber-500' : ''}`} />
                  <span>{isFetchingScientifics ? 'Fetching...' : 'AI Enrich'}</span>
                </button>
              </div>
              <div className="flex items-center gap-2 px-1 mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <span className="flex-1 min-w-0">Ingredient / Molecule</span>
                <span className="flex-1 min-w-0">Strength / Dosage</span>
                <span className="w-6 shrink-0" />
              </div>
              <div className="space-y-1.5">
                {formMolecules.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => {
                        const next = [...formMolecules];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setFormMolecules(next);
                      }}
                      placeholder={`Ingredient ${idx + 1} (e.g. Paracetamol)`}
                      className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      value={m.strength}
                      onChange={(e) => {
                        const next = [...formMolecules];
                        next[idx] = { ...next[idx], strength: e.target.value };
                        setFormMolecules(next);
                      }}
                      placeholder="e.g. 500mg"
                      className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      title="Remove ingredient"
                      aria-label="Remove ingredient"
                      onClick={() => {
                        if (formMolecules.length === 1) return;
                        setFormMolecules(formMolecules.filter((_, i) => i !== idx));
                      }}
                      disabled={formMolecules.length === 1}
                      className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFormMolecules((prev) => [...prev, { name: '', strength: '' }])}
                className="mt-2 flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Add another ingredient
              </button>
            </div>

            <div className="relative">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Agent / Lebanese Distributor
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formAgent}
                  onChange={(e) => {
                    setFormAgent(e.target.value);
                    setShowAgentDropdown(true);
                  }}
                  onFocus={() => setShowAgentDropdown(true)}
                  onBlur={() => setTimeout(() => setShowAgentDropdown(false), 200)}
                  placeholder="e.g. Mersaco, Omnipharma, Fattal"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {showAgentDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suppliers
                      .filter((s) => s.name.toLowerCase().includes(formAgent.toLowerCase()))
                      .slice(0, 5)
                      .map((agent) => (
                        <div
                          key={agent.id}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFormAgent(agent.name);
                            setShowAgentDropdown(false);
                          }}
                        >
                          {agent.name}
                        </div>
                      ))}
                    <div
                      className="px-3 py-2 cursor-pointer bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 font-medium text-xs flex items-center justify-between sticky bottom-0 border-t border-teal-100 dark:border-teal-800/50"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setNewSupplierName(formAgent);
                        setIsAddSupplierModalOpen(true);
                        setShowAgentDropdown(false);
                      }}
                    >
                      + Add Custom Supplier
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pricing in LBP, USD, Margin */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
            <span className="font-bold text-slate-900 dark:text-slate-100 block">
              Dual-Currency Pricing & Profit Margin
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Price in LBP (L.L.) *
                </label>
                <input
                  type="text"
                  value={formPriceLBP}
                  onChange={(e) => {
                    setFormPriceLBP(e.target.value);
                    const num = parseFloat(e.target.value.replace(/[^\d.]/g, ''));
                    if (!isNaN(num)) {
                      const usdVal = num / exchangeRate;
                      setFormPriceUSD(usdVal.toFixed(2));
                      if (formPiecesPerBox && !formPiecePriceUSD) {
                        setFormPiecePriceUSD((usdVal / Number(formPiecesPerBox)).toFixed(2));
                      }
                    }
                  }}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Price in USD ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formPriceUSD}
                  onChange={(e) => {
                    setFormPriceUSD(e.target.value);
                    const num = parseFloat(e.target.value);
                    if (!isNaN(num)) {
                      setFormPriceLBP(Math.round(num * exchangeRate).toString());
                      if (formPiecesPerBox && !formPiecePriceUSD) {
                        setFormPiecePriceUSD((num / Number(formPiecesPerBox)).toFixed(2));
                      }
                    }
                  }}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pharmacist Margin %
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formMargin}
                  onChange={(e) => setFormMargin(e.target.value)}
                  placeholder="20"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Initial Batch & Expiry (Optional) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
            <span className="font-bold text-slate-900 dark:text-slate-100 block">
              Initial Batch & Expiry (Optional)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Batch / Lot Number
                </label>
                <input
                  type="text"
                  value={formBatchNumber}
                  onChange={(e) => setFormBatchNumber(e.target.value)}
                  placeholder="e.g. BT-90214"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 uppercase font-mono focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expiry Date (YYYY-MM-DD or MM/YY)
                </label>
                <input
                  type="text"
                  value={formExpiryDate}
                  onChange={(e) => setFormExpiryDate(e.target.value)}
                  placeholder="e.g. 2027-12-31"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              id="btn-cancel-add-stock-modal"
              onClick={handleRequestClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-save-add-stock-modal"
              className="flex items-center space-x-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 cursor-pointer active:scale-95 transition-all"
            >
              <Check className="h-4 w-4" />
              <span>Save & Add to Invoice</span>
            </button>
          </div>
        </form>
      </DesktopWindow>

      {/* Discard Confirmation Modal for Add Item */}
      {showDiscardConfirmModal && (
        <div
          id="modal-discard-add-stock-item"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDiscardConfirmModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 pt-0.5">
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Discard Unsaved Item?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    You have entered information for this new item that has not been saved yet. If you close now, all entered data will be discarded.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="btn-keep-editing-stock-item"
                onClick={() => setShowDiscardConfirmModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
              >
                Keep Editing
              </button>
              <button
                type="button"
                id="btn-discard-and-close-stock-item"
                onClick={() => {
                  setShowDiscardConfirmModal(false);
                  onClose();
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer shadow-2xs"
              >
                Discard & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Supplier Modal */}
      {isAddSupplierModalOpen && (
        <DesktopWindow
          title="Add New Supplier"
          isOpen={true}
          onClose={() => setIsAddSupplierModalOpen(false)}
          width="480px"
          height="auto"
        >
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-teal-500 focus:outline-hidden dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder="e.g. +961 1 234 567"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-teal-500 focus:outline-hidden dark:text-slate-100"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddSupplierModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newSupplierName.trim()) {
                    addSupplier({
                      name: newSupplierName.trim(),
                      code: `SUP-${Math.floor(100 + Math.random() * 900)}`,
                      phone: newSupplierPhone.trim(),
                      email: '',
                      address: 'Lebanon',
                      contactPerson: '',
                      paymentTerms: '30 Days Net',
                      balanceUSD: 0,
                      balanceLBP: 0,
                    });
                    setFormAgent(newSupplierName.trim());
                    setIsAddSupplierModalOpen(false);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs cursor-pointer"
              >
                Save Supplier
              </button>
            </div>
          </div>
        </DesktopWindow>
      )}
    </>
  );
};
