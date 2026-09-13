const fs = require('fs');

let content = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf8');

const formStartStr = '            className="p-5 space-y-4 text-xs flex-1 flex flex-col justify-start overflow-auto min-h-0"\n          >';
const formStartIdx = content.indexOf(formStartStr);

if (formStartIdx !== -1) {
  const newFields = `
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div ref={supplierDropdownRef} className="relative">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Supplier
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={supplierSearchQuery}
                    onChange={(e) => {
                      setSupplierSearchQuery(e.target.value);
                      setIsSupplierDropdownOpen(true);
                      setSupplierHighlightedIndex(0);
                    }}
                    onFocus={() => setIsSupplierDropdownOpen(true)}
                    onKeyDown={handleSupplierKeyDown}
                    placeholder="Search supplier..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                  
                {isSupplierDropdownOpen && (
                  <div 
                    ref={supplierListContainerRef}
                    className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                  >
                    {filteredSuppliers.map((s, index) => (
                        <div
                          key={s.id}
                          ref={(el) => { supplierItemRefs.current[index] = el; }}
                          className={\`px-3 py-2 cursor-pointer text-sm flex items-center justify-between \${
                            supplierHighlightedIndex === index
                              ? 'bg-teal-50 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 font-semibold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                          } \${selectedSupplierId === s.id && supplierHighlightedIndex !== index ? 'font-semibold text-teal-700 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/20' : ''}\`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedSupplierId(s.id);
                            setSupplierSearchQuery(s.name);
                            setIsSupplierDropdownOpen(false);
                          }}
                        >
                          <span>{s.name}</span>
                          {!s.code.toUpperCase().startsWith('MOPH-') && (
                            <span className="text-[10px] text-slate-400 font-mono">{s.code}</span>
                          )}
                        </div>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <div className="px-3 py-4 text-center text-slate-400 text-xs">No suppliers found</div>
                    )}
                  </div>
                )}
                {/* Fallback to keep the value in DOM */}
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Invoice Date
                </label>
                <input
                  ref={invoiceDateRef}
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      currencyRef.current?.focus();
                    }
                  }}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Currency
                </label>
                <select
                  ref={currencyRef}
                  value={purchaseCurrency}
                  onChange={(e) => {
                    const newCurrency = e.target.value;
                    setPurchaseCurrency(newCurrency);
                    // Update input if a product is selected
                    if (selectedProduct) {
                      const defaultCost = selectedProduct.costPriceUSD != null ? selectedProduct.costPriceUSD : 0;
                      setItemCostUSD(newCurrency === 'USD' ? defaultCost.toString() : Math.round(defaultCost * exchangeRate).toString());
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // Next focus
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="LBP">LBP (ل.ل)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>`;
  
  content = content.substring(0, formStartIdx + formStartStr.length) + newFields + content.substring(formStartIdx + formStartStr.length);
  fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);
  console.log('Successfully added top fields back.');
}
