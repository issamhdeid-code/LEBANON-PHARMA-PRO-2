import { describe, it, expect } from 'vitest';
import {
  escapeCsvCell,
  getProductStockStatus,
  formatProductPackagingUnits,
  generateStockInventoryCsv,
  STOCK_EXPORT_EXCEL_HEADERS,
} from './stockCsvExport';
import { Product } from '../types/pharmacy';

describe('Stock CSV / Excel Export Utilities', () => {
  it('correctly escapes special characters in CSV cells', () => {
    expect(escapeCsvCell('Simple')).toBe('Simple');
    expect(escapeCsvCell('Item, with comma')).toBe('"Item, with comma"');
    expect(escapeCsvCell('Item with "quotes"')).toBe('"Item with ""quotes"""');
    expect(escapeCsvCell('Line1\nLine2')).toBe('"Line1\nLine2"');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell(100)).toBe('100');
  });

  it('determines product stock status accurately', () => {
    expect(getProductStockStatus(0, 5)).toBe('Out of Stock');
    expect(getProductStockStatus(-2, 5)).toBe('Out of Stock');
    expect(getProductStockStatus(3, 5)).toBe('Low Stock');
    expect(getProductStockStatus(5, 5)).toBe('Low Stock');
    expect(getProductStockStatus(6, 5)).toBe('Normal');
  });

  it('formats packaging units for regular and divisible products', () => {
    const regularProduct = {
      id: '1',
      code: 'REG1',
      name: 'Panadol 500mg',
      priceLBP: 150000,
      priceUSD: 1.67,
      stockQuantity: 10,
      category: 'drug',
      subcategory: 'Analgesics',
      isDivisible: false,
    } as unknown as Product;
    expect(formatProductPackagingUnits(regularProduct)).toBe('10 boxes');

    const divisibleProduct = {
      ...regularProduct,
      isDivisible: true,
      piecesPerBox: 20,
      pieceName: 'tablet',
      stockQuantity: 2.5,
    } as unknown as Product;
    expect(formatProductPackagingUnits(divisibleProduct)).toBe('2 boxes, 10 tablets');
  });

  it('generates well-formatted CSV with headers and row values', () => {
    const mockProducts = [
      {
        id: '1',
        code: 'MED-001',
        barcode: '1234567890123',
        name: 'Amoxicillin 500mg',
        dosage: '500mg',
        form: 'Capsule',
        presentation: 'Box of 20 capsules',
        category: 'drug',
        subcategory: 'Antibiotics',
        priceUSD: 4.5,
        priceLBP: 405000,
        costPriceUSD: 3.2,
        stockQuantity: 15,
        minStockAlert: 5,
        expiryDate: '2026-12-31',
        batchNumber: 'BATCH-2026A',
        agent: 'Mersaco',
        ingredients: 'Amoxicillin Trihydrate',
      },
    ] as unknown as Product[];

    const csv = generateStockInventoryCsv(mockProducts);
    expect(csv).toContain(STOCK_EXPORT_EXCEL_HEADERS.join(','));
    expect(csv).toContain('MED-001');
    expect(csv).toContain('Amoxicillin 500mg');
    expect(csv).toContain('Antibiotics');
    expect(csv).toContain('4.50');
    expect(csv).toContain('405000');
    expect(csv).toContain('Normal');
  });
});
