import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Regression tests for the seeds' database guards, run against the real scripts.
 *
 * The demo seed TRUNCATEs every domain table; on 2026-11-23 it did so to production, from a
 * local test run. These pin the guards that now stand in front of that, through the scripts'
 * own entry points, so a refactor that reorders or drops a check fails here:
 *
 * - a non-local POSTGRES_HOST is refused without ALLOW_REMOTE_DB=1
 * - so is a blank POSTGRES_HOST when PGHOST is non-local -- `pg` falls back to PGHOST
 * - an opt-in (ALLOW_DEMO_SEED / ALLOW_REMOTE_DB) found in .env is refused outright
 * - with every opt-in on the command, a database that is not a demo database is still refused,
 *   by its name (`scripts/demo-seed-guard.ts`), before a connection is attempted
 *
 * Isolation, so these can never reach a real database even if a guard regresses:
 * - each run gets a fresh temp cwd holding its own .env, so the repo root .env is never read
 * - the child env is built from scratch: no POSTGRES_*, PG* or ALLOW_* is inherited
 * - remote hosts use the reserved `.invalid` TLD, which never resolves
 * - "must refuse" cases that need a local host use port 1, where nothing listens, so a
 *   regression fails to connect instead of truncating the dev database
 */

const repoRoot = join(import.meta.dirname, '../..');
const registerEsm = join(repoRoot, 'scripts/register-esm.js');

const REMOTE_HOST = 'prod.invalid';
const UNREACHABLE_LOCAL = { POSTGRES_HOST: 'localhost', POSTGRES_PORT: '1' };
const BOTH_OPT_INS = { ALLOW_DEMO_SEED: '1', ALLOW_REMOTE_DB: '1' };
const DNS_FAILURE = /ENOTFOUND|EAI_AGAIN|getaddrinfo/;

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * `envFile` is the cwd's `.env`. `parentEnvFile`, when given, is written two levels up, where
 * `test-db-config.ts` (which the demo seed imports) also loads `../../.env` from -- the run then
 * happens in `<temp>/a/b` so that file stays inside the temp directory.
 */
