import { describe, it, expect } from 'vitest';
import {
  normalizeExtractedExpiry,
  matchSupplier,
  matchProduct,
  matchExtractedInvoice,
  convertToPurchaseItem,
  ExtractedInvoiceData,
  ExtractedInvoiceItem,
} from './idpService';
import { Product, Supplier } from '../types/pharmacy';

describe('normalizeExtractedExpiry', () => {
  it('normalizes YYYY-MM-DD into display MM/YYYY and ISO YYYY-MM-DD', () => {
    const res = normalizeExtractedExpiry('2027-08-31');
    expect(res.displayExpiry).toBe('08/2027');
    expect(res.isoExpiry).toBe('2027-08-31');
  });

  it('normalizes MM/YYYY into display MM/YYYY and last-day ISO', () => {
    const res = normalizeExtractedExpiry('05/2028');
    expect(res.displayExpiry).toBe('05/2028');
    expect(res.isoExpiry).toBe('2028-05-31');
  });

  it('normalizes two-digit year MM/YY into 20YY', () => {
    const res = normalizeExtractedExpiry('09/26');
    expect(res.displayExpiry).toBe('09/2026');
    expect(res.isoExpiry).toBe('2026-09-30');
  });

  it('normalizes DD/MM/YYYY when day > 12', () => {
    const res = normalizeExtractedExpiry('25/11/2027');
    expect(res.displayExpiry).toBe('11/2027');
    expect(res.isoExpiry).toBe('2027-11-25');
  });

  it('normalizes 4-digit numeric string MMYY', () => {
    const res = normalizeExtractedExpiry('0429');
    expect(res.displayExpiry).toBe('04/2029');
    expect(res.isoExpiry).toBe('2029-04-30');
  });

  it('handles empty or missing input gracefully', () => {
    expect(normalizeExtractedExpiry('')).toEqual({ displayExpiry: '', isoExpiry: '' });
    expect(normalizeExtractedExpiry(undefined)).toEqual({ displayExpiry: '', isoExpiry: '' });
  });
});

const createMockSupplier = (overrides: Partial<Supplier>): Supplier => ({
  id: 'sup-default',
  name: 'Default Supplier',
  code: 'DEF',
  phone: '01-000000',
  email: 'supplier@test.com',
  address: 'Beirut, Lebanon',
  contactPerson: 'Agent',
  paymentTerms: '30 Days',
  balanceUSD: 0,
  balanceLBP: 0,
  ...overrides,
});

const createMockProduct = (overrides: Partial<Product>): Product => ({
  id: 'prod-default',
  name: 'Default Product',
  code: 'PROD',
  category: 'drug',
  ingredients: 'Molecule',
  dosage: '500mg',
  presentation: 'Box of 20',
  form: 'Tablet',
  priceLBP: 500000,
  priceUSD: 5.5,
  costPriceUSD: 4.0,
  pharmacistMarginProfit: 20,
  agent: 'Agent',
  stockQuantity: 50,
  minStockAlert: 10,
  expiryDate: '2028-12-31',
  batchNumber: 'LOT1',
  updatedAt: Date.now(),
  version: 1,
  ...overrides,
});

describe('matchSupplier', () => {
  const sampleSuppliers: Supplier[] = [
    createMockSupplier({
      id: 'sup-1',
      name: 'Mersaco S.A.L.',
      code: 'MERS01',
    }),
    createMockSupplier({
      id: 'sup-2',
      name: 'Omnipharma',
      code: 'OMNI',
    }),
    createMockSupplier({
      id: 'sup-3',
      name: 'Droguerie Fattal',
      code: 'FAT',
    }),
  ];

  it('matches exact name', () => {
    const matched = matchSupplier('Omnipharma', sampleSuppliers);
    expect(matched?.id).toBe('sup-2');
  });

  it('matches exact code', () => {
    const matched = matchSupplier('MERS01', sampleSuppliers);
    expect(matched?.id).toBe('sup-1');
  });

  it('matches substring variant (e.g. Mersaco without S.A.L.)', () => {
    const matched = matchSupplier('Mersaco', sampleSuppliers);
    expect(matched?.id).toBe('sup-1');
  });

  it('matches partial distributor token (e.g. Fattal)', () => {
    const matched = matchSupplier('Fattal Distribution Lebanon', sampleSuppliers);
    expect(matched?.id).toBe('sup-3');
  });

  it('returns null if no supplier matches', () => {
    const matched = matchSupplier('Completely Unknown Co', sampleSuppliers);
    expect(matched).toBeNull();
  });
});

