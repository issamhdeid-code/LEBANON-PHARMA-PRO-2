import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { OfflineStorage } from './storage';
import { YearClosingRecord, Product, Customer, Supplier } from '../types/pharmacy';

describe('Fiscal Year Closing & Archiving Engine', () => {
  const store = new Map<string, string>();

  beforeAll(() => {
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i],
      get length() { return store.size; },
    };
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and retrieves closed year records in OfflineStorage', () => {
    const mockRecord: YearClosingRecord = {
      year: 2025,
      closedAt: Date.now(),
      closedDate: new Date().toISOString(),
      closedBy: 'Dr. Tarek El-Khoury',
      note: 'Fiscal 2025 Annual Audit Signoff',
      summary: {
        salesCount: 120,
        totalSalesUSD: 4500.5,
        totalSalesLBP: 402794750,
        purchasesCount: 35,
        totalPurchasesUSD: 3100.0,
        totalPurchasesLBP: 277450000,
        expensesCount: 15,
        totalExpensesUSD: 400.0,
        totalExpensesLBP: 35800000,
        customerPaymentsCount: 18,
        supplierPaymentsCount: 12,
        productsCount: 450,
        inventoryValuationUSD: 8500.0,
        inventoryValuationLBP: 760750000,
        customersCount: 80,
        suppliersCount: 22,
      },
    };

    expect(OfflineStorage.getClosedYears()).toEqual([]);
    OfflineStorage.saveClosedYears([mockRecord]);

    const retrieved = OfflineStorage.getClosedYears();
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].year).toBe(2025);
    expect(retrieved[0].closedBy).toBe('Dr. Tarek El-Khoury');
    expect(retrieved[0].summary.salesCount).toBe(120);
    expect(retrieved[0].summary.inventoryValuationUSD).toBe(8500.0);
  });

  it('carries over inventory quantities, batches, and prices intact at moment of closing', () => {
    const initialProducts: Product[] = [
      {
        id: 'prod-1',
        name: 'Panadol Extra 500mg',
        code: 'PAN-001',
        category: 'drug',
        dosage: '500mg',
        form: 'Tablet',
        presentation: 'Box of 24',
        ingredients: 'Paracetamol',
        priceUSD: 3.5,
        priceLBP: 313250,
        costPriceUSD: 2.2,
        pharmacistMarginProfit: 20,
        agent: 'Mersaco',
        stockQuantity: 48,
        batchNumber: 'BATCH-2025-A',
        expiryDate: '2027-06-30',
        batches: [
          { batchNumber: 'BATCH-2025-A', expiryDate: '2027-06-30', quantity: 30 },
          { batchNumber: 'BATCH-2025-B', expiryDate: '2027-12-31', quantity: 18 },
        ],
        type: 'brand',
        requiresPrescription: false,
        version: 1,
      },
      {
        id: 'prod-2',
        name: 'Amoxicillin 1g',
        code: 'AMX-001',
        category: 'drug',
        dosage: '1000mg',
        form: 'Capsule',
        presentation: 'Box of 16',
        ingredients: 'Amoxicillin',
        priceUSD: 6.0,
        priceLBP: 537000,
        costPriceUSD: 4.1,
        pharmacistMarginProfit: 20,
        agent: 'Omnipharma',
        stockQuantity: 25,
        batchNumber: 'AMX-998',
        expiryDate: '2026-11-15',
        type: 'generic',
        requiresPrescription: true,
        version: 1,
      },
    ];

    OfflineStorage.saveProducts(initialProducts);

    // Verify stock is retrieved intact
    const loadedProducts = OfflineStorage.getProducts();
    expect(loadedProducts).toHaveLength(2);
    expect(loadedProducts[0].stockQuantity).toBe(48);
    expect(loadedProducts[0].batches).toHaveLength(2);
    expect(loadedProducts[0].batchNumber).toBe('BATCH-2025-A');
    expect(loadedProducts[1].stockQuantity).toBe(25);
  });

  it('carries over customer and supplier balances as opening balances for the new year', () => {
    const customers: Customer[] = [
      {
        id: 'cust-1',
        name: 'Ahmad Mroueh',
        phone: '70123456',
        address: 'Beirut, Hamra',
        balanceUSD: 145.5,
        balanceLBP: 13022250,
        loyaltyPoints: 120,
        lastVisit: '2025-12-28',
      },
      {
        id: 'cust-2',
        name: 'Nour Haddad',
        phone: '03987654',
        address: 'Achrafieh',
        balanceUSD: 0,
        balanceLBP: 0,
        loyaltyPoints: 45,
        lastVisit: '2025-12-20',
      },
    ];

    const suppliers: Supplier[] = [
      {
        id: 'supp-1',
        name: 'Mersaco Wholesale',
        code: 'SUP-001',
        contactPerson: 'Fadi',
        phone: '01888999',
        email: 'fadi@mersaco.com',
        address: 'Dekwaneh Industrial',
        balanceUSD: 1250.0,
        balanceLBP: 111875000,
        paymentTerms: '30_days',
      },
    ];

    OfflineStorage.saveCustomers(customers);
    OfflineStorage.saveSuppliers(suppliers);

    // Ensure customer balances are preserved as opening balances
    const retrievedCusts = OfflineStorage.getCustomers();
    expect(retrievedCusts[0].balanceUSD).toBe(145.5);
    expect(retrievedCusts[0].balanceLBP).toBe(13022250);

    // Ensure supplier balances are preserved as opening balances
    const retrievedSupps = OfflineStorage.getSuppliers();
    expect(retrievedSupps[0].balanceUSD).toBe(1250.0);
    expect(retrievedSupps[0].balanceLBP).toBe(111875000);
  });

  it('includes closedYears in full backup JSON and restores successfully', async () => {
    const closedRecord: YearClosingRecord = {
      year: 2024,
      closedAt: 1735689600000,
      closedDate: '2025-01-01T00:00:00.000Z',
      closedBy: 'Admin',
      note: '2024 Final Closing',
      summary: {
        salesCount: 50,
        totalSalesUSD: 2000,
        totalSalesLBP: 179000000,
        purchasesCount: 10,
        totalPurchasesUSD: 1200,
        totalPurchasesLBP: 107400000,
        expensesCount: 5,
        totalExpensesUSD: 100,
        totalExpensesLBP: 8950000,
        customerPaymentsCount: 5,
        supplierPaymentsCount: 3,
        productsCount: 150,
        inventoryValuationUSD: 5000,
        inventoryValuationLBP: 447500000,
        customersCount: 20,
        suppliersCount: 5,
      },
    };

    OfflineStorage.saveClosedYears([closedRecord]);

    const backupJson = await OfflineStorage.exportFullBackup();
    const parsed = JSON.parse(backupJson);
    expect(parsed.closedYears).toBeDefined();
    expect(parsed.closedYears).toHaveLength(1);
    expect(parsed.closedYears[0].year).toBe(2024);

    // Clear and restore
    localStorage.clear();
    expect(OfflineStorage.getClosedYears()).toEqual([]);

    await OfflineStorage.restoreFullBackup(backupJson);
    expect(OfflineStorage.getClosedYears()).toHaveLength(1);
    expect(OfflineStorage.getClosedYears()[0].year).toBe(2024);
  });
});
