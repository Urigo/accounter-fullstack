import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestDatabase, isPoolHealthy } from './helpers/db-setup.js';
import { assertLatestMigrationApplied } from './helpers/migration-verification.js';
import { seedAdminCore } from '../../scripts/seed-admin-context.js';
import { qualifyTable } from './helpers/test-db-config.js';
import { buildAdminContextFromDb } from './helpers/admin-context-builder.js';

/**
 * Smoke test for DB test harness
 * Verifies the full bootstrap pipeline: connect → seed → query
 *
 * NOTE: We assume migrations were run via `yarn db:init` beforehand.
 */
describe('DB Test Harness Bootstrap', () => {
  let db: TestDatabase;

  const EXPECTED_TAX_CATEGORIES = 19;

  beforeAll(async () => {
    db = new TestDatabase();
    await db.connect();
  });

  afterAll(async () => {
    await db.close();
  });

  it('connects to database', () => {
    const pool = db.getPool();
    expect(pool).toBeDefined();
    const m = isPoolHealthy(pool);
    expect(m.total).toBeGreaterThanOrEqual(0);
  });

  it('is at latest migration (schema ready)', async () =>
    db.withTransaction(async client => {
      await assertLatestMigrationApplied(client);
    }));

  it('has admin business after seeding', async () =>
    db.withTransaction(async client => {
      await seedAdminCore(client);
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

  it('has 3 authorities after seeding', async () =>
    db.withTransaction(async client => {
      await seedAdminCore(client);
      const result = await client.query(
        `SELECT COUNT(*)
         FROM ${qualifyTable('financial_entities')} fe
         JOIN ${qualifyTable('businesses')} b ON fe.id = b.id
         WHERE fe.name IN ('VAT', 'Tax', 'Social Security')`,
      );
      const count = parseInt(result.rows[0].count, 10);
      expect(count).toBe(3);
    }));

  it('has expected tax categories', async () =>
    db.withTransaction(async client => {
      await seedAdminCore(client);
      const adminContext = await buildAdminContextFromDb(client);
      const result = await client.query(
        `SELECT COUNT(*) FROM ${qualifyTable('tax_categories')} WHERE owner_id = $1`,
        [adminContext.defaultAdminBusinessId]
      );
      const count = parseInt(result.rows[0].count, 10);
      expect(count).toBe(EXPECTED_TAX_CATEGORIES);
    }));

  it('has user_context after seeding', async () =>
    db.withTransaction(async client => {
      await seedAdminCore(client);
      const adminContext = await buildAdminContextFromDb(client);
      const result = await client.query(
        `SELECT owner_id, vat_business_id FROM ${qualifyTable('user_context')} WHERE owner_id = $1 LIMIT 1`,
        [adminContext.defaultAdminBusinessId]
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].owner_id).toBeDefined();
      expect(result.rows[0].vat_business_id).toBeDefined();
    }));

  it('rolls back changes between transactions (independent)', async () => {
    const TEMP_NAME = 'Temporary Test Entity (Rollback)';

    await db.withTransaction(async client => {
      const insertResult = await client.query(
        `INSERT INTO ${qualifyTable('financial_entities')} (name, type)
         VALUES ($1, 'business')
         RETURNING id`,
        [TEMP_NAME],
      );
      const entityId = insertResult.rows[0].id;
      await client.query(
        `INSERT INTO ${qualifyTable('businesses')} (id) VALUES ($1)`,
        [entityId],
      );
      const selectInTx = await client.query(
        `SELECT COUNT(*) FROM ${qualifyTable('financial_entities')} WHERE name = $1`,
        [TEMP_NAME],
      );
      expect(parseInt(selectInTx.rows[0].count, 10)).toBe(1);
    });

    await db.withTransaction(async client => {
      const result = await client.query(
        `SELECT COUNT(*) FROM ${qualifyTable('financial_entities')} WHERE name = $1`,
        [TEMP_NAME],
      );
      const count = parseInt(result.rows[0].count, 10);
      expect(count).toBe(0);
    });
  });
});
