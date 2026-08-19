import { Currency, SecurityTradeType } from '../../../shared/enums.js';
import { formatCurrency } from '../../../shared/helpers/amount.js';
import { dateToTimelessDateString } from '../../../shared/helpers/misc.js';
import { toSecurityTradeType } from './security-execution-enums.helper.js';

/**
 * `accounter_schema.poalim_securities_transactions` carries no link to
 * `accounter_schema.transactions` — the scrape has no per-execution id and the bank never
 * cross-references the cash leg. Pairing is therefore derived, from the two facts both sides
 * report about the same event:
 *
 * 1. the execution settles on the day the account is debited or credited
 *    (`value_date` = the transaction's effective debit date), and
 * 2. the execution's net value *in the transaction's currency* is the amount that moved,
 *    with the direction the trade type implies.
 *
 * Both are exact. Amounts come out of Postgres `numeric` as decimal strings and both sides
 * report the same figure, so there is nothing for a tolerance to absorb — a near-miss is a
 * different event, not a rounding difference. The account tuple is required on top: the same
 * security trading in two of a tenant's portfolios would otherwise cross-match.
 *
 * Pairing is one-to-one and greedy: a security can be executed several times on one day for
 * the same amount, and each execution belongs to exactly one cash movement.
 */

export type MatchableTransaction = {
  id: string;
  charge_id: string;
  amount: string;
  /** The raw column value; `accounter_schema.currency` is a string union, not the enum. */
  currency: string;
  debit_date: Date | null;
  debit_date_override: Date | null;
  account_id: string;
};

export type MatchableExecution = {
  id: string;
  security: string;
  bank_number: number;
  branch_number: number;
  account_number: number;
  trade_date: Date;
  value_date: Date | null;
  trade_type: string;
  trade_currency: string | null;
  settlement_currency: string | null;
  net_value_trade_currency: string | null;
  net_value_settlement_currency: string | null;
  net_value_nis: string | null;
};

/** The Poalim account identity of a transaction, resolved by the caller from `account_id`. */
export type AccountTuple = {
  bankNumber: number;
  branchNumber: number;
  accountNumber: number;
};

/**
 * Which way cash moves for each kind of execution. `null` is "the bank reports no cash
 * direction for this action" — those rows are matched on date, amount and account alone
 * rather than being force-fitted to a sign the source never implies.
 */
const CASH_DIRECTION: Record<SecurityTradeType, -1 | 1 | null> = {
  [SecurityTradeType.Buy]: -1,
  [SecurityTradeType.Sell]: 1,
  [SecurityTradeType.DividendPayment]: 1,
  [SecurityTradeType.InterestPayment]: 1,
  [SecurityTradeType.Redemption]: 1,
  // Security movements, not cash: a distribution or a deposit transfer has no cash leg of its
  // own, and the two-sided variants settle between accounts rather than against the balance.
  [SecurityTradeType.StockDistribution]: null,
  [SecurityTradeType.TransferIn]: null,
  [SecurityTradeType.TransferOut]: null,
  [SecurityTradeType.TransferInTwoSided]: null,
  [SecurityTradeType.TransferOutTwoSided]: null,
};

/** The transaction's effective debit date — an override wins, as everywhere else. */
function effectiveDebitDate(transaction: MatchableTransaction): Date | null {
  return transaction.debit_date_override ?? transaction.debit_date;
}

/**
 * Both sides are calendar dates stored as `DATE` and parsed back to *local* midnight, so
 * comparing the raw timestamps drifts across a DST boundary. The timeless string is the day.
 */
function sameDay(a: Date, b: Date): boolean {
  return dateToTimelessDateString(a) === dateToTimelessDateString(b);
}

/**
 * The cash leg is booked in the trade or settlement currency depending on the action, and the
 * bank reports a NIS figure for everything. Only the column quoted in the transaction's own
 * currency is comparable — the others are the same value through an exchange rate.
 *
 * The feed spells its currencies out in Hebrew; `formatCurrency` knows those labels, and the
 * nullable form keeps an unrecognized one from throwing mid-match.
 */
