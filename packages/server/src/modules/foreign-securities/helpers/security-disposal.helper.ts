import { SecurityTradeType } from '../../../shared/enums.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import type { SecurityExecutionRow } from '../types.js';
import { TRANSFER_PAIRING_WINDOW_DAYS, type FifoCostBasis } from './security-cost-basis.helper.js';
import { tryToSecurityTradeType } from './security-execution-enums.helper.js';

/**
 * The arithmetic of a disposal — a sale or a redemption — out of its FIFO lots.
 *
 * For each lot, with F the proceeds the lot's units fetched and C what they cost (both in the
 * currency the units were paid in), R_s the sale's rate and R_lot the rate the lot's cost is counted
 * at:
 * - origin-currency PnL = F − C
 * - price PnL           = (F − C) × R_s
 * - rate PnL            = C × (R_s − R_lot)
 * - local (ILS) PnL     = F × R_s − C × R_lot = price PnL + rate PnL
 *
 * Which rates go in depends on the question. The ledger counts the sale at the rate its cash leg
 * was booked at and each lot at the rate the securities account carries it at; a tax computation
 * counts both at the representative rate of their trade dates; the bank cross-check, at the bank's
 * own rates.
 */

/** Fractional units (funds, ETFs) leave float residue; anything below this counts as nothing */
const UNITS_EPSILON = 1e-6;

export type DisposalLotInput = {
  units: number;
  /** What the lot's units cost, in the currency they were paid in */
  costForeign: number;
  /** The rate the lot's cost is counted at, in local currency per unit of that currency */
  rate: number;
};

export type DisposalLotPnL = DisposalLotInput & {
  /** The lot's share of the proceeds, by units */
  proceedsForeign: number;
  costLocal: number;
  originCurrencyPnL: number;
  pricePnL: number;
  ratePnL: number;
  localPnL: number;
};

export type DisposalPnL = {
  proceedsForeign: number;
  proceedsLocal: number;
  costForeign: number;
  costLocal: number;
  originCurrencyPnL: number;
  pricePnL: number;
  ratePnL: number;
  localPnL: number;
  lots: DisposalLotPnL[];
};

export function calculateDisposalPnL(params: {
  /** What the disposed units fetched, before tax, in the currency they were paid in */
  proceedsForeign: number;
  /** The rate the proceeds are counted at */
  saleRate: number;
  lots: readonly DisposalLotInput[];
}): DisposalPnL {
  const { proceedsForeign, saleRate } = params;
  const totalUnits = params.lots.reduce((sum, lot) => sum + lot.units, 0);

  const lots = params.lots.map(lot => {
    const lotProceeds = totalUnits > UNITS_EPSILON ? (proceedsForeign * lot.units) / totalUnits : 0;
    const costLocal = lot.costForeign * lot.rate;
    const originCurrencyPnL = lotProceeds - lot.costForeign;
    return {
      ...lot,
      proceedsForeign: lotProceeds,
      costLocal,
      originCurrencyPnL,
      pricePnL: originCurrencyPnL * saleRate,
      ratePnL: lot.costForeign * (saleRate - lot.rate),
      localPnL: lotProceeds * saleRate - costLocal,
    };
  });

  const costForeign = lots.reduce((sum, lot) => sum + lot.costForeign, 0);
  const costLocal = lots.reduce((sum, lot) => sum + lot.costLocal, 0);
  const proceedsLocal = proceedsForeign * saleRate;
  return {
    proceedsForeign,
    proceedsLocal,
    costForeign,
    costLocal,
    originCurrencyPnL: proceedsForeign - costForeign,
    pricePnL: (proceedsForeign - costForeign) * saleRate,
    ratePnL: lots.reduce((sum, lot) => sum + lot.ratePnL, 0),
    localPnL: proceedsLocal - costLocal,
    lots,
  };
}

/**
 * The last revaluation of the securities account a lot was held over: the latest revaluation on or
 * after the day the lot's cost was booked and before the disposal. It moved the lot's local
 * carrying value to that day's rate; with none (null), the lot is still carried at the rate it was
 * booked at.
 *
 * Read from the revaluations actually booked rather than assumed from the calendar, so a year whose
 * revaluation was never booked leaves the lot where it was. One booked after the disposal's ledger
 * was generated is only seen once that ledger is regenerated.
 */
export function lastRevaluationOver(
  bookedOn: TimelessDateString,
  disposedOn: TimelessDateString,
  revaluationDates: readonly TimelessDateString[],
): TimelessDateString | null {
  return revaluationDates.reduce<TimelessDateString | null>(
    (latest, date) =>
      date >= bookedOn && date < disposedOn && (!latest || date > latest) ? date : latest,
    null,
  );
}

export function describeSecurity(
  execution: Pick<SecurityExecutionRow, 'symbol' | 'security' | 'isin'>,
) {
  const name = execution.symbol ?? execution.security;
  return execution.isin ? `${name} (${execution.isin})` : name;
}

/** Why the FIFO purchase cost of a disposal cannot be worked out, or null when it can */
export function costBasisProblem(
  execution: SecurityExecutionRow,
  costBasis: FifoCostBasis,
): string | null {
  const security = describeSecurity(execution);
  const isSale = tryToSecurityTradeType(execution.trade_type) === SecurityTradeType.Sell;
  const disposed = `${isSale ? 'sold' : 'redeemed'} on ${execution.trade_date}`;
  const account = `${execution.bank_number}-${execution.branch_number}-${execution.account_number}`;
  const bankProfitLoss = Number(execution.nominal_profit_loss_nis);
  const bankNote =
    Number.isFinite(bankProfitLoss) && bankProfitLoss !== 0
      ? ` For reference, the bank reports a nominal profit/loss of ${bankProfitLoss} ₪ on it.`
      : '';

  if (costBasis.redeemedUnits === 0) {
    return `The ${isSale ? 'sale' : 'redemption'} of ${security} on ${execution.trade_date} reports no ${isSale ? 'sold' : 'redeemed'} units, so its purchase cost cannot be found.${bankNote}`;
  }
  if (costBasis.openingPositionUnknown) {
    const history = costBasis.historyStartDate
      ? ` (it starts on ${costBasis.historyStartDate})`
      : '';
    return `Could not determine the purchase cost of ${costBasis.redeemedUnits} units of ${security} ${disposed}: the scraped securities history of account ${account}${history}, or of an account units were transferred into it from, starts mid-position — units were sold or transferred out before as many were seen bought, so an earlier holding of unknown cost comes first. Scrape older securities transactions to complete it.${bankNote}`;
  }
  if (costBasis.missingUnits > 0) {
    const history = costBasis.historyStartDate
      ? `the scraped securities history of account ${account} starts on ${costBasis.historyStartDate}`
      : `no securities history of it was scraped for account ${account}`;
    return `Could not find the purchase of ${costBasis.missingUnits} of ${costBasis.redeemedUnits} units of ${security} ${disposed}: ${history}. Scrape older securities transactions to complete it.${bankNote}`;
  }
  if (costBasis.unknownCostUnits > 0) {
    return `${costBasis.unknownCostUnits} of ${costBasis.redeemedUnits} units of ${security} ${disposed} have no known purchase cost: they arrived by a transfer in that no transfer out from another of the owner's accounts pairs with (same units, within ${TRANSFER_PAIRING_WINDOW_DAYS} days), by a distribution other than a dividend in kind, or were bought or distributed in another currency.${bankNote}`;
  }
  return null;
}
