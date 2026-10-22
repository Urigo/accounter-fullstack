import type { Injector } from 'graphql-modules';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { ExchangeProvider } from '../../exchange-rates/providers/exchange.provider.js';
import { periodToYearMonth } from '../../price-indexes/helpers/price-index.helper.js';
import { PriceIndexesProvider } from '../../price-indexes/providers/price-indexes.provider.js';
import { ForeignSecuritiesProvider } from '../providers/foreign-securities.provider.js';
import type { SecurityCapitalGainProto, SecurityExecutionRow } from '../types.js';
import { calculateFifoCostBasis } from './security-cost-basis.helper.js';
import {
  calculateCpiCapitalGain,
  calculateDisposalPnL,
  costBasisProblem,
  describeSecurity,
  getDisposalProceeds,
  isDisposalExecution,
} from './security-disposal.helper.js';
import {
  currencyOfSecurityLabel,
  isCancelledExecution,
} from './security-execution-enums.helper.js';

/** Why a disposal's capital gain cannot be worked out, in words for the user */
export class SecurityCapitalGainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityCapitalGainError';
  }
}

/**
 * The capital gain of a sale or a redemption, from the FIFO lots it disposes of across the owner's
 * accounts. Null for any other execution, and for a cancelled one.
 *
 * Everything is in the local currency at the Bank of Israel representative rate of the trade dates
 * — the sale's and each lot's purchase — as tax practice prices them, and split two ways:
 * - price vs. exchange rate, as the ledger books it;
 * - real vs. inflationary under s.88 of the Income Tax Ordinance, with the CPI known on the trade
 *   dates as the index: a company's split (an individual's foreign-currency securities take the
 *   exchange rate as the index instead, which is what the bank reports).
 *
 * Commissions are left out: the ledger books them as fees.
 */
export async function getSecurityCapitalGain(
  injector: Injector,
  execution: SecurityExecutionRow,
): Promise<SecurityCapitalGainProto | null> {
  if (!isDisposalExecution(execution) || isCancelledExecution(execution)) {
    return null;
  }
  const security = describeSecurity(execution);
  const currency =
    currencyOfSecurityLabel(execution.settlement_currency) ??
    currencyOfSecurityLabel(execution.trade_currency);
  if (!currency) {
    throw new SecurityCapitalGainError(
      `The execution of ${security} on ${execution.trade_date} reports no currency`,
    );
  }

  const [{ defaultLocalCurrency }, history] = await Promise.all([
    injector.get(AdminContextProvider).getVerifiedAdminContext(),
    injector.get(ForeignSecuritiesProvider).getSecurityOwnerHistory(execution, execution.owner_id),
  ]);
  const costBasis = calculateFifoCostBasis(history, execution, currency);
  const problem = costBasisProblem(execution, costBasis);
  if (problem) {
    throw new SecurityCapitalGainError(problem);
  }
  const proceeds = getDisposalProceeds(execution, currency);
  if (proceeds == null) {
    throw new SecurityCapitalGainError(
      `The execution of ${security} on ${execution.trade_date} reports no proceeds in ${currency}`,
    );
  }

  const rateOn = async (date: TimelessDateString) =>
    currency === defaultLocalCurrency
      ? 1
      : injector.get(ExchangeProvider).getExchangeRates(currency, defaultLocalCurrency, date);
  const [saleRate, ...purchaseRates] = await Promise.all([
    rateOn(execution.trade_date),
    ...costBasis.lots.map(lot => rateOn(lot.tradeDate)),
  ]);

  const pnl = calculateDisposalPnL({
    proceedsForeign: proceeds,
    saleRate: saleRate!,
    lots: costBasis.lots.map((lot, index) => ({ ...lot, rate: purchaseRates[index]! })),
  });

  const priceIndexes = injector.get(PriceIndexesProvider);
  const linkages = await Promise.all(
    pnl.lots.map((lot, index) =>
      priceIndexes.linkAmount(
        lot.costLocal,
        { date: costBasis.lots[index]!.tradeDate },
        { date: execution.trade_date },
      ),
    ),
  );
  const cpi = calculateCpiCapitalGain(
    pnl.lots.map((lot, index) => ({
      originalLocal: lot.costLocal,
      considerationLocal: lot.proceedsForeign * saleRate!,
      indexRatio: linkages[index]!.ratio,
    })),
  );

  return {
    id: execution.id,
    currency,
    localCurrency: defaultLocalCurrency,
    quantity: costBasis.redeemedUnits,
    proceeds,
    saleRate: saleRate!,
    cost: pnl.costForeign,
    originCurrencyGain: pnl.originCurrencyPnL,
    nominalGain: pnl.localPnL,
    priceGain: pnl.pricePnL,
    exchangeRateGain: pnl.ratePnL,
    inflationaryAmount: cpi.inflationaryAmount,
    realGain: cpi.realGain,
    lots: costBasis.lots.map((lot, index) => ({
      id: `${execution.id}:${lot.executionId}:${index}`,
      purchaseExecutionId: lot.executionId,
      purchaseDate: lot.tradeDate,
      quantity: lot.units,
      currency,
      localCurrency: defaultLocalCurrency,
      cost: lot.costForeign,
      costLocal: pnl.lots[index]!.costLocal,
      purchaseRate: purchaseRates[index]!,
      consideration: cpi.lots[index]!.considerationLocal,
      purchaseIndexPeriod: periodToYearMonth(linkages[index]!.fromIndex.period),
      saleIndexPeriod: periodToYearMonth(linkages[index]!.toIndex.period),
      indexRatio: linkages[index]!.ratio,
      nominalGain: cpi.lots[index]!.gain,
      inflationaryAmount: cpi.lots[index]!.inflationaryAmount,
      realGain: cpi.lots[index]!.realGain,
    })),
  };
}
