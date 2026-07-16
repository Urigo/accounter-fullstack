import type { ChargesMatcherModule } from '../types.js';

type ChargeMatchQueueMode = ChargesMatcherModule.ChargeMatchQueueMode;

/**
 * Max number of charges evaluated when sorting the queue BY_SCORE. Scoring is
 * calculated on the fly and each pass loads candidates, transactions and
 * documents, so the evaluation window is deliberately capped to bound request
 * latency and DB load.
 */
export const BY_SCORE_EVALUATION_CAP = 100;

/**
 * The subset of enriched charge fields the queue filtering relies on.
 * Counts are int8 aggregates, surfaced by pgtyped as strings.
 */
export interface QueueChargeCounts {
  transactions_count: string | null;
  invoices_count: string | null;
  receipts_count: string | null;
}

function hasTransactions(charge: QueueChargeCounts): boolean {
  return Number(charge.transactions_count ?? 0) > 0;
}

function hasReceiptDocuments(charge: QueueChargeCounts): boolean {
  return Number(charge.receipts_count ?? 0) > 0;
}

function hasAccountingDocuments(charge: QueueChargeCounts): boolean {
  return Number(charge.invoices_count ?? 0) > 0 || hasReceiptDocuments(charge);
}

/**
 * A charge is transaction-based when it has transactions but no receipt
 * documents (mirrors the auto-match unmatched-charge semantics)
 */
export function isTransactionBaseCharge(charge: QueueChargeCounts): boolean {
  return hasTransactions(charge) && !hasReceiptDocuments(charge);
}

/**
 * A charge is document-based when it has accounting documents but no
 * transactions
 */
export function isDocumentBaseCharge(charge: QueueChargeCounts): boolean {
  return !hasTransactions(charge) && hasAccountingDocuments(charge);
}

/**
 * A charge belongs in the awaiting-match queue when it is unmatched:
 * transaction-based XOR document-based. Charges with both sides (matched) or
 * neither (empty) are excluded.
 */
export function isUnmatchedBaseCharge(charge: QueueChargeCounts): boolean {
  return isTransactionBaseCharge(charge) || isDocumentBaseCharge(charge);
}

/**
 * Apply the optional queue mode filter on top of the unmatched check
 */
export function matchesQueueMode(
  charge: QueueChargeCounts,
  mode?: ChargeMatchQueueMode | null,
): boolean {
  switch (mode) {
    case 'DOC_BASE':
      return isDocumentBaseCharge(charge);
    case 'TRANSACTION_BASE':
      return isTransactionBaseCharge(charge);
    default:
      return isUnmatchedBaseCharge(charge);
  }
}
