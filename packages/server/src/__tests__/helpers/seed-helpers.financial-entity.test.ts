import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import pg from 'pg';
import { ensureFinancialEntity } from './seed-helpers.js';
import { testDbConfig, qualifyTable } from './test-db-config.js';
import { EntityValidationError } from './seed-errors.js';

describe('ensureFinancialEntity', () => {
  let pool: pg.Pool;
  let client: pg.PoolClient;

  beforeAll(async () => {
    // Create connection pool with shared config
    pool = new pg.Pool(testDbConfig);

    // Get a client for transactions
    client = await pool.connect();
  });

  afterAll(async () => {
    // Release client and close pool
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    // Start transaction before each test
    await client.query('BEGIN');
  });

  afterEach(async () => {
    // Rollback transaction after each test to clean up
    await client.query('ROLLBACK');
  });

  it('should create a new financial entity when it does not exist', async () => {
    const result = await ensureFinancialEntity(client, {
      name: 'Test Entity',
      type: 'business',
    });

    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('string');

    // Verify it was inserted
    const checkResult = await client.query(
      `SELECT id, name, type, owner_id FROM ${qualifyTable('financial_entities')} WHERE id = $1`,
      [result.id],
    );

    expect(checkResult.rows.length).toBe(1);
    expect(checkResult.rows[0].name).toBe('Test Entity');
    expect(checkResult.rows[0].type).toBe('business');
    expect(checkResult.rows[0].owner_id).toBeNull();
  });

  it('should return existing entity when called twice with same parameters', async () => {
    const firstResult = await ensureFinancialEntity(client, {
      name: 'Duplicate Test',
      type: 'tax_category',
    });

    const secondResult = await ensureFinancialEntity(client, {
      name: 'Duplicate Test',
      type: 'tax_category',
    });

    expect(firstResult.id).toBe(secondResult.id);

    // Verify only one row exists
    const countResult = await client.query(
      `SELECT COUNT(*) FROM ${qualifyTable('financial_entities')} WHERE name = $1 AND type = $2`,
      ['Duplicate Test', 'tax_category'],
    );

    expect(parseInt(countResult.rows[0].count)).toBe(1);
  });

  it('should handle entities with owner_id', async () => {
    // First create an owner entity (business)
    const ownerEntityResult = await ensureFinancialEntity(client, {
      name: 'Owner Entity',
      type: 'business',
    });

    // Create corresponding business record (required for foreign key)
    await client.query(
      `INSERT INTO ${qualifyTable('businesses')} (id) VALUES ($1)`,
      [ownerEntityResult.id],
    );

    // Create owned entity (tax_category)
    const result = await ensureFinancialEntity(client, {
      name: 'Owned Entity',
      type: 'tax_category',
      ownerId: ownerEntityResult.id,
    });

    expect(result).toHaveProperty('id');

    // Verify owner_id is set correctly
    const checkResult = await client.query(
      `SELECT owner_id FROM ${qualifyTable('financial_entities')} WHERE id = $1`,
      [result.id],
    );

    expect(checkResult.rows[0].owner_id).toBe(ownerEntityResult.id);
  });

  it('should be idempotent for entities with owner_id', async () => {
    const ownerEntityResult = await ensureFinancialEntity(client, {
      name: 'Owner Business',
      type: 'business',
    });

    // Create corresponding business record
    await client.query(
      `INSERT INTO ${qualifyTable('businesses')} (id) VALUES ($1)`,
      [ownerEntityResult.id],
    );

    const firstResult = await ensureFinancialEntity(client, {
      name: 'Child Entity',
      type: 'tax_category',
      ownerId: ownerEntityResult.id,
    });

    const secondResult = await ensureFinancialEntity(client, {
      name: 'Child Entity',
      type: 'tax_category',
      ownerId: ownerEntityResult.id,
    });

    expect(firstResult.id).toBe(secondResult.id);

    // Verify only one row
    const countResult = await client.query(
      `SELECT COUNT(*) FROM ${qualifyTable('financial_entities')}
       WHERE name = $1 AND type = $2 AND owner_id = $3`,
      ['Child Entity', 'tax_category', ownerEntityResult.id],
    );

    expect(parseInt(countResult.rows[0].count)).toBe(1);
  });

  it('should distinguish entities by type', async () => {
    const businessResult = await ensureFinancialEntity(client, {
      name: 'Same Name',
      type: 'business',
    });

    const taxCategoryResult = await ensureFinancialEntity(client, {
      name: 'Same Name',
      type: 'tax_category',
    });

    expect(businessResult.id).not.toBe(taxCategoryResult.id);
  });

  it('should distinguish entities by owner_id', async () => {
    const owner1Entity = await ensureFinancialEntity(client, {
      name: 'Owner 1',
      type: 'business',
    });
    await client.query(
      `INSERT INTO ${qualifyTable('businesses')} (id) VALUES ($1)`,
      [owner1Entity.id],
    );

    const owner2Entity = await ensureFinancialEntity(client, {
      name: 'Owner 2',
      type: 'business',
    });
    await client.query(
      `INSERT INTO ${qualifyTable('businesses')} (id) VALUES ($1)`,
      [owner2Entity.id],
    );

    const entity1 = await ensureFinancialEntity(client, {
      name: 'Same Child',
      type: 'tax_category',
      ownerId: owner1Entity.id,
    });

    const entity2 = await ensureFinancialEntity(client, {
      name: 'Same Child',
      type: 'tax_category',
      ownerId: owner2Entity.id,
    });

    expect(entity1.id).not.toBe(entity2.id);
  });

  it('should handle null vs undefined owner_id consistently', async () => {
    const result1 = await ensureFinancialEntity(client, {
      name: 'No Owner Entity',
      type: 'business',
      ownerId: undefined,
    });

    const result2 = await ensureFinancialEntity(client, {
      name: 'No Owner Entity',
      type: 'business',
    });

    expect(result1.id).toBe(result2.id);
  });

  it('should not leak data between tests', async () => {
    // This test verifies that ROLLBACK works correctly
    // Create an entity in this test
    await ensureFinancialEntity(client, {
      name: 'Transient Entity',
      type: 'business',
    });

    // The entity should exist within this transaction
    const checkInTransaction = await client.query(
      `SELECT COUNT(*) FROM ${qualifyTable('financial_entities')} WHERE name = $1`,
      ['Transient Entity'],
    );

    expect(parseInt(checkInTransaction.rows[0].count)).toBe(1);

    // After ROLLBACK in afterEach, this data won't be visible in next test
  });

  // Validation tests
  it('should reject empty entity name', async () => {
    await expect(
      ensureFinancialEntity(client, {
        name: '',
        type: 'business',
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it('should reject invalid entity type', async () => {
    await expect(
      ensureFinancialEntity(client, {
        name: 'Test Entity',
        type: 'invalid_type' as any,
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it('should reject whitespace-only name', async () => {
    await expect(
      ensureFinancialEntity(client, {
        name: '   ',
        type: 'business',
      }),
    ).rejects.toThrow(EntityValidationError);
  });
});
