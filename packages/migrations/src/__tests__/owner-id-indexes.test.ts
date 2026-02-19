import { createPool, sql } from 'slonik';
import { createConnectionString } from '../connection-string.js';
import { env } from '../environment.js';
import { runPGMigrations } from '../run-pg-migrations.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const TEST_DB_NAME = `accounter_migration_test_${Date.now()}`;

describe('Owner ID Indexes Migration', () => {
  // connection to 'postgres' db to create/drop test db
  let rootPool: any;
  // connection to the test db
  let testPool: any;

  beforeAll(async () => {
    // 1. Connect to default DB (usually postgres)
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
        statementTimeout: 60000, // Migrations take time
    });
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.end();
    }
    if (rootPool) {
      // Terminate other connections to drop DB
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
      SELECT * FROM accounter_schema."migration"
      ORDER BY name DESC
      LIMIT 1
    `);
    
    expect(migrationResult.rows[0].name).toContain('2026-02-19T14-00-00.add-owner-id-indexes');
  });

  it('should have created the indexes', async () => {
    const tableIndexes = [
      ['business_trip_charges', 'idx_business_trip_charges_owner_id'],
      ['transactions', 'idx_transactions_owner_id'],
      ['charges', 'idx_charges_owner_id'],
      ['financial_entities', 'idx_financial_entities_owner_id'],
      ['ledger_records', 'idx_ledger_records_owner_id'],
      ['business_tax_category_match', 'idx_business_tax_category_match_owner_id'],
      ['dividends', 'idx_dividends_owner_id'],
    ];

    for (const [table, index] of tableIndexes) {
      const result = await testPool.query(sql.unsafe`
        SELECT * FROM pg_indexes 
        WHERE tablename = ${table} 
        AND indexname = ${index}
      `);
      expect(result.rows.length).toBe(1);
    }
  });

  it('should have created foreign keys', async () => {
    const tableConstraints = [
      ['transactions', 'fk_transactions_owner_id'],
      ['charges', 'fk_charges_owner_id'],
      ['ledger_records', 'fk_ledger_records_owner_id'],
      ['business_tax_category_match', 'fk_business_tax_category_match_owner_id'],
      ['dividends', 'fk_dividends_owner_id'],
      ['dynamic_report_templates', 'fk_dynamic_report_templates_owner_id'],
      ['user_context', 'fk_user_context_owner_id'],
    ];

    for (const [table, constraint] of tableConstraints) {
      const result = await testPool.query(sql.unsafe`
        SELECT * FROM information_schema.table_constraints
        WHERE table_name = ${table}
        AND constraint_name = ${constraint}
        AND constraint_type = 'FOREIGN KEY'
      `);
      expect(result.rows.length).toBe(1);
    }
  });
});
