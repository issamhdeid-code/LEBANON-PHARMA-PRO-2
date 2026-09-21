import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { OfflineStorage } from './storage';

describe('OfflineStorage Backup & Restore', () => {
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

  it('exports and restores a valid full backup', async () => {
    const json = await OfflineStorage.exportFullBackup();
    expect(json).toBeDefined();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed.products)).toBe(true);
    expect(parsed.settings).toBeDefined();

    const ok = await OfflineStorage.restoreFullBackup(json);
    expect(ok).toBe(true);
  });

  it('restores backup with version 2.0.0 even without schemaVersion field', async () => {
    const json = await OfflineStorage.exportFullBackup();
    const obj = JSON.parse(json);
    delete obj.schemaVersion;
    obj.version = '2.0.0';

    const ok = await OfflineStorage.restoreFullBackup(JSON.stringify(obj));
    expect(ok).toBe(true);
  });

  it('restores supplier payments and customer payments accurately', async () => {
    const json = await OfflineStorage.exportFullBackup();
    const obj = JSON.parse(json);
    obj.supplierPayments = [
      { id: 'sp-test-1', supplierId: 'sup-1', amountUSD: 250, date: '2026-09-20' },
    ];
    obj.customerPayments = [
      { id: 'cp-test-1', customerId: 'cust-1', amountUSD: 120, date: '2026-09-20' },
    ];

    const ok = await OfflineStorage.restoreFullBackup(JSON.stringify(obj));
    expect(ok).toBe(true);

    const supPayments = OfflineStorage.getSupplierPayments();
    expect(supPayments.length).toBe(1);
    expect(supPayments[0].id).toBe('sp-test-1');

    const custPayments = OfflineStorage.getCustomerPayments();
    expect(custPayments.length).toBe(1);
    expect(custPayments[0].id).toBe('cp-test-1');
  });

  it('rejects corrupt or completely invalid payload', async () => {
    const ok = await OfflineStorage.restoreFullBackup('not-a-json-string');
    expect(ok).toBe(false);

    const ok2 = await OfflineStorage.restoreFullBackup(JSON.stringify({ random: 'data' }));
    expect(ok2).toBe(false);
  });
});
