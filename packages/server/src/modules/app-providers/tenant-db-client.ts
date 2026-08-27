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
 * Clients currently holding a checked-out pooled connection, so a leaked one
 * can be found and reclaimed. A client that is never disposed holds that
 * connection *and* an open transaction forever: Postgres reports it as `idle
 * in transaction` with `wait_event = ClientRead`, and the pool loses the slot
 * permanently. Once the leak count reaches the pool's `max`, every request
 * hangs in `pool.connect()`.
 *
 * Membership is tied to holding a connection rather than to the client's
 * lifetime, so the set stays bounded by the pool size no matter how many
 * clients are constructed or whether anything disposes them.
 */
const connectionHolders = new Set<TenantAwareDBClient>();

export interface TenantDbClientStats {
  /** Clients holding a checked-out connection right now. */
  holdingConnection: number;
  /** Longest any holder has gone without issuing a query. */
  maxIdleMs: number;
}

export function getTenantDbClientStats(): TenantDbClientStats {
  const now = Date.now();
  let maxIdleMs = 0;

  for (const client of connectionHolders) {
    maxIdleMs = Math.max(maxIdleMs, now - client.lastActivityAt);
  }

  return { holdingConnection: connectionHolders.size, maxIdleMs };
}

export interface WatchdogOptions {
  /** Force-dispose a client idle for longer than this. */
  maxIdleMs: number;
  /**
   * Ceiling for a client whose GraphQL operation is *still executing*.
   *
   * A request can legitimately go quiet on the database for minutes while it
   * does external work — a document upload fetches the file, pushes it to
   * Cloudinary and waits on OCR before it writes anything. Reclaiming its client
   * on the plain idle rule would leave the request alive but its database
   * connection gone, so the write at the end fails with "already disposed" after
   * all that work. Such a client is therefore given a longer rope; it is not
   * exempt, because the flag saying it is executing lives on a request context
   * that a missed hook could leave set forever.
   *
   * Defaults to {@link maxIdleMs} when unset.
   */
  activeMaxIdleMs?: number;
  /**
   * Ceiling for a client whose caller has already hung up.
   *
   * Disposal is deferred for these (the operation keeps running and still has to
   * write), so this is what bounds that deferral. It is deliberately much
   * tighter than {@link activeMaxIdleMs}: an aborted request that is genuinely
   * still working keeps issuing queries and never comes near it, while one whose
   * execution died with the connection — a query urql cancelled on the next
   * keystroke — goes silent immediately and is reclaimed within a sweep or two
   * rather than being held for the full active ceiling.
   *
   * Must stay above the statement timeout: a long query only bumps activity at
   * its start and end, so a shorter ceiling would reclaim a connection mid-query.
   */
  abortedMaxIdleMs?: number;
  /** How often to sweep. */
  intervalMs: number;
  onLeak?: (info: {
    idleMs: number;
    lastQuery: string | null;
    operationInFlight: boolean;
    requestAborted: boolean;
  }) => void;
}

/**
 * Last line of defence against a connection leak.
 *
 * Disposal is driven by request lifecycle hooks, and the whole class of bug
 * this guards against is a hook that does not fire. So the watchdog trusts no
 * hook: it sweeps every live client and reclaims any that has gone quiet for
 * longer than a request could plausibly stay quiet.
 *
 * The predicate is *idle* time (since the last query), not total age — a slow
 * but healthy request keeps querying, while a leaked client never issues
 * another statement, so its idle time grows without bound.
 */
