import { describe, expect, it } from 'vitest';
import { formatSecurityDate, securityTaxLines } from '../security-executions-table.js';

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

describe('securityTaxLines', () => {
  const amount = (raw: number, symbol: string) => ({ raw, formatted: `${symbol} ${raw.toFixed(2)}` });

  it('shows tax withheld abroad in the settlement currency', () => {
    expect(
      securityTaxLines({
        israelTaxValue: amount(0, '₪'),
        foreignTaxValue: amount(6.75, '$'),
        israelTaxValueByPayments: amount(0, '$'),
        capitalTaxValue: null,
      }),
    ).toEqual([{ label: 'Foreign', formatted: '$ 6.75' }]);
  });

  it('lists each kind of withheld tax, then a non-zero ILS figure', () => {
    expect(
      securityTaxLines({
        israelTaxValue: amount(36.5, '₪'),
        foreignTaxValue: amount(15, '$'),
        israelTaxValueByPayments: amount(10, '$'),
        capitalTaxValue: amount(5, '$'),
      }),
    ).toEqual([
      { label: 'Foreign', formatted: '$ 15.00' },
      { label: 'Israel', formatted: '$ 10.00' },
      { label: 'Capital', formatted: '$ 5.00' },
      { label: null, formatted: '₪ 36.50', secondary: true },
    ]);
  });

  it('keeps a refund of withheld tax', () => {
    expect(securityTaxLines({ israelTaxValueByPayments: amount(-5, '$') })).toEqual([
      { label: 'Israel', formatted: '$ -5.00' },
    ]);
  });

  it('falls back to the ILS figure alone when no withheld tax is reported', () => {
    expect(
      securityTaxLines({
        israelTaxValue: amount(90, '₪'),
        foreignTaxValue: null,
        israelTaxValueByPayments: null,
        capitalTaxValue: null,
      }),
    ).toEqual([{ label: null, formatted: '₪ 90.00' }]);
  });

  it('renders nothing when no tax is reported at all', () => {
    expect(securityTaxLines({})).toEqual([]);
  });
});
