import { Injectable, Scope } from 'graphql-modules';
import { Currency } from '../../../shared/enums.js';
import {
  dateToTimelessDateString,
  timelessDateStringToLocalDate,
} from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { getRateForCurrency, isCryptoCurrency } from '../helpers/exchange.helper.js';
import { CryptoExchangeProvider } from './crypto-exchange.provider.js';
import { FiatExchangeProvider } from './fiat-exchange.provider.js';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ExchangeProvider {
  constructor(
    private cryptoExchangeProvider: CryptoExchangeProvider,
    private fiatExchangeProvider: FiatExchangeProvider,
    private adminContextProvider: AdminContextProvider,
  ) {}

  /**
   * The rate to convert `baseCurrency` into `quoteCurrency` on `date`.
   *
   * @param date a calendar day, or a point in time (e.g. a crypto transaction's timestamp). Fiat
   * rates are daily, so an instant is mapped to the day it falls on for the server; crypto rates
   * are sampled by time, so a calendar day is taken as its local midnight, as before.
   */
  public async getExchangeRates(
    baseCurrency: Currency,
    quoteCurrency: Currency,
    date: TimelessDateString | Date,
  ) {
    let rate = 1;

    // if base and quote are the same currency, return rate
    if (baseCurrency === quoteCurrency) {
      return rate;
    }
    const { defaultLocalCurrency, defaultCryptoConversionFiatCurrency } =
      await this.adminContextProvider.getVerifiedAdminContext();

    const day = typeof date === 'string' ? date : dateToTimelessDateString(date);
    const instant = typeof date === 'string' ? timelessDateStringToLocalDate(date) : date;

    // adjust rate and convert to FIAT if base or quote are crypto
    const ifBaseIsCryptoAdjuster = async () => {
      if (isCryptoCurrency(baseCurrency)) {
        const { value } = await this.cryptoExchangeProvider.getCryptoExchangeRateLoader.load({
          cryptoCurrency: baseCurrency,
          date: instant,
        });
        rate = rate * Number(value);
        baseCurrency = defaultCryptoConversionFiatCurrency;
      }
    };
    const ifQuoteIsCryptoAdjuster = async () => {
      if (isCryptoCurrency(quoteCurrency)) {
        const { value } = await this.cryptoExchangeProvider.getCryptoExchangeRateLoader.load({
          cryptoCurrency: quoteCurrency,
          date: instant,
        });
        rate = rate / Number(value);
        quoteCurrency = defaultCryptoConversionFiatCurrency;
      }
    };
    const getFiatRatesPromise = this.fiatExchangeProvider.getExchangeRatesByDatesLoader.load(day);
    const [rates] = await Promise.all([
      getFiatRatesPromise,
      ifBaseIsCryptoAdjuster(),
      ifQuoteIsCryptoAdjuster(),
    ]);

    // adjust rate and convert to local default currency if base or quote are not local
    if (baseCurrency !== defaultLocalCurrency) {
      const baseRate = getRateForCurrency(baseCurrency, rates, defaultLocalCurrency);
      rate = rate * baseRate;
    }
    if (quoteCurrency !== defaultLocalCurrency) {
      const quoteRate = getRateForCurrency(quoteCurrency, rates, defaultLocalCurrency);
      rate = rate / quoteRate;
    }
    return rate;
  }
}
