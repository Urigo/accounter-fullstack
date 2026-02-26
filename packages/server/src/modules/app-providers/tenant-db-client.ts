import { AsyncLocalStorage } from 'node:async_hooks';
import { Mutex } from 'async-mutex';
import { GraphQLError } from 'graphql';
import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { AUTH_CONTEXT } from '../../shared/tokens.js';
import type { AuthContext } from '../../shared/types/auth.js';
import type { AccounterContext } from '../../shared/types/index.js';
import { DBProvider } from './db.provider.js';

/**
 * TenantAwareDBClient enforces Row-Level Security (RLS) by setting PostgreSQL
 * session variables for every database transaction.
 
 * 
 * RLS Enforcement:
 * - app.current_business_id: Set to the authenticated user's active business
 * - app.current_user_id: Set to the authenticated user's ID (or NULL for API keys)
 * - app.auth_type: Set to 'jwt' or 'apiKey'
 *
 * **Usage:**
 * Inject into Operation-scoped providers via constructor DI:
 *
 * @example
 * @Injectable({ scope: Scope.Operation })
 * class BusinessesProvider {
 *   constructor(private db: TenantAwareDBClient) {}
 *
 *   async getBusinesses() {
 *     return this.db.query('SELECT * FROM businesses')
 *   }
 * }
 *
 * Transaction Management:
 * - Supports nested transactions via SAVEPOINTs
 * - Automatically rolls back on error
 * - Automatically releases connection on dispose
 *
 * **DO NOT** access from Yoga context - use DI injection instead.
 *
 * @throws {GraphQLError} UNAUTHENTICATED if auth context is null
 */
