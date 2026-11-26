import { GraphQLError } from 'graphql';
import { describe, expect, it } from 'vitest';
import type { IGetShareholdersByOwnerAndYearsResult } from '../../types.js';
import {
  assertReport1214Year,
  mapShareholderRow,
  normalizeIdNumber,
  normalizeShareholderInputs,
  translateShareholdersWriteError,
  type RawShareholderInput,
} from '../shareholders.helper.js';

const row = (overrides: Partial<RawShareholderInput> = {}): RawShareholderInput => ({
  idNumber: '123456782',
  fullName: 'Dana Cohen',
  isControllingShareholder: true,
  ...overrides,
});

function badUserInput(fn: () => unknown): GraphQLError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(GraphQLError);
    expect((error as GraphQLError).extensions.code).toBe('BAD_USER_INPUT');
    return error as GraphQLError;
  }
  throw new Error('expected a BAD_USER_INPUT error');
}

describe('normalizeIdNumber', () => {
  it('left-pads 1-9 digits to 9', () => {
    expect(normalizeIdNumber('5')).toBe('000000005');
    expect(normalizeIdNumber('12345678')).toBe('012345678');
    expect(normalizeIdNumber('123456782')).toBe('123456782');
    expect(normalizeIdNumber(' 516123452 ')).toBe('516123452');
  });

  it('rejects anything but 1-9 digits', () => {
    for (const value of ['', '   ', '1234567890', '12-345', 'abc', '1.5', '-1']) {
      expect(normalizeIdNumber(value)).toBeNull();
    }
  });
});

describe('assertReport1214Year', () => {
  it('accepts 2000-2100', () => {
    expect(() => assertReport1214Year(2000)).not.toThrow();
    expect(() => assertReport1214Year(2100)).not.toThrow();
  });

  it('rejects years the table cannot hold, naming the argument', () => {
    expect(badUserInput(() => assertReport1214Year(1999)).message).toMatch(/^year /);
    expect(badUserInput(() => assertReport1214Year(40_000, 'toYear')).message).toMatch(
      /^toYear /,
    );
  });
});

describe('normalizeShareholderInputs', () => {
  it('pads ID numbers, trims names and fills absent optionals with null', () => {
    expect(normalizeShareholderInputs([row({ idNumber: '42', fullName: '  Dana  ' })])).toEqual([
      {
        idNumber: '000000042',
        fullName: 'Dana',
        isControllingShareholder: true,
        dividendRightsPercent: null,
        votingRightsPercent: null,
        otherRightsPercent: null,
        isMaterialShareholder: null,
        salaryMonths1To9: null,
        salaryMonths10To12: null,
        otherPayments: null,
        businessId: null,
      },
    ]);
  });

  it('keeps provided values, including 0 and false', () => {
    const [normalized] = normalizeShareholderInputs([
      row({
        dividendRightsPercent: 0,
        votingRightsPercent: 100,
        otherRightsPercent: 12.5,
        isMaterialShareholder: false,
        salaryMonths1To9: 0,
        salaryMonths10To12: 1234.56,
        otherPayments: -10,
        businessId: '00000000-0000-0000-0000-000000000001',
      }),
    ]);
    expect(normalized).toMatchObject({
      dividendRightsPercent: 0,
      votingRightsPercent: 100,
      otherRightsPercent: 12.5,
      isMaterialShareholder: false,
      salaryMonths1To9: 0,
      salaryMonths10To12: 1234.56,
      otherPayments: -10,
      businessId: '00000000-0000-0000-0000-000000000001',
    });
  });

  it('names the row of a bad ID number', () => {
    const error = badUserInput(() =>
      normalizeShareholderInputs([row(), row({ idNumber: '1234567890' })]),
    );
    expect(error.message).toMatch(/^Shareholder row 2: ID number/);
  });

  it('requires a non-blank name', () => {
    expect(
      badUserInput(() => normalizeShareholderInputs([row({ fullName: '   ' })])).message,
    ).toMatch(/^Shareholder row 1: full name/);
  });

  it('rejects percentages outside 0-100', () => {
    expect(
      badUserInput(() => normalizeShareholderInputs([row({ votingRightsPercent: 100.01 })]))
        .message,
    ).toMatch(/^Shareholder row 1: votingRightsPercent/);
    badUserInput(() => normalizeShareholderInputs([row({ dividendRightsPercent: -1 })]));
  });

  it('rejects a repeated ID number, compared after padding', () => {
    const error = badUserInput(() =>
      normalizeShareholderInputs([row({ idNumber: '42' }), row({ idNumber: '000000042' })]),
    );
    expect(error.message).toBe(
      'Shareholder row 2: ID number 000000042 is already used by shareholder row 1',
    );
  });

  it('lets several shareholders share the placeholder ID numbers', () => {
    const rows = normalizeShareholderInputs([
      row({ idNumber: '999999964', fullName: 'Foreign A' }),
      row({ idNumber: '999999964', fullName: 'Foreign B' }),
      row({ idNumber: '999999998', fullName: 'Public A' }),
      row({ idNumber: '999999998', fullName: 'Public B' }),
    ]);
    expect(rows.map(r => r.idNumber)).toEqual([
      '999999964',
      '999999964',
      '999999998',
      '999999998',
    ]);
  });
});

