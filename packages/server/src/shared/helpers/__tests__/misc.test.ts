import { describe, expect, it } from 'vitest';
import type { TimelessDateString } from '../../types/index.js';
import { dateToTimelessDateString, timelessDateStringToLocalDate } from '../misc.js';

describe('timelessDateStringToLocalDate', () => {
  it('parses a timeless date string to local midnight', () => {
    const date = timelessDateStringToLocalDate('2026-05-01' as TimelessDateString);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4); // May (0-indexed)
    expect(date.getDate()).toBe(1);
    expect(date.getHours()).toBe(0);
  });

  it('round-trips with dateToTimelessDateString regardless of timezone', () => {
    // new Date(string) would parse as UTC and could shift the day in negative-offset zones;
    // local parsing keeps the calendar date stable.
    const input = '2026-01-01' as TimelessDateString;
    expect(dateToTimelessDateString(timelessDateStringToLocalDate(input))).toBe(input);
  });
});
