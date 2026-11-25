import type { ShareholderInput } from '../../../../gql/graphql.js';

/** A shareholder as the report query returns it. */
export type ShareholderData = {
  id: string;
  idNumber: string;
  fullName: string;
  isControllingShareholder: boolean;
  dividendRightsPercent?: number | null;
  votingRightsPercent?: number | null;
  otherRightsPercent?: number | null;
  isMaterialShareholder?: boolean | null;
  salaryMonths1To9?: number | null;
  salaryMonths10To12?: number | null;
  otherPayments?: number | null;
  businessId?: string | null;
};

/** The numeric fields of a shareholder, edited as text so a half-typed number survives. */
export const PERCENT_FIELDS = [
  'dividendRightsPercent',
  'votingRightsPercent',
  'otherRightsPercent',
] as const;
export const AMOUNT_FIELDS = ['salaryMonths1To9', 'salaryMonths10To12', 'otherPayments'] as const;

type PercentField = (typeof PERCENT_FIELDS)[number];
type AmountField = (typeof AMOUNT_FIELDS)[number];
export type NumericField = PercentField | AmountField;

/** One editable row of the shareholders table. `key` is local: React's key, never sent. */
export type ShareholderRow = {
  key: string;
  idNumber: string;
  fullName: string;
  isControllingShareholder: boolean;
  /** `null` while never set, so an untouched row saves it as it was. */
  isMaterialShareholder: boolean | null;
  /** Not editable here unless a business is picked; kept so a save does not unlink it. */
  businessId: string | null;
} & Record<NumericField, string>;

export type ShareholderRowField = Exclude<keyof ShareholderRow, 'key'>;

/** Format problems of one row, by field. */
export type ShareholderRowErrors = Partial<Record<ShareholderRowField, string>>;

/** The most shareholders form 1214 (and the server) takes. */
export const MAX_SHAREHOLDERS = 99;

const ID_NUMBER_PATTERN = /^\d{1,9}$/;
const NON_NEGATIVE_NUMBER_PATTERN = /^\d+(\.\d+)?$/;
const MAX_PERCENT_DECIMALS = 4;
const MAX_FULL_NAME_LENGTH = 200;

function numberToText(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

/** The text of a numeric cell as the number to send: blank is `null`. */
export function parseNumericText(text: string): number | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : Number(trimmed);
}

export function shareholderToRow(shareholder: ShareholderData): ShareholderRow {
  return {
    key: shareholder.id,
    idNumber: shareholder.idNumber,
    fullName: shareholder.fullName,
    isControllingShareholder: shareholder.isControllingShareholder,
    isMaterialShareholder: shareholder.isMaterialShareholder ?? null,
    businessId: shareholder.businessId ?? null,
    dividendRightsPercent: numberToText(shareholder.dividendRightsPercent),
    votingRightsPercent: numberToText(shareholder.votingRightsPercent),
    otherRightsPercent: numberToText(shareholder.otherRightsPercent),
    salaryMonths1To9: numberToText(shareholder.salaryMonths1To9),
    salaryMonths10To12: numberToText(shareholder.salaryMonths10To12),
    otherPayments: numberToText(shareholder.otherPayments),
  };
}

export function emptyShareholderRow(key: string): ShareholderRow {
  return {
    key,
    idNumber: '',
    fullName: '',
    isControllingShareholder: false,
    isMaterialShareholder: null,
    businessId: null,
    dividendRightsPercent: '',
    votingRightsPercent: '',
    otherRightsPercent: '',
    salaryMonths1To9: '',
    salaryMonths10To12: '',
    otherPayments: '',
  };
}

