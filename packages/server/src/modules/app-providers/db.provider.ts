/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Scope } from 'graphql-modules';
import postgres, { type QueryResultBase, type QueryResultRow } from 'pg';
import 'reflect-metadata';

type TypedQueryResult<Entity> = QueryResultBase & { rows: Entity[]; rowCount: number }; // NOTE: rowCount added to workaround pgTyped issue

/**
 * DBProvider - Singleton connection pool manager for PostgreSQL database access.
 *
 * This provider manages the PostgreSQL connection pool and provides two access patterns:
 *
 * 1. **System-level access** (migrations, background jobs):
 *    - Use the `pool` property directly for operations that bypass Row-Level Security (RLS)
 *    - Example: `dbProvider.pool.query('SELECT * FROM table')`
 *
 * 2. **Request-level access** (GraphQL operations):
 *    - MUST use TenantAwareDBClient wrapper (next phase)
 *    - Enforces RLS by setting transaction-scoped variables
 *    - Never access `pool` directly from resolvers
 *
 * @example System-level usage (migrations)
 * ```typescript
 * const dbProvider = injector.get(DBProvider);
 * await dbProvider.pool.query('CREATE TABLE ...');
 * ```
 *
 * @example Request-level usage (GraphQL resolvers)
 * ```typescript
 * // DO NOT use DBProvider directly in resolvers!
 * // Use TenantAwareDBClient instead:
 * const db = context.db; // TenantAwareDBClient instance
 * await db.query('SELECT * FROM charges'); // Automatically filtered by RLS
 * ```
 */
@Injectable({
  scope: Scope.Singleton,
})
export class DBProvider {
  /**
   * PostgreSQL connection pool.
   *
   * **IMPORTANT**: Direct pool access should only be used for:
   * - Database migrations
   * - Background jobs that operate across all tenants
   * - System-level administrative operations
   *
   * GraphQL resolvers MUST use TenantAwareDBClient to ensure Row-Level Security.
   */
  constructor(public pool: postgres.Pool) {
    if (!pool) {
      throw new Error('DBProvider: Pool instance is required');
    }
  }

  /**
   * Execute a query against the database.
   *
   * **WARNING**: This method bypasses Row-Level Security (RLS).
   * Only use for system-level operations. GraphQL resolvers should use TenantAwareDBClient.
   *
   * @param queryStatement - SQL query string
   * @param values - Query parameters (optional)
   * @returns Query result with typed rows
   * @throws Error if database connection not initialized
   */
  public async query<Entity extends QueryResultRow>(
    queryStatement: string,
    values?: any[] | undefined,
  ): Promise<TypedQueryResult<Entity>> {
    if (!this.pool) {
      throw new Error('DB connection not initialized');
    }
    return this.pool
      .query(queryStatement, values)
      .then(result => ({ ...result, rowCount: result.rowCount ?? 0 }));
  }

  /**
   * Check database connection health.
   *
   * Executes a simple `SELECT 1` query to verify the database is accessible.
   * Useful for readiness probes and monitoring.
   *
   * @returns Promise<boolean> - true if database is healthy, false otherwise
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1 as health');
      return result.rows[0]?.health === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gracefully shut down the database connection pool.
   * Should be called during application termination (SIGTERM/SIGINT).
   */
  public async shutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
