import { describe, expect, it } from 'vitest';
import { isValidIsraeliId, normalizeIsraeliId } from './israeli-id.js';

describe('normalizeIsraeliId', () => {
  it('strips spaces and dashes', () => {
    expect(normalizeIsraeliId(' 51-623267 5 ')).toBe('516232675');
  });
});

describe('isValidIsraeliId', () => {
  it('accepts company numbers with a valid check digit', () => {
    expect(isValidIsraeliId('516232675')).toBe(true);
    expect(isValidIsraeliId('520018078')).toBe(true);
    expect(isValidIsraeliId('51-623267-5')).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    expect(isValidIsraeliId('516232676')).toBe(false);
  });

  it('pads short personal IDs with leading zeros', () => {
    // 000000018 has a valid check digit
    expect(isValidIsraeliId('18')).toBe(false); // too short to be an ID
    expect(isValidIsraeliId('00018')).toBe(true);
  });

  it('rejects non-digits and overlong numbers', () => {
    expect(isValidIsraeliId('')).toBe(false);
    expect(isValidIsraeliId('51623267a')).toBe(false);
    expect(isValidIsraeliId('5162326750')).toBe(false);
  });
});
