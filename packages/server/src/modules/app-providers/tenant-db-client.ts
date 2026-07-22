import { AsyncLocalStorage } from 'node:async_hooks';
import { Mutex } from 'async-mutex';
import { GraphQLError } from 'graphql';
import { CONTEXT, Inject, Injectable, Optional, Scope } from 'graphql-modules';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { resolveWriteTargetBusinessId } from '../../shared/helpers/auth-scope.js';
import type { AuthContext } from '../../shared/types/auth.js';
import { AuthContextProvider } from '../auth/providers/auth-context.provider.js';
import { DBProvider } from './db.provider.js';

/**
 * Statements that may modify data (or session/schema state). Used to decide
 * whether a stand-alone query must be committed immediately (durability before
 * the response) or may stay in the request-scoped read transaction. Word-bound
 * so column names like `updated_at` don't match. False positives only cost an
 * extra COMMIT + re-BEGIN; false negatives are still committed at request end.
 */
const DATA_MODIFYING_SQL =
  /\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|copy|call|do|refresh|lock|setval|set_config|vacuum|cluster|reindex)\b/i;

export function isDataModifyingQuery(text: string): boolean {
  return DATA_MODIFYING_SQL.test(text);
}

/**
 * TenantAwareDBClient enforces Row-Level Security (RLS) by setting PostgreSQL
 * session variables on a request-scoped transaction.
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
 * Session model (request-scoped):
 * - The first query checks out one pooled connection and opens a transaction
 *   with the RLS variables set once. Subsequent read queries reuse it — one
 *   round trip per query instead of BEGIN/SET/query/COMMIT for each.
 * - Data-modifying stand-alone queries and explicit `transaction()` scopes are
 *   committed immediately on success, so a mutation response always reflects
 *   durable state. The read session re-opens lazily on the next query.
 * - A failed statement aborts the surrounding transaction (Postgres 25P02), so
 *   errors roll the session back and the next query starts a fresh one. Only
 *   uncommitted read-only work is discarded — writes were already committed.
 * - `dispose()` (invoked by dbCleanupPlugin at request/stream end) commits any
 *   open read session and releases the connection back to the pool.
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
  global: true,
})
export class TenantAwareDBClient {
  private mutex = new Mutex();
  private storage = new AsyncLocalStorage<boolean>();
  private activeClient: PoolClient | null = null;
  private sessionOpen = false;
  private transactionDepth = 0;
  private isDisposed = false;
  private authContext: AuthContext | null = null;
  private authContextInitialized = false;

  /**
   * Per-operation mode: commit and release the connection after every
   * top-level query/transaction (the pre-request-scoped behavior). Defaults to
   * true for direct constructions outside the GraphQL request lifecycle (no
   * CONTEXT injection — test harnesses, scripts) where nothing calls
   * dispose(): a held connection would otherwise leak from the pool, keep
   * table locks, and block pool.end().
   */
  public autoRelease: boolean;

  constructor(
    private dbProvider: DBProvider,
    private authContextProvider: AuthContextProvider,
    @Optional() @Inject(CONTEXT) context?: GraphQLModules.GlobalContext,
  ) {
    // Register for end-of-request disposal (commit + release of the
    // request-scoped connection). dbCleanupPlugin drains this list once the
    // response — including any @defer/@stream tail — is fully sent. Absent
    // context (direct construction), fall back to commit-and-release per
    // operation since nothing would ever call dispose().
    if (context) {
      (context.dbClientsToDispose ??= []).push(this);
      this.autoRelease = false;
    } else {
      this.autoRelease = true;
    }
  }

  /**
   * Execute a query with RLS enforcement on the request-scoped session.
   * Data-modifying statements are committed immediately.
   */
  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T> & { rowCount: number }> {
    this.ensureNotDisposed();
    await this.ensureAuthContext();

    if (!this.authContext) {
      throw new GraphQLError(
        'Auth context not available. TenantAwareDBClient requires active authentication.',
        { extensions: { code: 'UNAUTHENTICATED' } },
      );
    }

    // Inside an explicit transaction() scope — run on its client directly.
    if (this.storage.getStore() && this.activeClient) {
      const result = await this.activeClient.query<T>(text, params);
      return { ...result, rowCount: result.rowCount ?? 0 };
    }

    return this.mutex.runExclusive(async () => {
      this.ensureNotDisposed();
      const client = await this.ensureSession();
      try {
        const result = await client.query<T>(text, params);
        if (this.autoRelease || isDataModifyingQuery(text)) {
          await this.endSession('COMMIT');
        }
        return { ...result, rowCount: result.rowCount ?? 0 };
      } catch (error) {
        // The failed statement aborted the transaction; roll back so the next
        // query gets a fresh session instead of 25P02 errors.
        await this.endSession('ROLLBACK');
        throw error;
      } finally {
        if (this.autoRelease) {
          this.releaseClient();
        }
      }
    });
  }

  /**
   * Execute a function within a transaction block.
   * Handles nested transactions using SAVEPOINTs. The outermost scope is
   * committed immediately on success.
   */
  public async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    this.ensureNotDisposed();
    await this.ensureAuthContext();

    if (!this.authContext) {
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
    const client = await this.ensureSession();
    this.transactionDepth++;

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
        result = await fn(client);
        // Outermost scope: commit promptly — explicit transactions are used by
        // mutations whose success response must reflect durable state.
        await this.endSession('COMMIT');
      }

      return result;
    } catch (error) {
      // Nested savepoint rollbacks are handled above; an error reaching the
      // outermost scope rolls back the whole session.
      if (this.transactionDepth === 1) {
        await this.endSession('ROLLBACK');
      }
      throw error;
    } finally {
      this.transactionDepth--;

      if (this.transactionDepth === 0 && this.autoRelease) {
        this.releaseClient();
      }
    }
  }

  /**
   * Ensure the request-scoped session is open: one pooled connection for the
   * whole request, with an open transaction carrying the RLS variables.
   * Always called while holding the mutex.
   */
  private async ensureSession(): Promise<PoolClient> {
    this.activeClient ||= await this.dbProvider.pool.connect();

    if (!this.sessionOpen) {
      const client = this.activeClient;
      try {
        await client.query('BEGIN');
        await this.setRLSVariables(client);
        this.sessionOpen = true;
      } catch (error) {
        // A failed BEGIN/RLS setup leaves the connection in an unknown state —
        // discard it entirely rather than returning it to the pool.
        try {
          await client.query('ROLLBACK');
        } catch {
          // Ignore rollback errors (e.g. if connection closed)
        }
        try {
          client.release(true);
        } catch {
          // Ignore release errors
        }
        this.activeClient = null;
        throw error;
      }
    }

    return this.activeClient;
  }

  /**
   * Close the open transaction (COMMIT or ROLLBACK). The connection is kept
   * for the next session unless the close itself fails, in which case the
   * connection state is unknown and it is destroyed.
   */
  private async endSession(mode: 'COMMIT' | 'ROLLBACK'): Promise<void> {
    if (!this.activeClient || !this.sessionOpen) {
      return;
    }
    this.sessionOpen = false;
    try {
      await this.activeClient.query(mode);
    } catch (error) {
      console.error(`Failed to ${mode} transaction:`, error);
      try {
        this.activeClient.release(true);
      } catch {
        // Ignore release errors
      }
      this.activeClient = null;
    }
  }

  private releaseClient(): void {
    if (this.activeClient) {
      try {
        this.activeClient.release();
      } catch (e) {
        console.error('Error releasing client:', e);
      }
      this.activeClient = null;
    }
  }

  /**
   * Set PostgreSQL session variables for Row-Level Security.
   */
  private async setRLSVariables(client: PoolClient): Promise<void> {
    if (!this.authContext) {
      throw new GraphQLError('Unauthenticated', {
        extensions: {
          code: 'UNAUTHENTICATED',
        },
      });
    }

    const { tenant, user, authType, activeReadScope } = this.authContext ?? {};

    // Write-target: the single business this request owns / writes to, derived
    // from the primary tenant business and the active scope. The auth context
    // already re-points `tenant.businessId` to this value; resolving it here
    // again keeps the RLS session correct as defense-in-depth.
    const businessIdValue = resolveWriteTargetBusinessId(tenant?.businessId, activeReadScope);

    if (!businessIdValue) {
      throw new Error('Missing businessId in AuthContext');
    }

    // API keys use a non-UUID identifier (e.g. "api-key:<id>") for app-level tracing.
    // The DB helper get_current_user_id() casts app.current_user_id to UUID and handles
    // empty string via NULLIF(..., ''), so we pass '' for API key sessions to avoid a
    // runtime cast error while explicitly clearing the setting.
    const userIdValue = authType === 'apiKey' ? '' : (user?.userId ?? null);

    // Read scope: the businesses this request may read from, serialized as a
    // Postgres array literal ('{uuid1,uuid2}') for get_current_business_scope().
    // When empty/absent we pass '' so the DB helper falls back to the single
    // write-target business. Writes remain pinned to app.current_business_id.
    const readScopeValue =
      activeReadScope && activeReadScope.businessIds.length > 0
        ? `{${activeReadScope.businessIds.map(id => `"${id.replace(/"/g, '\\"')}"`).join(',')}}`
        : '';

    await client.query(
      `
      SELECT
        set_config('app.current_business_id', $1, true),
        set_config('app.current_user_id', $2, true),
        set_config('app.auth_type', $3, true),
        set_config('app.current_business_scope', $4, true);
      `,
      [businessIdValue, userIdValue, authType, readScopeValue],
    );
  }

  /**
   * End-of-request cleanup: commit any open read session and release the
   * connection. Invoked by dbCleanupPlugin once the response (including any
   * deferred stream) is fully sent; safe to call manually for direct
   * constructions.
   */
  public async dispose(): Promise<void> {
    if (this.isDisposed) return;

    if (!this.activeClient) {
      this.isDisposed = true;
      return;
    }

    // Use a timeout to prevent hanging indefinitely if a query is stuck
    // holding the mutex — we don't want to block the request handler.
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
      // Mark disposed to prevent further usage, and schedule cleanup for when
      // the in-flight operation finishes — otherwise the held connection would
      // leak from the pool.
      this.isDisposed = true;
      void this.mutex
        .runExclusive(async () => {
          await this.endSession('ROLLBACK');
          this.releaseClient();
        })
        .catch(e2 => {
          console.error('Deferred TenantAwareDBClient cleanup failed:', e2);
        });
      return;
    }

    try {
      if (this.isDisposed) return;

      // Any uncommitted residue is read-only (writes commit promptly), but
      // COMMIT keeps a missed write-classification durable as a safety net.
      await this.endSession('COMMIT');
      this.releaseClient();
      this.isDisposed = true;
    } finally {
      release();
    }
  }

  private ensureNotDisposed() {
    if (this.isDisposed) {
      throw new Error('TenantAwareDBClient is already disposed');
    }
  }

  /**
   * Lazy initialization of auth context on first use.
   * This ensures the async provider is called only when needed.
   */
  private async ensureAuthContext(): Promise<void> {
    if (this.authContextInitialized) {
      return;
    }
    if (!this.authContextProvider) {
      throw new GraphQLError(
        'Auth context not available. TenantAwareDBClient requires active authentication.',
        { extensions: { code: 'UNAUTHENTICATED' } },
      );
    }
    this.authContext = await this.authContextProvider.getAuthContext();
    this.authContextInitialized = true;
  }
}
