import { describe, it, expect } from 'vitest';
import {
  formatExpiryToMMYYYY,
  parseExpiryDate,
  formatExpiryInput,
  formatExpiryDate,
  getExpiryCursorPosition,
  isProductExpired,
  isFullExpiryInput,
  isExpiryDenied,
} from './PurchaseView';

describe('PurchaseView expiry utilities', () => {
  describe('isFullExpiryInput', () => {
    it('returns false for partial typing', () => {
      expect(isFullExpiryInput('')).toBe(false);
      expect(isFullExpiryInput('0')).toBe(false);
      expect(isFullExpiryInput('05')).toBe(false);
      expect(isFullExpiryInput('05/')).toBe(false);
      expect(isFullExpiryInput('05/2')).toBe(false);
      expect(isFullExpiryInput('05/20')).toBe(false);
      expect(isFullExpiryInput('05/202')).toBe(false);
    });

    it('returns true for completed full inputs', () => {
      expect(isFullExpiryInput('05/2026')).toBe(true);
      expect(isFullExpiryInput('5/2026')).toBe(true);
      expect(isFullExpiryInput('2026-05-31')).toBe(true);
      expect(isFullExpiryInput('052026')).toBe(true);
    });
  });

  describe('isExpiryDenied (non-blocking while typing, denies upon full input)', () => {
    const refDate = new Date(2025, 2, 15, 12, 0, 0); // March 15, 2025

    it('does not deny while typing partial input', () => {
      expect(isExpiryDenied('05', '', false, refDate)).toBe(false);
      expect(isExpiryDenied('05/', '', false, refDate)).toBe(false);
      expect(isExpiryDenied('05/20', '', false, refDate)).toBe(false);
      expect(isExpiryDenied('05/202', '', false, refDate)).toBe(false);
    });

    it('denies when full input is expired', () => {
      expect(isExpiryDenied('05/2020', '', false, refDate)).toBe(true);
      expect(isExpiryDenied('01/2025', '', false, refDate)).toBe(true);
    });

    it('accepts when full input is valid future', () => {
      expect(isExpiryDenied('05/2026', '', false, refDate)).toBe(false);
      expect(isExpiryDenied('03/2025', '', false, refDate)).toBe(false);
      expect(isExpiryDenied('12/2028', '', false, refDate)).toBe(false);
    });

    it('evaluates 2-digit years on finish (blur / enter)', () => {
      expect(isExpiryDenied('05/24', '2024-05-31', true, refDate)).toBe(true);
      expect(isExpiryDenied('05/28', '2028-05-31', true, refDate)).toBe(false);
    });
  });

  describe('isProductExpired (expired product validation)', () => {
    // Reference date: March 15, 2025
    const refDate = new Date(2025, 2, 15, 12, 0, 0);

    it('returns false for empty, undefined, or dash', () => {
      expect(isProductExpired(undefined, refDate)).toBe(false);
      expect(isProductExpired('', refDate)).toBe(false);
      expect(isProductExpired('-', refDate)).toBe(false);
      expect(isProductExpired('   ', refDate)).toBe(false);
    });

    it('returns true for past years (MM/YYYY)', () => {
      expect(isProductExpired('05/2020', refDate)).toBe(true);
      expect(isProductExpired('12/2024', refDate)).toBe(true);
      expect(isProductExpired('01/2025', refDate)).toBe(true);
      expect(isProductExpired('02/2025', refDate)).toBe(true);
    });

    it('returns false for current month or future dates (MM/YYYY)', () => {
      // In pharmacy practice, 03/2025 expires at end of March 2025, so on March 15 it is still valid
      expect(isProductExpired('03/2025', refDate)).toBe(false);
      expect(isProductExpired('04/2025', refDate)).toBe(false);
      expect(isProductExpired('12/2026', refDate)).toBe(false);
      expect(isProductExpired('05/2028', refDate)).toBe(false);
    });

    it('handles 2-digit years MM/YY correctly', () => {
      expect(isProductExpired('05/20', refDate)).toBe(true);
      expect(isProductExpired('01/25', refDate)).toBe(true);
      expect(isProductExpired('03/25', refDate)).toBe(false);
      expect(isProductExpired('06/28', refDate)).toBe(false);
    });

    it('handles ISO dates YYYY-MM-DD correctly', () => {
      expect(isProductExpired('2024-12-31', refDate)).toBe(true);
      expect(isProductExpired('2025-03-01', refDate)).toBe(true);
      expect(isProductExpired('2025-03-20', refDate)).toBe(false);
      expect(isProductExpired('2028-05-31', refDate)).toBe(false);
    });
  });
  describe('formatExpiryInput (automatic slash insertion)', () => {
    it('appends slash when typing 2-digit month 01-12', () => {
      expect(formatExpiryInput('05', '0')).toBe('05/');
      expect(formatExpiryInput('12', '1')).toBe('12/');
      expect(formatExpiryInput('01', '0')).toBe('01/');
    });

    it('auto-formats single digits 2-9 with leading zero and slash', () => {
      expect(formatExpiryInput('5', '')).toBe('05/');
      expect(formatExpiryInput('9', '')).toBe('09/');
      expect(formatExpiryInput('2', '')).toBe('02/');
    });

    it('keeps single digit 0 or 1 without immediate slash so user can complete 10, 11, 12, etc.', () => {
      expect(formatExpiryInput('0', '')).toBe('0');
      expect(formatExpiryInput('1', '')).toBe('1');
    });

    it('allows typing a slash or delimiter after single digit 1 or 2-9 to complete the month', () => {
      expect(formatExpiryInput('1/', '1')).toBe('01/');
      expect(formatExpiryInput('1.', '1')).toBe('01/');
      expect(formatExpiryInput('1-', '1')).toBe('01/');
      expect(formatExpiryInput('5/', '5')).toBe('05/');
      expect(formatExpiryInput('01/', '01')).toBe('01/');
      expect(formatExpiryInput('12/', '12')).toBe('12/');
    });

    it('formats month and year as MM/YYYY while typing digits', () => {
      expect(formatExpiryInput('052', '05/')).toBe('05/2');
      expect(formatExpiryInput('0520', '05/2')).toBe('05/20');
      expect(formatExpiryInput('05202', '05/20')).toBe('05/202');
      expect(formatExpiryInput('052028', '05/202')).toBe('05/2028');
      expect(formatExpiryInput('0528', '05/2')).toBe('05/28');
    });

    it('handles ISO date pasting cleanly', () => {
      expect(formatExpiryInput('2028-05-31', '')).toBe('05/2028');
    });

    it('caps maximum input to 6 digits (MM/YYYY)', () => {
      expect(formatExpiryInput('05202899', '05/2028')).toBe('05/2028');
    });

    it('allows deleting the slash on backspace without re-adding it', () => {
      // User pressed backspace on "05/" so raw input is "05"
      expect(formatExpiryInput('05', '05/', true)).toBe('05');
    });

    it('clears when input is empty', () => {
      expect(formatExpiryInput('', '05/')).toBe('');
    });
  });

  describe('parseExpiryDate', () => {
    it('parses MM/YYYY format and returns full ISO date', () => {
      const parsed = parseExpiryDate('05/2028');
      expect(parsed).not.toBeNull();
      expect(parsed?.mm).toBe('05');
      expect(parsed?.yyyy).toBe('2028');
      expect(parsed?.fullDate).toBe('2028-05-31');
    });

    it('parses 2-digit year MM/YY format to 20YY', () => {
      const parsed = parseExpiryDate('05/28');
      expect(parsed).not.toBeNull();
      expect(parsed?.mm).toBe('05');
      expect(parsed?.yyyy).toBe('2028');
      expect(parsed?.fullDate).toBe('2028-05-31');
    });

    it('parses single digit month 5/2028', () => {
      const parsed = parseExpiryDate('5/2028');
      expect(parsed).not.toBeNull();
      expect(parsed?.mm).toBe('05');
      expect(parsed?.yyyy).toBe('2028');
      expect(parsed?.fullDate).toBe('2028-05-31');
    });

    it('parses formats with dots or hyphens like 05.2028 and 05-28', () => {
      const p1 = parseExpiryDate('05.2028');
      expect(p1?.mm).toBe('05');
      expect(p1?.yyyy).toBe('2028');
      expect(p1?.fullDate).toBe('2028-05-31');

      const p2 = parseExpiryDate('05-28');
      expect(p2?.mm).toBe('05');
      expect(p2?.yyyy).toBe('2028');
      expect(p2?.fullDate).toBe('2028-05-31');
    });

    it('parses raw digits 052028 and 0528', () => {
      const p1 = parseExpiryDate('052028');
      expect(p1?.mm).toBe('05');
      expect(p1?.yyyy).toBe('2028');

      const p2 = parseExpiryDate('0528');
      expect(p2?.mm).toBe('05');
      expect(p2?.yyyy).toBe('2028');
    });

    it('parses ISO dates YYYY-MM-DD', () => {
      const parsed = parseExpiryDate('2029-08-31');
      expect(parsed?.mm).toBe('08');
      expect(parsed?.yyyy).toBe('2029');
      expect(parsed?.fullDate).toBe('2029-08-31');
    });

    it('returns null for invalid month or year', () => {
      expect(parseExpiryDate('15/2028')).toBeNull();
      expect(parseExpiryDate('00/2028')).toBeNull();
      expect(parseExpiryDate('abc')).toBeNull();
    });
  });

  describe('formatExpiryToMMYYYY & formatExpiryDate', () => {
    it('formats ISO dates YYYY-MM-DD into MM/YYYY', () => {
      expect(formatExpiryToMMYYYY('2028-04-15')).toBe('04/2028');
      expect(formatExpiryDate('2028-04-15')).toBe('04/2028');
    });

    it('formats YYYY-MM into MM/YYYY', () => {
      expect(formatExpiryToMMYYYY('2028-04')).toBe('04/2028');
      expect(formatExpiryDate('2028-04')).toBe('04/2028');
    });

    it('formats MM/YY into MM/YYYY', () => {
      expect(formatExpiryToMMYYYY('04/28')).toBe('04/2028');
      expect(formatExpiryDate('04/28')).toBe('04/2028');
    });

    it('handles undefined, empty, or "-" gracefully', () => {
      expect(formatExpiryDate(undefined)).toBe('-');
      expect(formatExpiryDate('')).toBe('-');
      expect(formatExpiryDate('-')).toBe('-');
    });
  });

  describe('editing month when year exists', () => {
    it('preserves single-digit month while user is actively typing', () => {
      expect(formatExpiryInput('1/2028', '05/2028', false)).toBe('1/2028');
      expect(formatExpiryInput('11/2028', '1/2028', false)).toBe('11/2028');
    });

    it('preserves single-digit month on backspace/deletion', () => {
      expect(formatExpiryInput('5/2028', '05/2028', true)).toBe('5/2028');
      expect(formatExpiryInput('0/2028', '05/2028', true)).toBe('0/2028');
    });

    it('keeps year when month is temporarily deleted', () => {
      expect(formatExpiryInput('/2028', '05/2028', true)).toBe('/2028');
    });
  });

  describe('getExpiryCursorPosition (cursor preservation)', () => {
    it('keeps cursor in month when typing first digit of month', () => {
      // User typed "1" into "/2028", cursor was at 1
      const pos = getExpiryCursorPosition('/2028', '1/2028', 1, '1/2028', false);
      expect(pos).toBe(1);
    });

    it('advances past slash when finishing 2-digit month', () => {
      // User typed "2" after "1", cursor was at 2 in "12/2028"
      const pos = getExpiryCursorPosition('1/2028', '12/2028', 2, '12/2028', false);
      expect(pos).toBe(3);
    });

    it('positions after slash when single digit month (2-9) is auto-padded with zero', () => {
      // User typed "8" into "/2028", rawVal was "8/2028" (rawCursor 1), formatted to "08/2028"
      const pos = getExpiryCursorPosition('/2028', '8/2028', 1, '08/2028', false);
      expect(pos).toBe(3); // Right after "08/" ready for year, NOT at end of year (7)
    });

    it('preserves cursor at beginning when backspacing first month digit', () => {
      // User backspaced "0" in "05/2028", rawVal is "5/2028", cursor is 0
      const pos = getExpiryCursorPosition('05/2028', '5/2028', 0, '5/2028', true);
      expect(pos).toBe(0);
    });

    it('preserves cursor in month when backspacing second month digit', () => {
      // User backspaced "5" in "05/2028", rawVal is "0/2028", cursor is 1
      const pos = getExpiryCursorPosition('05/2028', '0/2028', 1, '0/2028', true);
      expect(pos).toBe(1);
    });

    it('does not jump to end of year when editing month', () => {
      // Editing month should NEVER return index 7 (last digit of year)
      const pos1 = getExpiryCursorPosition('05/2028', '1/2028', 1, '1/2028', false);
      expect(pos1).toBe(1);
      const pos2 = getExpiryCursorPosition('05/2028', '5/2028', 0, '5/2028', true);
      expect(pos2).toBe(0);
    });

    it('preserves cursor position when editing year digits', () => {
      // Editing year: "05/2028" -> "05/202" with cursor 6
      const pos = getExpiryCursorPosition('05/2028', '05/202', 6, '05/202', true);
      expect(pos).toBe(6);
    });
  });
});
