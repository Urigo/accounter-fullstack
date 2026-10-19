import { describe, expect, it } from 'vitest';
import { getSecurityLocality } from '../security-locality.helper.js';

describe('getSecurityLocality', () => {
  it('is local for an issuer of the tenant locality and foreign for any other', () => {
    expect(getSecurityLocality({ issuer_country_code: 'IL', isin: 'US0000000001' }, 'ISR')).toBe(
      'LOCAL',
    );
    expect(getSecurityLocality({ issuer_country_code: 'US', isin: 'IL0000000001' }, 'ISR')).toBe(
      'FOREIGN',
    );
  });

  it('follows the tenant locality rather than assuming Israel', () => {
    expect(getSecurityLocality({ issuer_country_code: 'US', isin: null }, 'USA')).toBe('LOCAL');
    expect(getSecurityLocality({ issuer_country_code: 'IL', isin: null }, 'USA')).toBe('FOREIGN');
  });

  it('falls back to the ISIN prefix when the issuer country is missing', () => {
    expect(getSecurityLocality({ issuer_country_code: null, isin: 'IL0011223344' }, 'ISR')).toBe(
      'LOCAL',
    );
    expect(getSecurityLocality({ issuer_country_code: '  ', isin: 'FR0011223344' }, 'ISR')).toBe(
      'FOREIGN',
    );
  });

  it('falls back to the ISIN prefix when the issuer country is not a country code', () => {
    expect(getSecurityLocality({ issuer_country_code: 'ישראל', isin: 'IL0051295231' }, 'ISR')).toBe(
      'LOCAL',
    );
  });

  it('tolerates padding and lower case', () => {
    expect(getSecurityLocality({ issuer_country_code: ' il ', isin: null }, 'ISR')).toBe('LOCAL');
  });

  it('is unknown, not foreign, when neither is readable', () => {
    expect(getSecurityLocality({ issuer_country_code: null, isin: null }, 'ISR')).toBeNull();
    expect(getSecurityLocality({ issuer_country_code: null, isin: '  ' }, 'ISR')).toBeNull();
  });

  it('refuses a tenant locality it cannot map', () => {
    expect(() => getSecurityLocality({ issuer_country_code: 'IL', isin: null }, 'XYZ')).toThrow(
      'Unknown tenant locality "XYZ"',
    );
  });
});
