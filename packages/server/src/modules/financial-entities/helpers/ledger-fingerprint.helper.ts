import { createHash } from 'node:crypto';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import type { IGetLedgerRecordsByChargesIdsResult } from '../../ledger/types.js';

export type LedgerFingerprintSide = 'credit' | 'debit';
export type LedgerFingerprintSlot = 1 | 2;

function normalizeAmount(amount: string | null): string | null {
  if (amount == null || amount === '') {
    return null;
  }
  return parseFloat(amount).toFixed(2);
}

/**
 * Builds the fingerprint tuple one ledger-record slot contributes to an entity.
 * Record ids, description and reference1 are deliberately left out, so regenerating
 * a ledger with identical content keeps the same fingerprint.
 */
export function ledgerFingerprintTuple(
  record: IGetLedgerRecordsByChargesIdsResult,
  entityId: string,
  side: LedgerFingerprintSide,
  slot: LedgerFingerprintSlot,
): string {
  const localAmount = record[`${side}_local_amount${slot}` as const];
  const foreignAmount = record[`${side}_foreign_amount${slot}` as const];

  const otherSide: LedgerFingerprintSide = side === 'credit' ? 'debit' : 'credit';
  const otherSideEntities = Array.from(
    new Set(
      [record[`${otherSide}_entity1` as const], record[`${otherSide}_entity2` as const]].filter(
        (id): id is string => !!id && id !== entityId,
      ),
    ),
  ).sort();

  return [
    record.charge_id,
    side,
    String(slot),
    normalizeAmount(localAmount) ?? '0.00',
    normalizeAmount(foreignAmount) ?? '',
    record.currency,
    dateToTimelessDateString(record.invoice_date),
    dateToTimelessDateString(record.value_date),
    otherSideEntities.join(','),
  ].join('|');
}

/**
 * Hashes an entity's fingerprint tuples into an order-independent sha256 hex digest.
 */
export function hashLedgerFingerprint(tuples: string[]): string {
  const content = [...tuples].sort().join('\n');
  return createHash('sha256').update(content).digest('hex');
}
