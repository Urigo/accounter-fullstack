import { MissingChargeInfo } from '../../gql/graphql.js';
import type { ChargeType } from '../../helpers/index.js';

/**
 * Display attributes of a collapsed charge record, in the same order as the columns of the spec
 * spreadsheet. `MATRIX` rows below are positional against this list, so the two can be read
 * side by side against the sheet.
 *
 * "Charge management" from the spec — selection checkbox, accountant-approval status button,
 * expansion toggle, charge menu — is universal across all 11 types and so is deliberately not a
 * field here. It is always rendered.
 */
export const CHARGE_FIELDS = [
  'type',
  'mainDate',
  'dateRange',
  'amount',
  'vat',
  'mainCounterparty',
  'description',
  'tags',
  'mainTaxCategory',
  'businessTrip',
  'transactionsCount',
  'documentsCount',
  'miscExpensesCount',
  'ledgerCount',
] as const;

export type ChargeField = (typeof CHARGE_FIELDS)[number];

/** Human wording for each attribute, matching the spec sheet's column headings. */
export const CHARGE_FIELD_LABEL: Record<ChargeField, string> = {
  type: 'type',
  mainDate: 'main date',
  dateRange: 'date range',
  amount: 'amount',
  vat: 'VAT',
  mainCounterparty: 'main counterparty',
  description: 'description',
  tags: 'tags',
  mainTaxCategory: 'main tax category',
  businessTrip: 'business trip',
  transactionsCount: 'transactions',
  documentsCount: 'documents',
  miscExpensesCount: 'misc expenses',
  ledgerCount: 'ledger',
};

/**
 * Per-field visibility:
 * - `0` — never rendered for this charge type, *regardless of what the data holds*. The matrix is
 *   authoritative, so a record's shape is a pure function of its `__typename` and is directly
 *   assertable in a test.
 * - `1` — rendered.
 * - `2` — rendered, special-cased. See {@link isSpecialField}.
 */
type Visibility = 0 | 1 | 2;

/**
 * The spec matrix. One row per charge type, positional against {@link CHARGE_FIELDS}, mirroring the
 * spec spreadsheet 1:1 so a cell can be diffed against it by eye.
 *
 * Note how little of this a table could express: `vat` and `businessTrip` each apply to exactly one
 * of eleven types, which is why the record composes fields per type rather than sharing columns.
 */
// prettier-ignore
const MATRIX: Record<ChargeType, readonly Visibility[]> = {
  //                          ty md dr am vat cp de tg tax bt tx doc me ldg
  BankDepositCharge:         [ 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1 ],
  BusinessTripCharge:        [ 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1 ],
  CommonCharge:              [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1 ],
  ConversionCharge:          [ 1, 1, 0, 2, 0, 0, 1, 1, 1, 0, 1, 0, 0, 1 ],
  CreditcardBankCharge:      [ 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 0, 1 ],
  DividendCharge:            [ 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1 ],
  FinancialCharge:           [ 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1 ],
  ForeignSecuritiesCharge:   [ 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1 ],
  InternalTransferCharge:    [ 1, 1, 1, 1, 0, 2, 1, 1, 0, 0, 1, 0, 1, 1 ],
  MonthlyVatCharge:          [ 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1 ],
  SalaryCharge:              [ 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1 ],
};

const FIELD_INDEX = new Map<ChargeField, number>(CHARGE_FIELDS.map((field, i) => [field, i]));

function visibility(type: ChargeType, field: ChargeField): Visibility {
  const row = MATRIX[type];
  if (!row) {
    // An unknown `__typename` (a charge type added server-side before the client caught up) should
    // degrade to showing what it can rather than rendering an empty record.
    return 1;
  }
  return row[FIELD_INDEX.get(field)!] ?? 0;
}

/** Whether `field` appears on a collapsed record of `type`. Consults only the matrix, never the data. */
export function isFieldVisible(type: ChargeType, field: ChargeField): boolean {
  return visibility(type, field) !== 0;
}

/**
 * Whether `field` needs this type's special-cased rendering (the spec's footnotes):
 * - `ConversionCharge.amount` — show the base *and* quote amounts, not one total.
 * - `InternalTransferCharge.mainCounterparty` — show both sides of the transfer.
 */
export function isSpecialField(type: ChargeType, field: ChargeField): boolean {
  return visibility(type, field) === 2;
}

/** The fields of `type`, in spec order. Handy for tests and for iterating a region's contents. */
export function visibleFields(type: ChargeType): ChargeField[] {
  return CHARGE_FIELDS.filter(field => isFieldVisible(type, field));
}

/**
 * The record field each {@link MissingChargeInfo} value would be reported against. Used to drop
 * missing-info the record has no place to show — see {@link relevantMissingInfo}.
 */
const MISSING_INFO_FIELD: Record<MissingChargeInfo, ChargeField> = {
  [MissingChargeInfo.Counterparty]: 'mainCounterparty',
  [MissingChargeInfo.Description]: 'description',
  [MissingChargeInfo.Documents]: 'documentsCount',
  [MissingChargeInfo.Tags]: 'tags',
  [MissingChargeInfo.TaxCategory]: 'mainTaxCategory',
  [MissingChargeInfo.Transactions]: 'transactionsCount',
  [MissingChargeInfo.Vat]: 'vat',
};

/**
 * Server-reported missing info, filtered to what this charge type actually displays.
 *
 * The server's own validation rules and this spec disagree in places — `validate.helper.ts` excludes
 * a required counterparty for InternalTransfer/Salary/Financial, while the spec hides the
 * counterparty field for BusinessTrip/Dividend/Conversion/Salary and more. Without this filter a
 * record would advertise a need for a field it never shows, and the needs badge would count
 * something the user cannot act on.
 */
export function relevantMissingInfo(
  type: ChargeType,
  missingInfo: readonly MissingChargeInfo[] | undefined,
): MissingChargeInfo[] {
  return (missingInfo ?? []).filter(info => isFieldVisible(type, MISSING_INFO_FIELD[info]));
}

/** Whether `info` is both reported missing and displayable on `type` — for per-field indicators. */
export function isMissing(
  type: ChargeType,
  missingInfo: readonly MissingChargeInfo[] | undefined,
  info: MissingChargeInfo,
): boolean {
  return !!missingInfo?.includes(info) && isFieldVisible(type, MISSING_INFO_FIELD[info]);
}
