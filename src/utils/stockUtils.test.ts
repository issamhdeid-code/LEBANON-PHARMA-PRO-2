import { describe, it, expect } from 'vitest';
import {
  resolveProductBatches,
  splitProductMolecule,
  isDateInRange,
  matchesBatchAndExpiryFilter,
  parseExpiryDate,
} from './stockUtils';
import { Product, PurchaseInvoice } from '../types/pharmacy';

describe('splitProductMolecule', () => {
  it('prefers the structured molecules array when present', () => {
    const rows = splitProductMolecule({
      ingredients: 'Stale + Value',
      dosage: 'stale',
      molecules: [
        { name: 'Paracetamol', strength: '500mg' },
        { name: 'Caffeine', strength: '65mg' },
      ],
    });
    expect(rows).toEqual([
      { name: 'Paracetamol', strength: '500mg' },
      { name: 'Caffeine', strength: '65mg' },
    ]);
  });

  it('splits legacy ingredients on + / , / ; and maps dosages pairwise', () => {
    const rows = splitProductMolecule({
      ingredients: 'Paracetamol + Caffeine',
      dosage: '500mg, 65mg',
    });
    expect(rows).toEqual([
      { name: 'Paracetamol', strength: '500mg' },
      { name: 'Caffeine', strength: '65mg' },
    ]);
  });

  it('assigns a lone dosage to the first molecule when counts mismatch', () => {
    const rows = splitProductMolecule({
      ingredients: 'Amoxicillin + Clavulanic Acid',
      dosage: '875mg',
    });
    expect(rows).toEqual([
      { name: 'Amoxicillin', strength: '875mg' },
      { name: 'Clavulanic Acid', strength: '' },
    ]);
  });

  it('keeps an empty builder row when nothing is stored', () => {
    const rows = splitProductMolecule({ ingredients: '', dosage: '' });
    expect(rows).toEqual([{ name: '', strength: '' }]);
  });
});

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

describe('resolveProductBatches', () => {
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

  it('accurately preserves stock deductions when batch quantities are adjusted downwards', () => {
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
            quantity: 20,
            unitCostUSD: 1.8,
            unitCostLBP: 162000,
            sellingPriceLBP: 225000,
            batchNumber: 'LOT-DEDUCT',
            expiryDate: '2026-10',
          },
        ],
      },
    ];

    // Pharmacist manually deducted 8 units from stock (e.g., damaged/expired/audited)
    const product: Product = {
      ...baseProduct,
      stockQuantity: 12,
      batches: [
        { batchNumber: 'LOT-DEDUCT', expiryDate: '2026-10', quantity: 12 },
      ],
    };

    const resolved = resolveProductBatches(product, purchases);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].batchNumber).toBe('LOT-DEDUCT');
    expect(resolved[0].quantity).toBe(12);
    expect(resolved[0].isDepleted).toBe(false);
  });

  it('accurately preserves multiple batches when a batch is depleted or deleted during adjustment', () => {
    const product: Product = {
      ...baseProduct,
      stockQuantity: 4,
      batches: [
        { batchNumber: 'LOT-ACTIVE', expiryDate: '2027-01', quantity: 4 },
      ],
    };

    const resolved = resolveProductBatches(product, []);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].batchNumber).toBe('LOT-ACTIVE');
    expect(resolved[0].quantity).toBe(4);
  });
});

