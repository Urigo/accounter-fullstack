import { Currency, SecurityTradeType } from '../../../shared/enums.js';
import { formatCurrency } from '../../../shared/helpers/amount.js';
import {
  addDaysToTimelessDate,
  compareTimelessDates,
  differenceInTimelessDays,
} from '../../../shared/helpers/timeless-date.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { isCancelledExecution, tryToSecurityTradeType } from './security-execution-enums.helper.js';
import { extractTransactionSecurityKeys } from './security-key.helper.js';

/**
 * `accounter_schema.poalim_securities_transactions` carries no link to
 * `accounter_schema.transactions` — the scrape has no per-execution id and the bank never
 * cross-references the cash leg. Pairing is therefore derived, from what both sides report about
 * the same event.
 *
 * Identity comes from four facts, all required:
 *
 * 1. the same portfolio account — the same security trading in two of a tenant's portfolios
 *    would otherwise cross-match;
 * 2. the same security — the key the transaction names (see `extractTransactionSecurityKeys`),
 *    when it names one;
 * 3. the same amount — the execution's net value *in the transaction's currency*;
 * 4. the same direction — the one the trade type implies, or for a cancellation the sign of the
 *    value it reports.
 *
 * Amounts are exact. They come out of Postgres `numeric` as decimal strings and both sides report
 * the same figure, so there is nothing for a tolerance to absorb — a near-miss is a different
 * event, not a rounding difference.
 *
 * The date is not part of the identity, because the two feeds do not agree on it. The
 * transaction carries two days, and either can be the one the execution reports as its value
 * date: an ordinary foreign row is debited around the trade date and executed on the settlement
 * day, while a back-dated correction is debited on the original day and executed when posted. A
 * new issue can even move cash days after the value date the securities feed reports. So the
 * date ranks candidates instead: a transaction dated exactly on the value date wins, and failing
 * that the closest one inside a bounded window.
 *
 * Pairing is one-to-one: a security can be executed several times close together for the same
 * amount, and each execution belongs to exactly one cash movement.
 */

/**
 * How many calendar days after its value date an execution's cash can still move. Covers a
 * settlement a few business days late plus a weekend and a holiday run.
 */
export const CASH_SETTLEMENT_WINDOW_DAYS = 10;

export type MatchableTransaction = {
  id: string;
  charge_id: string;
  amount: string;
  /** The raw column value; `accounter_schema.currency` is a string union, not the enum. */
  currency: string;
  event_date: TimelessDateString | null;
  debit_date: TimelessDateString | null;
  debit_date_override: TimelessDateString | null;
  account_id: string;
  source_description: string | null;
  source_reference: string | null;
};

