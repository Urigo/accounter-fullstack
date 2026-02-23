import { createPool, DatabasePool, sql } from 'slonik';
import { createConnectionString } from '../connection-string.js';
import { env } from '../environment.js';
import { runPGMigrations } from '../run-pg-migrations.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const TEST_DB_NAME = `accounter_migration_test_rls_${Date.now()}`;

describe('RLS All Tables Migration', () => {
  let rootPool: DatabasePool;
  let testPool: DatabasePool;

  beforeAll(async () => {
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
  });

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
    
    // Check if migration was recorded
    const migrationResult = await testPool.query(sql.unsafe`
      SELECT * FROM accounter_schema.migration
      ORDER BY name DESC
      LIMIT 1
    `);
    
    // Check if we hit the latest migration or later
    // The previous migration was 2026-02-19T14-00-00.add-owner-id-indexes.sql
    // This one is 2026-02-23T09-00-00.enable-rls-all-tables.sql
    expect(migrationResult.rows[0].name).toContain('enable-rls-all-tables');
  });

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
    await testPool.query(sql.unsafe`
        DO $$ 
        BEGIN 
          IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rls_test_user') THEN 
            DROP OWNED BY rls_test_user; 
            DROP ROLE rls_test_user; 
          END IF; 
        END $$;
        CREATE ROLE rls_test_user WITH LOGIN NOINHERIT;
        GRANT USAGE ON SCHEMA accounter_schema TO rls_test_user;
        GRANT ALL ON ALL TABLES IN SCHEMA accounter_schema TO rls_test_user;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA accounter_schema TO rls_test_user;
    `);

    try {
        // Use a single connection/transaction to test as User A
        await testPool.connect(async (connection) => {
            // Switch to restricted user
            await connection.query(sql.unsafe`SET ROLE rls_test_user`);

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
            const resultA = await connection.query(sql.unsafe`
                SELECT * FROM accounter_schema.charges
                WHERE id = ${chargeIdA}
            `);
            
            expect(resultA.rows).toHaveLength(1);
            expect(resultA.rows[0].id).toBe(chargeIdA);
            
            // Revert role for connection pooling safety (though transaction end resets likely)
            await connection.query(sql.unsafe`RESET ROLE`);
        });

        // Test as User B
        await testPool.connect(async (connection) => {
            // Switch to restricted user
            await connection.query(sql.unsafe`SET ROLE rls_test_user`);
            
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
             
            await connection.query(sql.unsafe`RESET ROLE`);
        });
    } finally {
        await testPool.query(sql.unsafe`
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rls_test_user') THEN 
                    DROP OWNED BY rls_test_user; 
                    DROP ROLE rls_test_user; 
                END IF; 
            END $$;
        `);
    }
  });
});
