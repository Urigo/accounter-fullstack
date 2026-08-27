import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import type { AuthContext } from '../../../shared/types/auth.js';
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
  return new TenantAwareDBClient(
    dbProvider,
    authContextProvider,
    context ?? ({} as GraphQLModules.GlobalContext),
  );
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
    const context = { executionInFlight: true } as GraphQLModules.GlobalContext;
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
    const context = { executionInFlight: true } as GraphQLModules.GlobalContext;
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
    const context = { executionInFlight: true } as GraphQLModules.GlobalContext;
    const client = buildClient(poolClient, context);
    await client.query('SELECT 1');

    // The caller aborted (MCP/urql timeout) while the mutation is mid-flight.
    await expect(client.disposeWhenIdle()).resolves.toBe(true);

    // The write that the abort must not have cost us.
    await expect(client.query('INSERT INTO documents DEFAULT VALUES')).resolves.toBeDefined();

    // Execution ends; the deferred disposal comes due on the next query boundary.
    context.executionInFlight = false;
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
    const client = buildClient(poolClient, {
      executionInFlight: true,
    } as GraphQLModules.GlobalContext);
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
});
