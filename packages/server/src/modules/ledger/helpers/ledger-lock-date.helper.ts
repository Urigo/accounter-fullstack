import type { TimelessDateString } from '../../../shared/types/index.js';

/**
 * Whether a ledger date falls in the locked period: on or before the lock date.
 * A record is locked when either its invoice date or its value date is locked.
 */
export function isLedgerDateLocked(
  lockDate: TimelessDateString | null | undefined,
  ...dates: (TimelessDateString | null | undefined)[]
): boolean {
  if (!lockDate) {
    return false;
  }
  return dates.some(date => !!date && date <= lockDate);
}

/**
 * Whether a year-end charge for `year` would post into the locked period.
 * `year` is any date in the year (the client sends the year-end, e.g. `2025-12-31`).
 */
export function isYearLocked(
  year: TimelessDateString,
  lockDate: TimelessDateString | null | undefined,
): boolean {
  return isLedgerDateLocked(lockDate, `${year.substring(0, 4)}-12-31` as TimelessDateString);
}
