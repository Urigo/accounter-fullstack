import { Currency } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';
import { LedgerError } from './utils.helper.js';

export function getConversionBankRate(base: LedgerProto, quote: LedgerProto) {
  const baseRate = base.currencyRate ?? 0;
  const quoteRate = quote.currencyRate ?? 0;
  if (!baseRate && !quoteRate) {
    throw new LedgerError('Conversion records are missing currency rate');
  }
  if (!!baseRate && !!quoteRate && baseRate !== quoteRate) {
    throw new LedgerError('Conversion records have mismatching currency rates');
  }
  let bankRate = baseRate || quoteRate;

  if (
    quote.currency === Currency.Ils ||
    quote.currency === Currency.Jpy ||
    base.currency === Currency.Gbp ||
    (base.currency === Currency.Usd && quote.currency === Currency.Usdc)
  ) {
    /**
     * NOTE:
     * Invert the bank rate if buying local currency (ILS) or JPY (for unknown reason)
     * Or selling GBP through HaPoalim
     *
     * Also invert when converting from USD to USDC through Kraken, need to check if same is true for other crypto purchases
     */
    bankRate = 1 / bankRate;
  }

  return bankRate;
}

export function conversionFeeCalculator(
  base: LedgerProto,
  quote: LedgerProto,
  officialRate: number,
  defaultLocalCurrency: Currency,
  localCurrencyRate?: number,
): { localAmount: number; foreignAmount?: number; currency: Currency } {
  if (base.currency === quote.currency) {
    throw new LedgerError('Conversion records must have different currencies');
  }
  const eventRate = getConversionBankRate(base, quote);

  const baseAmount =
    base.currency === defaultLocalCurrency
      ? base.localCurrencyCreditAmount1
      : (base.creditAmount1 as number);

  const quoteAmount =
    quote.currency === defaultLocalCurrency
      ? quote.localCurrencyCreditAmount1
      : (quote.creditAmount1 as number);

  // use the relatively absolute smaller amount to determine currency used for precision check
  const baseAmountConvertedByEventRate = eventRate >= 1 ? baseAmount / eventRate : baseAmount;
  const quoteAmountConvertedByEventRate = eventRate < 1 ? quoteAmount * eventRate : quoteAmount;
  const minimalPrecision = Math.max(
    (eventRate >= 1 ? baseAmount : quoteAmount) / 10_000_000,
    0.005,
  );
  if (
    Math.abs(baseAmountConvertedByEventRate - quoteAmountConvertedByEventRate) >
    Math.abs(minimalPrecision)
  ) {
    throw new LedgerError(
      `Based on bank conversion rate (${eventRate}) records have mismatching amounts`,
    );
  }
  const baseAmountConvertedByOfficialRate = baseAmount / officialRate;

  const feeAmountByQuoteCurrency = quoteAmount - baseAmountConvertedByOfficialRate;

  if (quote.currency === defaultLocalCurrency) {
    return { localAmount: feeAmountByQuoteCurrency, currency: defaultLocalCurrency };
  }
  if (!localCurrencyRate) {
    if (base.currency === defaultLocalCurrency) {
      localCurrencyRate = 1 / officialRate;
    } else {
      throw new LedgerError('Conversion records are missing local currency rate');
    }
  }
  const feeAmountByLocalCurrency = feeAmountByQuoteCurrency * localCurrencyRate;
  return {
    foreignAmount: feeAmountByQuoteCurrency,
    localAmount: feeAmountByLocalCurrency,
    currency: quote.currency,
  };
}