function runSeed(
  script: 'seed-demo-data.ts' | 'seed.ts',
  {
    env = {},
    envFile = '',
    parentEnvFile,
  }: { env?: Record<string, string>; envFile?: string; parentEnvFile?: string },
): { status: number | null; output: string } {
  const base = mkdtempSync(join(tmpdir(), 'accounter-seed-guard-'));
  tempDirs.push(base);
  const cwd = join(base, 'a', 'b');
  mkdirSync(cwd, { recursive: true });
  writeFileSync(join(cwd, '.env'), envFile, 'utf8');
  if (parentEnvFile !== undefined) {
    writeFileSync(join(base, '.env'), parentEnvFile, 'utf8');
  }

  const baseEnv: Record<string, string> = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR']) {
    const value = process.env[key];
    if (value !== undefined) baseEnv[key] = value;
  }

  const result = spawnSync(
    process.execPath,
    ['--import', registerEsm, join(repoRoot, 'scripts', script)],
    { cwd, env: { ...baseEnv, ...env }, encoding: 'utf8', timeout: 60_000 },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('scripts/seed-demo-data.ts guards', () => {
  const run = (options: Parameters<typeof runSeed>[1]) => runSeed('seed-demo-data.ts', options);

  it('refuses a non-local POSTGRES_HOST', () => {
    const { status, output } = run({ env: { ALLOW_DEMO_SEED: '1', POSTGRES_HOST: REMOTE_HOST } });

    expect(status).not.toBe(0);
    expect(output).toContain(
      `Refusing to run the demo data seed against a non-local database: ${REMOTE_HOST}`,
    );
    expect(output).not.toContain('Connected to database');
  });

  it.each([
    ['unset', {}],
    ['blank', { POSTGRES_HOST: '' }],
  ])('refuses a non-local PGHOST when POSTGRES_HOST is %s', (_label, hostEnv) => {
    const { status, output } = run({
      env: { ALLOW_DEMO_SEED: '1', PGHOST: REMOTE_HOST, ...hostEnv },
    });

    expect(status).not.toBe(0);
    expect(output).toContain(
      `Refusing to run the demo data seed against a non-local database: ${REMOTE_HOST}`,
    );
    expect(output).toContain('comes from PGHOST');
    expect(output).not.toContain('Connected to database');
  });

  it('refuses ALLOW_DEMO_SEED set in .env, even for a local host', () => {
    const { status, output } = run({ env: UNREACHABLE_LOCAL, envFile: 'ALLOW_DEMO_SEED=1\n' });

    expect(status).not.toBe(0);
    expect(output).toContain('ALLOW_DEMO_SEED is set in .env');
    expect(output).not.toContain('Connected to database');
  });

  it('refuses ALLOW_REMOTE_DB set in .env', () => {
    const { status, output } = run({
      env: { ALLOW_DEMO_SEED: '1' },
      envFile: `ALLOW_REMOTE_DB=1\nPOSTGRES_HOST=${REMOTE_HOST}\n`,
    });

    expect(status).not.toBe(0);
    expect(output).toContain('ALLOW_REMOTE_DB is set in .env');
    expect(output).not.toContain('Connected to database');
  });

  // The seed imports test-db-config.ts (via fixture-loader), which loads ../../.env into
  // process.env before the seed's own config() runs -- a file the seed's own check never saw.
  it('refuses ALLOW_DEMO_SEED set in ../../.env', () => {
    const { status, output } = run({
      env: UNREACHABLE_LOCAL,
      parentEnvFile: 'ALLOW_DEMO_SEED=1\n',
    });

    expect(status).not.toBe(0);
    expect(output).toContain('ALLOW_DEMO_SEED is set in a .env file (.env or ../../.env)');
    expect(output).not.toContain('ECONNREFUSED');
  });

  // The other direction: the staging deploy seeds a deployed database on purpose, with both
  // opt-ins on its command line and a database named for what it is. That must still get past
  // the guards -- here as far as the connection attempt, which fails because the host does not
  // resolve.
  it('lets command-line opt-ins through to the connection attempt for a staging database', () => {
    const { status, output } = run({
      env: { ...BOTH_OPT_INS, POSTGRES_HOST: REMOTE_HOST, POSTGRES_DB: 'accounter_staging_db' },
    });

    expect(status).not.toBe(0);
    expect(output).not.toContain('Refusing to');
    expect(output).toContain('(demo-name)');
    expect(output).toMatch(DNS_FAILURE);
  });

  // Both opt-ins are what a staging build command carries, so past them the only thing that
  // selects the database is POSTGRES_*. The name is checked before anything connects.
  describe('with both opt-ins on the command, by database name', () => {
    it('refuses a production database', () => {
      const { status, output } = run({
        env: { ...BOTH_OPT_INS, POSTGRES_HOST: REMOTE_HOST, POSTGRES_DB: 'accounter_prod_db' },
      });

      expect(status).not.toBe(0);
      expect(output).toContain('the database name "accounter_prod_db" says production');
      expect(output).not.toMatch(DNS_FAILURE);
      expect(output).not.toContain('Connected to database');
    });

    it('refuses a production database that ALLOW_DEMO_SEED_DATABASE names', () => {
      const { status, output } = run({
        env: {
          ...BOTH_OPT_INS,
          ALLOW_DEMO_SEED_DATABASE: 'accounter_prod_db',
          POSTGRES_HOST: REMOTE_HOST,
          POSTGRES_DB: 'accounter_prod_db',
        },
      });

      expect(status).not.toBe(0);
      expect(output).toContain('says production');
      expect(output).not.toMatch(DNS_FAILURE);
    });

    it.each([
      ['a name that says nothing', { POSTGRES_DB: 'accounter' }],
      ['no database name at all', {}],
    ])('refuses a remote database with %s', (_label, database) => {
      const { status, output } = run({
        env: { ...BOTH_OPT_INS, POSTGRES_HOST: REMOTE_HOST, ...database },
      });

      expect(status).not.toBe(0);
      expect(output).toMatch(/nothing marks ".*" as a demo database/);
      expect(output).not.toMatch(DNS_FAILURE);
    });

    it('refuses a local database that is not the dev database, such as a local copy of production', () => {
      const { status, output } = run({
        env: { ALLOW_DEMO_SEED: '1', ...UNREACHABLE_LOCAL, POSTGRES_DB: 'accounter_legacy' },
      });

      expect(status).not.toBe(0);
      expect(output).toContain('nothing marks "accounter_legacy" as a demo database');
      expect(output).not.toContain('ECONNREFUSED');
    });

    it('refuses ALLOW_DEMO_SEED_DATABASE set in .env', () => {
      const { status, output } = run({
        env: { ALLOW_DEMO_SEED: '1', ...UNREACHABLE_LOCAL, POSTGRES_DB: 'accounter_legacy' },
        envFile: 'ALLOW_DEMO_SEED_DATABASE=accounter_legacy\n',
      });

      expect(status).not.toBe(0);
      expect(output).toContain('ALLOW_DEMO_SEED_DATABASE is set in .env');
      expect(output).not.toContain('ECONNREFUSED');
    });
  });

  // A refusal is the one message that has to be read. It is printed once, without a stack.
  it('prints a refusal once, as a message and not as a crash', () => {
    const { output } = run({ env: { ALLOW_DEMO_SEED: '1', POSTGRES_HOST: REMOTE_HOST } });

    expect(output.match(/Refusing to run the demo data seed/g)).toHaveLength(1);
    expect(output).not.toContain('Fatal seed error');
    expect(output).not.toMatch(/^\s+at /m);
  });
});

describe('scripts/seed.ts guards', () => {
  const run = (options: Parameters<typeof runSeed>[1]) => runSeed('seed.ts', options);

  it('refuses a non-local PGHOST when POSTGRES_HOST is unset', () => {
    const { status, output } = run({ env: { PGHOST: REMOTE_HOST } });

    expect(status).not.toBe(0);
    expect(output).toContain(
      `Refusing to run scripts/seed.ts against a non-local database: ${REMOTE_HOST}`,
    );
  });

  it('refuses ALLOW_REMOTE_DB set in .env', () => {
    const { status, output } = run({
      envFile: `ALLOW_REMOTE_DB=1\nPOSTGRES_HOST=${REMOTE_HOST}\n`,
    });

    expect(status).not.toBe(0);
    expect(output).toContain('ALLOW_REMOTE_DB is set in .env');
  });
});
