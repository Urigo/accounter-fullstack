import { describe, expect, it } from 'vitest';
import { formatSecurityDate } from '../security-executions-table.js';

describe('formatSecurityDate', () => {
  it('renders a TimelessDate as dd/MM/yyyy', () => {
    expect(formatSecurityDate('2024-03-09')).toBe('09/03/2024');
  });

  it('keeps the calendar day of a TimelessDate regardless of the viewer timezone', () => {
    // `new Date('2024-01-01')` is UTC midnight, which is still 2023-12-31 in the Americas.
    expect(formatSecurityDate('2024-01-01')).toBe('01/01/2024');
  });

  it('renders a timestamp as dd/MM/yyyy', () => {
    expect(formatSecurityDate(new Date(2024, 2, 9, 13, 45))).toBe('09/03/2024');
  });

  it('renders a timestamp string as dd/MM/yyyy', () => {
    // No trailing `Z`: local time, so the expectation holds in whatever zone the suite runs in.
    expect(formatSecurityDate('2024-03-09T12:00:00')).toBe('09/03/2024');
  });

  it('renders nothing for a missing date', () => {
    expect(formatSecurityDate(null)).toBe('');
    expect(formatSecurityDate(undefined)).toBe('');
    expect(formatSecurityDate('')).toBe('');
  });

  it('renders nothing for an unparsable date', () => {
    expect(formatSecurityDate('not a date')).toBe('');
  });
});
