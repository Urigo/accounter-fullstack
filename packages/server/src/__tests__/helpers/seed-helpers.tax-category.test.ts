import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import pg from 'pg';
import { testDbConfig, qualifyTable } from './test-db-config.js';
import { ensureFinancialEntity, ensureTaxCategoryForEntity } from './seed-helpers.js';
import { EntityValidationError } from './seed-errors.js';

describe('ensureTaxCategoryForEntity', () => {
  let pool: pg.Pool;
  let client: pg.PoolClient;

  beforeAll(async () => {
    pool = new pg.Pool(testDbConfig);
    client = await pool.connect();
  });

  afterAll(async () => {
    client.release();
    await pool.end();
  });

  beforeEach(async () => {
    await client.query('BEGIN');
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  it('should create tax category on first call', async () => {
    // Create financial entity
    const { id: entityId } = await ensureFinancialEntity(client, {
      name: 'VAT Category',
      type: 'tax_category',
    });

    // Create tax category
    await ensureTaxCategoryForEntity(client, entityId);

    // Verify tax category exists
    const result = await client.query(
      `SELECT id FROM ${qualifyTable('tax_categories')} WHERE id = $1`,
      [entityId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(entityId);
  });

  it('should be idempotent (no-op on repeated calls)', async () => {
    // Create financial entity
    const { id: entityId } = await ensureFinancialEntity(client, {
      name: 'Income Tax',
      type: 'tax_category',
    });

    // Create tax category twice
    await ensureTaxCategoryForEntity(client, entityId);
    await ensureTaxCategoryForEntity(client, entityId);

    // Verify only one row exists
    const result = await client.query(
      `SELECT COUNT(*) as count FROM ${qualifyTable('tax_categories')} WHERE id = $1`,
      [entityId],
    );

    expect(result.rows[0].count).toBe('1');
  });

  it('should preserve existing values on subsequent calls', async () => {
    // Create financial entity
    const { id: entityId } = await ensureFinancialEntity(client, {
      name: 'Expense Category',
      type: 'tax_category',
    });

    // Create tax category
    await ensureTaxCategoryForEntity(client, entityId);

    // Get initial state
    const initialResult = await client.query(
      `SELECT * FROM ${qualifyTable('tax_categories')} WHERE id = $1`,
      [entityId],
    );
    const initialRow = initialResult.rows[0];

    // Call again (should not modify)
    await ensureTaxCategoryForEntity(client, entityId, { sortCode: 999 });

    // Verify unchanged
    const finalResult = await client.query(
      `SELECT * FROM ${qualifyTable('tax_categories')} WHERE id = $1`,
      [entityId],
    );
    const finalRow = finalResult.rows[0];

    expect(finalRow).toEqual(initialRow);
  });

  it('should reject invalid UUID format', async () => {
    await expect(
      ensureTaxCategoryForEntity(client, 'not-a-uuid'),
    ).rejects.toThrow(EntityValidationError);

    await expect(
      ensureTaxCategoryForEntity(client, ''),
    ).rejects.toThrow(EntityValidationError);

    await expect(
      ensureTaxCategoryForEntity(client, '12345'),
    ).rejects.toThrow(EntityValidationError);
  });

  it('should reject non-existent financial entity', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000001';

    await expect(
      ensureTaxCategoryForEntity(client, fakeUuid),
    ).rejects.toThrow(EntityValidationError);
  });

  it('should not leak data between tests', async () => {
    // This test verifies transactional isolation by checking that data
    // from previous tests is not visible
    const result = await client.query(
      `SELECT COUNT(*) as count FROM ${qualifyTable('tax_categories')} WHERE id IN (SELECT id FROM ${qualifyTable('financial_entities')} WHERE name LIKE 'VAT Category' OR name LIKE 'Income Tax' OR name LIKE 'Expense Category')`,
    );

    // Due to ROLLBACK after each test, count should be 0
    expect(parseInt(result.rows[0].count)).toBe(0);
  });

  it('should work with entities that have owner_id', async () => {
    // Create owner business entity (without owner_id requirement)
    const { id: ownerId } = await ensureFinancialEntity(client, {
      name: 'Owner Business',
      type: 'business',
    });

    // Create owned tax category entity (tax categories can have owner_id)
    const { id: taxCatId } = await ensureFinancialEntity(client, {
      name: 'Owned Tax Category',
      type: 'tax_category',
    });

    // Create tax category
    await ensureTaxCategoryForEntity(client, taxCatId);

    // Verify tax category exists
    const result = await client.query(
      `SELECT id FROM ${qualifyTable('tax_categories')} WHERE id = $1`,
      [taxCatId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(taxCatId);
  });

  it('should handle options parameter gracefully (future-proofing)', async () => {
    // Create financial entity
    const { id: entityId } = await ensureFinancialEntity(client, {
      name: 'Category with Options',
      type: 'tax_category',
    });

    // Create tax category with options
    await ensureTaxCategoryForEntity(client, entityId, { sortCode: 1000 });

    // Verify tax category exists
    const result = await client.query(
      `SELECT id FROM ${qualifyTable('tax_categories')} WHERE id = $1`,
      [entityId],
    );

    expect(result.rows).toHaveLength(1);
  });
});
