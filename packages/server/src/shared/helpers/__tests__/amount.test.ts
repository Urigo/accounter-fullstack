import { describe, expect, it } from 'vitest';
import { Currency } from '../../enums.js';
import { formatCurrency } from '../amount.js';

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
