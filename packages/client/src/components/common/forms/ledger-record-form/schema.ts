import { z } from 'zod';
import {
  Currency,
  LedgerRecordOperation,
  type LedgerRecordInput,
} from '../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../helpers/dates.js';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/index.js';

/**
 * The largest gap allowed between the debit and credit local totals. Mirrors the server's
 * `LEDGER_BALANCE_TOLERANCE` (ledger module, `manual-ledger-record.helper.ts`).
 */
export const LEDGER_BALANCE_TOLERANCE = 0.005;

/**
 * Binary floats make an exact 0.005 gap compute as e.g. 0.005000000000002558, so the server allows
 * a tiny epsilon over the tolerance. Kept identical here so the boundary is inclusive on both sides.
 */
const BALANCE_EPSILON = 1e-9;

export type LedgerRecordFormMode = 'insert' | 'edit';

export type LedgerRecordFormValues = {
  /** Insert mode only: the business operation the record represents */
  operation?: LedgerRecordOperation;
  /** The record's currency; foreign amounts apply only when it differs from the local currency */
  currency: Currency;
  invoiceDate: TimelessDateString;
  valueDate: TimelessDateString;
  description?: string;
  reference?: string;
  debitEntity1: string;
  debitLocalAmount1: number;
  creditEntity1: string;
  creditLocalAmount1: number;
  /**
   * Required (> 0) on every filled line in a foreign currency; ignored, and never sent, in the local
   * currency. `null` is a cleared value (see `LedgerRecordFormInput`).
   */
  debitForeignAmount1?: number | null;
  creditForeignAmount1?: number | null;
  /** The optional secondary lines (e.g. VAT): a line is filled once its entity is picked */
  debitEntity2?: string | null;
  debitLocalAmount2?: number | null;
  debitForeignAmount2?: number | null;
  creditEntity2?: string | null;
  creditLocalAmount2?: number | null;
  creditForeignAmount2?: number | null;
};

export const TIMELESS_DATE_FORMAT_MESSAGE = 'Date must be in format yyyy-mm-dd';

/**
 * Whether the raw text of a date input is something the date picker cannot parse. The picker only
 * reports empty or valid dates to the form, so without this check an edit from a valid date to an
 * invalid one would leave the old date in the form and submit it.
 */
export function isUnparsableDateText(text: string): boolean {
  return text.trim() !== '' && !TIMELESS_DATE_REGEX.test(text);
}

/**
 * What the form holds while it is being filled in: every field may still be empty, and dates are
 * plain strings until the schema checks their format.
 *
 * The form clears a field to `null`, never to `undefined`: react-hook-form re-applies a field's
 * default value when its input re-mounts while the field is `undefined`, which would bring a
 * cleared (e.g. prefilled) value back on screen and into the submitted record.
 */
export type LedgerRecordFormInput = {
  [Field in Exclude<keyof LedgerRecordFormValues, 'invoiceDate' | 'valueDate'>]?:
    LedgerRecordFormValues[Field] | null;
} & {
  invoiceDate?: string;
  valueDate?: string;
};

/** The form-level error path for an unbalanced record (not a field of its own) */
export const LEDGER_BALANCE_ERROR_PATH = 'balance';

export type LedgerSlotSide = 'debit' | 'credit';
/** 1 is a main line (required), 2 a secondary line (optional, e.g. VAT) */
export type LedgerSlotIndex = 1 | 2;

/** The form fields of one debit or credit line, named as in `LedgerRecordInput` */
export function ledgerSlotFieldNames<Side extends LedgerSlotSide, Index extends LedgerSlotIndex>(
  side: Side,
  index: Index,
) {
  return {
    entity: `${side}Entity${index}`,
    localAmount: `${side}LocalAmount${index}`,
    foreignAmount: `${side}ForeignAmount${index}`,
  } as const satisfies Record<string, keyof LedgerRecordFormValues>;
}

/** Every line of the form, in the server's order: the main lines first, then the secondary ones */
const LEDGER_SLOTS = [
  { side: 'debit', main: true, ...ledgerSlotFieldNames('debit', 1) },
  { side: 'credit', main: true, ...ledgerSlotFieldNames('credit', 1) },
  { side: 'debit', main: false, ...ledgerSlotFieldNames('debit', 2) },
  { side: 'credit', main: false, ...ledgerSlotFieldNames('credit', 2) },
] as const;

/** Every foreign-amount field of the form */
export const FOREIGN_AMOUNT_FIELDS = LEDGER_SLOTS.map(slot => slot.foreignAmount);

/** Every local-amount field of the form; the balance compares their debit and credit sums */
const LOCAL_AMOUNT_FIELDS = LEDGER_SLOTS.map(slot => slot.localAmount);

type LocalAmountField = (typeof LOCAL_AMOUNT_FIELDS)[number];

