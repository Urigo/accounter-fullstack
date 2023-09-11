import DataLoader from 'dataloader';
import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY } from '@shared/constants';
import { Currency } from '@shared/gql-types';
import {
  IGetCryptoCurrenciesBySymbolQuery,
  IGetCryptoCurrenciesBySymbolResult,
  IGetRateByCurrencyAndDateQuery,
  IGetRateByCurrencyAndDateResult,
  IInsertRatesParams,
  IInsertRatesQuery,
} from '../__generated__/crypto-exchange.types.js';

const getRateByCurrencyAndDate = sql<IGetRateByCurrencyAndDateQuery>`
    SELECT *
    FROM accounter_schema.crypto_exchange_rates
    WHERE coin_symbol = $currency
    AND date = $date;`;

const insertRates = sql<IInsertRatesQuery>`
  INSERT INTO accounter_schema.crypto_exchange_rates (date, coin_symbol, value, against)
  VALUES $$rates(date, coin_symbol, value, against)
  ON CONFLICT (date, coin_symbol, against) DO UPDATE
  SET value = EXCLUDED.value
  RETURNING *;
`;

const getCryptoCurrenciesBySymbol = sql<IGetCryptoCurrenciesBySymbolQuery>`
    SELECT *
    FROM accounter_schema.crypto_currencies
    WHERE symbol in $$currencySymbols;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class CryptoExchangeProvider {
  apiKey: string;
  fiatCurrency = DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY;

  constructor(private dbProvider: DBProvider) {
    const apiKey = process.env.COINMARKETCAP_API_KEY;
    if (!apiKey) {
      throw new GraphQLError('No CoinMarketCap API key provided');
    }
    this.apiKey = apiKey;
  }

  public async getCryptoExchangeRatesFromDB(currency: string, date: Date) {
    return getRateByCurrencyAndDate.run({ currency, date }, this.dbProvider);
  }

  private async addRates(rates: IInsertRatesParams['rates']) {
    return insertRates.run({ rates }, this.dbProvider);
  }

  public addCryptoRateLoader = new DataLoader(
    (keys: readonly { date: Date; currency: string; against?: Currency; value: number }[]) =>
      this.addRates(
        keys.map(({ date, currency, against, value }) => ({
          date,
          coin_symbol: currency,
          against,
          value,
        })),
      ),
    {
      cache: false,
      cacheKeyFn: ({ date, currency, against }) =>
        `${format(date, 'dd-MM-yyyy')}-${currency}-${against ?? 'USD'}`,
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

  public getCryptoCurrenciesBySymbolLoader = new DataLoader(
    (symbols: readonly string[]) => this.getCryptoCurrenciesBySymbol(symbols),
    { cache: false },
  );

  public async getCryptoExchangeRatesFromAPI(currencySymbol: string, date: Date) {
    // Fetch CoinGecko id from DB
    const currencyInfo = await this.getCryptoCurrenciesBySymbolLoader.load(currencySymbol);
    if (!currencyInfo) {
      throw new GraphQLError(`No data found for crypto currency ${currencySymbol}`);
    }
    const coingeckoId = currencyInfo?.coingecko_id;
    if (!coingeckoId) {
      throw new GraphQLError(`No coingecko id found for crypto currency ${currencySymbol}`);
    }

    // Fetch rate from CoinGecko
    const url = new URL(`https://api.coingecko.com/api/v3/coins/${coingeckoId}/history`);
    url.searchParams.append('date', format(date, 'dd-MM-yyyy'));

    const res = await fetch(url);
    const rateData = await res.json();
    const rate: number = rateData?.market_data?.current_price?.[this.fiatCurrency.toLowerCase()];
    if (rate == null) {
      throw new GraphQLError(`Error retrieving rate of ${currencySymbol} from CoinGecko`);
    }

    // Add rate to DB
    await this.addCryptoRateLoader.load({
      date,
      currency: currencySymbol,
      value: rate,
      against: this.fiatCurrency,
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
        keys.map(
          async ({ cryptoCurrency, date, against = DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY }) => {
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
          },
        ),
      );
      return rates;
    },
    {
      cacheKeyFn: ({ cryptoCurrency, date, against = DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY }) =>
        `${cryptoCurrency}-${format(date, 'dd-MM-yyyy')}-${against}`,
      cache: false,
    },
  );
}
