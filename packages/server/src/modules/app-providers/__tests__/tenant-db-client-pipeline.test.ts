import type { Pool, PoolClient } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLogWriter } from '../../../observability/log.js';
import type { AuthContext } from '../../../shared/types/auth.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { DBProvider } from '../db.provider.js';
import { TenantAwareDBClient } from '../tenant-db-client.js';

/**
 * A request's reads overlap on its one connection (pg pipeline mode); everything that changes the
 * session — writes, `transaction()`, closing it — still runs alone.
 */

type Pending = { text: string; resolve: (rows?: unknown[]) => void; reject: (error: unknown) => void };

let connection: PoolClient & { pipeline?: boolean };
/** Statements sent and not answered yet, in the order they went out. */
let pending: Pending[];
/** Every statement sent, in order. */
let sent: string[];
let client: TenantAwareDBClient;

/** Session plumbing answers at once; the statements under test wait for the test to answer. */
const AUTO_ANSWERED = /^(BEGIN|COMMIT|ROLLBACK)$|set_config/;

function makeClient(): TenantAwareDBClient {
  const authContext = {
    authType: 'jwt',
    token: 'token',
    user: { userId: 'user-1', roleId: 'admin', email: 'a@b.c', permissions: [] },
    tenant: { businessId: 'business-1', roleId: 'admin' },
    activeReadScope: { businessIds: ['business-1'] },
  } as unknown as AuthContext;
  const dbProvider = {
    pool: { connect: vi.fn(async () => connection) } as unknown as Pool,
  } as unknown as DBProvider;
  const context = {
    dbRequest: {
      clientsToDispose: [],
      executionInFlight: true,
      disposed: false,
      requestId: 'req',
      operationName: null,
    },
  } as unknown as GraphQLModules.GlobalContext;
  return new TenantAwareDBClient(
    dbProvider,
    { getAuthContext: async () => authContext } as AuthContextProvider,
    context,
  );
}

/** Lets queued promise callbacks run, so the statements they lead to are sent. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function answer(text: string, rows: unknown[] = [{ text }]): void {
  const index = pending.findIndex(item => item.text === text);
  expect(index, `"${text}" is waiting for an answer`).toBeGreaterThanOrEqual(0);
  pending.splice(index, 1)[0]!.resolve(rows);
}

function fail(text: string, error: unknown): void {
  const index = pending.findIndex(item => item.text === text);
  expect(index, `"${text}" is waiting for an answer`).toBeGreaterThanOrEqual(0);
  pending.splice(index, 1)[0]!.reject(error);
}

const pgError = (code: string, message: string) => Object.assign(new Error(message), { code });

/** Log records written during the test. */
let logged: Array<Record<string, unknown>>;

afterEach(() => {
  setLogWriter();
});

beforeEach(() => {
  logged = [];
  setLogWriter(line => {
    logged.push(JSON.parse(line) as Record<string, unknown>);
  });
  pending = [];
  sent = [];
  connection = {
    query: vi.fn((text: string) => {
      sent.push(text.trim());
      if (AUTO_ANSWERED.test(text.trim())) {
        return Promise.resolve({ rows: [] });
      }
      return new Promise((resolve, reject) => {
        pending.push({
          text: text.trim(),
          resolve: rows => resolve({ rows, rowCount: rows?.length ?? 0 }),
          reject,
        });
      });
    }),
    release: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  } as unknown as PoolClient & { pipeline?: boolean };
  client = makeClient();
});

