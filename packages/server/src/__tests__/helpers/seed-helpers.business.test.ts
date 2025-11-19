import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import pg from 'pg';
import { ensureFinancialEntity, ensureBusinessForEntity } from './seed-helpers.js';

const pool = new pg.Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'accounter',
});

describe('ensureBusinessForEntity', () => {
  let client: pg.PoolClient;

  beforeAll(async () => {
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
      'SELECT id, no_invoices_required FROM accounter_schema.businesses WHERE id = $1',
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
      'SELECT id FROM accounter_schema.businesses WHERE id = $1',
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
      'SELECT id, no_invoices_required FROM accounter_schema.businesses WHERE id = $1',
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
      'SELECT no_invoices_required FROM accounter_schema.businesses WHERE id = $1',
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
      'SELECT no_invoices_required FROM accounter_schema.businesses WHERE id = $1',
      [entityId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].no_invoices_required).toBe(true); // Original value preserved
  });

  it('should not leak data between tests', async () => {
    // This test verifies transactional isolation by checking that data
    // from previous tests is not visible
    const result = await client.query(
      "SELECT COUNT(*) as count FROM accounter_schema.businesses WHERE id IN (SELECT id FROM accounter_schema.financial_entities WHERE name LIKE 'Test Business Entity%')",
    );

    // Due to ROLLBACK after each test, count should be 0
    expect(parseInt(result.rows[0].count)).toBe(0);
  });
});
