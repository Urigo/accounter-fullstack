import { Injectable, Scope } from 'graphql-modules';
import { DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY, DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import { Currency } from '@shared/gql-types';
import { getRateForCurrency, isCryptoCurrency } from '../helpers/exchange.helper.js';
import { CryptoExchangeProvider } from './crypto-exchange.provider.js';
import { FiatExchangeProvider } from './fiat-exchange.provider.js';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class ExchangeProvider {
  constructor(
    private cryptoExchangeProvider: CryptoExchangeProvider,
    private fiatExchangeProvider: FiatExchangeProvider,
  ) {
    return;
  }

  public async getExchangeRates(baseCurrency: Currency, quoteCurrency: Currency, date: Date) {
    let rate = 1;

    // adjust rate and convert to FIAT if base or quote are crypto
    const ifBaseIsCryptoAdjuster = async () => {
      if (isCryptoCurrency(baseCurrency)) {
        const { value } = await this.cryptoExchangeProvider.getCryptoExchangeRateLoader.load({
          cryptoCurrency: baseCurrency,
          date,
        });
        rate = rate * Number(value);
        baseCurrency = DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY as Currency;
      }
    };
    const ifQuoteIsCryptoAdjuster = async () => {
      if (isCryptoCurrency(quoteCurrency)) {
        const { value } = await this.cryptoExchangeProvider.getCryptoExchangeRateLoader.load({
          cryptoCurrency: quoteCurrency,
          date,
        });
        rate = rate / Number(value);
        quoteCurrency = DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY as Currency;
      }
    };
    await Promise.all([ifBaseIsCryptoAdjuster(), ifQuoteIsCryptoAdjuster()]);

    // if base and quote are the same currency, return rate
    if (baseCurrency === quoteCurrency) {
      return rate;
    }

    // adjust rate and convert to local default currency if base or quote are not local
    const rates = await this.fiatExchangeProvider.getExchangeRatesByDatesLoader.load(date);
    if (baseCurrency !== DEFAULT_LOCAL_CURRENCY) {
      const baseRate = getRateForCurrency(baseCurrency, rates);
      rate = rate * baseRate;
    }
    if (quoteCurrency !== DEFAULT_LOCAL_CURRENCY) {
      const quoteRate = getRateForCurrency(quoteCurrency, rates);
      rate = rate / quoteRate;
    }
    return rate;
  }
}
