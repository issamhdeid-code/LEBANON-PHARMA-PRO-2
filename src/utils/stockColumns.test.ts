import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STOCK_COL_VISIBILITY,
  ALL_STOCK_COLUMNS,
  STOCK_DATA_COLUMNS,
} from '../components/stock/StockView';

describe('Stock Table Column Visibility Configuration', () => {
  it('defines default visibility as true for all standard columns', () => {
    expect(DEFAULT_STOCK_COL_VISIBILITY).toBeDefined();
    expect(ALL_STOCK_COLUMNS.length).toBe(12);

    for (const col of ALL_STOCK_COLUMNS) {
      expect(DEFAULT_STOCK_COL_VISIBILITY[col.id]).toBe(true);
    }
  });

  it('contains expected core column identifiers', () => {
    const colIds = ALL_STOCK_COLUMNS.map((c) => c.id);
    expect(colIds).toContain('select');
    expect(colIds).toContain('code');
    expect(colIds).toContain('barcode');
    expect(colIds).toContain('name');
    expect(colIds).toContain('presentation');
    expect(colIds).toContain('category');
    expect(colIds).toContain('priceUSD');
    expect(colIds).toContain('priceLBP');
    expect(colIds).toContain('stockQuantity');
    expect(colIds).toContain('expiryDate');
    expect(colIds).toContain('agent');
    expect(colIds).toContain('actions');
  });

  it('provides data column definitions for the inner sortable grid', () => {
    const dataColIds = STOCK_DATA_COLUMNS.map((c) => c.id);
    expect(dataColIds).toContain('code');
    expect(dataColIds).toContain('barcode');
    expect(dataColIds).toContain('name');
    expect(dataColIds).toContain('priceUSD');
    expect(dataColIds).toContain('stockQuantity');
    expect(dataColIds).toContain('expiryDate');
  });
});
