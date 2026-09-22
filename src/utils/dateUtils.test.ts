import { describe, it, expect } from 'vitest';
import { formatTime, formatTime12, formatDateTime } from './dateUtils';

describe('dateUtils', () => {
  it('formats time in 12-hour format without seconds (morning)', () => {
    // 09:15:45 AM
    const date = new Date(2026, 8, 21, 9, 15, 45);
    const result = formatTime(date);
    expect(result).toMatch(/09:15\s*AM/);
    expect(result).not.toContain('45'); // no seconds
  });

  it('formats time in 12-hour format without seconds (afternoon/evening)', () => {
    // 14:30:59 PM (2:30 PM)
    const date = new Date(2026, 8, 21, 14, 30, 59);
    const result = formatTime(date);
    expect(result).toMatch(/02:30\s*PM/);
    expect(result).not.toContain('59'); // no seconds
  });

  it('handles midnight correctly (12:00 AM)', () => {
    const date = new Date(2026, 8, 21, 0, 0, 0);
    const result = formatTime(date);
    expect(result).toMatch(/12:00\s*AM/);
  });

  it('handles noon correctly (12:00 PM)', () => {
    const date = new Date(2026, 8, 21, 12, 0, 0);
    const result = formatTime(date);
    expect(result).toMatch(/12:00\s*PM/);
  });

  it('formats date and time together without seconds', () => {
    const date = new Date(2026, 8, 21, 15, 45, 30);
    const result = formatDateTime(date);
    expect(result).toContain('2026');
    expect(result).toMatch(/03:45\s*PM/);
    expect(result).not.toContain('30'); // no seconds
  });

  it('handles null, undefined, or invalid dates gracefully', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
    expect(formatTime('invalid-date')).toBe('');
    expect(formatDateTime(null)).toBe('');
  });
});
