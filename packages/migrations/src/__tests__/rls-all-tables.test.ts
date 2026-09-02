import { createPool, DatabasePool, sql } from 'slonik';
import { createConnectionString } from '../connection-string.js';
import { env } from '../environment.js';
import { assertLocalDatabase } from '../local-db-guard.js';
import { runPGMigrations } from '../run-pg-migrations.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import z from 'zod';

const TEST_DB_NAME = `accounter_migration_test_rls_${Date.now()}`;
const TEST_ROLE_NAME = `rls_test_user_${Date.now()}`;

describe('RLS All Tables Migration', () => {
  let rootPool: DatabasePool;
  let testPool: DatabasePool;

  beforeAll(async () => {
    // This suite CREATEs and DROPs a database and runs every migration into it. Against a
    // deployed server that is destructive, so refuse unless explicitly opted in. The
    // postgres-18 runbook does opt in (ALLOW_REMOTE_DB=1) to re-assert RLS on an upgraded
    // PITR-restored server -- that is the one intended non-local use.
    assertLocalDatabase({ ...env.postgres }, 'the RLS all-tables migration suite');

    // 1. Connect to default DB
    const connectionString = createConnectionString({
      ...env.postgres,
      db: 'postgres',
    });
    rootPool = await createPool(connectionString, {
      statementTimeout: 5000,
    });

    // 2. Create test DB
    try {
      await rootPool.query(sql.unsafe`CREATE DATABASE ${sql.identifier([TEST_DB_NAME])}`);
    } catch (e) {
      console.error('Failed to create test database', e);
      throw e;
    }

    // 3. Connect to test DB
    const testConnectionString = createConnectionString({
      ...env.postgres,
      db: TEST_DB_NAME,
    });
    testPool = await createPool(testConnectionString, {
        statementTimeout: 60000,
    });
  }, 30_000);

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

  it('should apply all migrations successfully', async () => {
    await runPGMigrations({ slonik: testPool });

    // Check that the specific RLS migration was recorded
    const migrationResult = await testPool.query(sql.unsafe`
      SELECT 1
      FROM accounter_schema.migration
      WHERE name LIKE '%enable-rls-all-tables%'
      LIMIT 1
    `);

    // Ensure that at least one matching migration entry exists
    expect(migrationResult.rowCount).toBe(1);
  }, 120_000);

  /**
   * Tables that carry an `owner_id` but are deliberately (or, for now, knowingly)
   * left without RLS. Keep this list as short as the truth allows — every entry is
   * a table the invariant below cannot vouch for.
   *
   * - `bank_deposits`: NOT a deliberate exemption. It has a NOT NULL `owner_id`
   *   with an FK to `businesses` and is read unscoped
   *   (`SELECT * FROM accounter_schema.bank_deposits;` in
   *   `packages/server/src/modules/bank-deposits/providers/bank-deposits.provider.ts`),
   *   so it is the same gap this suite exists to catch — it was simply never added
   *   to any of the RLS migration lists (`charges_bank_deposits`, a different
   *   table, is in them, which is how it was missed). Left out of scope of the
   *   salaries fix deliberately rather than silently; removing this entry is the
   *   whole of what closing it requires here.
   */
  const RLS_EXEMPT_OWNER_ID_TABLES = new Set(['bank_deposits']);

  /**
   * The invariant that would have caught a table losing RLS: in `accounter_schema`,
   * carrying an `owner_id` column means being tenant-scoped, and being tenant-scoped
   * means RLS both ENABLED and FORCED plus a `tenant_isolation` policy.
   *
   * ENABLE without FORCE is the failure mode worth naming: `accounter_prod_user`
   * inherits from `prod_group`, which owns these tables, and a table owner is exempt
   * from its own policies unless the table is FORCED. A table in that state looks
   * protected in the catalog and filters nothing for the application.
   *
   * Checked against the catalog rather than a hardcoded table list so a newly added
   * tenant table is covered the day it lands, without anyone remembering to add it.
   */
  it('enforces RLS on every table carrying an owner_id', async () => {
    const rows = await testPool.any(
      sql.type(
        z.object({
          relname: z.string(),
          enabled: z.boolean(),
          forced: z.boolean(),
          policies: z.array(z.string()),
        }),
      )`
        SELECT
          c.relname,
          c.relrowsecurity AS enabled,
          c.relforcerowsecurity AS forced,
          COALESCE(
            (
              SELECT array_agg(p.polname ORDER BY p.polname)
              FROM pg_catalog.pg_policy p
              WHERE p.polrelid = c.oid
            ),
            '{}'::text[]
          ) AS policies
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_attribute a
          ON a.attrelid = c.oid
         AND a.attname = 'owner_id'
         AND NOT a.attisdropped
        WHERE n.nspname = 'accounter_schema'
          AND c.relkind = 'r'
        ORDER BY c.relname
      `,
    );

    // Guard against the query silently matching nothing (a schema or catalog change
    // that breaks the join would otherwise make every assertion below pass
    // vacuously). Deliberately not pinned to the current table count -- the point is
    // that the query returned something, and `salaries` being present is asserted
    // outright just below, so a tighter bound would only break on unrelated schema
    // changes.
    expect(rows.length).toBeGreaterThan(0);

    const covered = rows.filter(r => !RLS_EXEMPT_OWNER_ID_TABLES.has(r.relname));

    // `salaries` is the table this suite was extended for -- assert it explicitly so
    // a future edit to the exemption set cannot quietly drop it from the check.
    expect(covered.map(r => r.relname)).toContain('salaries');

    const unprotected = covered
      .filter(r => !r.enabled || !r.forced)
      .map(r => `${r.relname} (enabled=${r.enabled}, forced=${r.forced})`);
    expect(unprotected).toEqual([]);

    const unpolicied = covered
      .filter(r => !r.policies.includes('tenant_isolation'))
      .map(r => `${r.relname} (policies=[${r.policies.join(', ')}])`);
    expect(unpolicied).toEqual([]);
  }, 30_000);

  it('should enforce RLS on key tables (isolation test)', async () => {
    // Test logic:
    // 1. Insert 2 businesses (as superuser/owner, bypassing RLS via NO context? No, forceful RLS blocks that too unless User is superuser).
    // Note: The test runner connects as database owner, usually superuser or owner of DB.
    // If owner of table, FORCE RLS applies. If superuser, BYPASSRLS usually applies.
    // We'll rely on being superuser in tests to setup data.

    const businessIdA = '11111111-1111-1111-1111-111111111111';
    const businessIdB = '22222222-2222-2222-2222-222222222222';

    // Insert Countries (needed for FK constraint)
    await testPool.query(sql.unsafe`
      INSERT INTO accounter_schema.countries (code, name)
      VALUES ('ISR', 'Israel')
      ON CONFLICT DO NOTHING;
    `);

    // Insert FE with NULL owner first
    await testPool.query(sql.unsafe`
      INSERT INTO accounter_schema.financial_entities (id, name, owner_id, type)
      VALUES 
        (${businessIdA}, 'Business A', NULL, 'business'),
        (${businessIdB}, 'Business B', NULL, 'business');
    `);
    
    // Insert Businesses
    // Note: businesses table MIGHT have RLS enabled and owner_id required/checked?
    // We didn't enable RLS on 'businesses' table yet? 
    // Wait, the migration loop included 'businesses'. 
    // So 'businesses' has RLS. `owner_id = current_business_id`.
    // If we insert with owner_id = ID, and context is not set, it might fail?
    // Actually, migration applies to `businesses`.
    // So we need to handle RLS on `businesses` too.
    // However, if we are superuser (test runner), we bypass RLS UNLESS `FORCE ROW LEVEL SECURITY`.
    // The migration used `FORCE ...`.
    // So we MUST set context to allow insert into `businesses`.
    // But setting context requires a valid business ID? `set_config` just sets a string. It doesn't check validity against DB.
    // So `set_config('app.current_business_id', businessIdA)` works even if businessIdA doesn't exist in DB yet.
    
    await testPool.query(sql.unsafe`
      SELECT set_config('app.current_business_id', ${businessIdA}, false);
    `);
    
    // Insert Business A
    await testPool.query(sql.unsafe`
      INSERT INTO accounter_schema.businesses (id, owner_id)
      VALUES (${businessIdA}, ${businessIdA});
    `);

    // Update FE owner
    await testPool.query(sql.unsafe`
        UPDATE accounter_schema.financial_entities 
        SET owner_id = ${businessIdA}
        WHERE id = ${businessIdA};
    `);

    await testPool.query(sql.unsafe`
      SELECT set_config('app.current_business_id', ${businessIdB}, false);
    `);

    // Insert Business B
    await testPool.query(sql.unsafe`
      INSERT INTO accounter_schema.businesses (id, owner_id)
      VALUES (${businessIdB}, ${businessIdB});
    `);

    // Update FE owner
    await testPool.query(sql.unsafe`
        UPDATE accounter_schema.financial_entities 
        SET owner_id = ${businessIdB}
        WHERE id = ${businessIdB};
    `);

    // ---------------------------------------------------------
    // RLS Verification Setup
    // ---------------------------------------------------------
    
    // Create a non-superuser role to test RLS enforcement.
    // Superusers (like the test runner) bypass RLS by default.
    // DROP OWNED BY has no IF EXISTS, so we check existence first
    const roleExists = await testPool.oneFirst(
      sql.unsafe`SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = ${TEST_ROLE_NAME})`,
    );
    if (roleExists) {
      await testPool.query(
        sql.unsafe`DROP OWNED BY ${sql.identifier([TEST_ROLE_NAME])}`,
      );
      await testPool.query(
        sql.unsafe`DROP ROLE ${sql.identifier([TEST_ROLE_NAME])}`,
      );
    }
    await testPool.query(
      sql.unsafe`CREATE ROLE ${sql.identifier([TEST_ROLE_NAME])} WITH LOGIN NOINHERIT`,
    );
    await testPool.query(
      sql.unsafe`GRANT USAGE ON SCHEMA accounter_schema TO ${sql.identifier([TEST_ROLE_NAME])}`,
    );
    await testPool.query(
      sql.unsafe`GRANT ALL ON ALL TABLES IN SCHEMA accounter_schema TO ${sql.identifier([TEST_ROLE_NAME])}`,
    );
    await testPool.query(
      sql.unsafe`GRANT ALL ON ALL SEQUENCES IN SCHEMA accounter_schema TO ${sql.identifier([TEST_ROLE_NAME])}`,
    );

    try {
        // Use a single connection/transaction to test as User A
        await testPool.connect(async (connection) => {
          try {
            // Switch to restricted user
            await connection.query(
              sql.unsafe`SET ROLE ${sql.identifier([TEST_ROLE_NAME])}`,
            );

            // 2. As Business A, insert a charge
            await connection.query(sql.unsafe`
              SELECT set_config('app.current_business_id', ${businessIdA}, false);
            `);
            
            const chargeIdA = '33333333-3333-3333-3333-333333333333';
            // Charges table does not have amount/date. It's a parent entity.
            await connection.query(sql.unsafe`
              INSERT INTO accounter_schema.charges (id, owner_id, user_description)
              VALUES (${chargeIdA}, ${businessIdA}, 'Charge A');
            `);

            // 3. Verify Visibility for A
            const resultA = await connection.query(sql.type(z.object({ id: z.string() }))`
                SELECT id FROM accounter_schema.charges
                WHERE id = ${chargeIdA}
            `);

            expect(resultA.rows).toHaveLength(1);
            expect(resultA.rows[0].id).toBe(chargeIdA);
          } finally {
            // Revert role for connection pooling safety (though transaction end resets likely)
            await connection.query(sql.unsafe`RESET ROLE`);
          }
        });

        // Test as User B
        await testPool.connect(async (connection) => {
          try {
            // Switch to restricted user
            await connection.query(
              sql.unsafe`SET ROLE ${sql.identifier([TEST_ROLE_NAME])}`,
            );

            // 4. Verify Invisibility for B
            await connection.query(sql.unsafe`
              SELECT set_config('app.current_business_id', ${businessIdB}, false);
            `);
            const chargeIdA = '33333333-3333-3333-3333-333333333333';
            const resultB = await connection.query(sql.unsafe`
                SELECT * FROM accounter_schema.charges
                WHERE id = ${chargeIdA}
            `);
            expect(resultB.rows).toHaveLength(0);

            // 5. Attempt Cross-Tenant Insert (As B, try inserting with owner_id = A)
            try {
              await connection.query(sql.unsafe`
                INSERT INTO accounter_schema.charges (id, owner_id, user_description)
                VALUES ('44444444-4444-4444-4444-444444444444', ${businessIdA}, 'Access Violation');
              `);
              throw new Error('Should have failed');
            } catch (e: any) {
                // If expected error
                if (e.message !== 'Should have failed') {
                    // Check logic or error code
                    // RLS violation usually throws "new row violates row-level security policy for table..."
                    expect(e.message).toBeTruthy();
                } else {
                    // It didn't throw
                    throw new Error('RLS failed to block cross-tenant insert');
                }
            }
          } finally {
            await connection.query(sql.unsafe`RESET ROLE`);
          }
        });
    } finally {
        const roleStillExists = await testPool.oneFirst(
          sql.unsafe`SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = ${TEST_ROLE_NAME})`,
        );
        if (roleStillExists) {
          await testPool.query(sql.unsafe`DROP OWNED BY ${sql.identifier([TEST_ROLE_NAME])}`);
          await testPool.query(sql.unsafe`DROP ROLE ${sql.identifier([TEST_ROLE_NAME])}`);
        }
    }
  }, 30_000);
});