describe('matchProduct', () => {
  const sampleProducts: Product[] = [
    createMockProduct({
      id: 'prod-1',
      name: 'Augmentin 1g',
      code: 'AUG1G',
      barcode: '5000158068438',
      dosage: '1000mg',
      form: 'Tablet',
      stockQuantity: 50,
      priceUSD: 14.5,
      priceLBP: 1297750,
      costPriceUSD: 11.2,
    }),
    createMockProduct({
      id: 'prod-2',
      name: 'Panadol Extra',
      code: 'PANEX',
      barcode: '5000347065017',
      dosage: '500mg',
      form: 'Tablet',
      stockQuantity: 100,
      priceUSD: 3.5,
      priceLBP: 313250,
      costPriceUSD: 2.8,
    }),
  ];

  it('matches by exact barcode', () => {
    const item: ExtractedInvoiceItem = {
      productName: 'Some Unknown Name on Invoice',
      barcode: '5000158068438',
      quantity: 10,
      batchNumber: 'LOT123',
      expiryDate: '12/2028',
      unitCost: 11.2,
    };
    const res = matchProduct(item, sampleProducts);
    expect(res.matchType).toBe('exact');
    expect(res.product?.id).toBe('prod-1');
  });

  it('matches by exact item code', () => {
    const item: ExtractedInvoiceItem = {
      productName: 'Different Description',
      itemCode: 'PANEX',
      quantity: 5,
      batchNumber: 'LOT456',
      expiryDate: '06/2027',
      unitCost: 2.8,
    };
    const res = matchProduct(item, sampleProducts);
    expect(res.matchType).toBe('exact');
    expect(res.product?.id).toBe('prod-2');
  });

  it('fuzzy matches brand and strength', () => {
    const item: ExtractedInvoiceItem = {
      productName: 'Augmentin 1g 14 film-coated tab',
      quantity: 12,
      batchNumber: 'B890',
      expiryDate: '09/2027',
      unitCost: 11.2,
    };
    const res = matchProduct(item, sampleProducts);
    expect(res.matchType).toBe('fuzzy');
    expect(res.product?.id).toBe('prod-1');
  });

  it('returns none if product is not in catalog', () => {
    const item: ExtractedInvoiceItem = {
      productName: 'Lipitor 20mg 30 Tab',
      quantity: 5,
      batchNumber: 'B111',
      expiryDate: '01/2028',
      unitCost: 18.0,
    };
    const res = matchProduct(item, sampleProducts);
    expect(res.matchType).toBe('none');
    expect(res.product).toBeNull();
  });
});

describe('matchExtractedInvoice', () => {
  const sampleSuppliers: Supplier[] = [
    createMockSupplier({
      id: 'sup-1',
      name: 'Mersaco',
      code: 'MERS',
    }),
  ];

  const sampleProducts: Product[] = [
    createMockProduct({
      id: 'prod-1',
      name: 'Augmentin 1g',
      code: 'AUG1G',
      barcode: '5000158068438',
      dosage: '1000mg',
      stockQuantity: 50,
      priceUSD: 14.5,
      priceLBP: 1297750,
      costPriceUSD: 11.2,
    }),
  ];

  it('processes USD invoice with dual-currency calculations', () => {
    const extracted: ExtractedInvoiceData = {
      supplierName: 'Mersaco',
      invoiceNumber: 'INV-2026-991',
      invoiceDate: '2026-09-15',
      currency: 'USD',
      exchangeRate: 89500,
      invoiceDiscountPercent: 2,
      totalAmount: 112.0,
      items: [
        {
          productName: 'Augmentin 1g Tab',
          quantity: 10,
          freeQty: 1,
          batchNumber: 'LT99',
          expiryDate: '12/2028',
          unitCost: 11.2,
          discount: 0,
        },
      ],
    };

    const result = matchExtractedInvoice(extracted, sampleProducts, sampleSuppliers, 89500);

    expect(result.supplierId).toBe('sup-1');
    expect(result.invoiceNumber).toBe('INV-2026-991');
    expect(result.items.length).toBe(1);

    const item = result.items[0];
    expect(item.matchedProductId).toBe('prod-1');
    expect(item.calculatedUnitCostUSD).toBe(11.2);
    expect(item.calculatedUnitCostLBP).toBe(Math.round(11.2 * 89500));
    expect(item.freeQty).toBe(1);
    expect(item.displayExpiry).toBe('12/2028');
    expect(item.isExpired).toBe(false);
  });

  it('flags expired items accurately', () => {
    const extracted: ExtractedInvoiceData = {
      supplierName: 'Mersaco',
      invoiceNumber: 'INV-OLD',
      currency: 'USD',
      items: [
        {
          productName: 'Augmentin 1g Tab',
          quantity: 5,
          batchNumber: 'OLD-LOT',
          expiryDate: '01/2020', // distinctly in the past
          unitCost: 10,
        },
      ],
    };

    const result = matchExtractedInvoice(extracted, sampleProducts, sampleSuppliers, 89500);
    expect(result.items[0].isExpired).toBe(true);
  });
});

describe('convertToPurchaseItem', () => {
  it('generates a valid PurchaseItem structure compatible with PurchaseView', () => {
    const matchedItem = {
      id: 'test-1',
      productName: 'Augmentin 1g',
      matchedProductId: 'prod-1',
      matchedProductName: 'Augmentin 1g 14 Tab',
      matchedProductCode: 'AUG1G',
      matchType: 'exact' as const,
      quantity: 15,
      freeQty: 2,
      batchNumber: 'LOT778',
      expiryDate: '10/2028',
      unitCost: 12.0,
      calculatedUnitCostUSD: 12.0,
      calculatedUnitCostLBP: 1074000,
      calculatedSellingPriceUSD: 15.5,
      calculatedSellingPriceLBP: 1387250,
      normalizedExpiryISO: '2028-10-31',
      displayExpiry: '10/2028',
      discount: 5,
      isExpired: false,
    };

    const purchaseItem = convertToPurchaseItem(matchedItem);

    expect(purchaseItem.productId).toBe('prod-1');
    expect(purchaseItem.productName).toBe('Augmentin 1g 14 Tab');
    expect(purchaseItem.quantity).toBe(15);
    expect(purchaseItem.freeQty).toBe(2);
    expect(purchaseItem.unitCostUSD).toBe(12.0);
    expect(purchaseItem.unitCostLBP).toBe(1074000);
    expect(purchaseItem.batchNumber).toBe('LOT778');
    expect(purchaseItem.expiryDate).toBe('10/2028');
    expect(purchaseItem.discount).toBe(5);
    expect(purchaseItem.vatRate).toBe(0);
  });
});
