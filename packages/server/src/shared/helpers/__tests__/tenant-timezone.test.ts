import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEST_TIMEZONES, useTimezone } from '../../../__tests__/helpers/timezones.js';
import type { TimelessDateString } from '../../types/index.js';
import {
  currentTenantYear,
  getTenantTimeZone,
  instantToTimelessDate,
  timelessDateToTenantInstant,
  todayTimelessDate,
} from '../tenant-timezone.js';

const day = (value: string) => value as TimelessDateString;

// The tenant's timezone (Asia/Jerusalem for now) decides the day, whatever the server's is.
describe.each(TEST_TIMEZONES)('tenant timezone helpers with TZ=%s', timeZone => {
  useTimezone(timeZone);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reckons days in Asia/Jerusalem', () => {
    expect(getTenantTimeZone()).toBe('Asia/Jerusalem');
  });

  it('maps an instant to the day it falls on in the tenant timezone', () => {
    // summer (UTC+3)
    expect(instantToTimelessDate(new Date('2026-05-01T20:59:59Z'))).toBe('2026-05-01');
    expect(instantToTimelessDate(new Date('2026-05-01T21:00:00Z'))).toBe('2026-05-02');
    // winter (UTC+2), across a year boundary
    expect(instantToTimelessDate(new Date('2026-12-31T21:59:59Z'))).toBe('2026-12-31');
    expect(instantToTimelessDate(new Date('2026-12-31T22:00:00Z'))).toBe('2027-01-01');
    // an explicit zone
    expect(instantToTimelessDate(new Date('2026-05-01T03:00:00Z'), 'America/New_York')).toBe(
      '2026-04-30',
    );
  });

  it('finds the instant a tenant day starts at, across DST changes', () => {
    expect(timelessDateToTenantInstant(day('2026-01-15')).toISOString()).toBe(
      '2026-01-14T22:00:00.000Z',
    );
    expect(timelessDateToTenantInstant(day('2026-05-01')).toISOString()).toBe(
      '2026-04-30T21:00:00.000Z',
    );
    // DST starts at 02:00 on 2026-03-27 and ends at 02:00 on 2026-10-25
    expect(timelessDateToTenantInstant(day('2026-03-27')).toISOString()).toBe(
      '2026-03-26T22:00:00.000Z',
    );
    expect(timelessDateToTenantInstant(day('2026-03-28')).toISOString()).toBe(
      '2026-03-27T21:00:00.000Z',
    );
    expect(timelessDateToTenantInstant(day('2026-10-25')).toISOString()).toBe(
      '2026-10-24T21:00:00.000Z',
    );
    expect(timelessDateToTenantInstant(day('2026-10-26')).toISOString()).toBe(
      '2026-10-25T22:00:00.000Z',
    );
  });

  it('round-trips a day through the instant it starts at', () => {
    for (const value of ['2024-02-29', '2026-03-27', '2026-10-25', '2026-12-31']) {
      expect(instantToTimelessDate(timelessDateToTenantInstant(day(value)))).toBe(value);
    }
  });

  it("reads today and the current year in the tenant's timezone", () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // still 2026 in UTC and further west, already 2027 in Jerusalem
    vi.setSystemTime(new Date('2026-12-31T22:30:00Z'));
    expect(todayTimelessDate()).toBe('2027-01-01');
    expect(currentTenantYear()).toBe(2027);
  });
});
