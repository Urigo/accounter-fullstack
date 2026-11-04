import { Currency, SecurityTradeType } from '../../../shared/enums.js';
import type { SecurityExecutionRow } from '../types.js';
import { executionAmountInCurrency } from './match-security-executions.helper.js';
import { TRANSFER_PAIRING_WINDOW_DAYS, type FifoCostBasis } from './security-cost-basis.helper.js';
import {
  currencyOfSecurityLabel,
  tryToSecurityTradeType,
} from './security-execution-enums.helper.js';

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
 * was booked at and each lot at the rate its cost was booked at, ignoring year-end revaluations; a
 * tax computation counts both at the representative rate of their trade dates; the bank
 * cross-check, at the bank's own rates.
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

function toNumber(value: string | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * The bank's rate from an execution's trade currency to the local one: its own rate column when
 * reported (it writes -1 for "no rate"), or else its local value over its trade-currency value —
 * `derived`, since both of those amounts are rounded. Null when neither is usable.
 */
export function getExecutionBankRate(
  execution: Pick<
    SecurityExecutionRow,
    'personal_currency_rate' | 'trade_gross_value_trade_currency' | 'trade_gross_value_nis'
  >,
): { rate: number; derived: boolean } | null {
  const personalRate = toNumber(execution.personal_currency_rate);
  if (personalRate > 0) {
    return { rate: personalRate, derived: false };
  }
  const gross = Math.abs(toNumber(execution.trade_gross_value_trade_currency));
  const grossLocal = Math.abs(toNumber(execution.trade_gross_value_nis));
  return gross > 0 && grossLocal > 0 ? { rate: grossLocal / gross, derived: true } : null;
}

/**
 * An individual's real gain on a foreign-currency security, as the bank reports it: s.88 of the
 * Income Tax Ordinance makes the exchange rate the index, so the inflationary amount is the rate
 * PnL, capped at the gain. That leaves the smaller of the two gains (price PnL and local PnL), the
 * smaller of the two losses — and nothing when one is a gain and the other a loss.
 */
export function lowerOfTwo(pricePnL: number, localPnL: number): number {
  if (pricePnL > 0 && localPnL > 0) {
    return Math.min(pricePnL, localPnL);
  }
  if (pricePnL < 0 && localPnL < 0) {
    return Math.max(pricePnL, localPnL);
  }
  return 0;
}

/** How far our PnL may be from the bank's: two shekels, or a millionth of the proceeds */
export const BANK_PNL_TOLERANCE = { absolute: 2, relative: 1e-6 } as const;

export type BankProfitLossExecution = Pick<
  SecurityExecutionRow,
  'nominal_profit_loss_nis' | 'nominal_profit_loss_linkage' | 'real_profit_loss_nis'
>;

export type BankProfitLossMismatch = {
  field: 'NOMINAL' | 'RATE' | 'REAL';
  /** Our figure */
  ours: number;
  /** The bank's figure, in our sign convention */
  bank: number;
};

/**
 * Where a disposal's PnL, worked out at the bank's own rates, disagrees with the bank's report:
 * - its nominal PnL in shekels is the local PnL;
 * - its linkage is the rate PnL with the sign turned: the bank reports it on the cost side, as
 *   what the shekel's moves added to the cost;
 * - its real PnL is the individual's under s.88 (`lowerOfTwo`).
 *
 * Whether the bank deducts the trade's commissions is not known, so a figure that matches with them
 * deducted matches too. A security in the local currency is only checked on
 * the nominal PnL: its linkage and real PnL are the bank's CPI figures. Nothing is checked when the
 * bank reports no PnL at all.
 */
export function compareWithBankProfitLoss(params: {
  execution: BankProfitLossExecution;
  pnl: Pick<DisposalPnL, 'pricePnL' | 'ratePnL' | 'localPnL' | 'proceedsLocal'>;
  /** The trade's commissions in the local currency */
  commissionsLocal: number;
  isForeign: boolean;
}): BankProfitLossMismatch[] {
  const { execution, pnl, isForeign } = params;
  const reported = (value: string | null) => (value == null ? null : toNumber(value));
  const nominal = reported(execution.nominal_profit_loss_nis);
  const linkage = reported(execution.nominal_profit_loss_linkage);
  const real = reported(execution.real_profit_loss_nis);
  if (!nominal && !linkage && !real) {
    return [];
  }

  const tolerance = Math.max(
    BANK_PNL_TOLERANCE.absolute,
    BANK_PNL_TOLERANCE.relative * Math.abs(pnl.proceedsLocal),
  );
  const deductions = params.commissionsLocal ? [0, params.commissionsLocal] : [0];
  const matches = (ours: (deduction: number) => number, bank: number) =>
    deductions.some(deduction => Math.abs(ours(deduction) - bank) <= tolerance);

  const mismatches: BankProfitLossMismatch[] = [];
  if (nominal != null && !matches(deduction => pnl.localPnL - deduction, nominal)) {
    mismatches.push({ field: 'NOMINAL', ours: pnl.localPnL, bank: nominal });
  }
  if (isForeign && linkage != null && !matches(() => pnl.ratePnL, -linkage)) {
    mismatches.push({ field: 'RATE', ours: pnl.ratePnL, bank: -linkage });
  }
  if (
    isForeign &&
    real != null &&
    !matches(deduction => lowerOfTwo(pnl.pricePnL - deduction, pnl.localPnL - deduction), real)
  ) {
    mismatches.push({ field: 'REAL', ours: lowerOfTwo(pnl.pricePnL, pnl.localPnL), bank: real });
  }
  return mismatches;
}

export type CpiLotInput = {
  /** The lot's original price: its cost in local currency at its acquisition */
  originalLocal: number;
  /** The lot's share of the consideration, in local currency */
  considerationLocal: number;
  /** The known CPI on the disposal date over the known CPI on the acquisition date */
  indexRatio: number;
};

export type CpiLotGain = CpiLotInput & {
  /** The original price linked to the CPI (מחיר מקורי מתואם) */
  adjustedLocal: number;
  /** Consideration less original price: a capital gain, or a capital loss when negative */
  gain: number;
  /** The exempt part of the gain (סכום אינפלציוני) */
  inflationaryAmount: number;
  /** The gain less the inflationary amount (רווח הון ריאלי); a loss is not indexed */
  realGain: number;
};

/**
 * A company's capital gain under s.88 of the Income Tax Ordinance, lot by lot, with the CPI as the
 * index (the exchange rate is the index only for an individual's foreign-currency securities):
 * - the inflationary amount is the part of the gain equal to the rise of the adjusted original
 *   price over the original one — so it is never negative, never more than the gain, and nothing
 *   on a loss;
 * - the real gain is the gain less the inflationary amount;
 * - a capital loss is the original price less the consideration, unindexed.
 */
export function calculateCpiCapitalGain(lots: readonly CpiLotInput[]): {
  gain: number;
  inflationaryAmount: number;
  realGain: number;
  lots: CpiLotGain[];
} {
  const lotGains = lots.map(lot => {
    const adjustedLocal = lot.originalLocal * lot.indexRatio;
    const gain = lot.considerationLocal - lot.originalLocal;
    const inflationaryAmount =
      gain > 0 ? Math.min(Math.max(adjustedLocal - lot.originalLocal, 0), gain) : 0;
    return { ...lot, adjustedLocal, gain, inflationaryAmount, realGain: gain - inflationaryAmount };
  });
  return {
    gain: lotGains.reduce((sum, lot) => sum + lot.gain, 0),
    inflationaryAmount: lotGains.reduce((sum, lot) => sum + lot.inflationaryAmount, 0),
    realGain: lotGains.reduce((sum, lot) => sum + lot.realGain, 0),
    lots: lotGains,
  };
}

/**
 * What a disposal fetched before tax, in `currency`: its gross value when it is quoted in that
 * currency, or else the cash it brought in. Null when it reports neither in that currency.
 */
export function getDisposalProceeds(
  execution: Pick<
    SecurityExecutionRow,
    | 'trade_currency'
    | 'settlement_currency'
    | 'trade_gross_value_trade_currency'
    | 'net_value_trade_currency'
    | 'net_value_settlement_currency'
    | 'net_value_nis'
  >,
  currency: Currency,
): number | null {
  const gross = Math.abs(toNumber(execution.trade_gross_value_trade_currency));
  if (currencyOfSecurityLabel(execution.trade_currency) === currency && gross > 0) {
    return gross;
  }
  const net = executionAmountInCurrency(execution, currency);
  return net == null ? null : Math.abs(toNumber(net));
}

export function describeSecurity(
  execution: Pick<SecurityExecutionRow, 'symbol' | 'security' | 'isin'>,
) {
  const name = execution.symbol ?? execution.security;
  return execution.isin ? `${name} (${execution.isin})` : name;
}

/** Whether an execution disposes of units for cash: a sale or a redemption */
export function isDisposalExecution(execution: Pick<SecurityExecutionRow, 'trade_type'>): boolean {
  const tradeType = tryToSecurityTradeType(execution.trade_type);
  return tradeType === SecurityTradeType.Sell || tradeType === SecurityTradeType.Redemption;
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
