import { Currency, SecurityTradeType } from '../../../shared/enums.js';
import {
  addDaysToTimelessDate,
  compareTimelessDates,
} from '../../../shared/helpers/timeless-date.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import {
  executionAmountInCurrency,
  type MatchableExecution,
} from './match-security-executions.helper.js';
import { pairCancellations } from './security-cancellations.helper.js';
import {
  currencyOfSecurityLabel,
  isCancelledExecution,
  isDividendInKindDistribution,
  tryToSecurityTradeType,
} from './security-execution-enums.helper.js';

/**
 * The purchase cost of the units an execution takes out of a position, first in, first out —
 * replayed from the ingested executions of one security across the owner's portfolio accounts.
 *
 * FIFO is per account: a sale draws only on the lots of the account it was made in, which is how
 * the bank computes and withholds its tax, so its profit/loss figures stay comparable. The whole
 * owner's history is still replayed, because a transfer out of one of the owner's accounts and into
 * another — a move to a new account — carries its lots into the receiving account with their cost
 * and purchase-order place. A transfer in is only taken for such a move when it is of the same
 * units, into another account, within `TRANSFER_PAIRING_WINDOW_DAYS` of the transfer out; any other
 * transfer in came from outside, at no known cost, and a transfer out that nothing pairs with left
 * the owner.
 *
 * Cost is kept in the currency the units were paid in (the cash leg's currency), not converted to
 * shekels. Each lot names the acquisition it came from, so the caller prices it at the rate it
 * needs: the ledger at the rate the securities account carries it at, a tax computation at the
 * rate of its acquisition date.
 *
 * A cancelled execution never happened: the bank reports the cancellation as a row of its own and
 * leaves the original as it was, so both are dropped from the replay (`pairCancellations`).
 *
 * Only the ingested history is known. Units bought before it starts, or that arrived with no cash
 * leg (a deposit transfer, a stock distribution other than a dividend in kind), have no known cost
 * — reported apart, so the caller can say which it is rather than guess.
 *
 * A dividend in kind is booked as income at the gross value of the shares received, so that value
 * is their cost. It is taken from the execution whether or not its ledger entry was actually
 * booked (a distribution can fail to book, e.g. on withheld tax) — the cost is the event's, not
 * the ledger's.
 */

export type CostBasisExecution = Pick<
  MatchableExecution,
  | 'id'
  | 'trade_date'
  | 'trade_type'
  | 'security'
  | 'trade_currency'
  | 'settlement_currency'
  | 'net_value_trade_currency'
  | 'net_value_settlement_currency'
  | 'net_value_nis'
  | 'bank_number'
  | 'branch_number'
  | 'account_number'
> & {
  nv: string | null;
  /** The bank's `IsCancelTransaction`: "כן" on a cancelled execution */
  is_cancel_transaction: string | null;
  /** The bank's payment type label; tells a dividend in kind from other distributions */
  payment_type: string | null;
  /** The value of the units in the trade currency; a dividend in kind's cost */
  trade_gross_value_trade_currency: string | null;
};

/** Units drawn from one acquisition with a known cost */
export type FifoLot = {
  /** The acquisition (a buy or a dividend in kind) the units came from */
  executionId: string;
  /** Its trade date: the acquisition date of the units */
  tradeDate: TimelessDateString;
  units: number;
  /** What those units cost, in the requested currency */
  costForeign: number;
};

