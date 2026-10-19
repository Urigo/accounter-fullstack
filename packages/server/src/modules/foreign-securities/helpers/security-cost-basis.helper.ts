import { Currency, SecurityTradeType } from '../../../shared/enums.js';
import { compareTimelessDates } from '../../../shared/helpers/timeless-date.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import {
  executionAmountInCurrency,
  type MatchableExecution,
} from './match-security-executions.helper.js';
import { isCancelledExecution, tryToSecurityTradeType } from './security-execution-enums.helper.js';

/**
 * The purchase cost of the units an execution takes out of a position, first in, first out —
 * replayed from the ingested executions of one security in one portfolio account.
 *
 * Cost is kept in the currency the units were paid in (the cash leg's currency), not converted to
 * shekels: the securities account is a foreign-currency account the year-end revaluation already
 * revalues, so crediting it at the historical shekel cost would count the currency effect twice.
 *
 * Only the ingested history is known. Units bought before it starts, or that arrived with no cash
 * leg (a deposit transfer, a stock distribution), have no known cost — reported apart, so the
 * caller can say which it is rather than guess.
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
};

/** Fractional units (funds, ETFs) leave float residue; anything below this counts as nothing */
const UNITS_EPSILON = 1e-6;

type LotEffect = 'BUY' | 'ADD_WITHOUT_COST' | 'CONSUME' | 'NONE';

const LOT_EFFECT: Record<SecurityTradeType, LotEffect> = {
  [SecurityTradeType.Buy]: 'BUY',
  [SecurityTradeType.StockDistribution]: 'ADD_WITHOUT_COST',
  [SecurityTradeType.TransferIn]: 'ADD_WITHOUT_COST',
  [SecurityTradeType.TransferInTwoSided]: 'ADD_WITHOUT_COST',
  [SecurityTradeType.Sell]: 'CONSUME',
  [SecurityTradeType.Redemption]: 'CONSUME',
  [SecurityTradeType.TransferOut]: 'CONSUME',
  [SecurityTradeType.TransferOutTwoSided]: 'CONSUME',
  [SecurityTradeType.DividendPayment]: 'NONE',
  [SecurityTradeType.InterestPayment]: 'NONE',
};

type Lot = { units: number; unitCost: number | null };

function toUnits(nv: string | null): number {
  const units = Number(nv);
  return Number.isFinite(units) && units > 0 ? units : 0;
}

/** The same total order the matcher pairs in: trade date, then id */
function compareExecutions(a: CostBasisExecution, b: CostBasisExecution): number {
  return compareTimelessDates(a.trade_date, b.trade_date) || a.id.localeCompare(b.id);
}

/** Takes `units` off the front of `lots`, returning what was taken lot by lot */
function takeUnits(lots: Lot[], units: number): Lot[] {
  const taken: Lot[] = [];
  let remaining = units;
  while (remaining > UNITS_EPSILON && lots.length > 0) {
    const lot = lots[0];
    const take = Math.min(lot.units, remaining);
    taken.push({ units: take, unitCost: lot.unitCost });
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
  let openingPositionUnknown = false;
  const earlier = live
    .filter(
      execution => execution.id !== redemption.id && compareExecutions(execution, redemption) < 0,
    )
    .sort(compareExecutions);
  for (const execution of earlier) {
    const tradeType = tryToSecurityTradeType(execution.trade_type);
    const units = toUnits(execution.nv);
    if (!tradeType || units === 0) {
      continue;
    }

    switch (LOT_EFFECT[tradeType]) {
      case 'BUY': {
        const paid = Math.abs(Number(executionAmountInCurrency(execution, currency) ?? Number.NaN));
        lots.push({ units, unitCost: Number.isFinite(paid) ? paid / units : null });
        break;
      }
      case 'ADD_WITHOUT_COST':
        lots.push({ units, unitCost: null });
        break;
      case 'CONSUME': {
        // more taken out than the history put in means it starts mid-position
        const taken = takeUnits(lots, units).reduce((sum, lot) => sum + lot.units, 0);
        if (units - taken > UNITS_EPSILON) {
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
  for (const lot of takeUnits(lots, redeemedUnits)) {
    if (lot.unitCost == null) {
      unknownCostUnits += lot.units;
    } else {
      coveredUnits += lot.units;
      costForeign += lot.units * lot.unitCost;
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
  };
}
