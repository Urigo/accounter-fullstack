import type { TimelessDateString } from '../types/index.js';

/*
 * Calendar-day arithmetic on `TimelessDateString` (`yyyy-mm-dd`) values (#4560).
 *
 * A date-only value has no time of day and no timezone, so none of these helpers depend on the
 * process timezone: comparisons are plain string comparisons (the format sorts chronologically),
 * and arithmetic goes through `Date.UTC`, where every day is exactly 24 hours long and no DST
 * transition can move a value to the neighbouring day.
 *
 * Reach for these instead of `new Date(date)` (which reads a date-only string as UTC midnight and
 * then shows the previous day in any zone west of UTC) or local-time `date-fns` calls.
 */

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function parts(date: TimelessDateString): [year: number, month: number, day: number] {
  const [year, month, day] = date.split('-').map(Number);
  return [year, month, day];
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Builds a `TimelessDateString` from a year, a 1-based month and a day of the month. Out-of-range
 * values roll over the way `Date.UTC` does (month 13 is January of the next year, day 0 is the last
 * day of the previous month).
 */
export function timelessDateFromParts(
  year: number,
  month: number,
  day: number,
): TimelessDateString {
  return utcDateToTimelessDate(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * The calendar day a `Date` has in UTC. Meant for `Date`s built from calendar days in UTC (see
 * `timelessDateToUtcDate`). To turn a point in time into the tenant's day it falls on, use
 * `instantToTimelessDate`; for a Postgres `timestamp` value's stored day, `dateToTimelessDateString`.
 */
export function utcDateToTimelessDate(date: Date): TimelessDateString {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` as TimelessDateString;
}

/**
 * The start of `date` in UTC, for the rare API that needs a `Date` (sorting by timestamp, an
 * external service). Read it back with `utcDateToTimelessDate`, never with local-time methods.
 */
export function timelessDateToUtcDate(date: TimelessDateString): Date {
  const [year, month, day] = parts(date);
  return new Date(Date.UTC(year, month - 1, day));
}

/** The year of `date`, e.g. `2026` for `2026-05-01`. */
export function getTimelessDateYear(date: TimelessDateString): number {
  return parts(date)[0];
}

/** The 1-based month of `date`, e.g. `5` for `2026-05-01`. */
export function getTimelessDateMonth(date: TimelessDateString): number {
  return parts(date)[1];
}

/** The day of the month of `date`, e.g. `1` for `2026-05-01`. */
export function getTimelessDateDay(date: TimelessDateString): number {
  return parts(date)[2];
}

/** `yyyy-MM` of `date`, e.g. `2026-05` for `2026-05-01`. */
export function getTimelessDateYearMonth(date: TimelessDateString): string {
  return date.slice(0, 7);
}

/** Negative if `a` is before `b`, positive if after, `0` for the same day. Usable with `sort`. */
export function compareTimelessDates(a: TimelessDateString, b: TimelessDateString): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The earliest of the given days, ignoring `null`/`undefined`; `null` if there are none. */
export function minTimelessDate(
  ...dates: Array<TimelessDateString | null | undefined>
): TimelessDateString | null {
  let min: TimelessDateString | null = null;
  for (const date of dates) {
    if (date && (min === null || date < min)) {
      min = date;
    }
  }
  return min;
}

/** The latest of the given days, ignoring `null`/`undefined`; `null` if there are none. */
export function maxTimelessDate(
  ...dates: Array<TimelessDateString | null | undefined>
): TimelessDateString | null {
  let max: TimelessDateString | null = null;
  for (const date of dates) {
    if (date && (max === null || date > max)) {
      max = date;
    }
  }
  return max;
}

/** `date` moved by `amount` days (negative to go back). */
export function addDaysToTimelessDate(
  date: TimelessDateString,
  amount: number,
): TimelessDateString {
  const [year, month, day] = parts(date);
  return timelessDateFromParts(year, month, day + amount);
}

/**
 * `date` moved by `amount` months (negative to go back). Like `date-fns`' `addMonths`, a day that
 * does not exist in the target month is clamped to its last day (`2026-01-31` + 1 → `2026-02-28`).
 */
export function addMonthsToTimelessDate(
  date: TimelessDateString,
  amount: number,
): TimelessDateString {
  const [year, month, day] = parts(date);
  const target = new Date(Date.UTC(year, month - 1 + amount, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  return timelessDateFromParts(
    targetYear,
    targetMonth,
    Math.min(day, daysInMonth(targetYear, targetMonth)),
  );
}

/** `date` moved by `amount` years, clamping 29 February to the 28th in common years. */
export function addYearsToTimelessDate(
  date: TimelessDateString,
  amount: number,
): TimelessDateString {
  return addMonthsToTimelessDate(date, amount * 12);
}

/** Whole calendar days from `earlier` to `later` (negative if `later` is before `earlier`). */
export function differenceInTimelessDays(
  later: TimelessDateString,
  earlier: TimelessDateString,
): number {
  return Math.round(
    (timelessDateToUtcDate(later).getTime() - timelessDateToUtcDate(earlier).getTime()) / DAY_IN_MS,
  );
}

/**
 * Whole years from `earlier` to `later`, counting a year only once its anniversary is reached (like
 * `date-fns`' `differenceInYears`): `2020-03-15` → `2026-03-14` is 5, → `2026-03-15` is 6.
 */
export function differenceInTimelessYears(
  later: TimelessDateString,
  earlier: TimelessDateString,
): number {
  const sign = later < earlier ? -1 : 1;
  const [from, to] = sign === 1 ? [earlier, later] : [later, earlier];
  const years = getTimelessDateYear(to) - getTimelessDateYear(from);
  const anniversaryNotReached = to.slice(5) < from.slice(5);
  return sign * (years - (anniversaryNotReached ? 1 : 0));
}

/** The first day of the month of `date`. */
export function startOfTimelessMonth(date: TimelessDateString): TimelessDateString {
  const [year, month] = parts(date);
  return timelessDateFromParts(year, month, 1);
}

/** The last day of the month of `date`. */
export function endOfTimelessMonth(date: TimelessDateString): TimelessDateString {
  const [year, month] = parts(date);
  return timelessDateFromParts(year, month, daysInMonth(year, month));
}

/** The first day of the year of `date`, or of `date` itself when given a year number. */
export function startOfTimelessYear(date: TimelessDateString | number): TimelessDateString {
  const year = typeof date === 'number' ? date : getTimelessDateYear(date);
  return timelessDateFromParts(year, 1, 1);
}

/** The last day of the year of `date`, or of `date` itself when given a year number. */
export function endOfTimelessYear(date: TimelessDateString | number): TimelessDateString {
  const year = typeof date === 'number' ? date : getTimelessDateYear(date);
  return timelessDateFromParts(year, 12, 31);
}
