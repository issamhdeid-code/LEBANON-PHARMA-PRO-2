import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Check, X, Plus, Sparkles, AlertTriangle, Dices, ChevronDown, Search } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Product, ProductCategory, ScientificDrugInfo, MoleculeStrength } from '../../types/pharmacy';
import { resolveStraightforwardScientificInfo } from '../../services/scientificDataService';
import { generateRandomBarcode } from '../../utils/stockUtils';
import { getSubcategoryOptions, suggestSubcategory } from '../../constants/subcategories';
import { DesktopWindow } from '../common/DesktopWindow';
import {
  getStandardPharmaceuticalForms,
  normalizePharmaceuticalForm,
  isCanonicalPharmaceuticalForm,
} from '../../utils/pharmaceuticalFormUtils';
import {
  getStandardPresentations,
  normalizePresentation,
} from '../../utils/presentationUtils';
import { formatLBPValue } from '../../utils/priceUtils';

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
    updateSettings,
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
  const [formCategory, setFormCategory] = useState<ProductCategory | string>('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Subcategory Dropdown State
  const [formSubcategory, setFormSubcategory] = useState('');
  const [isSubcategoryDropdownOpen, setIsSubcategoryDropdownOpen] = useState(false);
  const [subcategorySearchQuery, setSubcategorySearchQuery] = useState('');
  const [isAddingCustomSubcategory, setIsAddingCustomSubcategory] = useState(false);
  const [customSubcategoryInput, setCustomSubcategoryInput] = useState('');
  const subcategoryDropdownRef = useRef<HTMLDivElement>(null);

  const [formMolecules, setFormMolecules] = useState<MoleculeStrength[]>([{ name: '', strength: '' }]);
  const formIngredients = formMolecules.map((m) => m.name.trim()).filter(Boolean).join(' + ');
  const formDosage = formMolecules.map((m) => m.strength.trim()).filter(Boolean).join(', ');
  const [formPediatricDosage, setFormPediatricDosage] = useState('');

  // Presentation Dropdown State
  const [formPresentation, setFormPresentation] = useState('');
  const [isPresentationDropdownOpen, setIsPresentationDropdownOpen] = useState(false);
  const [presentationSearchQuery, setPresentationSearchQuery] = useState('');
  const [isAddingCustomPresentation, setIsAddingCustomPresentation] = useState(false);
  const [customPresentationInput, setCustomPresentationInput] = useState('');
  const presentationDropdownRef = useRef<HTMLDivElement>(null);

  const [formIsDivisible, setFormIsDivisible] = useState(false);
  const [formPiecesPerBox, setFormPiecesPerBox] = useState<string | number>('');
  const [formPieceName, setFormPieceName] = useState('');
  const [formPieceBarcode, setFormPieceBarcode] = useState('');
  const [formPiecePriceUSD, setFormPiecePriceUSD] = useState('');
  const [formPiecePriceLBP, setFormPiecePriceLBP] = useState('');
  const [isPiecePriceManual, setIsPiecePriceManual] = useState(false);

  // Form (Pharmaceutical) Dropdown State
  const [formForm, setFormForm] = useState('');
  const [isFormDropdownOpen, setIsFormDropdownOpen] = useState(false);
  const [formSearchQuery, setFormSearchQuery] = useState('');
  const [isAddingCustomForm, setIsAddingCustomForm] = useState(false);
  const [customFormInput, setCustomFormInput] = useState('');
  const formDropdownRef = useRef<HTMLDivElement>(null);

  // Agent / Distributor Dropdown State
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [isAddingCustomAgent, setIsAddingCustomAgent] = useState(false);
  const [customAgentInput, setCustomAgentInput] = useState('');
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const [formPriceLBP, setFormPriceLBP] = useState('350000');
  const [formPriceUSD, setFormPriceUSD] = useState('3.89');
  const [formMargin, setFormMargin] = useState('20');
  const [formAgent, setFormAgent] = useState('');

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
    if (formSubcategory && !list.includes(formSubcategory)) {
      return [formSubcategory, ...list];
    }
    return list;
  }, [products, formSubcategory, settings.customGlobalSubcategories]);

  const filteredSubcategories = useMemo(() => {
    if (!subcategorySearchQuery.trim()) return allSubcategories;
    const q = subcategorySearchQuery.toLowerCase().trim();
    return allSubcategories.filter((s) => s.toLowerCase().includes(q));
  }, [allSubcategories, subcategorySearchQuery]);

  const handleSelectSubcategory = (sub: string) => {
    setFormSubcategory(sub);
    setIsSubcategoryDropdownOpen(false);
    setSubcategorySearchQuery('');
  };

  const handleAddCustomSubcategory = (newSub: string) => {
    const trimmed = newSub.trim();
    if (!trimmed) return;
    const currentCustom = settings.customGlobalSubcategories || [];
    if (!currentCustom.includes(trimmed)) {
      updateSettings({ customGlobalSubcategories: [...currentCustom, trimmed] });
    }
    handleSelectSubcategory(trimmed);
    setIsAddingCustomSubcategory(false);
    setCustomSubcategoryInput('');
  };

  const suggestedSubcategory = useMemo(() => {
    if (!formCategory) return '';
    return suggestSubcategory(formName, formCategory as ProductCategory, formIngredients);
  }, [formName, formCategory, formIngredients]);

  // 24 standard canonical forms + genuine custom forms from settings
  const allAvailableForms = useMemo(() => {
    return getStandardPharmaceuticalForms(settings.customForms);
  }, [settings.customForms]);

  const filteredForms = useMemo(() => {
    if (!formSearchQuery.trim()) return allAvailableForms;
    const q = formSearchQuery.toLowerCase().trim();
    return allAvailableForms.filter((f) => f.toLowerCase().includes(q));
  }, [allAvailableForms, formSearchQuery]);

  const handleSelectForm = (f: string) => {
    setFormForm(f);
    setIsFormDropdownOpen(false);
    setFormSearchQuery('');
  };

  const handleAddCustomForm = (newForm: string) => {
    const trimmed = newForm.trim();
    if (!trimmed) return;
    const normalized = normalizePharmaceuticalForm(trimmed);
    setFormForm(normalized);
    setIsAddingCustomForm(false);
    setCustomFormInput('');
    setIsFormDropdownOpen(false);
    setFormSearchQuery('');
    // If no new form other than the 24 standard forms, don't add anything to customForms
    if (!isCanonicalPharmaceuticalForm(normalized)) {
      const existing = settings.customForms || [];
      if (!existing.some((f) => f.toLowerCase() === normalized.toLowerCase())) {
        updateSettings({ customForms: [...existing, normalized] });
      }
    }
  };

  // Canonical presentation standards + custom presentations from settings
  const allAvailablePresentations = useMemo(() => {
    return getStandardPresentations(settings.customPresentations);
  }, [settings.customPresentations]);

  const filteredPresentations = useMemo(() => {
    if (!presentationSearchQuery.trim()) return allAvailablePresentations;
    const q = presentationSearchQuery.toLowerCase().trim();
    return allAvailablePresentations.filter((p) => p.toLowerCase().includes(q));
  }, [allAvailablePresentations, presentationSearchQuery]);

  const handleSelectPresentation = (p: string) => {
    setFormPresentation(p);
    setIsPresentationDropdownOpen(false);
    setPresentationSearchQuery('');
  };

  const handleAddCustomPresentation = (newPres: string) => {
    const trimmed = newPres.trim();
    if (!trimmed) return;
    setFormPresentation(trimmed);
    setIsAddingCustomPresentation(false);
    setCustomPresentationInput('');
    setIsPresentationDropdownOpen(false);
    setPresentationSearchQuery('');
    const existing = settings.customPresentations || [];
    if (!existing.includes(trimmed)) {
      updateSettings({ customPresentations: [...existing, trimmed] });
    }
  };

  // Click outside category/subcategory/form/presentation dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
      if (subcategoryDropdownRef.current && !subcategoryDropdownRef.current.contains(e.target as Node)) {
        setIsSubcategoryDropdownOpen(false);
      }
      if (formDropdownRef.current && !formDropdownRef.current.contains(e.target as Node)) {
        setIsFormDropdownOpen(false);
      }
      if (presentationDropdownRef.current && !presentationDropdownRef.current.contains(e.target as Node)) {
        setIsPresentationDropdownOpen(false);
      }
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target as Node)) {
        setIsAgentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Agent / Lebanese Distributor options
  const allAvailableAgents = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      if (s.name?.trim()) set.add(s.name.trim());
    });
    if (formAgent?.trim()) set.add(formAgent.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [suppliers, formAgent]);

  const filteredAgents = useMemo(() => {
    if (!agentSearchQuery.trim()) return allAvailableAgents;
    const q = agentSearchQuery.toLowerCase().trim();
    return allAvailableAgents.filter((a) => a.toLowerCase().includes(q));
  }, [allAvailableAgents, agentSearchQuery]);

  const handleSelectAgent = (agentName: string) => {
    setFormAgent(agentName);
    setIsAgentDropdownOpen(false);
    setAgentSearchQuery('');
  };

  const handleAddCustomAgent = (newAgent: string) => {
    const trimmed = newAgent.trim();
    if (!trimmed) return;
    const existing = suppliers.some((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      addSupplier({
        name: trimmed,
        code: `SUP-${Math.floor(100 + Math.random() * 900)}`,
        phone: '',
        email: '',
        address: 'Lebanon',
        contactPerson: '',
        paymentTerms: '30 Days Net',
        balanceUSD: 0,
        balanceLBP: 0,
      });
    }
    setFormAgent(trimmed);
    setIsAddingCustomAgent(false);
    setCustomAgentInput('');
    setIsAgentDropdownOpen(false);
    setAgentSearchQuery('');
  };

  const standardCategories: { value: ProductCategory; label: string }[] = useMemo(() => [
    { value: 'cosmetics', label: 'Cosmetics' },
    { value: 'drug', label: 'Drug' },
    { value: 'para', label: 'Para' },
    { value: 'vitamins', label: 'Vitamins' },
  ], []);

  const allCategoryOptions = useMemo(() => {
    const customList = (settings.customCategories || []).map((c) => ({ value: c as ProductCategory, label: c }));
    return [...standardCategories, ...customList].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    );
  }, [settings.customCategories, standardCategories]);

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return allCategoryOptions;
    const q = categorySearchQuery.toLowerCase().trim();
    return allCategoryOptions.filter((c) => c.label.toLowerCase().includes(q));
  }, [allCategoryOptions, categorySearchQuery]);

  const handleSelectCategory = (newCat: string) => {
    setFormCategory(newCat);
    setIsCategoryDropdownOpen(false);
    setCategorySearchQuery('');
    if (!formSubcategory) {
      const suggested = suggestSubcategory(formName, newCat as ProductCategory, formIngredients);
      if (suggested) setFormSubcategory(suggested);
    }
  };

  const handleAddCustomCategory = (newCatName: string) => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const currentCustom = settings.customCategories || [];
    if (!currentCustom.includes(trimmed) && !['drug', 'vitamins', 'cosmetics', 'para'].includes(trimmed.toLowerCase())) {
      updateSettings({ customCategories: [...currentCustom, trimmed] });
    }
    handleSelectCategory(trimmed);
    setIsAddingCustomCategory(false);
    setCustomCategoryInput('');
  };

  // Initialize fields on open
  useEffect(() => {
    if (isOpen) {
      setFormCode(initialCode.trim() || '');
      setFormBarcode(initialBarcode.trim());
      setFormName(initialName.trim());
      setFormCategory('');
      setIsCategoryDropdownOpen(false);
      setCategorySearchQuery('');
      setIsAddingCustomCategory(false);
      setCustomCategoryInput('');
      setFormSubcategory('');
      setIsSubcategoryDropdownOpen(false);
      setSubcategorySearchQuery('');
      setIsAddingCustomSubcategory(false);
      setCustomSubcategoryInput('');
      setFormMolecules([{ name: '', strength: '' }]);
      setFormPediatricDosage('');
      setFormPresentation('');
      setIsPresentationDropdownOpen(false);
      setPresentationSearchQuery('');
      setIsAddingCustomPresentation(false);
      setCustomPresentationInput('');
      setFormIsDivisible(false);
      setFormPiecesPerBox('');
      setFormPieceName('');
      setFormPiecePriceUSD('');
      setIsPiecePriceManual(false);
      setFormForm('');
      setIsFormDropdownOpen(false);
      setFormSearchQuery('');
      setIsAddingCustomForm(false);
      setCustomFormInput('');
      setFormPriceLBP('');
      setFormPriceUSD('');
      setFormMargin('20');
      setFormAgent('');
      setIsAgentDropdownOpen(false);
      setAgentSearchQuery('');
      setIsAddingCustomAgent(false);
      setCustomAgentInput('');
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
    if (formPieceBarcode.trim() !== '') return true;
    if (formPiecePriceUSD.trim() !== '' || formPiecePriceLBP.trim() !== '') return true;
    if (formCode.trim() !== (initialCode || '').trim() && formCode.trim() !== '') return true;
    if (formBatchNumber.trim() !== (initialBatch || '').trim() && formBatchNumber.trim() !== '') return true;
    if (formExpiryDate.trim() !== (initialExpiry || '').trim() && formExpiryDate.trim() !== '') return true;
    if (formSubcategory.trim() !== '') return true;
    if (
      formIndications.trim() !== '' ||
      formContraindications.trim() !== '' ||
      formSideEffects.trim() !== '' ||
      formGenerics.trim() !== ''
    ) return true;
    if (formCategory !== 'drug') return true;
    if (formForm.trim() !== '') return true;
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
    const resolvedCat = (formCategory || 'drug') as ProductCategory;
    const molecules = formMolecules
      .filter((m) => m.name.trim())
      .map((m) => ({ name: m.name.trim(), strength: m.strength.trim() }));

    const resolvedPiecePriceUSD = formIsDivisible
      ? (formPiecePriceUSD ? Number(parseFloat(formPiecePriceUSD).toFixed(2)) : (formPiecePriceLBP ? Number((parseFloat(formPiecePriceLBP.replace(/[^\d.]/g, '')) / exchangeRate).toFixed(2)) : undefined))
      : undefined;
    const resolvedPiecePriceLBP = formIsDivisible
      ? (formPiecePriceLBP ? Math.round(parseFloat(formPiecePriceLBP.replace(/[^\d.]/g, ''))) : (resolvedPiecePriceUSD ? Math.round(resolvedPiecePriceUSD * exchangeRate) : undefined))
      : undefined;
    const resolvedPieceBarcode = formIsDivisible && formPieceBarcode.trim() ? formPieceBarcode.trim() : undefined;

    let scientificInfo: ScientificDrugInfo | undefined = undefined;
    if (resolvedCat === 'drug') {
      const baseProd: Product = {
        id: 'temp-preview',
        code: resolvedCode,
        barcode: formBarcode.trim(),
        name: formName.trim(),
        category: resolvedCat,
        subcategory: formSubcategory.trim() || undefined,
        ingredients: formIngredients,
        dosage: formDosage,
        molecules,
        presentation: formPresentation,
        form: formForm,
        isDivisible: formIsDivisible,
        piecesPerBox: formIsDivisible ? Number(formPiecesPerBox) || 0 : undefined,
        pieceName: formIsDivisible ? formPieceName : undefined,
        pieceBarcode: resolvedPieceBarcode,
        piecePriceUSD: resolvedPiecePriceUSD,
        piecePriceLBP: resolvedPiecePriceLBP,
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
      category: resolvedCat,
      subcategory: formSubcategory.trim() || undefined,
      ingredients: formIngredients,
      dosage: formDosage,
      molecules,
      presentation: formPresentation,
      form: formForm ? normalizePharmaceuticalForm(formForm) : 'Tablet',
      isDivisible: formIsDivisible,
      piecesPerBox: formIsDivisible ? Number(formPiecesPerBox) || 0 : undefined,
      pieceName: formIsDivisible ? formPieceName : undefined,
      pieceBarcode: resolvedPieceBarcode,
      piecePriceUSD: resolvedPiecePriceUSD,
      piecePriceLBP: resolvedPiecePriceLBP,
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
              <label className="block font-bold not-italic text-slate-700 dark:text-slate-300 mb-1">
                Item Code
              </label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-normal uppercase focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Barcode
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  id="input-add-product-barcode"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-9 py-2 font-mono font-normal focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
              <label className="block font-bold text-left text-slate-700 dark:text-slate-300 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative" ref={categoryDropdownRef}>
              <label className="block font-bold leading-4 text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>

              {/* Backwards-compatible select for form DOM query compatibility */}
              <select
                value={formCategory}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setIsAddingCustomCategory(true);
                    setIsCategoryDropdownOpen(false);
                  } else {
                    handleSelectCategory(val);
                  }
                }}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                <option value="" className="text-slate-400">Choose Category</option>
                {allCategoryOptions.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
                <option value="custom">Custom Category</option>
              </select>

              {/* Searchable Combobox Trigger */}
              <button
                type="button"
                onClick={() => {
                  setIsCategoryDropdownOpen((prev) => !prev);
                  setCategorySearchQuery('');
                }}
                className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs normal-case flex items-center justify-between focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 cursor-pointer ${
                  !formCategory
                    ? 'text-slate-400 dark:text-slate-500 font-normal'
                    : 'text-slate-800 dark:text-slate-100 font-normal'
                }`}
              >
                <span className="truncate normal-case">
                  {allCategoryOptions.find((c) => c.value === formCategory)?.label || (formCategory ? formCategory : 'Choose Category')}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Searchable Dropdown Menu */}
              {isCategoryDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  {/* Search by typing */}
                  <div className="p-1.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search category..."
                        value={categorySearchQuery}
                        onChange={(e) => setCategorySearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (filteredCategories.length > 0) {
                              handleSelectCategory(filteredCategories[0].value);
                            } else if (categorySearchQuery.trim()) {
                              handleAddCustomCategory(categorySearchQuery.trim());
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setIsCategoryDropdownOpen(false);
                          }
                        }}
                        className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Custom Category Button (at top) */}
                  <div className="border-b border-slate-100 dark:border-slate-700/60 p-1 bg-slate-50/50 dark:bg-slate-800/40">
                    {categorySearchQuery.trim() && !allCategoryOptions.some((c) => c.label.toLowerCase() === categorySearchQuery.trim().toLowerCase()) ? (
                      <button
                        type="button"
                        onClick={() => handleAddCustomCategory(categorySearchQuery.trim())}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add "{categorySearchQuery.trim()}" as Category</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCustomCategory(true);
                          setIsCategoryDropdownOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Custom Category</span>
                      </button>
                    )}
                  </div>

                  {/* Options list */}
                  <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                    {filteredCategories.map((cat) => {
                      const isSelected = formCategory === cat.value;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => handleSelectCategory(cat.value)}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{cat.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-600" />}
                        </button>
                      );
                    })}

                    {filteredCategories.length === 0 && (
                      <div className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                        No categories found
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inline custom category input */}
              {isAddingCustomCategory && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter new category name..."
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customCategoryInput.trim()) {
                          handleAddCustomCategory(customCategoryInput.trim());
                        }
                      } else if (e.key === 'Escape') {
                        setIsAddingCustomCategory(false);
                        setCustomCategoryInput('');
                      }
                    }}
                    className="flex-1 rounded-lg border border-teal-500 bg-white px-3 py-1.5 text-xs font-medium focus:outline-hidden dark:border-teal-400 dark:bg-slate-900 dark:text-slate-100 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customCategoryInput.trim()) {
                        handleAddCustomCategory(customCategoryInput.trim());
                      }
                    }}
                    disabled={!customCategoryInput.trim()}
                    className="rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomCategory(false);
                      setCustomCategoryInput('');
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Subcategory */}
            <div className="relative" ref={subcategoryDropdownRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold leading-4 text-slate-700 dark:text-slate-300">
                  Subcategory
                </label>
                {suggestedSubcategory && suggestedSubcategory !== formSubcategory && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSubcategory(suggestedSubcategory);
                    }}
                    className="text-[10px] text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold underline cursor-pointer truncate max-w-[130px]"
                    title={`Click to apply suggestion: ${suggestedSubcategory}`}
                  >
                    Suggest: {suggestedSubcategory}
                  </button>
                )}
              </div>

              {/* Backwards-compatible select for form DOM query compatibility */}
              <select
                value={formSubcategory}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setIsAddingCustomSubcategory(true);
                    setIsSubcategoryDropdownOpen(false);
                  } else {
                    handleSelectSubcategory(val);
                  }
                }}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                <option value="" className="text-slate-400">Choose Subcategory</option>
                {allSubcategories.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
                <option value="custom">Custom Subcategory</option>
              </select>

              {/* Searchable Combobox Trigger */}
              <button
                type="button"
                onClick={() => {
                  setIsSubcategoryDropdownOpen((prev) => !prev);
                  setSubcategorySearchQuery('');
                }}
                className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs normal-case flex items-center justify-between focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 cursor-pointer ${
                  !formSubcategory
                    ? 'text-slate-400 dark:text-slate-500 font-normal'
                    : 'text-slate-800 dark:text-slate-100 font-normal'
                }`}
              >
                <span className="truncate normal-case">
                  {formSubcategory || 'Choose Subcategory'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isSubcategoryDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Searchable Dropdown Menu */}
              {isSubcategoryDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  {/* Search by typing */}
                  <div className="p-1.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search subcategory..."
                        value={subcategorySearchQuery}
                        onChange={(e) => setSubcategorySearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (filteredSubcategories.length > 0) {
                              handleSelectSubcategory(filteredSubcategories[0]);
                            } else if (subcategorySearchQuery.trim()) {
                              handleAddCustomSubcategory(subcategorySearchQuery.trim());
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setIsSubcategoryDropdownOpen(false);
                          }
                        }}
                        className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Custom Subcategory Button (at top) */}
                  <div className="border-b border-slate-100 dark:border-slate-700/60 p-1 bg-slate-50/50 dark:bg-slate-800/40">
                    {subcategorySearchQuery.trim() && !allSubcategories.some((s) => s.toLowerCase() === subcategorySearchQuery.trim().toLowerCase()) ? (
                      <button
                        type="button"
                        onClick={() => handleAddCustomSubcategory(subcategorySearchQuery.trim())}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add "{subcategorySearchQuery.trim()}" as Subcategory</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCustomSubcategory(true);
                          setIsSubcategoryDropdownOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Custom Subcategory</span>
                      </button>
                    )}
                  </div>

                  {/* Options list */}
                  <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                    {filteredSubcategories.map((sub) => {
                      const isSelected = formSubcategory === sub;
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleSelectSubcategory(sub)}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{sub}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-600" />}
                        </button>
                      );
                    })}

                    {filteredSubcategories.length === 0 && (
                      <div className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                        No subcategories found
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inline custom subcategory input */}
              {isAddingCustomSubcategory && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter new subcategory..."
                    value={customSubcategoryInput}
                    onChange={(e) => setCustomSubcategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customSubcategoryInput.trim()) {
                          handleAddCustomSubcategory(customSubcategoryInput.trim());
                        }
                      } else if (e.key === 'Escape') {
                        setIsAddingCustomSubcategory(false);
                        setCustomSubcategoryInput('');
                      }
                    }}
                    className="flex-1 rounded-lg border border-teal-500 bg-white px-3 py-1.5 text-xs font-medium focus:outline-hidden dark:border-teal-400 dark:bg-slate-900 dark:text-slate-100 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customSubcategoryInput.trim()) {
                        handleAddCustomSubcategory(customSubcategoryInput.trim());
                      }
                    }}
                    disabled={!customSubcategoryInput.trim()}
                    className="rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomSubcategory(false);
                      setCustomSubcategoryInput('');
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Form */}
            <div className="relative" ref={formDropdownRef}>
              <label className="block font-bold leading-4 text-slate-700 dark:text-slate-300 mb-1">
                Form
              </label>

              {/* Backwards-compatible select for form DOM query compatibility */}
              <select
                value={formForm}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setIsAddingCustomForm(true);
                    setIsFormDropdownOpen(false);
                  } else {
                    handleSelectForm(val);
                  }
                }}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                <option value="" className="text-slate-400">Choose Form</option>
                {allAvailableForms.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
                <option value="custom">Custom Form</option>
              </select>

              {/* Searchable Combobox Trigger */}
              <button
                type="button"
                onClick={() => {
                  setIsFormDropdownOpen((prev) => !prev);
                  setFormSearchQuery('');
                }}
                className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs normal-case flex items-center justify-between focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 cursor-pointer ${
                  !formForm
                    ? 'text-slate-400 dark:text-slate-500 font-normal'
                    : 'text-slate-800 dark:text-slate-100 font-normal'
                }`}
              >
                <span className="truncate normal-case">
                  {formForm || 'Choose Form'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isFormDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Searchable Dropdown Menu */}
              {isFormDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  {/* Search by typing */}
                  <div className="p-1.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search form..."
                        value={formSearchQuery}
                        onChange={(e) => setFormSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (filteredForms.length > 0) {
                              handleSelectForm(filteredForms[0]);
                            } else if (formSearchQuery.trim()) {
                              handleAddCustomForm(formSearchQuery.trim());
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setIsFormDropdownOpen(false);
                          }
                        }}
                        className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Custom Form Button (at top) */}
                  <div className="border-b border-slate-100 dark:border-slate-700/60 p-1 bg-slate-50/50 dark:bg-slate-800/40">
                    {formSearchQuery.trim() && !allAvailableForms.some((f) => f.toLowerCase() === formSearchQuery.trim().toLowerCase()) ? (
                      <button
                        type="button"
                        onClick={() => handleAddCustomForm(formSearchQuery.trim())}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add "{formSearchQuery.trim()}" as Form</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCustomForm(true);
                          setIsFormDropdownOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Custom Form</span>
                      </button>
                    )}
                  </div>

                  {/* Options list */}
                  <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                    {filteredForms.map((f) => {
                      const isSelected = formForm === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => handleSelectForm(f)}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{f}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-600" />}
                        </button>
                      );
                    })}

                    {filteredForms.length === 0 && (
                      <div className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                        No forms found
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inline custom form input */}
              {isAddingCustomForm && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter new form (e.g. Capsule)..."
                    value={customFormInput}
                    onChange={(e) => setCustomFormInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customFormInput.trim()) {
                          handleAddCustomForm(customFormInput.trim());
                        }
                      } else if (e.key === 'Escape') {
                        setIsAddingCustomForm(false);
                        setCustomFormInput('');
                      }
                    }}
                    className="flex-1 rounded-lg border border-teal-500 bg-white px-3 py-1.5 text-xs font-medium focus:outline-hidden dark:border-teal-400 dark:bg-slate-900 dark:text-slate-100 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customFormInput.trim()) {
                        handleAddCustomForm(customFormInput.trim());
                      }
                    }}
                    disabled={!customFormInput.trim()}
                    className="rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomForm(false);
                      setCustomFormInput('');
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Presentation */}
            <div className="relative" ref={presentationDropdownRef}>
              <label className="block font-bold leading-4 text-slate-700 dark:text-slate-300 mb-1">
                Presentation
              </label>

              {/* Backwards-compatible select for form DOM query compatibility */}
              <select
                value={formPresentation}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setIsAddingCustomPresentation(true);
                    setIsPresentationDropdownOpen(false);
                  } else {
                    handleSelectPresentation(val);
                  }
                }}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                <option value="" className="text-slate-400">Choose Presentation</option>
                {allAvailablePresentations.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="custom">Custom Presentation</option>
              </select>

              {/* Searchable Combobox Trigger */}
              <button
                type="button"
                onClick={() => {
                  setIsPresentationDropdownOpen((prev) => !prev);
                  setPresentationSearchQuery('');
                }}
                className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs normal-case flex items-center justify-between focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 cursor-pointer ${
                  !formPresentation
                    ? 'text-slate-400 dark:text-slate-500 font-normal'
                    : 'text-slate-800 dark:text-slate-100 font-normal'
                }`}
              >
                <span className="truncate normal-case">
                  {formPresentation || 'Choose Presentation'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isPresentationDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Searchable Dropdown Menu */}
              {isPresentationDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  {/* Search by typing */}
                  <div className="p-1.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search presentation..."
                        value={presentationSearchQuery}
                        onChange={(e) => setPresentationSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (filteredPresentations.length > 0) {
                              handleSelectPresentation(filteredPresentations[0]);
                            } else if (presentationSearchQuery.trim()) {
                              handleAddCustomPresentation(presentationSearchQuery.trim());
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setIsPresentationDropdownOpen(false);
                          }
                        }}
                        className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Custom Presentation Button (at top) */}
                  <div className="border-b border-slate-100 dark:border-slate-700/60 p-1 bg-slate-50/50 dark:bg-slate-800/40">
                    {presentationSearchQuery.trim() && !allAvailablePresentations.some((p) => p.toLowerCase() === presentationSearchQuery.trim().toLowerCase()) ? (
                      <button
                        type="button"
                        onClick={() => handleAddCustomPresentation(presentationSearchQuery.trim())}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add "{presentationSearchQuery.trim()}" as Presentation</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCustomPresentation(true);
                          setIsPresentationDropdownOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Custom Presentation</span>
                      </button>
                    )}
                  </div>

                  {/* Options list */}
                  <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                    {filteredPresentations.map((p) => {
                      const isSelected = formPresentation === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleSelectPresentation(p)}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{p}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-600" />}
                        </button>
                      );
                    })}

                    {filteredPresentations.length === 0 && (
                      <div className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                        No presentations found
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inline custom presentation input */}
              {isAddingCustomPresentation && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter new presentation (e.g. 30 Tablets)..."
                    value={customPresentationInput}
                    onChange={(e) => setCustomPresentationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customPresentationInput.trim()) {
                          handleAddCustomPresentation(customPresentationInput.trim());
                        }
                      } else if (e.key === 'Escape') {
                        setIsAddingCustomPresentation(false);
                        setCustomPresentationInput('');
                      }
                    }}
                    className="flex-1 rounded-lg border border-teal-500 bg-white px-3 py-1.5 text-xs font-medium focus:outline-hidden dark:border-teal-400 dark:bg-slate-900 dark:text-slate-100 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customPresentationInput.trim()) {
                        handleAddCustomPresentation(customPresentationInput.trim());
                      }
                    }}
                    disabled={!customPresentationInput.trim()}
                    className="rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomPresentation(false);
                      setCustomPresentationInput('');
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Active Ingredients & Agent */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-end mb-1">
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

            <div className="relative" ref={agentDropdownRef}>
              <label className="block font-bold leading-4 text-slate-700 dark:text-slate-300 mb-1">
                Agent / Lebanese Distributor
              </label>

              {/* Backwards-compatible select for form DOM query compatibility */}
              <select
                value={formAgent}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setIsAddingCustomAgent(true);
                    setIsAgentDropdownOpen(false);
                  } else {
                    handleSelectAgent(val);
                  }
                }}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                <option value="" className="text-slate-400">Choose Agent</option>
                {allAvailableAgents.map((agentName) => (
                  <option key={agentName} value={agentName}>{agentName}</option>
                ))}
                <option value="custom">Custom Supplier</option>
              </select>

              {/* Searchable Combobox Trigger */}
              <button
                type="button"
                onClick={() => {
                  setIsAgentDropdownOpen((prev) => !prev);
                  setAgentSearchQuery('');
                }}
                className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs normal-case flex items-center justify-between focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 cursor-pointer ${
                  !formAgent
                    ? 'text-slate-400 dark:text-slate-500 font-normal'
                    : 'text-slate-800 dark:text-slate-100 font-normal'
                }`}
              >
                <span className={`truncate normal-case ${!formAgent ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                  {formAgent || 'Choose Agent'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isAgentDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Searchable Dropdown Menu */}
              {isAgentDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  {/* Search by typing */}
                  <div className="p-1.5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search agent / distributor..."
                        value={agentSearchQuery}
                        onChange={(e) => setAgentSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (filteredAgents.length > 0) {
                              handleSelectAgent(filteredAgents[0]);
                            } else if (agentSearchQuery.trim()) {
                              handleAddCustomAgent(agentSearchQuery.trim());
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setIsAgentDropdownOpen(false);
                          }
                        }}
                        className="w-full pl-7 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {/* Options list */}
                  <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                    {filteredAgents.map((agentName) => {
                      const isSelected = formAgent === agentName;
                      return (
                        <button
                          key={agentName}
                          type="button"
                          onClick={() => handleSelectAgent(agentName)}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span className="truncate">{agentName}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 ml-1" />}
                        </button>
                      );
                    })}

                    {filteredAgents.length === 0 && (
                      <div className="px-2.5 py-2 text-xs text-slate-400 dark:text-slate-500 text-center">
                        No agents / distributors found
                      </div>
                    )}
                  </div>
                </div>
              )}
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
              <div className="space-y-3 pl-6 border-l-2 border-teal-200 dark:border-teal-900 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
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
                          const calcUSD = (Number(formPriceUSD) / val).toFixed(2);
                          setFormPiecePriceUSD(calcUSD);
                          setFormPiecePriceLBP(formatLBPValue(Number(calcUSD) * exchangeRate));
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      required={formIsDivisible}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Piece Name *
                    </label>
                    <input
                      type="text"
                      value={formPieceName}
                      onChange={(e) => setFormPieceName(e.target.value)}
                      placeholder="e.g. tablet, sachet"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      required={formIsDivisible}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Piece Barcode <span className="text-xs font-normal text-slate-400">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formPieceBarcode}
                      onChange={(e) => setFormPieceBarcode(e.target.value)}
                      placeholder="Leave blank if none"
                      className="w-full h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      1 Piece Price (L.L.)
                    </label>
                    <input
                      type="text"
                      value={formPiecePriceLBP}
                      onChange={(e) => {
                        setFormPiecePriceLBP(e.target.value);
                        setIsPiecePriceManual(true);
                        const num = parseFloat(e.target.value.replace(/[^\d.]/g, ''));
                        if (!isNaN(num) && num > 0) {
                          const usdVal = num / exchangeRate;
                          setFormPiecePriceUSD(usdVal.toFixed(2));
                        } else if (!e.target.value.trim()) {
                          setFormPiecePriceUSD('');
                          setIsPiecePriceManual(false);
                        }
                      }}
                      onBlur={() => {
                        const num = parseFloat(formPiecePriceLBP.replace(/[^\d.]/g, ''));
                        if (!isNaN(num) && num > 0) {
                          setFormPiecePriceLBP(formatLBPValue(num));
                        }
                      }}
                      placeholder="e.g. 50,000"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
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
                        const num = parseFloat(e.target.value);
                        if (!isNaN(num) && num > 0) {
                          setFormPiecePriceLBP(formatLBPValue(num * exchangeRate));
                        } else if (!e.target.value.trim()) {
                          setFormPiecePriceLBP('');
                          setIsPiecePriceManual(false);
                        }
                      }}
                      placeholder="e.g. 0.55"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}
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
                      if (formPiecesPerBox && !isPiecePriceManual) {
                        const calcUSD = (usdVal / Number(formPiecesPerBox)).toFixed(2);
                        setFormPiecePriceUSD(calcUSD);
                        setFormPiecePriceLBP(formatLBPValue(Number(calcUSD) * exchangeRate));
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
                      if (formPiecesPerBox && !isPiecePriceManual) {
                        const calcUSD = (num / Number(formPiecesPerBox)).toFixed(2);
                        setFormPiecePriceUSD(calcUSD);
                        setFormPiecePriceLBP(formatLBPValue(Number(calcUSD) * exchangeRate));
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
