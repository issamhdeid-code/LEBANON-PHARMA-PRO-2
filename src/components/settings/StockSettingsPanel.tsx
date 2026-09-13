import React, { useState, useMemo } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Settings, Plus, X, ChevronDown } from 'lucide-react';
import { ProductCategory } from '../../types/pharmacy';
import { getSubcategoryOptions } from '../../constants/subcategories';

const CustomListManager = ({ 
  title, 
  items, 
  builtInItems = [], 
  onAdd, 
  onRemove, 
  placeholder 
}: { 
  title: string, 
  items: string[], 
  builtInItems?: string[], 
  onAdd: (val: string) => void, 
  onRemove: (val: string) => void, 
  placeholder: string 
}) => {
  const [value, setValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredBuiltInItems = useMemo(() => {
    if (!value.trim()) return builtInItems;
    const lowerVal = value.toLowerCase();
    return builtInItems.filter(item => item.toLowerCase().includes(lowerVal));
  }, [builtInItems, value]);

  const filteredItems = useMemo(() => {
    if (!value.trim()) return items;
    const lowerVal = value.toLowerCase();
    return items.filter(item => item.toLowerCase().includes(lowerVal));
  }, [items, value]);

  return (
    <div className="space-y-2 relative">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            onKeyDown={e => {
              if (e.key === 'Enter' && value.trim()) {
                onAdd(value.trim());
                setValue('');
                setIsOpen(false);
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 pr-8"
          />
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          {isOpen && (filteredItems.length > 0 || filteredBuiltInItems.length > 0) && (
            <div 
              onMouseDown={(e) => e.preventDefault()}
              className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
            >
              {filteredBuiltInItems.map(item => (
                <div 
                  key={item} 
                  onMouseDown={() => { setValue(item); setIsOpen(false); }}
                  className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <span>{item} <span className="text-xs opacity-70">(Built-in / Stock)</span></span>
                </div>
              ))}
              {filteredItems.map(item => (
                <div key={item} className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex justify-between items-center cursor-pointer transition-colors">
                  <span onMouseDown={() => { setValue(item); setIsOpen(false); }} className="flex-1">{item}</span>
                  <button 
                    onMouseDown={(e) => { e.stopPropagation(); onRemove(item); }}
                    className="text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    title="Remove item"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => {
            if (value.trim()) {
              onAdd(value.trim());
              setValue('');
            }
          }}
          className="rounded-lg bg-teal-600 p-2 text-white hover:bg-teal-700 shrink-0 transition-colors"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export const StockSettingsPanel: React.FC = () => {
  const { settings, updateSettings, products } = usePharmacy();

  const customCategories = settings.customCategories || [];
  const customGlobalSubcategories = settings.customGlobalSubcategories || [];
  const customForms = settings.customForms || [];
  const customPresentations = settings.customPresentations || [];

  const availableSubcategories = useMemo(() => {
    // Only get the standard/in-stock subcategories, omitting the custom global ones 
    // to avoid duplicating them between the built-in list and the custom list.
    return getSubcategoryOptions('all', products, []).filter(
      sub => !customGlobalSubcategories.includes(sub)
    );
  }, [products, customGlobalSubcategories]);

  const availableForms = useMemo(() => {
    const forms = new Set<string>(['Tablet', 'Syrup', 'Cream']);
    products.forEach(p => {
      if (p.form && p.form.trim()) forms.add(p.form.trim());
      if (p.scientificInfo?.form) forms.add(p.scientificInfo.form.trim());
    });
    return Array.from(forms).filter(f => !customForms.includes(f)).sort((a, b) => a.localeCompare(b));
  }, [products, customForms]);

  const availablePresentations = useMemo(() => {
    const presentations = new Set<string>();
    products.forEach(p => {
      if (p.presentation && p.presentation.trim()) presentations.add(p.presentation.trim());
    });
    return Array.from(presentations).filter(p => !customPresentations.includes(p)).sort((a, b) => a.localeCompare(b));
  }, [products, customPresentations]);

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-200 dark:border-slate-700 pb-4 mb-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300">Stock Alerts Configuration</h3>
            <div className="flex items-center gap-2 mb-2 mt-4">
              <input 
                type="checkbox" 
                id="enableLowStockAlerts"
                checked={settings.enableLowStockAlerts !== false}
                onChange={e => updateSettings({ enableLowStockAlerts: e.target.checked })}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="enableLowStockAlerts" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Enable Low Stock Alerts
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Low Stock Threshold (Pieces/Boxes)
              </label>
              <input
                type="number"
                min="0"
                disabled={settings.enableLowStockAlerts === false}
                value={settings.lowStockThreshold !== undefined ? settings.lowStockThreshold : 5}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  updateSettings({ lowStockThreshold: isNaN(val) ? 0 : val });
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800"
              />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 invisible">Spacing</h3>
            <div className="flex items-center gap-2 mb-2 mt-4">
              <input 
                type="checkbox" 
                id="enableExpiryAlerts"
                checked={settings.enableExpiryAlerts !== false}
                onChange={e => updateSettings({ enableExpiryAlerts: e.target.checked })}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="enableExpiryAlerts" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Enable Expiry Alerts
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                Expiry Warning (Days in advance)
              </label>
              <input
                type="number"
                min="0"
                disabled={settings.enableExpiryAlerts === false}
                value={settings.expiryWarningDays !== undefined ? settings.expiryWarningDays : 30}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  updateSettings({ expiryWarningDays: isNaN(val) ? 0 : val });
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CustomListManager
            title="Custom Categories"
            placeholder="New category..."
            items={customCategories}
            builtInItems={['drug', 'vitamins', 'cosmetics', 'para']}
            onAdd={(val) => {
              if (!customCategories.includes(val)) {
                updateSettings({ customCategories: [...customCategories, val] });
              }
            }}
            onRemove={(val) => {
              updateSettings({ customCategories: customCategories.filter(c => c !== val) });
            }}
          />

          <CustomListManager
            title="Custom Subcategories"
            placeholder="New subcategory..."
            items={customGlobalSubcategories}
            builtInItems={availableSubcategories}
            onAdd={(val) => {
              if (!customGlobalSubcategories.includes(val)) {
                updateSettings({ customGlobalSubcategories: [...customGlobalSubcategories, val] });
              }
            }}
            onRemove={(val) => {
              updateSettings({ customGlobalSubcategories: customGlobalSubcategories.filter(c => c !== val) });
            }}
          />

          <CustomListManager
            title="Drug Forms (e.g. Tablet, Syrup)"
            placeholder="New form..."
            items={customForms}
            builtInItems={availableForms}
            onAdd={(val) => {
              if (!customForms.includes(val)) {
                updateSettings({ customForms: [...customForms, val] });
              }
            }}
            onRemove={(val) => {
              updateSettings({ customForms: customForms.filter(c => c !== val) });
            }}
          />

          <CustomListManager
            title="Presentations (e.g. 24 Film-Coated)"
            placeholder="New presentation..."
            items={customPresentations}
            builtInItems={availablePresentations}
            onAdd={(val) => {
              if (!customPresentations.includes(val)) {
                updateSettings({ customPresentations: [...customPresentations, val] });
              }
            }}
            onRemove={(val) => {
              updateSettings({ customPresentations: customPresentations.filter(c => c !== val) });
            }}
          />
        </div>
    </div>
  );
};
