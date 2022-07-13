import { IGetChargesByIdsResult } from '../__generated__/charges.types.mjs';
import type { IGetExchangeRatesByDatesResult } from '../__generated__/exchange.types.mjs';
import { Currency } from '../__generated__/types.mjs';
import type { VatExtendedCharge } from './misc.mjs';

export function getILSForDate(
  charge: VatExtendedCharge,
  exchageRates?: IGetExchangeRatesByDatesResult
): {
  eventAmountILS: number;
  vatAfterDiductionILS: number;
  amountBeforeVATILS: number;
  amountBeforeFullVATILS: number;
} {
  const amountToUse = parseFloat(charge.tax_invoice_amount ? charge.tax_invoice_amount : charge.event_amount);
  if (charge.currency_code && ['USD', 'EUR', 'GBP'].includes(charge.currency_code)) {
    const currencyKey = charge.currency_code?.toLowerCase() as 'usd' | 'eur' | 'gbp';
    const rate = parseFloat(exchageRates?.[currencyKey] ?? '');
    if (isNaN(rate)) {
      throw new Error(
        `Exchange rates for date ${exchageRates?.exchange_date}, currency ${charge.currency_code} not found`
      );
    }
    return {
      eventAmountILS: amountToUse * rate,
      vatAfterDiductionILS: charge.vatAfterDiduction * rate,
      amountBeforeVATILS: charge.amountBeforeVAT * rate,
      amountBeforeFullVATILS: charge.amountBeforeFullVAT * rate,
    };
  }
  if (charge.currency_code == 'ILS') {
    return {
      eventAmountILS: amountToUse,
      vatAfterDiductionILS: charge.vatAfterDiduction,
      amountBeforeVATILS: charge.amountBeforeVAT,
      amountBeforeFullVATILS: charge.amountBeforeFullVAT,
    };
  }

  // TODO(Uri): Log important checks
  throw new Error(`New account currency ${charge.currency_code} on charge ID=${charge.id} `);
}


export function getExchageRatesForDate(
  charge: IGetChargesByIdsResult,
  exchageRates?: IGetExchangeRatesByDatesResult,
  currencyType?: Currency,
): {
  eventAmount: number;
} {
  const amountToUse = parseFloat(charge?.tax_invoice_amount ?? charge?.event_amount);
  if (charge?.currency_code && currencyType) {
    /* get exchange rate from origin currency to ILS */
    const originCurrencyKey = charge?.currency_code?.toLowerCase() as 'usd' | 'ils' | 'eur' | 'gbp';
    const rateFromOrigin = originCurrencyKey === 'ils' ? 1 : parseFloat(exchageRates?.[originCurrencyKey] ?? '');
    if (isNaN(rateFromOrigin)) {
      throw new Error(
        `Exchange rates for date ${exchageRates?.exchange_date}, currency ${charge?.currency_code} not found`
      );
    }
    
    /* get exchange rate from ILS to requested currency */
    const destinationCurrencyKey = currencyType.toLowerCase() as 'usd' | 'ils' | 'eur' | 'gbp';
    const rateOfResult = destinationCurrencyKey === 'ils' ? 1 : parseFloat(exchageRates?.[destinationCurrencyKey] ?? '');
    if (isNaN(rateOfResult)) {
      throw new Error(
        `Exchange rates for date ${exchageRates?.exchange_date}, currency ${charge.currency_code} not found`
      );
    }
    const result =  amountToUse * rateFromOrigin;
    const test =  rateOfResult / result ;

    
    return {
      eventAmount: result,
    }
  }

  // TODO(Uri): Log important checks
  throw new Error(`New account currency ${charge.currency_code} on charge ID=${charge.id} `);
}
