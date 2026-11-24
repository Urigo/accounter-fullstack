import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The global setup runs before every database-backed vitest project. It is the first thing
 * that can stop a run whose target is a deployed database, and it is what gives the tests a
 * database of their own. These tests pin which failures stop the run and which are only a
 * warning, and the order in which the test database is prepared:
 *
 * - a non-local target stops it, whether POSTGRES_* came from the shell or from the root .env;
 * - so does a per-command opt-in that sits in the root .env;
 * - the test database is created if needed, then migrated, then given its reference data;
 * - a local database that is not running is a warning, so mocked unit tests run without one.
 *
 * Nothing here connects: the harness helpers are replaced, and `dotenv` is replaced by a
 * stand-in that plays the root `.env` from `rootDotenv` instead of reading a file on this
 * machine.
 */

const REMOTE_HOST = 'accounter.postgres.database.azure.invalid';

const rootDotenv = vi.hoisted(() => ({ values: {} as Record<string, string> }));

const harness = vi.hoisted(() => ({
  ensureTestDatabase: vi.fn(async () => false),
  withTestDatabaseSetupLock: vi.fn(async (work: () => Promise<unknown>) => work()),
  connectTestDb: vi.fn(),
  closeTestDb: vi.fn(async () => {}),
  runMigrationsIfNeeded: vi.fn(async () => {}),
  seedCountries: vi.fn(async () => {}),
}));

vi.mock('dotenv', () => ({
  // Like dotenv: fill in what the environment does not already set, override nothing.
  config: vi.fn(() => {
    for (const [name, value] of Object.entries(rootDotenv.values)) process.env[name] ??= value;
    return { parsed: rootDotenv.values };
  }),
}));
vi.mock('../../packages/server/src/__tests__/helpers/ensure-test-database.js', () => ({
  ensureTestDatabase: harness.ensureTestDatabase,
  withTestDatabaseSetupLock: harness.withTestDatabaseSetupLock,
}));
vi.mock('../../packages/server/src/__tests__/helpers/db-connection.js', () => ({
  connectTestDb: harness.connectTestDb,
  closeTestDb: harness.closeTestDb,
}));
vi.mock('../../packages/server/src/__tests__/helpers/db-migrations.js', () => ({
  runMigrationsIfNeeded: harness.runMigrationsIfNeeded,
}));
vi.mock('../../packages/server/src/modules/countries/helpers/seed-countries.helper.js', () => ({
  seedCountries: harness.seedCountries,
}));

/** Run the global setup as vitest would, with a fresh module graph so `.env` is "read" again. */
async function runGlobalSetup() {
  vi.resetModules();
  const { default: globalSetup } = await import('../vitest-global-setup.js');
  return globalSetup();
}

function expectNothingWasPrepared(): void {
  expect(harness.ensureTestDatabase).not.toHaveBeenCalled();
  expect(harness.connectTestDb).not.toHaveBeenCalled();
  expect(harness.runMigrationsIfNeeded).not.toHaveBeenCalled();
  expect(harness.seedCountries).not.toHaveBeenCalled();
}

