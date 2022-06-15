import type { IGetExchangeRatesByDatesResult } from '../__generated__/exchange.types.mjs';
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
