import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import type { AuthContext } from '../../../shared/types/auth.js';
import type { DbRequestState } from '../../../shared/types/index.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { DBProvider } from '../db.provider.js';
import {
  getTenantDbClientStats,
  startTenantDbClientWatchdog,
  TenantAwareDBClient,
} from '../tenant-db-client.js';

/**
 * A PoolClient that behaves like the real thing in the ways that matter here:
 * it is an EventEmitter, and an 'error' with no listener throws.
 */
class FakePoolClient extends EventEmitter {
  query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  release = vi.fn();
}

const authContext: AuthContext = {
  authType: 'jwt',
  token: 'token',
  user: {
    userId: 'user-123',
    roleId: 'admin',
    email: 'test@test.com',
    permissions: [],
    emailVerified: true,
    permissionsVersion: 1,
  },
  tenant: { businessId: 'business-456', roleId: 'admin' },
  activeReadScope: { businessIds: ['business-456'] },
} as unknown as AuthContext;

/** A context carrying live request state, as `dbCleanupPlugin` sets it up. */
function requestContext(state: Partial<DbRequestState> = {}) {
  return {
    dbRequest: {
      clientsToDispose: [],
      executionInFlight: false,
      disposed: false,
      requestId: 'req',
      operationName: null,
      ...state,
    },
  } as unknown as GraphQLModules.GlobalContext & { dbRequest: DbRequestState };
}

function buildClient(poolClient: FakePoolClient, context?: GraphQLModules.GlobalContext) {
  const dbProvider = {
    pool: { connect: vi.fn().mockResolvedValue(poolClient as unknown as PoolClient) } as unknown as
      | Pool
      | undefined,
  } as unknown as DBProvider;

  const authContextProvider = {
    getAuthContext: () => Promise.resolve(authContext),
  } as AuthContextProvider;

  // A GraphQL context puts the client in request-scoped mode: the connection is
  // held until dispose(), which is exactly the lifecycle that can leak.
  return new TenantAwareDBClient(dbProvider, authContextProvider, context ?? requestContext());
}

