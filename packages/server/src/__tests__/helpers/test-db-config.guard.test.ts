import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for the shape that broke a staging deploy.
 *
 * `test-db-config.ts` used to call `assertLocalDatabase` at module scope. It also exports
 * `qualifyTable`, a pure string helper, and `scripts/seed-demo-data.ts` reaches that helper
 * transitively (seed-demo-data -> fixture-loader -> test-db-config). So importing a string
 * function aborted the staging build with "Refusing to run the test harness against a
 * non-local database" while seeding — a check firing on import rather than on connection.
 *
 * The rule these tests pin: importing this module is always safe; *connecting* is what gets
 * checked. `vi.resetModules()` forces a genuine re-evaluation, so a module-scope assert
 * would fail these tests if it were ever reintroduced.
 *
 * Note `test-db-config.ts` calls dotenv's `config()`, which does not override variables
 * already present in `process.env` — so the values set here win over the repo root `.env`.
 */
const REMOTE_HOST = 'accounter2.postgres.database.azure.com';

async function loadFreshConfig() {
  vi.resetModules();
  return import('./test-db-config.js');
}

describe('test-db-config import safety', () => {
  const original = {
    host: process.env.POSTGRES_HOST,
    allow: process.env.ALLOW_REMOTE_DB,
  };

  beforeEach(() => {
    delete process.env.ALLOW_REMOTE_DB;
  });

  afterEach(() => {
    for (const [key, value] of [
      ['POSTGRES_HOST', original.host],
      ['ALLOW_REMOTE_DB', original.allow],
    ] as const) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.resetModules();
  });

  it('imports cleanly and exposes qualifyTable when POSTGRES_HOST is a deployed server', async () => {
    process.env.POSTGRES_HOST = REMOTE_HOST;

    // This is the exact chain that failed the staging deploy: reaching a pure string helper
    // through this module while pointed at a deployed database.
    const mod = await loadFreshConfig();

    expect(typeof mod.qualifyTable).toBe('function');
    expect(mod.qualifyTable('charges')).toContain('charges');
    expect(mod.testDbConfig.host).toBe(REMOTE_HOST);
  });

  it('still refuses a deployed target when the harness actually connects', async () => {
    process.env.POSTGRES_HOST = REMOTE_HOST;

    const mod = await loadFreshConfig();

    expect(() => mod.assertTestDatabaseIsLocal()).toThrow(/non-local database/);
    expect(() => mod.assertTestDatabaseIsLocal()).toThrow(new RegExp(REMOTE_HOST));
  });

  it('allows a deployed target at connect time when explicitly opted in', async () => {
    process.env.POSTGRES_HOST = REMOTE_HOST;
    process.env.ALLOW_REMOTE_DB = '1';

    const mod = await loadFreshConfig();

    expect(() => mod.assertTestDatabaseIsLocal()).not.toThrow();
  });

  it('passes for the local dev container', async () => {
    process.env.POSTGRES_HOST = 'localhost';

    const mod = await loadFreshConfig();

    expect(() => mod.assertTestDatabaseIsLocal()).not.toThrow();
  });
});
