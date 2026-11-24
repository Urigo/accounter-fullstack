import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { seedCountries } from '../packages/server/src/modules/countries/helpers/seed-countries.helper.js';

// Log a caught error by its message, never the Error itself. Printing an Error formats its stack,
// and Vite's stack source-mapping crashes on this module ("code.charCodeAt is not a function",
// since the runner holds its code as bytes). That crash ends the run, hiding the warning and
// failing every project, unit tests included, even though the failures below are meant to be
// non-fatal.
const describeError = (e: unknown): unknown => (e instanceof Error ? e.message : e);

export default async function globalSetup() {
  // Before anything else: this setup writes (seedCountries below) and runs for *every*
  // vitest project, `--project unit` included. It reads the root .env, so "I only ran unit
  // tests" is not a reason to assume the target is local.
  //
  // Check the config the harness will actually connect with, not raw `process.env`. Nothing
  // has loaded the root .env at this point -- importing `test-db-config` is what does -- so
  // checking `process.env.POSTGRES_HOST` here saw `undefined`, classified it as local and
  // passed, while every connection made afterwards (the harness, and the demo seed's child
  // process) read the real host from .env. Throwing here aborts the whole run, every project
  // included, which is the point: the guard further down only surfaced as a warning inside the
  // try/catch below.
  const { assertTestDatabaseIsLocal, TEST_DATABASE_NAME } =
    await import('../packages/server/src/__tests__/helpers/test-db-config.js');
  assertTestDatabaseIsLocal();

  // Create isolated env file for test runs (seedAdminCore writes here)
  try {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'accounter-test-env-'));
    const envFile = path.join(tempDir, '.env');
    fs.writeFileSync(envFile, '', 'utf8');
    process.env.TEST_ENV_FILE = envFile;
    // Lightweight log (not using debug flag to ensure visibility once)
    // eslint-disable-next-line no-console
    console.log(`[test-setup] Using isolated TEST_ENV_FILE: ${envFile}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[test-setup] Failed to establish isolated TEST_ENV_FILE:', describeError(e));
  }

  // The tests have a database of their own (TEST_DATABASE_NAME), never the one POSTGRES_DB
  // names. Make sure it is there and at the latest migration before any worker starts: on a
  // developer machine it does not exist the first time, and several workers migrating a fresh
  // database at once would trip over each other.
  //
  // Then ensure core reference data exists outside per-test transactions: the countries table,
  // populated from the CountryCode enum.
  //
  // All of it stays a warning when it fails. Mocked unit tests need no database, so a local
  // Postgres that is not running must not stop them. Tests that do need it then fail on their
  // own connection, with this warning above them.
  try {
    const { ensureTestDatabase, withTestDatabaseSetupLock } =
      await import('../packages/server/src/__tests__/helpers/ensure-test-database.js');
    if (await ensureTestDatabase()) {
      // eslint-disable-next-line no-console
      console.log(`[test-setup] Created the test database "${TEST_DATABASE_NAME}"`);
    }

    const { connectTestDb, closeTestDb } =
      await import('../packages/server/src/__tests__/helpers/db-connection.js');
    const pool = await connectTestDb();
    try {
      const { runMigrationsIfNeeded } =
        await import('../packages/server/src/__tests__/helpers/db-migrations.js');
      // One run at a time: the migration runner takes no lock of its own.
      await withTestDatabaseSetupLock(() => runMigrationsIfNeeded(pool));

      const client = await pool.connect();
      try {
        // Use the shared utility to seed all countries from CountryCode enum
        await seedCountries(client);
        // eslint-disable-next-line no-console
        console.log('[test-setup] Ensured all countries populated from enum');
      } finally {
        client.release();
      }
    } finally {
      await closeTestDb();
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      `[test-setup] Failed to prepare the test database "${TEST_DATABASE_NAME}":`,
      describeError(e),
    );
  }

  // Return a global teardown to ensure the shared test DB pool is closed once.
  return async () => {
    try {
      const mod = await import('../packages/server/src/__tests__/helpers/db-connection.js');
      if (typeof mod.closeTestDb === 'function') {
        await mod.closeTestDb();
      }
    } catch {
      // Best-effort teardown; ignore resolution issues in non-server test runs
    }
  };
}
