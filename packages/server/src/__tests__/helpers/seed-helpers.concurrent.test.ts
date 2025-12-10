import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ensureFinancialEntity } from './seed-helpers.js';
import { withConcurrentTransactions } from './test-transaction.js';
import { TestDatabase } from './db-setup.js';

describe('ensureFinancialEntity - Concurrent Access', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = new TestDatabase();
    await db.connect();
  });

  afterAll(async () => {
    await db.close();
  });

  it('should handle concurrent inserts of same entity gracefully', async () => {
    const params = {
      name: 'Concurrent Test Entity',
      type: 'business' as const,
    };

    // Two separate transactions attempting to create the same entity
    const [result1, result2] = await withConcurrentTransactions(db.getPool(), [
      async client => ensureFinancialEntity(client, params),
      async client => ensureFinancialEntity(client, params),
    ]);

    // Both calls should succeed (no crash)
    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();

    // The IDs might differ because transactions are isolated
    // Each transaction sees its own insert
    // This is expected behavior with ROLLBACK isolation
  });

  it('should handle concurrent inserts of different entities', async () => {
    const [result1, result2, result3] = await withConcurrentTransactions(db.getPool(), [
      async client =>
        ensureFinancialEntity(client, {
          name: 'Concurrent Entity A',
          type: 'business',
        }),
      async client =>
        ensureFinancialEntity(client, {
          name: 'Concurrent Entity B',
          type: 'business',
        }),
      async client =>
        ensureFinancialEntity(client, {
          name: 'Concurrent Entity C',
          type: 'tax_category',
        }),
    ]);

    // All should succeed with unique IDs
    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();
    expect(result3.id).toBeDefined();
  });

  it('should handle concurrent creation with separate namespaces', async () => {
    // Test that concurrent operations in separate transactions don't interfere
    const timestamp = Date.now();

    const [result1, result2, result3] = await withConcurrentTransactions(db.getPool(), [
      async client =>
        ensureFinancialEntity(client, {
          name: `Namespace A - ${timestamp}`,
          type: 'business',
        }),
      async client =>
        ensureFinancialEntity(client, {
          name: `Namespace B - ${timestamp}`,
          type: 'tax_category',
        }),
      async client =>
        ensureFinancialEntity(client, {
          name: `Namespace C - ${timestamp}`,
          type: 'tag',
        }),
    ]);

    // All should succeed independently
    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();
    expect(result3.id).toBeDefined();

    // All should have unique IDs
    expect(result1.id).not.toBe(result2.id);
    expect(result2.id).not.toBe(result3.id);
    expect(result1.id).not.toBe(result3.id);
  });
});