describe('isDateInRange', () => {
  const refDate = new Date(2026, 8, 15); // Sep 15, 2026

  it('correctly identifies expired dates', () => {
    const expiredDate = new Date(2026, 7, 31); // Aug 31, 2026
    const futureDate = new Date(2026, 9, 1);   // Oct 1, 2026

    expect(isDateInRange(expiredDate, 'expired', undefined, undefined, refDate)).toBe(true);
    expect(isDateInRange(futureDate, 'expired', undefined, undefined, refDate)).toBe(false);
  });

  it('correctly checks 30 days preset', () => {
    const within30 = new Date(2026, 8, 30); // 15 days out
    const beyond30 = new Date(2026, 10, 1);  // 46 days out

    expect(isDateInRange(within30, '30days', undefined, undefined, refDate)).toBe(true);
    expect(isDateInRange(beyond30, '30days', undefined, undefined, refDate)).toBe(false);
  });

  it('correctly checks 90 days preset', () => {
    const within90 = new Date(2026, 10, 15); // 61 days out
    const beyond90 = new Date(2027, 0, 15);  // 122 days out

    expect(isDateInRange(within90, '90days', undefined, undefined, refDate)).toBe(true);
    expect(isDateInRange(beyond90, '90days', undefined, undefined, refDate)).toBe(false);
  });

  it('correctly handles custom date range', () => {
    const d = new Date(2026, 11, 25); // Dec 25, 2026
    expect(isDateInRange(d, 'custom', '2026-12-01', '2026-12-31', refDate)).toBe(true);
    expect(isDateInRange(d, 'custom', '2027-01-01', '2027-01-31', refDate)).toBe(false);
  });
});

describe('matchesBatchAndExpiryFilter', () => {
  const refDate = new Date(2026, 8, 15); // Sep 15, 2026
  const sampleProd: Product = {
    ...baseProduct,
    id: 'p1',
    code: 'TEST1',
    name: 'Test Product',
    priceUSD: 10,
    priceLBP: 890000,
    stockQuantity: 5,
    category: 'drug',
    minStockAlert: 2,
    batches: [
      { batchNumber: 'LOT-A100', expiryDate: '2026-08', quantity: 2 }, // expired
      { batchNumber: 'LOT-B200', expiryDate: '2027-05', quantity: 3 }, // future
    ],
  };

  it('returns true when no filters are active', () => {
    expect(matchesBatchAndExpiryFilter(sampleProd, false, '', false, 'all', undefined, undefined, undefined, refDate)).toBe(true);
  });

  it('filters by batch number case-insensitively', () => {
    expect(matchesBatchAndExpiryFilter(sampleProd, true, 'a100', false, 'all', undefined, undefined, undefined, refDate)).toBe(true);
    expect(matchesBatchAndExpiryFilter(sampleProd, true, 'b200', false, 'all', undefined, undefined, undefined, refDate)).toBe(true);
    expect(matchesBatchAndExpiryFilter(sampleProd, true, 'nonexistent', false, 'all', undefined, undefined, undefined, refDate)).toBe(false);
  });

  it('filters by expiry preset', () => {
    expect(matchesBatchAndExpiryFilter(sampleProd, false, '', true, 'expired', undefined, undefined, undefined, refDate)).toBe(true);
    expect(matchesBatchAndExpiryFilter(sampleProd, false, '', true, '30days', undefined, undefined, undefined, refDate)).toBe(false);
  });

  it('filters by both batch number and expiry preset combined', () => {
    // LOT-A100 is expired
    expect(matchesBatchAndExpiryFilter(sampleProd, true, 'a100', true, 'expired', undefined, undefined, undefined, refDate)).toBe(true);
    // LOT-B200 is not expired
    expect(matchesBatchAndExpiryFilter(sampleProd, true, 'b200', true, 'expired', undefined, undefined, undefined, refDate)).toBe(false);
  });

  it('supports purchase invoice batches', () => {
    const prodWithoutBatches: Product = {
      ...sampleProd,
      batches: [],
      batchNumber: '',
      expiryDate: '',
    };
    const purchaseBatches = [{ batchNumber: 'PUR-999', expiryDate: '2027-10' }];

    expect(matchesBatchAndExpiryFilter(prodWithoutBatches, true, 'pur-999', false, 'all', undefined, undefined, purchaseBatches, refDate)).toBe(true);
    expect(matchesBatchAndExpiryFilter(prodWithoutBatches, true, 'other', false, 'all', undefined, undefined, purchaseBatches, refDate)).toBe(false);
  });
});

