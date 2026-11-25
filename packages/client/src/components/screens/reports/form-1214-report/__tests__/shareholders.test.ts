import { describe, expect, it } from 'vitest';
import {
  dividendRightsTotal,
  emptyShareholderRow,
  hasShareholderRowErrors,
  isDividendTotalComplete,
  moveShareholderRow,
  parseNumericText,
  rowToShareholderInput,
  sameShareholderRows,
  shareholderToRow,
  validateShareholderRow,
  type ShareholderData,
  type ShareholderRow,
} from '../shareholders.js';

const saved: ShareholderData = {
  id: 'sh-1',
  idNumber: '012345678',
  fullName: 'ישראל ישראלי',
  isControllingShareholder: true,
  dividendRightsPercent: 62.5,
  votingRightsPercent: 50,
  otherRightsPercent: null,
  isMaterialShareholder: null,
  salaryMonths1To9: 90_000,
  salaryMonths10To12: 30_000.5,
  otherPayments: 0,
  businessId: 'business-1',
};

function row(patch: Partial<ShareholderRow> = {}): ShareholderRow {
  return { ...emptyShareholderRow('k'), idNumber: '123', fullName: 'Dana', ...patch };
}

describe('shareholderToRow / rowToShareholderInput', () => {
  it('round-trips a saved shareholder, keeping its business link and unset fields', () => {
    const editable = shareholderToRow(saved);
    expect(editable.key).toBe('sh-1');
    expect(editable.dividendRightsPercent).toBe('62.5');
    expect(editable.otherRightsPercent).toBe('');
    expect(rowToShareholderInput(editable)).toEqual({
      idNumber: '012345678',
      fullName: 'ישראל ישראלי',
      isControllingShareholder: true,
      isMaterialShareholder: null,
      businessId: 'business-1',
      dividendRightsPercent: 62.5,
      votingRightsPercent: 50,
      otherRightsPercent: null,
      salaryMonths1To9: 90_000,
      salaryMonths10To12: 30_000.5,
      otherPayments: 0,
    });
  });

  it('trims text and sends blank numbers as null', () => {
    const input = rowToShareholderInput(
      row({ idNumber: ' 42 ', fullName: '  Dana Levi ', votingRightsPercent: '  ' }),
    );
    expect(input.idNumber).toBe('42');
    expect(input.fullName).toBe('Dana Levi');
    expect(input.votingRightsPercent).toBeNull();
    expect(input.businessId).toBeNull();
  });

  it('parses numeric text', () => {
    expect(parseNumericText('')).toBeNull();
    expect(parseNumericText(' 12.25 ')).toBe(12.25);
  });
});

describe('dividendRightsTotal', () => {
  it('adds up the dividend rights without float noise, skipping blanks and typos', () => {
    const rows = [
      row({ dividendRightsPercent: '33.3333' }),
      row({ dividendRightsPercent: '33.3333' }),
      row({ dividendRightsPercent: '33.3334' }),
      row({ dividendRightsPercent: '' }),
      row({ dividendRightsPercent: 'abc' }),
    ];
    expect(dividendRightsTotal(rows)).toBe(100);
    expect(isDividendTotalComplete(dividendRightsTotal(rows))).toBe(true);
  });

  it('flags a total other than 100', () => {
    expect(isDividendTotalComplete(dividendRightsTotal([row({ dividendRightsPercent: '60' })]))).toBe(
      false,
    );
    expect(isDividendTotalComplete(dividendRightsTotal([]))).toBe(false);
  });
});

describe('validateShareholderRow', () => {
  it('accepts a well-formed row', () => {
    expect(validateShareholderRow(shareholderToRow(saved))).toEqual({});
  });

  it('requires an ID of 1-9 digits and a name of at most 200 characters', () => {
    expect(validateShareholderRow(row({ idNumber: '' })).idNumber).toBeDefined();
    expect(validateShareholderRow(row({ idNumber: '1234567890' })).idNumber).toBeDefined();
    expect(validateShareholderRow(row({ idNumber: '12-34' })).idNumber).toBeDefined();
    expect(validateShareholderRow(row({ fullName: '   ' })).fullName).toBeDefined();
    expect(validateShareholderRow(row({ fullName: 'א'.repeat(201) })).fullName).toBeDefined();
    expect(validateShareholderRow(row({ fullName: 'א'.repeat(200) })).fullName).toBeUndefined();
  });

  it('checks percents: non-negative, at most 100, at most 4 decimals', () => {
    expect(validateShareholderRow(row({ dividendRightsPercent: '-1' })).dividendRightsPercent).toBe(
      'Must be a non-negative number',
    );
    expect(validateShareholderRow(row({ votingRightsPercent: '100.01' })).votingRightsPercent).toBe(
      'Must be at most 100',
    );
    expect(validateShareholderRow(row({ otherRightsPercent: '1.23456' })).otherRightsPercent).toBe(
      'At most 4 decimals',
    );
    expect(validateShareholderRow(row({ otherRightsPercent: '0' }))).toEqual({});
    expect(validateShareholderRow(row({ dividendRightsPercent: '100' }))).toEqual({});
  });

  it('checks amounts are non-negative numbers', () => {
    expect(validateShareholderRow(row({ salaryMonths1To9: '-5' })).salaryMonths1To9).toBeDefined();
    expect(validateShareholderRow(row({ otherPayments: '1,000' })).otherPayments).toBeDefined();
    expect(validateShareholderRow(row({ salaryMonths10To12: '1000.75' }))).toEqual({});
  });

  it('reports whether any row has errors', () => {
    expect(hasShareholderRowErrors([{}, {}])).toBe(false);
    expect(hasShareholderRowErrors([{}, { idNumber: 'x' }])).toBe(true);
  });
});

describe('moveShareholderRow', () => {
  const rows = ['a', 'b', 'c'].map(key => row({ key }));

  it('moves a row up or down', () => {
    expect(moveShareholderRow(rows, 2, -1).map(r => r.key)).toEqual(['a', 'c', 'b']);
    expect(moveShareholderRow(rows, 0, 1).map(r => r.key)).toEqual(['b', 'a', 'c']);
  });

  it('leaves the list as is when the move would leave it', () => {
    expect(moveShareholderRow(rows, 0, -1)).toBe(rows);
    expect(moveShareholderRow(rows, 2, 1)).toBe(rows);
  });
});

describe('sameShareholderRows', () => {
  it('ignores local keys but not order or values', () => {
    const a = [row({ key: 'x', idNumber: '1' }), row({ key: 'y', idNumber: '2' })];
    const b = [row({ key: 'p', idNumber: '1' }), row({ key: 'q', idNumber: '2' })];
    expect(sameShareholderRows(a, b)).toBe(true);
    expect(sameShareholderRows(a, [...b].reverse())).toBe(false);
    expect(sameShareholderRows(a, [b[0]])).toBe(false);
    expect(sameShareholderRows(a, [b[0], { ...b[1], isMaterialShareholder: false }])).toBe(false);
  });
});
