import { GraphQLError } from 'graphql';
import type { IGetShareholdersByOwnerAndYearsResult, ShareholderProto } from '../types.js';

/** Most shareholders form 1214 can carry: record 1020's maxOccurs (`struct.shareholders.max`). */
export const MAX_SHAREHOLDERS = 99;

/** Longest shareholder name stored; the generator reports its own, shorter field limit. */
export const MAX_SHAREHOLDER_NAME_LENGTH = 200;

/** Decimal places the `numeric(7, 4)` percent columns hold. */
const PERCENT_DECIMALS = 4;

/** Tax years the shareholders and 1214 profile tables accept (DB CHECK on `year`). */
export const MIN_REPORT_1214_YEAR = 2000;
export const MAX_REPORT_1214_YEAR = 2100;

/**
 * ID numbers many shareholders of one owner and year may share (SPEC p.22): `999999964` for a
 * shareholder not registered in Israel, `999999998` for a public holding. Every other ID number is
 * unique per owner and year.
 */
export const SHARED_PLACEHOLDER_ID_NUMBERS: ReadonlySet<string> = new Set([
  '999999964',
  '999999998',
]);

/** A shareholder row as the resolver hands it to the provider: validated and normalized. */
export interface ShareholderRowInput {
  idNumber: string;
  fullName: string;
  isControllingShareholder: boolean;
  dividendRightsPercent: number | null;
  votingRightsPercent: number | null;
  otherRightsPercent: number | null;
  isMaterialShareholder: boolean | null;
  salaryMonths1To9: number | null;
  salaryMonths10To12: number | null;
  otherPayments: number | null;
  businessId: string | null;
}

/** The editable shareholder fields as GraphQL delivers them (`ShareholderInput`). */
export interface RawShareholderInput {
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
}

