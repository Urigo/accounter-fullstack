import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The global setup runs before every database-backed vitest project and is the first thing
 * that can stop a run whose target is a deployed database. These tests pin which failures
 * stop the run and which are only a warning:
 *
 * - a non-local target stops it, whether POSTGRES_* came from the shell or from the root .env;
 * - so does a per-command opt-in that sits in the root .env;
 * - a local database that is not running does not, so mocked unit tests run without one.
 *
 * Nothing here connects: the pool helpers are replaced, and `dotenv` is replaced by a stand-in
 * that plays the root `.env` from `rootDotenv` instead of reading a file on this machine.
 */

const REMOTE_HOST = 'accounter.postgres.database.azure.invalid';

const rootDotenv = vi.hoisted(() => ({ values: {} as Record<string, string> }));

const harness = vi.hoisted(() => ({
  connectTestDb: vi.fn(),
  closeTestDb: vi.fn(async () => {}),
  seedCountries: vi.fn(async () => {}),
}));

vi.mock('dotenv', () => ({
  // Like dotenv: fill in what the environment does not already set, override nothing.
  config: vi.fn(() => {
    for (const [name, value] of Object.entries(rootDotenv.values)) process.env[name] ??= value;
    return { parsed: rootDotenv.values };
  }),
}));
vi.mock('../../packages/server/src/__tests__/helpers/db-connection.js', () => ({
  connectTestDb: harness.connectTestDb,
  closeTestDb: harness.closeTestDb,
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

let warnings: ReturnType<typeof vi.spyOn>;

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

  const release = vi.fn();
  harness.connectTestDb.mockResolvedValue({ connect: vi.fn(async () => ({ release })) });

  warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
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

      await expect(runGlobalSetup()).rejects.toThrow(
        `Refusing to run the test harness against a non-local database: postgres@${REMOTE_HOST}:5432/accounter_prod_db`,
      );
      expect(harness.connectTestDb).not.toHaveBeenCalled();
    });

    it('when only the root .env names it', async () => {
      // Nothing in the shell, a deployed database in the root .env. Judged on the environment
      // alone this target has no host at all, so the check has to come after that file is read.
      rootDotenv.values = { POSTGRES_HOST: REMOTE_HOST, POSTGRES_DB: 'accounter_prod_db' };

      await expect(runGlobalSetup()).rejects.toThrow(
        `against a non-local database: postgres@${REMOTE_HOST}:5432/accounter_prod_db`,
      );
      expect(harness.connectTestDb).not.toHaveBeenCalled();
      expect(harness.seedCountries).not.toHaveBeenCalled();
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
      expect(harness.connectTestDb).not.toHaveBeenCalled();
      expect(harness.seedCountries).not.toHaveBeenCalled();
    });
  });

  describe('a local database does not', () => {
    it('seeds the reference data and returns a teardown', async () => {
      rootDotenv.values = { POSTGRES_HOST: 'localhost', POSTGRES_DB: 'accounter' };

      const teardown = await runGlobalSetup();

      expect(harness.seedCountries).toHaveBeenCalledOnce();
      expect(teardown).toBeTypeOf('function');
      expect(warnings).not.toHaveBeenCalled();
    });

    it('stays a warning when it is not running, so mocked unit tests need no database', async () => {
      vi.stubEnv('POSTGRES_HOST', '127.0.0.1');
      harness.connectTestDb.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

      await expect(runGlobalSetup()).resolves.toBeTypeOf('function');

      expect(warnings).toHaveBeenCalledWith(
        '[test-setup] Failed to ensure countries reference data:',
        'connect ECONNREFUSED 127.0.0.1:5432',
      );
    });

    it('needs no configuration at all: an absent host is the local default', async () => {
      await expect(runGlobalSetup()).resolves.toBeTypeOf('function');
    });
  });
});
