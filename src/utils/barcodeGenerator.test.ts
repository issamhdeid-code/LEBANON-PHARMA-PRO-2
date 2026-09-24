import { describe, it, expect } from 'vitest';
import { encodeCode128B, CODE128_PATTERNS } from './barcodeGenerator';

describe('Barcode Generator (Code 128-B)', () => {
  it('has 107 valid Code 128 patterns summing to standard module lengths', () => {
    expect(CODE128_PATTERNS.length).toBe(107);

    // First 106 patterns must sum to 11 modules
    for (let i = 0; i < 106; i++) {
      const sum = CODE128_PATTERNS[i].split('').reduce((acc, c) => acc + parseInt(c, 10), 0);
      expect(sum).toBe(11);
    }

    // Stop pattern (106) must sum to 13 modules
    const stopSum = CODE128_PATTERNS[106].split('').reduce((acc, c) => acc + parseInt(c, 10), 0);
    expect(stopSum).toBe(13);
  });

  it('encodes standard alphanumeric medication code', () => {
    const result = encodeCode128B('PAN-500', 1.5, 10);
    expect(result).toBeDefined();
    expect(result.cleanText).toBe('PAN-500');
    expect(result.rects.length).toBeGreaterThan(0);
    expect(result.totalWidth).toBeGreaterThan(100);

    // Verify all rect coordinates are positive and non-overlapping
    for (let i = 0; i < result.rects.length; i++) {
      expect(result.rects[i].x).toBeGreaterThanOrEqual(15); // quiet zone 10 * 1.5
      expect(result.rects[i].width).toBeGreaterThan(0);
      if (i > 0) {
        expect(result.rects[i].x).toBeGreaterThan(result.rects[i - 1].x);
      }
    }
  });

  it('encodes 13-digit EAN-13 style retail barcodes', () => {
    const ean = '2001234567890';
    const result = encodeCode128B(ean, 1.2, 8);
    expect(result.cleanText).toBe(ean);
    expect(result.rects.length).toBeGreaterThan(20);
    expect(result.totalWidth).toBeGreaterThan(result.rects[result.rects.length - 1].x);
  });

  it('gracefully handles empty string and falls back without crashing', () => {
    const emptyResult = encodeCode128B('', 1.5, 10);
    expect(emptyResult.cleanText).toBe('000000');
    expect(emptyResult.rects.length).toBeGreaterThan(0);

    const spaceResult = encodeCode128B('   ', 1.5, 10);
    expect(spaceResult.cleanText).toBe('000000');
  });

  it('filters non-ASCII characters cleanly', () => {
    const mixed = 'Med-100™✓';
    const result = encodeCode128B(mixed, 1.5, 10);
    expect(result.cleanText).toBe('Med-100');
  });
});
