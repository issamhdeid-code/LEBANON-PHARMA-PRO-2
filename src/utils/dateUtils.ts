/**
 * Utility functions for date and time formatting throughout the application.
 * Requirement: Time must use 12-hour format (hours and minutes only, no seconds).
 */

export interface FormatTimeOptions {
  hour12?: boolean;
  hour?: 'numeric' | '2-digit';
  minute?: '2-digit';
}

/**
 * Formats a given date/timestamp to 12-hour format with only hours and minutes (e.g., "02:30 PM", "10:15 AM").
 * Never includes seconds.
 */
export function formatTime12(
  value: Date | number | string | null | undefined,
  options?: { hour?: 'numeric' | '2-digit' }
): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleTimeString('en-US', {
    hour: options?.hour || '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Alias for formatTime12 to ensure consistent 12-hr time without seconds across the entire app.
 */
export const formatTime = formatTime12;

/**
 * Formats date and time together without seconds, using 12-hour format for the time portion.
 * E.g., "Sep 21, 2026, 02:30 PM"
 */
export function formatDateTime(
  value: Date | number | string | null | undefined,
  options?: { dateStyle?: 'short' | 'medium' | 'long'; hour?: 'numeric' | '2-digit' }
): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';

  const datePart = d.toLocaleDateString('en-US', {
    month: options?.dateStyle === 'short' ? '2-digit' : 'short',
    day: options?.dateStyle === 'short' ? '2-digit' : 'numeric',
    year: 'numeric',
  });

  const timePart = formatTime12(d, { hour: options?.hour });
  return `${datePart}, ${timePart}`;
}

/**
 * Formats date only (e.g., "Sep 21, 2026" or "21/09/2026" depending on locale).
 */
export function formatDate(
  value: Date | number | string | null | undefined,
  locale: string = 'en-US'
): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