describe('TenantAwareDBClient read pipelining', () => {
  it('sends independent reads without waiting for each other', async () => {
    const reads = ['SELECT 1', 'SELECT 2', 'SELECT 3'].map(text => client.query(text));
    await settle();

    // All three are on the wire before any is answered, after one BEGIN for the session.
    expect(pending.map(item => item.text)).toEqual(['SELECT 1', 'SELECT 2', 'SELECT 3']);
    expect(sent.filter(text => text === 'BEGIN')).toHaveLength(1);

    answer('SELECT 3');
    answer('SELECT 1');
    answer('SELECT 2');
    const results = await Promise.all(reads);
    expect(results.map(result => result.rows)).toEqual([
      [{ text: 'SELECT 1' }],
      [{ text: 'SELECT 2' }],
      [{ text: 'SELECT 3' }],
    ]);
  });

  it('puts the connection in pipeline mode while it holds it, and back before releasing it', async () => {
    const read = client.query('SELECT 1');
    await settle();
    expect(connection.pipeline).toBe(true);
    answer('SELECT 1');
    await read;

    await client.dispose();
    expect(connection.pipeline).toBe(false);
    expect(connection.release).toHaveBeenCalled();
  });

  it('runs a write alone: after the reads in flight, and before the reads that came after it', async () => {
    const before = client.query('SELECT before');
    await settle();
    const write = client.query('UPDATE accounter_schema.charges SET user_description = $1', ['x']);
    const after = client.query('SELECT after');
    await settle();

    // The write waits for the read in flight; the later read waits for the write.
    expect(pending.map(item => item.text)).toEqual(['SELECT before']);
    answer('SELECT before');
    await settle();
    expect(pending.map(item => item.text)).toEqual([
      'UPDATE accounter_schema.charges SET user_description = $1',
    ]);

    answer('UPDATE accounter_schema.charges SET user_description = $1');
    await settle();
    // Committed at once, then the later read opens a fresh session.
    expect(sent.slice(sent.indexOf('UPDATE accounter_schema.charges SET user_description = $1'))).toEqual([
      'UPDATE accounter_schema.charges SET user_description = $1',
      'COMMIT',
      'BEGIN',
      expect.stringContaining('set_config'),
      'SELECT after',
    ]);
    answer('SELECT after');
    await Promise.all([before, write, after]);
  });

  it('runs a transaction() scope alone', async () => {
    const read = client.query('SELECT before');
    await settle();
    let insideRan = false;
    const transaction = client.transaction(async () => {
      insideRan = true;
    });
    await settle();
    expect(insideRan).toBe(false);

    answer('SELECT before');
    await Promise.all([read, transaction]);
    expect(insideRan).toBe(true);
  });

  it('rolls back once when a read fails, and retries the reads that failed only because of it', async () => {
    const broken = client.query('SELECT broken');
    const innocent = client.query('SELECT innocent');
    await settle();

    fail('SELECT broken', pgError('42703', 'column "nope" does not exist'));
    fail('SELECT innocent', pgError('25P02', 'current transaction is aborted'));

    await expect(broken).rejects.toMatchObject({ code: '42703' });
    await settle();
    // One rollback, then the innocent read again on a fresh session.
    expect(sent.filter(text => text === 'ROLLBACK')).toHaveLength(1);
    expect(sent.filter(text => text === 'BEGIN')).toHaveLength(2);
    answer('SELECT innocent', [{ ok: true }]);
    await expect(innocent).resolves.toMatchObject({ rows: [{ ok: true }] });
    // The retry is logged, since its 25P02 never reaches the response.
    expect(logged.map(record => [record.msg, record.attempt, record.requestId])).toEqual([
      ['db-read-retried-after-aborted-session', 1, 'req'],
    ]);
  });

  it('keeps retrying while other reads keep aborting its sessions, then gives up', async () => {
    const read = client.query('SELECT flaky');
    // The first attempt plus five retries, each on a newer session.
    for (let attempt = 0; attempt < 6; attempt++) {
      await settle();
      fail('SELECT flaky', pgError('25P02', 'current transaction is aborted'));
    }

    await expect(read).rejects.toMatchObject({ code: '25P02' });
    expect(sent.filter(text => text === 'BEGIN')).toHaveLength(6);
  });

  it('recovers when several reads of one request fail for their own reasons', async () => {
    const reads = ['SELECT bad 1', 'SELECT good', 'SELECT bad 2'].map(text =>
      client.query(text).then(
        () => 'ok',
        (error: { code?: string }) => error.code,
      ),
    );
    await settle();
    // The first failure aborts the session under the other two.
    fail('SELECT bad 1', pgError('42501', 'permission denied'));
    fail('SELECT good', pgError('25P02', 'current transaction is aborted'));
    fail('SELECT bad 2', pgError('25P02', 'current transaction is aborted'));
    await settle();
    // Both retried on a fresh session; the second bad read now fails for its own reason.
    fail('SELECT bad 2', pgError('42501', 'permission denied'));
    fail('SELECT good', pgError('25P02', 'current transaction is aborted'));
    await settle();
    answer('SELECT good');

    expect(await Promise.all(reads)).toEqual(['42501', 'ok', '42501']);
  });

  it('keeps per-query sessions (autoRelease) one at a time, outside pipeline mode', async () => {
    client.autoRelease = true;
    const first = client.query('SELECT 1');
    const second = client.query('SELECT 2');
    await settle();

    expect(connection.pipeline).toBe(false);
    expect(pending.map(item => item.text)).toEqual(['SELECT 1']);
    answer('SELECT 1');
    await settle();
    answer('SELECT 2');
    await Promise.all([first, second]);
  });

  it('waits for the reads in flight before disposing', async () => {
    const read = client.query('SELECT slow');
    await settle();
    const disposal = client.dispose();
    await settle();
    expect(connection.release).not.toHaveBeenCalled();

    answer('SELECT slow');
    await Promise.all([read, disposal]);
    expect(sent.at(-1)).toBe('COMMIT');
    expect(connection.release).toHaveBeenCalled();
  });
});
