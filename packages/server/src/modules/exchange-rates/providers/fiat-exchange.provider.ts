import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import {
  getCacheInstance,
  maxTimelessDate,
  minTimelessDate,
} from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import type {
  IGetExchangeRatesByDateQuery,
  IGetExchangeRatesByDateResult,
  IGetExchangeRatesByDatesQuery,
  IGetExchangeRatesByDatesResult,
} from '../types.js';

const getExchangeRatesByDate = sql<IGetExchangeRatesByDateQuery>`
    select *
    from accounter_schema.exchange_rates
    where exchange_date <= to_date($date, 'YYYY-MM-DD') 
    order by exchange_date desc limit 1;
  `;

const getExchangeRatesByDates = sql<IGetExchangeRatesByDatesQuery>`
    SELECT *
    FROM accounter_schema.exchange_rates
    WHERE
      exchange_date BETWEEN (
        SELECT exchange_date FROM accounter_schema.exchange_rates
        WHERE exchange_date <= to_date($fromDate, 'YYYY-MM-DD')
        ORDER BY exchange_date DESC LIMIT 1
      )
      AND to_date($toDate, 'YYYY-MM-DD') 
    ORDER BY exchange_date DESC;
  `;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class FiatExchangeProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 60 * 24, // 24 hours
  });

  constructor(private dbProvider: DBProvider) {}

  public async getExchangeRates(formattedDate: TimelessDateString) {
    try {
      const cached = this.cache.get<IGetExchangeRatesByDateResult[]>(formattedDate);
      if (cached) {
        return Promise.resolve(cached);
      }
      const [result] = await getExchangeRatesByDate.run({ date: formattedDate }, this.dbProvider);
      this.cache.set(formattedDate, result);
      return result;
    } catch (error) {
      const message = `Error fetching exchange rates for date ${formattedDate}`;
      console.error(`${message}: ${error}`);
      throw new Error(message, { cause: error });
    }
  }

  private async batchExchangeRatesByDates(dates: readonly TimelessDateString[]) {
    const fromDate = minTimelessDate(...dates)!;
    const toDate = maxTimelessDate(...dates)!;
    const rates = await getExchangeRatesByDates.run(
      {
        fromDate,
        toDate,
      },
      this.dbProvider,
    );
    return dates.map(date =>
      rates
        .filter(rate => rate.exchange_date! <= date)
        .reduce((prev: IGetExchangeRatesByDatesResult, curr: IGetExchangeRatesByDatesResult) =>
          (prev.exchange_date ?? '') > (curr.exchange_date ?? '') ? prev : curr,
        ),
    );
  }

  public getExchangeRatesByDatesLoader = new DataLoader(
    (keys: readonly TimelessDateString[]) => this.batchExchangeRatesByDates(keys),
    {
      cacheMap: this.cache,
    },
  );

  public clearCache() {
    this.cache.clear();
  }
}
