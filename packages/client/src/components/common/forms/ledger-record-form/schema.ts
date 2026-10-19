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
  /** Required (> 0) in a foreign currency; ignored, and never sent, in the local currency */
  debitForeignAmount1?: number;
  creditForeignAmount1?: number;
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
 */
export type LedgerRecordFormInput = Omit<
  Partial<LedgerRecordFormValues>,
  'invoiceDate' | 'valueDate'
> & {
  invoiceDate?: string;
  valueDate?: string;
};

/** The form-level error path for an unbalanced record (not a field of its own) */
export const LEDGER_BALANCE_ERROR_PATH = 'balance';

/** Every foreign-amount field of the form (the main lines only, so far) */
export const FOREIGN_AMOUNT_FIELDS = ['debitForeignAmount1', 'creditForeignAmount1'] as const;

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
  currency: Currency | undefined,
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
  // Checked against the currency in the record-level refinement below
  const foreignAmount = z.number({ message: 'Foreign amount must be a number' }).optional();

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
        // Matches the server: in a foreign currency every main line needs a positive foreign
        // amount; in the local currency leftover foreign amounts are ignored here, and the mapper
        // never sends them
        if (!isForeignCurrency(values.currency, localCurrency)) {
          return;
        }
        for (const field of FOREIGN_AMOUNT_FIELDS) {
          const value = values[field];
          if (value === undefined) {
            ctx.addIssue({
              code: 'custom',
              path: [field],
              message: `Foreign amount is required for ${values.currency} records`,
            });
          } else if (value <= 0) {
            ctx.addIssue({
              code: 'custom',
              path: [field],
              message: 'Foreign amount must be greater than 0',
            });
          }
        }
      },
      {
        // Run even while other fields are still invalid, so every problem shows at once; it only
        // needs the currency and the foreign amounts themselves to have parsed
        when: ({ value, issues }) =>
          typeof value === 'object' &&
          value !== null &&
          !issues.some(issue => {
            const [field] = issue.path ?? [];
            return (
              field === 'currency' ||
              FOREIGN_AMOUNT_FIELDS.includes(field as (typeof FOREIGN_AMOUNT_FIELDS)[number])
            );
          }),
      },
    )
    .superRefine((values, ctx) => {
      const debitTotal = values.debitLocalAmount1;
      const creditTotal = values.creditLocalAmount1;
      if (Math.abs(debitTotal - creditTotal) > LEDGER_BALANCE_TOLERANCE + BALANCE_EPSILON) {
        ctx.addIssue({
          code: 'custom',
          path: [LEDGER_BALANCE_ERROR_PATH],
          message: `Debit and credit totals must be equal (debit ${roundAmount(debitTotal)}, credit ${roundAmount(creditTotal)})`,
        });
      }
    });
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

/**
 * Map validated form values to the mutation's `LedgerRecordInput`. Only the main (slot-1) lines are
 * supported for now, so every secondary-line field is sent as `null`. Foreign amounts are sent only
 * for a foreign-currency record: in the local currency they are always `null`, even if the form
 * still holds stale ones, because the server rejects them there.
 */
export function formValuesToLedgerRecordInput(
  values: LedgerRecordFormValues,
  { localCurrency }: { localCurrency: Currency },
): LedgerRecordInput {
  const foreign = isForeignCurrency(values.currency, localCurrency);
  return {
    debitEntity1: values.debitEntity1,
    debitLocalAmount1: values.debitLocalAmount1,
    debitForeignAmount1: foreign ? (values.debitForeignAmount1 ?? null) : null,
    creditEntity1: values.creditEntity1,
    creditLocalAmount1: values.creditLocalAmount1,
    creditForeignAmount1: foreign ? (values.creditForeignAmount1 ?? null) : null,
    debitEntity2: null,
    debitLocalAmount2: null,
    debitForeignAmount2: null,
    creditEntity2: null,
    creditLocalAmount2: null,
    creditForeignAmount2: null,
    currency: values.currency,
    invoiceDate: values.invoiceDate,
    valueDate: values.valueDate,
    description: emptyToNull(values.description),
    reference: emptyToNull(values.reference),
  };
}
