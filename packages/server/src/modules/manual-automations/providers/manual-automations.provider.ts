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
        AND LTRIM(t.source_reference, '0') = alias.normalized_reference
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

/**
 * Fills `debit_date_override` on the owner's ILS card rows that came without a debit date (the
 * issuers whose debit date can be NULL: Isracard, Amex, Cal). The date is that of the earliest
 * bank debit that strongly points at the row's card, within 40 days after the purchase.
 *
 * Strong card clues, as the statement matcher defines them, on the owner's non-card, non-fee ILS
 * bank rows:
 * - a raw bank hint (`bank_transaction_card_hints`: Poalim 491 reference, Otsar Hahayal
 *   `origin_reference`) equal to the card's last 4 digits;
 * - on a row whose counterparty is one of the owner's card issuers and that has no raw hint: a
 *   reference equal to the card number, or the card's name in the description. A raw hint decides
 *   the card, so another card's name in the description of a hinted debit gives it no date.
 */
const calculateCreditcardDebitDate = sql<ICalculateCreditcardDebitDateQuery>`
WITH card_rows AS (
  SELECT t.id,
    t.event_date,
    btrim(a.account_number) AS account_number,
    btrim(a.account_name) AS account_name,
    regexp_replace(a.account_number, '[^0-9]', '', 'g') AS card_digits
  FROM accounter_schema.transactions t
    JOIN accounter_schema.financial_accounts a
      ON a.id = t.account_id
      AND a.owner_id = t.owner_id
      AND a.type = 'CREDIT_CARD'
  WHERE t.owner_id = $ownerId
    AND t.debit_date IS NULL
    AND t.debit_date_override IS NULL
    AND t.currency = 'ILS'
    AND t.source_origin IN ('ISRACARD', 'AMEX', 'CAL')
),
bank_rows AS (
  SELECT b.id,
    b.event_date,
    btrim(b.source_reference) AS source_reference,
    b.source_description,
    b.business_id
  FROM accounter_schema.transactions b
    JOIN accounter_schema.financial_accounts ba
      ON ba.id = b.account_id
      AND ba.owner_id = b.owner_id
      AND ba.type <> 'CREDIT_CARD'
  WHERE b.owner_id = $ownerId
    AND b.is_fee IS FALSE
    AND b.currency = 'ILS'
),
-- raw hints, as the matcher reads them: left-padded to 4 characters, then their last 4 digits
hinted_bank_rows AS (
  SELECT b.id,
    b.event_date,
    regexp_replace(lpad(btrim(h.hint), greatest(length(btrim(h.hint)), 4), '0'), '[^0-9]', '', 'g') AS hint_digits
  FROM bank_rows b
    JOIN accounter_schema.bank_transaction_card_hints h
      ON h.transaction_id = b.id
      AND h.owner_id = $ownerId
),
card_debits AS (
  SELECT c.id AS card_transaction_id,
    hb.event_date
  FROM card_rows c
    JOIN hinted_bank_rows hb
      ON length(c.card_digits) >= 4
      AND length(hb.hint_digits) >= 4
      AND right(hb.hint_digits, 4) = right(c.card_digits, 4)
      AND hb.event_date > c.event_date
      AND hb.event_date < c.event_date + 40
  UNION ALL
  SELECT c.id AS card_transaction_id,
    b.event_date
  FROM card_rows c
    JOIN bank_rows b
      ON b.business_id = ANY ($creditCardBusinessIds::uuid[])
      AND b.event_date > c.event_date
      AND b.event_date < c.event_date + 40
      AND (
        (c.account_number <> '' AND b.source_reference = c.account_number)
        OR (
          c.account_name IS NOT NULL
          AND c.account_name <> ''
          AND strpos(b.source_description, c.account_name) > 0
        )
      )
  -- a raw hint names the card the row pays: then its reference or description names no other
  WHERE NOT EXISTS (SELECT 1 FROM hinted_bank_rows hb WHERE hb.id = b.id)
),
earliest_debits AS (
  SELECT card_transaction_id, min(event_date) AS debit_date
  FROM card_debits
  GROUP BY card_transaction_id
)
UPDATE accounter_schema.transactions t
SET debit_date_override = d.debit_date
FROM earliest_debits d
WHERE t.id = d.card_transaction_id
  AND t.owner_id = $ownerId
  AND t.debit_date IS NULL
  AND t.debit_date_override IS NULL
RETURNING t.id, t.debit_date_override;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ManualAutomationsProvider {
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
