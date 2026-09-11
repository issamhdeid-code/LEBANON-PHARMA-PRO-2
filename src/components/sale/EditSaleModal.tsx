import React, { useState } from 'react';
import { X, Plus, Minus, Trash2, Check, AlertTriangle, ShoppingBag, User, CreditCard } from 'lucide-react';
import { SaleTransaction, Product } from '../../types/pharmacy';
import { formatStockDisplay } from '../../utils/stockUtils';
import { usePharmacy } from '../../context/PharmacyContext';
import { DesktopWindow } from '../common/DesktopWindow';
import { formatLBPValue } from '../../utils/priceUtils';

interface EditSaleModalProps {
  sale: SaleTransaction;
  onClose: () => void;
  onSaved: (updated: SaleTransaction) => void;
}

export const EditSaleModal: React.FC<EditSaleModalProps> = ({ sale, onClose, onSaved }) => {
  const { products, customers, updateSale, formatUSD, formatLBP, exchangeRate } = usePharmacy();

  const [customerId, setCustomerId] = useState<string>(sale.customerId || '');
  const [paymentMethod, setPaymentMethod] = useState<SaleTransaction['paymentMethod']>(sale.paymentMethod);
  const [items, setItems] = useState<SaleTransaction['items']>(() => JSON.parse(JSON.stringify(sale.items)));
  const [notes, setNotes] = useState<string>(sale.notes || '');
  const [selectedAddProductId, setSelectedAddProductId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Recalculate totals
  const totalUSD = items.reduce((acc, it) => acc + it.totalUSD, 0);
  const totalLBP = Math.round(totalUSD * sale.exchangeRate);

  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }

    setItems((prev) => {
      const copy = [...prev];
      const item = copy[index];
      const prod = products.find((p) => p.id === item.productId || p.code === item.productCode);
      
      // Stock check: calculate available stock (current stock + original sold qty)
      const origItem = sale.items.find((it) => (it.productId === item.productId || it.productCode === item.productCode) && !!it.isPiece === !!item.isPiece);
      const originalSoldEquivalent = origItem ? (origItem.isPiece && prod?.piecesPerBox ? origItem.quantity / prod.piecesPerBox : origItem.quantity) : 0;
      const currentAvailableEquivalent = (prod ? prod.stockQuantity : 0) + originalSoldEquivalent;
      
      const newQtyEquivalent = item.isPiece && prod?.piecesPerBox ? newQty / prod.piecesPerBox : newQty;

      if (newQtyEquivalent > currentAvailableEquivalent) {
        const maxAllowed = item.isPiece && prod?.piecesPerBox ? Math.floor(currentAvailableEquivalent * prod.piecesPerBox) : currentAvailableEquivalent;
        setError(`Only ${maxAllowed} units available in total for "${item.productName}".`);
        return prev;
      }
      setError(null);

      copy[index] = {
        ...item,
        quantity: newQty,
        totalUSD: Number((item.unitPriceUSD * newQty).toFixed(2)),
        totalLBP: Math.round(item.unitPriceLBP * newQty),
      };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setError('A sale transaction must contain at least 1 item. If you want to cancel the entire sale, please use the void/delete action.');
      return;
    }
    setError(null);
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    if (!selectedAddProductId) return;
    const prod = products.find((p) => p.id === selectedAddProductId);
    if (!prod) return;

    if (prod.stockQuantity <= 0) {
      setError(`"${prod.name}" is currently out of stock.`);
      return;
    }

    // Check if already in items
    const existingIndex = items.findIndex((it) => it.productId === prod.id || it.productCode === prod.code);
    if (existingIndex !== -1) {
      handleUpdateQuantity(existingIndex, items[existingIndex].quantity + 1);
      setSelectedAddProductId('');
      return;
    }

    setError(null);
    setItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        category: prod.category,
        quantity: 1,
        unitPriceUSD: prod.priceUSD,
        unitPriceLBP: prod.priceLBP,
        costPriceUSD: prod.costPriceUSD,
        totalUSD: prod.priceUSD,
        totalLBP: prod.priceLBP,
      },
    ]);
    setSelectedAddProductId('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setError('Sale cannot be empty.');
      return;
    }

    const selectedCust = customers.find((c) => c.id === customerId);

    const updatedData: Partial<SaleTransaction> = {
      customerId: selectedCust?.id,
      customerName: selectedCust?.name,
      paymentMethod,
      items,
      totalUSD: Number(totalUSD.toFixed(2)),
      totalLBP,
      notes,
      amountPaidUSD: paymentMethod === 'cash_usd' ? totalUSD : sale.amountPaidUSD,
      amountPaidLBP: paymentMethod === 'cash_lbp' ? totalLBP : sale.amountPaidLBP,
    };

    const res = updateSale(sale.id, updatedData);
    if (res.success) {
      onSaved({ ...sale, ...updatedData } as SaleTransaction);
      onClose();
    } else {
      setError(res.error || 'Failed to update sale.');
    }
  };

  return (
    <DesktopWindow title={`Edit Completed Sale Transaction: ${sale.invoiceNumber}`} isOpen={true} onClose={onClose} width="700px" height="80vh">
      <div className="w-full flex-1 flex flex-col min-h-0">
        <form onSubmit={handleSave} className="p-4 space-y-3.5 text-xs flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
          {error && (
            <div className="flex items-start rounded border border-rose-200 bg-rose-50 p-2 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Meta Fields: Customer & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded border border-gray-200 dark:border-slate-800">
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 dark:text-slate-300 mb-1">
                Patient / Customer
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Cash Client</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 dark:text-slate-300 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="cash_lbp">Cash (L.L. Lebanese Pounds)</option>
                <option value="cash_usd">Cash ($ US Dollar)</option>
                <option value="mixed">Mixed Currency ($ + L.L.)</option>
                <option value="credit_debt">Credit Account (Patient Debt)</option>
                <option value="card">Credit / Debit Card</option>
              </select>
            </div>
          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase text-gray-700 dark:text-slate-200">
                Transaction Items ({items.length})
              </span>
              <span className="text-[10px] text-gray-500 dark:text-slate-400">
                Adjusting quantities automatically updates stock inventory in the database.
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto rounded border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
              {items.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {item.productName}
                      {item.isPiece && (
                        <span className="ml-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                          (Piece)
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-slate-400">
                      Code: {item.productCode} • ${item.unitPriceUSD.toFixed(2)} / unit ({formatLBPValue(item.unitPriceLBP)} LBP)
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="flex items-center border border-gray-300 rounded bg-white dark:border-slate-700 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                        className="px-1.5 py-0.5 text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center font-bold text-slate-800 dark:text-slate-100 text-xs">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                        className="px-1.5 py-0.5 text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="w-20 text-right font-bold text-blue-600 dark:text-blue-400">
                      ${item.totalUSD.toFixed(2)}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Add Product to Sale */}
          <div className="flex items-center space-x-2 pt-1">
            <select
              value={selectedAddProductId}
              onChange={(e) => setSelectedAddProductId(e.target.value)}
              className="flex-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">+ Add another medication to this sale...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id} disabled={p.stockQuantity <= 0}>
                  {p.name} ({p.code}) - ${p.priceUSD.toFixed(2)} [{formatStockDisplay(p.stockQuantity, p.isDivisible, p.piecesPerBox, p.pieceName)} in stock]
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddItem}
              disabled={!selectedAddProductId}
              className="flex items-center space-x-1 rounded bg-teal-600 px-3 py-1 font-bold text-white hover:bg-teal-700 disabled:opacity-40 cursor-pointer shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-600 dark:text-slate-300 mb-1">
              Internal Sale Notes / Rx Reference
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Doctor Dr. Fadi, Refill Rx #8491, discount authorized"
              className="w-full rounded border border-gray-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Totals Summary */}
          <div className="rounded bg-teal-50 border border-teal-200 dark:bg-teal-950/40 dark:border-teal-900 p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-teal-800 dark:text-teal-300 block">
                Updated Total Amount (Rate: 1$ = {formatLBPValue(sale.exchangeRate)} L.L.)
              </span>
              <span className="text-sm font-bold text-teal-900 dark:text-teal-200">
                {formatUSD(totalUSD)}
              </span>
            </div>
            <div className="text-right font-bold text-teal-800 dark:text-teal-300 text-sm">
              {formatLBP(totalLBP)}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 rounded bg-teal-600 px-4 py-1.5 font-bold text-white hover:bg-teal-700 shadow-2xs cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </DesktopWindow>
  );
};
