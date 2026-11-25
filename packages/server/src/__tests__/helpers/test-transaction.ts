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
 * A `Pool` that runs everything on `client`, inside the transaction the client already has open,
 * so that code built on a pool — the providers `createLedgerTestContext` wires up, which check out
 * connections and commit their own transactions — runs in a test transaction and is rolled back
 * with it.
 *
 * - `connect()` hands out the same client, whose `release()` does nothing. On it, `BEGIN`,
 *   `COMMIT` and `ROLLBACK` become a savepoint, its release and a rollback to it, so a provider's
 *   "transaction" is nested in the test's. Savepoints a provider opens itself pass through.
 * - `query()` runs on the client directly (system-level reads, such as exchange rates), with no
 *   savepoint: a statement that fails there aborts the whole test transaction, and every later
 *   statement fails with 25P02 (`current transaction is aborted`).
 *
 * The connections it hands out are meant to be used one after another, as a single
 * `TenantAwareDBClient` does: two "transactions" open at once on the one client would interleave.
 *
 * @example
 * ```typescript
 * await withTestTransaction(pool, async client => {
 *   await insertFixture(client, fixture, ownerId);
 *   const context = createLedgerTestContext({ pool: transactionScopedPool(client), businessId: ownerId });
 *   // ...generate ledger, read reports: all of it is rolled back at the end
 * });
 * ```
 */
export function transactionScopedPool(client: PoolClient): Pool {
  let sessions = 0;

  const connect = async (): Promise<PoolClient> => {
    const savepoint = `scoped_pool_session_${++sessions}`;
    const query = (...args: unknown[]) => {
      const [config] = args;
      const statement = typeof config === 'string' ? config.trim().toUpperCase() : null;
      switch (statement) {
        case 'BEGIN':
          return client.query(`SAVEPOINT ${savepoint}`);
        case 'COMMIT':
          return client.query(`RELEASE SAVEPOINT ${savepoint}`);
        case 'ROLLBACK':
          return client
            .query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
            .then(() => client.query(`RELEASE SAVEPOINT ${savepoint}`));
        default:
          return (client.query as (...queryArgs: unknown[]) => unknown)(...args);
      }
    };
    return new Proxy(client, {
      get: (target, property) => {
        if (property === 'query') {
          return query;
        }
        if (property === 'release') {
          return () => {};
        }
        const value: unknown = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };

  return {
    connect,
    query: (...args: unknown[]) => (client.query as (...queryArgs: unknown[]) => unknown)(...args),
    end: async () => {},
    on: () => undefined,
  } as unknown as Pool;
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
