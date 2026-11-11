import { describe, expect, it, vi } from 'vitest';
import { Currency } from '../../enums.js';
import { formatCurrency, formatFinancialIntAmount } from '../amount.js';

describe('formatCurrency', () => {
  // The Poalim securities feed spells its currencies out in Hebrew. Every label
  // in CURRENCIES (hapoalim-securities-transactions-schema.ts) has to land on a
  // Currency here, or a scrape that validates fine fails when read back.
  it.each([
    ['שקל חדש', Currency.Ils],
    ['דולר ארה"ב', Currency.Usd],
    ['אירו', Currency.Eur],
    ['לירה שטרלינג', Currency.Gbp],
    ['ין יפני', Currency.Jpy],
  ])('maps the Hebrew label %s', (label, expected) => {
    expect(formatCurrency(label)).toBe(expected);
  });

  it('throws on an unknown currency rather than guessing', () => {
    expect(() => formatCurrency('פרנק שוויצרי')).toThrow(/Unknown currency/);
  });

  it('returns null for an unknown currency when nullable', () => {
    expect(formatCurrency('פרנק שוויצרי', true)).toBeNull();
  });

  it('defaults a missing currency to ILS', () => {
    expect(formatCurrency(null)).toBe(Currency.Ils);
  });
});

describe('formatFinancialIntAmount', () => {
  it('rounds a non-integer amount without logging it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(formatFinancialIntAmount(1234.6, Currency.Ils)).toEqual({
      raw: 1235,
      formatted: '₪ 1,235',
      currency: Currency.Ils,
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
