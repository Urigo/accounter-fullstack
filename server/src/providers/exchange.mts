import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import { format } from 'date-fns';

import type { IGetChargesByIdsResult } from '../__generated__/charges.types.mjs';
import type {
  IGetExchangeRatesByDatesQuery,
  IGetExchangeRatesByDatesResult,
} from '../__generated__/exchange.types.mjs';
import { pool } from '../providers/db.mjs';

const { sql } = pgQuery;

const getExchangeRatesByDates = sql<IGetExchangeRatesByDatesQuery>`
  SELECT *
  FROM accounter_schema.exchange_rates
  WHERE exchange_date between COALESCE(
    (SELECT exchange_date
    FROM accounter_schema.exchange_rates
    WHERE exchange_date <= to_date($startDate, 'YYYY-MM-DD')
    ORDER BY exchange_date DESC LIMIT 1),
    (SELECT exchange_date
    FROM accounter_schema.exchange_rates
    ORDER BY exchange_date DESC LIMIT 1))
  AND to_date($endDate, 'YYYY-MM-DD')
  ORDER BY exchange_date DESC;`;

export async function batchExchageRates(dates: readonly Date[]) {
  const numericDates = dates.map(d => d.getTime());
  const endDate = format(new Date(Math.max(...numericDates)), 'yyyy-MM-dd');
  const startDate = format(new Date(Math.min(...numericDates)), 'yyyy-MM-dd');

  const rates = await getExchangeRatesByDates.run({ startDate, endDate }, pool);

  return dates.map(date => {
    if (rates.length === 0) {
      throw new Error(`No exchange rate found for date ${date}`);
    }

    const numericDate = date.getTime();
    let prevRate: IGetExchangeRatesByDatesResult | undefined = undefined;
    for (const rate of rates) {
      if (!rate.exchange_date) {
        // date is mandatory. this is just to get rid of the " | null" generated-type thing
        continue;
      }

      const numericRateDate = rate.exchange_date.getTime();
      if (numericRateDate < numericDate) {
        prevRate = rate;
        continue;
      }
      if (numericRateDate === numericDate) {
        return rate;
      }
      if (numericRateDate > numericDate && prevRate) {
        return prevRate;
      }
      throw new Error(`No exchange rate found for date ${date}`);
    }
  });
}

export const getExchangeRatesByDateLoader = new DataLoader(batchExchageRates);

export async function getChargeExchangeRates(charge: IGetChargesByIdsResult) {
  if (!charge.debit_date) {
    throw new Error(`Charge ID=${charge.id} has no debit date`);
  }
  if (!charge.tax_invoice_date) {
    throw new Error(`Charge ID=${charge.id} has no tax invoice date`);
  }
  const results = await Promise.all([
    getExchangeRatesByDateLoader.load(charge.debit_date),
    getExchangeRatesByDateLoader.load(charge.tax_invoice_date),
  ]);
  return {
    debitExchangeRates: results[0],
    invoiceExchangeRates: results[1],
  };
}