/** The row as `setShareholders` takes it. Assumes {@link validateShareholderRow} found nothing. */
export function rowToShareholderInput(row: ShareholderRow): ShareholderInput {
  return {
    idNumber: row.idNumber.trim(),
    fullName: row.fullName.trim(),
    isControllingShareholder: row.isControllingShareholder,
    isMaterialShareholder: row.isMaterialShareholder,
    businessId: row.businessId,
    dividendRightsPercent: parseNumericText(row.dividendRightsPercent),
    votingRightsPercent: parseNumericText(row.votingRightsPercent),
    otherRightsPercent: parseNumericText(row.otherRightsPercent),
    salaryMonths1To9: parseNumericText(row.salaryMonths1To9),
    salaryMonths10To12: parseNumericText(row.salaryMonths10To12),
    otherPayments: parseNumericText(row.otherPayments),
  };
}

/** Whether two lists hold the same shareholders in the same order (local keys aside). */
export function sameShareholderRows(a: ShareholderRow[], b: ShareholderRow[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((row, index) => {
    const other = b[index];
    return (Object.keys(row) as Array<keyof ShareholderRow>).every(
      field => field === 'key' || row[field] === other[field],
    );
  });
}

/**
 * The sum of the rows' dividend rights, in percent. Cells that are blank or not a number count as
 * zero; the sum is rounded to the 4 decimals a percent may have, so float noise never shows.
 */
export function dividendRightsTotal(rows: ShareholderRow[]): number {
  const total = rows.reduce((sum, row) => {
    const value = parseNumericText(row.dividendRightsPercent);
    return value === null || Number.isNaN(value) ? sum : sum + value;
  }, 0);
  return Math.round(total * 10 ** MAX_PERCENT_DECIMALS) / 10 ** MAX_PERCENT_DECIMALS;
}

/** Whether the dividend rights add up to 100%, as the generator expects. */
export function isDividendTotalComplete(total: number): boolean {
  return Math.abs(total - 100) < 1e-9;
}

function decimalCount(text: string): number {
  const [, decimals = ''] = text.split('.');
  return decimals.length;
}

/**
 * Format checks only, mirroring the server's input checks, so an obvious typo is caught before the
 * round trip. Whatever needs the whole list (duplicate IDs, the 100% total) is left to the server
 * and the generator.
 */
export function validateShareholderRow(row: ShareholderRow): ShareholderRowErrors {
  const errors: ShareholderRowErrors = {};

  const idNumber = row.idNumber.trim();
  if (!ID_NUMBER_PATTERN.test(idNumber)) {
    errors.idNumber = 'ID number must be 1-9 digits';
  }

  const fullName = row.fullName.trim();
  if (fullName === '') {
    errors.fullName = 'Full name is required';
  } else if (fullName.length > MAX_FULL_NAME_LENGTH) {
    errors.fullName = `Full name must be at most ${MAX_FULL_NAME_LENGTH} characters`;
  }

  for (const field of PERCENT_FIELDS) {
    const text = row[field].trim();
    if (text === '') {
      continue;
    }
    if (!NON_NEGATIVE_NUMBER_PATTERN.test(text)) {
      errors[field] = 'Must be a non-negative number';
    } else if (Number(text) > 100) {
      errors[field] = 'Must be at most 100';
    } else if (decimalCount(text) > MAX_PERCENT_DECIMALS) {
      errors[field] = `At most ${MAX_PERCENT_DECIMALS} decimals`;
    }
  }

  for (const field of AMOUNT_FIELDS) {
    const text = row[field].trim();
    if (text !== '' && !NON_NEGATIVE_NUMBER_PATTERN.test(text)) {
      errors[field] = 'Must be a non-negative number';
    }
  }

  return errors;
}

/** Whether any row has a format problem. */
export function hasShareholderRowErrors(errors: ShareholderRowErrors[]): boolean {
  return errors.some(rowErrors => Object.keys(rowErrors).length > 0);
}

/** The rows with the one at `index` moved by `offset`; unchanged when that leaves the list. */
export function moveShareholderRow(
  rows: ShareholderRow[],
  index: number,
  offset: number,
): ShareholderRow[] {
  const target = index + offset;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) {
    return rows;
  }
  const next = [...rows];
  const [row] = next.splice(index, 1);
  next.splice(target, 0, row);
  return next;
}
