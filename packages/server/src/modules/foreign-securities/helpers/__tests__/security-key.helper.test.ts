import { describe, expect, it } from 'vitest';
import { extractSecurityKeys, extractTransactionSecurityKeys } from '../security-key.helper.js';

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

describe('extractTransactionSecurityKeys', () => {
  it('reads a domestic trade’s key from its reference', () => {
    expect(
      extractTransactionSecurityKeys({
        source_description: `ני"ע-קניה SEC'TIES PURCH`,
        source_reference: '1234567',
      }),
    ).toEqual(['1234567']);
  });

  it('reads a securities fee’s key from its reference', () => {
    expect(
      extractTransactionSecurityKeys({
        source_description: "ניעז עמ' תשלום FSEC PYMNT FEE",
        source_reference: '0012345678',
      }),
    ).toEqual(['12345678']);
  });

  it('reads the key of a securities fee refund from its reference', () => {
    for (const description of [
      'ביטול עמלה ני"ע CANC SEC FEE',
      'ביטול עמלה ני״ע',
      'ביטול עמלה ניע',
      'canc sec fee',
    ]) {
      expect(
        extractTransactionSecurityKeys({
          source_description: description,
          source_reference: '0012345678',
        }),
      ).toEqual(['12345678']);
    }
  });

  it('prefers the padded key in the description over the reference', () => {
    expect(
      extractTransactionSecurityKeys({
        source_description: 'ניע"ז מכירה 0005129523',
        source_reference: '3900123',
      }),
    ).toEqual(['5129523']);
  });

  it('does not read the reference of a row that is not a securities movement', () => {
    expect(
      extractTransactionSecurityKeys({
        source_description: 'העברה לחשבון אחר',
        source_reference: '1234567',
      }),
    ).toEqual([]);
  });

  it('does not read the reference of a row that only mentions securities', () => {
    for (const description of ['דמי משמרת ני"ע', 'דמי ניהול ני"ע', 'מניעה', 'ביטול עמלה']) {
      expect(
        extractTransactionSecurityKeys({ source_description: description, source_reference: '1234567' }),
      ).toEqual([]);
    }
  });

  it('reads a domestic sale’s key from its reference', () => {
    expect(
      extractTransactionSecurityKeys({
        source_description: 'ני"ע-מכירה',
        source_reference: '1234567',
      }),
    ).toEqual(['1234567']);
  });

  it('returns nothing without a reference to read', () => {
    expect(
      extractTransactionSecurityKeys({
        source_description: `ני"ע-קניה SEC'TIES PURCH`,
        source_reference: null,
      }),
    ).toEqual([]);
  });
});
