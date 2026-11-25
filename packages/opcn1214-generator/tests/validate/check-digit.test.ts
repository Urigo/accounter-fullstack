import { isValidIsraeliCheckDigit } from '../../src/validate/check-digit.js';

describe('isValidIsraeliCheckDigit (SPEC §4.2, §15 A-25)', () => {
  it.each([
    ['514000009'],
    ['123456782'],
    ['999999964'],
    ['999999998'],
    ['940000003'],
    ['300000007'],
    ['000000000'],
    ['0'],
    ['18'], // 000000018: 1×2 + 8×1 = 10
    ['000000018'],
    ['12345674'], // 012345674, left-padded to 9 digits
  ])('accepts %s', value => {
    expect(isValidIsraeliCheckDigit(value)).toBe(true);
  });

  it.each([
    ['570000001'],
    ['940000001'],
    ['510000001'],
    ['123456789'],
    ['12'], // 000000012
    ['1'],
    ['12345678'],
  ])('rejects %s', value => {
    expect(isValidIsraeliCheckDigit(value)).toBe(false);
  });

  it('treats a shorter value as its left-padded 9-digit form', () => {
    expect(isValidIsraeliCheckDigit('12345674')).toBe(isValidIsraeliCheckDigit('012345674'));
    expect(isValidIsraeliCheckDigit('18')).toBe(isValidIsraeliCheckDigit('000000018'));
  });

  it('rejects values that are not 1–9 digits', () => {
    expect(isValidIsraeliCheckDigit('')).toBe(false);
    expect(isValidIsraeliCheckDigit('12a')).toBe(false);
    expect(isValidIsraeliCheckDigit('5140000091')).toBe(false);
  });
});
