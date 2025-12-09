import { Currency } from '../../../shared/enums.js';
import type { LedgerProto } from '../../../shared/types/index.js';
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
    const baseAmount = (base.creditAmount1 ?? 0) / officialRate;

    const feeAmountByQuoteCurrency = quote.localCurrencyCreditAmount1 - baseAmount;

    return feeAmountByQuoteCurrency;
  }
  return quote.localCurrencyCreditAmount1 - base.localCurrencyCreditAmount1;
}
