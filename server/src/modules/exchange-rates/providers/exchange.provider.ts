import { Injectable, Scope } from 'graphql-modules';
import { DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY } from '@shared/constants';
import { Currency } from '@shared/gql-types';
import { getRateForCurrency, isCryptoCurrency } from '../helpers/exchange.helper';
import { CryptoExchangeProvider } from './crypto-exchange.provider';
import { FiatExchangeProvider } from './fiat-exchange.provider';

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
    if (isCryptoCurrency(baseCurrency)) {
      const { value } = await this.cryptoExchangeProvider.getCryptoExchangeRateLoader.load({
        cryptoCurrency: baseCurrency,
        date,
      });
      rate = rate / Number(value);
      baseCurrency = DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY as Currency;
    }
    if (isCryptoCurrency(quoteCurrency)) {
      const { value } = await this.cryptoExchangeProvider.getCryptoExchangeRateLoader.load({
        cryptoCurrency: quoteCurrency,
        date,
      });
      rate = rate * Number(value);
      quoteCurrency = DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY as Currency;
    }
    if (baseCurrency === quoteCurrency) {
      return rate;
    }
    const rates = await this.fiatExchangeProvider.getExchangeRatesByDatesLoader.load(date);
    if (baseCurrency !== Currency.Ils) {
      const baseRate = getRateForCurrency(baseCurrency, rates);
      rate = rate / baseRate;
    }
    if (quoteCurrency !== Currency.Ils) {
      const quoteRate = getRateForCurrency(quoteCurrency, rates);
      rate = rate * quoteRate;
    }
    return rate;
  }
}
