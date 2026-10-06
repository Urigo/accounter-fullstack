import { describe, expect, it } from 'vitest';
import { TEST_TIMEZONES, useTimezone } from '../../../__tests__/helpers/timezones.js';
import type { TimelessDateString } from '../../types/index.js';
import {
  addDaysToTimelessDate,
  addMonthsToTimelessDate,
  addYearsToTimelessDate,
  compareTimelessDates,
  differenceInTimelessDays,
  differenceInTimelessYears,
  endOfTimelessMonth,
  endOfTimelessYear,
  getTimelessDateDay,
  getTimelessDateMonth,
  getTimelessDateYear,
  getTimelessDateYearMonth,
  maxTimelessDate,
  minTimelessDate,
  startOfTimelessMonth,
  startOfTimelessYear,
  timelessDateFromParts,
  timelessDateToUtcDate,
  utcDateToTimelessDate,
} from '../timeless-date.js';

const day = (value: string) => value as TimelessDateString;

// None of these helpers may depend on the process timezone, so every case runs in each zone.
describe.each(TEST_TIMEZONES)('timeless date helpers with TZ=%s', timeZone => {
  useTimezone(timeZone);

  describe('parts', () => {
    it('reads the year, 1-based month and day', () => {
      expect(getTimelessDateYear(day('2026-01-01'))).toBe(2026);
      expect(getTimelessDateMonth(day('2026-01-01'))).toBe(1);
      expect(getTimelessDateDay(day('2026-01-01'))).toBe(1);
      expect(getTimelessDateYear(day('2025-12-31'))).toBe(2025);
      expect(getTimelessDateMonth(day('2025-12-31'))).toBe(12);
      expect(getTimelessDateDay(day('2025-12-31'))).toBe(31);
      expect(getTimelessDateYearMonth(day('2026-05-01'))).toBe('2026-05');
    });

    it('builds a day from parts, rolling over like Date.UTC', () => {
      expect(timelessDateFromParts(2026, 5, 1)).toBe('2026-05-01');
      expect(timelessDateFromParts(2026, 13, 1)).toBe('2027-01-01');
      expect(timelessDateFromParts(2026, 3, 0)).toBe('2026-02-28');
      expect(timelessDateFromParts(2024, 3, 0)).toBe('2024-02-29');
    });

    it('round-trips through a UTC Date', () => {
      const date = timelessDateToUtcDate(day('2026-05-01'));
      expect(date.toISOString()).toBe('2026-05-01T00:00:00.000Z');
      expect(utcDateToTimelessDate(date)).toBe('2026-05-01');
    });
  });

  describe('comparison', () => {
    it('orders days chronologically', () => {
      const days = ['2026-05-01', '2025-12-31', '2026-01-01', '2026-05-01'].map(day);
      expect([...days].sort(compareTimelessDates)).toEqual([
        '2025-12-31',
        '2026-01-01',
        '2026-05-01',
        '2026-05-01',
      ]);
      expect(compareTimelessDates(day('2026-05-01'), day('2026-05-01'))).toBe(0);
    });

    it('finds the earliest and latest days, ignoring missing ones', () => {
      const days = [day('2026-05-01'), null, day('2025-12-31'), undefined, day('2026-01-01')];
      expect(minTimelessDate(...days)).toBe('2025-12-31');
      expect(maxTimelessDate(...days)).toBe('2026-05-01');
      expect(minTimelessDate()).toBeNull();
      expect(maxTimelessDate(null, undefined)).toBeNull();
    });
  });

  describe('arithmetic', () => {
    it('adds days across month, year and DST boundaries', () => {
      expect(addDaysToTimelessDate(day('2026-05-31'), 1)).toBe('2026-06-01');
      expect(addDaysToTimelessDate(day('2026-01-01'), -1)).toBe('2025-12-31');
      expect(addDaysToTimelessDate(day('2024-02-28'), 1)).toBe('2024-02-29');
      // DST transitions: Israel (late March), US (early March / November)
      expect(addDaysToTimelessDate(day('2026-03-26'), 2)).toBe('2026-03-28');
      expect(addDaysToTimelessDate(day('2026-03-07'), 2)).toBe('2026-03-09');
      expect(addDaysToTimelessDate(day('2026-10-31'), 2)).toBe('2026-11-02');
    });

    it('adds months and years, clamping to the last day of the target month', () => {
      expect(addMonthsToTimelessDate(day('2026-01-31'), 1)).toBe('2026-02-28');
      expect(addMonthsToTimelessDate(day('2024-01-31'), 1)).toBe('2024-02-29');
      expect(addMonthsToTimelessDate(day('2026-05-01'), -5)).toBe('2025-12-01');
      expect(addMonthsToTimelessDate(day('2026-12-15'), 1)).toBe('2027-01-15');
      expect(addYearsToTimelessDate(day('2024-02-29'), 1)).toBe('2025-02-28');
      expect(addYearsToTimelessDate(day('2026-05-01'), -1)).toBe('2025-05-01');
    });

    it('counts whole days between days', () => {
      expect(differenceInTimelessDays(day('2026-05-01'), day('2026-05-01'))).toBe(0);
      expect(differenceInTimelessDays(day('2026-05-01'), day('2026-04-30'))).toBe(1);
      expect(differenceInTimelessDays(day('2026-04-30'), day('2026-05-01'))).toBe(-1);
      expect(differenceInTimelessDays(day('2027-01-01'), day('2026-01-01'))).toBe(365);
      expect(differenceInTimelessDays(day('2026-04-01'), day('2026-03-01'))).toBe(31);
    });

    it('counts whole years once the anniversary is reached', () => {
      expect(differenceInTimelessYears(day('2026-03-14'), day('2020-03-15'))).toBe(5);
      expect(differenceInTimelessYears(day('2026-03-15'), day('2020-03-15'))).toBe(6);
      expect(differenceInTimelessYears(day('2020-03-15'), day('2026-03-15'))).toBe(-6);
      expect(differenceInTimelessYears(day('2020-03-15'), day('2026-03-14'))).toBe(-5);
      expect(differenceInTimelessYears(day('2026-12-31'), day('2026-01-01'))).toBe(0);
    });
  });

  describe('periods', () => {
    it('finds the first and last day of a month', () => {
      expect(startOfTimelessMonth(day('2026-05-17'))).toBe('2026-05-01');
      expect(startOfTimelessMonth(day('2026-05-01'))).toBe('2026-05-01');
      expect(endOfTimelessMonth(day('2026-05-01'))).toBe('2026-05-31');
      expect(endOfTimelessMonth(day('2026-02-10'))).toBe('2026-02-28');
      expect(endOfTimelessMonth(day('2024-02-10'))).toBe('2024-02-29');
      expect(endOfTimelessMonth(day('2026-12-31'))).toBe('2026-12-31');
    });

    it('finds the first and last day of a year, from a day or a year number', () => {
      expect(startOfTimelessYear(day('2026-05-17'))).toBe('2026-01-01');
      expect(endOfTimelessYear(day('2026-05-17'))).toBe('2026-12-31');
      expect(startOfTimelessYear(2020)).toBe('2020-01-01');
      expect(endOfTimelessYear(2020)).toBe('2020-12-31');
    });
  });
});
