import { Currency, SecurityTradeType } from '../../../shared/enums.js';
import { compareTimelessDates } from '../../../shared/helpers/timeless-date.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import {
  executionAmountInCurrency,
  type MatchableExecution,
} from './match-security-executions.helper.js';
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
 * FIFO is the taxpayer's, not an account's (Income Tax Regulations on capital gains from traded
 * securities, 2002, reg. 5): identical securities are sold in the order they were acquired. A
 * transfer out of one of the owner's accounts and into another — a move to a new account — carries
 * its lots across with their cost and place in line; units transferred in with no such transfer out
 * have no known cost.
 *
 * Cost is kept in the currency the units were paid in (the cash leg's currency), not converted to
 * shekels. Each lot says when it was acquired and when its cost was booked, so the caller prices it
 * at the rate it needs: the ledger at the rate the securities account carries it at, a tax
 * computation at the rate of its acquisition date.
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
  | 'trade_currency'
  | 'settlement_currency'
  | 'net_value_trade_currency'
  | 'net_value_settlement_currency'
  | 'net_value_nis'
> & {
  nv: string | null;
  /** The bank's `IsCancelTransaction`: "כן" on a cancelled execution */
  is_cancel_transaction: string | null;
  /** The bank's payment type label; tells a dividend in kind from other distributions */
  payment_type: string | null;
  /** The value of the units in the trade currency; a dividend in kind's cost */
  trade_gross_value_trade_currency: string | null;
  /** When the cash leg settled — the day an acquisition's cost was booked at */
  value_date?: TimelessDateString | null;
  settlement_date?: TimelessDateString | null;
};

/** Units drawn from one acquisition with a known cost */
export type FifoLot = {
  /** The acquisition (a buy or a dividend in kind) the units came from */
  executionId: string;
  /** Its trade date: the acquisition date of the units */
  tradeDate: TimelessDateString;
  /** The day its cost was booked: its value date, else its settlement date, else its trade date */
  bookedDate: TimelessDateString;
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
  /** The earliest ingested execution: the history is only complete from this day on */
  historyStartDate: TimelessDateString | null;
  /**
   * Units went out before as many were seen coming in: the history starts mid-position, with an
   * opening holding of unknown size and cost ahead of every observed lot in FIFO order — so no
   * lot after it can be taken as the definitive cost of what is redeemed.
   */
  openingPositionUnknown: boolean;
  /** The lots with a known cost the units were drawn from, oldest first; they add up to `costForeign` */
  lots: FifoLot[];
};

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

/** `order` is the place in line: the acquisition's position in the replay, kept across transfers */
type Lot = { units: number; unitCost: number | null; order: number; source: LotSource | null };

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

/** Trade date, then the same-day rank, then id — the matcher's order, with the day's in before out */
function compareExecutions(a: CostBasisExecution, b: CostBasisExecution): number {
  return (
    compareTimelessDates(a.trade_date, b.trade_date) ||
    sameDayRank(a) - sameDayRank(b) ||
    a.id.localeCompare(b.id)
  );
}

function lotSourceOf(execution: CostBasisExecution): LotSource {
  return {
    executionId: execution.id,
    tradeDate: execution.trade_date,
    bookedDate: execution.value_date ?? execution.settlement_date ?? execution.trade_date,
  };
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
  const live = history.filter(execution => !isCancelledExecution(execution));

  const lots: Lot[] = [];
  // lots transferred out of one of the owner's accounts, until a transfer in brings them back
  const inTransit: Lot[] = [];
  let openingPositionUnknown = false;
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
        inTransit.push(...taken);
        if (units - sumUnits(taken) > UNITS_EPSILON) {
          openingPositionUnknown = true;
        }
        break;
      }
      case 'TRANSFER_IN': {
        // back in line where the lots stood; the rest came from outside the owner's accounts
        const restored = takeUnits(inTransit, units);
        const fromOutside = units - sumUnits(restored);
        lots.push(...restored);
        if (fromOutside > UNITS_EPSILON) {
          lots.push({ units: fromOutside, unitCost: null, order, source: null });
        }
        lots.sort((a, b) => a.order - b.order);
        break;
      }
      case 'CONSUME': {
        // more taken out than the history put in means it starts mid-position
        if (units - sumUnits(takeUnits(lots, units)) > UNITS_EPSILON) {
          openingPositionUnknown = true;
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
  for (const lot of takeUnits(lots, redeemedUnits)) {
    if (lot.unitCost == null || !lot.source) {
      unknownCostUnits += lot.units;
    } else {
      coveredUnits += lot.units;
      costForeign += lot.units * lot.unitCost;
      costedLots.push({ ...lot.source, units: lot.units, costForeign: lot.units * lot.unitCost });
    }
  }
  const missingUnits = redeemedUnits - coveredUnits - unknownCostUnits;

  const historyStartDate = live.reduce<TimelessDateString | null>(
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
    openingPositionUnknown,
    lots: costedLots,
  };
}
