import { formatAmountWithCurrency } from '@/helpers/currency.js';
import type { TimelessDateString } from '@/helpers/dates.js';
import { Currency, type DepositTransactionFieldsFragment } from '../../gql/graphql.js';
import type { DepositTransactionRowType } from './columns.js';

export function identifyInterestTransactionIds<T>(
  transactions: readonly T[],
  opts: {
    getId: (row: T) => string;
    getChargeId: (row: T) => string | null | undefined;
    getAmount: (row: T) => number;
  },
): Set<string> {
  const { getId, getChargeId, getAmount } = opts;

  const chargeGroups = new Map<string, T[]>();
  for (const row of transactions) {
    const chargeId = getChargeId(row);
    if (!chargeId) continue;
    const arr = chargeGroups.get(chargeId) ?? [];
    arr.push(row);
    if (!chargeGroups.has(chargeId)) chargeGroups.set(chargeId, arr);
  }

  const interestIds = new Set<string>();
  for (const [, txs] of chargeGroups) {
    if (txs.length > 1) {
      const sorted = [...txs].sort((a, b) => Math.abs(getAmount(b)) - Math.abs(getAmount(a)));
      for (let i = 1; i < sorted.length; i++) {
        interestIds.add(getId(sorted[i]));
      }
    }
  }

  return interestIds;
}

/** The parts of a deposit timeline step the deposit table needs */
export type DepositTableTimelineStep = {
  id: string;
  chargeId: string;
  date: TimelessDateString;
  /** Local currency per deposit-currency unit (1 for local deposits) */
  rate: number;
  source: string | null;
  /** Local currency */
  revaluation: { raw: number };
  /** Deposit currency */
  capitalizedInterest: { raw: number };
  /** Local currency */
  capitalizedInterestLocal: { raw: number };
  /** Local currency */
  taxCapitalized: { raw: number };
  /** Local currency */
  taxPaidOut: { raw: number };
};

/** A booked year-end revaluation of the deposit (local currency) */
export type DepositTableYearEnd = {
  id: string;
  date: TimelessDateString;
  revaluation: { raw: number };
};

type DepositTableEntry = Omit<
  DepositTransactionRowType,
  | 'cumulativeBalance'
  | 'localCumulativeBalance'
  | 'localAmount'
  | 'localCurrency'
  | 'totalInterest'
  | 'isInterest'
> & {
  /** Realized rows: how much the row moves the origin (deposit-currency) balance */
  originDelta?: number;
  /** Realized rows: how much the row moves the local balance (= its local amount) */
  localDelta?: number;
  /** Among rows of the same date: realized rows before the transactions, year ends last */
  rank: number;
};

const REALIZED_EPSILON = 0.005;

const EXCHANGE_RATE_KEYS: Partial<
  Record<Currency, 'eur' | 'gbp' | 'cad' | 'jpy' | 'aud' | 'sek' | 'usd'>
> = {
  [Currency.Eur]: 'eur',
  [Currency.Gbp]: 'gbp',
  [Currency.Cad]: 'cad',
  [Currency.Jpy]: 'jpy',
  [Currency.Aud]: 'aud',
  [Currency.Sek]: 'sek',
  [Currency.Usd]: 'usd',
};

/**
 * Builds the deposit table's rows: the deposit's bank transactions, plus the amounts the bank
 * realized on each deposit event without a transaction of their own (revaluation, interest
 * capitalized into the deposit, tax withheld inside it) and the booked year-end revaluations.
 * Each row carries the running origin and local balances, from the bank account's point of view
 * like the transactions: negative = held in the deposit. A closed deposit ends at 0 in both.
 *
 * Mirrors the server-side replay (`buildDepositTimeline`): per event, revaluation, capitalized
 * interest, tax withheld inside the deposit (`taxCapitalized / rate` of principal), then the
 * principal flow; year-end revaluations between events.
 */
