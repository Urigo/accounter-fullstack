import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { TestDatabase } from './helpers/db-setup.js';
import { dropRlsRole, ensureRlsRole, runAsRlsRole } from './helpers/rls-role.js';

/**
 * Two-tenant read-visibility coverage for `accounter_schema.salaries`.
 *
 * `salaries` is listed in every RLS migration that built the current tenant
 * isolation setup, but nothing asserted that the resulting policy actually
 * filters rows: the table's read queries carry no `owner_id` predicate of their
 * own (`SELECT * FROM accounter_schema.salaries` and the two month-range
 * variants in `modules/salaries/providers/salaries.provider.ts`), so the policy
 * is the only thing standing between tenant A and tenant B's payroll. A table
 * whose RLS flags were cleared -- `relrowsecurity` / `relforcerowsecurity` are
 * per-table catalog flags that drift independently of the policy objects -- would
 * keep every one of those queries working while silently returning both tenants'
 * rows.
 *
 * The stakes are not only disclosure. `ledger/helpers/vacation-reserve.helper.ts`
 * and `recovery-reserve.helper.ts` both read salaries over a deliberately
 * unbounded range (`fromDate: '2000-01'`) to compute reserve balances, so an
 * unfiltered read does not merely expose another tenant's salaries, it sums them
 * into this tenant's financial figures.
 *
 * Companion to `rls-read-visibility.integration.test.ts` (which covers the same
 * `USING` predicate over `sort_codes`); the structure is deliberately parallel.
 * The test pool connects as postgres (BYPASSRLS), so each SELECT-under-test runs
 * under a non-superuser role via `runAsRlsRole` -- without that privilege drop the
 * assertions would pass against a table with no RLS at all and prove nothing.
 */

// File-local tenant ids so this suite can run alongside the other RLS suites
// against the same database without interfering.
const A = '5a1a0000-0000-4000-8000-00000000000a';
const B = '5a1a0000-0000-4000-8000-00000000000b';

// Each tenant's employee is itself a business row (employees.business_id is an FK
// to businesses.id, and salaries.employee_id is an FK to employees.business_id).
const EMPLOYEE_A = '5a1a0000-0000-4000-8000-0000000000ea';
const EMPLOYEE_B = '5a1a0000-0000-4000-8000-0000000000eb';

const MONTH = '2020-01';

const GRANTS = [{ table: 'salaries', privileges: 'SELECT' }];

/** Salary rows visible under the current RLS context, read as the non-superuser role. */
async function visibleSalaryOwners(client: PoolClient): Promise<string[]> {
  return runAsRlsRole(client, async () => {
    // Deliberately mirrors the provider's unscoped reads: no owner_id predicate,
    // so RLS is the only filter under test. The employee_id restriction keeps the
    // result confined to this suite's fixtures without scoping by tenant.
    const res = await client.query<{ owner_id: string }>(
      `SELECT owner_id FROM accounter_schema.salaries
       WHERE employee_id IN ($1, $2)
       ORDER BY owner_id`,
      [EMPLOYEE_A, EMPLOYEE_B],
    );
    return res.rows.map(r => r.owner_id);
  });
}

