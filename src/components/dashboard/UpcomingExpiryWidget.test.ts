import { describe, it, expect } from 'vitest';
import {
  parseExpiryDateToObj,
  calculateDaysRemaining,
} from './UpcomingExpiryWidget';

describe('UpcomingExpiryWidget utilities', () => {
  describe('parseExpiryDateToObj', () => {
    it('returns null for empty, undefined, or dash', () => {
      expect(parseExpiryDateToObj(undefined)).toBeNull();
      expect(parseExpiryDateToObj('')).toBeNull();
      expect(parseExpiryDateToObj('-')).toBeNull();
    });

    it('parses YYYY-MM-DD correctly', () => {
      const date = parseExpiryDateToObj('2026-10-15');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(9); // 0-indexed (Oct is 9)
      expect(date?.getDate()).toBe(15);
    });

    it('parses MM/YYYY correctly (end of month)', () => {
      const date = parseExpiryDateToObj('10/2026');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(9); // Oct
      expect(date?.getDate()).toBe(31); // Oct has 31 days
    });

    it('parses YYYY-MM correctly (end of month)', () => {
      const date = parseExpiryDateToObj('2026-11');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(10); // Nov
      expect(date?.getDate()).toBe(30); // Nov has 30 days
    });

    it('parses MM/YY 2-digit years correctly', () => {
      const date = parseExpiryDateToObj('05/28');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2028);
      expect(date?.getMonth()).toBe(4); // May
      expect(date?.getDate()).toBe(31);
    });
  });

  describe('calculateDaysRemaining', () => {
    const refDate = new Date(2026, 8, 24); // Sept 24, 2026

    it('returns negative days for past expiry dates', () => {
      const pastDate = new Date(2026, 8, 20); // Sept 20, 2026
      expect(calculateDaysRemaining(pastDate, refDate)).toBe(-4);
    });

    it('returns 0 days for today expiry', () => {
      const todayDate = new Date(2026, 8, 24);
      expect(calculateDaysRemaining(todayDate, refDate)).toBe(0);
    });

    it('calculates exact future days correctly', () => {
      const exp30 = new Date(2026, 9, 24); // Oct 24, 2026 (30 days)
      expect(calculateDaysRemaining(exp30, refDate)).toBe(30);

      const exp60 = new Date(2026, 10, 23); // Nov 23, 2026 (60 days)
      expect(calculateDaysRemaining(exp60, refDate)).toBe(60);

      const exp90 = new Date(2026, 11, 23); // Dec 23, 2026 (90 days)
      expect(calculateDaysRemaining(exp90, refDate)).toBe(90);
    });
  });
});
