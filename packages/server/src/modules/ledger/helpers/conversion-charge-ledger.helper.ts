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
  const bankRate = baseRate || quoteRate;

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
  const baseAmountConvertedByEventRate = baseAmount / eventRate;
  const minimalPrecision = Math.max(baseAmount / 10_000_000, 0.005);
  if (baseAmountConvertedByEventRate - quoteAmount > minimalPrecision) {
    throw new LedgerError(
      'Conversion records have mismatching amounts, taking the bank rate into account',
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
