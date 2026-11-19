import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Bank ⇄ credit card linkage, phase 3: one definition of the banks' raw card hints.
 *
 * `bank_transaction_card_hints` lists, per bank transaction, the card identifiers found in the
 * bank's raw scraper row:
 * - Poalim ILS: a card debit (activity 491) carries the card number as its `reference_number`.
 * - Otsar Hahayal ILS: a card-debit row carries the card's last 4 digits in `origin_reference`
 *   (from its card-breakdown drill-down). The raw row is pinned to the transaction's owner.
 *
 * It was a CTE of the statement links provider. As a view it is shared by the statement matcher's
 * hint loader, the LINK_CREDITCARD_STATEMENTS candidates and the FILL_CREDITCARD_DEBIT_DATES
 * automation, so supporting another bank's raw clue means adding one `UNION ALL` branch here.
 *
 * `security_invoker` makes the view read the tables with the caller's rights, so their RLS
 * policies apply as if the caller had queried them directly.
 */
export default {
  name: '2026-11-19T14-00-00.bank-transaction-card-hints-view.sql',
  run: ({ sql }) => sql`
CREATE OR REPLACE VIEW accounter_schema.bank_transaction_card_hints
WITH (security_invoker = true) AS
SELECT t.id AS transaction_id,
  t.owner_id,
  'POALIM_491'::text AS source,
  p.reference_number::text AS hint
FROM accounter_schema.transactions t
  JOIN accounter_schema.transactions_raw_list rl
    ON rl.id = t.source_id
  JOIN accounter_schema.poalim_ils_account_transactions p
    ON p.id = rl.poalim_ils_id
    AND p.activity_type_code = 491
WHERE p.reference_number IS NOT NULL
UNION ALL
SELECT t.id AS transaction_id,
  t.owner_id,
  'OTSAR_HAHAYAL_ILS'::text AS source,
  btrim(o.origin_reference) AS hint
FROM accounter_schema.transactions t
  JOIN accounter_schema.transactions_raw_list rl
    ON rl.id = t.source_id
  JOIN accounter_schema.otsar_hahayal_ils_account_transactions o
    ON o.id = rl.otsar_hahayal_ils_id
    AND (o.owner_id = t.owner_id OR o.owner_id IS NULL)
WHERE btrim(o.origin_reference) <> '';

COMMENT ON VIEW accounter_schema.bank_transaction_card_hints IS
  'Card identifiers in the banks'' raw rows, per bank transaction: Poalim 491 reference_number, Otsar Hahayal ILS origin_reference';
`,
} satisfies MigrationExecutor;
