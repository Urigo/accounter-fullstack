import { format } from 'date-fns';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { timelessDateStringToLocalDate, type TimelessDateString } from '../dates.js';

// Browsers on either side of UTC, and the far ends of the offset range.
const TIMEZONES = ['UTC', 'Asia/Jerusalem', 'America/New_York', 'Asia/Tokyo', 'Pacific/Pago_Pago'];

describe.each(TIMEZONES)('timelessDateStringToLocalDate with TZ=%s', timeZone => {
  let previous: string | undefined;
  beforeAll(() => {
    previous = process.env['TZ'];
    process.env['TZ'] = timeZone;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env['TZ'];
    else process.env['TZ'] = previous;
  });

  it.each(['2026-05-01', '2026-01-01', '2025-12-31', '2024-02-29'] as TimelessDateString[])(
    'shows %s as that same day',
    day => {
      const date = timelessDateStringToLocalDate(day);
      expect(format(date, 'yyyy-MM-dd')).toBe(day);
    },
  );
});
