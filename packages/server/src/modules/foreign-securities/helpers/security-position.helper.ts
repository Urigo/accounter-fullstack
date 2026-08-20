import { SecurityTradeType } from '../../../shared/enums.js';
import { dateToTimelessDateString } from '../../../shared/helpers/misc.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { toSecurityTradeType } from './security-execution-enums.helper.js';

/**
 * How each kind of execution moves the holding. Cash-only actions — a dividend or an interest
 * payment — leave the position untouched, which is why this is not the same map as the
 * matcher's cash direction.
 */
const QUANTITY_DIRECTION: Record<SecurityTradeType, -1 | 0 | 1> = {
  [SecurityTradeType.Buy]: 1,
  [SecurityTradeType.Sell]: -1,
  [SecurityTradeType.Redemption]: -1,
  [SecurityTradeType.StockDistribution]: 1,
  [SecurityTradeType.TransferIn]: 1,
  [SecurityTradeType.TransferOut]: -1,
  [SecurityTradeType.TransferInTwoSided]: 1,
  [SecurityTradeType.TransferOutTwoSided]: -1,
  [SecurityTradeType.DividendPayment]: 0,
  [SecurityTradeType.InterestPayment]: 0,
};

export type PositionExecution = {
  trade_date: Date;
  trade_type: string;
  nv: string | null;
  net_value_trade_currency: string | null;
  trade_currency: string | null;
};

export type SecurityPositionProto = {
  /** Units held, derived from the ingested executions alone. */
  quantity: number;
  /** Weighted average price paid per unit bought, in the trade currency. Null with no buys. */
  averageCost: number | null;
  totalBought: number;
  totalSold: number;
  /** The currency the amounts above are in — the trade currency the executions report. */
  currency: string | null;
  /**
   * The earliest ingested execution. The position is only as complete as history from this
   * day on, which is what the UI has to say out loud: holdings are not ingested, so anything
   * bought before the first scraped execution is invisible here.
   */
  historyStartDate: TimelessDateString | null;
  lastExecutionDate: TimelessDateString | null;
};

/**
 * How close to zero counts as zero. Units are fractional for ETFs and mutual funds, so a
 * fully-sold position lands on a floating-point residue rather than on 0, and `quantity !== 0`
 * would keep every closed position in a holdings list. The threshold sits two orders of
 * magnitude below the four decimals the UI prints, so nothing visible on screen is ever hidden.
 */
const QUANTITY_EPSILON = 1e-6;

/**
 * Whether anything is still held.
 *
 * `Math.abs` on purpose: a negative quantity means the ingested history starts mid-life — units
 * were sold that were never seen bought — and that is a data-quality signal worth surfacing,
 * not a closed position to filter away.
 */
export const isOpenPosition = (position: Pick<SecurityPositionProto, 'quantity'>): boolean =>
  Math.abs(position.quantity) > QUANTITY_EPSILON;

const toNumber = (value: string | null): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * The holding a security's ingested executions add up to, plus what was paid for it.
 *
 * Derived, not reported: the bank's own balances are not ingested. Corporate actions that
 * change the unit count without an execution row (a split, say) are therefore invisible, and a
 * history that starts mid-life starts from zero — hence `historyStartDate`.
 */
export function calculateSecurityPosition(
  executions: readonly PositionExecution[],
): SecurityPositionProto {
  let quantity = 0;
  let boughtQuantity = 0;
  let totalBought = 0;
  let totalSold = 0;
  let currency: string | null = null;
  let historyStart: Date | null = null;
  let lastExecution: Date | null = null;

  for (const execution of executions) {
    const tradeType = toSecurityTradeType(execution.trade_type);
    const units = toNumber(execution.nv);
    const netValue = Math.abs(toNumber(execution.net_value_trade_currency));

    quantity += QUANTITY_DIRECTION[tradeType] * units;

    if (tradeType === SecurityTradeType.Buy) {
      boughtQuantity += units;
      totalBought += netValue;
    }
    if (tradeType === SecurityTradeType.Sell || tradeType === SecurityTradeType.Redemption) {
      totalSold += netValue;
    }

    currency ??= execution.trade_currency;
    if (!historyStart || execution.trade_date < historyStart) {
      historyStart = execution.trade_date;
    }
    if (!lastExecution || execution.trade_date > lastExecution) {
      lastExecution = execution.trade_date;
    }
  }

  return {
    quantity,
    averageCost: boughtQuantity > 0 ? totalBought / boughtQuantity : null,
    totalBought,
    totalSold,
    currency,
    historyStartDate: historyStart ? dateToTimelessDateString(historyStart) : null,
    lastExecutionDate: lastExecution ? dateToTimelessDateString(lastExecution) : null,
  };
}