/** The fields the line rules read: they run once these parsed, whatever else is wrong */
const SLOT_RULE_FIELDS: ReadonlySet<PropertyKey> = new Set<keyof LedgerRecordFormValues>([
  'currency',
  ...FOREIGN_AMOUNT_FIELDS,
  ...LEDGER_SLOTS.filter(slot => !slot.main).flatMap(slot => [slot.entity, slot.localAmount]),
]);

/** The fields the balance rule reads */
const BALANCE_RULE_FIELDS: ReadonlySet<PropertyKey> = new Set<keyof LedgerRecordFormValues>(
  LOCAL_AMOUNT_FIELDS,
);

export type LedgerTotals = {
  debit: number;
  credit: number;
  /** Debit total minus credit total */
  difference: number;
  /** Whether the difference is within `LEDGER_BALANCE_TOLERANCE` */
  balanced: boolean;
};

/**
 * Sum the local amounts of both lines on each side, as the server's balance check does (an empty
 * amount counts as 0). Shared by the schema and the form's live totals.
 */
export function computeLedgerTotals(
  values: Partial<Record<LocalAmountField, number | null>>,
): LedgerTotals {
  let debit = 0;
  let credit = 0;
  for (const slot of LEDGER_SLOTS) {
    const amount = values[slot.localAmount] ?? 0;
    if (slot.side === 'debit') {
      debit += amount;
    } else {
      credit += amount;
    }
  }
  const difference = debit - credit;
  return {
    debit,
    credit,
    difference,
    balanced: Math.abs(difference) <= LEDGER_BALANCE_TOLERANCE + BALANCE_EPSILON,
  };
}

/**
 * A `when` for a record-level refinement. zod skips refinements once any issue exists, which would
 * hide them behind unrelated field errors; this runs one as long as the fields it reads parsed, so
 * every problem shows at once.
 */
