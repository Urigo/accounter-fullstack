import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import {
  isConnectionLevelError,
  withTenantContext,
} from '../helpers/email-ingestion-tenant-context.helper.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FakeClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

function connectionError(message = 'Connection terminated unexpectedly'): Error {
  return new Error(message);
}

/**
 * A pool handing out a scripted sequence of clients, so "the first connection is
 * dead, the second is fine" — the exact shape of a connection killed while idle
 * (#4348) — can be reproduced without a database.
 */
function makePool(clients: FakeClient[]): { pool: Pool; connect: ReturnType<typeof vi.fn> } {
  const connect = vi.fn().mockImplementation(() => {
    const next = clients.shift();
    if (!next) throw new Error('pool ran out of scripted clients');
    return Promise.resolve(next as unknown as PoolClient);
  });
  return { pool: { connect } as unknown as Pool, connect };
}

function healthyClient(): FakeClient {
  return { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
}

/** A client whose first statement (BEGIN) fails because the socket is dead. */
function deadClient(err: Error = connectionError()): FakeClient {
  return { query: vi.fn().mockRejectedValue(err), release: vi.fn() };
}

// ---------------------------------------------------------------------------
// isConnectionLevelError
// ---------------------------------------------------------------------------

describe('isConnectionLevelError', () => {
  it.each([
    'Connection terminated unexpectedly',
    'Client has encountered a connection error and is not queryable',
    'server closed the connection unexpectedly',
  ])('recognizes %s', message => {
    expect(isConnectionLevelError(new Error(message))).toBe(true);
  });

  it('recognizes socket-level error codes', () => {
    const err = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    expect(isConnectionLevelError(err)).toBe(true);
  });

  // `pg` also surfaces connection failures the *server* reported, as SQLSTATE
  // codes rather than Node errnos — with a message that need not match any of the
  // text fragments above.
  it.each([
    ['08000', 'connection_exception'],
    ['08003', 'connection_does_not_exist'],
    ['08006', 'connection_failure'],
    ['08P01', 'protocol_violation'],
    ['57P01', 'terminating connection due to administrator command'],
  ])('recognizes SQLSTATE %s (%s)', (code, message) => {
    expect(isConnectionLevelError(Object.assign(new Error(message), { code }))).toBe(true);
  });

  // 08007 is in the connection-exception class but means the connection dropped
  // while the transaction was being *resolved* — it may have committed. Retrying
  // it could double-apply the work, so it must be classified as non-retryable
  // despite sitting alongside the codes above.
  it('does NOT treat 08007 (transaction_resolution_unknown) as retryable', () => {
    const err = Object.assign(new Error('transaction resolution unknown'), { code: '08007' });
    expect(isConnectionLevelError(err)).toBe(false);
  });

  // A statement error must never be retried: the query was rejected on purpose.
  it.each([
    'duplicate key value violates unique constraint',
    'new row violates row-level security policy',
    'syntax error at or near "SELCT"',
  ])('does not treat a statement error as connection-level: %s', message => {
    expect(isConnectionLevelError(new Error(message))).toBe(false);
  });

  it('does not treat a non-Error as connection-level', () => {
    expect(isConnectionLevelError('Connection terminated')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// withTenantContext
// ---------------------------------------------------------------------------

describe('withTenantContext', () => {
  it('pins the tenant transaction-locally and commits', async () => {
    const client = healthyClient();
    const { pool } = makePool([client]);

    const result = await withTenantContext(pool, 'tenant-1', async () => 'done');

    expect(result).toBe('done');
    const statements = client.query.mock.calls.map(c => c[0] as string);
    expect(statements[0]).toBe('BEGIN');
    // `true` is the is_local flag: SET LOCAL, cleared on COMMIT, so the pinned
    // tenant never leaks to the pooled connection's next user.
    expect(statements[1]).toContain('set_config');
    expect(client.query.mock.calls[1][1]).toEqual(['tenant-1']);
    expect(statements.at(-1)).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  // The #4348 signature: a connection killed by the DB or a middlebox while it sat
  // idle stays in the pool, and the next checkout fails immediately. Before this
  // retry that failure reached the gateway as a non-retryable GraphQL error and
  // the inbound email was dropped with no durable record anywhere.
  it('retries once on a fresh connection when a pooled connection is handed out dead', async () => {
    const dead = deadClient();
    const healthy = healthyClient();
    const { pool, connect } = makePool([dead, healthy]);
    const fn = vi.fn().mockResolvedValue('recovered');

    const result = await withTenantContext(pool, 'tenant-1', fn);

    expect(result).toBe('recovered');
    expect(connect).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledTimes(1); // only the second, healthy attempt ran it
    // The dead connection is released *with* its error so the pool destroys it
    // instead of handing it to the next caller.
    expect(dead.release).toHaveBeenCalledWith(expect.any(Error));
  });

  it('retries at most once — a second connection-level failure propagates', async () => {
    const { pool, connect } = makePool([deadClient(), deadClient()]);

    await expect(withTenantContext(pool, 'tenant-1', vi.fn())).rejects.toThrow(
      'Connection terminated unexpectedly',
    );
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a statement error — it would repeat the rejected work', async () => {
    const client: FakeClient = {
      query: vi.fn().mockImplementation((text: string) => {
        if (text === 'BEGIN' || text.includes('set_config') || text === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };
    const { pool, connect } = makePool([client]);
    const fn = vi.fn().mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    await expect(withTenantContext(pool, 'tenant-1', fn)).rejects.toThrow('duplicate key');
    expect(connect).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  // Once COMMIT is in flight the outcome is unknown — the transaction may have
  // committed on the server before the socket died — so replaying it could
  // double-apply the work.
  it('does NOT retry when the connection dies during COMMIT', async () => {
    const client: FakeClient = {
      query: vi.fn().mockImplementation((text: string) => {
        if (text === 'COMMIT') return Promise.reject(connectionError());
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };
    const { pool, connect } = makePool([client]);

    await expect(withTenantContext(pool, 'tenant-1', vi.fn())).rejects.toThrow(/outcome unknown/);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases the connection when the callback throws', async () => {
    const client = healthyClient();
    const { pool } = makePool([client]);

    await expect(
      withTenantContext(pool, 'tenant-1', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
