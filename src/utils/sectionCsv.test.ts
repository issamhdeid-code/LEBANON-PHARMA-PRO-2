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
});