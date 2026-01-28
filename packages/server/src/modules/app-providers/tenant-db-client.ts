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

    if (this.activeClient) {
      // Nested transaction
      this.transactionDepth++;
      const savepointName = `sp_${this.transactionDepth}`;
      try {
        await this.activeClient.query(`SAVEPOINT ${savepointName}`);
        const result = await fn(this.activeClient);
        await this.activeClient.query(`RELEASE SAVEPOINT ${savepointName}`);
        return result;
      } catch (error) {
        await this.activeClient.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        throw error;
      } finally {
        this.transactionDepth--;
      }
    }

    // Top-level transaction
    const client = await this.dbProvider.pool.connect();
    this.activeClient = client;

    try {
      await client.query('BEGIN');
      await this.setRLSVariables(client);

      const result = await fn(client);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      this.activeClient = null;
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
      SET LOCAL app.current_business_id = $1;
      SET LOCAL app.current_user_id = $2;
      SET LOCAL app.auth_type = $3;
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
        this.activeClient.release();
      } catch (error) {
        console.error('Error disposing TenantAwareDBClient:', error);
      } finally {
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
