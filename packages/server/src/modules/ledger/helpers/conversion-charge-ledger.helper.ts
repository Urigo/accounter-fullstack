import { Currency } from '@shared/gql-types';
import type { LedgerProto } from '@shared/types';
import { LedgerError } from './utils.helper.js';

export function conversionFeeCalculator(
  base: LedgerProto,
  quote: LedgerProto,
  officialRate: number,
  defaultLocalCurrency: Currency,
): number {
  if (base.currency === quote.currency) {
    throw new LedgerError('Conversion records must have different currencies');
  }

  if (quote.currency === defaultLocalCurrency) {
    const baseAmount =
      base.currency === defaultLocalCurrency
        ? base.localCurrencyCreditAmount1
        : (base.creditAmount1 as number);

    const feeAmountByQuoteCurrency = quote.localCurrencyCreditAmount1 - baseAmount / officialRate;

    return feeAmountByQuoteCurrency;
  }
  return quote.localCurrencyCreditAmount1 - base.localCurrencyCreditAmount1;
}
