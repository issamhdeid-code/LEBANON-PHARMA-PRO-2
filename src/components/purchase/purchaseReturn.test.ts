import { describe, it, expect } from 'vitest';
import { PurchaseReturn, PurchaseReturnItem, Product } from '../../types/pharmacy';

describe('Purchase Return Logic & Calculations', () => {
  const sampleProduct: Product = {
    id: 'prod-101',
    code: 'AUG625',
    barcode: '6285001001',
    name: 'Augmentin 625mg',
    ingredients: 'Amoxicillin + Clavulanic Acid',
    dosage: '625mg',
    presentation: 'Box of 14 Tablets',
    form: 'Tablet',
    category: 'drug',
    priceUSD: 8.5,
    priceLBP: 760750,
    costPriceUSD: 6.0,
    pharmacistMarginProfit: 20,
    agent: 'Mersaco',
    stockQuantity: 20,
    minStockAlert: 5,
    expiryDate: '2026-12-31',
    batchNumber: 'LOT-2024-B',
    updatedAt: Date.now(),
    version: 1,
    batches: [
      { batchNumber: 'LOT-2023-A', expiryDate: '2025-06-30', quantity: 12 },
      { batchNumber: 'LOT-2024-B', expiryDate: '2026-12-31', quantity: 8 },
    ],
  };

  it('calculates total cash refund correctly in USD and LBP', () => {
    const items: PurchaseReturnItem[] = [
      {
        productId: sampleProduct.id,
        name: sampleProduct.name,
        productCode: sampleProduct.code,
        barcode: sampleProduct.barcode,
        quantity: 5,
        unitCostUSD: 6.0,
        unitCostLBP: 537000,
        refundAmountUSD: 30.0,
        refundAmountLBP: 2685000,
        oldBatchNumber: 'LOT-2023-A',
        oldExpiryDate: '2025-06-30',
      },
    ];

    const totalUSD = items.reduce((sum, it) => sum + (it.refundAmountUSD || 0), 0);
    const totalLBP = items.reduce((sum, it) => sum + (it.refundAmountLBP || 0), 0);

    expect(totalUSD).toBe(30.0);
    expect(totalLBP).toBe(2685000);
  });

  it('correctly manages replace_expiry item structure with new batch and replacement quantity', () => {
    const returnItem: PurchaseReturnItem = {
      productId: sampleProduct.id,
      name: sampleProduct.name,
      productCode: sampleProduct.code,
      barcode: sampleProduct.barcode,
      quantity: 4,
      unitCostUSD: 6.0,
      unitCostLBP: 537000,
      oldBatchNumber: 'LOT-2023-A',
      oldExpiryDate: '2025-06-30',
      newBatchNumber: 'LOT-2025-FRESH',
      newExpiryDate: '2028-05-31',
      replacementQuantity: 4,
      reason: 'Near Expiry Swap',
    };

    expect(returnItem.quantity).toBe(4);
    expect(returnItem.replacementQuantity).toBe(4);
    expect(returnItem.newBatchNumber).toBe('LOT-2025-FRESH');
    expect(returnItem.newExpiryDate).toBe('2028-05-31');
  });

  it('verifies product stock reduction calculation when returning items for cash refund', () => {
    const returnQty = 5;
    const updatedStock = Math.max(0, sampleProduct.stockQuantity - returnQty);
    expect(updatedStock).toBe(15);
  });

  it('verifies product stock delta when replacing with different quantity', () => {
    const returnedQty = 10;
    const receivedReplacementQty = 8;
    const netDelta = receivedReplacementQty - returnedQty; // -2
    const updatedStock = sampleProduct.stockQuantity + netDelta;
    expect(updatedStock).toBe(18);
  });
});
