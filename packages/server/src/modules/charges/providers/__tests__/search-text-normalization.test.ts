import { describe, expect, it } from 'vitest';
import { normalizeSearchText, toNumericSearchText } from '../charges.provider.js';

/**
 * These two guard the SQL boundary. Several resolvers build `getChargesByFilters`
 * params independently, so the provider — not any one caller — is where a search
 * string has to be made safe.
 */
describe('normalizeSearchText', () => {
  /**
   * The bug this exists for: an empty string is not NULL, so it passes the query's
   * `IS NOT NULL` guards and degrades to `ILIKE '%%'`. As an exclusion that drops
   * nearly every charge; as a positive filter it drops the charges whose description
   * is NULL, since they fail the ILIKE that every other row passes.
   */
  it('collapses whitespace-only text to null', () => {
    expect(normalizeSearchText('   ')).toBeNull();
    expect(normalizeSearchText('\t\n ')).toBeNull();
    expect(normalizeSearchText('')).toBeNull();
  });

  it('passes null and undefined through', () => {
    expect(normalizeSearchText(null)).toBeNull();
    expect(normalizeSearchText(undefined)).toBeNull();
  });

  it('trims and lowercases real content', () => {
    expect(normalizeSearchText('  Coffee ')).toBe('coffee');
    expect(normalizeSearchText('REFUND')).toBe('refund');
  });
});

describe('toNumericSearchText', () => {
  // The amount branches compare against `amount::TEXT`, so a term with no digit
  // cannot match one and only costs a scan on both the search and exclusion paths.
  it('is null for text with no digits', () => {
    expect(toNumericSearchText('coffee')).toBeNull();
    expect(toNumericSearchText('..')).toBeNull();
    expect(toNumericSearchText(null)).toBeNull();
  });

  it('strips thousands separators so 1,234.56 matches the stored 1234.56', () => {
    expect(toNumericSearchText('1,234.56')).toBe('1234.56');
    expect(toNumericSearchText('1234.56')).toBe('1234.56');
  });

  it('keeps mixed text that contains a digit, since it may match an amount', () => {
    expect(toNumericSearchText('-1')).toBe('-1');
    expect(toNumericSearchText('invoice 42')).toBe('invoice 42');
  });
});
