import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

/**
 * `scripts/vitest-demo-seed-setup.ts` checks that the migrations are current before the demo
 * seed test starts the seed. For a long time it never ran: it exports `setup()`, which vitest
 * calls for a `globalSetup` module, and it was registered under `setupFiles`, where a file is
 * only imported. Nothing failed, the check just did not happen.
 *
 * These tests pin both halves: where the file is registered, and what `setup()` does. That
 * includes what it must not do: connect when the suite is going to be skipped anyway.
 * Nothing here connects: `pg` and the migration lookup are replaced, and `dotenv` is a no-op
 * so no `.env` on this machine is read.
 */

const pgState = vi.hoisted(() => ({
  pools: [] as Array<{ config: unknown; end: ReturnType<typeof vi.fn> }>,
}));
const lookup = vi.hoisted(() => ({ checkLatestMigration: vi.fn() }));

vi.mock('pg', () => {
  class Pool {
    end = vi.fn(async () => {});
    constructor(public config: unknown) {
      pgState.pools.push(this);
    }
  }
  return { Pool, default: { Pool } };
});
vi.mock('dotenv', () => ({ config: vi.fn(() => ({ parsed: {} })) }));
vi.mock('../../packages/server/src/__tests__/helpers/migration-verification.js', () => ({
  checkLatestMigration: lookup.checkLatestMigration,
}));

const repoRoot = join(import.meta.dirname, '../..');
const FLAG = 'SKIP_DEMO_SEED_STALE_MIGRATIONS';

async function runSetup(): Promise<void> {
  vi.resetModules();
  const { setup } = await import('../vitest-demo-seed-setup.js');
  await setup();
}

let warnings: MockInstance;

