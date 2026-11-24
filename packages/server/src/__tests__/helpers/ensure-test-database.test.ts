import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `ensureTestDatabase` is what lets the tests have a database of their own without anyone
 * creating it by hand. These tests pin when it creates one and, more to the point, when it
 * does not.
 *
 * Nothing here connects: `pg` is replaced by a stand-in server that knows which databases
 * "exist", and `dotenv` is a no-op so no `.env` on this machine is read.
 */

type CodedError = Error & { code?: string };

const server = vi.hoisted(() => ({
  databases: new Set<string>(),
  /** Thrown by every connect, to play a server that is not running. */
  connectError: null as CodedError | null,
  /** Thrown when the database is created, to play a lost race or a missing privilege. */
  createError: null as CodedError | null,
  /** With `createError`: the database appears anyway, because another run created it. */
  anotherRunCreatesIt: false,
  /** Answers to `pg_try_advisory_lock`, in order. Once they run out, the lock is free. */
  lockAnswers: [] as boolean[],
  /** The database of every connection attempt, in order. */
  connections: [] as string[],
  statements: [] as Array<{ database: string; sql: string }>,
  ended: 0,
}));

vi.mock('pg', () => {
  class Client {
    private readonly database: string;

    constructor(config: { database: string }) {
      this.database = config.database;
    }

    async connect(): Promise<void> {
      server.connections.push(this.database);
      if (server.connectError) throw server.connectError;
      if (!server.databases.has(this.database)) {
        throw Object.assign(new Error(`database "${this.database}" does not exist`), {
          code: '3D000',
        });
      }
    }

    async query(sql: string): Promise<{ rows: Array<Record<string, unknown>> }> {
      server.statements.push({ database: this.database, sql });
      if (sql.includes('pg_try_advisory_lock')) {
        return { rows: [{ locked: server.lockAnswers.shift() ?? true }] };
      }
      const created = /^CREATE DATABASE "(.+)"$/.exec(sql);
      if (created) {
        if (server.createError) {
          if (server.anotherRunCreatesIt) server.databases.add(created[1]!);
          throw server.createError;
        }
        server.databases.add(created[1]!);
      }
      return { rows: [] };
    }

    async end(): Promise<void> {
      server.ended += 1;
    }
  }
  return { default: { Client }, Client };
});
vi.mock('dotenv', () => ({ config: vi.fn(() => ({ parsed: {} })) }));

const REMOTE_HOST = 'accounter.postgres.database.azure.invalid';
const coded = (message: string, code: string): CodedError =>
  Object.assign(new Error(message), { code });

/** Run it against a freshly evaluated config, so the environment of this test is what it reads. */
async function ensure(): Promise<boolean> {
  vi.resetModules();
  const { ensureTestDatabase } = await import('./ensure-test-database.js');
  return ensureTestDatabase();
}

