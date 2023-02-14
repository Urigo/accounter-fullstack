import DataLoader from 'dataloader';
import { format } from 'date-fns';
import pgQuery from '@pgtyped/query';
import type { IGetChargesByIdsResult } from '../__generated__/charges.types.js';
import type {
  IGetExchangeRatesByDateQuery,
  IGetExchangeRatesByDatesQuery,
} from '../__generated__/exchange.types.js';
import { pool } from './db.js';

const { sql } = pgQuery;

export async function getExchangeRates(date: Date) {
  const getExchangeRatesByDate = sql<IGetExchangeRatesByDateQuery>`
    select *
    from accounter_schema.exchange_rates
    where exchange_date <= to_date($date, 'YYYY-MM-DD') 
    order by exchange_date desc limit 1;
  `;

  const formattedDate = format(date, 'yyyy-MM-dd');
  try {
    const result = await getExchangeRatesByDate.run({ date: formattedDate }, pool);
    return result[0];
  } catch (error) {
    throw new Error(`error in DB - ${error}`);
  }
}

export const getExchangeRatesByDates = sql<IGetExchangeRatesByDatesQuery>`
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

async function batchExchangeRatesByDates(dates: readonly Date[]) {
  const fromDate = format(new Date(Math.min(...dates.map(d => d.getTime()))), 'yyyy-MM-dd');
  const toDate = format(new Date(Math.max(...dates.map(d => d.getTime()))), 'yyyy-MM-dd');
  const rates = await getExchangeRatesByDates.run(
    {
      fromDate,
      toDate,
    },
    pool,
  );
  return dates.map(date => {
    const stringifiedDate = format(date, 'yyyy-MM-dd');
    return rates.find(rate => format(rate.exchange_date!, 'yyyy-MM-dd') <= stringifiedDate);
  });
}

export const getExchangeRatesByDatesLoader = new DataLoader(batchExchangeRatesByDates, {
  cache: false,
});

export async function getChargeExchangeRates(charge: IGetChargesByIdsResult) {
  if (!charge.debit_date) {
    throw new Error(`Charge ID=${charge.id} has no debit date`);
  }
  if (!charge.tax_invoice_date) {
    throw new Error(`Charge ID=${charge.id} has no tax invoice date`);
  }
  const results = await Promise.all([
    getExchangeRatesByDatesLoader.load(charge.debit_date),
    getExchangeRatesByDatesLoader.load(charge.tax_invoice_date),
  ]);
  return {
    debitExchangeRates: results[0],
    invoiceExchangeRates: results[1],
  };
}
