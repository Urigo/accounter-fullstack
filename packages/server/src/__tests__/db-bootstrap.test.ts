import { describe, it, expect, beforeAll } from 'vitest';
import {
  connectTestDb,
  runMigrationsIfNeeded,
  seedAdminOnce,
  withTestTransaction,
  closeTestDb,
} from './helpers/db-setup.js';
import { testDbSchema, qualifyTable } from './helpers/test-db-config.js';
import type { Pool } from 'pg';

/**
 * Smoke test for DB test harness
 * Verifies the full bootstrap pipeline: connect → migrate → seed → query
 * 
 * NOTE: This test assumes migrations have already been run via `yarn db:init`
 * Running migrations programmatically in tests can cause FK constraint violations
 * if the database already has data from previous runs.
 */
describe('DB Test Harness Bootstrap', () => {
  let pool: Pool;

  beforeAll(async () => {
    // Step 1: Connect to database
    pool = await connectTestDb();

    // Step 2: Seed admin context (idempotent)
    // NOTE: Skipping runMigrationsIfNeeded() - assume migrations already run
    await seedAdminOnce(pool);
  });

  it('should connect to database', () => {
    expect(pool).toBeDefined();
    expect(pool.totalCount).toBeGreaterThanOrEqual(0);
  });

  it('should have migrations table (verifies schema is ready)', () =>
    withTestTransaction(pool, async client => {
      const result = await client.query(
        `SELECT COUNT(*) FROM ${qualifyTable('migration')}`,
      );
      const count = parseInt(result.rows[0].count, 10);
      
      // Should have many migrations (over 100 as of 2025)
      // This verifies migrations were run before tests
      expect(count).toBeGreaterThan(100);
    }));

  it('should have admin business after seeding', () =>
    withTestTransaction(pool, async client => {
      const result = await client.query(
        `SELECT fe.id, fe.name 
         FROM ${qualifyTable('financial_entities')} fe
         JOIN ${qualifyTable('businesses')} b ON fe.id = b.id
         WHERE fe.name = 'Admin Business'`,
      );
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('Admin Business');
      expect(result.rows[0].id).toBeDefined();
    }));

  it('should have 3 authorities after seeding', () =>
    withTestTransaction(pool, async client => {
      const result = await client.query(
        `SELECT COUNT(*) 
         FROM ${qualifyTable('financial_entities')} fe
         JOIN ${qualifyTable('businesses')} b ON fe.id = b.id
         WHERE fe.name IN ('VAT', 'Tax', 'Social Security')`,
      );
      const count = parseInt(result.rows[0].count, 10);
      
      expect(count).toBe(3);
    }));

  it('should have 19 tax categories after seeding', () =>
    withTestTransaction(pool, async client => {
      const result = await client.query(
        `SELECT COUNT(*) FROM ${qualifyTable('tax_categories')}`,
      );
      const count = parseInt(result.rows[0].count, 10);
      
      expect(count).toBe(19);
    }));

  it('should have user_context after seeding', () =>
    withTestTransaction(pool, async client => {
      const result = await client.query(
        `SELECT owner_id, vat_business_id FROM ${qualifyTable('user_context')} LIMIT 1`,
      );
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].owner_id).toBeDefined();
      expect(result.rows[0].vat_business_id).toBeDefined();
    }));

  it('should isolate transaction changes (verify withTestTransaction)', () =>
    withTestTransaction(pool, async client => {
      // Insert a temporary financial entity + business
      const insertResult = await client.query(
        `INSERT INTO ${qualifyTable('financial_entities')} (name, type) 
         VALUES ('Temporary Test Entity', 'business') 
         RETURNING id, name`,
      );
      
      const entityId = insertResult.rows[0].id;
      
      await client.query(
        `INSERT INTO ${qualifyTable('businesses')} (id) VALUES ($1)`,
        [entityId],
      );
      
      expect(insertResult.rows[0].name).toBe('Temporary Test Entity');
      
      // Verify it exists in this transaction
      const selectInTx = await client.query(
        `SELECT COUNT(*) FROM ${qualifyTable('financial_entities')} 
         WHERE name = 'Temporary Test Entity'`,
      );
      expect(parseInt(selectInTx.rows[0].count, 10)).toBe(1);
      
      // After transaction rolls back, verify it's gone
      // (This verification happens in next test to prove rollback worked)
    }));

  it('should have rolled back previous transaction', () =>
    withTestTransaction(pool, async client => {
      const result = await client.query(
        `SELECT COUNT(*) FROM ${qualifyTable('financial_entities')} 
         WHERE name = 'Temporary Test Entity'`,
      );
      const count = parseInt(result.rows[0].count, 10);
      
      // Should be 0 because previous transaction rolled back
      expect(count).toBe(0);
    }));

  it('should allow multiple calls to seed (idempotency)', async () => {
    // This should be a no-op due to in-memory flag
    await seedAdminOnce(pool);
    
    // Verify admin business still exists and count is still 1
    await withTestTransaction(pool, async client => {
      const result = await client.query(
        `SELECT COUNT(*) 
         FROM ${qualifyTable('financial_entities')} fe
         JOIN ${qualifyTable('businesses')} b ON fe.id = b.id
         WHERE fe.name = 'Admin Business'`,
      );
      expect(parseInt(result.rows[0].count, 10)).toBe(1);
    });
  });
});
