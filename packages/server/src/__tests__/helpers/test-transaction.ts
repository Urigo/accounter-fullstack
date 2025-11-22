import type { Pool, PoolClient } from 'pg';

/**
 * Execute a function within an isolated database transaction
 * Automatically rolls back after execution to prevent data leakage between tests
 * 
 * @param pool - PostgreSQL connection pool
 * @param fn - Async function to execute within transaction
 * @returns Promise resolving to function result
 * 
 * @example
 * ```typescript
 * it('should create entity', () =>
 *   withTestTransaction(pool, async (client) => {
 *     const result = await ensureFinancialEntity(client, {...});
 *     expect(result.id).toBeDefined();
 *   })
 * );
 * ```
 */
export async function withTestTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('ROLLBACK');
    return result;
  } catch (error) {
    // Ensure rollback on error
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Log rollback failure but throw original error
      console.error('Failed to rollback transaction:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple test functions in parallel, each in its own isolated transaction
 * Useful for testing concurrent access patterns
 * 
 * @param pool - PostgreSQL connection pool
 * @param fns - Array of async functions to execute concurrently
 * @returns Promise resolving to array of results
 * 
 * @example
 * ```typescript
 * const [result1, result2] = await withConcurrentTransactions(pool, [
 *   async (client) => ensureFinancialEntity(client, params),
 *   async (client) => ensureFinancialEntity(client, params),
 * ]);
 * ```
 */
export async function withConcurrentTransactions<T>(
  pool: Pool,
  fns: Array<(client: PoolClient) => Promise<T>>,
): Promise<T[]> {
  return Promise.all(fns.map(fn => withTestTransaction(pool, fn)));
}
