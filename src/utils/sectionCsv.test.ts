import { describe, it, expect } from 'vitest';
import {
  parseSectionCsv,
  exportSectionCsv,
  SECTION_HEADERS,
} from './sectionCsv';

describe('sectionCsv', () => {
  it('exports then re-imports an expense record round-trip', () => {
    const expense = {
      id: 'exp-1',
      expenseNumber: 'EXP-26-001',
      date: '2026-09-18',
      title: 'Generator fuel',
      category: 'generator_fuel',
      payee: 'Fuel Co',
      amount: 200,
      currency: 'USD',
      amountUSD: 200,
      amountLBP: 17800000,
      exchangeRate: 89000,
      paidFromDrawer: true,
      timestamp: 1780000000000,
    };
    const csv = exportSectionCsv('expenses', [expense]);
    expect(csv).toContain(SECTION_HEADERS.expenses.join(','));
    const { records, errors } = parseSectionCsv('expenses', csv);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    const parsed = records[0] as typeof expense;
    expect(parsed.id).toBe('exp-1');
    expect(parsed.expenseNumber).toBe('EXP-26-001');
    expect(parsed.date).toBe('2026-09-18');
    expect(parsed.category).toBe('generator_fuel');
    expect(parsed.amount).toBe(200);
    expect(parsed.paidFromDrawer).toBe(true);
  });

  it('preserves JSON complex columns for sale items', () => {
    const sale = {
      id: 'sale-1',
      invoiceNumber: 'INV-26-0001',
      date: '2026-01-02',
      timestamp: 1780000000000,
      items: [
        { productId: 'p1', productCode: 'A1', productName: 'Panadol', quantity: 2, unitPriceUSD: 1.5, unitPriceLBP: 133500, costPriceUSD: 1, totalUSD: 3, totalLBP: 267000, category: 'drug' as const },
      ],
      totalUSD: 3,
      totalLBP: 267000,
      exchangeRate: 89000,
      cashierId: 'u1',
      cashierName: 'Pharmacist',
      paymentMethod: 'cash_lbp' as const,
      amountPaidUSD: 0,
      amountPaidLBP: 267000,
      changeGivenUSD: 0,
      changeGivenLBP: 0,
      synced: false,
      isUnreal: false,
    };
    const csv = exportSectionCsv('sales', [sale]);
    const { records, errors } = parseSectionCsv('sales', csv);
    expect(errors).toEqual([]);
    const parsed = records[0] as { items: { productId: string; quantity: number }[] };
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].productId).toBe('p1');
    expect(parsed.items[0].quantity).toBe(2);
  });

  it('parses pipe-separated invoices list on supplier payments', () => {
    const payment = {
      id: 'sp-1',
      receiptNumber: 'SP-1',
      date: '2026-03-04',
      timestamp: 1780000000000,
      supplierId: 'sup-1',
      supplierName: 'PharmaDist',
      amount: 100,
      currency: 'USD',
      amountUSD: 100,
      amountLBP: 0,
      invoices: ['PINV-26-0001', 'PINV-26-0002'],
      allocations: [{ invoiceId: 'PINV-26-0001', amountUSD: 50, amountLBP: 0 }],
      isPaymentOnAccount: false,
      fundingSource: 'drawer',
    };
    const csv = exportSectionCsv('supplierPayments', [payment]);
    const { records, errors } = parseSectionCsv('supplierPayments', csv);
    expect(errors).toEqual([]);
    const parsed = records[0] as { invoices: string[]; allocations: { invoiceId: string }[] };
    expect(parsed.invoices).toEqual(['PINV-26-0001', 'PINV-26-0002']);
    expect(parsed.allocations).toHaveLength(1);
    expect(parsed.allocations[0].invoiceId).toBe('PINV-26-0001');
  });

  it('reports a missing id column as a warning but still imports the row', () => {
    const csv = 'invoiceNumber,date,totalCostUSD,totalCostLBP\ndupe-1,2026-05-01,10,0\n';
    const { records, errors } = parseSectionCsv('purchases', csv);
    expect(records).toHaveLength(1);
    expect(errors.some(e => e.includes('missing "id"'))).toBe(true);
  });

  it('handles quoted commas and newlines in text fields via escapeCsvCell', () => {
    const csv = 'id,expenseNumber,date,title,category,payee,amount,currency,amountUSD,amountLBP,exchangeRate,paidFromDrawer,paidBy,receiptRef,notes,timestamp\n' +
      '"exp-2",EXP-26-002,2026-06-01,"Repair, urgent","maintenance","""Bob"" & Co",50,USD,50,0,89000,false,Joe,RC-1,"multi\nline",1780000000000\n';
    const { records, errors } = parseSectionCsv('expenses', csv);
    expect(errors).toEqual([]);
    expect(records).toHaveLength(1);
    const parsed = records[0] as { title: string; payee: string; notes: string };
    expect(parsed.title).toBe('Repair, urgent');
    expect(parsed.payee).toBe('"Bob" & Co');
    expect(parsed.notes).toBe('multi\nline');
  });

  describe('sale items are normalised to the SaleTransaction items contract', () => {
    const itemsCsv = (itemsJson: string) =>
      `id,invoiceNumber,date,timestamp,items,totalUSD,totalLBP\n` +
      `s-1,INV-1,2026-02-03,1780000000000,"${itemsJson.replace(/"/g, '""')}",10,900000\n`;

    it('accepts a hand-written CSV that uses code/name/priceUSD instead of the canonical keys', () => {
      // This is the exact shape that crashed EditSaleModal: no unitPriceUSD, so the modal's
      // .toFixed() threw and the whole sale row became un-editable.
      const csv = itemsCsv(JSON.stringify([
        { productId: 'p1', code: 'A1', name: 'Panadol', quantity: 5, priceUSD: 12.5, totalUSD: 62.5 },
      ]));
      const { records, errors } = parseSectionCsv('sales', csv);
      expect(errors).toEqual([]);
      const item = (records[0] as { items: Record<string, unknown>[] }).items[0];
      expect(item.productCode).toBe('A1');
      expect(item.productName).toBe('Panadol');
      expect(item.unitPriceUSD).toBe(12.5);
      expect(item.totalUSD).toBe(62.5);
      // Every numeric the POS and reports read must be a real number, never undefined.
      for (const k of ['quantity', 'unitPriceUSD', 'unitPriceLBP', 'costPriceUSD', 'totalUSD', 'totalLBP']) {
        expect(typeof item[k]).toBe('number');
      }
    });

    it('leaves already-canonical items unchanged', () => {
      const canonical = {
        productId: 'p1', productCode: 'A1', productName: 'Panadol', category: 'drug',
        quantity: 2, unitPriceUSD: 1.5, unitPriceLBP: 133500, costPriceUSD: 1,
        totalUSD: 3, totalLBP: 267000,
      };
      const { records } = parseSectionCsv('sales', itemsCsv(JSON.stringify([canonical])));
      const item = (records[0] as { items: Record<string, unknown>[] }).items[0];
      for (const [k, v] of Object.entries(canonical)) {
        expect(item[k]).toEqual(v);
      }
    });

    it('derives a missing line total from unit price x quantity', () => {
      const { records } = parseSectionCsv('sales', itemsCsv(JSON.stringify([
        { productId: 'p1', productCode: 'A1', quantity: 3, unitPriceUSD: 2.5 },
      ])));
      const item = (records[0] as { items: Record<string, unknown>[] }).items[0];
      expect(item.totalUSD).toBe(7.5);
    });

    it('derives a missing LBP unit price from the line total and quantity', () => {
      const { records } = parseSectionCsv('sales', itemsCsv(JSON.stringify([
        { productId: 'p1', productCode: 'A1', quantity: 4, totalLBP: 400000 },
      ])));
      const item = (records[0] as { items: Record<string, unknown>[] }).items[0];
      expect(item.unitPriceLBP).toBe(100000);
      expect(item.totalLBP).toBe(400000);
    });

    it('does not divide by zero when quantity is missing or zero', () => {
      const { records } = parseSectionCsv('sales', itemsCsv(JSON.stringify([
        { productId: 'p1', totalLBP: 100000 },
      ])));
      const item = (records[0] as { items: Record<string, unknown>[] }).items[0];
      expect(item.quantity).toBe(0);
      expect(item.unitPriceLBP).toBe(0);
      expect(Number.isFinite(item.totalLBP as number)).toBe(true);
    });

    it('keeps nested batch data, which is already an array rather than a JSON string', () => {
      // parseJsonArray stringifies before parsing, so an inline array would be lost if the
      // normaliser routed it through that helper.
      const { records } = parseSectionCsv('sales', itemsCsv(JSON.stringify([
        { productId: 'p1', productCode: 'A1', quantity: 2, unitPriceUSD: 1, totalUSD: 2,
          batches: [{ batchNumber: 'B1', expiryDate: '2027-01-01', quantity: 5 }] },
      ])));
      const item = (records[0] as { items: { batches: unknown[] }[] }).items[0];
      expect(item.batches).toHaveLength(1);
      expect(item.batches[0]).toMatchObject({ batchNumber: 'B1', quantity: 5 });
    });

    it('substitutes placeholders so an item is never nameless or idless', () => {
      const { records } = parseSectionCsv('sales', itemsCsv(JSON.stringify([{ quantity: 1 }])));
      const item = (records[0] as { items: Record<string, unknown>[] }).items[0];
      expect(item.productId).toBe('unknown');
      expect(item.productName).toBe('Unknown Item');
      expect(item.category).toBe('drug');
    });

    it('tolerates a non-object entry in the items array', () => {
      const { records } = parseSectionCsv('sales', itemsCsv(JSON.stringify(['garbage', null, 5])));
      const items = (records[0] as { items: Record<string, unknown>[] }).items;
      expect(items).toHaveLength(3);
      for (const item of items) {
        expect(typeof item.productName).toBe('string');
        expect(typeof item.totalUSD).toBe('number');
      }
    });

    it('leaves an empty items cell as an empty array', () => {
      const { records } = parseSectionCsv('sales', 'id,invoiceNumber,date,timestamp,items\ns-1,INV-1,2026-02-03,1780000000000,\n');
      expect((records[0] as { items: unknown[] }).items).toEqual([]);
    });
  });
});