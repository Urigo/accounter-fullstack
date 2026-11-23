import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function runSeed(
  script: 'seed-demo-data.ts' | 'seed.ts',
  { env = {}, envFile = '' }: { env?: Record<string, string>; envFile?: string },
): { status: number | null; output: string } {
  const cwd = mkdtempSync(join(tmpdir(), 'accounter-seed-guard-'));
  tempDirs.push(cwd);
  writeFileSync(join(cwd, '.env'), envFile, 'utf8');

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

  // The other direction: the staging deploy seeds a deployed database on purpose, with both
  // opt-ins on its command line. That must still get past the guards -- here as far as the
  // connection attempt, which fails because the host does not resolve.
  it('lets command-line opt-ins through to the connection attempt', () => {
    const { status, output } = run({
      env: { ALLOW_DEMO_SEED: '1', ALLOW_REMOTE_DB: '1', POSTGRES_HOST: REMOTE_HOST },
    });

    expect(status).not.toBe(0);
    expect(output).not.toContain('Refusing to run');
    expect(output).toMatch(/ENOTFOUND|EAI_AGAIN|getaddrinfo/);
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
