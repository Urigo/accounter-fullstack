import { TIMELESS_DATE_REGEX } from '../../shared/constants.js';

/**
 * Convert ISO date string to Date object
 *
 * @param dateString - ISO 8601 date string (YYYY-MM-DD or full ISO timestamp)
 * @returns Date object
 *
 * @remarks
 * - Accepts both date-only (YYYY-MM-DD) and full ISO timestamps
 * - Date-only strings are parsed as UTC midnight to avoid timezone issues
 * - Full timestamps preserve timezone information
 *
 * @throws {Error} If dateString is invalid or cannot be parsed
 *
 * @example
 * ```typescript
 * // Date-only (parsed as UTC midnight)
 * const date1 = iso('2024-01-15'); // 2024-01-15T00:00:00.000Z
 *
 * // Full timestamp
 * const date2 = iso('2024-01-15T14:30:00Z'); // 2024-01-15T14:30:00.000Z
 * const date3 = iso('2024-01-15T14:30:00+02:00'); // With timezone offset
 * ```
 */
export function iso(dateString: string): Date {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error('Invalid date string: must be a non-empty string');
  }

  const trimmed = dateString.trim();
  if (!trimmed) {
    throw new Error('Invalid date string: must not be empty or whitespace');
  }

  // Check if it's a date-only string (YYYY-MM-DD)
  // TIMELESS_DATE_REGEX is very strict (validates real dates), so also check basic format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    // Parse as UTC midnight to avoid timezone conversion
    const [year, month, day] = trimmed.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // Validate that the date is valid and matches input
    if (
      isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Error(`Invalid date string: ${dateString}`);
    }

    // Additional validation using strict TIMELESS_DATE_REGEX (validates real calendar dates)
    if (!TIMELESS_DATE_REGEX.test(trimmed)) {
      throw new Error(`Invalid date string: ${dateString}`);
    }

    return date;
  }

  // For full ISO timestamps, use standard parsing
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }

  return date;
}

/**
 * Get current date as ISO string (YYYY-MM-DD)
 *
 * @returns ISO date string in YYYY-MM-DD format
 *
 * @example
 * ```typescript
 * const today = isoToday(); // '2024-01-15'
 * ```
 */
export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Add days to an ISO date string
 *
 * @param dateString - ISO date string (YYYY-MM-DD)
 * @param days - Number of days to add (can be negative)
 * @returns New ISO date string (YYYY-MM-DD)
 *
 * @example
 * ```typescript
 * const tomorrow = addDays('2024-01-15', 1); // '2024-01-16'
 * const yesterday = addDays('2024-01-15', -1); // '2024-01-14'
 * ```
 */
export function addDays(dateString: string, days: number): string {
  const date = iso(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
