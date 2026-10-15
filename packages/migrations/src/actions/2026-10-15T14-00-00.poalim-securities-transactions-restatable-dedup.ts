import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Re-key accounter_schema.poalim_securities_transactions (created in 2026-08-13T12-00-00) on the
 * fields the bank never restates, so a re-scraped execution updates its row instead of adding one.
 *
 * The original dedup index included value_date, settlement_date, trade_price and
 * net_value_trade_currency. All four change between an execution's first appearance and its
 * settlement: a fund's price is fixed at end of day, and value/settlement dates move forward as
 * the trade clears (dividends by a day or two, bonds from T+0 to T+n). Each restated scrape
 * therefore missed the ON CONFLICT and inserted a second row, leaving the stale one behind — and
 * the stale row can never pair with its cash leg, since that match runs on value_date and net
 * value.
 *
 * The new identity is the loose key plus `occurrence`: the response carries no per-execution id,
 * so two genuine executions that agree on every key field (same day, security, direction and
 * size) are told apart by their ordinal within a single scrape, which reports each execution
 * exactly once.
 *
 * Existing duplicates are resolved before the new index is built. Within each loose-key group,
 * rows are split into scrape batches — uuidv7 rows inserted within a minute of each other came
 * from one upload; a pre-uuidv7 (v4) row carries no timestamp and is its own batch. The freshest
 * batch survives and the rest are deleted: the newest upload first, and for v4 rows the latest
 * value_date, then last_tranaction_date (the bank bumps it when it restates a fund price without
 * moving the value date). The rows are re-scrapable source data, and nothing references them.
 *
 * Index changes:
 *   - DROP unique index poalim_securities_transactions_dedup_uindex (… value_date, settlement_date,
 *     trade_price, net_value_trade_currency …)
 *   - ADD  unique index poalim_securities_transactions_dedup_uindex (loose key, occurrence)
 */
export default {
  name: '2026-10-15T14-00-00.poalim-securities-transactions-restatable-dedup.sql',
  run: async ({ connection }) => {
    // The cleanup runs with no tenant session, so FORCE RLS would hide every row from it.
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.poalim_securities_transactions NO FORCE ROW LEVEL SECURITY
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.poalim_securities_transactions
        ADD COLUMN IF NOT EXISTS occurrence SMALLINT NOT NULL DEFAULT 1
    `);

    await connection.query(sql.unsafe`
      COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.occurrence IS
        'Ordinal (1..n) among executions of one scrape that share every dedup-key field. The response has no per-execution id, so this is what keeps two same-day, same-size executions apart'
    `);

    await connection.query(sql.unsafe`
      CREATE TEMPORARY TABLE poalim_securities_transactions_dedup_plan ON COMMIT DROP AS
      WITH base AS (
        SELECT
          t.id,
          t.value_date,
          t.last_tranaction_date,
          t.settlement_date,
          t.trade_price,
          t.net_value_trade_currency,
          CASE WHEN uuid_extract_version(t.id) = 7 THEN uuid_extract_timestamp(t.id) END AS inserted_at,
          DENSE_RANK() OVER (
            ORDER BY t.owner_id, t.bank_number, t.branch_number, t.account_number, t.security,
                     t.trade_date, t.trade_type, t.transaction_type, t.nv, t.payment_type,
                     t.payment_date, t.ex_date, t.cancel_date
          ) AS grp
        FROM accounter_schema.poalim_securities_transactions t
      ),
      gaps AS (
        SELECT
          b.*,
          CASE
            WHEN b.inserted_at IS NULL THEN NULL
            WHEN b.inserted_at - LAG(b.inserted_at) OVER v7 <= interval '1 minute' THEN 0
            ELSE 1
          END AS starts_batch
        FROM base b
        WINDOW v7 AS (PARTITION BY b.grp, b.inserted_at IS NULL ORDER BY b.inserted_at, b.id)
      ),
      batched AS (
        SELECT
          g.*,
          CASE
            WHEN g.inserted_at IS NULL THEN 'v4:' || g.id::text
            ELSE 'v7:' || SUM(g.starts_batch) OVER (
              PARTITION BY g.grp, g.inserted_at IS NULL
              ORDER BY g.inserted_at, g.id
              ROWS UNBOUNDED PRECEDING
            )::text
          END AS batch
        FROM gaps g
      ),
      ranked_batches AS (
        SELECT
          grp,
          batch,
          ROW_NUMBER() OVER (
            PARTITION BY grp
            ORDER BY MAX(inserted_at) DESC NULLS LAST,
                     MAX(value_date) DESC NULLS LAST,
                     MAX(last_tranaction_date) DESC NULLS LAST,
                     MAX(settlement_date) DESC NULLS LAST,
                     MAX(id::text) DESC
          ) AS batch_rank
        FROM batched
        GROUP BY grp, batch
      )
      SELECT
        b.id,
        r.batch_rank = 1 AS keep,
        ROW_NUMBER() OVER (
          PARTITION BY b.grp, b.batch
          ORDER BY b.trade_price NULLS FIRST, b.net_value_trade_currency NULLS FIRST, b.id
        ) AS occurrence
      FROM batched b
      JOIN ranked_batches r USING (grp, batch)
    `);

    const deleted = await connection.query(sql.unsafe`
      DELETE FROM accounter_schema.poalim_securities_transactions t
      USING poalim_securities_transactions_dedup_plan p
      WHERE p.id = t.id
        AND NOT p.keep
    `);
    // eslint-disable-next-line no-console
    console.log(`Deleted ${deleted.rowCount} superseded Poalim securities execution row(s).`);

    await connection.query(sql.unsafe`
      UPDATE accounter_schema.poalim_securities_transactions t
      SET occurrence = p.occurrence
      FROM poalim_securities_transactions_dedup_plan p
      WHERE p.id = t.id
        AND p.keep
        AND p.occurrence <> 1
    `);

    await connection.query(sql.unsafe`
      DROP INDEX IF EXISTS accounter_schema.poalim_securities_transactions_dedup_uindex
    `);

    // value_date, settlement_date, trade_price and net_value_trade_currency are deliberately out:
    // the bank restates them as an execution settles, and a key that moves is no key. What is left
    // is fixed at execution time; `occurrence` separates executions that agree on all of it.
    // NULLS NOT DISTINCT because the corporate-action columns are null for plain buy/sell rows.
    await connection.query(sql.unsafe`
      CREATE UNIQUE INDEX poalim_securities_transactions_dedup_uindex
        ON accounter_schema.poalim_securities_transactions (
          owner_id,
          bank_number,
          branch_number,
          account_number,
          security,
          trade_date,
          trade_type,
          transaction_type,
          nv,
          payment_type,
          payment_date,
          ex_date,
          cancel_date,
          occurrence
        )
        NULLS NOT DISTINCT
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.poalim_securities_transactions FORCE ROW LEVEL SECURITY
    `);
  },
} satisfies MigrationExecutor;
