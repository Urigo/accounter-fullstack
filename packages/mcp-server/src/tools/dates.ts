import { z } from 'zod';

/**
 * Shared date-validation primitives for tool inputs.
 *
 * Several tools accept bounded `YYYY-MM-DD` date ranges and need the same
 * format check and calendar-date parsing. Keeping these in one place avoids
 * drift between tools (spec §9.1, §9.3).
 */

/** Milliseconds in a day — used to measure date-range widths. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** A strict `YYYY-MM-DD` string. Format-only; use {@link parseCalendarDate} to
 * confirm the value is a real calendar date. */
export const TIMELESS_DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

/**
 * Parse a strict `YYYY-MM-DD` string to a UTC timestamp, or `null` if it is not a
 * real calendar date. `Date.parse` alone is unsafe here: it silently rolls
 * impossible dates over (e.g. `2026-02-31` → `2026-03-03`) instead of failing, so
 * we verify the parsed components round-trip back to the input.
 */
export function parseCalendarDate(value: string): number | null {
  const [year, month, day] = value.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp;
}