beforeEach(() => {
  server.databases = new Set(['postgres', 'accounter']);
  server.connectError = null;
  server.createError = null;
  server.anotherRunCreatesIt = false;
  server.lockAnswers = [];
  server.connections.length = 0;
  server.statements.length = 0;
  server.ended = 0;
  for (const name of [
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_SSL',
    'PGHOST',
    'ALLOW_REMOTE_DB',
  ]) {
    vi.stubEnv(name, undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ensureTestDatabase', () => {
  describe('on a local server', () => {
    it('does nothing when the test database is already there', async () => {
      server.databases.add('accounter_test');

      await expect(ensure()).resolves.toBe(false);

      expect(server.connections).toEqual(['accounter_test']);
      expect(server.statements).toEqual([]);
      expect(server.ended).toBe(1);
    });

    it('creates it, from the maintenance database, when it is missing', async () => {
      await expect(ensure()).resolves.toBe(true);

      expect(server.connections).toEqual(['accounter_test', 'postgres']);
      expect(server.statements).toEqual([
        { database: 'postgres', sql: 'CREATE DATABASE "accounter_test"' },
      ]);
      expect(server.databases.has('accounter_test')).toBe(true);
      // The one connection that opened is closed again.
      expect(server.ended).toBe(1);
    });

    it('never touches the database POSTGRES_DB names', async () => {
      vi.stubEnv('POSTGRES_DB', 'accounter');

      await ensure();

      expect(server.connections).not.toContain('accounter');
      expect(server.statements.every(statement => statement.database === 'postgres')).toBe(true);
    });

    // Two runs that start together both find it missing. Postgres tells the one that loses in
    // one of two ways, depending on how far the other one had got.
    it.each([
      ['"already exists"', coded('database "accounter_test" already exists', '42P04')],
      [
        'a unique violation on pg_database',
        coded(
          'duplicate key value violates unique constraint "pg_database_datname_index"',
          '23505',
        ),
      ],
    ])('takes %s from a run that got there first as done', async (_label, error) => {
      server.createError = error;
      server.anotherRunCreatesIt = true;

      await expect(ensure()).resolves.toBe(false);

      expect(server.databases.has('accounter_test')).toBe(true);
    });

    it('does not try to create anything when the server is not running', async () => {
      server.connectError = coded('connect ECONNREFUSED 127.0.0.1:5432', 'ECONNREFUSED');

      await expect(ensure()).rejects.toThrow('ECONNREFUSED');

      expect(server.connections).toEqual(['accounter_test']);
      expect(server.statements).toEqual([]);
    });

    it('says which server and why, also when Node gives the failure no message', async () => {
      // A refused connection to `localhost` arrives as an AggregateError with an empty message
      // and one inner error per address tried. The setup prints the message, so it has to say.
      server.connectError = Object.assign(
        new AggregateError([
          coded('connect ECONNREFUSED ::1:5432', 'ECONNREFUSED'),
          coded('connect ECONNREFUSED 127.0.0.1:5432', 'ECONNREFUSED'),
        ]),
        { code: 'ECONNREFUSED' },
      );

      await expect(ensure()).rejects.toThrow(
        'Could not connect to Postgres at localhost:5432: ' +
          'connect ECONNREFUSED ::1:5432; connect ECONNREFUSED 127.0.0.1:5432',
      );
    });

    it('does not try to create anything when the login is refused', async () => {
      server.connectError = coded('password authentication failed for user "postgres"', '28P01');

      await expect(ensure()).rejects.toThrow('password authentication failed');

      expect(server.connections).toEqual(['accounter_test']);
    });

    it('passes on a failure to create it when the database is still not there', async () => {
      server.createError = coded('permission denied to create database', '42501');

      await expect(ensure()).rejects.toThrow('permission denied to create database');

      expect(server.databases.has('accounter_test')).toBe(false);
      expect(server.ended).toBe(1);
    });
  });

  describe('on any other server', () => {
    it('refuses before it connects to anything', async () => {
      vi.stubEnv('POSTGRES_HOST', REMOTE_HOST);

      await expect(ensure()).rejects.toThrow(/non-local database/);

      expect(server.connections).toEqual([]);
    });

    it('uses a test database that is already there, when the run was opted in', async () => {
      vi.stubEnv('POSTGRES_HOST', REMOTE_HOST);
      vi.stubEnv('ALLOW_REMOTE_DB', '1');
      server.databases.add('accounter_test');

      await expect(ensure()).resolves.toBe(false);

      expect(server.statements).toEqual([]);
    });

    it('never creates one there, opted in or not', async () => {
      vi.stubEnv('POSTGRES_HOST', REMOTE_HOST);
      vi.stubEnv('ALLOW_REMOTE_DB', '1');

      await expect(ensure()).rejects.toThrow(
        `The test database "accounter_test" does not exist on ${REMOTE_HOST}.`,
      );

      // It looked for its own database and went no further: no maintenance connection.
      expect(server.connections).toEqual(['accounter_test']);
      expect(server.statements).toEqual([]);
      expect(server.databases.has('accounter_test')).toBe(false);
    });
  });
});

describe('withTestDatabaseSetupLock', () => {
  const TRY_LOCK = 'SELECT pg_try_advisory_lock($1) AS locked';
  const UNLOCK = 'SELECT pg_advisory_unlock($1)';

  async function locked<T>(
    work: () => Promise<T>,
    options?: { pollMs?: number; giveUpAfterMs?: number },
  ): Promise<T> {
    vi.resetModules();
    const { withTestDatabaseSetupLock } = await import('./ensure-test-database.js');
    return withTestDatabaseSetupLock(work, options);
  }

  const sent = () => server.statements.map(statement => statement.sql);

  beforeEach(() => {
    server.databases.add('accounter_test');
  });

  it('holds an advisory lock on the test database around the work, then lets go', async () => {
    const heldDuringWork: string[] = [];

    await expect(
      locked(async () => {
        heldDuringWork.push(...sent());
        return 'done';
      }),
    ).resolves.toBe('done');

    expect(heldDuringWork).toEqual([TRY_LOCK]);
    expect(server.statements).toEqual([
      { database: 'accounter_test', sql: TRY_LOCK },
      { database: 'accounter_test', sql: UNLOCK },
    ]);
    expect(server.ended).toBe(1);
  });

  it('keeps asking while another run holds it, and never waits inside a statement', async () => {
    server.lockAnswers = [false, false];
    const work = vi.fn(async () => 'done');

    await expect(locked(work, { pollMs: 1 })).resolves.toBe('done');

    expect(sent()).toEqual([TRY_LOCK, TRY_LOCK, TRY_LOCK, UNLOCK]);
    expect(work).toHaveBeenCalledOnce();
    // The blocking form keeps a snapshot open while it waits. A migration that builds an index
    // CONCURRENTLY waits for that snapshot, so the lock holder would be waiting for its waiter.
    expect(sent().some(sql => /pg_advisory_lock\(/.test(sql))).toBe(false);
  });

  it('gives up after the limit instead of waiting forever, without running the work', async () => {
    server.lockAnswers = Array.from({ length: 1000 }, () => false);
    const work = vi.fn(async () => 'done');

    await expect(locked(work, { pollMs: 1, giveUpAfterMs: 20 })).rejects.toThrow(
      /Another run has been setting up the test database "accounter_test"/,
    );

    expect(work).not.toHaveBeenCalled();
    // It never got the lock, so there is nothing to release. The connection is still closed.
    expect(sent()).not.toContain(UNLOCK);
    expect(server.ended).toBe(1);
  });

  it('lets go when the work fails, and passes the failure on', async () => {
    await expect(
      locked(async () => {
        throw new Error('migration failed');
      }),
    ).rejects.toThrow('migration failed');

    expect(sent().at(-1)).toBe(UNLOCK);
    expect(server.ended).toBe(1);
  });
});