export type FifoCostBasis = {
  /** Units the execution takes out of the position */
  redeemedUnits: number;
  /** What the units drawn from lots with a known cost were paid, in the requested currency */
  costForeign: number;
  /** Units drawn from lots with a known cost */
  coveredUnits: number;
  /** Units drawn from lots with no known cost: transfers in, distributions, other currencies */
  unknownCostUnits: number;
  /** Units with no lot at all in the ingested history */
  missingUnits: number;
  /** The earliest ingested execution in the disposal's account: its history is only complete from this day on */
  historyStartDate: TimelessDateString | null;
  /**
   * Units went out of the disposal's account before as many were seen coming in — or lots were
   * transferred in from an account where that happened: the history starts mid-position, with an
   * opening holding of unknown size and cost ahead of every observed lot in FIFO order, so no lot
   * after it can be taken as the definitive cost of what is redeemed. A gap in an unrelated account
   * does not count.
   */
  openingPositionUnknown: boolean;
  /** The lots with a known cost the units were drawn from, oldest first; they add up to `costForeign` */
  lots: FifoLot[];
};

/**
 * How long after a transfer out of one of the owner's accounts a transfer in of the same units to
 * another may arrive and still be the same holding moving
 */
export const TRANSFER_PAIRING_WINDOW_DAYS = 10;

/** Fractional units (funds, ETFs) leave float residue; anything below this counts as nothing */
const UNITS_EPSILON = 1e-6;

type LotEffect =
  | 'BUY'
  | 'ADD_AT_GROSS_VALUE'
  | 'ADD_WITHOUT_COST'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'CONSUME'
  | 'NONE';

const LOT_EFFECT: Record<SecurityTradeType, LotEffect> = {
  [SecurityTradeType.Buy]: 'BUY',
  // a dividend in kind is the exception — see `lotEffectOf`. Bonus issues and splits are not
  // income and spread the existing cost instead; none has been seen yet, so they stay unknown
  [SecurityTradeType.StockDistribution]: 'ADD_WITHOUT_COST',
  [SecurityTradeType.TransferIn]: 'TRANSFER_IN',
  [SecurityTradeType.TransferInTwoSided]: 'TRANSFER_IN',
  [SecurityTradeType.Sell]: 'CONSUME',
  [SecurityTradeType.Redemption]: 'CONSUME',
  [SecurityTradeType.TransferOut]: 'TRANSFER_OUT',
  [SecurityTradeType.TransferOutTwoSided]: 'TRANSFER_OUT',
  [SecurityTradeType.DividendPayment]: 'NONE',
  [SecurityTradeType.InterestPayment]: 'NONE',
};

/**
 * Within a day, units come in before they go out, and a transfer out comes before the transfer in
 * it pairs with — the day's order is not otherwise known, and this order never draws a lot FIFO
 * would not: a same-day acquisition is the newest lot, reached only once the older ones are gone.
 */
const SAME_DAY_RANK: Record<LotEffect, number> = {
  BUY: 0,
  ADD_AT_GROSS_VALUE: 0,
  ADD_WITHOUT_COST: 0,
  TRANSFER_OUT: 1,
  TRANSFER_IN: 2,
  CONSUME: 3,
  NONE: 4,
};

type LotSource = Omit<FifoLot, 'units' | 'costForeign'>;

/**
 * `order` is the place in line: the acquisition's position in the replay, kept across transfers so
 * a moved lot takes its purchase-order place among the receiving account's own lots
 */
type Lot = { units: number; unitCost: number | null; order: number; source: LotSource | null };

/** Lots that left one of the owner's accounts, until a transfer in to another takes them in */
type PendingTransfer = {
  execution: CostBasisExecution;
  units: number;
  lots: Lot[];
  /** Whether the source account's history started mid-position by then, so these lots may not be */
  fromOpeningUnknown: boolean;
};

type AccountKey = string;

/** A portfolio account: the bank/branch/account triple the executions carry */
const accountKeyOf = (execution: CostBasisExecution): AccountKey =>
  `${execution.bank_number}-${execution.branch_number}-${execution.account_number}`;

const sameAccount = (a: CostBasisExecution, b: CostBasisExecution) =>
  accountKeyOf(a) === accountKeyOf(b);

