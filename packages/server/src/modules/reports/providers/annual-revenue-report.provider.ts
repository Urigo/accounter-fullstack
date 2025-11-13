import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
// import { getCacheInstance } from '@shared/helpers';
import { IGetNormalizedRevenueRecordsParams, IGetNormalizedRevenueRecordsQuery } from '../types.js';

const getNormalizedRevenueRecords = sql<IGetNormalizedRevenueRecordsQuery>`
WITH
  normalizedLedgerRevenue AS (
    WITH
      ChargeBusinessID AS (
        -- 1. Gather potential Business IDs from transactions and documents
        SELECT
          t.charge_id,
          CASE
            WHEN array_length(ARRAY_AGG(DISTINCT potential_id), 1) = 1 THEN ARRAY_AGG(DISTINCT potential_id)
            ELSE NULL
          END AS entity_id
        FROM
          (
            -- IDs from 'transactions' table (if not a fee and not null)
            SELECT
              charge_id,
              business_id AS potential_id
            FROM
              accounter_schema.transactions
            WHERE
              NOT is_fee
              AND business_id IS NOT NULL
            UNION ALL
            -- IDs from 'documents' table (creditor_id if not OWNER_ID and not null)
            SELECT
              charge_id,
              creditor_id AS potential_id
            FROM
              accounter_schema.documents
            WHERE
              creditor_id IS NOT NULL
              AND creditor_id <> $ownerId -- OWNER_ID constant
            UNION ALL
            -- IDs from 'documents' table (debtor_id if not OWNER_ID and not null)
            SELECT
              charge_id,
              debtor_id AS potential_id
            FROM
              accounter_schema.documents
            WHERE
              debtor_id IS NOT NULL
              AND debtor_id <> $ownerId -- OWNER_ID constant
          ) t
        GROUP BY
          t.charge_id
      )
    SELECT
      ledger_records.id,
      ledger_records.charge_id,
      ledger_records.owner_id,
      ledger_records.debit_local_amount1 as amount_local,
      ledger_records.debit_foreign_amount1 as amount_foreign,
      ledger_records.currency as currency,
      ledger_records.value_date as date,
      ledger_records.reference1 as reference,
      ledger_records.description as description,
      ledger_records.debit_entity1 as business_id,
      b.country as country
    FROM
      accounter_schema.ledger_records
      LEFT JOIN accounter_schema.businesses b ON b.id = ledger_records.debit_entity1
    WHERE
      (
        ledger_records.credit_entity1 IN $$incomeTaxCategoriesIDs
        OR ledger_records.credit_entity2 IN $$incomeTaxCategoriesIDs
      )
      AND ledger_records.owner_id = $ownerId
      AND ledger_records.value_date BETWEEN $fromDate AND $toDate
    UNION
    SELECT
      ledger_records.id,
      ledger_records.charge_id,
      ledger_records.owner_id,
      ledger_records.credit_local_amount1 as amount_local,
      ledger_records.credit_foreign_amount1 as amount_foreign,
      ledger_records.currency as currency,
      ledger_records.value_date as date,
      ledger_records.reference1 as reference,
      ledger_records.description as description,
      ledger_records.credit_entity1 as business_id,
      b.country as country
    FROM
      accounter_schema.ledger_records
      LEFT JOIN accounter_schema.businesses b ON b.id = ledger_records.credit_entity1
    WHERE
      (
        ledger_records.debit_entity1 IN $$incomeTaxCategoriesIDs
        OR ledger_records.debit_entity2 IN $$incomeTaxCategoriesIDs
      )
      AND ledger_records.owner_id = $ownerId
      AND ledger_records.value_date BETWEEN $fromDate AND $toDate
    UNION
    SELECT
      ledger_records.id,
      ledger_records.charge_id,
      ledger_records.owner_id,
      ledger_records.debit_local_amount1 * -1 as amount_local,
      ledger_records.debit_foreign_amount1 * -1 as amount_foreign,
      ledger_records.currency as currency,
      ledger_records.invoice_date as date,
      ledger_records.reference1 as reference,
      ledger_records.description as description,
      cbi.entity_id[1] as business_id,
      b.country as country
    FROM
      accounter_schema.ledger_records
      LEFT JOIN ChargeBusinessID cbi ON ledger_records.charge_id = cbi.charge_id
      LEFT JOIN accounter_schema.businesses b ON b.id = cbi.entity_id[1]
    WHERE
      (
        ledger_records.credit_entity1 = $incomeToCollectId
        OR ledger_records.credit_entity2 = $incomeToCollectId
      )
      AND ledger_records.owner_id = $ownerId
      AND ledger_records.invoice_date = $fromDate
    UNION
    SELECT
      ledger_records.id,
      ledger_records.charge_id,
      ledger_records.owner_id,
      ledger_records.credit_local_amount1 as amount_local,
      ledger_records.credit_foreign_amount1 as amount_foreign,
      ledger_records.currency as currency,
      ledger_records.invoice_date as date,
      ledger_records.reference1 as reference,
      ledger_records.description as description,
      cbi.entity_id[1] as business_id,
      b.country as country
    FROM
      accounter_schema.ledger_records
      LEFT JOIN ChargeBusinessID cbi ON ledger_records.charge_id = cbi.charge_id
      LEFT JOIN accounter_schema.businesses b ON b.id = cbi.entity_id[1]
    WHERE
      (
        ledger_records.debit_entity1 = $incomeToCollectId
        OR ledger_records.debit_entity2 = $incomeToCollectId
      )
      AND ledger_records.owner_id = $ownerId
      AND ledger_records.invoice_date = $toDate
  )
SELECT
  nlr.*,
  CASE
    WHEN nlr.currency = 'USD' THEN nlr.amount_foreign
    WHEN nlr.currency = 'ILS' THEN nlr.amount_local / lr.usd -- Convert ILS => USD    
    WHEN nlr.currency = 'AUD' THEN nlr.amount_foreign * (lr.aud / lr.usd) -- Convert AUD => ILS => USD    
    WHEN nlr.currency = 'CAD' THEN nlr.amount_foreign * (lr.cad / lr.usd) -- Convert CAD => ILS => USD     
    WHEN nlr.currency = 'EUR' THEN nlr.amount_foreign * (lr.eur / lr.usd) -- Convert EUR => ILS => USD      
    WHEN nlr.currency = 'GBP' THEN nlr.amount_foreign * (lr.gbp / lr.usd) -- Convert GBP => ILS => USD      
    WHEN nlr.currency = 'JPY' THEN nlr.amount_foreign * (lr.jpy / lr.usd) -- Convert JPY => ILS => USD      
    WHEN nlr.currency = 'SEK' THEN nlr.amount_foreign * (lr.sek / lr.usd) -- Convert SEK => ILS => USD      
    WHEN nlr.currency = 'USDC'
    OR nlr.currency = 'GRT'
    OR nlr.currency = 'ETH' THEN nlr.amount_foreign * lr2.value -- Convert Crypto => USD  
  END AS amount_usd
FROM
  normalizedLedgerRevenue nlr
  LEFT JOIN LATERAL (
    SELECT
      er.usd,
      er.eur,
      er.gbp,
      er.cad,
      er.jpy,
      er.aud,
      er.sek
    FROM
      accounter_schema.exchange_rates er
    WHERE
      er.exchange_date <= nlr.date
    ORDER BY
      er.exchange_date DESC
    LIMIT
      1
  ) lr ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      cer.value
    FROM
      accounter_schema.crypto_exchange_rates cer
    WHERE
      cer.date <= nlr.date
      AND cer.coin_symbol::accounter_schema.currency = nlr.currency
      AND cer.against = 'USD'
    ORDER BY
      cer.date DESC
    LIMIT
      1
  ) lr2 ON nlr.date IS NOT NULL;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class AnnualRevenueReportProvider {
  //   cache = getCacheInstance({
  //     stdTTL: 60 * 60 * 5,
  //   });

  constructor(private dbProvider: DBProvider) {}

  public async getNormalizedRevenueRecords(params: IGetNormalizedRevenueRecordsParams) {
    try {
      return getNormalizedRevenueRecords.run(params, this.dbProvider);
    } catch (error) {
      const message = 'Failed to get balance transactions';
      console.error(`${message}: ${error}`);
      throw new Error(message);
    }
  }
}