describe('TenantAwareDBClient connection-leak safeguards', () => {
  let poolClient: FakePoolClient;

  beforeEach(() => {
    poolClient = new FakePoolClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('absorbs errors on a checked-out client instead of crashing the process', async () => {
    const client = buildClient(poolClient);
    await client.query('SELECT 1');

    // pg drops its own idle error handler while a client is checked out, so an
    // unhandled 'error' here would surface as an uncaughtException and take
    // down the server — which is exactly what Postgres terminating an
    // abandoned session (idle_in_transaction_session_timeout) would trigger.
    expect(() => poolClient.emit('error', new Error('connection terminated'))).not.toThrow();

    await client.dispose();
  });

  it('returns a broken connection to the pool as destroyed', async () => {
    const client = buildClient(poolClient);
    await client.query('SELECT 1');
    expect(getTenantDbClientStats().holdingConnection).toBe(1);

    poolClient.emit('error', new Error('connection terminated'));

    // Dropping the reference without releasing would leave the pool counting
    // the connection as checked out forever — a permanently lost slot.
    expect(poolClient.release).toHaveBeenCalledWith(true);
    expect(getTenantDbClientStats().holdingConnection).toBe(0);
  });

  it('reports a held connection in the stats, and stops once released', async () => {
    expect(getTenantDbClientStats().holdingConnection).toBe(0);

    const client = buildClient(poolClient);
    await client.query('SELECT 1');

    expect(getTenantDbClientStats().holdingConnection).toBe(1);

    await client.dispose();
    expect(getTenantDbClientStats().holdingConnection).toBe(0);
  });

  it('reclaims a connection whose owner vanished without disposing it', async () => {
    vi.useFakeTimers();
    const client = buildClient(poolClient);
    await client.query('SELECT 1');

    const onLeak = vi.fn();
    const watchdog = startTenantDbClientWatchdog({ maxIdleMs: 1000, intervalMs: 100, onLeak });

    // Nothing disposes the client — the leak this whole change exists to stop.
    await vi.advanceTimersByTimeAsync(1500);

    expect(onLeak).toHaveBeenCalledTimes(1);
    expect(onLeak.mock.calls[0]![0].lastQuery).toBe('SELECT 1');
    await vi.waitFor(() => expect(poolClient.release).toHaveBeenCalled());

    watchdog.stop();
  });

  it('leaves a quiet client alone while its operation is still executing', async () => {
    // A document upload goes minutes without a query while it downloads the
    // file and waits on OCR. Reclaiming its connection there leaves the request
    // running with nothing to write through, which is exactly how an upload
    // ended at "TenantAwareDBClient is already disposed" on its final INSERT.
    vi.useFakeTimers();
    const context = requestContext({ executionInFlight: true });
    const client = buildClient(poolClient, context);
    await client.query('SELECT 1');

    const onLeak = vi.fn();
    const watchdog = startTenantDbClientWatchdog({
      maxIdleMs: 1000,
      activeMaxIdleMs: 10_000,
      intervalMs: 100,
      onLeak,
    });

    await vi.advanceTimersByTimeAsync(5000);
    expect(onLeak).not.toHaveBeenCalled();

    // Still bounded, though: the flag lives on a request context a missed hook
    // could leave set forever.
    await vi.advanceTimersByTimeAsync(6000);
    expect(onLeak).toHaveBeenCalledTimes(1);
    expect(onLeak.mock.calls[0]![0].operationInFlight).toBe(true);

    watchdog.stop();
  });

  it('puts a client on a short leash once its caller has hung up', async () => {
    // Deferring disposal past an abort is what saves the upload's final INSERT,
    // but a request whose execution died along with the abort would otherwise
    // sit on its connection for the whole active ceiling. It stays quiet, so the
    // tighter ceiling reclaims it; a request still doing real work keeps
    // querying and never reaches it.
    vi.useFakeTimers();
    const context = requestContext({ executionInFlight: true });
    const client = buildClient(poolClient, context);
    await client.query('SELECT 1');
    await client.disposeWhenIdle();

    const onLeak = vi.fn();
    const watchdog = startTenantDbClientWatchdog({
      maxIdleMs: 5000,
      activeMaxIdleMs: 60_000,
      abortedMaxIdleMs: 2000,
      intervalMs: 100,
      onLeak,
    });

    await vi.advanceTimersByTimeAsync(2500);

    expect(onLeak).toHaveBeenCalledTimes(1);
    expect(onLeak.mock.calls[0]![0].requestAborted).toBe(true);
    await vi.waitFor(() => expect(poolClient.release).toHaveBeenCalled());

    watchdog.stop();
  });

  it('keeps serving queries after a disposal deferred by an in-flight operation', async () => {
    const context = requestContext({ executionInFlight: true });
    const client = buildClient(poolClient, context);
    await client.query('SELECT 1');

    // The caller aborted (MCP/urql timeout) while the mutation is mid-flight.
    await expect(client.disposeWhenIdle()).resolves.toBe(true);

    // The write that the abort must not have cost us.
    await expect(client.query('INSERT INTO documents DEFAULT VALUES')).resolves.toBeDefined();

    // Execution ends; the deferred disposal comes due on the next query boundary.
    context.dbRequest.executionInFlight = false;
    await client.query('SELECT 2');
    await vi.waitFor(() => expect(poolClient.release).toHaveBeenCalled());
  });

  it('disposes immediately when nothing is in flight', async () => {
    const client = buildClient(poolClient);
    await client.query('SELECT 1');

    await expect(client.disposeWhenIdle()).resolves.toBe(false);

    await expect(client.query('SELECT 2')).rejects.toThrow('already disposed');
  });

  it('hands the connection back for long external work, then reopens on demand', async () => {
    const client = buildClient(poolClient, requestContext({ executionInFlight: true }));
    await client.query('SELECT 1');
    expect(getTenantDbClientStats().holdingConnection).toBe(1);

    // Nothing needs the DB while the file is fetched, uploaded and OCR'd — and
    // holding it there risks both the watchdog and Postgres's own
    // idle_in_transaction timeout killing a healthy request.
    await client.releaseIdleConnection();
    expect(poolClient.release).toHaveBeenCalled();
    expect(getTenantDbClientStats().holdingConnection).toBe(0);

    // The client itself is untouched: the next query opens a fresh session.
    await expect(client.query('SELECT 2')).resolves.toBeDefined();
    expect(getTenantDbClientStats().holdingConnection).toBe(1);

    await client.dispose();
  });

  it('leaves a slow but active client alone', async () => {
    vi.useFakeTimers();
    const client = buildClient(poolClient);
    await client.query('SELECT 1');

    const onLeak = vi.fn();
    const watchdog = startTenantDbClientWatchdog({ maxIdleMs: 1000, intervalMs: 100, onLeak });

    // A healthy long request keeps issuing queries; only silence indicates a leak.
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(500);
      await client.query('SELECT 2');
    }

    expect(onLeak).not.toHaveBeenCalled();

    watchdog.stop();
    await client.dispose();
  });

  it('holds no connection when constructed after request cleanup', async () => {
    // Work that outlived its request constructs a client after dbCleanupPlugin
    // already drained the list. Registered there, nothing would ever dispose it
    // and it would sit `idle in transaction` until Postgres killed it (#4871).
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const context = requestContext({
      disposed: true,
      operationName: 'VatReport',
      requestId: 'req-1',
    });
    const before = getTenantDbClientStats().holdingConnection;

    const client = buildClient(poolClient, context);
    await client.query('SELECT 1');

    expect(context.dbRequest.clientsToDispose).toEqual([]);
    expect(client.autoRelease).toBe(true);
    expect(poolClient.release).toHaveBeenCalled();
    expect(getTenantDbClientStats().holdingConnection).toBe(before);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('operation=VatReport request=req-1'));
    stderr.mockRestore();
  });

  it('names the operation and request of a reclaimed client', async () => {
    vi.useFakeTimers();
    const context = requestContext({ operationName: 'ChargesScreen', requestId: 'req-2' });
    const client = buildClient(poolClient, context);
    await client.query('SELECT 1');

    const onLeak = vi.fn();
    const watchdog = startTenantDbClientWatchdog({ maxIdleMs: 1000, intervalMs: 100, onLeak });
    await vi.advanceTimersByTimeAsync(1500);

    expect(onLeak).toHaveBeenCalledWith(
      expect.objectContaining({ operationName: 'ChargesScreen', requestId: 'req-2' }),
    );

    watchdog.stop();
    await vi.waitFor(() => expect(poolClient.release).toHaveBeenCalled());
  });

  it('logs a killed session as one line naming the operation, without the pg stack', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const client = buildClient(
      poolClient,
      requestContext({ operationName: 'VatReport', requestId: 'req-3' }),
    );
    await client.query('SELECT 1');

    const error = Object.assign(
      new Error('terminating connection due to idle-in-transaction timeout'),
      { code: '25P03' },
    );
    poolClient.emit('error', error);

    const lines = stderr.mock.calls.map(([chunk]) => String(chunk));
    const line = lines.find(l => l.startsWith('[db] Error on checked-out client'));
    expect(line).toBeDefined();
    expect(line).toContain('code=25P03');
    expect(line).toContain('lastQuery=SELECT 1');
    expect(line).toContain('operation=VatReport request=req-3');
    expect(line!.trimEnd()).not.toContain('\n');
    stderr.mockRestore();
  });

  it('holds no connection when built a context without request state', async () => {
    // What graphql-modules hands a client constructed after its operation was
    // destroyed: a fresh copy of a context whose fields are all gone.
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const before = getTenantDbClientStats().holdingConnection;

    const client = buildClient(poolClient, { moduleId: 'charges' } as never);
    await client.query('SELECT 1');

    expect(client.autoRelease).toBe(true);
    expect(poolClient.release).toHaveBeenCalled();
    expect(getTenantDbClientStats().holdingConnection).toBe(before);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('outside a live request'));
    stderr.mockRestore();
  });

  it('keeps a long transaction alive while its callback queries the raw connection', async () => {
    // Callbacks such as the SHAAM import query the PoolClient they are handed,
    // not TenantAwareDBClient.query, so those statements must count as activity.
    vi.useFakeTimers();
    const client = buildClient(poolClient);
    await client.query('SELECT 1');

    const onLeak = vi.fn();
    const watchdog = startTenantDbClientWatchdog({ maxIdleMs: 1000, intervalMs: 100, onLeak });

    await client.transaction(async tx => {
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(500);
        await tx.query('INSERT INTO businesses DEFAULT VALUES');
      }
    });

    expect(onLeak).not.toHaveBeenCalled();
    expect(client.lastQuery).toBe('INSERT INTO businesses DEFAULT VALUES');

    watchdog.stop();
    await client.dispose();
  });
});

