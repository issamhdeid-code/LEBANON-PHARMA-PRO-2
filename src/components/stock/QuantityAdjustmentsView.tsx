import React, { useState, useMemo } from 'react';
import { Search, Save, PackageMinus, Plus, Minus, Trash2 } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Product, ProductBatch } from '../../types/pharmacy';
import { formatStockDisplay } from '../../utils/stockUtils';
import { SectionRestoreButton } from '../common/SectionRestoreButton';

export const QuantityAdjustmentsView: React.FC = () => {
  const { products, updateProduct, deleteProduct, currentUser } = usePharmacy();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Form states
  const [formBatches, setFormBatches] = useState<ProductBatch[]>([]);
  const [formIsDivisible, setFormIsDivisible] = useState(false);
  const [formPiecesPerBox, setFormPiecesPerBox] = useState<string | number>('');
  const [formPieceName, setFormPieceName] = useState('');
  const [formPiecePriceUSD, setFormPiecePriceUSD] = useState('');
  const [isPiecePriceManual, setIsPiecePriceManual] = useState(false);
  const [batchQuantityDrafts, setBatchQuantityDrafts] = useState<Array<{ boxes: string; pieces: string }>>([]);

  const getBatchQuantityDraft = (quantity: number, piecesPerBox: number) => {
    const totalPieces = Math.round(quantity * piecesPerBox);
    return {
      boxes: Math.floor(totalPieces / piecesPerBox).toString(),
      pieces: (totalPieces % piecesPerBox).toString(),
    };
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(p => 
      (p.code || '').toLowerCase().includes(q) || 
      (p.barcode || '').toLowerCase().includes(q) || 
      (p.name || '').toLowerCase().includes(q) ||
      (p.batchNumber || '').toLowerCase().includes(q) ||
      (p.batches || []).some(b => (b.batchNumber || '').toLowerCase().includes(q))
    ).slice(0, 10);
  }, [searchQuery, products]);

  const handleSelectProduct = (prod: Product) => {
    setIsConfirmingDelete(false);
    setSelectedProduct(prod);
    setFormIsDivisible(prod.isDivisible || false);
    setFormPiecesPerBox(prod.piecesPerBox || '');
    setFormPieceName(prod.pieceName || '');
    setFormPiecePriceUSD(prod.piecePriceUSD?.toString() || '');
    setIsPiecePriceManual(!!prod.piecePriceUSD);
    setSearchQuery('');
    
    // Init batches
    if (prod.batches && prod.batches.length > 0) {
      // Ensure quantity exists
      let bts = prod.batches.map(b => ({
        ...b,
        quantity: b.quantity ?? 0
      }));
      
      const sum = bts.reduce((s, b) => s + b.quantity, 0);
      if (sum !== prod.stockQuantity) {
        // Auto-fix mismatch by placing the difference on the first batch,
        // or just updating the first batch to make it sum correctly
        const delta = prod.stockQuantity - sum;
        bts[0].quantity = Math.max(0, bts[0].quantity + delta);
      }
      setFormBatches(bts);
      setBatchQuantityDrafts(bts.map(b => getBatchQuantityDraft(b.quantity || 0, prod.piecesPerBox || 1)));
    } else {
      const batch = {
        batchNumber: prod.batchNumber || '',
        expiryDate: prod.expiryDate || '',
        quantity: prod.stockQuantity || 0
      };
      setFormBatches([batch]);
      setBatchQuantityDrafts([getBatchQuantityDraft(batch.quantity, prod.piecesPerBox || 1)]);
    }
  };

  const handleUpdateBatchQuantity = (index: number, qtyString: string) => {
    const newBatches = [...formBatches];
    newBatches[index].quantity = parseFloat(qtyString) || 0;
    setFormBatches(newBatches);
  };

  const handleAddBatch = () => {
    setFormBatches([...formBatches, { batchNumber: '', expiryDate: '', quantity: 0 }]);
    setBatchQuantityDrafts([...batchQuantityDrafts, { boxes: '0', pieces: '0' }]);
  };

  const handleRemoveBatch = (index: number) => {
    const newBatches = formBatches.filter((_, i) => i !== index);
    setFormBatches(newBatches);
    setBatchQuantityDrafts(batchQuantityDrafts.filter((_, i) => i !== index));
  };

  const handleUpdateBatchPart = (index: number, part: 'boxes' | 'pieces', value: string) => {
    const drafts = [...batchQuantityDrafts];
    const draft = { ...(drafts[index] || { boxes: '0', pieces: '0' }), [part]: value };
    drafts[index] = draft;
    setBatchQuantityDrafts(drafts);

    const piecesPerBox = Number(formPiecesPerBox) || 1;
    const boxes = parseInt(draft.boxes, 10) || 0;
    const pieces = parseInt(draft.pieces, 10) || 0;
    handleUpdateBatchQuantity(index, (boxes + pieces / piecesPerBox).toString());
  };

  const handleNormalizeBatchPart = (index: number) => {
    const piecesPerBox = Number(formPiecesPerBox) || 1;
    const draft = batchQuantityDrafts[index] || { boxes: '0', pieces: '0' };
    let boxes = Math.max(0, parseInt(draft.boxes, 10) || 0);
    let pieces = Math.max(0, parseInt(draft.pieces, 10) || 0);
    
    if (pieces >= piecesPerBox && piecesPerBox > 1) {
      boxes += Math.floor(pieces / piecesPerBox);
      pieces = pieces % piecesPerBox;
    } else if (piecesPerBox <= 1) {
      pieces = 0;
    }

    const normalizedDrafts = [...batchQuantityDrafts];
    normalizedDrafts[index] = { boxes: boxes.toString(), pieces: pieces.toString() };
    setBatchQuantityDrafts(normalizedDrafts);
    handleUpdateBatchQuantity(index, (boxes + pieces / piecesPerBox).toString());
  };

  const handleSave = () => {
    if (!selectedProduct) return;
    
    const totalQuantity = formBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    const mainBatch = formBatches.length > 0 ? formBatches[0].batchNumber : '';
    const mainExpiry = formBatches.length > 0 ? formBatches[0].expiryDate : '';

    updateProduct(selectedProduct.id, {
      ...selectedProduct,
      stockQuantity: totalQuantity,
      batchNumber: mainBatch,
      expiryDate: mainExpiry,
      batches: formBatches,
      isDivisible: formIsDivisible,
      piecesPerBox: formIsDivisible ? Number(formPiecesPerBox) || undefined : undefined,
      pieceName: formIsDivisible ? formPieceName : undefined,
      piecePriceUSD: formIsDivisible && formPiecePriceUSD ? Number(formPiecePriceUSD) : undefined,
    });
    
    // Clear selection after save
    setSelectedProduct(null);
    setFormBatches([]);
    setBatchQuantityDrafts([]);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <SectionRestoreButton section="adjustments" />
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <PackageMinus className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                Quantity Adjustments
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Adjust stock levels and manage batches for inventory items.
            </p>
          </div>
        </div>

        {/* Search & Select */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by barcode, code, name, or batch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 dark:text-slate-100 transition-all"
            />
            {searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto z-10">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No products found matching "{searchQuery}"
                  </div>
                ) : (
                  filteredProducts.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer flex justify-between items-center last:border-0"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Code: {p.code} • Total Stock: {formatStockDisplay(p.stockQuantity, p.isDivisible, p.piecesPerBox, p.pieceName)}</div>
                      </div>
                      <div className="text-xs font-mono bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-slate-600 dark:text-slate-400">
                        ${p.priceUSD.toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Product Adjustments */}
        {selectedProduct && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedProduct.name}</h2>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex gap-4">
                  <span>Code: <span className="font-mono text-slate-700 dark:text-slate-300">{selectedProduct.code}</span></span>
                  <span>Category: <span className="capitalize text-slate-700 dark:text-slate-300">{selectedProduct.category}</span></span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Calculated Stock</div>
                <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                  {formatStockDisplay(formBatches.reduce((sum, b) => sum + (b.quantity || 0), 0), selectedProduct.isDivisible, Number(formPiecesPerBox), formPieceName)}
                </div>
              </div>
            </div>

            
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 mb-6">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDivisibleCheckQty"
                  checked={formIsDivisible}
                  onChange={(e) => setFormIsDivisible(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                />
                <label htmlFor="isDivisibleCheckQty" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Divide Box into Pieces
                </label>
              </div>
              {formIsDivisible && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-6 border-l-2 border-teal-200 dark:border-teal-900 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Pieces per Box
                    </label>
                    <input
                      type="number"
                      min="2"
                      value={formPiecesPerBox}
                      onChange={(e) => {
                        setFormPiecesPerBox(e.target.value);
                        const val = parseFloat(e.target.value);
                        if (!isPiecePriceManual && !isNaN(val) && val > 0 && selectedProduct?.priceUSD) {
                          setFormPiecePriceUSD((Number(selectedProduct.priceUSD) / val).toFixed(2));
                        }
                      }}
                      placeholder="e.g. 30"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      required={formIsDivisible}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Piece Name
                    </label>
                    <input
                      type="text"
                      value={formPieceName}
                      onChange={(e) => setFormPieceName(e.target.value)}
                      placeholder="e.g. Sachet"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      required={formIsDivisible}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
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
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">

              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300">Batches & Quantities</h3>
                <button
                  onClick={handleAddBatch}
                  className="flex items-center gap-1.5 text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add Batch
                </button>
              </div>

              {formBatches.length === 0 ? (
                <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-gray-500 dark:text-gray-400">
                  No batches configured. Add a batch to adjust stock.
                </div>
              ) : (
                <div className="space-y-3">
                  {formBatches.map((batch, idx) => (
                    <div key={idx} className="flex gap-4 items-end bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Batch Number</label>
                        <input
                          type="text"
                          value={batch.batchNumber}
                          onChange={(e) => {
                            const newBatches = [...formBatches];
                            newBatches[idx].batchNumber = e.target.value;
                            setFormBatches(newBatches);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-teal-500 dark:text-slate-100"
                          placeholder="e.g. BT-123"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Expiry Date</label>
                        <input
                          type="date"
                          value={batch.expiryDate}
                          onChange={(e) => {
                            const newBatches = [...formBatches];
                            newBatches[idx].expiryDate = e.target.value;
                            setFormBatches(newBatches);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-teal-500 dark:text-slate-100"
                        />
                      </div>
                      {formIsDivisible ? (
                        <div className="flex gap-2">
                          <div className="w-24">
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Boxes</label>
                            <input
                              type="number"
                              value={batchQuantityDrafts[idx]?.boxes ?? '0'}
                              onChange={(e) => {
                                handleUpdateBatchPart(idx, 'boxes', e.target.value);
                              }}
                              onBlur={() => handleNormalizeBatchPart(idx)}
                              min="0"
                              placeholder="0"
                              className="w-full text-center font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-hidden focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <div className="w-24">
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1" title={formPieceName || 'Pieces'}>
                              {formPieceName || 'Pieces'}
                            </label>
                            <input
                              type="number"
                              value={batchQuantityDrafts[idx]?.pieces ?? '0'}
                              onChange={(e) => {
                                handleUpdateBatchPart(idx, 'pieces', e.target.value);
                              }}
                              onBlur={() => handleNormalizeBatchPart(idx)}
                              min="0"
                              placeholder="0"
                              className="w-full text-center font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-hidden focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="w-32">
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Quantity</label>
                          <div className="flex items-center">
                            <input
                              type="number"
                              value={batch.quantity === 0 ? '' : batch.quantity}
                              onChange={(e) => handleUpdateBatchQuantity(idx, e.target.value)}
                              min="0"
                              placeholder="0"
                              className="w-full text-center font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-hidden focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => handleRemoveBatch(idx)}
                        className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg dark:hover:bg-red-950/30 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900/50 cursor-pointer"
                        title="Remove Batch"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                {formBatches.reduce((sum, b) => sum + (b.quantity || 0), 0) === 0 && currentUser?.role === 'admin' && (
                  <>
                  <button
                    onClick={() => {
                      if (isConfirmingDelete) {
                        deleteProduct(selectedProduct.id);
                        setSelectedProduct(null);
                        setFormBatches([]);
                        setIsConfirmingDelete(false);
                      } else {
                        setIsConfirmingDelete(true);
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer shadow-xs ${
                      isConfirmingDelete 
                        ? 'bg-rose-600 text-white hover:bg-rose-700' 
                        : 'bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50'
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isConfirmingDelete ? 'Are you sure? Click to confirm' : 'Delete Product Completely'}
                  </button>
                  {isConfirmingDelete && (
                    <button
                      onClick={() => setIsConfirmingDelete(false)}
                      className="ml-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                    >
                      Cancel
                    </button>
                  )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2 font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={formBatches.length === 0 || formBatches.some(b => !(b.batchNumber || '').trim() || !(b.expiryDate || '').trim())}
                  className="flex items-center gap-2 bg-teal-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-teal-700 focus:ring-4 focus:ring-teal-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  <Save className="h-4 w-4" />
                  Save Adjustments
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