export function startTenantDbClientWatchdog(options: WatchdogOptions): { stop: () => void } {
  const activeMaxIdleMs = Math.max(options.activeMaxIdleMs ?? options.maxIdleMs, options.maxIdleMs);
  const abortedMaxIdleMs = options.abortedMaxIdleMs ?? options.maxIdleMs;

  const timer = setInterval(() => {
    const now = Date.now();
    for (const client of connectionHolders) {
      const operationInFlight = client.operationInFlight;
      const requestAborted = client.requestAborted;
      // An aborted request is on the short leash whether or not it is still
      // executing — that is the whole point of the tighter ceiling.
      const limit = requestAborted
        ? abortedMaxIdleMs
        : operationInFlight
          ? activeMaxIdleMs
          : options.maxIdleMs;
      if (now - client.lastActivityAt < limit) {
        continue;
      }

      const info = {
        idleMs: now - client.lastActivityAt,
        lastQuery: client.lastQuery,
        operationInFlight,
        requestAborted,
      };
      options.onLeak?.(info);
      void client.dispose().catch(error => {
        console.error('Watchdog failed to dispose leaked TenantAwareDBClient:', error);
      });
    }
  }, options.intervalMs);

  // Never hold the event loop open just to sweep.
  timer.unref();

  return { stop: () => clearInterval(timer) };
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
  private disposalRequested = false;
  private authContext: AuthContext | null = null;
  private authContextInitialized = false;
  private clientErrorListener: ((error: Error) => void) | null = null;
  private readonly context: GraphQLModules.GlobalContext | undefined;

  /** Timestamp of the last query issued, for leak detection. See the watchdog. */
  public lastActivityAt = Date.now();
  /** First line of the last statement issued, to identify a leak's origin. */
  public lastQuery: string | null = null;

  public get holdsConnection(): boolean {
    return this.activeClient !== null;
  }

  /**
   * Whether the GraphQL operation that owns this client is still executing.
   *
   * Set by `dbCleanupPlugin` around execution. It is what tells a request that
   * has gone quiet on the database — because it is fetching a file or waiting on
   * OCR — apart from one that has gone away.
   */
  public get operationInFlight(): boolean {
    return this.context?.executionInFlight === true;
  }

  /**
   * Whether the caller of the owning request has hung up. Set when a deferred
   * disposal is recorded; puts the client on the watchdog's short leash, which
   * is what bounds the deferral.
   */
  public get requestAborted(): boolean {
    return this.disposalRequested;
  }

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
    this.context = context;
    if (context) {
      (context.dbClientsToDispose ??= []).push(this);
      this.autoRelease = false;
    } else {
      this.autoRelease = true;
    }
  }

  /** Records query activity so the watchdog can tell a busy client from a leaked one. */
  private markActivity(text: string): void {
    this.lastActivityAt = Date.now();
    this.lastQuery = text.trim().split('\n')[0]?.slice(0, 120) ?? null;
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
      this.markActivity(text);
      const result = await this.activeClient.query<T>(text, params);
      this.markActivity(text);
      return { ...result, rowCount: result.rowCount ?? 0 };
    }

    try {
      return await this.queryOnSession<T>(text, params);
    } finally {
      // A disposal deferred while this operation was in flight (a client-side
      // abort) comes due once the work it was protecting has landed.
      this.disposeIfRequested();
    }
  }

  private async queryOnSession<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T> & { rowCount: number }> {
    return this.mutex.runExclusive(async () => {
      this.ensureNotDisposed();
      const client = await this.ensureSession();
      try {
        this.markActivity(text);
        const result = await client.query<T>(text, params);
        this.markActivity(text);
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
      if (this.transactionDepth === 0) {
        this.disposeIfRequested();
      }
    }
  }

  /**
   * Ensure the request-scoped session is open: one pooled connection for the
   * whole request, with an open transaction carrying the RLS variables.
   * Always called while holding the mutex.
   */
  private async ensureSession(): Promise<PoolClient> {
    if (!this.activeClient) {
      const client = await this.dbProvider.pool.connect();

      // pg removes its own idle-client error handler while a client is checked
      // out, leaving the borrower responsible for it. Without a listener here,
      // a connection reset — including Postgres terminating the session via
      // `idle_in_transaction_session_timeout` — emits an unhandled 'error'
      // event, which surfaces as an uncaughtException and takes down the whole
      // process. Absorb it and let the pool discard the connection instead.
      const onClientError = (error: Error) => {
        console.error('[db] Error on checked-out client, discarding connection:', error);
        this.sessionOpen = false;
        // Hand the connection back to the pool as destroyed. Merely dropping
        // our own reference would leave the pool counting it as checked out
        // forever — losing the slot permanently, which is precisely the leak
        // this class exists to prevent.
        this.releaseClient(true);
      };
      client.on('error', onClientError);
      this.clientErrorListener = onClientError;
      this.activeClient = client;
      connectionHolders.add(this);
    }

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
        this.releaseClient(true);
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
      this.releaseClient(true);
    }
  }

  private releaseClient(destroy = false): void {
    connectionHolders.delete(this);
    if (this.activeClient) {
      if (this.clientErrorListener) {
        this.activeClient.removeListener('error', this.clientErrorListener);
        this.clientErrorListener = null;
      }
      try {
        this.activeClient.release(destroy);
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
   * Hand the pooled connection back for the duration of long *non-database*
   * work, without ending the client's life.
   *
   * Document ingestion is the motivating case: between one query and the next it
   * downloads a file, uploads it to Cloudinary and waits on OCR — minutes during
   * which the connection would otherwise sit checked out and `idle in
   * transaction`, occupying a pool slot and pinning the oldest transaction
   * snapshot. Any open read session is committed (writes commit as they go
   * anyway) and a fresh one opens lazily on the next query.
   *
   * A no-op inside an explicit `transaction()` scope, whose atomicity depends on
   * keeping the connection, and a no-op once disposed.
   */
  public async releaseIdleConnection(): Promise<void> {
    // Checked before touching the mutex: inside a transaction() scope the mutex
    // is already held by this same async context, so acquiring it would deadlock.
    if (this.isDisposed || this.storage.getStore() || !this.activeClient) {
      return;
    }

    await this.mutex.runExclusive(async () => {
      if (this.isDisposed || this.transactionDepth > 0 || !this.activeClient) {
        return;
      }
      await this.endSession('COMMIT');
      this.releaseClient();
    });
  }

  /**
   * Dispose, but not out from under a request that is still running.
   *
   * Used for client-side aborts: the HTTP connection going away says nothing
   * about the mutation still executing on this server, and JavaScript cannot
   * cancel the promise chain it is running on. Disposing there is what turned a
   * timed-out document upload into an "already disposed" failure at the final
   * INSERT — minutes of fetching and OCR thrown away at the last step, with the
   * charge left untouched.
   *
   * So while the operation is in flight the disposal is only *recorded*; the
   * work finishes and writes, and the client is released at the next natural
   * point — the end-of-execution hook, or the completion of its final query. The
   * watchdog remains the backstop for a request that never completes at all.
   *
   * @returns whether disposal was deferred (`true`) rather than performed.
   */
  public async disposeWhenIdle(): Promise<boolean> {
    if (this.isDisposed) return false;

    if (!this.operationInFlight) {
      await this.dispose();
      return false;
    }

    this.disposalRequested = true;
    return true;
  }

  /** Run a disposal that was deferred by {@link disposeWhenIdle}, if it is now due. */
  private disposeIfRequested(): void {
    if (!this.disposalRequested || this.isDisposed || this.operationInFlight) {
      return;
    }
    this.disposalRequested = false;
    void this.dispose().catch(error => {
      console.error('Deferred TenantAwareDBClient disposal failed:', error);
    });
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
      this.markDisposed();
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
      this.markDisposed();
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
      this.markDisposed();
    } finally {
      release();
    }
  }

  private markDisposed(): void {
    this.isDisposed = true;
    connectionHolders.delete(this);
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
