import pgQuery from '@pgtyped/query';
import { format } from 'date-fns';
import type { IGetChargesByIdsResult } from '../__generated__/charges.types.mjs';
import type { IGetExchangeRatesByDatesQuery } from '../__generated__/exchange.types.mjs';
import { pool } from '../providers/db.mjs';

const { sql } = pgQuery;

export async function getExchangeRates(date: Date) {
  const getExchangeRatesByDates = sql<IGetExchangeRatesByDatesQuery>`
    select *
    from accounter_schema.exchange_rates
    where exchange_date <= to_date($date, 'YYYY-MM-DD') 
    order by exchange_date desc limit 1;
  `;

  const formattedDate = format(date, 'yyyy-MM-dd');
  try {
    const result = await getExchangeRatesByDates.run({ date: formattedDate }, pool);
    return result[0];
  } catch (error) {
    console.log('error in DB - ', error);
  }
}

export async function getChargeExchangeRates(charge: IGetChargesByIdsResult) {
  if (!charge.debit_date) {
    throw new Error(`Charge ID=${charge.id} has no debit date`);
  }
  if (!charge.tax_invoice_date) {
    throw new Error(`Charge ID=${charge.id} has no tax invoice date`);
  }
  const results = await Promise.all([getExchangeRates(charge.debit_date), getExchangeRates(charge.tax_invoice_date)]);
  return {
    debitExchangeRates: results[0],
    invoiceExchangeRates: results[1],
  };
}
