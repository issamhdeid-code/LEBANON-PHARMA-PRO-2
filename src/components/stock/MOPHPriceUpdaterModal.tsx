import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Globe,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Check,
  X,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Download,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Database,
  RefreshCw,
  PlusCircle,
  Layers,
} from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { DesktopWindow } from '../common/DesktopWindow';
import type { Product } from '../../types/pharmacy';
import {
  fetchMOPHPriceList,
  fetchMOPHLNDDIngredients,
  fetchMOPHNow,
} from '../../services/mophApiService';
import { formatLBPValue } from '../../utils/priceUtils';

interface MOPHPriceUpdaterModalProps {
  onClose: () => void;
  section?: string;
}

type Step = 'locked' | 'checking' | 'start' | 'fetching' | 'preview' | 'applying' | 'done';

interface MatchedItem {
  productId: string;
  productCode: string;
  currentPriceLBP: number;
  currentPriceUSD: number;
  mophPriceLBP: number;
  mophPriceUSD: number;
  mophAgent: string;
  currentAgent: string;
  mophMargin: number | null;
  currentMargin: number;
  name: string;
  strength: string;
  form: string;
  selected: boolean;
}

interface NewImportItem {
  code: string;
  name: string;
  strength: string;
  presentation: string;
  form: string;
  priceLBP: number;
  priceUSD: number;
  agent: string;
  margin: number | null;
  ingredients: string;
  selected: boolean;
}

type PreviewTab = 'matched' | 'import-items';

// LNDD ingredients come from public POSTs (slow); never blast thousands at once.
const MAX_INGREDIENTS_BATCH = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Lock for the "Update from MOPH" feature.
// The password is checked locally in the app — change the value below to set
// your own password (e.g. MOPH_UPDATE_PASSWORD = 'mySecret123';).
// The first successful unlock activates the feature for one year (persisted in
// localStorage). The client's PC clock is NEVER trusted: the current time is
// fetched online via GET /api/moph/now (server reads Date headers from public
// HTTPS hosts) both to verify an existing unlock and to stamp the 1-year window.
// If online time is unreachable the feature fails closed and stays locked.
// ─────────────────────────────────────────────────────────────────────────────
const MOPH_UPDATE_PASSWORD = 'pharma2026';
const MOPH_UNLOCK_STORAGE_KEY = 'moph_unlock_expires_at';
const MOPH_UNLOCK_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

function mophUnlockExpiryDate(): Date | null {
  try {
    const raw = localStorage.getItem(MOPH_UNLOCK_STORAGE_KEY);
    if (!raw) return null;
    const exp = Number(raw);
    if (!Number.isFinite(exp) || exp <= Date.now()) return null;
    return new Date(exp);
  } catch {
    return null;
  }
}