function executionAmountInCurrency(
  execution: MatchableExecution,
  currency: Currency,
): string | null {
  // `formatCurrency` reads a missing label as ILS, which would make every unreported
  // settlement currency look like a shekel column; an absent label means "not reported".
  const label = (raw: string | null) => (raw?.trim() ? formatCurrency(raw, true) : null);

  if (label(execution.trade_currency) === currency) {
    return execution.net_value_trade_currency;
  }
  if (label(execution.settlement_currency) === currency) {
    return execution.net_value_settlement_currency;
  }
  if (currency === Currency.Ils) {
    return execution.net_value_nis;
  }
  return null;
}

function matchesTransaction(
  execution: MatchableExecution,
  transaction: MatchableTransaction,
  accountTuple: AccountTuple,
): boolean {
  if (
    execution.bank_number !== accountTuple.bankNumber ||
    execution.branch_number !== accountTuple.branchNumber ||
    execution.account_number !== accountTuple.accountNumber
  ) {
    return false;
  }

  const debitDate = effectiveDebitDate(transaction);
  if (!debitDate || !execution.value_date || !sameDay(execution.value_date, debitDate)) {
    return false;
  }

  const currency = formatCurrency(transaction.currency, true);
  if (!currency) {
    return false;
  }

  const executionAmount = executionAmountInCurrency(execution, currency);
  if (executionAmount == null) {
    return false;
  }

  const executionValue = Number(executionAmount);
  const transactionValue = Number(transaction.amount);
  if (Number.isNaN(executionValue) || Number.isNaN(transactionValue)) {
    return false;
  }
  if (Math.abs(executionValue) !== Math.abs(transactionValue)) {
    return false;
  }

  const direction = CASH_DIRECTION[toSecurityTradeType(execution.trade_type)];
  if (direction == null || transactionValue === 0) {
    return true;
  }
  return Math.sign(transactionValue) === direction;
}

/**
 * The cash movement behind each execution, at most one per side.
 *
 * `accountTuples` maps a transaction's `account_id` to its Poalim identity; transactions whose
 * account is missing from the map (not a bank account, or not yet backfilled) are skipped —
 * without the tuple there is no way to tell one portfolio from another.
 *
 * Executions are consumed oldest first so the pairing is stable regardless of row order.
 */
export function matchExecutionsToTransactions<
  TExecution extends MatchableExecution,
  TTransaction extends MatchableTransaction,
>(
  transactions: readonly TTransaction[],
  executions: readonly TExecution[],
  accountTuples: ReadonlyMap<string, AccountTuple>,
): Map<string, TTransaction> {
  const matches = new Map<string, TTransaction>();
  const takenTransactionIds = new Set<string>();

  const ordered = [...executions].sort(
    (a, b) => a.trade_date.getTime() - b.trade_date.getTime() || a.id.localeCompare(b.id),
  );

  for (const execution of ordered) {
    const transaction = transactions.find(candidate => {
      if (takenTransactionIds.has(candidate.id)) {
        return false;
      }
      const accountTuple = accountTuples.get(candidate.account_id);
      return accountTuple != null && matchesTransaction(execution, candidate, accountTuple);
    });

    if (transaction) {
      takenTransactionIds.add(transaction.id);
      matches.set(execution.id, transaction);
    }
  }

  return matches;
}

/**
 * The same pairing seen from the charge: the matched executions, grouped by security key.
 */
export function matchSecurityExecutions<TExecution extends MatchableExecution>(
  transactions: readonly MatchableTransaction[],
  executions: readonly TExecution[],
  accountTuples: ReadonlyMap<string, AccountTuple>,
): Map<string, TExecution[]> {
  const matches = matchExecutionsToTransactions(transactions, executions, accountTuples);

  const matchedBySecurity = new Map<string, TExecution[]>();
  for (const execution of executions) {
    if (!matches.has(execution.id)) {
      continue;
    }
    const group = matchedBySecurity.get(execution.security);
    if (group) {
      group.push(execution);
    } else {
      matchedBySecurity.set(execution.security, [execution]);
    }
  }

  for (const group of matchedBySecurity.values()) {
    group.sort((a, b) => a.trade_date.getTime() - b.trade_date.getTime());
  }

  return matchedBySecurity;
}
