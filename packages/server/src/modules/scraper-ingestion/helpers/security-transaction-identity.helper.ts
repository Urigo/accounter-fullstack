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

type PricedSecurityTransaction = {
  tradePrice?: number | string | null | void;
  netValueTradeCurrency?: number | string | null | void;
};

/** A stored execution, as `fetchPoalimSecuritiesTransactionsByKeys` returns it. */
type PersistedSecurityTransaction = SecurityTransactionIdentityFields & {
  occurrence: number;
  trade_price?: number | string | null | void;
  net_value_trade_currency?: number | string | null | void;
};

const toNumber = (value: number | string | null | void) => (value == null ? null : Number(value));

/** How far apart two versions of an execution are; a null on one side only is as far as it gets. */
function distance(a: number | string | null | void, b: number | string | null | void) {
  const x = toNumber(a);
  const y = toNumber(b);
  if (x === null || y === null) return x === y ? 0 : Number.POSITIVE_INFINITY;
  return Math.abs(x - y);
}

function compareNullable(a: number | null, b: number | null) {
  if (a === null) return b === null ? 0 : -1;
  if (b === null) return 1;
  return a - b;
}

/**
 * Drops rows identical in every field — a repeated page would otherwise read as a second
 * execution with the same key.
 */
export function dropRepeatedSecurityTransactions<T>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    const fingerprint = JSON.stringify(row);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

/**
 * Gives each incoming execution the `occurrence` that keeps it apart from other executions
 * sharing its group key — the response carries no per-execution id, so this is its identity.
 *
 * Ordinals are anchored to what is already stored, not counted afresh per upload: an upload can be
 * partial (the scraper uploads a truncated page set with a warning) or can report an execution the
 * stored set lacks. Each incoming row is therefore paired with the stored row of its group that it
 * is closest to — by price, then net value, pairs taken nearest-first and one-to-one — and takes
 * that row's ordinal, so a restatement updates the execution it restates. An incoming row with no
 * stored counterpart is a new execution and takes the next free ordinal.
 *
 * Pass rows through `dropRepeatedSecurityTransactions` first; two identical rows would otherwise
 * be taken for two executions.
 */
export function assignSecurityTransactionOccurrences<
  T extends SecurityTransactionIdentityFields & PricedSecurityTransaction,
>(
  rows: readonly T[],
  persisted: readonly PersistedSecurityTransaction[],
): Array<T & { occurrence: number }> {
  const persistedByGroup = new Map<string, PersistedSecurityTransaction[]>();
  for (const row of persisted) {
    const groupKey = securityTransactionGroupKeyOf(row);
    persistedByGroup.set(groupKey, [...(persistedByGroup.get(groupKey) ?? []), row]);
  }

  const incomingByGroup = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = securityTransactionGroupKeyOf(row);
    incomingByGroup.set(groupKey, [...(incomingByGroup.get(groupKey) ?? []), row]);
  }

  const result: Array<T & { occurrence: number }> = [];
  for (const [groupKey, group] of incomingByGroup) {
    const incoming = [...group].sort(
      (a, b) =>
        compareNullable(toNumber(a.tradePrice), toNumber(b.tradePrice)) ||
        compareNullable(toNumber(a.netValueTradeCurrency), toNumber(b.netValueTradeCurrency)),
    );
    const stored = persistedByGroup.get(groupKey) ?? [];

    const pairs = incoming.flatMap((row, index) =>
      stored.map(existing => ({
        index,
        occurrence: existing.occurrence,
        price: distance(row.tradePrice, existing.trade_price),
        net: distance(row.netValueTradeCurrency, existing.net_value_trade_currency),
      })),
    );
    pairs.sort(
      (a, b) =>
        a.price - b.price || a.net - b.net || a.index - b.index || a.occurrence - b.occurrence,
    );

    const occurrenceOf = new Map<number, number>();
    const taken = new Set<number>();
    for (const pair of pairs) {
      if (occurrenceOf.has(pair.index) || taken.has(pair.occurrence)) continue;
      occurrenceOf.set(pair.index, pair.occurrence);
      taken.add(pair.occurrence);
    }

    let next = Math.max(0, ...stored.map(existing => existing.occurrence)) + 1;
    for (const [index, row] of incoming.entries()) {
      let occurrence = occurrenceOf.get(index);
      if (occurrence === undefined) {
        occurrence = next;
        next += 1;
      }
      result.push({ ...row, occurrence });
    }
  }
  return result;
}