@Injectable({
  scope: Scope.Operation,
})
export class TenantAwareDBClient {
  private mutex = new Mutex();
  private storage = new AsyncLocalStorage<boolean>();
  private activeClient: PoolClient | null = null;
  private transactionDepth = 0;
  private isDisposed = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    private dbProvider: DBProvider,
    @Inject(AUTH_CONTEXT) private authContext: AuthContext,
    // TEMPORARY (Phase 3.2 → 4.8): Fallback to context.currentUser during legacy auth period
    // Removal: Phase 4.8 when Auth0 active and authContext reliably populated
    @Inject(CONTEXT) private context: AccounterContext,
  ) {
    if (this.context.dbClientsToDispose) {
      this.context.dbClientsToDispose.push(this);
    } else {
      // Warning: if 'dbCleanupPlugin' is not loaded (e.g. in tests or misconfiguration),
      // this client will NOT be automatically disposed, leading to connection leaks and potentially exhausted DB pool.
      console.warn(
        'TenantAwareDBClient initialized without dbCleanupPlugin context. ' +
          'Automatic disposal is disabled, which may lead to connection leaks.',
      );
    }
  }

  /**
   * Execute a query with RLS enforcement.
   * If a transaction is already active, uses it.
   * If not, starts a new transaction/session, executes the query, and commits.
   */
  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T> & { rowCount: number }> {
    this.ensureNotDisposed();

    if (
      !this.authContext &&
      // TEMPORARY (Phase 3.2 → 4.8): Fallback to context.currentUser during legacy auth period
      // Removal: Phase 4.8 when Auth0 active and authContext reliably populated
      !this.context?.currentUser?.userId
    ) {
      throw new GraphQLError(
        'Auth context not available. TenantAwareDBClient requires active authentication.',
        { extensions: { code: 'UNAUTHENTICATED' } },
      );
    }

    if (this.storage.getStore() && this.activeClient) {
      return this.activeClient
        .query<T>(text, params)
        .then(result => ({ ...result, rowCount: result.rowCount ?? 0 }));
    }

    return this.transaction(async client => {
      return client
        .query<T>(text, params)
        .then(result => ({ ...result, rowCount: result.rowCount ?? 0 }));
    });
  }

  /**
   * Execute a function within a transaction block.
   * Handles nested transactions using SAVEPOINTs.
   */
  public async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    this.ensureNotDisposed();

    if (
      !this.authContext &&
      // TEMPORARY (Phase 3.2 → 4.8): Fallback to context.currentUser during legacy auth period
      // Removal: Phase 4.8 when Auth0 active and authContext reliably populated
      !this.context?.currentUser?.userId
    ) {
      throw new GraphQLError(
        'Auth context not available. TenantAwareDBClient requires active authentication.',
        { extensions: { code: 'UNAUTHENTICATED' } },
      );
    }

    if (this.storage.getStore()) {
      return this.executeTransactionInternal(fn);
    }

    return this.mutex.runExclusive(() => {
      this.ensureNotDisposed();
      return this.storage.run(true, () => {
        return this.executeTransactionInternal(fn);
      });
    });
  }

  private async executeTransactionInternal<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    // 1. Wait for initialization if in progress
    if (this.initializationPromise) {
      try {
        await this.initializationPromise;
      } catch {
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
        } catch {
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
    if (
      !this.authContext &&
      // TEMPORARY (Phase 3.2 → 4.8): Fallback to context.currentUser during legacy auth period
      // Removal: Phase 4.8 when Auth0 active and authContext reliably populated
      !this.context?.currentUser?.userId
    ) {
      throw new GraphQLError('Unauthenticated', {
        extensions: {
          code: 'UNAUTHENTICATED',
        },
      });
    }

    const { tenant, user, authType } = this.authContext ?? {};

    // TEMPORARY (Phase 3.2 → 4.8): Use currentUser.userId as businessId during legacy auth
    // After Phase 4.7, authContext.tenant.businessId will be populated from Auth0 JWT
    // Removal: Phase 4.8 - delete fallback, require authContext.tenant.businessId
    const businessIdValue = tenant?.businessId ?? this.context?.currentUser?.userId ?? null;
    if (!businessIdValue) {
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
      [businessIdValue, userIdValue, authType],
    );
  }

  /**
   * Manually dispose the client.
   */
  public async dispose(): Promise<void> {
    if (this.isDisposed) return;

    // In normal operation, activeClient should already be null because
    // executeTransactionInternal's finally block releases it.
    // If it's null, we can skip the expensive mutex acquisition.
    if (!this.activeClient) {
      this.isDisposed = true;
      return;
    }

    // If we get here, activeClient is not null, which means the transaction
    // didn't clean up properly. This is an abnormal situation (e.g., connection leak,
    // error in finally block, or dispose called prematurely).
    console.warn(
      'TenantAwareDBClient.dispose() called with activeClient still set. Forcing cleanup.',
    );

    // Use a timeout or race to prevent hanging indefinitely during disposal
    // If a query is stuck, we don't want to block the entire server request handler.
    const TIMEOUT_MS = 5000;
    let release: (() => void) | undefined;

    try {
      release = await Promise.race([
        this.mutex.acquire(),
        new Promise<() => void>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout acquiring mutex')), TIMEOUT_MS),
        ),
      ]);
    } catch (e) {
      console.warn(
        'Timeout acquiring mutex during TenantAwareDBClient disposal. Connection may be in use.',
        e,
      );
      // Don't force cleanup - let executeTransactionInternal's finally block handle it.
      // Forcing cleanup here creates a race condition where we destroy a connection
      // that's actively being used, causing query failures.
      // However, mark as disposed to prevent further usage of this instance.
      this.isDisposed = true;
      return;
    }

    try {
      if (this.isDisposed) return;

      if (this.activeClient) {
        let hadRollbackError = false;
        try {
          // Attempt rollback, but catch errors if connection is busy/closed
          await Promise.race([
            this.activeClient.query('ROLLBACK'),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Rollback timeout')), 1000),
            ),
          ]);
        } catch (error) {
          hadRollbackError = true;
          console.error('Error disposing TenantAwareDBClient (rollback failed):', error);
        } finally {
          try {
            // Only destroy the connection (release(true)) if there was an error.
            // For normal disposal, return it to the pool (release()) to avoid pool exhaustion.
            // pg's release(true) removes the connection from the pool permanently.
            this.activeClient.release(hadRollbackError);
          } catch (e) {
            console.error('Error releasing client during disposal:', e);
          }
          this.activeClient = null;
        }
      }
      this.isDisposed = true;
    } finally {
      if (release) {
        release();
      }
    }
  }

  private ensureNotDisposed() {
    if (this.isDisposed) {
      throw new Error('TenantAwareDBClient is already disposed');
    }
  }
}
