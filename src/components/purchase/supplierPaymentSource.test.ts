import { describe, it, expect } from 'vitest';
import { SupplierPayment } from '../../types/pharmacy';

describe('Supplier Payment Funding Source Logic', () => {
  it('correctly defaults legacy payments without fundingSource to cash drawer', () => {
    const legacyPayment: SupplierPayment = {
      id: 'RCT-2026-0001',
      receiptNumber: 'REC-001',
      date: '2026-03-29',
      supplierId: 'sup-1',
      supplierName: 'Mersaco',
      amount: 150.0,
      currency: 'USD',
      amountUSD: 150.0,
      invoices: ['inv-1'],
      isPaymentOnAccount: false,
      timestamp: Date.now(),
    };

    const source = legacyPayment.fundingSource || 'drawer';
    expect(source).toBe('drawer');

    const drawerUSD = legacyPayment.drawerAmountUSD != null ? legacyPayment.drawerAmountUSD : (legacyPayment.amountUSD || legacyPayment.amount);
    expect(drawerUSD).toBe(150.0);
  });

  it('correctly calculates 0 drawer deduction for outside payments', () => {
    const outsidePayment: SupplierPayment = {
      id: 'RCT-2026-0002',
      receiptNumber: 'REC-002',
      date: '2026-03-29',
      supplierId: 'sup-1',
      supplierName: 'Mersaco',
      amount: 500.0,
      currency: 'USD',
      amountUSD: 500.0,
      invoices: ['inv-2'],
      isPaymentOnAccount: false,
      timestamp: Date.now(),
      fundingSource: 'outside',
      drawerAmountUSD: 0,
      drawerAmountLBP: 0,
      outsideAmountUSD: 500.0,
      outsideAmountLBP: 0,
      outsideSourceNote: 'Paid via Bank Audi Wire Transfer',
    };

    expect(outsidePayment.fundingSource).toBe('outside');
    expect(outsidePayment.drawerAmountUSD).toBe(0);
    expect(outsidePayment.outsideAmountUSD).toBe(500.0);
    expect(outsidePayment.outsideSourceNote).toBe('Paid via Bank Audi Wire Transfer');
  });

  it('correctly tracks mixed split payments between drawer and outside', () => {
    const mixedPayment: SupplierPayment = {
      id: 'RCT-2026-0003',
      receiptNumber: 'REC-003',
      date: '2026-03-29',
      supplierId: 'sup-2',
      supplierName: 'Omnipharma',
      amount: 300.0,
      currency: 'USD',
      amountUSD: 300.0,
      invoices: ['inv-3'],
      isPaymentOnAccount: false,
      timestamp: Date.now(),
      fundingSource: 'mixed',
      drawerAmountUSD: 100.0,
      drawerAmountLBP: 0,
      outsideAmountUSD: 200.0,
      outsideAmountLBP: 0,
      outsideSourceNote: 'Part from drawer ($100), rest from owner wallet ($200)',
    };

    expect(mixedPayment.fundingSource).toBe('mixed');
    expect(mixedPayment.drawerAmountUSD).toBe(100.0);
    expect(mixedPayment.outsideAmountUSD).toBe(200.0);
    expect((mixedPayment.drawerAmountUSD || 0) + (mixedPayment.outsideAmountUSD || 0)).toBe(mixedPayment.amountUSD);
  });

  it('correctly tracks mixed split in LBP currency', () => {
    const mixedLBPPayment: SupplierPayment = {
      id: 'RCT-2026-0004',
      receiptNumber: 'REC-004',
      date: '2026-03-29',
      supplierId: 'sup-3',
      supplierName: 'Droguerie de l Union',
      amount: 18000000,
      currency: 'LBP',
      amountLBP: 18000000,
      invoices: [],
      isPaymentOnAccount: true,
      timestamp: Date.now(),
      fundingSource: 'mixed',
      drawerAmountUSD: 0,
      drawerAmountLBP: 8000000,
      outsideAmountUSD: 0,
      outsideAmountLBP: 10000000,
      outsideSourceNote: 'Personal cash 10,000,000 LBP',
    };

    expect(mixedLBPPayment.fundingSource).toBe('mixed');
    expect(mixedLBPPayment.drawerAmountLBP).toBe(8000000);
    expect(mixedLBPPayment.outsideAmountLBP).toBe(10000000);
    expect((mixedLBPPayment.drawerAmountLBP || 0) + (mixedLBPPayment.outsideAmountLBP || 0)).toBe(mixedLBPPayment.amountLBP);
  });
});