/** Whether a transfer in is the arrival of a pending transfer out: a holding moving accounts */
function isArrivalOf(transferIn: CostBasisExecution, units: number, pending: PendingTransfer) {
  const out = pending.execution;
  return (
    Math.abs(pending.units - units) <= UNITS_EPSILON &&
    !sameAccount(out, transferIn) &&
    compareTimelessDates(transferIn.trade_date, out.trade_date) >= 0 &&
    compareTimelessDates(
      transferIn.trade_date,
      addDaysToTimelessDate(out.trade_date, TRANSFER_PAIRING_WINDOW_DAYS),
    ) <= 0
  );
}

function toUnits(nv: string | null): number {
  const units = Number(nv);
  return Number.isFinite(units) && units > 0 ? units : 0;
}

function lotEffectOf(execution: CostBasisExecution, tradeType: SecurityTradeType): LotEffect {
  return isDividendInKindDistribution(execution) ? 'ADD_AT_GROSS_VALUE' : LOT_EFFECT[tradeType];
}

/**
 * A dividend in kind's units cost what they were booked at: their gross value, which is in the
 * trade currency — so it is only known in that currency.
 */
function grossUnitCost(
  execution: CostBasisExecution,
  units: number,
  currency: Currency,
): number | null {
  const tradeCurrency = currencyOfSecurityLabel(execution.trade_currency);
  const gross = Number(execution.trade_gross_value_trade_currency);
  if (tradeCurrency !== currency || !Number.isFinite(gross) || gross <= 0) {
    return null;
  }
  return gross / units;
}

function sameDayRank(execution: CostBasisExecution): number {
  const tradeType = tryToSecurityTradeType(execution.trade_type);
  return tradeType ? SAME_DAY_RANK[lotEffectOf(execution, tradeType)] : SAME_DAY_RANK.NONE;
}

/**
 * Trade date, then the same-day rank, then id — the matcher's order, with the day's in before out.
 * Two disposals of one day go by id, so how the lots split between them is arbitrary; what they
 * take between them is not.
 */
function compareExecutions(a: CostBasisExecution, b: CostBasisExecution): number {
  return (
    compareTimelessDates(a.trade_date, b.trade_date) ||
    sameDayRank(a) - sameDayRank(b) ||
    a.id.localeCompare(b.id)
  );
}

function lotSourceOf(execution: CostBasisExecution): LotSource {
  return { executionId: execution.id, tradeDate: execution.trade_date };
}

const sumUnits = (lots: readonly Lot[]) => lots.reduce((sum, lot) => sum + lot.units, 0);

/** Takes `units` off the front of `lots`, returning what was taken lot by lot */
function takeUnits(lots: Lot[], units: number): Lot[] {
  const taken: Lot[] = [];
  let remaining = units;
  while (remaining > UNITS_EPSILON && lots.length > 0) {
    const lot = lots[0];
    const take = Math.min(lot.units, remaining);
    taken.push({ ...lot, units: take });
    lot.units -= take;
    remaining -= take;
    if (lot.units <= UNITS_EPSILON) {
      lots.shift();
    }
  }
  return taken;
}

