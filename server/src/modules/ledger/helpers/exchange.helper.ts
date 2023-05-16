import { format } from 'date-fns';
import type { currency } from '@modules/transactions/types.js';
// import type { VatExtendedCharge } from '@shared/types';
import type { IGetExchangeRatesByDatesResult } from '../types.js';

export function getRateForCurrency(
  currencyCode: currency,
  exchangeRates: IGetExchangeRatesByDatesResult,
) {
  if (currencyCode === 'ILS') {
    return 1;
  }
  if (currencyCode && ['USD', 'EUR', 'GBP'].includes(currencyCode)) {
    const currencyKey = currencyCode.toLowerCase() as 'usd' | 'eur' | 'gbp';
    const rate = parseFloat(exchangeRates[currencyKey] ?? '');
    if (Number.isNaN(rate)) {
      throw new Error(
        `Exchange rates for date ${exchangeRates.exchange_date}, currency ${currencyCode} not found`,
      );
    }
    return rate;
  }

  throw new Error(`New account currency ${currencyCode}`);
}

// export function getILSForDate(
//   charge: Pick<
//     VatExtendedCharge,
//     | 'currency_code'
//     | 'event_amount'
//     | 'vatAfterDeduction'
//     | 'amountBeforeVAT'
//     | 'amountBeforeFullVAT'
//     | 'id'
//   > & {
//     tax_invoice_amount: number | string | null;
//   },
//   exchangeRates?: IGetExchangeRatesByDatesResult,
//   amountToOverride?: number,
// ): {
//   eventAmountILS: number;
//   vatAfterDeductionILS: number;
//   amountBeforeVATILS: number;
//   amountBeforeFullVATILS: number;
// } {
//   const amountToUse =
//     amountToOverride ?? parseFloat(charge.tax_invoice_amount?.toString() ?? charge.event_amount);

//   if (!exchangeRates) {
//     throw new Error(`Exchange rates missing`);
//   }

//   const rate = getRateForCurrency(charge.currency_code, exchangeRates);
//   return {
//     eventAmountILS: amountToUse * rate,
//     vatAfterDeductionILS: charge.vatAfterDeduction * rate,
//     amountBeforeVATILS: charge.amountBeforeVAT * rate,
//     amountBeforeFullVATILS: charge.amountBeforeFullVAT * rate,
//   };
// }

export function getClosestRateForDate(
  date: string | Date,
  rates: Array<IGetExchangeRatesByDatesResult>,
) {
  const sortedRates = rates.sort((a, b) => {
    return (b.exchange_date?.getTime() ?? 0) - (a.exchange_date?.getTime() ?? 0);
  });

  const stringifiedDate = format(new Date(date), 'yyyy-MM-dd');

  const exchageRate = sortedRates.find(
    rate => format(rate.exchange_date!, 'yyyy-MM-dd') <= stringifiedDate,
  );

  if (!exchageRate) {
    throw new Error(`No exchange rate for date ${stringifiedDate}`);
  }
  return exchageRate;
}
