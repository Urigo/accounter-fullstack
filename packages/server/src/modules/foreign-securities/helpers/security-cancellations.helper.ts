import { compareTimelessDates } from '../../../shared/helpers/timeless-date.js';
import type { SecurityExecutionRow } from '../types.js';
import { isCancelledExecution } from './security-execution-enums.helper.js';

/** Amounts closer than this are the same amount */
const MIN_AMOUNT = 0.005;

export type CancellableExecution = Pick<
  SecurityExecutionRow,
  | 'id'
  | 'trade_date'
  | 'trade_type'
  | 'security'
  | 'is_cancel_transaction'
  | 'trade_gross_value_trade_currency'
  | 'net_value_trade_currency'
  | 'bank_number'
  | 'branch_number'
  | 'account_number'
>;

export type CancellationPairing<T> = {
  /** The executions that stand: neither a cancellation nor an execution one cancels */
  live: T[];
  /** Each cancellation with the execution it cancels */
  pairs: { original: T; cancellation: T }[];
  /** Cancellations whose original is not among the executions */
  orphanCancellations: T[];
};

const absAmount = (value: string | null) => {
  const amount = Math.abs(Number(value));
  return Number.isFinite(amount) ? amount : null;
};

/** The amount a cancellation and its original share: the gross when reported, else the net */
function sameAmount(a: CancellableExecution, b: CancellableExecution): boolean {
  const grossA = absAmount(a.trade_gross_value_trade_currency);
  const grossB = absAmount(b.trade_gross_value_trade_currency);
  if (grossA && grossB) {
    return Math.abs(grossA - grossB) < MIN_AMOUNT;
  }
  const netA = absAmount(a.net_value_trade_currency);
  const netB = absAmount(b.net_value_trade_currency);
  return netA != null && netB != null && Math.abs(netA - netB) < MIN_AMOUNT;
}

const sameAccount = (a: CancellableExecution, b: CancellableExecution) =>
  a.bank_number === b.bank_number &&
  a.branch_number === b.branch_number &&
  a.account_number === b.account_number;

/**
 * Pairs each cancellation with the execution it cancels.
 *
 * The bank reports a cancellation as a row of its own (`is_cancel_transaction` = "כן") with the
 * original's trade type and amounts negated, and leaves the original as it was — so dropping only
 * the cancellation leaves a trade that never happened. The original is the latest live execution
 * at or before the cancellation of the same security, in the same account, of the same trade type
 * and amount (as the ledger pairs a cancelled payment, `findCancelledPayment`); of two on the same
 * day, the later id.
 * Each original is cancelled once: cancellations are paired oldest first.
 */
export function pairCancellations<T extends CancellableExecution>(
  executions: readonly T[],
): CancellationPairing<T> {
  const cancellations = executions
    .filter(isCancelledExecution)
    .sort((a, b) => compareTimelessDates(a.trade_date, b.trade_date) || a.id.localeCompare(b.id));
  const candidates = executions.filter(execution => !isCancelledExecution(execution));
  const cancelled = new Set<string>();
  const pairs: CancellationPairing<T>['pairs'] = [];
  const orphanCancellations: T[] = [];

  for (const cancellation of cancellations) {
    let original: T | null = null;
    for (const candidate of candidates) {
      if (
        cancelled.has(candidate.id) ||
        candidate.trade_type !== cancellation.trade_type ||
        candidate.security !== cancellation.security ||
        !sameAccount(candidate, cancellation) ||
        !sameAmount(candidate, cancellation) ||
        compareTimelessDates(candidate.trade_date, cancellation.trade_date) > 0
      ) {
        continue;
      }
      if (
        !original ||
        compareTimelessDates(candidate.trade_date, original.trade_date) > 0 ||
        (candidate.trade_date === original.trade_date && candidate.id > original.id)
      ) {
        original = candidate;
      }
    }
    if (original) {
      cancelled.add(original.id);
      pairs.push({ original, cancellation });
    } else {
      orphanCancellations.push(cancellation);
    }
  }

  return {
    live: candidates.filter(execution => !cancelled.has(execution.id)),
    pairs,
    orphanCancellations,
  };
}
