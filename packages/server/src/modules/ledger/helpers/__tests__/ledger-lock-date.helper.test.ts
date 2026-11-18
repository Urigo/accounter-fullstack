import { describe, expect, it } from 'vitest';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import { isLedgerDateLocked, isYearLocked } from '../ledger-lock-date.helper.js';

const d = (date: string) => date as TimelessDateString;

describe('isYearLocked', () => {
  it('is not locked when there is no lock date', () => {
    expect(isYearLocked(d('2025-12-31'), undefined)).toBe(false);
  });

  it('is locked when the lock date is the year-end', () => {
    expect(isYearLocked(d('2025-12-31'), d('2025-12-31'))).toBe(true);
  });

  it('is locked when the lock date is after the year-end', () => {
    expect(isYearLocked(d('2025-12-31'), d('2026-03-31'))).toBe(true);
  });

  it('is not locked when the lock date is before the year-end', () => {
    expect(isYearLocked(d('2025-12-31'), d('2025-12-30'))).toBe(false);
    expect(isYearLocked(d('2025-12-31'), d('2024-12-31'))).toBe(false);
  });

  it('uses the year-end whatever date in the year is passed', () => {
    expect(isYearLocked(d('2025-01-01'), d('2025-12-31'))).toBe(true);
    expect(isYearLocked(d('2025-01-01'), d('2025-06-30'))).toBe(false);
  });
});

describe('isLedgerDateLocked', () => {
  it('is locked when any date is on or before the lock date', () => {
    expect(isLedgerDateLocked(d('2025-12-31'), d('2026-01-05'), d('2025-12-31'))).toBe(true);
    expect(isLedgerDateLocked(d('2025-12-31'), d('2025-06-01'), null)).toBe(true);
  });

  it('is not locked when all dates are after the lock date', () => {
    expect(isLedgerDateLocked(d('2025-12-31'), d('2026-01-01'), d('2026-01-02'))).toBe(false);
  });

  it('ignores missing dates', () => {
    expect(isLedgerDateLocked(d('2025-12-31'), null, undefined)).toBe(false);
  });
});