export function buildDepositTableRows(input: {
  transactions: readonly DepositTransactionFieldsFragment[];
  /** `null` when the server couldn't build the timeline: the transactions alone are shown */
  timeline: {
    steps: readonly DepositTableTimelineStep[];
    yearEnds: readonly DepositTableYearEnd[];
  } | null;
  depositCurrency: Currency | null;
  localCurrency: Currency;
}): DepositTransactionRowType[] {
  const { transactions, timeline, localCurrency } = input;
  const currency =
    input.depositCurrency ??
    transactions.find(tx => tx.amount.currency)?.amount.currency ??
    localCurrency;
  const isLocal = currency === localCurrency;

  const entries: DepositTableEntry[] = transactions.map(tx => ({
    ...tx,
    kind: 'transaction',
    source: null,
    rank: 1,
  }));

  // An event's realized rows are dated with its charge's earliest transaction, so the table's
  // date order keeps them with their event (the step date is the value date).
  const chargeDates = new Map<string, TimelessDateString>();
  for (const tx of transactions) {
    const current = chargeDates.get(tx.chargeId);
    if (tx.eventDate && (!current || tx.eventDate < current)) {
      chargeDates.set(tx.chargeId, tx.eventDate);
    }
  }

  const amountOf = (raw: number) => ({
    raw,
    formatted: formatAmountWithCurrency(raw, currency),
    currency,
  });
  const noOriginAmount = { raw: 0, formatted: '—', currency };

  for (const step of timeline?.steps ?? []) {
    const base = {
      chargeId: step.chargeId,
      eventDate: chargeDates.get(step.chargeId) ?? step.date,
      debitExchangeRates: null,
      eventExchangeRates: null,
      source: step.source ?? null,
      rank: 0,
    };
    if (Math.abs(step.revaluation.raw) >= REALIZED_EPSILON) {
      entries.push({
        ...base,
        id: `${step.id}:revaluation`,
        kind: 'revaluation',
        amount: noOriginAmount,
        source: null,
        originDelta: 0,
        localDelta: -step.revaluation.raw,
      });
    }
    if (Math.abs(step.capitalizedInterest.raw) >= REALIZED_EPSILON) {
      entries.push({
        ...base,
        id: `${step.id}:interest`,
        kind: 'capitalizedInterest',
        amount: amountOf(-step.capitalizedInterest.raw),
        originDelta: -step.capitalizedInterest.raw,
        localDelta: -step.capitalizedInterestLocal.raw,
      });
    }
    const tax = step.taxCapitalized.raw + step.taxPaidOut.raw;
    if (Math.abs(tax) >= REALIZED_EPSILON) {
      entries.push({
        ...base,
        id: `${step.id}:tax`,
        kind: 'tax',
        // tax is a local-currency figure: it has an origin amount only in a local deposit
        amount: isLocal ? amountOf(tax) : noOriginAmount,
        source: null,
        // only the tax withheld inside the deposit reduces it (its principal at the event's
        // rate); tax on paid-out interest was taken off the interest line
        originDelta: step.rate ? step.taxCapitalized.raw / step.rate : 0,
        localDelta: step.taxCapitalized.raw,
      });
    }
  }

  for (const yearEnd of timeline?.yearEnds ?? []) {
    if (Math.abs(yearEnd.revaluation.raw) < REALIZED_EPSILON) continue;
    entries.push({
      id: yearEnd.id,
      chargeId: '',
      eventDate: yearEnd.date,
      debitExchangeRates: null,
      eventExchangeRates: null,
      kind: 'revaluation',
      source: null,
      amount: noOriginAmount,
      originDelta: 0,
      localDelta: -yearEnd.revaluation.raw,
      rank: 2,
    });
  }

  const interestTransactionIds = identifyInterestTransactionIds(transactions, {
    getId: tx => tx.id,
    getChargeId: tx => tx.chargeId,
    getAmount: tx => Number(tx.amount.raw ?? 0),
  });

  const sorted = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const dateA = a.entry.eventDate ?? '';
      const dateB = b.entry.eventDate ?? '';
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      if (a.entry.rank !== b.entry.rank) return a.entry.rank - b.entry.rank;
      return a.index - b.index;
    })
    .map(({ entry }) => entry);

  let cumulativeBalance = 0;
  let localCumulativeBalance = 0;
  let totalInterest = 0;
  const rows: DepositTransactionRowType[] = [];

  for (const entry of sorted) {
    const { originDelta, localDelta, rank: _rank, ...row } = entry;
    const isInterest = entry.kind === 'transaction' && interestTransactionIds.has(entry.id);
    let localAmount: number;

    if (entry.kind === 'transaction') {
      const amount = Number(entry.amount.raw);
      const rateKey = EXCHANGE_RATE_KEYS[entry.amount.currency];
      const rate = rateKey
        ? (entry.debitExchangeRates?.[rateKey] ?? entry.eventExchangeRates?.[rateKey] ?? null)
        : null;
      localAmount = amount * (rate ?? 1);
      if (isInterest) {
        // paid out with the event: interest, not principal
        totalInterest += amount;
      } else {
        cumulativeBalance += amount;
        localCumulativeBalance += localAmount;
      }
    } else {
      localAmount = localDelta ?? 0;
      cumulativeBalance += originDelta ?? 0;
      localCumulativeBalance += localAmount;
      if (entry.kind === 'capitalizedInterest') {
        // re-deposited: it is interest, and it stays in the deposit
        totalInterest -= originDelta ?? 0;
      }
    }

    rows.push({
      ...row,
      cumulativeBalance,
      localCumulativeBalance,
      localAmount,
      localCurrency,
      totalInterest,
      isInterest,
    });
  }

  return rows;
}
