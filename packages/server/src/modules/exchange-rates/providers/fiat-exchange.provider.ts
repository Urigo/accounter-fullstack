import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import type { ChargesTypes } from '@modules/charges';
import { sql } from '@pgtyped/runtime';
import { dateToTimelessDateString } from '@shared/helpers';
import type {
  IGetExchangeRatesByDateQuery,
  IGetExchangeRatesByDatesParams,
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
  constructor(private dbProvider: DBProvider) {}

  public async getExchangeRates(date: Date) {
    const formattedDate = dateToTimelessDateString(date);
    try {
      const result = await getExchangeRatesByDate.run({ date: formattedDate }, this.dbProvider);
      return result[0];
    } catch (error) {
      throw new Error(`error in DB - ${error}`);
    }
  }

  public getExchangeRatesByDates(params: IGetExchangeRatesByDatesParams) {
    return getExchangeRatesByDates.run(params, this.dbProvider);
  }

  private async batchExchangeRatesByDates(dates: readonly Date[]) {
    const fromDate = dateToTimelessDateString(new Date(Math.min(...dates.map(d => d.getTime()))));
    const toDate = dateToTimelessDateString(new Date(Math.max(...dates.map(d => d.getTime()))));
    const rates = await getExchangeRatesByDates.run(
      {
        fromDate,
        toDate,
      },
      this.dbProvider,
    );
    return dates.map(date => {
      const stringifiedDate = dateToTimelessDateString(date);
      return rates
        .filter(rate => dateToTimelessDateString(rate.exchange_date!) <= stringifiedDate)
        .reduce((prev: IGetExchangeRatesByDatesResult, curr: IGetExchangeRatesByDatesResult) =>
          (prev.exchange_date?.getTime() ?? 0) > (curr.exchange_date?.getTime() ?? 0) ? prev : curr,
        );
    });
  }

  public getExchangeRatesByDatesLoader = new DataLoader(
    (keys: readonly Date[]) => this.batchExchangeRatesByDates(keys),
    {
      cache: false,
    },
  );

  public async getChargeExchangeRates(charge: ChargesTypes.IGetChargesByIdsResult) {
    if (!charge.transactions_min_debit_date) {
      throw new Error(`Charge ID=${charge.id} has no debit date`);
    }
    if (!charge.documents_min_date) {
      throw new Error(`Charge ID=${charge.id} has no tax invoice date`);
    }
    const results = await Promise.all([
      this.getExchangeRatesByDatesLoader.load(charge.transactions_min_debit_date),
      this.getExchangeRatesByDatesLoader.load(charge.documents_min_date),
    ]);
    return {
      debitExchangeRates: results[0],
      invoiceExchangeRates: results[1],
    };
  }
}