export type MatchableExecution = {
  id: string;
  security: string;
  bank_number: number;
  branch_number: number;
  account_number: number;
  trade_date: TimelessDateString;
  value_date: TimelessDateString | null;
  trade_type: string;
  trade_currency: string | null;
  settlement_currency: string | null;
  net_value_trade_currency: string | null;
  net_value_settlement_currency: string | null;
  net_value_nis: string | null;
  is_cancel_transaction: string | null;
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

type DecimalValue = {
  negative: boolean;
  /** The value without its sign, in one canonical spelling: `1000`, `1000.1`, `0`. */
  magnitude: string;
};

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?$/;

/**
 * `numeric` reaches us as a decimal string, and the two sources spell the same value
 * differently — `1000` against `1000.00`. Going through `Number` to reconcile that would trade
 * an exact decimal for a binary approximation, which is a strange thing to do in a comparison
 * documented as exact: past 2^53, or with enough fraction digits, two different values can land
 * on one double and two spellings of one value can land on different ones. Canonicalizing the
 * string keeps the decimal exact at any size.
 *
 * Returns null for anything that is not a plain decimal, which cannot be compared and therefore
 * cannot match.
 */
function parseDecimal(raw: string): DecimalValue | null {
  const match = DECIMAL.exec(raw.trim());
  if (!match) {
    return null;
  }

  const [, sign, whole = '', fraction = ''] = match;
  if (!whole && !fraction) {
    return null;
  }

  const integerPart = whole.replace(/^0+/, '');
  const fractionPart = fraction.replace(/0+$/, '');
  const magnitude = fractionPart ? `${integerPart || '0'}.${fractionPart}` : integerPart || '0';

  // -0 is 0; a zero has no direction to disagree about.
  return { negative: sign === '-' && magnitude !== '0', magnitude };
}

function isNonZero(raw: string): boolean {
  const value = parseDecimal(raw);
  return value != null && value.magnitude !== '0';
}

/**
 * The days a transaction's cash can be said to have moved on: its effective debit date (an
 * override wins, as everywhere else) and its event date. They differ on foreign-currency rows,
 * and which of them lines up with the execution depends on the kind of movement — see the note
 * at the top of the file.
 */
export function transactionCashDates(
  transaction: Pick<MatchableTransaction, 'event_date' | 'debit_date' | 'debit_date_override'>,
): TimelessDateString[] {
  const debitDate = transaction.debit_date_override ?? transaction.debit_date;
  return [...new Set([debitDate, transaction.event_date])].filter(
    (date): date is TimelessDateString => date != null,
  );
}

/**
 * The cash leg is booked in the trade or settlement currency depending on the action, and the
 * bank reports a NIS figure for everything. Only a column quoted in the transaction's own
 * currency is comparable — the others are the same value through an exchange rate.
 *
 * The feed writes `0` into a column it does not report: an ILS trade leaves its trade-currency
 * column at zero and reports the cash in the NIS column. So a zero column gives way to the next
 * one in the same currency, and only when every candidate is zero is the execution taken to be
 * worth zero. On a foreign-currency execution the NIS column is not the trade at all — it is the
 * commission the bank charged separately in shekels.
 *
 * The feed spells its currencies out in Hebrew; `formatCurrency` knows those labels, and the
 * nullable form keeps an unrecognized one from throwing mid-match.
 */
export function executionAmountInCurrency(
  execution: Pick<
    MatchableExecution,
    | 'trade_currency'
    | 'settlement_currency'
    | 'net_value_trade_currency'
    | 'net_value_settlement_currency'
    | 'net_value_nis'
  >,
  currency: Currency,
): string | null {
  // `formatCurrency` reads a missing label as ILS, which would make every unreported
  // settlement currency look like a shekel column; an absent label means "not reported".
  const label = (raw: string | null) => (raw?.trim() ? formatCurrency(raw, true) : null);

  const reported: string[] = [];
  if (label(execution.trade_currency) === currency && execution.net_value_trade_currency != null) {
    reported.push(execution.net_value_trade_currency);
  }
  if (
    label(execution.settlement_currency) === currency &&
    execution.net_value_settlement_currency != null
  ) {
    reported.push(execution.net_value_settlement_currency);
  }
  if (currency === Currency.Ils && execution.net_value_nis != null) {
    reported.push(execution.net_value_nis);
  }

  return reported.find(isNonZero) ?? reported[0] ?? null;
}

/**
 * The way cash moves for an execution, or null when nothing constrains it.
 *
 * An ordinary execution moves cash the way its trade type implies. A cancellation does not: the
 * bank books it either under the original's trade type with every value negated (a cancelled
 * dividend, money going back out) or as the opposite action with positive values (a cancelled
 * buy booked as a sale, money coming back in). What both spellings agree on is the sign of the
 * value they report, so a cancellation's direction is read from that instead.
 *
 * The type stays the rule for everything else: the commission of a dividend is reported in the
 * same execution's NIS column, with the sign of the fee, and reading signs there would let the fee
 * pass for the dividend.
 */
function cashDirection(execution: MatchableExecution, reported: DecimalValue): -1 | 1 | null {
  if (isCancelledExecution(execution)) {
    return reported.magnitude === '0' ? null : reported.negative ? -1 : 1;
  }
  // A trade type the translation does not know leaves the direction unconstrained rather than
  // failing the match: the account, key, amount and date still have to agree, and an execution
  // that gets this far reaches the resolver, which is where unknown vocabulary is meant to be loud.
  const tradeType = tryToSecurityTradeType(execution.trade_type);
  return tradeType ? CASH_DIRECTION[tradeType] : null;
}

/** How a transaction's dates fit an execution, best first. */
enum DateFit {
  /** The effective debit date is the value date — the rule pairing was first built on. */
  ExactDebitDate = 0,
  /** The event date is the value date. */
  ExactEventDate = 1,
  /** Neither, but a cash date falls inside the settlement window. */
  Window = 2,
}

function fitDates(
  execution: MatchableExecution,
  transaction: MatchableTransaction,
): { fit: DateFit; distance: number } | null {
  const debitDate = transaction.debit_date_override ?? transaction.debit_date;
  if (execution.value_date != null) {
    if (debitDate === execution.value_date) {
      return { fit: DateFit.ExactDebitDate, distance: 0 };
    }
    if (transaction.event_date === execution.value_date) {
      return { fit: DateFit.ExactEventDate, distance: 0 };
    }
  }

  // Cash never moves before the trade, and never more than the window away from the value date.
  const anchor = execution.value_date ?? execution.trade_date;
  const earliest = addDaysToTimelessDate(anchor, -CASH_SETTLEMENT_WINDOW_DAYS);
  const from =
    compareTimelessDates(execution.trade_date, earliest) > 0 ? execution.trade_date : earliest;
  const to = addDaysToTimelessDate(anchor, CASH_SETTLEMENT_WINDOW_DAYS);

  let distance: number | null = null;
  for (const date of transactionCashDates(transaction)) {
    if (compareTimelessDates(date, from) < 0 || compareTimelessDates(date, to) > 0) {
      continue;
    }
    const days = Math.abs(differenceInTimelessDays(date, anchor));
    if (distance == null || days < distance) {
      distance = days;
    }
  }
  return distance == null ? null : { fit: DateFit.Window, distance };
}

function matchesIdentity(
  execution: MatchableExecution,
  transaction: MatchableTransaction,
  transactionKeys: readonly string[],
  accountTuple: AccountTuple,
): boolean {
  if (
    execution.bank_number !== accountTuple.bankNumber ||
    execution.branch_number !== accountTuple.branchNumber ||
    execution.account_number !== accountTuple.accountNumber
  ) {
    return false;
  }

  // A transaction that names no security is not constrained by one; the history path hands in
  // transactions already scoped to the security's business.
  if (transactionKeys.length > 0 && !transactionKeys.includes(execution.security)) {
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

  const executionValue = parseDecimal(executionAmount);
  const transactionValue = parseDecimal(transaction.amount);
  if (!executionValue || !transactionValue) {
    return false;
  }
  if (executionValue.magnitude !== transactionValue.magnitude) {
    return false;
  }

  const direction = cashDirection(execution, executionValue);
  if (direction == null || transactionValue.magnitude === '0') {
    return true;
  }
  return (transactionValue.negative ? -1 : 1) === direction;
}

/**
 * The cash movement behind each execution, at most one per side.
 *
 * `accountTuples` maps a transaction's `account_id` to its Poalim identity; transactions whose
 * account is missing from the map (not a bank account, or not yet backfilled) are skipped —
 * without the tuple there is no way to tell one portfolio from another.
 *
 * Every pair that agrees on identity is a candidate, and candidates are taken best first: by how
 * well the dates fit, then by how far apart they are, then oldest execution first and earliest
 * transaction first, so the pairing is stable regardless of row order. A pair whose execution or
 * transaction was already taken is skipped. Exact debit-date pairs rank above everything else,
 * so every pairing the original exact rule makes is still made the same way.
 */
export function matchExecutionsToTransactions<
  TExecution extends MatchableExecution,
  TTransaction extends MatchableTransaction,
>(
  transactions: readonly TTransaction[],
  executions: readonly TExecution[],
  accountTuples: ReadonlyMap<string, AccountTuple>,
): Map<string, TTransaction> {
  const eligible = transactions.flatMap((transaction, index) => {
    const accountTuple = accountTuples.get(transaction.account_id);
    return accountTuple
      ? [{ transaction, index, accountTuple, keys: extractTransactionSecurityKeys(transaction) }]
      : [];
  });

  const candidates: Array<{
    execution: TExecution;
    transaction: TTransaction;
    index: number;
    fit: DateFit;
    distance: number;
  }> = [];
  for (const execution of executions) {
    for (const { transaction, index, accountTuple, keys } of eligible) {
      if (!matchesIdentity(execution, transaction, keys, accountTuple)) {
        continue;
      }
      const dates = fitDates(execution, transaction);
      if (dates) {
        candidates.push({ execution, transaction, index, ...dates });
      }
    }
  }

  candidates.sort(
    (a, b) =>
      a.fit - b.fit ||
      a.distance - b.distance ||
      compareTimelessDates(a.execution.trade_date, b.execution.trade_date) ||
      a.execution.id.localeCompare(b.execution.id) ||
      a.index - b.index,
  );

  const matches = new Map<string, TTransaction>();
  const takenTransactionIds = new Set<string>();
  for (const { execution, transaction } of candidates) {
    if (matches.has(execution.id) || takenTransactionIds.has(transaction.id)) {
      continue;
    }
    matches.set(execution.id, transaction);
    takenTransactionIds.add(transaction.id);
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
    group.sort((a, b) => compareTimelessDates(a.trade_date, b.trade_date));
  }

  return matchedBySecurity;
}