function whenParsed(fields: ReadonlySet<PropertyKey>) {
  return ({
    value,
    issues,
  }: {
    value: unknown;
    issues: ReadonlyArray<{ path?: PropertyKey[] }>;
  }): boolean =>
    typeof value === 'object' &&
    value !== null &&
    !issues.some(issue => {
      const [field] = issue.path ?? [];
      return field !== undefined && fields.has(field);
    });
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

type BuildLedgerRecordFormSchemaOptions = {
  mode: LedgerRecordFormMode;
  localCurrency: Currency;
  ledgerLock?: string | null;
};

function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Whether a record in `currency` carries foreign amounts, i.e. is not in the local currency */
export function isForeignCurrency(
  currency: Currency | null | undefined,
  localCurrency: Currency,
): boolean {
  return !!currency && currency !== localCurrency;
}

/**
 * The zod schema behind `LedgerRecordForm`. Its rules match the server's
 * `validateManualLedgerRecord`, so a record that passes here is not rejected for shape reasons.
 */
export function buildLedgerRecordFormSchema({
  mode,
  localCurrency,
  ledgerLock,
}: BuildLedgerRecordFormSchemaOptions): z.ZodType<LedgerRecordFormValues, LedgerRecordFormInput> {
  // Both dates must be strictly after the lock date, matching the server (and `lockLedgerRecords`,
  // which locks every record dated on or before it). yyyy-mm-dd strings compare chronologically.
  const timelessDate = z
    .string({ message: 'Date is required' })
    .regex(TIMELESS_DATE_REGEX, TIMELESS_DATE_FORMAT_MESSAGE)
    .refine(date => !ledgerLock || date > ledgerLock, `Date must be after ${ledgerLock}`)
    .transform(date => date as TimelessDateString);

  const entity = z.string({ message: 'Entity is required' }).min(1, 'Entity is required');
  const amount = z.number({ message: 'Amount is required' }).gt(0, 'Amount must be greater than 0');
  // The optional values are checked against the line's entity and the currency in the record-level
  // refinements below
  const optionalEntity = z.string().nullish();
  const optionalAmount = z.number({ message: 'Amount must be a number' }).nullish();
  const foreignAmount = z.number({ message: 'Foreign amount must be a number' }).nullish();

  const base = z.object({
    currency: z.enum(Currency, { message: 'Currency is required' }),
    invoiceDate: timelessDate,
    valueDate: timelessDate,
    description: z.string().optional(),
    reference: z.string().optional(),
    debitEntity1: entity,
    debitLocalAmount1: amount,
    creditEntity1: entity,
    creditLocalAmount1: amount,
    debitForeignAmount1: foreignAmount,
    creditForeignAmount1: foreignAmount,
    debitEntity2: optionalEntity,
    debitLocalAmount2: optionalAmount,
    debitForeignAmount2: foreignAmount,
    creditEntity2: optionalEntity,
    creditLocalAmount2: optionalAmount,
    creditForeignAmount2: foreignAmount,
  });

  // Edit mode has no operation: the record's entity already exists, so the key is dropped
  const shape =
    mode === 'insert'
      ? base.extend({
          operation: z.enum(LedgerRecordOperation, { message: 'Operation is required' }),
        })
      : base;

  return shape
    .superRefine(
      (values, ctx) => {
        // Σ debit local (both lines) vs Σ credit local (both lines), like the server
        const totals = computeLedgerTotals(values);
        if (!totals.balanced) {
          ctx.addIssue({
            code: 'custom',
            path: [LEDGER_BALANCE_ERROR_PATH],
            message: `Debit and credit totals must be equal (debit ${roundAmount(totals.debit)}, credit ${roundAmount(totals.credit)})`,
          });
        }
      },
      // Skipped while a main local amount is missing or invalid, as the totals mean nothing yet.
      // Runs before the line rules, whose issues on the secondary amounts would otherwise skip it.
      { when: whenParsed(BALANCE_RULE_FIELDS) },
    )
    .superRefine(
      (values, ctx) => {
        // Matches the server's per-line rules. The main lines' entity and local amount are
        // required by the object shape; a secondary line is filled once it has an entity.
        const foreign = isForeignCurrency(values.currency, localCurrency);
        for (const slot of LEDGER_SLOTS) {
          const filled = slot.main || !!values[slot.entity];
          if (!filled) {
            // An amount needs an entity. A leftover foreign amount in the local currency is never
            // sent (see the mapper), so it does not count.
            const localAmount = values[slot.localAmount];
            const foreignAmount = foreign ? values[slot.foreignAmount] : null;
            if (isPresent(localAmount) || isPresent(foreignAmount)) {
              ctx.addIssue({
                code: 'custom',
                path: [slot.entity],
                message: 'Entity is required when an amount is entered',
              });
            }
            continue;
          }

          if (!slot.main) {
            const localAmount = values[slot.localAmount];
            if (!isPresent(localAmount)) {
              ctx.addIssue({
                code: 'custom',
                path: [slot.localAmount],
                message: 'Amount is required',
              });
            } else if (localAmount <= 0) {
              ctx.addIssue({
                code: 'custom',
                path: [slot.localAmount],
                message: 'Amount must be greater than 0',
              });
            }
          }

          // In a foreign currency every filled line needs a positive foreign amount; in the local
          // currency leftover foreign amounts are ignored here, and the mapper never sends them
          if (foreign) {
            const foreignAmount = values[slot.foreignAmount];
            if (!isPresent(foreignAmount)) {
              ctx.addIssue({
                code: 'custom',
                path: [slot.foreignAmount],
                message: `Foreign amount is required for ${values.currency} records`,
              });
            } else if (foreignAmount <= 0) {
              ctx.addIssue({
                code: 'custom',
                path: [slot.foreignAmount],
                message: 'Foreign amount must be greater than 0',
              });
            }
          }
        }
      },
      { when: whenParsed(SLOT_RULE_FIELDS) },
    );
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

/**
 * Map validated form values to the mutation's `LedgerRecordInput`. An empty secondary line (no
 * entity) is sent as `null`s. Foreign amounts are sent only for a foreign-currency record: in the
 * local currency they are always `null`, even if the form still holds stale ones, because the
 * server rejects them there.
 */
export function formValuesToLedgerRecordInput(
  values: LedgerRecordFormValues,
  { localCurrency }: { localCurrency: Currency },
): LedgerRecordInput {
  const foreign = isForeignCurrency(values.currency, localCurrency);
  const debit2 = secondaryLine(values, 'debit', foreign);
  const credit2 = secondaryLine(values, 'credit', foreign);
  return {
    debitEntity1: values.debitEntity1,
    debitLocalAmount1: values.debitLocalAmount1,
    debitForeignAmount1: foreign ? (values.debitForeignAmount1 ?? null) : null,
    creditEntity1: values.creditEntity1,
    creditLocalAmount1: values.creditLocalAmount1,
    creditForeignAmount1: foreign ? (values.creditForeignAmount1 ?? null) : null,
    debitEntity2: debit2.entity,
    debitLocalAmount2: debit2.localAmount,
    debitForeignAmount2: debit2.foreignAmount,
    creditEntity2: credit2.entity,
    creditLocalAmount2: credit2.localAmount,
    creditForeignAmount2: credit2.foreignAmount,
    currency: values.currency,
    invoiceDate: values.invoiceDate,
    valueDate: values.valueDate,
    description: emptyToNull(values.description),
    reference: emptyToNull(values.reference),
  };
}

function secondaryLine(
  values: LedgerRecordFormValues,
  side: LedgerSlotSide,
  foreign: boolean,
): { entity: string | null; localAmount: number | null; foreignAmount: number | null } {
  const fields = ledgerSlotFieldNames(side, 2);
  const entity = values[fields.entity];
  if (!entity) {
    return { entity: null, localAmount: null, foreignAmount: null };
  }
  return {
    entity,
    localAmount: values[fields.localAmount] ?? null,
    foreignAmount: foreign ? (values[fields.foreignAmount] ?? null) : null,
  };
}
