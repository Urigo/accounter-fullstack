import { describe, expect, it } from 'vitest';
import { buildSecurityBusinessName } from '../security-business-name.helper.js';

describe('buildSecurityBusinessName', () => {
  it('pairs the English name with the ticker', () => {
    expect(
      buildSecurityBusinessName({ isin: 'US0378331005', engName: 'APPLE INC', symbol: 'AAPL' }),
    ).toBe('APPLE INC (AAPL)');
  });

  it('falls back to the name alone when the feed reports no symbol', () => {
    expect(buildSecurityBusinessName({ isin: 'US0378331005', engName: 'APPLE INC' })).toBe(
      'APPLE INC',
    );
  });

  it('falls back to the symbol when there is no name', () => {
    expect(buildSecurityBusinessName({ isin: 'US0378331005', symbol: 'AAPL' })).toBe('AAPL');
  });

  it('falls back to the ISIN, so the name is never empty', () => {
    expect(
      buildSecurityBusinessName({ isin: 'US0378331005', engName: '  ', symbol: null }),
    ).toBe('US0378331005');
  });

  it('trims the descriptors the feed pads', () => {
    expect(
      buildSecurityBusinessName({ isin: 'US0378331005', engName: ' APPLE INC ', symbol: ' AAPL ' }),
    ).toBe('APPLE INC (AAPL)');
  });
});
