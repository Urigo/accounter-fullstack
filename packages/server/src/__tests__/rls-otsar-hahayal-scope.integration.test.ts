import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { TestDatabase } from './helpers/db-setup.js';
import { dropRlsRole, ensureRlsRole, runAsRlsRole } from './helpers/rls-role.js';

/**
 * Read scope and write target on the Otsar Hahayal raw tables.
 *
 * `2026-11-14T12-00-00.rls-scope-otsar-hahayal-tables.sql` moved their reads from the single
 * write-target business to the request's authorized scope, and added the two RESTRICTIVE
 * policies that keep UPDATE and DELETE on the write target. Each half is asserted here for each
 * of the three tables:
 *
 * - reads follow the scope: a request spanning two businesses sees both businesses' raw rows.
 *   Before the migration it saw one, silently — which is what dropped Otsar Hahayal balances
 *   for every business in a multi-business scope but the current one.
 * - writes do not: a row of another in-scope business can be read but neither updated nor
 *   deleted. Without the restrictive policies the widened `USING` would allow both.
 *
 * Structure follows `rls-salaries-visibility.integration.test.ts`. The test pool connects as
 * postgres (BYPASSRLS), so every statement under test runs through `runAsRlsRole`; without that
 * privilege drop the assertions would pass against a table with no RLS at all.
 */

// File-local tenant ids so this suite can run alongside the other RLS suites.
const A = '07a50000-0000-4000-8000-00000000000a';
const B = '07a50000-0000-4000-8000-00000000000b';

interface RawTable {
  name: string;
  /** Row ids, one per tenant. */
  rows: Record<typeof A | typeof B, string>;
  /** A free-text column the UPDATE under test rewrites. */
  textColumn: string;
  /** Inserts one row with the given id and owner; `$3` is a per-row discriminator. */
  insert: string;
}

const TABLES: RawTable[] = [
  {
    name: 'otsar_hahayal_ils_account_transactions',
    rows: {
      [A]: '07a50000-0000-4000-8000-0000000001a0',
      [B]: '07a50000-0000-4000-8000-0000000001b0',
    },
    textColumn: 'name',
    insert: `INSERT INTO accounter_schema.otsar_hahayal_ils_account_transactions (
               id, owner_id, account_number, account_type, branch_number, action_code, bfb_source,
               closing_balance, correspondent_account, correspondent_account_type,
               correspondent_bank, correspondent_branch, credit_amount, customer_name,
               date_of_business_day, date_of_registration, debit_amount, depositor_id,
               description, drill_down_url, first_transaction_of_day, last_transaction_of_day,
               name, opening_balance, operation_source, reference, salary_ind,
               transaction_source, transaction_reason, origin_reference)
             VALUES ($1, $2, 997501, 1, 1, 0, '77', 100, 0, 0, 0, 0, 0, 'rls-test',
               '2020-01-01', '2020-01-01', 0, 0, 'rls-test', '', true, true, 'rls-test', 0,
               'rls-test', $3::int, 0, 'rls-test', 'rls-test', 'rls-otsar-scope')`,
  },
  {
    name: 'otsar_hahayal_foreign_account_transactions',
    rows: {
      [A]: '07a50000-0000-4000-8000-0000000002a0',
      [B]: '07a50000-0000-4000-8000-0000000002b0',
    },
    textColumn: 'account_type',
    insert: `INSERT INTO accounter_schema.otsar_hahayal_foreign_account_transactions (
               id, owner_id, account, branch, account_type, currency, opening_balance, balance,
               value_date, credit, debit, description, reference, date)
             VALUES ($1, $2, 997501, 1, 'rls-test', 'USD', 0, 100, '2020-01-01', 0, 0,
               'rls-otsar-scope', $3::text, '2020-01-01')`,
  },
  {
    name: 'otsar_hahayal_creditcard_transactions',
    rows: {
      [A]: '07a50000-0000-4000-8000-0000000003a0',
      [B]: '07a50000-0000-4000-8000-0000000003b0',
    },
    textColumn: 'masked_pan',
    insert: `INSERT INTO accounter_schema.otsar_hahayal_creditcard_transactions (
               id, owner_id, resource_id, masked_pan, card_type, billing_period, date,
               charge_date, name, deal_amount, charge_amount, notes, wallet_type,
               charge_currency, deal_currency, counter)
             VALUES ($1, $2, '07a50000-0000-4000-8000-0000000003ff', 'rls-test', 1, '2020-01',
               '2020-01-01', '2020-01-01', 'rls-otsar-scope', 1, 1, '', 0, 'ILS', 'ILS',
               $3::int)`,
  },
];

const GRANTS = TABLES.map(table => ({ table: table.name, privileges: 'SELECT, UPDATE, DELETE' }));

/** Set the RLS context the way `TenantAwareDBClient.setRLSVariables` does. */
async function setContext(client: PoolClient, writeTarget: string, scope: string[] | null) {
  await client.query(
    `SELECT set_config('app.current_business_id', $1, true),
            set_config('app.current_business_scope', $2, true)`,
    [writeTarget, scope ? `{${scope.join(',')}}` : ''],
  );
}

const fixtureIds = (table: RawTable) => [table.rows[A], table.rows[B]];

/** Owners of this suite's rows that are visible under the current RLS context. */
async function visibleOwners(client: PoolClient, table: RawTable): Promise<string[]> {
  return runAsRlsRole(client, async () => {
    const res = await client.query<{ owner_id: string }>(
      `SELECT owner_id FROM accounter_schema.${table.name}
       WHERE id = ANY($1::uuid[]) ORDER BY owner_id`,
      [fixtureIds(table)],
    );
    return res.rows.map(r => r.owner_id);
  });
}

