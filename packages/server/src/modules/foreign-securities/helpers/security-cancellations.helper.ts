import { Currency, SecurityTradeType } from '../../../shared/enums.js';
import { compareTimelessDates } from '../../../shared/helpers/timeless-date.js';
import type { SecurityExecutionRow } from '../types.js';
import {
  currencyOfSecurityLabel,
  isCancelledExecution,
  tradeTypeToRaw,
  tryToSecurityTradeType,
} from './security-execution-enums.helper.js';

/** Amounts closer than this are the same amount */
const MIN_AMOUNT = 0.005;

export type CancellableExecution = Pick<
  SecurityExecutionRow,
  | 'id'
  | 'trade_date'
  | 'trade_type'
  | 'security'
  | 'is_cancel_transaction'
  | 'trade_currency'
  | 'settlement_currency'
  | 'trade_gross_value_trade_currency'
  | 'net_value_trade_currency'
  | 'net_value_settlement_currency'
  | 'net_value_nis'
  | 'nv'
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
  if (value == null) {
    return null;
  }
  const amount = Math.abs(Number(value));
  return Number.isFinite(amount) ? amount : null;
};

type NetAmountField =
  | 'trade_currency'
  | 'settlement_currency'
  | 'net_value_trade_currency'
  | 'net_value_settlement_currency'
  | 'net_value_nis';

/**
 * The net amount an execution reports, for its sign: the first non-zero of the trade currency's,
 * the settlement currency's and — on a shekel execution only — the shekel net, as the matcher
 * reads it (`executionAmountInCurrency`). The bank may leave the trade currency's net empty. On a
 * foreign-currency execution the shekel net is the commission, whose sign is the fee's.
 */
function reportedNet(execution: Pick<CancellableExecution, NetAmountField>): number {
  const isShekelExecution =
    currencyOfSecurityLabel(execution.trade_currency) === Currency.Ils ||
    currencyOfSecurityLabel(execution.settlement_currency) === Currency.Ils;
  const reported = [
    execution.net_value_trade_currency,
    execution.net_value_settlement_currency,
    isShekelExecution ? execution.net_value_nis : null,
  ].map(Number);
  return reported.find(value => Number.isFinite(value) && value !== 0) ?? 0;
}

/**
 * The trade type of the execution a cancellation cancels.
 *
 * The bank reports a cancellation in one of two ways:
 * - under the original's trade type, with its values negated (a cancelled dividend: money going
 *   back out);
 * - as the opposite trade, with positive values (a cancelled buy reported as a sale: money coming
 *   back in).
 *
 * The sign of the net amount tells them apart (`reportedNet`). A sale that brings money in, or a
 * buy that takes it out, is the opposite trade, so it cancels a buy (or a sale). Anything else,
 * and any row with no net amount, keeps its own trade type.
 */
export function cancelledTradeType(
  cancellation: Pick<CancellableExecution, 'trade_type' | NetAmountField>,
): string {
  const net = reportedNet(cancellation);
  const tradeType = tryToSecurityTradeType(cancellation.trade_type);
  if (tradeType === SecurityTradeType.Sell && net > 0) {
    return tradeTypeToRaw[SecurityTradeType.Buy];
  }
  if (tradeType === SecurityTradeType.Buy && net < 0) {
    return tradeTypeToRaw[SecurityTradeType.Sell];
  }
  return cancellation.trade_type;
}

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

/**
 * Whether a cancellation and its original are for the same number of units. A transfer or a
 * distribution carries no cash amount (a net of 0), so the units are what tells two of them apart,
 * as ingestion and the ledger pair a cancelled distribution (`findDistributionCancellation`).
 */
function sameUnits(a: CancellableExecution, b: CancellableExecution): boolean {
  const unitsA = absAmount(a.nv);
  const unitsB = absAmount(b.nv);
  if (unitsA == null || unitsB == null) {
    return unitsA === unitsB;
  }
  return Math.abs(unitsA - unitsB) < MIN_AMOUNT;
}

const sameAccount = (a: CancellableExecution, b: CancellableExecution) =>
  a.bank_number === b.bank_number &&
  a.branch_number === b.branch_number &&
  a.account_number === b.account_number;

/**
 * Pairs each cancellation with the execution it cancels.
 *
 * The bank reports a cancellation as a row of its own (`is_cancel_transaction` = "כן") and leaves
 * the original as it was — so dropping only the cancellation leaves a trade that never happened.
 * The original is the latest live execution at or before the cancellation of the same security, in
 * the same account, of the trade type it cancels (`cancelledTradeType`), amount and number of
 * units (as the ledger pairs a cancelled payment, `findCancelledPayment`); of two on the same day,
 * the later id.
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
    const tradeType = cancelledTradeType(cancellation);
    let original: T | null = null;
    for (const candidate of candidates) {
      if (
        cancelled.has(candidate.id) ||
        candidate.trade_type !== tradeType ||
        candidate.security !== cancellation.security ||
        !sameAccount(candidate, cancellation) ||
        !sameAmount(candidate, cancellation) ||
        !sameUnits(candidate, cancellation) ||
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