beforeEach(() => {
  vi.clearAllMocks();
  pgState.pools.length = 0;
  for (const name of [
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_SSL',
    'POSTGRES_SCHEMA',
    'ALLOW_REMOTE_DB',
    'ALLOW_DEMO_SEED',
    FLAG,
  ]) {
    vi.stubEnv(name, undefined);
  }
  vi.stubEnv('POSTGRES_HOST', '127.0.0.1');
  vi.stubEnv('POSTGRES_DB', 'accounter_test');
  // The check only runs when the suite will: with the opt-in the caller typed.
  vi.stubEnv('ALLOW_DEMO_SEED', '1');
  warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('demo-seed migration check', () => {
  it('is registered where vitest will call it', async () => {
    // Importing the config appends to NODE_OPTIONS; stub it so that is undone afterwards.
    vi.stubEnv('NODE_OPTIONS', process.env['NODE_OPTIONS'] ?? '');
    const { default: config } = (await import('../../vitest.config.js')) as {
      default: {
        test: {
          setupFiles: string[];
          projects: Array<{
            test: { name: string; globalSetup?: string[]; setupFiles?: string[] };
          }>;
        };
      };
    };
    const demoSeed = config.test.projects.find(project => project.test.name === 'demo-seed')!.test;
    const file = './scripts/vitest-demo-seed-setup.ts';

    expect(demoSeed.globalSetup).toContain(file);
    // After the general setup, which is the one that refuses a non-local database.
    expect(demoSeed.globalSetup?.[0]).toBe('./scripts/vitest-global-setup.ts');
    expect([...config.test.setupFiles, ...(demoSeed.setupFiles ?? [])]).not.toContain(file);
  });

  it('leaves no flag when the latest migration is applied', async () => {
    lookup.checkLatestMigration.mockResolvedValue({ isLatest: true, latestMigrationName: 'x' });

    await runSetup();

    expect(process.env[FLAG]).toBeUndefined();
    expect(warnings).not.toHaveBeenCalled();
    expect(lookup.checkLatestMigration).toHaveBeenCalledExactlyOnceWith(
      pgState.pools[0],
      'accounter_schema',
    );
    // The same target the local-database check looked at (POSTGRES_* from beforeEach).
    expect(pgState.pools[0]!.config).toMatchObject({
      host: '127.0.0.1',
      database: 'accounter_test',
    });
    expect(pgState.pools[0]!.end).toHaveBeenCalledOnce();
  });

  it('sets the flag and names the command when migrations are stale', async () => {
    lookup.checkLatestMigration.mockResolvedValue({
      isLatest: false,
      latestMigrationName: 'x',
      errorMessage: 'Latest migration "x" not found in database',
    });

    await runSetup();

    expect(process.env[FLAG]).toBe('1');
    const printed = warnings.mock.calls.map(call => call.join(' ')).join('\n');
    expect(printed).toContain('Latest migration "x" not found in database');
    // The workspace has to be the real one, or the command it prints does not run.
    const { name } = JSON.parse(
      readFileSync(join(repoRoot, 'packages/migrations/package.json'), 'utf8'),
    ) as { name: string };
    expect(printed).toContain(`yarn workspace ${name} migration:run`);
    expect(pgState.pools[0]!.end).toHaveBeenCalledOnce();
  });

  // `migration:run` reads the host and port from the shell or the root .env. A command that
  // named only the database would migrate `accounter_test` on whatever server those name,
  // which is not necessarily the one this run was pointed at.
  it('names the server it checked in that command, not only the database', async () => {
    vi.stubEnv('POSTGRES_HOST', 'localhost');
    vi.stubEnv('POSTGRES_PORT', '5434');
    lookup.checkLatestMigration.mockResolvedValue({
      isLatest: false,
      latestMigrationName: 'x',
      errorMessage: 'Latest migration "x" not found in database',
    });

    await runSetup();

    const printed = warnings.mock.calls.map(call => call.join(' ')).join('\n');
    expect(printed).toContain(
      'POSTGRES_HOST=localhost POSTGRES_PORT=5434 POSTGRES_DB=accounter_test yarn workspace',
    );
    expect(pgState.pools[0]!.config).toMatchObject({ host: 'localhost', port: 5434 });
  });

  it('closes its pool when the lookup throws', async () => {
    lookup.checkLatestMigration.mockRejectedValue(new Error('boom'));

    await expect(runSetup()).rejects.toThrow('boom');

    expect(pgState.pools[0]!.end).toHaveBeenCalledOnce();
  });

  // Without the opt-in the suite is skipped, so there is nothing to check. Connecting anyway
  // made a run with no database up fail in this setup, and a failed global setup stops every
  // project of the run.
  it.each([undefined, '', '0', 'true'])(
    'opens nothing when ALLOW_DEMO_SEED is %j, since the suite is skipped then',
    async value => {
      vi.stubEnv('ALLOW_DEMO_SEED', value);

      await runSetup();

      expect(pgState.pools).toEqual([]);
      expect(lookup.checkLatestMigration).not.toHaveBeenCalled();
      expect(process.env[FLAG]).toBeUndefined();
      expect(warnings).not.toHaveBeenCalled();
    },
  );

  it('still refuses a non-local target without the opt-in', async () => {
    vi.stubEnv('ALLOW_DEMO_SEED', undefined);
    vi.stubEnv('POSTGRES_HOST', 'accounter.postgres.database.azure.invalid');

    await expect(runSetup()).rejects.toThrow(/non-local database/);

    expect(pgState.pools).toEqual([]);
  });

  it('sets the flag, and does not throw, when the database cannot be reached', async () => {
    // What the lookup returns for a pool that cannot connect.
    lookup.checkLatestMigration.mockResolvedValue({
      isLatest: false,
      latestMigrationName: 'x',
      errorMessage: 'Failed to check migrations: connect ECONNREFUSED 127.0.0.1:5432',
    });

    await runSetup();

    expect(process.env[FLAG]).toBe('1');
    expect(warnings.mock.calls.map(call => call.join(' ')).join('\n')).toContain('ECONNREFUSED');
    expect(pgState.pools[0]!.end).toHaveBeenCalledOnce();
  });

  it('opens nothing when the target is not local', async () => {
    vi.stubEnv('POSTGRES_HOST', 'accounter.postgres.database.azure.invalid');
    vi.stubEnv('POSTGRES_DB', 'accounter_prod_db');

    await expect(runSetup()).rejects.toThrow(/non-local database/);

    expect(pgState.pools).toEqual([]);
    expect(lookup.checkLatestMigration).not.toHaveBeenCalled();
  });
});
