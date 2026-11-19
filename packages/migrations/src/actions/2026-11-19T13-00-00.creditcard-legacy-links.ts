import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Tables the backfill reads or writes. It runs with no tenant session, so FORCE RLS would hide
 * every row from it (or fail the read), and the links' write policy would reject every insert.
 */
const TABLES = [
  'transactions',
  'financial_accounts',
  'documents',
  'user_context',
  'businesses_securities',
  'creditcard_statement_links',
];

/**
 * Bank ⇄ credit card linkage, phase 2: the ledger's hard-coded card fallback becomes data.
 *
 * The ledger used to book card debits it could not resolve by reference against fixed card
 * accounts, chosen from the debit's reference and description. Those accounts exist in one
 * database only. Now the ledger reads stored statement links instead, so this migration stores a
 * MANUAL link for every bank row the fallback served, and the fallback is deleted.
 *
 * The fallback only ran when the charge had no relevant documents (invoices, credit invoices,
 * invoice-receipts or receipts), the row had a reference, and the charge's main business was one
 * of the owner's internal wallets (`internalWalletsIds`). A link is inserted only when:
 * - the row's charge has no relevant document;
 * - the row's own `business_id` is one of the owner's wallet businesses. This stands in for the
 *   charge's main business, which SQL can't derive. The wallets are built as
 *   `AdminContextProvider` builds `internalWalletsIds`: the bank, card issuer, Etana, Kraken and
 *   Etherscan businesses of `user_context`, the foreign-securities business of its
 *   `securities_context`, and every per-security business of the owner;
 * - the target card account exists, as a CREDIT_CARD account of the row's owner (so every other
 *   database is a no-op);
 * - the row is on a non-card account and is not a fee;
 * - no financial account of the owner is numbered as the row's reference (the ledger's reference
 *   lookup came first, so the fallback never applied to such a row);
 * - the row has no link yet.
 *
 * The statement linked is the target card's statement in the row's currency whose debit date is
 * closest to the row's effective date, within ±5 days, among the statements not linked yet (on a
 * tie, the earlier one). With none, the row's effective date is used: an empty statement, which
 * the UI flags as a mismatch. Debits are linked one at a time, oldest first, so a statement taken
 * by an earlier debit is not offered to a later one.
 *
 * A debit whose statement key is already taken (say, two debits falling back to the same date)
 * is not linked: its ledger then reports that the debit needs linking. Such debits are listed in
 * a WARNING, which does not fail the migration.
 */
