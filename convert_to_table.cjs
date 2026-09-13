const fs = require('fs');

let content = fs.readFileSync('/tmp/PurchaseView.tsx', 'utf8');

const startIndex = content.indexOf('<div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-[repeat(17,minmax(0,1fr))] gap-2 items-end min-w-[900px]">');
const endIndex = content.indexOf('{/* Selected Product Info & Lot Details */}');

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find start or end index.");
  process.exit(1);
}

let originalBlock = content.substring(startIndex, endIndex);

// We want to replace the `originalBlock` with a table structure.
// Instead of complex parsing, let's manually write the new table block.

let newTableBlock = `
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[20%]">Product</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Unit</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Expiry</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Batch</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Qty</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Free</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Profit %</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">VAT</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Pub Price</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Disc %</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cost</th>
                      <th className="pb-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wide text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-1 align-top relative z-50">
                        <div ref={searchDropdownRef}>
                          {/* Primary searchable input with live matching by Name, Drug Code, or Barcode */}
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                              <Search className="h-3.5 w-3.5" />
                            </div>
                            <input
                              ref={searchInputRef}
                              type="text"
                              value={productSearchQuery}
                              onChange={(e) => {
                                const val = e.target.value;
                                setProductSearchQuery(val);
                                if (val.trim().length > 0) {
                                  setIsSearchDropdownOpen(true);
                                  setHighlightedIndex(0);
                                } else {
                                  setIsSearchDropdownOpen(false);
                                }
                              }}
                              onFocus={() => {
                                if (productSearchQuery.trim().length > 0) {
                                  setIsSearchDropdownOpen(true);
                                }
                              }}
                              onKeyDown={handleSearchKeyDown}
                              placeholder="Type name, code, barcode, or scan box..."
                              className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-16 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                            <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center gap-1">
                              {productSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProductSearchQuery('');
                                    setCurrentProductId('');
                                    setIsSearchDropdownOpen(false);
                                    searchInputRef.current?.focus();
                                  }}
                                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                  title="Clear search"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setProductSearchQuery('');
                                  setCurrentProductId('');
                                  setIsSearchDropdownOpen(false);
                                  setScanStatusMessage(null);
                                  setShowScanner(true);
                                }}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                title="Scan Barcode"
                              >
                                <ScanLine className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {isSearchDropdownOpen && productSearchQuery.trim().length > 0 && (
                            <div 
                              ref={listContainerRef}
                              className="absolute z-50 w-[500px] mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto"
                            >
                              {filteredProducts.length === 0 ? (
                                <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-xs">
                                  No products found matching "{productSearchQuery}".
                                </div>
                              ) : (
                                <div className="py-1">
                                  {filteredProducts.map((p, index) => {
                                    const inStockBoxes = p.unitsInStock;
                                    const inStockPieces = p.piecesInStock || 0;
                                    
                                    return (
                                      <div
                                        key={p.id}
                                        ref={(el) => { itemRefs.current[index] = el; }}
                                        className={\`px-4 py-2 cursor-pointer flex flex-col gap-1 \${
                                          highlightedIndex === index
                                            ? 'bg-teal-50 dark:bg-teal-900/30'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                        }\`}
                                        onClick={() => handleProductSelect(p)}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                      >
                                        <div className="flex items-start justify-between gap-4">
                                          <div className="flex flex-col flex-1 min-w-0">
                                            <span className={\`text-sm truncate \${highlightedIndex === index ? 'text-teal-900 dark:text-teal-100 font-bold' : 'text-slate-900 dark:text-slate-100 font-semibold'}\`}>
                                              {p.name}
                                            </span>
                                            {(p.dosage || p.presentation || p.form) && (
                                              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                {[p.dosage, p.presentation, p.form].filter(Boolean).join(' ')}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex flex-col items-end shrink-0">
                                            {p.barcode && (
                                              <span className="text-[9px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1 rounded">
                                                {p.barcode}
                                              </span>
                                            )}
                                            <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                                              Stock: {inStockBoxes}b {inStockPieces > 0 ? \`\${inStockPieces}p\` : ''}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      <td className="p-1 align-top">
                        <select
                          ref={unitInputRef}
                          value={itemUnit}
                          onChange={(e) => {
                            setItemUnit(e.target.value as 'box' | 'piece');
                            expiryInputRef.current?.focus();
                          }}
                          disabled={!selectedProduct?.isDivisible}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900"
                        >
                          <option value="box">Box</option>
                          {selectedProduct?.isDivisible && (
                            <option value="piece">{selectedProduct.pieceName || 'Piece'}</option>
                          )}
                        </select>
                      </td>

                      <td className="p-1 align-top">
                        <input
                          ref={expiryInputRef}
                          id="purchase-item-expiry"
                          type="text"
                          value={displayExpiry}
                          onChange={handleExpiryChange}
                          onFocus={(e) => e.target.select()}
                          onBlur={handleExpiryBlur}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleExpiryBlur();
                              batchInputRef.current?.focus();
                              batchInputRef.current?.select();
                            }
                          }}
                          placeholder="DD/MM/YYYY"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono text-center"
                        />
                      </td>

                      <td className="p-1 align-top">
                        <input
                          ref={batchInputRef}
                          id="purchase-item-batch"
                          type="text"
                          value={itemBatch}
                          onChange={(e) => setItemBatch(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              qtyInputRef.current?.focus();
                              qtyInputRef.current?.select();
                            }
                          }}
                          placeholder="Batch"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                        />
                      </td>

                      <td className="p-1 align-top">
                        <input
                          ref={qtyInputRef}
                          id="purchase-item-qty"
                          type="number"
                          value={itemQty}
                          onChange={(e) => setItemQty(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              freeInputRef.current?.focus();
                            }
                          }}
                          placeholder="Qty"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </td>

                      <td className="p-1 align-top">
                        <input
                          ref={freeInputRef}
                          id="purchase-item-free"
                          type="number"
                          value={itemFree}
                          onChange={(e) => setItemFree(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              profitPercentInputRef.current?.focus();
                              profitPercentInputRef.current?.select();
                            }
                          }}
                          placeholder="Free"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </td>

                      <td className="p-1 align-top">
                        <input
                          ref={profitPercentInputRef}
                          type="text"
                          value={itemProfitPercent}
                          onChange={(e) => setItemProfitPercent(e.target.value.replace(/,/g, '').split('.')[0])}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              vatInputRef.current?.focus();
                            }
                          }}
                          placeholder="Profit %"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </td>

                      <td className="p-1 align-top">
                        <div className="relative">
                          <select
                            ref={vatInputRef}
                            value={itemVATChoice}
                            onChange={(e) => setItemVATChoice(e.target.value as 'setting' | 'none')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                publicPriceInputRef.current?.focus();
                                publicPriceInputRef.current?.select();
                              }
                            }}
                            className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                          >
                            <option value="setting">
                              {selectedProduct && (settings.vatRates?.[selectedProduct.category] || 0) > 0
                                ? \`\${settings.vatRates?.[selectedProduct.category]}%\`
                                : '0 VAT'}
                            </option>
                            <option value="none">0 VAT</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      </td>

                      <td className="p-1 align-top">
                        <input
                          ref={publicPriceInputRef}
                          type="text"
                          value={formatWithCommas(itemPublicPrice.split('.')[0])}
                          onChange={(e) => setItemPublicPrice(e.target.value.replace(/,/g, '').split('.')[0])}
                          onFocus={(e) => {
                            setIsPublicPriceFocused(true);
                            e.target.select();
                          }}
                          onBlur={() => setIsPublicPriceFocused(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              discountInputRef.current?.focus();
                              discountInputRef.current?.select();
                            }
                          }}
                          placeholder="Pub Price"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </td>

                      <td className="p-1 align-top">
                        <input
                          ref={discountInputRef}
                          type="text"
                          value={formatWithCommas(itemDiscount.split('.')[0])}
                          onChange={(e) => setItemDiscount(e.target.value.replace(/,/g, '').split('.')[0])}
                          onFocus={(e) => {
                            setIsDiscountFocused(true);
                            e.target.select();
                          }}
                          onBlur={() => setIsDiscountFocused(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              costInputRef.current?.focus();
                              costInputRef.current?.select();
                            }
                          }}
                          placeholder="Disc %"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </td>

                      <td className="p-1 align-top">
                        <input
                          ref={costInputRef}
                          id="purchase-item-cost"
                          type="text"
                          value={formatWithCommas(itemCostUSD.split('.')[0])}
                          onChange={(e) => setItemCostUSD(e.target.value.replace(/,/g, '').split('.')[0])}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              totalInputRef.current?.focus();
                              totalInputRef.current?.select();
                            }
                          }}
                          placeholder="Cost"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </td>

                      <td className="p-1 align-top">
                        <input
                          ref={totalInputRef}
                          type="text"
                          value={formatWithCommas(itemTotalInput.split('.')[0])}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/,/g, '').split('.')[0];
                            setItemTotalInput(raw);
                            const newTotal = parseFloat(raw);
                            if (!isNaN(newTotal)) {
                              const qty = parseInt(itemQty, 10);
                              const safeQty = isNaN(qty) || qty <= 0 ? 1 : qty;
                              let newCost = newTotal / safeQty;
                              if (purchaseCurrency === 'LBP') newCost = Math.round(newCost);
                              setItemCostUSD(newCost.toString());
                            }
                          }}
                          onFocus={(e) => {
                            setIsTotalFocused(true);
                            e.target.select();
                          }}
                          onBlur={() => {
                            setIsTotalFocused(false);
                            const raw = itemTotalInput.replace(/,/g, '');
                            const val = parseFloat(raw) || 0;
                            setItemTotalInput(val.toString());
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddItemToInvoice();
                            }
                          }}
                          placeholder="Total"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              `;

content = content.replace(originalBlock, newTableBlock);

fs.writeFileSync('src/components/purchase/PurchaseView.tsx', content);

