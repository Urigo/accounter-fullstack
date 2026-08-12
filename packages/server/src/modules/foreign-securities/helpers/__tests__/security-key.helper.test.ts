import { describe, expect, it } from 'vitest';
import { extractSecurityKeys } from '../security-key.helper.js';

describe('extractSecurityKeys', () => {
  it('extracts the key from a sell description', () => {
    expect(extractSecurityKeys('ניע"ז מכירה 0005129523')).toEqual(['5129523']);
  });

  it('extracts the key from a buy description', () => {
    expect(extractSecurityKeys('ניע"ז קניה 0077774297')).toEqual(['77774297']);
  });

  it('returns an empty array for a description with no padded key', () => {
    expect(extractSecurityKeys('ניעז עמ תשלום fsec pymnt fee')).toEqual([]);
  });

  it('returns an empty array for null and empty input', () => {
    expect(extractSecurityKeys(null)).toEqual([]);
    expect(extractSecurityKeys(undefined)).toEqual([]);
    expect(extractSecurityKeys('')).toEqual([]);
  });

  it('extracts several keys in order of appearance', () => {
    expect(extractSecurityKeys('ניע"ז 0005129523 / 0077774297')).toEqual(['5129523', '77774297']);
  });

  it('de-duplicates a key repeated in one description', () => {
    expect(extractSecurityKeys('0005129523 ניע"ז מכירה 0005129523')).toEqual(['5129523']);
  });

  it('ignores digit runs that do not start with a zero', () => {
    // Amounts and dates are the realistic false positives here.
    expect(extractSecurityKeys('ניע"ז מכירה 12345678 בסך 4500')).toEqual([]);
  });

  it('ignores padded runs that normalize to fewer than six digits', () => {
    expect(extractSecurityKeys('ניע"ז מכירה 00012345')).toEqual([]);
  });

  it('ignores runs shorter than the padded minimum', () => {
    expect(extractSecurityKeys('ניע"ז מכירה 012345')).toEqual([]);
  });
});
