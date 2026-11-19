import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Bank ⇄ credit card linkage, phase 2: the ledger's hard-coded card fallback becomes data.
 *
 * The ledger used to book card debits it could not resolve by reference against fixed card
 * accounts, chosen from the debit's reference and description. Those accounts exist in one
 * database only. Now the ledger reads stored statement links instead, so this migration stores a
 * MANUAL link for every bank row the fallback would have resolved, and the fallback is deleted.
 *
 * A link is inserted only when:
 * - the target card account exists, as a CREDIT_CARD account of the bank row's owner (so every
 *   other database is a no-op);
 * - the bank row is on a non-card account and is not a fee;
 * - no financial account of the owner is numbered as the row's reference (the ledger's reference
 *   lookup came first, so the fallback never applied to such a row);
 * - the bank row has no link yet.
 *
 * The statement linked is the target card's statement in the row's currency whose debit date is
 * closest to the row's effective date, within ±5 days, among the statements not linked yet (on a
 * tie, the earlier one). With none, the row's effective date is used: an empty statement, which
 * the UI flags as a mismatch. A statement that is already linked is left alone.
 */
export default {
  name: '2026-11-19T13-00-00.creditcard-legacy-links.sql',
  run: async ({ connection }) => {
    // The backfill runs with no tenant session, so FORCE RLS would hide every row from it, and
    // the links' write policy would reject every insert.
    for (const table of ['transactions', 'financial_accounts', 'creditcard_statement_links']) {
      await connection.query(sql.unsafe`
        ALTER TABLE ${sql.identifier(['accounter_schema', table])} NO FORCE ROW LEVEL SECURITY
      `);
    }

    // One debit at a time, oldest first, so a statement claimed by an earlier debit is not
    // offered to a later one
    await connection.query(sql.unsafe`
      DO $$
      DECLARE
        d record;
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
            WHERE t.is_fee IS NOT TRUE
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
        END LOOP;
      END
      $$;
    `);

    for (const table of ['creditcard_statement_links', 'financial_accounts', 'transactions']) {
      await connection.query(sql.unsafe`
        ALTER TABLE ${sql.identifier(['accounter_schema', table])} FORCE ROW LEVEL SECURITY
      `);
    }
  },
} satisfies MigrationExecutor;
