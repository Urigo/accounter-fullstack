import { z } from 'zod';
import {
  LedgerRecordOperation,
  type Currency,
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
  invoiceDate: TimelessDateString;
  valueDate: TimelessDateString;
  description?: string;
  reference?: string;
  debitEntity1: string;
  debitLocalAmount1: number;
  creditEntity1: string;
  creditLocalAmount1: number;
};

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

type BuildLedgerRecordFormSchemaOptions = {
  mode: LedgerRecordFormMode;
  localCurrency: Currency;
  ledgerLock?: string | null;
};

function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * The zod schema behind `LedgerRecordForm`. Its rules match the server's
 * `validateManualLedgerRecord`, so a record that passes here is not rejected for shape reasons.
 */
export function buildLedgerRecordFormSchema({
  mode,
  ledgerLock,
}: BuildLedgerRecordFormSchemaOptions): z.ZodType<LedgerRecordFormValues, LedgerRecordFormInput> {
  // Both dates must be strictly after the lock date, matching the server (and `lockLedgerRecords`,
  // which locks every record dated on or before it). yyyy-mm-dd strings compare chronologically.
  const timelessDate = z
    .string({ message: 'Date is required' })
    .regex(TIMELESS_DATE_REGEX, 'Date must be in format yyyy-mm-dd')
    .refine(date => !ledgerLock || date > ledgerLock, `Date must be after ${ledgerLock}`)
    .transform(date => date as TimelessDateString);

  const entity = z.string({ message: 'Entity is required' }).min(1, 'Entity is required');
  const amount = z.number({ message: 'Amount is required' }).gt(0, 'Amount must be greater than 0');

  const base = z.object({
    invoiceDate: timelessDate,
    valueDate: timelessDate,
    description: z.string().optional(),
    reference: z.string().optional(),
    debitEntity1: entity,
    debitLocalAmount1: amount,
    creditEntity1: entity,
    creditLocalAmount1: amount,
  });

  // Edit mode has no operation: the record's entity already exists, so the key is dropped
  const shape =
    mode === 'insert'
      ? base.extend({
          operation: z.enum(LedgerRecordOperation, { message: 'Operation is required' }),
        })
      : base;

  return shape.superRefine((values, ctx) => {
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
 * Map validated form values to the mutation's `LedgerRecordInput`. Only the main (slot-1) lines in
 * the local currency are supported for now, so every secondary-line and foreign-amount field is
 * sent as `null`.
 */
export function formValuesToLedgerRecordInput(
  values: LedgerRecordFormValues,
  { localCurrency }: { localCurrency: Currency },
): LedgerRecordInput {
  return {
    debitEntity1: values.debitEntity1,
    debitLocalAmount1: values.debitLocalAmount1,
    debitForeignAmount1: null,
    creditEntity1: values.creditEntity1,
    creditLocalAmount1: values.creditLocalAmount1,
    creditForeignAmount1: null,
    debitEntity2: null,
    debitLocalAmount2: null,
    debitForeignAmount2: null,
    creditEntity2: null,
    creditLocalAmount2: null,
    creditForeignAmount2: null,
    currency: localCurrency,
    invoiceDate: values.invoiceDate,
    valueDate: values.valueDate,
    description: emptyToNull(values.description),
    reference: emptyToNull(values.reference),
  };
}
