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

function buildClient(poolClient: FakePoolClient) {
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
  return new TenantAwareDBClient(dbProvider, authContextProvider, {} as GraphQLModules.GlobalContext);
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
