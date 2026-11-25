import { describe, expect, it } from 'vitest';
import {
  dividendRightsTotal,
  emptyShareholderRow,
  findDuplicateIdNumbers,
  hasShareholderRowErrors,
  isDividendTotalComplete,
  moveShareholderRow,
  parseNumericText,
  rowToShareholderInput,
  sameShareholderRows,
  shareholderToRow,
  validateShareholderRow,
  validateShareholderRows,
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
      'Use digits and a dot, e.g. 12.5',
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

  it('accepts a leading or trailing dot and trailing zeros beyond 4 decimals', () => {
    expect(
      validateShareholderRow(
        row({ dividendRightsPercent: '.5', votingRightsPercent: '5.', otherRightsPercent: '12.50000' }),
      ),
    ).toEqual({});
    expect(rowToShareholderInput(row({ dividendRightsPercent: '.5' })).dividendRightsPercent).toBe(
      0.5,
    );
  });

  it('rejects text that is not a plain finite number', () => {
    for (const text of ['1e3', '1,000', '.', '1.2.3', 'Infinity']) {
      expect(validateShareholderRow(row({ dividendRightsPercent: text })).dividendRightsPercent).toBe(
        'Use digits and a dot, e.g. 12.5',
      );
    }
    expect(validateShareholderRow(row({ otherPayments: '9'.repeat(400) })).otherPayments).toBeDefined();
  });

  it('accepts signed amounts', () => {
    expect(
      validateShareholderRow(
        row({ salaryMonths1To9: '-5', salaryMonths10To12: '1000.75', otherPayments: '-.5' }),
      ),
    ).toEqual({});
    expect(validateShareholderRow(row({ otherPayments: '1,000' })).otherPayments).toMatch(
      /^Must be a number/,
    );
    expect(validateShareholderRow(row({ salaryMonths1To9: '--5' })).salaryMonths1To9).toBeDefined();
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
    expect(sameShareholderRows(a, [b[0], { ...b[1], isMaterialShareholder: true }])).toBe(false);
  });

  it('treats an unset material flag as false, as the generator writes both as 0', () => {
    const unset = [row({ isMaterialShareholder: null })];
    expect(sameShareholderRows(unset, [row({ isMaterialShareholder: false })])).toBe(true);
    expect(sameShareholderRows([row({ isMaterialShareholder: false })], unset)).toBe(true);
    expect(sameShareholderRows(unset, [row({ isMaterialShareholder: true })])).toBe(false);
  });
});

describe('findDuplicateIdNumbers / validateShareholderRows', () => {
  it('finds IDs that repeat once zero-padded, pointing at the first row', () => {
    const rows = [
      row({ idNumber: '12345' }),
      row({ idNumber: '777' }),
      row({ idNumber: '000012345' }),
      row({ idNumber: ' 12345 ' }),
    ];
    expect(findDuplicateIdNumbers(rows)).toEqual(
      new Map([
        [2, 0],
        [3, 0],
      ]),
    );
    const errors = validateShareholderRows(rows);
    expect(errors[0]).toEqual({});
    expect(errors[2].idNumber).toBe('Same ID as row 1');
    expect(errors[3].idNumber).toBe('Same ID as row 1');
  });

  it('lets the placeholder IDs repeat, padded or not', () => {
    const rows = [
      row({ idNumber: '999999964' }),
      row({ idNumber: '999999964' }),
      row({ idNumber: '999999998' }),
      row({ idNumber: '999999998' }),
    ];
    expect(findDuplicateIdNumbers(rows).size).toBe(0);
    expect(hasShareholderRowErrors(validateShareholderRows(rows))).toBe(false);
  });

  it('leaves malformed IDs to the format check', () => {
    const rows = [row({ idNumber: 'abc' }), row({ idNumber: 'abc' })];
    expect(findDuplicateIdNumbers(rows).size).toBe(0);
    expect(validateShareholderRows(rows)[1].idNumber).toBe('ID number must be 1-9 digits');
  });
});
