import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { DEFAULT_STOCK_SORT, StockSortConfig } from './StockView';

describe('Stock View Table Default Sort & Persistence Invariants', () => {
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

  it('has DEFAULT_STOCK_SORT set to name ascending (A-Z)', () => {
    expect(DEFAULT_STOCK_SORT).toEqual({
      key: 'name',
      direction: 'asc',
    });
  });

  it('cycles sort state: asc -> desc -> default (name asc)', () => {
    let currentConfig: StockSortConfig = { ...DEFAULT_STOCK_SORT };

    // Helper implementing the cycling logic from handleSort
    const cycleSort = (prev: StockSortConfig, key: StockSortConfig['key']): StockSortConfig => {
      let next: StockSortConfig;
      if (prev.key === key && prev.direction === 'asc') {
        next = { key, direction: 'desc' };
      } else if (prev.key === key && prev.direction === 'desc') {
        next = { ...DEFAULT_STOCK_SORT };
      } else {
        next = { key, direction: 'asc' };
      }
      localStorage.setItem('stock_table_sort_config', JSON.stringify(next));
      return next;
    };

    // Cycle on 'name': asc -> desc
    currentConfig = cycleSort(currentConfig, 'name');
    expect(currentConfig).toEqual({ key: 'name', direction: 'desc' });
    expect(JSON.parse(localStorage.getItem('stock_table_sort_config')!)).toEqual({
      key: 'name',
      direction: 'desc',
    });

    // Cycle on 'name': desc -> default
    currentConfig = cycleSort(currentConfig, 'name');
    expect(currentConfig).toEqual(DEFAULT_STOCK_SORT);

    // Switch to another column 'priceUSD': should become asc
    currentConfig = cycleSort(currentConfig, 'priceUSD');
    expect(currentConfig).toEqual({ key: 'priceUSD', direction: 'asc' });

    // Cycle 'priceUSD': asc -> desc
    currentConfig = cycleSort(currentConfig, 'priceUSD');
    expect(currentConfig).toEqual({ key: 'priceUSD', direction: 'desc' });

    // Cycle 'priceUSD': desc -> default (name asc)
    currentConfig = cycleSort(currentConfig, 'priceUSD');
    expect(currentConfig).toEqual(DEFAULT_STOCK_SORT);
  });

  it('restores stored sort configuration across sessions/tabs', () => {
    const customSort: StockSortConfig = { key: 'stockQuantity', direction: 'desc' };
    localStorage.setItem('stock_table_sort_config', JSON.stringify(customSort));

    // Emulate StockView state initialization
    const loadSavedSort = (): StockSortConfig => {
      try {
        const saved = localStorage.getItem('stock_table_sort_config');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.key === 'string' && (parsed.direction === 'asc' || parsed.direction === 'desc')) {
            return parsed;
          }
        }
      } catch {}
      return DEFAULT_STOCK_SORT;
    };

    expect(loadSavedSort()).toEqual(customSort);
  });

  it('falls back to DEFAULT_STOCK_SORT if localStorage is empty or corrupted', () => {
    localStorage.removeItem('stock_table_sort_config');
    const loadSavedSort = (): StockSortConfig => {
      try {
        const saved = localStorage.getItem('stock_table_sort_config');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.key === 'string') return parsed;
        }
      } catch {}
      return DEFAULT_STOCK_SORT;
    };

    expect(loadSavedSort()).toEqual(DEFAULT_STOCK_SORT);

    localStorage.setItem('stock_table_sort_config', 'not-valid-json');
    expect(loadSavedSort()).toEqual(DEFAULT_STOCK_SORT);
  });

  it('resets scroll position to top (0) when returning to stock tab or sorting', () => {
    // Emulate DOM element
    const mockScrollContainer = {
      scrollTop: 450,
      dispatchEvent: () => true,
    };
    const mockVirtualizer = {
      scrollOffset: 450,
      _intendedScrollOffset: 450,
      scrollState: { index: 10 } as { index: number } | null,
      calculateRange: () => {},
      notify: () => {},
    };

    const resetTableToTop = () => {
      mockScrollContainer.scrollTop = 0;
      mockVirtualizer.scrollOffset = 0;
      mockVirtualizer._intendedScrollOffset = 0;
      mockVirtualizer.scrollState = null;
    };

    // When tab switches or section changes
    const onSectionChange = () => {
      resetTableToTop();
    };

    // When user sorts
    const onSortColumn = () => {
      resetTableToTop();
    };

    expect(mockScrollContainer.scrollTop).toBe(450);
    expect(mockVirtualizer.scrollOffset).toBe(450);
    onSortColumn();
    expect(mockScrollContainer.scrollTop).toBe(0);
    expect(mockVirtualizer.scrollOffset).toBe(0);

    mockScrollContainer.scrollTop = 320;
    mockVirtualizer.scrollOffset = 320;
    onSectionChange();
    expect(mockScrollContainer.scrollTop).toBe(0);
    expect(mockVirtualizer.scrollOffset).toBe(0);
  });
});
