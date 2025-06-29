import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
// import { getCacheInstance } from '@shared/helpers';
import {
  IGetNormalizedBalanceTransactionsParams,
  IGetNormalizedBalanceTransactionsQuery,
} from '../types.js';

const getNormalizedBalanceTransactions = sql<IGetNormalizedBalanceTransactionsQuery>`
with transactions AS (SELECT
    t.id,
    t.charge_id,
    t.source_description,
    t.currency,
    COALESCE(t.debit_date_override, t.debit_date) as debit_date,
    t.debit_timestamp,
    t.amount,
    c.owner_id,
    t.business_id,
    t.is_fee,
    date_part('month', COALESCE(t.debit_date_override, t.debit_date)) as month,
    date_part('year', COALESCE(t.debit_date_override, t.debit_date)) as year,
    CASE
        WHEN t.currency = 'USD' THEN t.amount
        WHEN t.currency = 'ILS' THEN t.amount / lr.usd -- Convert ILS => USD
        WHEN t.currency = 'EUR' THEN t.amount * (lr.eur / lr.usd) -- Convert EUR => ILS => USD
        WHEN t.currency = 'GBP' THEN t.amount * (lr.gbp / lr.usd) -- Convert GBP => ILS => USD
        WHEN t.currency = 'CAD' THEN t.amount * (lr.cad / lr.usd) -- Convert CAD => ILS => USD
        WHEN t.currency = 'JPY' THEN t.amount * (lr.jpy / lr.usd) -- Convert JPY => ILS => USD
        WHEN t.currency = 'USDC' OR t.currency = 'GRT' OR t.currency = 'ETH' THEN t.amount * lr2.value -- Convert Crypto => USD
        ELSE NULL
    END AS amount_usd
FROM accounter_schema.transactions t
LEFT JOIN accounter_schema.charges c ON t.charge_id = c.id
LEFT JOIN LATERAL (
    SELECT er.usd, er.eur, er.gbp, er.cad, er.jpy
    FROM accounter_schema.exchange_rates er
    WHERE er.exchange_date <= t.debit_date
    ORDER BY er.exchange_date DESC
    LIMIT 1
) lr ON t.currency = 'ILS' OR t.currency = 'EUR' OR t.currency ='GBP' OR t.currency = 'CAD' OR t.currency = 'JPY'
LEFT JOIN LATERAL (
    SELECT cer.value
    FROM accounter_schema.crypto_exchange_rates cer
    WHERE cer.date <= t.debit_timestamp AND cer.coin_symbol::accounter_schema.currency = t.currency AND cer.against = 'USD'
    ORDER BY cer.date DESC
    LIMIT 1
) lr2 ON t.debit_timestamp IS NOT NULL)
SELECT t.id,
       t.charge_id,
       t.amount,
       t.currency,
       t.debit_date,
       t.month,
       t.year,
       t.business_id,
       t.is_fee,
       t.source_description,
       t.amount_usd
FROM transactions t
WHERE t.owner_id = $ownerId
AND t.debit_date BETWEEN $fromDate AND $toDate
ORDER BY t.amount;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BalanceReportProvider {
  //   cache = getCacheInstance({
  //     stdTTL: 60 * 60 * 5,
  //   });

  constructor(private dbProvider: DBProvider) {}

  public async getNormalizedBalanceTransactions(params: IGetNormalizedBalanceTransactionsParams) {
    try {
      return getNormalizedBalanceTransactions.run(params, this.dbProvider);
    } catch (error) {
      const message = 'Failed to get balance transactions';
      console.error(`${message}: ${error}`);
      throw new Error('Failed to get balance transactions');
    }
  }
}
