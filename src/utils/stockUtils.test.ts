import { describe, it, expect } from 'vitest';
import { resolveProductBatches } from './stockUtils';
import { Product, PurchaseInvoice } from '../types/pharmacy';

describe('resolveProductBatches', () => {
  const baseProduct: Product = {
    id: 'prod-1',
    code: 'PAN500',
    barcode: '12345678',
    name: 'Panadol Extra',
    ingredients: 'Paracetamol 500mg, Caffeine 65mg',
    dosage: '500mg',
    presentation: 'Box of 24 tablets',
    form: 'Tablet',
    category: 'drug',
    priceUSD: 2.5,
    priceLBP: 225000,
    costPriceUSD: 1.8,
    pharmacistMarginProfit: 20,
    stockQuantity: 20,
    minStockAlert: 5,
    expiryDate: '2026-06',
    batchNumber: 'LOT-A',
    isDivisible: false,
    agent: 'Omnipharma',
    version: 1,
    updatedAt: Date.now(),
  };

  it('resolves batches from purchase invoices and allocates FIFO quantities accurately', () => {
    const purchases: PurchaseInvoice[] = [
      {
        id: 'pur-1',
        invoiceNumber: 'INV-100',
        supplierId: 'sup-1',
        supplierName: 'Omnipharma',
        date: '2025-01-10',
        totalCostUSD: 100,
        totalCostLBP: 9000000,
        exchangeRate: 89500,
        status: 'received',
        paid: true,
        timestamp: Date.now(),
        items: [
          {
            productId: 'prod-1',
            productCode: 'PAN500',
            productName: 'Panadol Extra',
            quantity: 10,
            unitCostUSD: 1.8,
            unitCostLBP: 162000,
            sellingPriceLBP: 225000,
            sellingPriceUSD: 2.5,
            batchNumber: 'BATCH-EARLY',
            expiryDate: '2025-12',
          },
          {
            productId: 'prod-1',
            productCode: 'PAN500',
            productName: 'Panadol Extra',
            quantity: 15,
            unitCostUSD: 1.8,
            unitCostLBP: 162000,
            sellingPriceLBP: 225000,
            sellingPriceUSD: 2.5,
            batchNumber: 'BATCH-LATE',
            expiryDate: '2026-12',
          },
        ],
      },
    ];

    // Product has 18 in stock (7 sold out of 25 purchased)
    const product: Product = {
      ...baseProduct,
      stockQuantity: 18,
      batches: undefined,
    };

    const resolved = resolveProductBatches(product, purchases);

    expect(resolved).toHaveLength(2);
    // BATCH-EARLY (2025-12) comes first
    expect(resolved[0].batchNumber).toBe('BATCH-EARLY');
    expect(resolved[0].expiryDate).toBe('2025-12');
    // 7 were sold from the earliest batch, so 10 - 7 = 3 remain
    expect(resolved[0].quantity).toBe(3);
    expect(resolved[0].isDepleted).toBe(false);

    // BATCH-LATE (2026-12) comes second
    expect(resolved[1].batchNumber).toBe('BATCH-LATE');
    expect(resolved[1].expiryDate).toBe('2026-12');
    expect(resolved[1].quantity).toBe(15);
    expect(resolved[1].isDepleted).toBe(false);

    // Total quantity must match stockQuantity exactly
    const totalQty = resolved.reduce((sum, b) => sum + b.quantity, 0);
    expect(totalQty).toBe(18);
  });

  it('marks batches as depleted when stock is 0', () => {
    const purchases: PurchaseInvoice[] = [
      {
        id: 'pur-1',
        invoiceNumber: 'INV-100',
        supplierId: 'sup-1',
        supplierName: 'Omnipharma',
        date: '2025-01-10',
        totalCostUSD: 50,
        totalCostLBP: 4500000,
        exchangeRate: 89500,
        status: 'received',
        paid: true,
        timestamp: Date.now(),
        items: [
          {
            productId: 'prod-1',
            productCode: 'PAN500',
            productName: 'Panadol Extra',
            quantity: 10,
            unitCostUSD: 1.8,
            unitCostLBP: 162000,
            sellingPriceLBP: 225000,
            batchNumber: 'BATCH-1',
            expiryDate: '2025-12',
          },
        ],
      },
    ];

    const product: Product = {
      ...baseProduct,
      stockQuantity: 0,
    };

    const resolved = resolveProductBatches(product, purchases);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].quantity).toBe(0);
    expect(resolved[0].isDepleted).toBe(true);
  });

  it('handles explicit batches preserved from manual adjustments', () => {
    const product: Product = {
      ...baseProduct,
      stockQuantity: 15,
      batches: [
        { batchNumber: 'LOT-1', expiryDate: '2025-11', quantity: 5 },
        { batchNumber: 'LOT-2', expiryDate: '2026-08', quantity: 10 },
      ],
    };

    const resolved = resolveProductBatches(product, []);
    expect(resolved).toHaveLength(2);
    expect(resolved[0].batchNumber).toBe('LOT-1');
    expect(resolved[0].quantity).toBe(5);
    expect(resolved[1].batchNumber).toBe('LOT-2');
    expect(resolved[1].quantity).toBe(10);
  });

  it('allocates excess stock to the latest batch when stock exceeds total recorded purchase capacity', () => {
    const purchases: PurchaseInvoice[] = [
      {
        id: 'pur-1',
        invoiceNumber: 'INV-100',
        supplierId: 'sup-1',
        supplierName: 'Omnipharma',
        date: '2025-01-10',
        totalCostUSD: 18,
        totalCostLBP: 1620000,
        exchangeRate: 89500,
        status: 'received',
        paid: true,
        timestamp: Date.now(),
        items: [
          {
            productId: 'prod-1',
            productCode: 'PAN500',
            productName: 'Panadol Extra',
            quantity: 10,
            unitCostUSD: 1.8,
            unitCostLBP: 162000,
            sellingPriceLBP: 225000,
            batchNumber: 'LOT-1',
            expiryDate: '2026-05',
          },
        ],
      },
    ];

    const product: Product = {
      ...baseProduct,
      stockQuantity: 15, // 5 units of unrecorded opening inventory
      batches: undefined,
    };

    const resolved = resolveProductBatches(product, purchases);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].quantity).toBe(15);
  });
});
