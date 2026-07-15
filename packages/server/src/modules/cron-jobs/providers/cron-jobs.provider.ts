import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  ICalculateCreditcardDebitDateParams,
  ICalculateCreditcardDebitDateQuery,
  IFlagForeignFeeTransactionsParams,
  IFlagForeignFeeTransactionsQuery,
  IGetReferenceMergeCandidatesParams,
  IGetReferenceMergeCandidatesQuery,
} from '../types.js';

const getReferenceMergeCandidates = sql<IGetReferenceMergeCandidatesQuery>`
  WITH transactions_origin_user_description AS (
    SELECT 
      t.id,
      COALESCE(
        p_ils.beneficiary_details_data_message_detail
        , p_foreign.event_details
        -- Add future description columns here as you expand:
        -- , oh_ils.description_column
        -- , discount.tx_details
      ) AS user_source_description
    FROM 
      accounter_schema.transactions t
    JOIN 
      accounter_schema.transactions_raw_list trl 
      ON t.source_id = trl.id
    LEFT JOIN 
      accounter_schema.poalim_ils_account_transactions p_ils 
      ON trl.poalim_ils_id = p_ils.id
    LEFT JOIN 
      accounter_schema.poalim_foreign_account_transactions p_foreign
      ON trl.poalim_foreign_id = p_foreign.id
    -- Add future LEFT JOINs here:
    -- LEFT JOIN accounter_schema.otsar_hahayal_ils_account_transactions oh_ils ON trl.otsar_hahayal_ils = oh_ils.id
    -- LEFT JOIN accounter_schema.bank_discount_transactions discount ON trl.bank_discount_id = discount.id
  ),
  transactions_with_descriptions AS (
    SELECT t.*, ud.user_source_description AS origin_user_description
    FROM accounter_schema.transactions t
    LEFT JOIN transactions_origin_user_description ud
        ON ud.id = t.id
  ),
  -- POALIM-specific alias extraction for foreign-securities records where the
  -- description contains a zero-padded numeric reference (e.g. 00XXXXXXXX).
  poalim_foreign_securities_reference_aliases AS (
    SELECT
      t.id AS transaction_id,
      t.event_date AS alias_event_date,
      LTRIM((embedded.match)[1], '0') AS normalized_reference
    FROM transactions_with_descriptions t
    CROSS JOIN LATERAL regexp_matches(
      COALESCE(t.source_description, '') || ' ' || COALESCE(t.origin_user_description, ''),
      '(0[0-9]{7,})',
      'g'
    ) AS embedded(match)
    WHERE t.owner_id = $ownerId
      AND t.source_origin = 'POALIM'
      AND (
        LOWER(COALESCE(t.source_description, '') || ' ' || COALESCE(t.origin_user_description, '')) LIKE '%fsec%'
        OR regexp_replace(
          LOWER(COALESCE(t.source_description, '') || ' ' || COALESCE(t.origin_user_description, '')),
          '["''׳״]',
          '',
          'g'
        ) LIKE '%ניעז%'
      )
      AND LENGTH(LTRIM((embedded.match)[1], '0')) >= 6
  ),
  -- POALIM-only linkage: keep only same-day cross-reference matches to avoid
  -- broad alias joins across unrelated transactions.
  poalim_foreign_securities_related_transactions AS (
    SELECT DISTINCT t.id
    FROM transactions_with_descriptions t
    JOIN poalim_foreign_securities_reference_aliases alias
      ON t.id = alias.transaction_id
      OR (
        t.source_origin = 'POALIM'
        AND t.source_reference = alias.normalized_reference
        AND t.event_date = alias.alias_event_date
      )
  )
  SELECT t.*
  FROM transactions_with_descriptions t
  LEFT JOIN (SELECT COUNT(et.*) AS counter, array_agg(DISTINCT et.charge_id) AS charge_ids, et.source_reference
          FROM accounter_schema.transactions et
          WHERE et.owner_id = $ownerId
          GROUP BY source_reference ) g
      ON g.source_reference = t.source_reference
  WHERE t.owner_id = $ownerId
      AND (
        (g.counter > 1 AND array_length(g.charge_ids, 1) > 1)
        -- Extra branch is intentionally POALIM-specific (via CTE definition above).
        OR t.id IN (SELECT id FROM poalim_foreign_securities_related_transactions)
      )
      AND t.source_reference NOT IN (
        SELECT account_number FROM accounter_schema.financial_accounts
        WHERE owner = $ownerId AND type = 'CREDIT_CARD'
      )
      AND t.source_reference <> '15997109' -- CUSTOM + V.A.T
  ORDER BY t.source_reference;`;