/** Rows an UPDATE of `rowId` touched under the current RLS context. */
async function updatedRows(client: PoolClient, table: RawTable, rowId: string): Promise<number> {
  return runAsRlsRole(client, async () => {
    const res = await client.query(
      `UPDATE accounter_schema.${table.name} SET ${table.textColumn} = 'rls-updated' WHERE id = $1`,
      [rowId],
    );
    return res.rowCount ?? 0;
  });
}

/** Rows a DELETE of `rowId` removed under the current RLS context. */
async function deletedRows(client: PoolClient, table: RawTable, rowId: string): Promise<number> {
  return runAsRlsRole(client, async () => {
    const res = await client.query(`DELETE FROM accounter_schema.${table.name} WHERE id = $1`, [
      rowId,
    ]);
    return res.rowCount ?? 0;
  });
}

describe('RLS on the Otsar Hahayal raw tables: reads follow the scope, writes the target', () => {
  let db: TestDatabase;
  let pool: Pool;

  beforeAll(async () => {
    db = new TestDatabase();
    pool = await db.connect();

    await ensureRlsRole(pool, { grants: GRANTS });

    const setup = await pool.connect();
    try {
      await setup.query('BEGIN');

      for (const tenant of [A, B]) {
        // The tenant business, self-owned. financial_entities goes in first with a NULL owner
        // because businesses.id is an FK to it and the business cannot own itself before it
        // exists. This connection is postgres (BYPASSRLS), so the fixtures are not
        // policy-checked; enforcement is exercised only in the tests, via `runAsRlsRole`.
        await setup.query(
          `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
           VALUES ($1, $2, 'business', NULL)
           ON CONFLICT (id) DO NOTHING`,
          [tenant, `rls-otsar-${tenant}`],
        );
        await setup.query(
          `INSERT INTO accounter_schema.businesses (id, country, owner_id)
           VALUES ($1, 'ISR', $1)
           ON CONFLICT (id) DO NOTHING`,
          [tenant],
        );
        await setup.query(
          `UPDATE accounter_schema.financial_entities SET owner_id = $1 WHERE id = $1`,
          [tenant],
        );
      }

      // The raw tables' insert triggers derive a charge and a transaction from each row and
      // need a matching financial account to do it. None of that is under test, so the
      // triggers are skipped for the fixture rows only.
      await setup.query(`SET LOCAL session_replication_role = replica`);
      for (const table of TABLES) {
        for (const [index, tenant] of [A, B].entries()) {
          await setup.query(`DELETE FROM accounter_schema.${table.name} WHERE id = $1`, [
            table.rows[tenant as typeof A],
          ]);
          await setup.query(table.insert, [table.rows[tenant as typeof A], tenant, index + 1]);
        }
      }

      await setup.query('COMMIT');
    } catch (e) {
      try {
        await setup.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw e;
    } finally {
      setup.release();
    }
  });

  afterAll(async () => {
    if (!pool) return;
    const teardown = await pool.connect();
    try {
      // Teardown deletes across both tenants, which no single RLS context permits.
      await teardown.query('SET row_security = off');
      for (const table of TABLES) {
        await teardown.query(
          `DELETE FROM accounter_schema.${table.name} WHERE id = ANY($1::uuid[])`,
          [fixtureIds(table)],
        );
      }
      await teardown.query(
        `UPDATE accounter_schema.financial_entities SET owner_id = NULL WHERE id IN ($1, $2)`,
        [A, B],
      );
      await teardown.query(`DELETE FROM accounter_schema.businesses WHERE id IN ($1, $2)`, [A, B]);
      await teardown.query(
        `DELETE FROM accounter_schema.financial_entities WHERE id IN ($1, $2)`,
        [A, B],
      );
      await teardown.query('RESET row_security');
    } finally {
      teardown.release();
    }
    await dropRlsRole(pool);
    // Pool managed by global vitest setup -- do not close here.
  });

  describe.each(TABLES)('$name', table => {
    test('a single-business scope sees only that business', async () => {
      await db.withTransaction(async client => {
        await setContext(client, A, [A]);
        expect(await visibleOwners(client, table)).toEqual([A]);
      });
      await db.withTransaction(async client => {
        await setContext(client, B, [B]);
        expect(await visibleOwners(client, table)).toEqual([B]);
      });
    });

    // The assertion the migration exists for: before it, this returned [A].
    test('a scope spanning both businesses sees both businesses’ rows', async () => {
      await db.withTransaction(async client => {
        await setContext(client, A, [A, B]);
        expect(await visibleOwners(client, table)).toEqual([A, B]);
      });
    });

    test('an unset scope falls back to the single business context', async () => {
      await db.withTransaction(async client => {
        await setContext(client, A, null);
        expect(await visibleOwners(client, table)).toEqual([A]);
      });
    });

    test('another in-scope business’s row is readable but cannot be updated', async () => {
      await db.withTransaction(async client => {
        await setContext(client, A, [A, B]);
        expect(await updatedRows(client, table, table.rows[B])).toBe(0);
        // The write target's own row still can be.
        expect(await updatedRows(client, table, table.rows[A])).toBe(1);
      });
    });

    test('another in-scope business’s row is readable but cannot be deleted', async () => {
      await db.withTransaction(async client => {
        await setContext(client, A, [A, B]);
        expect(await deletedRows(client, table, table.rows[B])).toBe(0);
        expect(await visibleOwners(client, table)).toEqual([A, B]);
        // The write target's own row still can be.
        expect(await deletedRows(client, table, table.rows[A])).toBe(1);
      });
    });
  });
});
