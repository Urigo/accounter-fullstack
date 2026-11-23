import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveDemoSeedTestEnv } from './demo-seed-test-env.js';

/**
 * `seed-and-validate.test.ts` starts the demo seed, which truncates the domain tables of the
 * database it is pointed at. These tests pin what that test is allowed to start it against:
 * a local database and nothing else, with no opt-in taken from a `.env` file or added here.
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

    it('judges PGHOST when POSTGRES_HOST is only whitespace, and says where the host came from', () => {
      const env = { ...OPTED_IN, POSTGRES_HOST: '  ', PGHOST: REMOTE_HOST };

      expect(() => resolveDemoSeedTestEnv(workspace(), env)).toThrow(/comes from PGHOST/);
    });

    it('takes ALLOW_REMOTE_DB out of what the children get', () => {
      // The seed script accepts a remote host with it. Without it, the script's own guard has
      // no way to let one through, whatever the caller exported for the rest of the run.
      const env = { ...OPTED_IN, POSTGRES_HOST: 'localhost', ALLOW_REMOTE_DB: '1' };

      expect(resolveDemoSeedTestEnv(workspace(), env)).toEqual({
        ...OPTED_IN,
        POSTGRES_HOST: 'localhost',
      });
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

  describe('opt-ins come from the caller', () => {
    it('never supplies ALLOW_DEMO_SEED itself', () => {
      // The returned environment is what the seed script gets. Anything that made this
      // function add the opt-in would let the test opt a database in by itself again.
      const childEnv = resolveDemoSeedTestEnv(workspace(), { POSTGRES_HOST: 'db' });

      expect(childEnv).toEqual({ POSTGRES_HOST: 'db' });
    });

    it.each(['ALLOW_DEMO_SEED', 'ALLOW_REMOTE_DB', 'ALLOW_DEMO_SEED_DATABASE'])(
      'refuses %s when the .env the children read sets it',
      name => {
        const root = workspace(`POSTGRES_HOST=localhost\n${name}=1\n`);

        expect(() => resolveDemoSeedTestEnv(root, {})).toThrow(
          new RegExp(`Refusing to run: ${name} is set in .*\\.env`),
        );
      },
    );

    it('refuses it there even when the caller set it too', () => {
      const root = workspace('ALLOW_DEMO_SEED=1\n');

      expect(() =>
        resolveDemoSeedTestEnv(root, { ...OPTED_IN, POSTGRES_HOST: 'localhost' }),
      ).toThrow(/ALLOW_DEMO_SEED is set in /);
    });
  });

  it('leaves the environment it was given, and process.env, untouched', () => {
    const env = { ...OPTED_IN };
    const hostBefore = process.env['POSTGRES_HOST'];

    resolveDemoSeedTestEnv(
      workspace('POSTGRES_HOST=db.from-dotenv.invalid\nDEMO_SEED_TEST_ENV_PROBE=1\n'),
      { ...env, POSTGRES_HOST: 'localhost' },
    );

    expect(env).toEqual(OPTED_IN);
    // Only the two keys this call could have written, so the assertion does not depend on
    // what else is in the environment of the process running the suite.
    expect(process.env['POSTGRES_HOST']).toBe(hostBefore);
    expect(process.env['DEMO_SEED_TEST_ENV_PROBE']).toBeUndefined();
  });
});
