import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import pg from 'pg';
import { ensureFinancialEntity, ensureBusinessForEntity } from './seed-helpers.js';
import { testDbConfig, qualifyTable } from './test-db-config.js';
import { EntityValidationError } from './seed-errors.js';

describe('ensureBusinessForEntity', () => {
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

  it('should create a new business for a financial entity', async () => {
    // Create a financial entity first
    const { id: entityId } = await ensureFinancialEntity(client, {
      name: 'Test Business Entity',
      type: 'business',
    });

    // Ensure business for this entity
    await ensureBusinessForEntity(client, entityId);

    // Verify business exists
    const result = await client.query(
      `SELECT id, no_invoices_required FROM ${qualifyTable('businesses')} WHERE id = $1`,
      [entityId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(entityId);
    expect(result.rows[0].no_invoices_required).toBe(false);
  });

  it('should be idempotent - repeated calls do not create duplicates', async () => {
    // Create a financial entity first
    const { id: entityId } = await ensureFinancialEntity(client, {
      name: 'Test Business Entity 2',
      type: 'business',
    });

    // Call ensureBusinessForEntity multiple times
    await ensureBusinessForEntity(client, entityId);
    await ensureBusinessForEntity(client, entityId);
    await ensureBusinessForEntity(client, entityId);

    // Verify only one business exists
    const result = await client.query(
      `SELECT id FROM ${qualifyTable('businesses')} WHERE id = $1`,
      [entityId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(entityId);
  });

  it('should support noInvoicesRequired option', async () => {
    // Create a financial entity first
    const { id: entityId } = await ensureFinancialEntity(client, {
      name: 'Test Business Entity 3',
      type: 'business',
    });

    // Ensure business with noInvoicesRequired set to true
    await ensureBusinessForEntity(client, entityId, { noInvoicesRequired: true });

    // Verify business has correct option set
    const result = await client.query(
      `SELECT id, no_invoices_required FROM ${qualifyTable('businesses')} WHERE id = $1`,
      [entityId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(entityId);
    expect(result.rows[0].no_invoices_required).toBe(true);
  });

  it('should default noInvoicesRequired to false when not specified', async () => {
    // Create a financial entity first
    const { id: entityId } = await ensureFinancialEntity(client, {
      name: 'Test Business Entity 4',
      type: 'business',
    });

    // Ensure business without specifying options
    await ensureBusinessForEntity(client, entityId);

    // Verify business has default value
    const result = await client.query(
      `SELECT no_invoices_required FROM ${qualifyTable('businesses')} WHERE id = $1`,
      [entityId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].no_invoices_required).toBe(false);
  });

  it('should not modify existing business when called again', async () => {
    // Create a financial entity first
    const { id: entityId } = await ensureFinancialEntity(client, {
      name: 'Test Business Entity 5',
      type: 'business',
    });

    // Create business with noInvoicesRequired = true
    await ensureBusinessForEntity(client, entityId, { noInvoicesRequired: true });

    // Call again with different options (should be no-op)
    await ensureBusinessForEntity(client, entityId, { noInvoicesRequired: false });

    // Verify original value is preserved
    const result = await client.query(
      `SELECT no_invoices_required FROM ${qualifyTable('businesses')} WHERE id = $1`,
      [entityId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].no_invoices_required).toBe(true); // Original value preserved
  });

  it('should not leak data between tests', async () => {
    // This test verifies transactional isolation by checking that data
    // from previous tests is not visible
    const result = await client.query(
      `SELECT COUNT(*) as count FROM ${qualifyTable('businesses')} WHERE id IN (SELECT id FROM ${qualifyTable('financial_entities')} WHERE name LIKE 'Test Business Entity%')`,
    );

    // Due to ROLLBACK after each test, count should be 0
    expect(parseInt(result.rows[0].count)).toBe(0);
  });

  // Validation tests
  it('should reject invalid UUID format', async () => {
    await expect(
      ensureBusinessForEntity(client, 'not-a-valid-uuid'),
    ).rejects.toThrow(EntityValidationError);
  });

  it('should reject non-existent financial entity', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    await expect(
      ensureBusinessForEntity(client, fakeId),
    ).rejects.toThrow(EntityValidationError);
  });
});
