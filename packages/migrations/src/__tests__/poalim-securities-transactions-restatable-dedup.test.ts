import { createPool, sql, type DatabasePool } from 'slonik';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import z from 'zod';
import restatableDedup from '../actions/2026-10-15T14-00-00.poalim-securities-transactions-restatable-dedup.js';
import { createConnectionString } from '../connection-string.js';
import { env } from '../environment.js';
import { assertLocalDatabase } from '../local-db-guard.js';
import { runMigrations } from '../pg-migrator.js';
import { MIGRATIONS } from '../run-pg-migrations.js';

const TEST_DB_NAME = `accounter_migration_test_securities_dedup_${Date.now()}`;
const OWNER_ID = '00000000-0000-4000-8000-0000000000aa';

/** The migration before the one under test: duplicates are seeded into the schema it leaves. */
const PREVIOUS_MIGRATION = MIGRATIONS[MIGRATIONS.indexOf(restatableDedup) - 1]!.name;

/** uuidv7 with the given millisecond timestamp — what a scrape at that moment would have minted. */
function uuidv7At(ms: number, suffix: number) {
  const hex = ms.toString(16).padStart(12, '0');
  const tail = suffix.toString(16).padStart(12, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7000-8000-${tail}`;
}

describe('poalim securities transactions restatable dedup migration', () => {
  let rootPool: DatabasePool;
  let testPool: DatabasePool;

  const day1 = Date.parse('2026-01-05T06:00:00Z');
  const day2 = Date.parse('2026-01-06T06:00:00Z');

  // Synthetic rows only. Each case is one loose-key group (same account, security, trade date,
  // direction and size).
  const rows = [
    // Restated between scrapes: the price was fixed and the value date moved. Newer survives.
    { id: uuidv7At(day1, 1), security: 'FUND', value: '2026-01-05', price: 100, last: '2026-01-01' },
    { id: uuidv7At(day2, 2), security: 'FUND', value: '2026-01-06', price: 100.2, last: '2026-01-06' },
    // Two genuine executions from one scrape: both survive, numbered by price.
    { id: uuidv7At(day1, 3), security: 'STOCK', value: '2026-01-07', price: 51, last: null },
    { id: uuidv7At(day1 + 10, 4), security: 'STOCK', value: '2026-01-07', price: 50, last: null },
    // Pre-uuidv7 restatement with an unchanged value date: last_tranaction_date decides.
    {
      id: '00000000-0000-4000-8000-000000000005',
      security: 'OLD',
      value: '2026-01-06',
      price: 10.2,
      last: '2026-01-06',
    },
    {
      id: '00000000-0000-4000-8000-000000000006',
      security: 'OLD',
      value: '2026-01-06',
      price: 10.1,
      last: '2025-12-20',
    },
    // Alone in its group: untouched.
    { id: uuidv7At(day1, 7), security: 'SOLO', value: '2026-01-05', price: 7, last: null },
  ];

  beforeAll(async () => {
    assertLocalDatabase({ ...env.postgres }, 'the securities dedup migration suite');

    rootPool = await createPool(createConnectionString({ ...env.postgres, db: 'postgres' }), {
      statementTimeout: 5000,
    });
    await rootPool.query(sql.unsafe`CREATE DATABASE ${sql.identifier([TEST_DB_NAME])}`);
    testPool = await createPool(createConnectionString({ ...env.postgres, db: TEST_DB_NAME }), {
      statementTimeout: 60_000,
    });

    await runMigrations({ slonik: testPool, migrations: [...MIGRATIONS], runTo: PREVIOUS_MIGRATION });

    await testPool.transaction(async connection => {
      // Bypass the owner FK (no business fixture needed) and the tenant RLS policy.
      await connection.query(sql.unsafe`SET LOCAL session_replication_role = replica`);
      await connection.query(sql.unsafe`
        ALTER TABLE accounter_schema.poalim_securities_transactions NO FORCE ROW LEVEL SECURITY
      `);
      for (const row of rows) {
        await connection.query(sql.unsafe`
          INSERT INTO accounter_schema.poalim_securities_transactions (
            id, owner_id, bank_number, branch_number, account_number, security, trade_date,
            value_date, settlement_date, trade_type, transaction_type, nv, trade_price,
            net_value_trade_currency, last_tranaction_date
          ) VALUES (
            ${row.id}, ${OWNER_ID}, 12, 615, 100000, ${row.security}, '2026-01-05',
            ${row.value}, ${row.value}, 'קניה', 'קניה', 10, ${row.price},
            ${-10 * row.price}, ${row.last}
          )
        `);
      }
      await connection.query(sql.unsafe`
        ALTER TABLE accounter_schema.poalim_securities_transactions FORCE ROW LEVEL SECURITY
      `);
    });

    await runMigrations({ slonik: testPool, migrations: [...MIGRATIONS] });
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

  async function survivors() {
    return testPool.transaction(async connection => {
      // Superuser sessions bypass RLS, but be explicit about not depending on a tenant context.
      await connection.query(sql.unsafe`SET LOCAL row_security = off`);
      return connection.any(
        sql.type(z.object({ id: z.string(), security: z.string(), occurrence: z.number() }))`
          SELECT id, security, occurrence
          FROM accounter_schema.poalim_securities_transactions
          ORDER BY security, occurrence
        `,
      );
    });
  }

  it('keeps the freshest row of a restated execution and numbers same-scrape executions', async () => {
    expect(await survivors()).toEqual([
      { id: rows[1]!.id, security: 'FUND', occurrence: 1 },
      { id: rows[4]!.id, security: 'OLD', occurrence: 1 },
      { id: rows[6]!.id, security: 'SOLO', occurrence: 1 },
      { id: rows[3]!.id, security: 'STOCK', occurrence: 1 },
      { id: rows[2]!.id, security: 'STOCK', occurrence: 2 },
    ]);
  });

  it('rejects a second row for the same execution under the new key', async () => {
    await expect(
      testPool.transaction(async connection => {
        await connection.query(sql.unsafe`SET LOCAL session_replication_role = replica`);
        await connection.query(sql.unsafe`SET LOCAL row_security = off`);
        await connection.query(sql.unsafe`
          INSERT INTO accounter_schema.poalim_securities_transactions (
            owner_id, bank_number, branch_number, account_number, security, trade_date,
            value_date, trade_type, transaction_type, nv, trade_price
          ) VALUES (
            ${OWNER_ID}, 12, 615, 100000, 'FUND', '2026-01-05',
            '2026-01-09', 'קניה', 'קניה', 10, 100.4
          )
        `);
      }),
    ).rejects.toMatchObject({ constraint: 'poalim_securities_transactions_dedup_uindex' });
  });
});
