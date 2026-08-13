import { dateToTimelessDateString } from '../../../shared/helpers/misc.js';

/**
 * `accounter_schema.poalim_securities_transactions` carries no link to
 * `accounter_schema.transactions` — the scrape has no per-execution id and the bank never
 * cross-references the cash leg. Pairing is therefore derived, on three axes:
 *
 * 1. the security key the transaction description carries (the caller already grouped by it),
 * 2. the Poalim account tuple (bank/branch/account) behind the transaction's `account_id`,
 * 3. a date within a few days of the transaction, **and** a matching amount.
 *
 * The amount is what makes this safe: a security can be traded several times on the same day,
 * so date alone would attach every one of them to every cash movement. A candidate that falls
 * in the window but matches no amount is dropped rather than shown as a maybe.
 */

/** How far apart an execution date and a transaction date may be and still pair up. */
export const DEFAULT_DATE_WINDOW_DAYS = 5;

/**
 * Absolute tolerance on the amount compare. The values come out of Postgres `numeric` as
 * decimal strings, so this only absorbs the bank's own rounding, not float drift.
 */
export const DEFAULT_AMOUNT_TOLERANCE = 0.01;

export type MatchableTransaction = {
  id: string;
  amount: string;
  event_date: Date;
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
  settlement_date: Date | null;
  payment_date: Date | null;
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

export type MatchOptions = {
  dateWindowDays?: number;
  amountTolerance?: number;
};

const MS_PER_DAY = 86_400_000;

/**
 * Both sides are calendar dates stored as `DATE` and parsed back to *local* midnight, so
 * subtracting the raw timestamps drifts by an hour across a DST boundary. Going through the
 * timeless string and re-reading it as UTC keeps the day count exact.
 */
function toDayNumber(date: Date): number {
  return Date.parse(`${dateToTimelessDateString(date)}T00:00:00Z`) / MS_PER_DAY;
}

function withinDays(a: Date, b: Date, windowDays: number): boolean {
  return Math.abs(toDayNumber(a) - toDayNumber(b)) <= windowDays;
}

/** Sign is direction, which the two sources express differently; compare magnitudes. */
function amountsMatch(a: string, b: string, tolerance: number): boolean {
  const left = Math.abs(Number(a));
  const right = Math.abs(Number(b));
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return false;
  }
  return Math.abs(left - right) <= tolerance;
}

function transactionDates(transaction: MatchableTransaction): Date[] {
  const effectiveDebitDate = transaction.debit_date_override ?? transaction.debit_date;
  return effectiveDebitDate
    ? [transaction.event_date, effectiveDebitDate]
    : [transaction.event_date];
}

function executionDates(execution: MatchableExecution): Date[] {
  return [
    execution.trade_date,
    execution.value_date,
    execution.settlement_date,
    execution.payment_date,
  ].filter((date): date is Date => date != null);
}

/**
 * The cash leg can be booked in the trade, settlement or reporting currency depending on the
 * action, so all three net values are candidates for the amount compare.
 */
function executionAmounts(execution: MatchableExecution): string[] {
  return [
    execution.net_value_trade_currency,
    execution.net_value_settlement_currency,
    execution.net_value_nis,
  ].filter((amount): amount is string => amount != null);
}

function matchesTransaction(
  execution: MatchableExecution,
  transaction: MatchableTransaction,
  accountTuple: AccountTuple,
  dateWindowDays: number,
  amountTolerance: number,
): boolean {
  if (
    execution.bank_number !== accountTuple.bankNumber ||
    execution.branch_number !== accountTuple.branchNumber ||
    execution.account_number !== accountTuple.accountNumber
  ) {
    return false;
  }

  const dateMatches = executionDates(execution).some(executionDate =>
    transactionDates(transaction).some(transactionDate =>
      withinDays(executionDate, transactionDate, dateWindowDays),
    ),
  );
  if (!dateMatches) {
    return false;
  }

  return executionAmounts(execution).some(amount =>
    amountsMatch(amount, transaction.amount, amountTolerance),
  );
}

/**
 * Pairs the charge's transactions with the ingested executions and returns the matched
 * executions grouped by security key.
 *
 * `accountTuples` maps a transaction's `account_id` to its Poalim identity; transactions whose
 * account is missing from the map (not a bank account, or not yet backfilled) are skipped —
 * without the tuple there is no way to tell one portfolio from another.
 */
export function matchSecurityExecutions<TExecution extends MatchableExecution>(
  transactions: readonly MatchableTransaction[],
  executions: readonly TExecution[],
  accountTuples: ReadonlyMap<string, AccountTuple>,
  options: MatchOptions = {},
): Map<string, TExecution[]> {
  const dateWindowDays = options.dateWindowDays ?? DEFAULT_DATE_WINDOW_DAYS;
  const amountTolerance = options.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;

  const matchedBySecurity = new Map<string, TExecution[]>();

  for (const execution of executions) {
    const matched = transactions.some(transaction => {
      const accountTuple = accountTuples.get(transaction.account_id);
      return (
        accountTuple != null &&
        matchesTransaction(execution, transaction, accountTuple, dateWindowDays, amountTolerance)
      );
    });
    if (!matched) {
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
