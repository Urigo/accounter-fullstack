import pg from 'pg';
import { isLocalDatabaseHost } from '../../../../migrations/src/local-db-guard.js';
import { assertTestDatabaseIsLocal, TEST_DATABASE_NAME, testDbConfig } from './test-db-config.js';

/** Every Postgres server has this one. It is only used to create the test database from. */
const MAINTENANCE_DATABASE = 'postgres';

/**
 * Key of the advisory lock that serializes the setup of the test database. The value is
 * arbitrary; it only has to be the same in every run.
 */
const SETUP_LOCK_KEY = 20_261_123;

/** The Postgres error code for connecting to a database that is not there. */
const DATABASE_DOES_NOT_EXIST = '3D000';

/** How often, and how far apart, to look again for a database another run is creating. */
const RECHECKS_AFTER_FAILED_CREATE = 5;
const RECHECK_DELAY_MS = 200;

const errorCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

/**
 * A reason worth printing. Node reports a refused connection to `localhost` as an
 * AggregateError with an empty message (one inner error per address it tried), and the global
 * setup prints only the message.
 */
function reasonOf(error: unknown): string {
  if (error instanceof AggregateError) {
    const inner = [...new Set(error.errors.map(reasonOf).filter(reason => reason !== ''))];
    if (inner.length > 0) return inner.join('; ');
  }
  if (error instanceof Error && error.message !== '') return error.message;
  return errorCode(error) ?? String(error);
}

/** Open one short-lived connection to `database` on the harness's server and run `use` on it. */
async function withClient<T>(database: string, use: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ ...testDbConfig, database, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    return await use(client);
  } finally {
    await client.end();
  }
}

/**
 * Make sure the harness's own database exists. Resolves to true when this call created it.
 *
 * The harness never uses the database `POSTGRES_DB` names (see `TEST_DATABASE_NAME`), so on a
 * developer machine its database is usually not there the first time. Asking everyone to
 * create and migrate a second database by hand would only bring back the habit of pointing
 * the tests at the first one, so the setup does it.
 *
 * - It first connects to the test database itself. When that works, nothing else happens:
 *   that is every CI run and every local run after the first.
 * - Only "this database does not exist" leads to creating it. Any other failure (the server
 *   is not running, the password is wrong) is thrown with the server and the reason in its
 *   message, for the caller to report.
 * - The database is only ever created on a local server. A run that was deliberately allowed
 *   to leave the machine (`ALLOW_REMOTE_DB=1`) may use a test database that is already on that
 *   server, but creating databases there is not this harness's call.
 * - Two runs that start together can both find it missing, and one of them then fails to
 *   create it. Postgres reports that as "already exists", or as a unique violation on
 *   `pg_database` when the two statements overlap. Rather than rely on either code, a failed
 *   create is followed by another look: when the database is there, that is the outcome this
 *   run wanted.
 *
 * Migrating the database is the caller's next step (`runMigrationsIfNeeded`).
 */
export async function ensureTestDatabase(): Promise<boolean> {
  // The same check every other connection of the harness makes. It comes first here as well:
  // this function connects, and the branch below can create a database.
  assertTestDatabaseIsLocal();

  if (await testDatabaseExists()) {
    return false;
  }

  if (!isLocalDatabaseHost(testDbConfig.host)) {
    throw new Error(
      [
        `The test database "${TEST_DATABASE_NAME}" does not exist on ${testDbConfig.host}.`,
        '',
        'The test harness creates its database on a local server only. On any other server,',
        `create "${TEST_DATABASE_NAME}" there yourself before running the tests.`,
      ].join('\n'),
    );
  }

  try {
    // An identifier cannot be a query parameter. The name is the constant above.
    await withClient(MAINTENANCE_DATABASE, client =>
      client.query(`CREATE DATABASE "${TEST_DATABASE_NAME}"`),
    );
  } catch (error) {
    for (let attempt = 1; attempt <= RECHECKS_AFTER_FAILED_CREATE; attempt++) {
      if (await testDatabaseExists().catch(() => false)) {
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, RECHECK_DELAY_MS));
    }
    throw error;
  }
  return true;
}

/** Whether the harness's database is there. Any failure other than "it is not" is thrown. */
async function testDatabaseExists(): Promise<boolean> {
  try {
    await withClient(TEST_DATABASE_NAME, async () => {});
    return true;
  } catch (error) {
    if (errorCode(error) === DATABASE_DOES_NOT_EXIST) {
      return false;
    }
    throw new Error(
      `Could not connect to Postgres at ${testDbConfig.host}:${testDbConfig.port}: ${reasonOf(error)}`,
      { cause: error },
    );
  }
}

/**
 * Run `work` while holding a lock on the test database, so only one run at a time sets it up.
 *
 * The migration runner takes no lock of its own. Two runs that start together on a database
 * that is new or behind (two vitest projects, two checkouts sharing a local server) would both
 * find it stale and both start applying the same migrations. With this around the migration
 * step, the second run waits, and then finds the schema current and does nothing.
 *
 * The lock is a session-level advisory lock on a connection of its own, so it is released when
 * `work` settles and also when the process holding it dies.
 *
 * It is polled with `pg_try_advisory_lock`, never taken with the blocking `pg_advisory_lock`.
 * A session that waits inside a statement keeps a snapshot open for as long as it waits, and a
 * migration that builds an index CONCURRENTLY waits for every older snapshot in the database to
 * go away. With the blocking form, the run that holds the lock ends up waiting for the run that
 * waits for the lock, until a statement timeout ends it ten minutes later. Between two polls
 * the waiting session is idle and holds nothing.
 */
export async function withTestDatabaseSetupLock<T>(
  work: () => Promise<T>,
  {
    pollMs = 250,
    giveUpAfterMs = 15 * 60 * 1000,
  }: { pollMs?: number; giveUpAfterMs?: number } = {},
): Promise<T> {
  return withClient(TEST_DATABASE_NAME, async client => {
    const waitingSince = Date.now();
    for (;;) {
      const { rows } = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [SETUP_LOCK_KEY],
      );
      if (rows[0]?.locked === true) break;
      if (Date.now() - waitingSince >= giveUpAfterMs) {
        throw new Error(
          `Another run has been setting up the test database "${TEST_DATABASE_NAME}" for more ` +
            `than ${Math.round(giveUpAfterMs / 60_000)} minutes. Giving up waiting for it.`,
        );
      }
      await new Promise(resolve => setTimeout(resolve, pollMs));
    }

    try {
      return await work();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [SETUP_LOCK_KEY]);
    }
  });
}
