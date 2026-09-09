import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Switch every `DEFAULT gen_random_uuid()` column in `accounter_schema` to
 * PostgreSQL 18's `uuidv7()`.
 *
 * ## Why
 *
 * `gen_random_uuid()` produces v4 uuids — uniformly random, so consecutive
 * inserts land in unrelated pages of the primary-key B-tree. That means page
 * splits, a working set that is effectively the whole index rather than its
 * right-hand edge, and more full-page images in WAL. `uuidv7()` puts a
 * millisecond timestamp in the high bits, so inserts append instead of scatter.
 *
 * The append-heavy tables are the ones that matter here: `charges`,
 * `transactions`, `documents`, `ledger_records`, and every scraper raw table.
 *
 * No backfill and no table rewrite: this only changes what the server generates
 * for rows inserted from now on. Existing v4 ids stay exactly as they are, and a
 * column holding a mix of v4 and v7 values is perfectly well-formed — both are
 * 128-bit uuids, comparison and indexing are byte-wise, and nothing in the schema
 * or the application parses a version nibble out of an id.
 *
 * ## Scope
 *
 * Every column in `accounter_schema` whose default is exactly
 * `gen_random_uuid()`: the `id` of each table, plus `business_users.user_id`. In
 * a database built from this repo's migration history at this commit that is 49
 * columns, all `relkind = 'r'`, all in `accounter_schema` — counted from the
 * catalog after running the full migration set into an empty database. (#4364's
 * audit says 50; the count is not load-bearing either way, which is the point of
 * discovering the columns from `pg_attrdef` rather than listing them here. An
 * environment that is behind, or a table added between this being written and
 * being deployed, converts the same way.) The `DEFAULT` is the whole of id
 * generation for these tables; no server code calls `gen_random_uuid()`
 * (verified by grep across `packages/`).
 *
 * ## What this deliberately does not touch
 *
 * - `shared/helpers/deterministic-uuid.ts` (uuid v5), used by
 *   `entity-ensure.provider.ts`. Its determinism *is* the idempotency mechanism
 *   behind `ON CONFLICT (id) DO NOTHING` during ingestion — a time-ordered id
 *   would be different on every run and re-insert every row. It is also
 *   app-side, so a column default cannot reach it anyway.
 * - The other app-side `randomUUID()` callers —
 *   `auth/providers/invitations.provider.ts`,
 *   `email-ingestion-control.provider.ts` (`jti`) and
 *   `email-ingestion-ingest.provider.ts`. Low volume, and again not reachable
 *   from a column default. Worth revisiting on their own merits, not here.
 * - Secrets. No uuid-defaulted column is one: `invitations.token` and
 *   `api_keys.key_hash` are `TEXT` filled by the application from
 *   `node:crypto`, and `email_ingestion_replay_nonces.nonce` is `TEXT` too. This
 *   matters because the trade-off below would be a real problem for a
 *   capability token.
 *
 * ## The trade-off
 *
 * A v7 id is not opaque about when its row was created: the first 48 bits are a
 * Unix millisecond timestamp, readable by anyone holding the id. Ids also become
 * roughly ordered, so two ids reveal which row came first, and neighbouring ids
 * become guessable in a way v4 ids are not. For internal accounting ids behind
 * authentication and RLS that is acceptable — every one of these tables already
 * carries a `created_at`, and none of them relies on id unguessability for
 * access control. It is still a deliberate choice rather than a free win: a
 * future column that needs an id to be non-revealing or unguessable should be
 * declared `DEFAULT gen_random_uuid()` explicitly and added to the exemption
 * list in `uuidv7-id-defaults.test.ts`.
 *
 * ## Reverting
 *
 * `MigrationExecutor` has no `down` hook — the migrator is forward-only and no
 * migration in this repo ships one — so the inverse is written out here instead
 * of being executable. It is the same loop with the two function names swapped:
 * match `'uuidv7()'` and `SET DEFAULT gen_random_uuid()`. Safe to run at any
 * time, precisely because both id versions coexist happily in one column.
 * Verified by running the loop and its inverse against a database built from the
 * full migration history: 49 columns out, 49 back.
 *
 * Plain catalog-driven DDL, fast (a `pg_attrdef` row rewrite per column, no
 * table access), and idempotent: re-running finds nothing left to convert. Runs
 * in the default per-migration transaction, so either every column flips or none
 * does.
 */
export default {
  name: '2026-09-09T10-00-00.uuidv7-id-defaults.sql',
  run: async ({ connection }) => {
    // `uuidv7()` is PG18+. Without this the failure is a bare "function uuidv7()
    // does not exist" from the first ALTER, which is a confusing way to learn
    // that the server predates the upgrade in #4363.
    await connection.query(sql.unsafe`
      DO $$
      BEGIN
        IF current_setting('server_version_num')::int < 180000 THEN
          RAISE EXCEPTION
            'uuidv7() requires PostgreSQL 18 or newer; this server is %',
            current_setting('server_version');
        END IF;
      END
      $$;
    `);

    await connection.query(sql.unsafe`
      DO $$
      DECLARE
        target record;
      BEGIN
        FOR target IN
          SELECT c.relname AS table_name, a.attname AS column_name
          FROM pg_catalog.pg_attribute a
          JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_catalog.pg_attrdef d
            ON d.adrelid = a.attrelid
           AND d.adnum = a.attnum
          WHERE n.nspname = 'accounter_schema'
            -- Ordinary and partitioned tables. A partitioned table's default is
            -- what an insert through the parent uses, so it is the one to set.
            AND c.relkind IN ('r', 'p')
            AND NOT a.attisdropped
            AND a.atttypid = 'uuid'::regtype
            AND pg_catalog.pg_get_expr(d.adbin, d.adrelid) = 'gen_random_uuid()'
          ORDER BY c.relname, a.attname
        LOOP
          EXECUTE format(
            'ALTER TABLE accounter_schema.%I ALTER COLUMN %I SET DEFAULT uuidv7()',
            target.table_name,
            target.column_name
          );
        END LOOP;
      END
      $$;
    `);
  },
} satisfies MigrationExecutor;
