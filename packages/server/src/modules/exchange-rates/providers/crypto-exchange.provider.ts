import DataLoader from 'dataloader';
import { format, subHours } from 'date-fns';
import { GraphQLError } from 'graphql';
import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import { CoinMarketCapProvider } from '@modules/app-providers/coinmarketcap.js';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { Currency } from '@shared/gql-types';
import { getCacheInstance } from '@shared/helpers';
import {
  IGetCryptoCurrenciesBySymbolQuery,
  IGetCryptoCurrenciesBySymbolResult,
  IGetRateByCurrencyAndDateQuery,
  IGetRateByCurrencyAndDateResult,
  IInsertRatesParams,
  IInsertRatesQuery,
} from '../types.js';

const getRateByCurrencyAndDate = sql<IGetRateByCurrencyAndDateQuery>`
    SELECT *
    FROM accounter_schema.crypto_exchange_rates
    WHERE coin_symbol = $currency
    AND date = $date;`;

const insertRates = sql<IInsertRatesQuery>`
  INSERT INTO accounter_schema.crypto_exchange_rates (date, coin_symbol, value, against, sample_date)
  VALUES $$rates(date, currency, value, against, sampleDate)
  ON CONFLICT (date, coin_symbol, against) DO UPDATE
  SET value = EXCLUDED.value
  RETURNING *;
`;

const getCryptoCurrenciesBySymbol = sql<IGetCryptoCurrenciesBySymbolQuery>`
    SELECT *
    FROM accounter_schema.crypto_currencies
    WHERE symbol in $$currencySymbols;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class CryptoExchangeProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 60 * 24, // 24 hours
  });
  fiatCurrency: Currency;

  constructor(
    @Inject(CONTEXT) private context: GraphQLModules.Context,
    private dbProvider: DBProvider,
    private coinMarketCap: CoinMarketCapProvider,
  ) {
    this.fiatCurrency = this.context.adminContext.defaultCryptoConversionFiatCurrency;
  }

  private async getCryptoExchangeRatesFromDB(currency: string, date: Date) {
    return getRateByCurrencyAndDate.run({ currency, date }, this.dbProvider);
  }

  private async addRates(rates: IInsertRatesParams['rates']) {
    this.clearCache();
    return insertRates.run({ rates }, this.dbProvider);
  }

  private addCryptoRateLoader = new DataLoader(
    (
      keys: readonly {
        date: Date;
        currency: string;
        against?: Currency;
        value: number;
        sampleDate: Date;
      }[],
    ) => this.addRates(keys.map(rate => ({ ...rate, against: rate.against ?? null }))),
    {
      cache: false,
    },
  );

  private async getCryptoCurrenciesBySymbol(
    symbols: readonly string[],
  ): Promise<Array<IGetCryptoCurrenciesBySymbolResult | undefined>> {
    const currencies = await getCryptoCurrenciesBySymbol.run(
      {
        currencySymbols: symbols,
      },
      this.dbProvider,
    );
    return symbols.map(symbol => currencies.find(currency => currency.symbol === symbol));
  }

  private getCryptoCurrenciesBySymbolLoader = new DataLoader(
    (symbols: readonly string[]) => this.getCryptoCurrenciesBySymbol(symbols),
    {
      cacheKeyFn: key => `crypto-currencies-by-symbol-${key}`,
      cacheMap: this.cache,
    },
  );

  private async getCryptoExchangeRatesFromAPI(currencySymbol: string, date: Date) {
    // Fetch CoinMarketCap id from DB
    const currencyInfo = await this.getCryptoCurrenciesBySymbolLoader.load(currencySymbol);
    if (!currencyInfo) {
      throw new GraphQLError(`No data found for crypto currency ${currencySymbol}`);
    }
    const coinmarketcapId = currencyInfo?.coinmarketcap_id;
    if (!coinmarketcapId) {
      throw new GraphQLError(`No CoinMarketCap id found for crypto currency ${currencySymbol}`);
    }

    const fromDate = subHours(date, 23);
    const from = Math.floor(fromDate.getTime() / 1000);
    const to = Math.floor(date.getTime() / 1000);

    const ratesObject = await this.coinMarketCap.getExchangeRates(coinmarketcapId, {
      fromTimeStamp: from,
      toTimeStamp: to,
    });

    let timestamp: number | undefined = undefined;
    let rate: number | undefined = undefined;

    for (const [rawTimestamp, rateData] of Object.entries<{ c?: Array<number> } | undefined>(
      ratesObject,
    )) {
      const newTimestamp = Number(rawTimestamp);
      if (newTimestamp <= to && rateData?.c?.[0]) {
        if (!timestamp || !rate) {
          timestamp = newTimestamp;
          rate = rateData.c[0];
        }
        if (newTimestamp > timestamp) {
          timestamp = newTimestamp;
          rate = rateData.c[0];
        }
      }
    }

    if (!rate || !timestamp) {
      throw new GraphQLError(`No suitable rate of ${currencySymbol} found in CoinMarketCap`);
    }

    const sampleDate = new Date(timestamp * 1000);

    // Add rate to DB
    await this.addCryptoRateLoader.load({
      date,
      currency: currencySymbol,
      value: rate,
      against: this.fiatCurrency,
      sampleDate,
    });

    return rate;
  }

  public getCryptoExchangeRateLoader = new DataLoader<
    { cryptoCurrency: string; date: Date; against?: Currency },
    IGetRateByCurrencyAndDateResult,
    string
  >(
    async keys => {
      const rates = await Promise.all(
        keys.map(async ({ cryptoCurrency, date, against = this.fiatCurrency }) => {
          // Fetch from DB first
          const res = await this.getCryptoExchangeRatesFromDB(cryptoCurrency, date);
          if (res.length > 0) {
            return res[0];
          }
          // If not found in DB, fetch from API
          const rate = await this.getCryptoExchangeRatesFromAPI(cryptoCurrency, date);
          if (rate == null) {
            return new GraphQLError(
              `No data found for ${cryptoCurrency} on ${format(date, 'dd-MM-yyyy')}`,
            );
          }
          return {
            date,
            coin_symbol: cryptoCurrency,
            value: rate.toString(),
            against,
          } as IGetRateByCurrencyAndDateResult;
        }),
      );
      return rates;
    },
    {
      cacheKeyFn: ({ cryptoCurrency, date, against = this.fiatCurrency }) =>
        `${cryptoCurrency}-${date.getTime()}-${against}`,
      cacheMap: this.cache,
    },
  );

  public clearCache() {
    this.cache.clear();
  }
}
