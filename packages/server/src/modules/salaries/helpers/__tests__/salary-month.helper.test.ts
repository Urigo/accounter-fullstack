import { describe, expect, it } from 'vitest';
import { TEST_TIMEZONES, useTimezone } from '../../../../__tests__/helpers/timezones.js';
import { normalizeSalaryMonth } from '../salary-month.helper.js';

describe.each(TEST_TIMEZONES)('normalizeSalaryMonth with TZ=%s', timeZone => {
  useTimezone(timeZone);

  it('keeps a yyyy-MM month as is', () => {
    expect(normalizeSalaryMonth('2026-05')).toBe('2026-05');
  });

  it.each([
    ['2026-05-01', '2026-05'],
    ['2026-01-01', '2026-01'],
    ['2026-12-31', '2026-12'],
    ['2026-05-01T00:00:00.000Z', '2026-05'],
  ])('cuts %s to its month', (input, expected) => {
    expect(normalizeSalaryMonth(input)).toBe(expected);
  });
});
