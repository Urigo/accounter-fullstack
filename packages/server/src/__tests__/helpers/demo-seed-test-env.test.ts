import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveDemoSeedTestEnv } from './demo-seed-test-env.js';

/**
 * `seed-and-validate.test.ts` starts the demo seed, which truncates the domain tables of the
 * database it is pointed at. These tests pin what that test is allowed to start it against:
 * a local database, with `ALLOW_DEMO_SEED=1` supplied by the caller, and nothing else.
 *
 * Nothing here opens a connection or starts a process. Every call passes its own `env` object
 * and its own temp directory, so neither the shell running the suite nor a `.env` on the
 * machine can change a result. Remote hosts use the reserved `.invalid` TLD.
 */

const REMOTE_HOST = 'accounter.postgres.database.azure.invalid';
const OPTED_IN = { ALLOW_DEMO_SEED: '1' };

describe('resolveDemoSeedTestEnv', () => {
  const dirs: string[] = [];

  /** A stand-in workspace root, optionally holding the `.env` the seed script would load. */
  function workspace(dotenv?: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'demo-seed-test-env-'));
    dirs.push(dir);
    if (dotenv !== undefined) writeFileSync(join(dir, '.env'), dotenv);
    return dir;
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  describe('the target must be local', () => {
    it('passes a local target through unchanged', () => {
      const env = { ...OPTED_IN, POSTGRES_HOST: '127.0.0.1', POSTGRES_DB: 'accounter_test' };

      expect(resolveDemoSeedTestEnv(workspace(), env)).toEqual(env);
    });

    it('refuses a remote host', () => {
      const env = { ...OPTED_IN, POSTGRES_HOST: REMOTE_HOST, POSTGRES_DB: 'accounter_prod_db' };

      expect(() => resolveDemoSeedTestEnv(workspace(), env)).toThrow(
        /Refusing to run the demo seed test against a non-local database/,
      );
    });

    it('refuses a remote demo database too: the test only ever resets a local one', () => {
      const env = { ...OPTED_IN, POSTGRES_HOST: REMOTE_HOST, POSTGRES_DB: 'accounter_staging_db' };

      expect(() => resolveDemoSeedTestEnv(workspace(), env)).toThrow(/non-local database/);
    });

    it('has no override: ALLOW_REMOTE_DB and ALLOW_DEMO_SEED_DATABASE change nothing', () => {
      const env = {
        ...OPTED_IN,
        POSTGRES_HOST: REMOTE_HOST,
        POSTGRES_DB: 'accounter_uat',
        ALLOW_REMOTE_DB: '1',
        ALLOW_DEMO_SEED_DATABASE: 'accounter_uat',
      };

      expect(() => resolveDemoSeedTestEnv(workspace(), env)).toThrow(
        /ALLOW_REMOTE_DB does not apply here and there is no other override/,
      );
    });

    it('judges PGHOST when POSTGRES_HOST is unset, as node-postgres falls back to it', () => {
      const env = { ...OPTED_IN, PGHOST: REMOTE_HOST };

      expect(() => resolveDemoSeedTestEnv(workspace(), env)).toThrow(/non-local database/);
    });
  });

  describe('the target is the one the seed script would resolve', () => {
    it('refuses a remote host that only the .env file names', () => {
      // POSTGRES_HOST is absent from the environment, so judging the environment alone would
      // call this local. The seed script would then load .env and connect to the remote host.
      const root = workspace(`POSTGRES_HOST=${REMOTE_HOST}\nPOSTGRES_DB=accounter_prod_db\n`);

      expect(() => resolveDemoSeedTestEnv(root, OPTED_IN)).toThrow(
        `non-local database: ${REMOTE_HOST}/accounter_prod_db`,
      );
    });

    it('lets the environment win over .env, as dotenv does', () => {
      const root = workspace(`POSTGRES_HOST=${REMOTE_HOST}\nPOSTGRES_DB=accounter_prod_db\n`);
      const env = { ...OPTED_IN, POSTGRES_HOST: 'localhost', POSTGRES_DB: 'accounter_test' };

      expect(resolveDemoSeedTestEnv(root, env)).toEqual(env);
    });

    it('hands the child the values .env supplied, so its own dotenv load changes nothing', () => {
      const root = workspace(
        'POSTGRES_HOST=localhost\nPOSTGRES_PORT=5433\nPOSTGRES_DB=accounter\n',
      );

      expect(resolveDemoSeedTestEnv(root, OPTED_IN)).toEqual({
        ...OPTED_IN,
        POSTGRES_HOST: 'localhost',
        POSTGRES_PORT: '5433',
        POSTGRES_DB: 'accounter',
      });
    });

    it('pins localhost when nothing names a host, so no later .env can supply another', () => {
      expect(resolveDemoSeedTestEnv(workspace(), OPTED_IN)).toEqual({
        ...OPTED_IN,
        POSTGRES_HOST: 'localhost',
      });
    });
  });

  describe('the opt-in must come from the caller', () => {
    it('refuses without ALLOW_DEMO_SEED=1', () => {
      const env = { POSTGRES_HOST: 'localhost' };

      expect(() => resolveDemoSeedTestEnv(workspace(), env)).toThrow(
        /needs ALLOW_DEMO_SEED=1 on the command/,
      );
    });

    it.each(['0', 'true', 'yes', ''])('refuses ALLOW_DEMO_SEED=%j', value => {
      const env = { POSTGRES_HOST: 'localhost', ALLOW_DEMO_SEED: value };

      expect(() => resolveDemoSeedTestEnv(workspace(), env)).toThrow(/needs ALLOW_DEMO_SEED=1/);
    });

    it('never supplies the opt-in itself', () => {
      // The returned environment is what the seed script gets. Anything that made this
      // function add ALLOW_DEMO_SEED would let the test opt a database in by itself again.
      const childEnv = resolveDemoSeedTestEnv(workspace(), { ...OPTED_IN, POSTGRES_HOST: 'db' });

      expect(childEnv['ALLOW_DEMO_SEED']).toBe('1');
      expect(() => resolveDemoSeedTestEnv(workspace(), { POSTGRES_HOST: 'db' })).toThrow();
    });

    it('reports a remote target before a missing opt-in', () => {
      // The wrong database is the news. Asking for the opt-in first would invite setting it.
      expect(() => resolveDemoSeedTestEnv(workspace(), { POSTGRES_HOST: REMOTE_HOST })).toThrow(
        /non-local database/,
      );
    });
  });

  it('leaves the environment it was given, and process.env, untouched', () => {
    const env = { ...OPTED_IN };
    const before = { ...process.env };

    resolveDemoSeedTestEnv(workspace('POSTGRES_HOST=localhost\nDEMO_SEED_TEST_ENV_PROBE=1\n'), env);

    expect(env).toEqual(OPTED_IN);
    expect(process.env).toEqual(before);
  });
});
