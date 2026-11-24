import type { PoolConfig } from 'pg';
import { config } from 'dotenv';
import {
  assertLocalDatabase,
  assertOptInsNotInEnvFile,
} from '../../../../migrations/src/local-db-guard.js';

// Load environment variables. The result is kept so `assertTestDatabaseIsLocal` can tell an
// opt-in that came from these files apart from one the caller typed.
const loadedEnv = config({ path: [`.env`, `../../.env`] });

/**
 * The database the test harness owns.
 *
 * Every DB-backed test connects to this database, on the server `POSTGRES_HOST` / `POSTGRES_PORT`
 * name, and never to the one `POSTGRES_DB` names. That one is the developer's own: the dev
 * server reads and writes it. Tests commit migrations and reference data, and the demo seed
 * test resets what it reaches, so sharing it meant a test run could change or empty dev data.
 * It also meant the name of the database under test came from a file nobody re-reads.
 *
 * The vitest global setup creates this database when a local server does not have it yet, and
 * migrates it (`ensureTestDatabase`, `runMigrationsIfNeeded`). CI's Postgres service starts
 * with a database of the same name, so nothing changes there.
 *
 * The name is a constant on purpose. It carries "test", which is what lets the demo seed
 * accept it by name (`scripts/demo-seed-guard.ts`), and no setting can point it elsewhere.
 */
export const TEST_DATABASE_NAME = 'accounter_test';

/**
 * Shared database configuration for test environments.
 * The server and the credentials come from the environment, with defaults for local
 * development. The database does not: see `TEST_DATABASE_NAME`.
 */
export const testDbConfig: PoolConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: TEST_DATABASE_NAME,
  ssl: process.env.POSTGRES_SSL === '1',
};

/**
 * Refuse an ALLOW_REMOTE_DB or ALLOW_DEMO_SEED set in the .env files this module loaded.
 *
 * Importing this module is what puts those files into process.env, and it is imported by more
 * than tests: `scripts/seed-demo-data.ts` reaches it through `fixture-loader.ts`, so its
 * `../../.env` is loaded before the seed's own `config()` runs and is invisible to the seed's
 * own check. Anything gated on an opt-in that can run with this module loaded must call this
 * too, so the files are checked by the code that loaded them rather than by a copy of the list.
 */
export function assertOptInsNotInTestEnvFiles(): void {
  assertOptInsNotInEnvFile(loadedEnv.parsed, 'a .env file (.env or ../../.env)');
}

/**
 * Refuse to let the test harness touch a deployed database.
 *
 * Called from the places that actually open a connection, NOT at module scope. This module
 * also exports `qualifyTable`, a pure string helper, and asserting on import meant that
 * merely importing that helper could abort an unrelated process: `scripts/seed-demo-data.ts`
 * imports `fixture-loader.ts`, which imports `qualifyTable` from here, and that chain broke
 * a staging deploy with a "the test harness" error while seeding. Importing a utility is not
 * evidence that anyone is about to run tests -- connecting is.
 *
 * Tests must never target a deployed database, so this refuses rather than warns; override
 * POSTGRES_* for the command, or set ALLOW_REMOTE_DB=1 if you really mean it.
 *
 * It also refuses an ALLOW_REMOTE_DB or ALLOW_DEMO_SEED set in the .env files loaded above.
 * This module's load is what puts them into process.env -- the vitest global setup's import
 * of it reaches every test worker -- so one left in .env would switch the remote-host check
 * off, and let the demo-seed E2E run, with nobody having asked for either.
 */
export function assertTestDatabaseIsLocal(): void {
  assertOptInsNotInTestEnvFiles();
  assertLocalDatabase(
    {
      host: testDbConfig.host,
      port: testDbConfig.port,
      db: testDbConfig.database,
      user: testDbConfig.user,
    },
    'the test harness',
  );
}

/**
 * Database schema name for queries
 * Allows tests to run in isolated schemas if needed
 */
export const testDbSchema = process.env.POSTGRES_SCHEMA || 'accounter_schema';

/**
 * Helper to build fully-qualified table name
 * @param tableName - Unqualified table name
 * @returns Fully qualified table name with schema prefix
 */
export function qualifyTable(tableName: string): string {
  return `${testDbSchema}.${tableName}`;
}