export default {
  name: '2026-11-19T13-00-00.creditcard-legacy-links.sql',
  run: async ({ connection }) => {
    for (const table of TABLES) {
      await connection.query(sql.unsafe`
        ALTER TABLE ${sql.identifier(['accounter_schema', table])} NO FORCE ROW LEVEL SECURITY
      `);
    }

    await connection.query(sql.unsafe`
      DO $$
      DECLARE
        d record;
        skipped uuid[] := '{}';
      BEGIN
        FOR d IN
          WITH legacy_rule (priority, source_reference, description_part, card_account_id) AS (
            VALUES
              (1, '8547', NULL, '6fed9073-f571-402e-9da0-ac0669f658d2'::uuid),
              (2, '13795', '2260', '0e86514c-9ddb-4c82-b731-6107f7293b1f'::uuid),
              (3, '13795', '4333', '782070ce-ec7e-4be0-ab69-46c89528bf04'::uuid),
              (4, '22200', 'מסטרקארד', '782070ce-ec7e-4be0-ab69-46c89528bf04'::uuid),
              (5, '11200', 'כ.א.ל', '6fed9073-f571-402e-9da0-ac0669f658d2'::uuid)
          ),
          wallet AS (
            SELECT uc.owner_id, w.business_id
            FROM accounter_schema.user_context uc
              CROSS JOIN LATERAL (
                VALUES
                  (uc.poalim_business_id),
                  (uc.discount_business_id),
                  (uc.otsar_hahayal_business_id),
                  (uc.isracard_business_id),
                  (uc.amex_business_id),
                  (uc.cal_business_id),
                  (uc.otsar_hahayal_credit_card_business_id),
                  (uc.etana_business_id),
                  (uc.kraken_business_id),
                  (uc.etherscan_business_id),
                  (
                    CASE
                      WHEN uc.securities_context ->> 'foreignSecuritiesBusinessId'
                        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      THEN (uc.securities_context ->> 'foreignSecuritiesBusinessId')::uuid
                    END
                  )
              ) AS w (business_id)
            WHERE w.business_id IS NOT NULL
            UNION
            SELECT bs.owner_id, bs.id
            FROM accounter_schema.businesses_securities bs
          ),
          legacy_debit AS (
            -- the first rule that matches, as the fallback checked them in this order
            SELECT DISTINCT ON (t.id)
              t.id AS bank_transaction_id,
              t.owner_id,
              t.currency,
              COALESCE(t.debit_date_override, t.debit_date, t.event_date) AS effective_date,
              r.card_account_id
            FROM accounter_schema.transactions t
              JOIN legacy_rule r
                ON r.source_reference = t.source_reference
                AND (
                  r.description_part IS NULL
                  OR strpos(COALESCE(t.source_description, ''), r.description_part) > 0
                )
              JOIN accounter_schema.financial_accounts bank_account
                ON bank_account.id = t.account_id
                AND bank_account.type <> 'CREDIT_CARD'
              JOIN accounter_schema.financial_accounts card
                ON card.id = r.card_account_id
                AND card.owner_id = t.owner_id
                AND card.type = 'CREDIT_CARD'
              JOIN wallet
                ON wallet.owner_id = t.owner_id
                AND wallet.business_id = t.business_id
            WHERE t.is_fee IS NOT TRUE
              -- the documents that make the common charge generator book from documents
              AND NOT EXISTS (
                SELECT 1
                FROM accounter_schema.documents doc
                WHERE doc.charge_id = t.charge_id
                  AND doc.type IN ('INVOICE', 'CREDIT_INVOICE', 'INVOICE_RECEIPT', 'RECEIPT')
              )
              AND NOT EXISTS (
                SELECT 1
                FROM accounter_schema.financial_accounts by_reference
                WHERE by_reference.owner_id = t.owner_id
                  AND by_reference.account_number = t.source_reference
              )
              AND NOT EXISTS (
                SELECT 1
                FROM accounter_schema.creditcard_statement_links l
                WHERE l.bank_transaction_id = t.id
              )
            ORDER BY t.id, r.priority
          )
          SELECT *
          FROM legacy_debit
          ORDER BY effective_date, bank_transaction_id
        LOOP
          INSERT INTO accounter_schema.creditcard_statement_links (
            owner_id,
            bank_transaction_id,
            card_account_id,
            currency,
            debit_date,
            link_method
          )
          VALUES (
            d.owner_id,
            d.bank_transaction_id,
            d.card_account_id,
            d.currency,
            COALESCE(
              (
                SELECT s.debit_date
                FROM (
                  SELECT DISTINCT COALESCE(ct.debit_date_override, ct.debit_date) AS debit_date
                  FROM accounter_schema.transactions ct
                  WHERE ct.owner_id = d.owner_id
                    AND ct.account_id = d.card_account_id
                    AND ct.currency = d.currency
                    AND COALESCE(ct.debit_date_override, ct.debit_date)
                      BETWEEN d.effective_date - 5 AND d.effective_date + 5
                ) s
                WHERE NOT EXISTS (
                  SELECT 1
                  FROM accounter_schema.creditcard_statement_links taken
                  WHERE taken.card_account_id = d.card_account_id
                    AND taken.currency = d.currency
                    AND taken.debit_date = s.debit_date
                )
                ORDER BY abs(s.debit_date - d.effective_date), s.debit_date
                LIMIT 1
              ),
              d.effective_date
            ),
            'MANUAL'
          )
          ON CONFLICT DO NOTHING;

          IF NOT FOUND THEN
            skipped := array_append(skipped, d.bank_transaction_id);
          END IF;
        END LOOP;

        IF cardinality(skipped) > 0 THEN
          RAISE WARNING 'creditcard-legacy-links: % bank transaction(s) not linked, their card statement key is already taken; link them from the charge''s CreditCard Transactions panel: %',
            cardinality(skipped),
            array_to_string(skipped, ', ');
        END IF;
      END
      $$;
    `);

    for (const table of [...TABLES].reverse()) {
      await connection.query(sql.unsafe`
        ALTER TABLE ${sql.identifier(['accounter_schema', table])} FORCE ROW LEVEL SECURITY
      `);
    }
  },
} satisfies MigrationExecutor;
