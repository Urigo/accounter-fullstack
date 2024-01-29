import { GraphQLError } from 'graphql';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import { Currency } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';

export function getConversionBankRate(base: LedgerProto, quote: LedgerProto) {
  const baseRate = base.currencyRate ?? 0;
  const quoteRate = quote.currencyRate ?? 0;
  if (!baseRate && !quoteRate) {
    throw new GraphQLError('Conversion records are missing currency rate');
  }
  if (!!baseRate && !!quoteRate && baseRate !== quoteRate) {
    throw new GraphQLError('Conversion records have mismatching currency rates');
  }
  const bankRate = baseRate || quoteRate;

  return bankRate;
}

export function conversionFeeCalculator(
  base: LedgerProto,
  quote: LedgerProto,
  officialRate: number,
  localCurrencyRate?: number,
): { localAmount: number; foreignAmount?: number; currency: Currency } {
  if (base.currency === quote.currency) {
    throw new GraphQLError('Conversion records must have different currencies');
  }
  const eventRate = getConversionBankRate(base, quote);

  const baseAmount =
    base.currency === DEFAULT_LOCAL_CURRENCY
      ? base.localCurrencyCreditAmount1
      : (base.creditAmount1 as number);

  const quoteAmount =
    quote.currency === DEFAULT_LOCAL_CURRENCY
      ? quote.localCurrencyCreditAmount1
      : (quote.creditAmount1 as number);
  const baseAmountConvertedByEventRate = baseAmount / eventRate;
  const minimalPrecision = Math.max(baseAmount / 10_000_000, 0.005);
  if (baseAmountConvertedByEventRate - quoteAmount > minimalPrecision) {
    throw new GraphQLError(
      'Conversion records have mismatching amounts, taking the bank rate into account',
    );
  }
  const baseAmountConvertedByOfficialRate = baseAmount / officialRate;

  const feeAmountByQuoteCurrency = quoteAmount - baseAmountConvertedByOfficialRate;

  if (quote.currency === DEFAULT_LOCAL_CURRENCY) {
    return { localAmount: feeAmountByQuoteCurrency, currency: DEFAULT_LOCAL_CURRENCY };
  }
  if (!localCurrencyRate) {
    if (base.currency === DEFAULT_LOCAL_CURRENCY) {
      localCurrencyRate = 1 / officialRate;
    } else {
      throw new GraphQLError('Conversion records are missing local currency rate');
    }
  }
  const feeAmountByLocalCurrency = feeAmountByQuoteCurrency * localCurrencyRate;
  return {
    foreignAmount: feeAmountByQuoteCurrency,
    localAmount: feeAmountByLocalCurrency,
    currency: quote.currency,
  };
}
