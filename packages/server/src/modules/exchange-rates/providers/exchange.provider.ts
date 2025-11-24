import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import { Currency } from '@shared/enums';
import { getRateForCurrency, isCryptoCurrency } from '../helpers/exchange.helper.js';
import { CryptoExchangeProvider } from './crypto-exchange.provider.js';
import { FiatExchangeProvider } from './fiat-exchange.provider.js';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ExchangeProvider {
  localCurrency: Currency;
  cryptoConversionFiatCurrency: Currency;
  constructor(
    @Inject(CONTEXT) private context: GraphQLModules.Context,
    private cryptoExchangeProvider: CryptoExchangeProvider,
    private fiatExchangeProvider: FiatExchangeProvider,
  ) {
    this.localCurrency = this.context.adminContext.defaultLocalCurrency;
    this.cryptoConversionFiatCurrency =
      this.context.adminContext.defaultCryptoConversionFiatCurrency;
  }

  public async getExchangeRates(baseCurrency: Currency, quoteCurrency: Currency, date: Date) {
    let rate = 1;

    // if base and quote are the same currency, return rate
    if (baseCurrency === quoteCurrency) {
      return rate;
    }

    // adjust rate and convert to FIAT if base or quote are crypto
    const ifBaseIsCryptoAdjuster = async () => {
      if (isCryptoCurrency(baseCurrency)) {
        const { value } = await this.cryptoExchangeProvider.getCryptoExchangeRateLoader.load({
          cryptoCurrency: baseCurrency,
          date,
        });
        rate = rate * Number(value);
        baseCurrency = this.cryptoConversionFiatCurrency;
      }
    };
    const ifQuoteIsCryptoAdjuster = async () => {
      if (isCryptoCurrency(quoteCurrency)) {
        const { value } = await this.cryptoExchangeProvider.getCryptoExchangeRateLoader.load({
          cryptoCurrency: quoteCurrency,
          date,
        });
        rate = rate / Number(value);
        quoteCurrency = this.cryptoConversionFiatCurrency;
      }
    };
    const getFiatRatesPromise = this.fiatExchangeProvider.getExchangeRatesByDatesLoader.load(date);
    const [rates] = await Promise.all([
      getFiatRatesPromise,
      ifBaseIsCryptoAdjuster(),
      ifQuoteIsCryptoAdjuster(),
    ]);

    // adjust rate and convert to local default currency if base or quote are not local
    if (baseCurrency !== this.localCurrency) {
      const baseRate = getRateForCurrency(baseCurrency, rates, this.localCurrency);
      rate = rate * baseRate;
    }
    if (quoteCurrency !== this.localCurrency) {
      const quoteRate = getRateForCurrency(quoteCurrency, rates, this.localCurrency);
      rate = rate / quoteRate;
    }
    return rate;
  }
}
