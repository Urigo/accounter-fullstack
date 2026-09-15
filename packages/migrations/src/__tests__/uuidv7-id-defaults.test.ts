import { createPool, sql, type DatabasePool } from 'slonik';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import z from 'zod';
import { createConnectionString } from '../connection-string.js';
import { env } from '../environment.js';
import { assertLocalDatabase } from '../local-db-guard.js';
import { runPGMigrations } from '../run-pg-migrations.js';

const TEST_DB_NAME = `accounter_migration_test_uuidv7_${Date.now()}`;

/**
 * Columns in `accounter_schema` that are deliberately left on `gen_random_uuid()`.
 *
 * Empty today, and that is the point: an entry here is a column whose id must stay
 * opaque about creation time and unguessable from a neighbouring id — the one
 * property `uuidv7()` gives up. The migration itself runs once and is recorded, so
 * a column added after it with `DEFAULT gen_random_uuid()` keeps that default; this
 * set is what says whether that was deliberate. Add to it as `table.column`, and
 * only alongside the reason.
 */
const UUIDV7_EXEMPT_COLUMNS = new Set<string>([]);

/**
 * The append-heavy tables named in the issue. Asserted by name so a future schema
 * edit that quietly reverts one of them fails here rather than in a slow index.
 */
const HOT_TABLES = ['charges', 'transactions', 'documents', 'ledger_records'];

describe('uuidv7 id defaults migration', () => {
  let rootPool: DatabasePool;
  let testPool: DatabasePool;

  beforeAll(async () => {
    // This suite CREATEs and DROPs a database and runs every migration into it, so it
    // must never be pointed at a deployed server. Same guard, same reasoning as
    // `rls-all-tables.test.ts`.
    assertLocalDatabase({ ...env.postgres }, 'the uuidv7 id defaults migration suite');

    rootPool = await createPool(createConnectionString({ ...env.postgres, db: 'postgres' }), {
      statementTimeout: 5000,
    });

    await rootPool.query(sql.unsafe`CREATE DATABASE ${sql.identifier([TEST_DB_NAME])}`);

    testPool = await createPool(createConnectionString({ ...env.postgres, db: TEST_DB_NAME }), {
      statementTimeout: 60_000,
    });

    await runPGMigrations({ slonik: testPool });
  }, 180_000);

  afterAll(async () => {
    if (testPool) {
      await testPool.end();
    }
    if (rootPool) {
      try {
        await rootPool.query(sql.unsafe`
          SELECT pg_terminate_backend(pg_stat_activity.pid)
          FROM pg_stat_activity
          WHERE pg_stat_activity.datname = ${TEST_DB_NAME}
            AND pid <> pg_backend_pid();
        `);
        await rootPool.query(sql.unsafe`DROP DATABASE IF EXISTS ${sql.identifier([TEST_DB_NAME])}`);
      } catch (e) {
        console.error('Failed to cleanup test database', e);
      }
      await rootPool.end();
    }
  });

  /** Every uuid column in `accounter_schema` that carries a column default. */
  async function uuidDefaults() {
    return testPool.any(
      sql.type(
        z.object({
          table_name: z.string(),
          column_name: z.string(),
          default_expr: z.string(),
        }),
      )`
        SELECT
          c.relname AS table_name,
          a.attname AS column_name,
          pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_expr
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_attrdef d
          ON d.adrelid = a.attrelid
         AND d.adnum = a.attnum
        WHERE n.nspname = 'accounter_schema'
          AND c.relkind IN ('r', 'p')
          AND NOT a.attisdropped
          AND a.atttypid = 'uuid'::regtype
        ORDER BY c.relname, a.attname
      `,
    );
  }

  it('leaves no uuid column defaulting to gen_random_uuid()', async () => {
    const rows = await uuidDefaults();

    // Guard against the catalog query silently matching nothing — otherwise a broken
    // join would make the assertion below pass vacuously.
    expect(rows.length).toBeGreaterThan(0);

    const stragglers = rows
      .filter(r => r.default_expr === 'gen_random_uuid()')
      .filter(r => !UUIDV7_EXEMPT_COLUMNS.has(`${r.table_name}.${r.column_name}`))
      .map(r => `${r.table_name}.${r.column_name}`);

    expect(stragglers).toEqual([]);
  }, 30_000);

  it('converts the append-heavy tables named in the issue', async () => {
    const rows = await uuidDefaults();
    const byKey = new Map(rows.map(r => [`${r.table_name}.${r.column_name}`, r.default_expr]));

    for (const table of HOT_TABLES) {
      expect(byKey.get(`${table}.id`)).toBe('uuidv7()');
    }

    // `business_users.user_id` is the one converted column that is not named `id`;
    // asserted explicitly so a narrowing of the migration's catalog filter is caught.
    expect(byKey.get('business_users.user_id')).toBe('uuidv7()');
  }, 30_000);

  it('generates time-ordered version-7 ids for new rows', async () => {
    // `audit_logs` is the cheapest converted table to insert into: `action` is its only
    // NOT NULL column beyond the defaulted `id` and `created_at`, its `business_id` FK is
    // nullable so no fixture rows are needed, and it carries no `owner_id` and therefore
    // no RLS policy to work around.
    const before = Date.now();
    const { id } = await testPool.one(
      sql.type(z.object({ id: z.string() }))`
        INSERT INTO accounter_schema.audit_logs (action)
        VALUES ('uuidv7-default-test')
        RETURNING id
      `,
    );

    // The version nibble is the first character of the third dash-separated group.
    expect(id.split('-')[2]?.[0]).toBe('7');

    // The leading 48 bits of a v7 uuid are a Unix millisecond timestamp. Reading them
    // back is what actually distinguishes v7 from "a v4 with a 7 in the right place",
    // and it is the property the whole change rests on: ids that sort by creation time
    // append to the right-hand edge of the index instead of scattering.
    const embeddedMs = Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16);
    expect(embeddedMs).toBeGreaterThanOrEqual(before - 60_000);
    expect(embeddedMs).toBeLessThanOrEqual(Date.now() + 60_000);
  }, 30_000);

  it('accepts pre-existing v4 ids alongside the new default', async () => {
    // No backfill happens, so both versions have to coexist in one column forever.
    // Cheap to state, and it is the assumption the "no rewrite" claim rests on.
    const { id } = await testPool.one(
      sql.type(z.object({ id: z.string() }))`
        INSERT INTO accounter_schema.audit_logs (id, action)
        VALUES (gen_random_uuid(), 'uuidv7-coexistence-test')
        RETURNING id
      `,
    );

    expect(id.split('-')[2]?.[0]).toBe('4');
  }, 30_000);
});