export function calculateFifoCostBasis(
  history: readonly CostBasisExecution[],
  redemption: CostBasisExecution,
  currency: Currency,
): FifoCostBasis {
  // a cancellation and the execution it cancels both drop out
  const { live } = pairCancellations(history);

  const lotsByAccount = new Map<AccountKey, Lot[]>();
  const lotsOf = (execution: CostBasisExecution): Lot[] => {
    const key = accountKeyOf(execution);
    let lots = lotsByAccount.get(key);
    if (!lots) {
      lots = [];
      lotsByAccount.set(key, lots);
    }
    return lots;
  };
  // accounts whose history starts mid-position, by their own shortfall or lots moved in from one
  const openingUnknownAccounts = new Set<AccountKey>();
  const pendingTransfers: PendingTransfer[] = [];

  const earlier = live
    .filter(
      execution => execution.id !== redemption.id && compareExecutions(execution, redemption) < 0,
    )
    .sort(compareExecutions);
  for (const [order, execution] of earlier.entries()) {
    const tradeType = tryToSecurityTradeType(execution.trade_type);
    const units = toUnits(execution.nv);
    if (!tradeType || units === 0) {
      continue;
    }
    const lots = lotsOf(execution);

    switch (lotEffectOf(execution, tradeType)) {
      case 'BUY': {
        const paid = Math.abs(Number(executionAmountInCurrency(execution, currency) ?? Number.NaN));
        lots.push({
          units,
          unitCost: Number.isFinite(paid) ? paid / units : null,
          order,
          source: lotSourceOf(execution),
        });
        break;
      }
      case 'ADD_AT_GROSS_VALUE':
        lots.push({
          units,
          unitCost: grossUnitCost(execution, units, currency),
          order,
          source: lotSourceOf(execution),
        });
        break;
      case 'ADD_WITHOUT_COST':
        lots.push({ units, unitCost: null, order, source: null });
        break;
      case 'TRANSFER_OUT': {
        const taken = takeUnits(lots, units);
        if (units - sumUnits(taken) > UNITS_EPSILON) {
          openingUnknownAccounts.add(accountKeyOf(execution));
        }
        pendingTransfers.push({
          execution,
          units,
          lots: taken,
          fromOpeningUnknown: openingUnknownAccounts.has(accountKeyOf(execution)),
        });
        break;
      }
      case 'TRANSFER_IN': {
        const arrival = pendingTransfers.findIndex(pending =>
          isArrivalOf(execution, units, pending),
        );
        if (arrival === -1) {
          // from outside the owner's accounts
          lots.push({ units, unitCost: null, order, source: null });
          break;
        }
        // into this account at their purchase-order place; units the transfer out had no lot for
        // stay unknown
        const [{ lots: moved, fromOpeningUnknown }] = pendingTransfers.splice(arrival, 1);
        const uncovered = units - sumUnits(moved);
        lots.push(...moved);
        if (uncovered > UNITS_EPSILON) {
          lots.push({ units: uncovered, unitCost: null, order, source: null });
        }
        lots.sort((a, b) => a.order - b.order);
        if (fromOpeningUnknown) {
          openingUnknownAccounts.add(accountKeyOf(execution));
        }
        break;
      }
      case 'CONSUME': {
        // more taken out than the history put in means it starts mid-position
        if (units - sumUnits(takeUnits(lots, units)) > UNITS_EPSILON) {
          openingUnknownAccounts.add(accountKeyOf(execution));
        }
        break;
      }
      case 'NONE':
        break;
    }
  }

  // a cancelled execution takes nothing out
  const redeemedUnits = isCancelledExecution(redemption) ? 0 : toUnits(redemption.nv);
  let costForeign = 0;
  let coveredUnits = 0;
  let unknownCostUnits = 0;
  const costedLots: FifoLot[] = [];
  for (const lot of takeUnits(lotsOf(redemption), redeemedUnits)) {
    if (lot.unitCost == null || !lot.source) {
      unknownCostUnits += lot.units;
    } else {
      coveredUnits += lot.units;
      costForeign += lot.units * lot.unitCost;
      costedLots.push({ ...lot.source, units: lot.units, costForeign: lot.units * lot.unitCost });
    }
  }
  const missingUnits = redeemedUnits - coveredUnits - unknownCostUnits;

  const historyStartDate = live
    .filter(execution => sameAccount(execution, redemption))
    .reduce<TimelessDateString | null>(
      (earliest, execution) =>
        earliest == null || compareTimelessDates(execution.trade_date, earliest) < 0
          ? execution.trade_date
          : earliest,
      null,
    );

  return {
    redeemedUnits,
    costForeign,
    coveredUnits,
    unknownCostUnits,
    missingUnits: missingUnits > UNITS_EPSILON ? missingUnits : 0,
    historyStartDate,
    openingPositionUnknown: openingUnknownAccounts.has(accountKeyOf(redemption)),
    lots: costedLots,
  };
}
