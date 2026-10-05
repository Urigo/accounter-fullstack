import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatTimelessDate } from '../dates.js';

// Browsers on either side of UTC, and the far ends of the offset range.
const TIMEZONES = ['UTC', 'Asia/Jerusalem', 'America/New_York', 'Asia/Tokyo', 'Pacific/Pago_Pago'];

describe.each(TIMEZONES)('formatTimelessDate with TZ=%s', timeZone => {
  let previous: string | undefined;
  beforeAll(() => {
    previous = process.env['TZ'];
    process.env['TZ'] = timeZone;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env['TZ'];
    else process.env['TZ'] = previous;
  });

  it('formats a day as dd/MM/yy', () => {
    expect(formatTimelessDate('2026-05-01')).toBe('01/05/26');
    expect(formatTimelessDate('2026-01-01')).toBe('01/01/26');
    expect(formatTimelessDate('2025-12-31')).toBe('31/12/25');
  });

  it('formats a day as dd/MM/yyyy', () => {
    expect(formatTimelessDate('2024-02-29', 'dd/MM/yyyy')).toBe('29/02/2024');
  });
});
