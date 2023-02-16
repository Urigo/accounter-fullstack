import DataLoader from 'dataloader';
import { format } from 'date-fns';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import type { ChargesTypes } from '@modules/charges';
import pgQuery from '@pgtyped/query';
import type {
  IGetExchangeRatesByDateQuery,
  IGetExchangeRatesByDatesParams,
  IGetExchangeRatesByDatesQuery,
} from '../types.js';

const { sql } = pgQuery;

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
export class ExchangeProvider {
  constructor(private dbProvider: DBProvider) {}

  public async getExchangeRates(date: Date) {
    const formattedDate = format(date, 'yyyy-MM-dd');
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
    const fromDate = format(new Date(Math.min(...dates.map(d => d.getTime()))), 'yyyy-MM-dd');
    const toDate = format(new Date(Math.max(...dates.map(d => d.getTime()))), 'yyyy-MM-dd');
    const rates = await getExchangeRatesByDates.run(
      {
        fromDate,
        toDate,
      },
      this.dbProvider,
    );
    return dates.map(date => {
      const stringifiedDate = format(date, 'yyyy-MM-dd');
      return rates.find(rate => format(rate.exchange_date!, 'yyyy-MM-dd') <= stringifiedDate);
    });
  }

  public getExchangeRatesByDatesLoader = new DataLoader(
    (keys: readonly Date[]) => this.batchExchangeRatesByDates(keys),
    {
      cache: false,
    },
  );

  public async getChargeExchangeRates(charge: ChargesTypes.IGetChargesByIdsResult) {
    if (!charge.debit_date) {
      throw new Error(`Charge ID=${charge.id} has no debit date`);
    }
    if (!charge.tax_invoice_date) {
      throw new Error(`Charge ID=${charge.id} has no tax invoice date`);
    }
    const results = await Promise.all([
      this.getExchangeRatesByDatesLoader.load(charge.debit_date),
      this.getExchangeRatesByDatesLoader.load(charge.tax_invoice_date),
    ]);
    return {
      debitExchangeRates: results[0],
      invoiceExchangeRates: results[1],
    };
  }
}