describe('RLS read visibility: salaries are scoped to the tenant', () => {
  let db: TestDatabase;
  let pool: Pool;

  beforeAll(async () => {
    db = new TestDatabase();
    pool = await db.connect();

    await ensureRlsRole(pool, { grants: GRANTS });

    const setup = await pool.connect();
    try {
      await setup.query('BEGIN');

      for (const [tenant, employee] of [
        [A, EMPLOYEE_A],
        [B, EMPLOYEE_B],
      ] as const) {
        // Every INSERT below is checked against `WITH CHECK (owner_id =
        // get_current_business_id())`, so the write target has to be the tenant
        // being created.
        await setup.query(`SELECT set_config('app.current_business_id', $1, true)`, [tenant]);

        // The tenant business, self-owned. financial_entities goes in first with a
        // NULL owner because businesses.id is an FK to it and the business cannot
        // own itself before it exists.
        await setup.query(
          `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
           VALUES ($1, $2, 'business', NULL)
           ON CONFLICT (id) DO NOTHING`,
          [tenant, `rls-salaries-${tenant}`],
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

        // The employee's own business entity, owned by the tenant.
        await setup.query(
          `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
           VALUES ($1, $2, 'business', $3)
           ON CONFLICT (id) DO NOTHING`,
          [employee, `rls-salaries-employee-${employee}`, tenant],
        );
        await setup.query(
          `INSERT INTO accounter_schema.businesses (id, country, owner_id)
           VALUES ($1, 'ISR', $2)
           ON CONFLICT (id) DO NOTHING`,
          [employee, tenant],
        );
        await setup.query(
          `INSERT INTO accounter_schema.employees (business_id, owner_id, employer, start_work_date)
           VALUES ($1, $2, $2, '2020-01-01')
           ON CONFLICT (business_id) DO NOTHING`,
          [employee, tenant],
        );

        await setup.query(
          `INSERT INTO accounter_schema.salaries
             (month, employee_id, owner_id, employer, direct_payment_amount)
           VALUES ($1, $2, $3, $3, 1000)
           ON CONFLICT (month, employee_id) DO NOTHING`,
          [MONTH, employee, tenant],
        );
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
      await teardown.query(`DELETE FROM accounter_schema.salaries WHERE employee_id IN ($1, $2)`, [
        EMPLOYEE_A,
        EMPLOYEE_B,
      ]);
      await teardown.query(`DELETE FROM accounter_schema.employees WHERE business_id IN ($1, $2)`, [
        EMPLOYEE_A,
        EMPLOYEE_B,
      ]);
      await teardown.query(
        `UPDATE accounter_schema.financial_entities SET owner_id = NULL
         WHERE id IN ($1, $2, $3, $4)`,
        [A, B, EMPLOYEE_A, EMPLOYEE_B],
      );
      await teardown.query(`DELETE FROM accounter_schema.businesses WHERE id IN ($1, $2, $3, $4)`, [
        EMPLOYEE_A,
        EMPLOYEE_B,
        A,
        B,
      ]);
      await teardown.query(
        `DELETE FROM accounter_schema.financial_entities WHERE id IN ($1, $2, $3, $4)`,
        [EMPLOYEE_A, EMPLOYEE_B, A, B],
      );
      await teardown.query('RESET row_security');
    } finally {
      teardown.release();
    }
    await dropRlsRole(pool);
    // Pool managed by global vitest setup -- do not close here.
  });

  // The assertion that would have caught an unprotected salaries table: with RLS
  // off, an unscoped SELECT returns both tenants' rows and this fails.
  test('tenant A cannot see tenant B’s salary rows', async () => {
    await db.withTransaction(async client => {
      await client.query(
        `SELECT set_config('app.current_business_id', $1, true),
                set_config('app.current_business_scope', $2, true)`,
        [A, `{${A}}`],
      );
      expect(await visibleSalaryOwners(client)).toEqual([A]);
    });
  });

  test('tenant B cannot see tenant A’s salary rows', async () => {
    await db.withTransaction(async client => {
      await client.query(
        `SELECT set_config('app.current_business_id', $1, true),
                set_config('app.current_business_scope', $2, true)`,
        [B, `{${B}}`],
      );
      expect(await visibleSalaryOwners(client)).toEqual([B]);
    });
  });

  test('a scope spanning both businesses sees both tenants’ salary rows', async () => {
    await db.withTransaction(async client => {
      await client.query(
        `SELECT set_config('app.current_business_id', $1, true),
                set_config('app.current_business_scope', $2, true)`,
        [A, `{${A},${B}}`],
      );
      expect(await visibleSalaryOwners(client)).toEqual([A, B].sort());
    });
  });

  test('an unset scope falls back to the single business context, hiding B', async () => {
    await db.withTransaction(async client => {
      // Scope unset -> get_current_business_scope() returns [current_business_id].
      await client.query(
        `SELECT set_config('app.current_business_id', $1, true),
                set_config('app.current_business_scope', '', true)`,
        [A],
      );
      expect(await visibleSalaryOwners(client)).toEqual([A]);
    });
  });
});
