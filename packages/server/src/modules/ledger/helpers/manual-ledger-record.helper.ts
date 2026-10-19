import type { LedgerRecordInput } from '../../../__generated__/types.js';
import type { IInsertLedgerRecordsParams } from '../types.js';

/** The column-shaped content of a manual ledger record, shared by insert and update */
export type ManualLedgerRecordParams = Omit<
  IInsertLedgerRecordsParams['ledgerRecords'][number],
  'chargeId' | 'ownerId'
>;

/**
 * Map a `LedgerRecordInput` to its ledger record column params. Absent optional values become
 * `null`, so an update overwrites (clears) them rather than keeping the stored value.
 */
export function ledgerRecordInputToParams(input: LedgerRecordInput): ManualLedgerRecordParams {
  return {
    debitEntity1: input.debitEntity1,
    debitLocalAmount1: input.debitLocalAmount1,
    debitForeignAmount1: input.debitForeignAmount1 ?? null,
    creditEntity1: input.creditEntity1,
    creditLocalAmount1: input.creditLocalAmount1,
    creditForeignAmount1: input.creditForeignAmount1 ?? null,
    debitEntity2: input.debitEntity2 ?? null,
    debitLocalAmount2: input.debitLocalAmount2 ?? null,
    debitForeignAmount2: input.debitForeignAmount2 ?? null,
    creditEntity2: input.creditEntity2 ?? null,
    creditLocalAmount2: input.creditLocalAmount2 ?? null,
    creditForeignAmount2: input.creditForeignAmount2 ?? null,
    currency: input.currency,
    invoiceDate: input.invoiceDate,
    valueDate: input.valueDate,
    description: input.description ?? null,
    reference: input.reference ?? null,
  };
}
