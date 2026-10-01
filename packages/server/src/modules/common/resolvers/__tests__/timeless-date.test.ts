import { Kind } from 'graphql';
import { describe, expect, it } from 'vitest';
import { TEST_TIMEZONES, useTimezone } from '../../../../__tests__/helpers/timezones.js';
import { TimelessDateScalar } from '../timeless-date.js';

describe.each(TEST_TIMEZONES)('TimelessDate scalar with TZ=%s', timeZone => {
  useTimezone(timeZone);

  const days = ['2026-01-01', '2026-02-28', '2024-02-29', '2026-05-01', '2026-12-31'];

  it.each(days)('serializes %s unchanged', day => {
    expect(TimelessDateScalar.serialize(day)).toBe(day);
  });

  it.each(days)('parses the %s variable unchanged', day => {
    expect(TimelessDateScalar.parseValue(day)).toBe(day);
  });

  it.each(days)('parses the %s literal unchanged', day => {
    expect(TimelessDateScalar.parseLiteral({ kind: Kind.STRING, value: day })).toBe(day);
  });

  it.each(['2026-5-1', '2026-02-30', '2026-05-01T00:00:00.000Z', '01/05/2026', ''])(
    'rejects %j',
    value => {
      expect(() => TimelessDateScalar.serialize(value)).toThrow();
      expect(() => TimelessDateScalar.parseValue(value)).toThrow();
      expect(() => TimelessDateScalar.parseLiteral({ kind: Kind.STRING, value })).toThrow();
    },
  );
});
