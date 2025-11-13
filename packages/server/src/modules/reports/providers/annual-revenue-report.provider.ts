import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
// import { getCacheInstance } from '@shared/helpers';
import {
  IGetNormalizedRevenueTransactionsParams,
  IGetNormalizedRevenueTransactionsQuery,
} from '../types.js';

const getNormalizedRevenueTransactions = sql<IGetNormalizedRevenueTransactionsQuery>`
with transactions AS (SELECT
    t.*,
    c.owner_id,
    COALESCE(t.debit_date_override, t.debit_timestamp, t.debit_date) as normalized_debit_date,
    CASE
        WHEN t.currency = 'USD' THEN t.amount
        WHEN t.currency = 'ILS' THEN t.amount / lr.usd -- Convert ILS => USD
        WHEN t.currency = 'AUD' THEN t.amount * (lr.aud / lr.usd) -- Convert AUD => ILS => USD
        WHEN t.currency = 'CAD' THEN t.amount * (lr.cad / lr.usd) -- Convert CAD => ILS => USD
        WHEN t.currency = 'EUR' THEN t.amount * (lr.eur / lr.usd) -- Convert EUR => ILS => USD
        WHEN t.currency = 'GBP' THEN t.amount * (lr.gbp / lr.usd) -- Convert GBP => ILS => USD
        WHEN t.currency = 'JPY' THEN t.amount * (lr.jpy / lr.usd) -- Convert JPY => ILS => USD
        WHEN t.currency = 'SEK' THEN t.amount * (lr.sek / lr.usd) -- Convert SEK => ILS => USD
        WHEN t.currency = 'USDC' OR t.currency = 'GRT' OR t.currency = 'ETH' THEN t.amount * lr2.value -- Convert Crypto => USD
        ELSE NULL
    END AS amount_usd,
        CASE
        WHEN t.currency = 'ILS' THEN t.amount
        WHEN t.currency = 'USD' THEN t.amount * lr.usd -- Convert USD => ILS
        WHEN t.currency = 'AUD' THEN t.amount * lr.aud -- Convert AUD => ILS
        WHEN t.currency = 'CAD' THEN t.amount * lr.cad -- Convert CAD => ILS
        WHEN t.currency = 'EUR' THEN t.amount * lr.eur -- Convert EUR => ILS
        WHEN t.currency = 'GBP' THEN t.amount * lr.gbp -- Convert GBP => ILS
        WHEN t.currency = 'JPY' THEN t.amount * lr.jpy -- Convert JPY => ILS
        WHEN t.currency = 'SEK' THEN t.amount * lr.sek -- Convert SEK => ILS
        WHEN t.currency = 'USDC' OR t.currency = 'GRT' OR t.currency = 'ETH' THEN t.amount * lr2.value * lr.usd -- Convert Crypto => USD => ILS
        ELSE NULL
    END AS amount_ils
FROM accounter_schema.transactions t
LEFT JOIN accounter_schema.charges c ON t.charge_id = c.id
LEFT JOIN LATERAL (
    SELECT er.usd, er.eur, er.gbp, er.cad, er.jpy, er.aud, er.sek
    FROM accounter_schema.exchange_rates er
    WHERE er.exchange_date <= t.debit_date
    ORDER BY er.exchange_date DESC
    LIMIT 1
) lr ON t.currency = 'ILS' OR t.currency = 'EUR' OR t.currency ='GBP' OR t.currency = 'CAD' OR t.currency = 'JPY' OR t.currency = 'AUD' OR t.currency = 'SEK'
LEFT JOIN LATERAL (
    SELECT cer.value
    FROM accounter_schema.crypto_exchange_rates cer
    WHERE cer.date <= t.debit_timestamp AND cer.coin_symbol::accounter_schema.currency = t.currency AND cer.against = 'USD'
    ORDER BY cer.date DESC
    LIMIT 1
) lr2 ON t.debit_timestamp IS NOT NULL)
SELECT t.*
FROM transactions t
WHERE t.owner_id = $ownerId
AND t.normalized_debit_date BETWEEN $fromDate AND $toDate
AND ($isBusinessIDs = 0 OR t.business_id IN $$businessIDs)
ORDER BY t.normalized_debit_date;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class AnnualRevenueReportProvider {
  //   cache = getCacheInstance({
  //     stdTTL: 60 * 60 * 5,
  //   });

  constructor(private dbProvider: DBProvider) {}

  public async getNormalizedRevenueTransactions(params: IGetNormalizedRevenueTransactionsParams) {
    try {
      return getNormalizedRevenueTransactions.run(params, this.dbProvider);
    } catch (error) {
      const message = 'Failed to get balance transactions';
      console.error(`${message}: ${error}`);
      throw new Error(message);
    }
  }
}
