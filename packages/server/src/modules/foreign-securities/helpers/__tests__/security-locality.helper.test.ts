import { describe, expect, it } from 'vitest';
import { isForeignSecurity } from '../security-locality.helper.js';

describe('isForeignSecurity', () => {
  it('reads an Israeli issuer as local, whatever the ISIN says', () => {
    expect(isForeignSecurity({ issuerCountryCode: 'IL', isin: 'US0378331005' })).toBe(false);
  });

  it('reads a foreign issuer as foreign, even with an Israeli ISIN', () => {
    expect(isForeignSecurity({ issuerCountryCode: 'US', isin: 'IL0051295231' })).toBe(true);
  });

  it('falls back to the ISIN prefix when the issuer country is missing', () => {
    expect(isForeignSecurity({ issuerCountryCode: null, isin: 'IL0051295231' })).toBe(false);
    expect(isForeignSecurity({ issuerCountryCode: '  ', isin: 'US0378331005' })).toBe(true);
  });

  it('falls back to the ISIN prefix when the issuer country is not a country code', () => {
    expect(isForeignSecurity({ issuerCountryCode: 'ישראל', isin: 'IL0051295231' })).toBe(false);
  });

  it('tolerates padding and lower case', () => {
    expect(isForeignSecurity({ issuerCountryCode: ' il ' })).toBe(false);
  });

  it('is unknown, not foreign, when neither is readable', () => {
    expect(isForeignSecurity({})).toBeNull();
    expect(isForeignSecurity({ issuerCountryCode: null, isin: '  ' })).toBeNull();
  });
});