const flagForeignFeeTransactions = sql<IFlagForeignFeeTransactionsQuery>`
  UPDATE accounter_schema.transactions t
  SET is_fee = TRUE
  FROM (SELECT t.id
        FROM accounter_schema.transactions t
                LEFT JOIN (SELECT count(t2.*)                      AS counter,
                                  array_agg(DISTINCT t2.charge_id) AS charge_ids,
                                  t2.source_reference
                            FROM accounter_schema.transactions t2
                            WHERE t2.owner_id = $ownerId
                            GROUP BY source_reference) g
                          ON g.source_reference = t.source_reference
        WHERE t.is_fee IS FALSE
          AND t.owner_id = $ownerId
          AND g.counter > 1
          AND t.currency <> 'ILS'
          AND t.amount <= 30
          AND t.amount >= -30
          AND t.source_description LIKE '%העברת מט%') matches
  WHERE t.id = matches.id
  RETURNING t.id;`;

const calculateCreditcardDebitDate = sql<ICalculateCreditcardDebitDateQuery>`
WITH alt_debit_date AS (SELECT p.event_date,
                               p.reference_number::text
                        FROM accounter_schema.poalim_ils_account_transactions p
                        WHERE p.activity_type_code = 491
                        ORDER BY p.event_date DESC),
     altered_transactions AS (SELECT DISTINCT ON (t.id) t.id,
                                                        alt_debit_date.event_date AS alt_debit_date,
                                                        t.owner_id
                              FROM accounter_schema.transactions t
                                       LEFT JOIN accounter_schema.financial_accounts a ON a.id = t.account_id
                                       LEFT JOIN alt_debit_date
                                                 ON alt_debit_date.reference_number = a.account_number AND
                                                    alt_debit_date.event_date > t.event_date AND
                                                    alt_debit_date.event_date < (t.event_date + '40 days'::interval) AND
                                                    alt_debit_date.event_date = ((SELECT min(add.event_date) AS min
                                                                                  FROM alt_debit_date add
                                                                                  WHERE add.reference_number = a.account_number
                                                                                    AND add.event_date > t.event_date
                                                                                    AND add.event_date < (t.event_date + '40 days'::interval)))
                              WHERE t.debit_date IS NULL
                                AND t.debit_date_override IS NULL
                                AND currency = 'ILS'
                                AND (t.source_origin = 'ISRACARD' OR t.source_origin = 'AMEX'))
UPDATE accounter_schema.transactions t
SET debit_date_override = at.alt_debit_date
FROM altered_transactions at
where at.id = t.id
  AND t.debit_date IS NULL
  AND t.debit_date_override IS NULL
  AND at.alt_debit_date IS NOT NULL
  AND at.owner_id = $ownerId;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class CronJobsProvider {
  constructor(private db: TenantAwareDBClient) {}

  public async getReferenceMergeCandidates(params: IGetReferenceMergeCandidatesParams) {
    return getReferenceMergeCandidates.run(params, this.db);
  }

  public async flagForeignFeeTransactions(params: IFlagForeignFeeTransactionsParams) {
    return flagForeignFeeTransactions.run(params, this.db);
  }

  public async calculateCreditcardDebitDate(params: ICalculateCreditcardDebitDateParams) {
    return calculateCreditcardDebitDate.run(params, this.db);
  }
}
