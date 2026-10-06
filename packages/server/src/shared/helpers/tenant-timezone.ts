import { TENANT_TIMEZONE } from '../constants.js';
import type { TimelessDateString } from '../types/index.js';
import { timelessDateToUtcDate } from './timeless-date.js';

/*
 * Conversions between instants and the tenant's calendar days (#4560).
 *
 * A point in time falls on different days in different timezones, so turning one into a day (or a
 * day into the instant it starts at) needs a timezone. These helpers use the tenant's
 * (`TENANT_TIMEZONE`), never the server process's, so the result does not depend on where the
 * server runs.
 *
 * Not for Postgres `timestamp` (without time zone) values: node-pg builds those from their stored
 * wall-clock fields in server-local time, so `dateToTimelessDateString` already returns their stored
 * day, and reading them in another timezone would shift it.
 */

/** The tenant's IANA timezone, for APIs that take one (e.g. `toLocaleDateString`'s `timeZone`). */
export function getTenantTimeZone(): string {
  return TENANT_TIMEZONE;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The wall-clock fields `instant` shows in `timeZone`. */
function wallClock(instant: Date, timeZone: string) {
  const fields: Record<string, number> = {};
  for (const { type, value } of wallClockFormatter(timeZone).formatToParts(instant)) {
    if (type !== 'literal') {
      fields[type] = Number(value);
    }
  }
  return fields as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
}

/** How far `timeZone`'s wall clock is ahead of UTC at `instant`, in milliseconds. */
function offsetMs(instant: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = wallClock(instant, timeZone);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The tenant's calendar day `instant` falls on. */
export function instantToTimelessDate(
  instant: Date,
  timeZone: string = TENANT_TIMEZONE,
): TimelessDateString {
  const { year, month, day } = wallClock(instant, timeZone);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as TimelessDateString;
}

/** The tenant's current calendar day. */
export function todayTimelessDate(timeZone: string = TENANT_TIMEZONE): TimelessDateString {
  return instantToTimelessDate(new Date(), timeZone);
}

/** The instant the tenant's calendar day `date` starts at (its midnight in the tenant's timezone). */
export function timelessDateToTenantInstant(
  date: TimelessDateString,
  timeZone: string = TENANT_TIMEZONE,
): Date {
  const utcMidnight = timelessDateToUtcDate(date).getTime();
  // The offset at UTC midnight can differ from the one at the zone's own midnight when a DST change
  // falls in between, so take it again at the first estimate.
  const estimate = utcMidnight - offsetMs(new Date(utcMidnight), timeZone);
  return new Date(utcMidnight - offsetMs(new Date(estimate), timeZone));
}

/** The tenant's current calendar year. */
export function currentTenantYear(timeZone: string = TENANT_TIMEZONE): number {
  return Number(todayTimelessDate(timeZone).slice(0, 4));
}