export const MOPHPriceUpdaterModal: React.FC<MOPHPriceUpdaterModalProps> = ({ onClose, section }) => {
  const { products, exchangeRate, updateProduct, importProductsFromCSV } = usePharmacy();

  const [step, setStep] = useState<Step>('checking');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  // Verify the unlock status against online time (never the PC's clock): if a
  // stored future expiry exists the modal opens unlocked; otherwise it locks and
  // the stale key (if any) is cleared. Fails closed when no online time source
  // is reachable.
  const checkUnlock = useCallback(async () => {
    try {
      const now = await fetchMOPHNow();
      if (!now.trusted || !(now.unixMs > 0)) throw new Error('Online time is untrusted');
      const raw = localStorage.getItem(MOPH_UNLOCK_STORAGE_KEY);
      const exp = Number(raw);
      if (raw && Number.isFinite(exp) && exp > now.unixMs) {
        setStep('start');
      } else {
        try { localStorage.removeItem(MOPH_UNLOCK_STORAGE_KEY); } catch { /* ignore */ }
        setStep('locked');
      }
    } catch {
      setUnlockError('Could not verify the current time online. Make sure you are connected to the internet and try again.');
      setStep('locked');
    }
  }, []);

  useEffect(() => {
    void checkUnlock();
  }, [checkUnlock]);

  const [fetchProgress, setFetchProgress] = useState({ count: 0, batch: 0, phase: '' });
  const [fetchError, setFetchError] = useState('');

  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [newImportItems, setNewImportItems] = useState<NewImportItem[]>([]);
  const newImportItemsRef = useRef(newImportItems);
  newImportItemsRef.current = newImportItems;
  const [totalMophMedications, setTotalMophMedications] = useState(0);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('matched');
  const [importSearch, setImportSearch] = useState('');
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [ingredientsPending, setIngredientsPending] = useState<Set<string>>(new Set());

  const [applyResult, setApplyResult] = useState<{ updated: number; skipped: number } | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[]; skippedLowerPricesCount?: number } | null>(null);
  const [applyPriceDecreases, setApplyPriceDecreases] = useState(false);

  const productCodeMap = useMemo(() => {
    const map = new Map<string, { id: string; code: string; priceLBP: number; priceUSD: number }>();
    products.forEach(p => {
      if (p.code) map.set(p.code.toUpperCase(), { id: p.id, code: p.code, priceLBP: p.priceLBP, priceUSD: p.priceUSD });
    });
    return map;
  }, [products]);

  const unlockExpiry = useMemo(() => mophUnlockExpiryDate(), [step]);

  const handleUnlock = useCallback(async () => {
    if (unlockPassword !== MOPH_UPDATE_PASSWORD) {
      setUnlockError('Incorrect password. Please try again.');
      return;
    }

    setUnlockError('');
    try {
      // Stamp the 1-year window from trusted online time, not the PC's clock.
      const now = await fetchMOPHNow();
      if (!now.trusted || !(now.unixMs > 0)) throw new Error('Online time is untrusted');
      try {
        localStorage.setItem(MOPH_UNLOCK_STORAGE_KEY, String(now.unixMs + MOPH_UNLOCK_DURATION_MS));
      } catch { /* ignore */ }
      setUnlockPassword('');
      setStep('start');
    } catch {
      setUnlockError('Could not verify the current time online. Make sure you are connected to the internet and try again.');
    }
  }, [unlockPassword]);

  const handleFetch = useCallback(async () => {
    setFetchError('');
    setStep('fetching');
    setFetchProgress({ count: 0, batch: 0, phase: 'Fetching official price list & margins from MOPH...' });

    try {
      const priceList = await fetchMOPHPriceList();

      setTotalMophMedications(priceList.length);
      setFetchProgress({ count: priceList.length, batch: 0, phase: 'Matching with your stock items...' });

      const items: MatchedItem[] = [];
      const imports: NewImportItem[] = [];

      for (const r of priceList) {
        if (r.code == null) continue;
        const key = String(r.code).toUpperCase();
        const prod = productCodeMap.get(key);

        if (prod) {
          const mophPriceLBP = r.publicPriceLBP || 0;
          const mophPriceUSD = mophPriceLBP > 0 ? Number((mophPriceLBP / exchangeRate).toFixed(2)) : 0;
          items.push({
            productId: prod.id,
            productCode: prod.code,
            currentPriceLBP: prod.priceLBP,
            currentPriceUSD: prod.priceUSD,
            mophPriceLBP,
            mophPriceUSD,
            mophAgent: r.agent || '',
            currentAgent: products.find(p => p.id === prod.id)?.agent || '',
            mophMargin: r.pharmacistMargin ?? null,
            currentMargin: products.find(p => p.id === prod.id)?.pharmacistMarginProfit ?? 0,
            name: r.brandName || '',
            strength: r.strength || '',
            form: r.form || '',
            selected: (mophPriceLBP > 0 && mophPriceLBP !== prod.priceLBP),
          });
        } else {
          const priceLBP = r.publicPriceLBP || 0;
          imports.push({
            code: String(r.code),
            name: r.brandName || '',
            strength: r.strength || '',
            presentation: r.presentation || '',
            form: r.form || '',
            priceLBP,
            priceUSD: priceLBP > 0 ? Number((priceLBP / exchangeRate).toFixed(2)) : 0,
            agent: r.agent || '',
            margin: r.pharmacistMargin,
            ingredients: '',
            selected: false,
          });
        }
      }

      setMatchedItems(items);
      setNewImportItems(imports);
      setStep('preview');
    } catch (err: any) {
      setFetchError(err?.message || 'An unexpected error occurred');
      setStep('start');
    }
  }, [productCodeMap, exchangeRate, products]);

  const handleToggleAll = (selected: boolean) => {
    setMatchedItems(prev => prev.map(item => ({ ...item, selected })));
  };

  const handleToggleItem = (index: number) => {
    setMatchedItems(prev => prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item));
  };

  const handleToggleImportItem = (index: number) => {
    setNewImportItems(prev => prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item));
  };

  const handleToggleAllImports = (selected: boolean) => {
    setNewImportItems(prev => prev.map(item => ({ ...item, selected })));
  };

  // Resolve ingredients for the currently visible/filtered import items from the LNDD database.
  // Only a small batch is fetched per call (public-site POSTs are slow); unresolved
  // items show "—" and are filled in during import.
  const fetchVisibleIngredients = useCallback(async () => {
    if (ingredientsLoading) return;
    const query = importSearch.trim().toLowerCase();
    const items = newImportItemsRef.current;
    const visible = items.filter(it =>
      !query ||
      it.name.toLowerCase().includes(query) ||
      it.code.toLowerCase().includes(query) ||
      it.agent.toLowerCase().includes(query)
    );
    const missing = visible
      .filter(it => !it.ingredients)
      .slice(0, MAX_INGREDIENTS_BATCH);
    if (missing.length === 0) return;

    setIngredientsLoading(true);
    const batchCodes = new Set(missing.map(it => it.code));
    setIngredientsPending(prev => {
      const next = new Set(prev);
      missing.forEach(it => next.add(it.code));
      return next;
    });
    try {
      const results = await fetchMOPHLNDDIngredients(
        missing.map(it => ({ name: it.name, dosage: it.strength, form: it.form }))
      );
      const byKey = new Map(results.map(r => [`${r.name.trim().toUpperCase()}|${r.dosage.trim().toUpperCase()}|${r.form.trim().toUpperCase()}`, r.ingredients]));
      setNewImportItems(prev => prev.map(it => {
        const key = `${it.name.trim().toUpperCase()}|${it.strength.trim().toUpperCase()}|${it.form.trim().toUpperCase()}`;
        const ingredients = byKey.get(key);
        if (ingredients === undefined || ingredients === '') return it;
        return { ...it, ingredients };
      }));
    } catch (e: any) {
      console.warn('Ingredient lookup failed:', e?.message || e);
    } finally {
      setIngredientsLoading(false);
      setIngredientsPending(prev => {
        const next = new Set(prev);
        batchCodes.forEach(c => next.delete(c));
        return next;
      });
    }
  }, [importSearch, ingredientsLoading]);

  // Trigger ingredient enrichment when the user opens the import tab or changes the
  // search query. One batch per change — no endless chaining over thousands of rows.
  useEffect(() => {
    if (step === 'preview' && previewTab === 'import-items') {
      const t = setTimeout(fetchVisibleIngredients, 350);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, previewTab, importSearch]);

  // Progressive background fill: while the import tab is open, keep refilling the
  // next unresolved batch every few seconds until the whole visible list has ingredients.
  useEffect(() => {
    if (step !== 'preview' || previewTab !== 'import-items') return;
    const id = setInterval(() => { fetchVisibleIngredients(); }, 2500);
    return () => clearInterval(id);
  }, [step, previewTab, fetchVisibleIngredients]);

  const handleApplyUpdates = useCallback(async () => {
    const toUpdate = matchedItems.filter(item => item.selected);
    if (toUpdate.length === 0) return;

    setStep('applying');
    setFetchProgress({ count: 0, batch: 0, phase: `Updating ${toUpdate.length} items...` });

    let updated = 0;
    let skipped = 0;

    for (const item of toUpdate) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) { skipped++; setFetchProgress(prev => ({ ...prev, count: updated + skipped, phase: `Processed ${updated + skipped} of ${toUpdate.length}...` })); continue; }

      const updates: Partial<Product> = {};
      let changed = false;

      // Price change (decreases are skipped unless the user opted in)
      if (item.mophPriceLBP > 0 && item.mophPriceLBP !== item.currentPriceLBP) {
        const isDecrease = item.currentPriceLBP > 0 && item.mophPriceLBP < item.currentPriceLBP;
        if (!isDecrease || applyPriceDecreases) {
          updates.priceLBP = item.mophPriceLBP;
          updates.priceUSD = item.mophPriceUSD;
          changed = true;
        }
      }

      // Supplier (agent) change
      if (item.mophAgent && item.mophAgent.toLowerCase() !== (prod.agent || '').toLowerCase()) {
        updates.agent = item.mophAgent;
        changed = true;
      }

      // Pharmacist margin change
      if (item.mophMargin != null && Math.abs(item.mophMargin - item.currentMargin) > 0.005) {
        updates.pharmacistMarginProfit = item.mophMargin;
        const priceUSD = (updates.priceUSD ?? prod.priceUSD) || 0;
        updates.costPriceUSD = priceUSD > 0 ? Number((priceUSD * (1 - item.mophMargin / 100)).toFixed(2)) : prod.costPriceUSD;
        changed = true;
      }

      if (changed && Object.keys(updates).length > 0) {
        updateProduct(item.productId, updates);
        updated++;
      } else {
        skipped++;
      }

      setFetchProgress(prev => ({ ...prev, count: updated + skipped, phase: `Processed ${updated + skipped} of ${toUpdate.length}...` }));
      await new Promise(r => setTimeout(r, 10));
    }

    setApplyResult({ updated, skipped });
    setStep('done');
  }, [matchedItems, products, updateProduct, applyPriceDecreases]);

  const handleImportSelected = useCallback(async () => {
    const toImport = newImportItems.filter(item => item.selected);
    if (toImport.length === 0) return;

    setStep('applying');
    setFetchProgress({ count: 0, batch: 0, phase: `Importing ${toImport.length} new drugs...` });

    // Ensure ingredients are known (reuse the same LNDD lookup, chunked since the
    // server resolves a small batch per request)
    const unresolved = toImport.filter(it => !it.ingredients);
    let ingredientsByKey = new Map<string, string>();
    if (unresolved.length > 0) {
      setFetchProgress({ count: 0, batch: 0, phase: 'Fetching ingredients from MOPH database...' });
      try {
        for (let i = 0; i < unresolved.length; i += MAX_INGREDIENTS_BATCH) {
          const chunk = unresolved.slice(i, i + MAX_INGREDIENTS_BATCH);
          const chunkResults = await fetchMOPHLNDDIngredients(
            chunk.map(it => ({ name: it.name, dosage: it.strength, form: it.form }))
          );
          chunkResults.forEach(r => {
            ingredientsByKey.set(
              `${r.name.trim().toUpperCase()}|${r.dosage.trim().toUpperCase()}|${r.form.trim().toUpperCase()}`,
              r.ingredients
            );
          });
        }
      } catch (e) {
        console.warn('Ingredient lookup failed during import:', e);
      }
    }

    setFetchProgress({ count: 0, batch: 0, phase: `Creating ${toImport.length} drugs in stock...` });

    const csvLines = ['code, Name, Ingredients, Dosage, Presentation, Form, Price in LBP, Agent, Pharmacist Margin'];
    const escapeCsv = (v: string) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    for (const item of toImport) {
      const key = `${item.name.trim().toUpperCase()}|${item.strength.trim().toUpperCase()}|${item.form.trim().toUpperCase()}`;
      const ingredients = item.ingredients || ingredientsByKey.get(key) || '';
      const margin = item.margin != null ? item.margin : 0;
      csvLines.push([
        item.code,
        item.name,
        ingredients,
        item.strength,
        item.presentation,
        item.form,
        item.priceLBP,
        item.agent,
        margin,
      ].map(escapeCsv).join(','));
    }

    const res = importProductsFromCSV(csvLines.join('\n'));

    // Sync checkbox state upward so the import tab reflects what was created
    const importedCodes = new Set(toImport.map(it => it.code.toUpperCase()));
    setNewImportItems(prev => prev.filter(it => !importedCodes.has(it.code.toUpperCase())));
    setImportResult({ imported: res.importedCount, errors: res.errors, skippedLowerPricesCount: res.skippedLowerPricesCount });
    setStep('done');
  }, [newImportItems, importProductsFromCSV]);

  const itemsWithChange = useMemo(() =>
    matchedItems.filter(item => {
      const priceChanged = item.mophPriceLBP > 0 && item.mophPriceLBP !== item.currentPriceLBP;
      const agentChanged = Boolean(item.mophAgent && item.mophAgent.toLowerCase() !== item.currentAgent.toLowerCase());
      const marginChanged = item.mophMargin != null && Math.abs(item.mophMargin - item.currentMargin) > 0.005;
      return priceChanged || agentChanged || marginChanged;
    }),
    [matchedItems]
  );

  const selectedCount = useMemo(() =>
    matchedItems.filter(item => item.selected).length,
    [matchedItems]
  );

  const filteredImportItems = useMemo(() => {
    const query = importSearch.trim().toLowerCase();
    return query
      ? newImportItems.filter(it =>
          it.name.toLowerCase().includes(query) ||
          it.code.toLowerCase().includes(query) ||
          it.agent.toLowerCase().includes(query)
        )
      : newImportItems;
  }, [newImportItems, importSearch]);

  const selectableImportCount = useMemo(() => filteredImportItems.length, [filteredImportItems]);
  const selectedImportCount = useMemo(() => newImportItems.filter(it => it.selected).length, [newImportItems]);
  const resolvedIngredientCount = useMemo(() => newImportItems.filter(it => it.ingredients).length, [newImportItems]);

  return (
    <DesktopWindow
      title="Update Prices from MOPH"
      isOpen={true}
      onClose={onClose}
      width="900px"
      height="80vh"
      section={section}
    >
      <div className="flex flex-col h-full text-xs">
        {/* Step Indicator (hidden while checking/locked) */}
        {step !== 'locked' && step !== 'checking' && (
          <div className="flex items-center justify-center gap-2 px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
          {(['start', 'fetching', 'preview', 'done'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <div className="w-8 h-px bg-slate-300 dark:bg-slate-700" />}
              <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                step === s ? 'text-teal-600 dark:text-teal-400' :
                (['start', 'fetching', 'preview', 'done'].indexOf(step) > i) ? 'text-emerald-600 dark:text-emerald-400' :
                'text-slate-400 dark:text-slate-600'
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === s ? 'bg-teal-600 text-white' :
                  (['start', 'fetching', 'preview', 'done'].indexOf(step) > i) ? 'bg-emerald-600 text-white' :
                  'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}>
                  {(['start', 'fetching', 'preview', 'done'].indexOf(step) > i) ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s === 'start' ? 'Fetch' : s === 'fetching' ? 'Fetching' : s === 'preview' ? 'Review' : 'Done'}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">

          {/* STEP: Checking */}
          {step === 'checking' && (
            <div className="max-w-md mx-auto space-y-6">
              <div className="text-center">
                <div className="p-3 bg-teal-100 dark:bg-teal-900/40 rounded-xl w-fit mx-auto mb-3">
                  <Loader2 className="h-8 w-8 text-teal-600 dark:text-teal-400 animate-spin" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Checking your MOPH unlock status
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Verifying the current time online...
                </p>
              </div>
            </div>
          )}

          {/* STEP: Locked */}
          {step === 'locked' && (
            <form
              className="max-w-md mx-auto space-y-4"
              onSubmit={(e) => { e.preventDefault(); handleUnlock(); }}
            >
              <div className="text-center mb-6">
                <div className="p-3 bg-slate-100 dark:bg-slate-800/70 rounded-xl w-fit mx-auto mb-3">
                  <Lock className="h-8 w-8 text-slate-500 dark:text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Update from MOPH is locked
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Enter the password to unlock the MOPH price list updater. After the first successful
                  unlock the feature stays available for 1 year without asking for the password again;
                  then it locks back.
                </p>
              </div>

              {unlockError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{unlockError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showUnlockPassword ? 'text' : 'password'}
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    placeholder="Enter password"
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showUnlockPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700"
                >
                  <Unlock className="h-4 w-4" />
                  <span>Unlock</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP: Start */}
          {step === 'start' && (
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-center mb-6">
                <div className="p-3 bg-teal-100 dark:bg-teal-900/40 rounded-xl w-fit mx-auto mb-3">
                  <Globe className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Update from the official MOPH price list
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Fetches the latest official drugs public price list (public prices, pharmacist margins and
                  agents) from moph.gov.lb, then matches your stock to review and apply price updates or
                  import new marketed drugs. No credentials required.
                </p>
                {unlockExpiry && (
                  <div className="mt-2 inline-block rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Unlocked — password won't be asked again until {unlockExpiry.toLocaleDateString()}
                  </div>
                )}
              </div>

              {fetchError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{fetchError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFetch}
                  className="flex items-center space-x-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700"
                >
                  <Download className="h-4 w-4" />
                  <span>Connect & Fetch Price List</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP: Fetching */}
          {step === 'fetching' && (
            <div className="max-w-md mx-auto space-y-6">
              <div className="text-center">
                <div className="p-3 bg-teal-100 dark:bg-teal-900/40 rounded-xl w-fit mx-auto mb-3">
                  <Loader2 className="h-8 w-8 text-teal-600 dark:text-teal-400 animate-spin" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Fetching MOPH Data
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {fetchProgress.phase}
                </p>
              </div>

              <div className="bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div className="bg-teal-500 h-full rounded-full transition-all duration-300 animate-pulse" style={{ width: fetchProgress.count > 0 ? '100%' : '30%' }} />
              </div>

              <div className="text-center text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <div>{fetchProgress.count.toLocaleString()} medications fetched</div>
                <div>{productCodeMap.size} items in your stock</div>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* STEP: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setPreviewTab('matched')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    previewTab === 'matched'
                      ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Update Stock ({matchedItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('import-items')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    previewTab === 'import-items'
                      ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Import New Drugs ({newImportItems.length})
                </button>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {totalMophMedications.toLocaleString()} official price-list entries | {matchedItems.length} in your stock | {itemsWithChange.length} with changes | {newImportItems.length} market drugs not in stock
              </div>

              {/* TAB: Matched (update existing) */}
              {previewTab === 'matched' ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Price Comparison
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Review price, supplier and pharmacist margin changes. Checkboxes default to any detected change.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAll(true)}
                        className="text-[11px] text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold"
                      >
                        Select All Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAll(false)}
                        className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 font-semibold"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {matchedItems.length === 0 ? (
                    <div className="text-center py-12">
                      <Database className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                        No matching items found
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        None of your stock item codes match MOPH medication codes. Check that your stock codes use the official MOPH format.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <div className="max-h-[42vh] overflow-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                            <tr>
                              <th className="px-3 py-2 w-8">
                                <input
                                  type="checkbox"
                                  checked={selectedCount === matchedItems.length && matchedItems.length > 0}
                                  onChange={(e) => handleToggleAll(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                                />
                              </th>
                              <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">CODE</th>
                              <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">NAME</th>
                              <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 text-right">SUPPLIER</th>
                              <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 text-right">MARGIN %</th>
                              <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 text-right">CURRENT (LBP)</th>
                              <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 text-right">MOPH (LBP)</th>
                              <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 text-right">CHANGE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {matchedItems.map((item, idx) => {
                              const hasPriceChange = item.mophPriceLBP > 0 && item.mophPriceLBP !== item.currentPriceLBP;
                              const isDecrease = item.mophPriceLBP > 0 && item.currentPriceLBP > 0 && item.mophPriceLBP < item.currentPriceLBP;
                              const isIncrease = item.mophPriceLBP > 0 && item.currentPriceLBP > 0 && item.mophPriceLBP > item.currentPriceLBP;
                              const agentChanged = Boolean(item.mophAgent && item.mophAgent.toLowerCase() !== item.currentAgent.toLowerCase());
                              const marginChanged = item.mophMargin != null && Math.abs(item.mophMargin - item.currentMargin) > 0.005;
                              const pctChange = item.currentPriceLBP > 0 && item.mophPriceLBP > 0
                                ? (((item.mophPriceLBP - item.currentPriceLBP) / item.currentPriceLBP) * 100).toFixed(1)
                                : null;

                              return (
                                <tr
                                  key={item.productCode}
                                  className={`transition-colors ${
                                    item.selected ? 'bg-teal-50/50 dark:bg-teal-950/20' : 'bg-white dark:bg-slate-900'
                                  } ${hasPriceChange && isDecrease ? 'opacity-60' : ''}`}
                                >
                                  <td className="px-3 py-2">
                                    <input
                                      type="checkbox"
                                      checked={item.selected}
                                      onChange={() => handleToggleItem(idx)}
                                      className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                                    {item.productCode}
                                  </td>
                                  <td className="px-3 py-2 text-slate-800 dark:text-slate-200 font-semibold max-w-[180px] truncate">
                                    {item.name}
                                    <div className="text-[10px] font-normal text-slate-400">
                                      {item.strength} | {item.form}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right max-w-[140px] truncate">
                                    <div className="text-[10px] text-slate-400 truncate">{(item.currentAgent || '—')}</div>
                                    {agentChanged && (
                                      <div className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 truncate">
                                        → {item.mophAgent}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                                      {item.currentMargin.toFixed(2)}%
                                    </div>
                                    {marginChanged && item.mophMargin != null && (
                                      <div className="text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                                        → {item.mophMargin.toFixed(2)}%
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">
                                    {formatLBPValue(item.currentPriceLBP)}
                                  </td>
                                  <td className={`px-3 py-2 text-right font-bold ${
                                    isIncrease ? 'text-emerald-600 dark:text-emerald-400' :
                                    isDecrease ? 'text-amber-600 dark:text-amber-400' :
                                    'text-slate-700 dark:text-slate-300'
                                  }`}>
                                    {item.mophPriceLBP > 0 ? formatLBPValue(item.mophPriceLBP) : (
                                      <span className="text-slate-400 font-normal">N/A</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {pctChange !== null ? (
                                      <span className={`text-[11px] font-semibold ${
                                        isIncrease ? 'text-emerald-600 dark:text-emerald-400' :
                                        isDecrease ? 'text-amber-600 dark:text-amber-400' :
                                        'text-slate-400'
                                      }`}>
                                        {isIncrease ? '+' : ''}{pctChange}%
                                        {isDecrease && !applyPriceDecreases && (
                                          <span className="text-[10px] ml-1 text-slate-400" title="Decrease skipped to preserve current price">
                                            (skip)
                                          </span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Summary & Actions */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCount}</span> items selected for update
                      {!applyPriceDecreases && matchedItems.filter(i => i.selected && i.mophPriceLBP > 0 && i.currentPriceLBP > 0 && i.mophPriceLBP < i.currentPriceLBP).length > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 ml-2">
                          (price decreases will be skipped to preserve selling price)
                        </span>
                      )}
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={applyPriceDecreases}
                        onChange={(e) => setApplyPriceDecreases(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                      />
                      Apply MOPH price even when lower
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleFetch}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <RefreshCw className="h-3.5 w-3.5 inline mr-1" />
                        Re-fetch
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyUpdates}
                        disabled={selectedCount === 0}
                        className="flex items-center space-x-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" />
                        <span>Apply {selectedCount} Update{selectedCount !== 1 ? 's' : ''}</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* TAB: Import new drugs (codes not in stock) */
                <>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Import New Drugs
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {newImportItems.length} marketed MOPH drugs (official price list) not in your stock. New drugs are added with 0 quantity, blank expiry and no barcode (category "drug").
                        {ingredientsLoading ? (
                          <span className="text-teal-600 dark:text-teal-400 block mt-0.5">
                            Fetching ingredients ({resolvedIngredientCount}/{newImportItems.length})...
                          </span>
                        ) : (
                          <span className="text-slate-400 block mt-0.5">
                            Ingredients: {resolvedIngredientCount} resolved (auto-filled in the background while this tab is open).
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAllImports(true)}
                        className="text-[11px] text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAllImports(false)}
                        className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 font-semibold"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={importSearch}
                      onChange={(e) => setImportSearch(e.target.value)}
                      placeholder={`Search ${newImportItems.length.toLocaleString()} drugs by name, code or agent...`}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs focus:border-teal-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="max-h-[42vh] overflow-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-2 w-8">
                              <input
                                type="checkbox"
                                checked={selectableImportCount > 0 && filteredImportItems.every(it => it.selected)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const filterKeys = new Set(filteredImportItems.map(it => it.code.toUpperCase()));
                                  setNewImportItems(prev => prev.map(it =>
                                    filterKeys.has(it.code.toUpperCase()) ? { ...it, selected: checked } : it
                                  ));
                                }}
                                className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                              />
                            </th>
                            <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">CODE</th>
                            <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">NAME</th>
                            <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">INGREDIENTS</th>
                            <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">DOSAGE</th>
                            <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">PRESENTATION</th>
                            <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">FORM</th>
                            <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 text-right">PRICE (LBP)</th>
                            <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">AGENT</th>
                            <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 text-right">MARGIN %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredImportItems.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="px-3 py-8 text-center text-slate-400 text-[11px]">
                                {importSearch.trim() ? 'No drugs match your search.' : 'All medications in the MOPH catalog are already in your stock.'}
                              </td>
                            </tr>
                          ) : filteredImportItems.map((item, idx) => (
                            <tr
                              key={item.code}
                              className={`transition-colors ${
                                item.selected ? 'bg-teal-50/50 dark:bg-teal-950/20' : 'bg-white dark:bg-slate-900'
                              }`}
                            >
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={item.selected}
                                  onChange={() => handleToggleImportItem(idx)}
                                  className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                                {item.code}
                              </td>
                              <td className="px-3 py-2 text-slate-800 dark:text-slate-200 font-semibold max-w-[180px] truncate">
                                {item.name}
                              </td>
                              <td className="px-3 py-2 text-slate-500 dark:text-slate-400 max-w-[180px] truncate text-[11px]">
                                {item.ingredients ? (
                                  item.ingredients
                                ) : ingredientsPending.has(item.code) ? (
                                  <span className="flex items-center gap-1 text-teal-500">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    fetching
                                  </span>
                                ) : (
                                  <span className="text-slate-400" title="Ingredients are filled automatically when this drug is imported.">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300 text-[11px]">{item.strength}</td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300 text-[11px] max-w-[120px] truncate">{item.presentation}</td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300 text-[11px]">{item.form}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300">
                                {item.priceLBP > 0 ? formatLBPValue(item.priceLBP) : <span className="text-slate-400 font-normal">N/A</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-500 dark:text-slate-400 max-w-[140px] truncate text-[11px]">{item.agent || '—'}</td>
                              <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300 text-[11px]">
                                {item.margin != null ? `${item.margin.toFixed(2)}%` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary & Actions */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between">
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedImportCount}</span> drugs selected to import
                      <span className="text-slate-400 ml-2">New items: 0 qty, blank expiry, no barcode.</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleFetch}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <RefreshCw className="h-3.5 w-3.5 inline mr-1" />
                        Re-fetch
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleImportSelected}
                        disabled={selectedImportCount === 0}
                        className="flex items-center space-x-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 disabled:opacity-40"
                      >
                        <Layers className="h-4 w-4" />
                        <span>Import {selectedImportCount} Drug{selectedImportCount !== 1 ? 's' : ''}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP: Applying */}
          {step === 'applying' && (
            <div className="max-w-md mx-auto space-y-6">
              <div className="text-center">
                <div className="p-3 bg-teal-100 dark:bg-teal-900/40 rounded-xl w-fit mx-auto mb-3">
                  <Loader2 className="h-8 w-8 text-teal-600 dark:text-teal-400 animate-spin" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Applying Updates
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {fetchProgress.phase}
                </p>
              </div>
            </div>
          )}

          {/* STEP: Done */}
          {step === 'done' && (
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-center">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl w-fit mx-auto mb-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  MOPH Update Complete
                </h3>
              </div>

              {applyResult && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-bold">{applyResult.updated} prices updated successfully</span>
                  </div>
                  {applyResult.skipped > 0 && (
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-semibold">{applyResult.skipped} items skipped (no change or price decrease)</span>
                    </div>
                  )}
                </div>
              )}

              {importResult && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-bold">{importResult.imported} new drugs imported successfully</span>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-semibold">{importResult.errors.length} errors</span>
                    </div>
                  )}
                </div>
              )}

              <div className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                Changes are reflected immediately across all connected PCs and affect sale totals.
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-emerald-600 px-6 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DesktopWindow>
  );
};