let warnings: ReturnType<typeof vi.spyOn>;
let logs: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  rootDotenv.values = {};
  for (const name of [
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_SSL',
    'ALLOW_REMOTE_DB',
  ]) {
    vi.stubEnv(name, undefined);
  }
  // The setup points TEST_ENV_FILE at a fresh temp file. Stubbing it first means
  // `unstubAllEnvs` puts this worker's own value back afterwards.
  vi.stubEnv('TEST_ENV_FILE', process.env['TEST_ENV_FILE']);

  harness.ensureTestDatabase.mockResolvedValue(false);
  harness.runMigrationsIfNeeded.mockResolvedValue(undefined);
  const release = vi.fn();
  harness.connectTestDb.mockResolvedValue({ connect: vi.fn(async () => ({ release })) });

  warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
  logs = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('vitest global setup', () => {
  describe('a deployed database stops the run', () => {
    it('when POSTGRES_HOST is in the environment', async () => {
      vi.stubEnv('POSTGRES_HOST', REMOTE_HOST);
      vi.stubEnv('POSTGRES_DB', 'accounter_prod_db');

      // The database named is the harness's own: that is what it would have connected to.
      await expect(runGlobalSetup()).rejects.toThrow(
        `Refusing to run the test harness against a non-local database: postgres@${REMOTE_HOST}:5432/accounter_test`,
      );
      expectNothingWasPrepared();
    });

    it('when only the root .env names it', async () => {
      // Nothing in the shell, a deployed database in the root .env. Judged on the environment
      // alone this target has no host at all, so the check has to come after that file is read.
      rootDotenv.values = { POSTGRES_HOST: REMOTE_HOST, POSTGRES_DB: 'accounter_prod_db' };

      await expect(runGlobalSetup()).rejects.toThrow(
        `against a non-local database: postgres@${REMOTE_HOST}:5432/accounter_test`,
      );
      expectNothingWasPrepared();
    });

    it('unless ALLOW_REMOTE_DB=1 opts that one command in', async () => {
      rootDotenv.values = { POSTGRES_HOST: REMOTE_HOST, POSTGRES_DB: 'accounter_scratch' };
      vi.stubEnv('ALLOW_REMOTE_DB', '1');

      await expect(runGlobalSetup()).resolves.toBeTypeOf('function');
    });

    it('and the root .env cannot be what opts it in', async () => {
      // dotenv copies the file into the environment, where this would read as typed for the
      // command. The whole run stops instead, a local target included.
      rootDotenv.values = { POSTGRES_HOST: 'localhost', ALLOW_REMOTE_DB: '1' };

      await expect(runGlobalSetup()).rejects.toThrow(/ALLOW_REMOTE_DB is set in a \.env file/);
      expectNothingWasPrepared();
    });
  });

  describe('a local server gets the test database prepared', () => {
    it('makes sure it exists, migrates it, then writes the reference data', async () => {
      rootDotenv.values = { POSTGRES_HOST: 'localhost', POSTGRES_DB: 'accounter' };

      const teardown = await runGlobalSetup();

      const order = [
        harness.ensureTestDatabase,
        harness.connectTestDb,
        // The migration step runs inside the setup lock, one run at a time.
        harness.withTestDatabaseSetupLock,
        harness.runMigrationsIfNeeded,
        harness.seedCountries,
        harness.closeTestDb,
      ].map(step => step.mock.invocationCallOrder[0]);
      expect(order).toEqual([...order].sort((a, b) => a! - b!));
      expect(order.every(position => position !== undefined)).toBe(true);
      expect(teardown).toBeTypeOf('function');
      expect(warnings).not.toHaveBeenCalled();
    });

    it('says so when it had to create the database', async () => {
      harness.ensureTestDatabase.mockResolvedValue(true);

      await runGlobalSetup();

      expect(logs).toHaveBeenCalledWith('[test-setup] Created the test database "accounter_test"');
    });

    it('says nothing about creating it when it was already there', async () => {
      await runGlobalSetup();

      expect(logs).not.toHaveBeenCalledWith(expect.stringContaining('Created the test database'));
    });

    it('stays a warning when the server is not running, so mocked unit tests need no database', async () => {
      vi.stubEnv('POSTGRES_HOST', '127.0.0.1');
      harness.ensureTestDatabase.mockRejectedValue(
        new Error('connect ECONNREFUSED 127.0.0.1:5432'),
      );

      await expect(runGlobalSetup()).resolves.toBeTypeOf('function');

      expect(warnings).toHaveBeenCalledWith(
        '[test-setup] Failed to prepare the test database "accounter_test":',
        'connect ECONNREFUSED 127.0.0.1:5432',
      );
      expect(harness.connectTestDb).not.toHaveBeenCalled();
      expect(harness.seedCountries).not.toHaveBeenCalled();
    });

    it('stays a warning when a migration fails, and still closes its pool', async () => {
      harness.runMigrationsIfNeeded.mockRejectedValue(new Error('Failed to run migrations'));

      await expect(runGlobalSetup()).resolves.toBeTypeOf('function');

      expect(warnings).toHaveBeenCalledWith(
        '[test-setup] Failed to prepare the test database "accounter_test":',
        'Failed to run migrations',
      );
      expect(harness.seedCountries).not.toHaveBeenCalled();
      expect(harness.closeTestDb).toHaveBeenCalled();
    });

    it('needs no configuration at all: an absent host is the local default', async () => {
      await expect(runGlobalSetup()).resolves.toBeTypeOf('function');

      expect(harness.ensureTestDatabase).toHaveBeenCalledOnce();
    });
  });
});
