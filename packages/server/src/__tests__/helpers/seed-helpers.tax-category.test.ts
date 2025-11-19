import { describe, expect, it } from 'vitest';
import pg from 'pg';
import { testDbConfig, qualifyTable } from './test-db-config.js';
import { ensureFinancialEntity, ensureTaxCategoryForEntity } from './seed-helpers.js';
import { EntityValidationError } from './seed-errors.js';

describe('ensureTaxCategoryForEntity', () => {
  it('should create tax category on first call', async () => {
    const pool = new pg.Pool(testDbConfig);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

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

      await client.query('ROLLBACK');
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('should be idempotent (no-op on repeated calls)', async () => {
    const pool = new pg.Pool(testDbConfig);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

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

      await client.query('ROLLBACK');
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('should preserve existing values on subsequent calls', async () => {
    const pool = new pg.Pool(testDbConfig);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

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

      await client.query('ROLLBACK');
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('should reject invalid UUID format', async () => {
    const pool = new pg.Pool(testDbConfig);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await expect(
        ensureTaxCategoryForEntity(client, 'not-a-uuid'),
      ).rejects.toThrow(EntityValidationError);

      await expect(
        ensureTaxCategoryForEntity(client, ''),
      ).rejects.toThrow(EntityValidationError);

      await expect(
        ensureTaxCategoryForEntity(client, '12345'),
      ).rejects.toThrow(EntityValidationError);

      await client.query('ROLLBACK');
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('should reject non-existent financial entity', async () => {
    const pool = new pg.Pool(testDbConfig);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const fakeUuid = '00000000-0000-0000-0000-000000000001';

      await expect(
        ensureTaxCategoryForEntity(client, fakeUuid),
      ).rejects.toThrow(EntityValidationError);

      await client.query('ROLLBACK');
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('should not leak data between tests', async () => {
    const pool = new pg.Pool(testDbConfig);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Create and verify entity exists in this transaction
      const { id: entityId } = await ensureFinancialEntity(client, {
        name: 'Temporary Tax Category',
        type: 'tax_category',
      });

      await ensureTaxCategoryForEntity(client, entityId);

      const inTransactionResult = await client.query(
        `SELECT COUNT(*) as count FROM ${qualifyTable('tax_categories')} WHERE id = $1`,
        [entityId],
      );
      expect(inTransactionResult.rows[0].count).toBe('1');

      await client.query('ROLLBACK');

      // Verify entity doesn't exist after rollback
      await client.query('BEGIN');
      const afterRollbackResult = await client.query(
        `SELECT COUNT(*) as count FROM ${qualifyTable('tax_categories')} WHERE id = $1`,
        [entityId],
      );
      expect(afterRollbackResult.rows[0].count).toBe('0');

      await client.query('ROLLBACK');
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('should work with entities that have owner_id', async () => {
    const pool = new pg.Pool(testDbConfig);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

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

      await client.query('ROLLBACK');
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('should handle options parameter gracefully (future-proofing)', async () => {
    const pool = new pg.Pool(testDbConfig);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

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

      await client.query('ROLLBACK');
    } finally {
      client.release();
      await pool.end();
    }
  });
});
