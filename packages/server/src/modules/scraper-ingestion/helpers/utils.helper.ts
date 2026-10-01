import { TIMELESS_DATE_REGEX } from '../../../shared/constants.js';
import type { TimelessDateString } from '../../../shared/types/index.js';

export function formatValue(value: unknown, isNumberField: boolean): string {
  if (value === null || value === undefined) return 'null';
  if (isNumberField) {
    const num = Number(value);
    return Number.isNaN(num) ? 'null' : String(num);
  }
  return String(value);
}

/**
 * Takes the calendar date off one of the banks' date strings, for a DATE column.
 *
 * The strings are `2024-01-15`, or a calendar date dressed as an instant —
 * `2024-01-15T00:00:00.0000000+02:00` (Poalim, with the Israel offset of that date) or
 * `2024-01-15T00:00:00` (Max). Postgres reads the leading date when casting one into a DATE
 * column, so this must too: converting through `Date` would shift the day for any server not
 * running on Israel time.
 *
 * Anything whose leading ten characters are not a real calendar date is passed through
 * untouched — including Poalim's `0001-01-01` no-execution sentinel, which is outside the range
 * `TIMELESS_DATE_REGEX` accepts — so Postgres parses or rejects it, as it did before, rather
 * than this helper inventing a date.
 */
export function toCalendarDate(value: string): TimelessDateString {
  const candidate = value.slice(0, 10);
  return (TIMELESS_DATE_REGEX.test(candidate) ? candidate : value) as TimelessDateString;
}

/** `toCalendarDate` for an optional input field, keeping `null`/`undefined` as they are. */
export function toOptionalCalendarDate<T extends null | undefined>(
  value: string | T,
): TimelessDateString | T {
  return value == null ? (value as T) : toCalendarDate(value);
}