describe('normalizeShareholderInputs caps and precision', () => {
  it('accepts 99 rows and rejects 100', () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, i) => row({ idNumber: String(i + 1) }));
    expect(normalizeShareholderInputs(many(99))).toHaveLength(99);
    expect(badUserInput(() => normalizeShareholderInputs(many(100))).message).toMatch(
      /^At most 99 shareholders/,
    );
  });

  it('caps the trimmed name at 200 characters', () => {
    expect(() =>
      normalizeShareholderInputs([row({ fullName: ` ${'a'.repeat(200)} ` })]),
    ).not.toThrow();
    expect(
      badUserInput(() => normalizeShareholderInputs([row({ fullName: 'a'.repeat(201) })])).message,
    ).toMatch(/^Shareholder row 1: full name must be at most 200 characters/);
  });

  it('accepts up to 4 percent decimals and rejects more, never rounding', () => {
    const [kept] = normalizeShareholderInputs([row({ dividendRightsPercent: 12.3456 })]);
    expect(kept.dividendRightsPercent).toBe(12.3456);
    expect(
      badUserInput(() => normalizeShareholderInputs([row({ votingRightsPercent: 12.34567 })]))
        .message,
    ).toMatch(/^Shareholder row 1: votingRightsPercent must have at most 4 decimal places/);
  });

  it('lowercases a linked business ID', () => {
    const [normalized] = normalizeShareholderInputs([
      row({ businessId: '0000000A-0000-0000-0000-00000000000B' }),
    ]);
    expect(normalized.businessId).toBe('0000000a-0000-0000-0000-00000000000b');
  });
});

describe('mapShareholderRow', () => {
  const dbRow: IGetShareholdersByOwnerAndYearsResult = {
    id: '019a0000-0000-7000-8000-000000000001',
    owner_id: '00000000-0000-0000-0000-0000000000aa',
    year: 2025,
    business_id: null,
    id_number: '000000042',
    full_name: 'Dana',
    is_controlling: true,
    dividend_rights_percent: '12.5000',
    voting_rights_percent: '0.0000',
    other_rights_percent: null,
    is_material: null,
    salary_months_1_to_9: '90000',
    salary_months_10_to_12: null,
    other_payments: '1234.56',
    sort_order: 3,
    created_at: new Date(0),
    updated_at: new Date(0),
  };

  it('converts numeric strings to numbers and keeps nulls', () => {
    expect(mapShareholderRow(dbRow)).toEqual({
      id: dbRow.id,
      ownerId: dbRow.owner_id,
      year: 2025,
      businessId: null,
      idNumber: '000000042',
      fullName: 'Dana',
      isControllingShareholder: true,
      dividendRightsPercent: 12.5,
      votingRightsPercent: 0,
      otherRightsPercent: null,
      isMaterialShareholder: null,
      salaryMonths1To9: 90_000,
      salaryMonths10To12: null,
      otherPayments: 1234.56,
      sortOrder: 3,
    });
  });
});

describe('translateShareholdersWriteError', () => {
  const pgError = (code: string) => Object.assign(new Error(`pg ${code}`), { code });

  it('turns a unique violation into BAD_USER_INPUT without the Postgres message', () => {
    const error = translateShareholdersWriteError(pgError('23505'), 'owner', 2025);
    expect(error).toBeInstanceOf(GraphQLError);
    expect((error as GraphQLError).extensions.code).toBe('BAD_USER_INPUT');
    expect((error as GraphQLError).message).not.toMatch(/pg 23505/);
  });

  it('turns a check violation into BAD_USER_INPUT', () => {
    const error = translateShareholdersWriteError(pgError('23514'), 'owner', 2025);
    expect((error as GraphQLError).extensions.code).toBe('BAD_USER_INPUT');
    expect((error as GraphQLError).message).toBe('A shareholder value is out of range');
  });

  it('turns an RLS rejection into FORBIDDEN', () => {
    const error = translateShareholdersWriteError(pgError('42501'), 'owner', 2025);
    expect((error as GraphQLError).extensions.code).toBe('FORBIDDEN');
  });

  it('passes anything else through', () => {
    const original = pgError('22003');
    expect(translateShareholdersWriteError(original, 'owner', 2025)).toBe(original);
  });
});
