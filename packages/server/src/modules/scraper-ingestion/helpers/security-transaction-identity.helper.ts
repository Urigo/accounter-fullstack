import type { TimelessDateString } from '../../../shared/types/index.js';

/**
 * The fields of a Poalim securities execution that are fixed when it executes. Accepted in
 * both spellings: existing rows come back from pg in snake_case, incoming rows are camelCase.
 *
 * value_date, settlement_date, trade_price and net_value_trade_currency are deliberately absent.
 * The bank restates them as an execution settles — a fund's price is fixed at end of day, and
 * value/settlement dates move forward as the trade clears — so a re-scrape of the same execution
 * differs in exactly those fields.
 */
type SecurityTransactionIdentityFields = {
  bank_number?: number | null | void;
  bankNumber?: number | null | void;
  branch_number?: number | null | void;
  branchNumber?: number | null | void;
  account_number?: number | null | void;
  accountNumber?: number | null | void;
  security?: string | null | void;
  trade_date?: TimelessDateString | null | void;
  tradeDate?: TimelessDateString | null | void;
  trade_type?: string | null | void;
  tradeType?: string | null | void;
  transaction_type?: string | null | void;
  transactionType?: string | null | void;
  nv?: number | string | null | void;
  payment_type?: string | null | void;
  paymentType?: string | null | void;
  payment_date?: TimelessDateString | null | void;
  paymentDate?: TimelessDateString | null | void;
  ex_date?: TimelessDateString | null | void;
  exDate?: TimelessDateString | null | void;
  cancel_date?: TimelessDateString | null | void;
  cancelDate?: TimelessDateString | null | void;
};

const num = (value: number | string | null | void) => (value == null ? '' : String(Number(value)));
const text = (value: string | null | void) => value ?? '';

/**
 * The dedup index minus `occurrence`: every execution sharing this key is either the same
 * execution scraped twice, or a genuinely separate one of the same size on the same day.
 *
 * NUMERIC columns arrive from pg as strings and from the payload as JS numbers, so both are
 * normalised to the same canonical form. Dates are calendar-date strings on both sides (the
 * validator takes the day off the bank's timestamps).
 */
export function securityTransactionGroupKeyOf(row: SecurityTransactionIdentityFields): string {
  return [
    row.bank_number ?? row.bankNumber,
    row.branch_number ?? row.branchNumber,
    row.account_number ?? row.accountNumber,
    text(row.security),
    text(row.trade_date ?? row.tradeDate),
    text(row.trade_type ?? row.tradeType),
    text(row.transaction_type ?? row.transactionType),
    num(row.nv),
    text(row.payment_type ?? row.paymentType),
    text(row.payment_date ?? row.paymentDate),
    text(row.ex_date ?? row.exDate),
    text(row.cancel_date ?? row.cancelDate),
  ].join('|');
}

/** The full natural key the dedup index is built on. */
export function securityTransactionKeyOf(
  row: SecurityTransactionIdentityFields & { occurrence?: number | null | void },
): string {
  return `${securityTransactionGroupKeyOf(row)}|${row.occurrence ?? 1}`;
}

type OrderableSecurityTransaction = {
  tradePrice?: number | string | null | void;
  netValueTradeCurrency?: number | string | null | void;
  valueDate?: TimelessDateString | null | void;
};

const toNumber = (value: number | string | null | void) => (value == null ? null : Number(value));

function compareNullable<T extends number | string>(a: T | null | void, b: T | null | void) {
  if (a == null) return b == null ? 0 : -1;
  if (b == null) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Numbers the executions of one scrape that share a group key, 1..n, so the dedup index can tell
 * them apart. The response carries no per-execution id and reports each execution once, so n
 * rows with one group key are n executions — and a later scrape restating them lands on the same
 * ordinals, updating rather than duplicating.
 *
 * Rows identical in every field are collapsed first: a repeated page would otherwise mint a
 * second ordinal for one execution. The ordinals follow price, then net value, then value date,
 * which is as stable across a restatement as anything the response offers.
 */
export function assignSecurityTransactionOccurrences<
  T extends SecurityTransactionIdentityFields & OrderableSecurityTransaction,
>(rows: readonly T[]): Array<T & { occurrence: number }> {
  const seen = new Set<string>();
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const fingerprint = JSON.stringify(row);
    if (seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);

    const groupKey = securityTransactionGroupKeyOf(row);
    const group = groups.get(groupKey);
    if (group) {
      group.push(row);
    } else {
      groups.set(groupKey, [row]);
    }
  }

  const result: Array<T & { occurrence: number }> = [];
  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        compareNullable(toNumber(a.tradePrice), toNumber(b.tradePrice)) ||
        compareNullable(toNumber(a.netValueTradeCurrency), toNumber(b.netValueTradeCurrency)) ||
        compareNullable(a.valueDate, b.valueDate),
    );
    for (const [index, row] of group.entries()) {
      result.push({ ...row, occurrence: index + 1 });
    }
  }
  return result;
}
