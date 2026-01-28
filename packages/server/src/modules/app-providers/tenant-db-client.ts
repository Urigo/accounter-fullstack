import { Inject, Injectable, Scope, type OnDestroy } from 'graphql-modules';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { AUTH_CONTEXT } from '../../shared/tokens.js';
import type { AuthContext } from '../../shared/types/auth.js';
import { DBProvider } from './db.provider.js';

/**
 * TenantAwareDBClient - Request-scoped database client with RLS enforcement.
 *
 * This client manages a dedicated database connection for the lifecycle of a single
 * GraphQL operation. It ensures that all queries are executed within a transaction
 * context that has Row-Level Security (RLS) variables set.
 *
 * RLS Enforcement:
 * - app.current_business_id: Set to the authenticated user's active business
 * - app.current_user_id: Set to the authenticated user's ID (or NULL for API keys)
 * - app.auth_type: Set to 'jwt' or 'apiKey'
 *
 * Transaction Management:
 * - Supports nested transactions via SAVEPOINTs
 * - Automatically rolls back on error
 * - Automatically releases connection on dispose
 */
@Injectable({
  scope: Scope.Operation,
})
export class TenantAwareDBClient implements OnDestroy {
  private activeClient: PoolClient | null = null;
  private transactionDepth = 0;
  private isDisposed = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    private dbProvider: DBProvider,
    @Inject(AUTH_CONTEXT) private authContext: AuthContext,
  ) {}

  /**
   * Execute a query with RLS enforcement.
   * If a transaction is already active, uses it.
   * If not, starts a new transaction/session, executes the query, and commits.
   */
  public async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    this.ensureNotDisposed();

    if (this.activeClient) {
      return this.activeClient.query<T>(text, params);
    }

    return this.transaction(async client => {
      return client.query<T>(text, params);
    });
  }

  /**
   * Execute a function within a transaction block.
   * Handles nested transactions using SAVEPOINTs.
   */
  public async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    this.ensureNotDisposed();

    // 1. Wait for initialization if in progress
    if (this.initializationPromise) {
      try {
        await this.initializationPromise;
      } catch (error) {
        // Initialization failed.
        // We proceed to check (!this.activeClient) which will re-attempt or fail.
      }
    }

    // 2. Initialize if needed
    if (!this.activeClient) {
      this.initializationPromise = (async () => {
        const client = await this.dbProvider.pool.connect();
        try {
          await client.query('BEGIN');
          await this.setRLSVariables(client);
          this.activeClient = client;
        } catch (error) {
          client.release();
          throw error;
        }
      })();

      try {
        await this.initializationPromise;
      } finally {
        this.initializationPromise = null;
      }
    }

    // Guard: activeClient must be set by now
    if (!this.activeClient) {
      throw new Error('Failed to initialize database client');
    }

    const client = this.activeClient;
    this.transactionDepth++;
    let success = false;

    try {
      let result: T;

      // Use a savepoint for all nested scopes (depth > 1) to isolate failures
      // and allow partial success/failure within the shared transaction.
      if (this.transactionDepth > 1) {
        const savepointName = `sp_${this.transactionDepth}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          result = await fn(client);
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          throw error;
        }
      } else {
        // Root scope (depth === 1) runs directly in the main transaction
        result = await fn(client);
      }

      success = true;
      return result;
    } catch (error) {
      // If we are the last active scope and an error occurred, we deliberately ROLLBACK.
      // Note: If depth > 1, the inner try/catch already handled the savepoint rollback,
      // so this block only handles the root transaction failure or unhandled critical errors.
      if (this.transactionDepth === 1) {
        // Ensure we don't try to rollback if already disposed or closed
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          // Ignore rollback errors (e.g. if connection closed)
        }
      }
      throw error;
    } finally {
      this.transactionDepth--;

      // If we are the last scope to exit, we are responsible for cleanup.
      if (this.transactionDepth === 0) {
        if (success && !this.isDisposed) {
          try {
            await client.query('COMMIT');
          } catch (commitError) {
            console.error('Failed to commit transaction:', commitError);
          }
        }
        client.release();
        this.activeClient = null;
      }
    }
  }

  /**
   * Set PostgreSQL session variables for Row-Level Security.
   */
  private async setRLSVariables(client: PoolClient): Promise<void> {
    if (!this.authContext) {
      throw new Error('Missing AuthContext');
    }

    const { tenant, user, authType } = this.authContext;

    if (!tenant?.businessId) {
      throw new Error('Missing businessId in AuthContext');
    }

    const userIdValue = user?.userId ?? null;

    await client.query(
      `
      SELECT
        set_config('app.current_business_id', $1, true),
        set_config('app.current_user_id', $2, true),
        set_config('app.auth_type', $3, true);
      `,
      [tenant.businessId, userIdValue, authType],
    );
  }

  /**
   * Cleanup method called by GraphQL Modules when the operation scope ends.
   */
  public async onDestroy(): Promise<void> {
    await this.dispose();
  }

  /**
   * Manually dispose the client.
   */
  public async dispose(): Promise<void> {
    if (this.isDisposed) return;

    if (this.activeClient) {
      try {
        await this.activeClient.query('ROLLBACK');
      } catch (error) {
        console.error('Error disposing TenantAwareDBClient:', error);
      } finally {
        this.activeClient.release();
        this.activeClient = null;
      }
    }
    this.isDisposed = true;
  }

  private ensureNotDisposed() {
    if (this.isDisposed) {
      throw new Error('TenantAwareDBClient is already disposed');
    }
  }
}