function badUserInput(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

/** Throws `BAD_USER_INPUT` unless `year` is a tax year the 1214 tables can hold. */
export function assertReport1214Year(year: number, argName = 'year'): void {
  if (!Number.isInteger(year) || year < MIN_REPORT_1214_YEAR || year > MAX_REPORT_1214_YEAR) {
    throw badUserInput(
      `${argName} must be a year between ${MIN_REPORT_1214_YEAR} and ${MAX_REPORT_1214_YEAR} (got ${year})`,
    );
  }
}

/**
 * Normalizes an Israeli ID / company number to the stored form: 1-9 digits, left-padded with
 * zeros to 9. Surrounding whitespace is ignored. Returns `null` when the value is not 1-9 digits.
 */
export function normalizeIdNumber(idNumber: string): string | null {
  const trimmed = idNumber.trim();
  if (!/^\d{1,9}$/.test(trimmed)) {
    return null;
  }
  return trimmed.padStart(9, '0');
}

const PERCENT_FIELDS = [
  'dividendRightsPercent',
  'votingRightsPercent',
  'otherRightsPercent',
] as const satisfies ReadonlyArray<keyof RawShareholderInput>;

const AMOUNT_FIELDS = [
  'salaryMonths1To9',
  'salaryMonths10To12',
  'otherPayments',
] as const satisfies ReadonlyArray<keyof RawShareholderInput>;

/**
 * Validates and normalizes the shareholder rows of a `setShareholders` call, before anything
 * reaches the database. Errors are `BAD_USER_INPUT` and name the row by its index in the list.
 *
 * Only storage-level rules are checked here (at most 99 rows, ID format, a name of at most 200
 * characters, percentages within 0-100 with at most 4 decimals, no repeated ID number). Linked
 * business IDs are lowercased, as the UUID scalar keeps the caller's case. The form's own business
 * rules (dividend rights adding up to 100, at most two decimals, ...) are reported by the 1214
 * generator's validation, not here.
 */
export function normalizeShareholderInputs(
  rows: ReadonlyArray<RawShareholderInput>,
): ShareholderRowInput[] {
  if (rows.length > MAX_SHAREHOLDERS) {
    throw badUserInput(
      `At most ${MAX_SHAREHOLDERS} shareholders can be stored for a year (got ${rows.length})`,
    );
  }
  const firstRowByIdNumber = new Map<string, number>();

  return rows.map((row, index) => {
    const label = `Shareholder row ${index}`;

    const idNumber = normalizeIdNumber(row.idNumber);
    if (!idNumber) {
      throw badUserInput(`${label}: ID number must be 1 to 9 digits (got "${row.idNumber}")`);
    }
    if (!SHARED_PLACEHOLDER_ID_NUMBERS.has(idNumber)) {
      const firstIndex = firstRowByIdNumber.get(idNumber);
      if (firstIndex !== undefined) {
        throw badUserInput(
          `${label}: ID number ${idNumber} is already used by shareholder row ${firstIndex}`,
        );
      }
      firstRowByIdNumber.set(idNumber, index);
    }

    const fullName = row.fullName.trim();
    if (!fullName) {
      throw badUserInput(`${label}: full name is required`);
    }
    if (fullName.length > MAX_SHAREHOLDER_NAME_LENGTH) {
      throw badUserInput(
        `${label}: full name must be at most ${MAX_SHAREHOLDER_NAME_LENGTH} characters (got ${fullName.length})`,
      );
    }

    for (const field of PERCENT_FIELDS) {
      const value = row[field];
      if (value != null && !(Number.isFinite(value) && value >= 0 && value <= 100)) {
        throw badUserInput(`${label}: ${field} must be between 0 and 100 (got ${value})`);
      }
      if (value != null && Number(value.toFixed(PERCENT_DECIMALS)) !== value) {
        throw badUserInput(
          `${label}: ${field} must have at most ${PERCENT_DECIMALS} decimal places (got ${value})`,
        );
      }
    }
    for (const field of AMOUNT_FIELDS) {
      const value = row[field];
      if (value != null && !Number.isFinite(value)) {
        throw badUserInput(`${label}: ${field} must be a finite number`);
      }
    }

    return {
      idNumber,
      fullName,
      isControllingShareholder: row.isControllingShareholder,
      dividendRightsPercent: row.dividendRightsPercent ?? null,
      votingRightsPercent: row.votingRightsPercent ?? null,
      otherRightsPercent: row.otherRightsPercent ?? null,
      isMaterialShareholder: row.isMaterialShareholder ?? null,
      salaryMonths1To9: row.salaryMonths1To9 ?? null,
      salaryMonths10To12: row.salaryMonths10To12 ?? null,
      otherPayments: row.otherPayments ?? null,
      businessId: row.businessId?.toLowerCase() ?? null,
    };
  });
}

/** pg returns `numeric` as a string (`"12.5000"`); GraphQL wants a number, and null stays null. */
function numericToNumber(value: string | null): number | null {
  return value == null ? null : Number(value);
}

/** Maps a `shareholders` row to the GraphQL `Shareholder` parent object. */
export function mapShareholderRow(row: IGetShareholdersByOwnerAndYearsResult): ShareholderProto {
  return {
    id: row.id,
    ownerId: row.owner_id,
    year: row.year,
    businessId: row.business_id,
    idNumber: row.id_number,
    fullName: row.full_name,
    isControllingShareholder: row.is_controlling,
    dividendRightsPercent: numericToNumber(row.dividend_rights_percent),
    votingRightsPercent: numericToNumber(row.voting_rights_percent),
    otherRightsPercent: numericToNumber(row.other_rights_percent),
    isMaterialShareholder: row.is_material,
    salaryMonths1To9: numericToNumber(row.salary_months_1_to_9),
    salaryMonths10To12: numericToNumber(row.salary_months_10_to_12),
    otherPayments: numericToNumber(row.other_payments),
    sortOrder: row.sort_order,
  };
}

/** Postgres error codes the shareholder writes translate into user-facing errors. */
const PG_UNIQUE_VIOLATION = '23505';
const PG_INSUFFICIENT_PRIVILEGE = '42501';
const PG_CHECK_VIOLATION = '23514';

function pgErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Turns the database errors a shareholder write can hit into GraphQL errors the caller can act
 * on, instead of leaking the raw Postgres message. Anything else is rethrown as is.
 */
export function translateShareholdersWriteError(
  error: unknown,
  ownerId: string,
  year: number,
): unknown {
  switch (pgErrorCode(error)) {
    case PG_UNIQUE_VIOLATION:
      return new GraphQLError(
        'Each shareholder of a year needs a distinct ID number (other than the shared placeholders 999999964 / 999999998)',
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    case PG_CHECK_VIOLATION:
      return new GraphQLError('A shareholder value is out of range', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    case PG_INSUFFICIENT_PRIVILEGE:
      return new GraphQLError(
        `Not authorized to change the shareholders of business ${ownerId} for ${year}`,
        { extensions: { code: 'FORBIDDEN' } },
      );
    default:
      return error;
  }
}
