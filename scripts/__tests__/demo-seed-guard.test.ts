import { describe, expect, it, vi } from 'vitest';
import {
  ALLOW_DEMO_SEED_DATABASE_ENV,
  assertDemoSeedTarget,
  classifyDemoSeedTarget,
  DEMO_SEED_TABLES,
  DemoSeedRefusedError,
  resetDemoSeedTables,
  type DemoSeedQueryable,
} from '../demo-seed-guard.js';

/**
 * Nothing here opens a connection: the rules are pure and the reset takes a fake client.
 * Remote hosts use the reserved `.invalid` TLD, which cannot resolve, so even a mistake could
 * not reach one.
 *
 * Every call passes its own `env` object, never `process.env`, so a variable in the shell that
 * runs the suite (ALLOW_DEMO_SEED_DATABASE, ALLOW_REMOTE_DB) cannot change a result.
 */

const REMOTE_HOST = 'accounter.postgres.database.azure.invalid';

/** The names are the real ones: these are the two databases the rule exists to tell apart. */
const PRODUCTION = {
  host: REMOTE_HOST,
  port: 5432,
  db: 'accounter_prod_db',
  user: 'accounter_prod_user',
};
const STAGING = {
  host: REMOTE_HOST,
  port: 5432,
  db: 'accounter_staging_db',
  user: 'accounter_staging_user',
};
const LOCAL_DEV = { host: 'localhost', port: 5432, db: 'accounter', user: 'postgres' };
const CI = { host: '127.0.0.1', port: 5432, db: 'accounter_test', user: 'postgres' };

const remote = (db: string | undefined) => ({ ...PRODUCTION, db });
const local = (db: string | undefined) => ({ ...LOCAL_DEV, db });

function refusalMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(DemoSeedRefusedError);
    return (error as Error).message;
  }
  throw new Error('expected a refusal, but the target was accepted');
}

describe('classifyDemoSeedTarget', () => {
  describe('the production database', () => {
    it('refuses the production database', () => {
      expect(classifyDemoSeedTarget(PRODUCTION, {})).toEqual({
        allowed: false,
        because: 'production-name',
      });
    });

    it('has no override: not ALLOW_REMOTE_DB, not naming the database, not both', () => {
      const everything = { ALLOW_REMOTE_DB: '1', [ALLOW_DEMO_SEED_DATABASE_ENV]: PRODUCTION.db };

      expect(classifyDemoSeedTarget(PRODUCTION, { ALLOW_REMOTE_DB: '1' }).allowed).toBe(false);
      expect(classifyDemoSeedTarget(PRODUCTION, everything)).toEqual({
        allowed: false,
        because: 'production-name',
      });
    });
  });

  describe('production names', () => {
    const names = [
      'accounter_prod_db',
      'prod',
      'PROD_DB',
      'accounter-prod',
      'prod2',
      'production',
      'accounter_production',
      'accounter_prd',
      'accounter_live',
      // A demo word next to a production word does not rescue it.
      'prod_test',
      'accounter_prod_staging_copy',
      // Stray quotes and whitespace from a hand-edited .env are stripped before judging.
      " 'accounter_prod_db' ",
    ];

    it.each(names)('refuses %j on a remote host', db => {
      expect(classifyDemoSeedTarget(remote(db), {})).toEqual({
        allowed: false,
        because: 'production-name',
      });
    });

    it.each(names)('refuses %j on localhost too, since a tunnel looks local', db => {
      expect(classifyDemoSeedTarget(local(db), {})).toEqual({
        allowed: false,
        because: 'production-name',
      });
    });

    it.each(['reproduce_bugs_test', 'product_demo', 'olive_test', 'delivery_staging'])(
      'does not read %j as production: a word only counts when no letter touches it',
      db => {
        expect(classifyDemoSeedTarget(remote(db), {})).toEqual({
          allowed: true,
          because: 'demo-name',
        });
      },
    );
  });

  describe('demo environments on a remote host', () => {
    it('accepts the staging database with no variable beyond ALLOW_DEMO_SEED', () => {
      expect(classifyDemoSeedTarget(STAGING, {})).toEqual({ allowed: true, because: 'demo-name' });
    });

    it.each([
      'accounter_staging_db',
      // The name in packages/server/docs/demo-staging-guide.md.
      'accounter_staging',
      'staging',
      'ACCOUNTER_STAGING',
      'staging2',
      'accounter-stage',
      'accounter_demo',
      'accounter_test',
      'accounter_testing',
      'pr_1234_preview',
      'sandbox1',
      'accounter_e2e',
      'accounter_local',
    ])('accepts %j', db => {
      expect(classifyDemoSeedTarget(remote(db), {})).toEqual({
        allowed: true,
        because: 'demo-name',
      });
    });
  });

  describe('any other remote database', () => {
    const names = [
      'accounter',
      'postgres',
      'accounter_legacy',
      'main',
      // Demo words inside a longer word do not count.
      'latest',
      'contest',
      'mystaging',
      'accounterdemo',
    ];

    it.each(names)('refuses %j', db => {
      expect(classifyDemoSeedTarget(remote(db), {})).toEqual({
        allowed: false,
        because: 'not-a-demo-name',
      });
    });

    it.each([undefined, '', '   '])('refuses a missing name (%j)', db => {
      expect(classifyDemoSeedTarget(remote(db), {})).toEqual({
        allowed: false,
        because: 'not-a-demo-name',
      });
    });

    it('is not unlocked by ALLOW_REMOTE_DB=1', () => {
      expect(classifyDemoSeedTarget(remote('accounter'), { ALLOW_REMOTE_DB: '1' })).toEqual({
        allowed: false,
        because: 'not-a-demo-name',
      });
    });

    it('is accepted when ALLOW_DEMO_SEED_DATABASE names it exactly', () => {
      expect(
        classifyDemoSeedTarget(remote('accounter_uat'), {
          [ALLOW_DEMO_SEED_DATABASE_ENV]: 'accounter_uat',
        }),
      ).toEqual({ allowed: true, because: 'named-by-operator' });
    });

    it.each(['1', 'true', 'accounter', 'ACCOUNTER_UAT', 'accounter_uat_2', '*'])(
      'is refused when ALLOW_DEMO_SEED_DATABASE is %j, which is not its name',
      value => {
        expect(
          classifyDemoSeedTarget(remote('accounter_uat'), {
            [ALLOW_DEMO_SEED_DATABASE_ENV]: value,
          }),
        ).toEqual({ allowed: false, because: 'name-mismatch' });
      },
    );

    it('cannot be confirmed when it has no name to confirm', () => {
      expect(
        classifyDemoSeedTarget(remote(undefined), { [ALLOW_DEMO_SEED_DATABASE_ENV]: 'accounter' }),
      ).toEqual({ allowed: false, because: 'name-mismatch' });
    });
  });

  describe('local hosts', () => {
    it('accepts the dev container, whose database name says nothing either way', () => {
      expect(classifyDemoSeedTarget(LOCAL_DEV, {})).toEqual({
        allowed: true,
        because: 'local-host',
      });
    });

    it('accepts the CI service container', () => {
      expect(classifyDemoSeedTarget(CI, {})).toEqual({ allowed: true, because: 'local-host' });
    });

    it.each(['localhost', '127.0.0.1', '::1', 'db', 'host.docker.internal', undefined])(
      'accepts host %j',
      host => {
        expect(classifyDemoSeedTarget({ ...LOCAL_DEV, host }, {}).allowed).toBe(true);
      },
    );

    it('needs no confirmation and ignores a stale one', () => {
      expect(
        classifyDemoSeedTarget(LOCAL_DEV, { [ALLOW_DEMO_SEED_DATABASE_ENV]: 'something_else' }),
      ).toEqual({ allowed: true, because: 'local-host' });
    });
  });
});

describe('assertDemoSeedTarget', () => {
  it('returns the verdict for an accepted target', () => {
    expect(assertDemoSeedTarget(STAGING, {})).toEqual({ allowed: true, because: 'demo-name' });
    expect(assertDemoSeedTarget(LOCAL_DEV, {})).toEqual({ allowed: true, because: 'local-host' });
  });

  it('names the production target and offers no way through', () => {
    const message = refusalMessage(() => assertDemoSeedTarget(PRODUCTION, {}));

    expect(message).toContain(
      `accounter_prod_user@${REMOTE_HOST}:5432/accounter_prod_db: the database name ` +
        '"accounter_prod_db" says production',
    );
    expect(message).toContain('no variable overrides that');
    // Whoever reads this in a hurry must not find a variable to set.
    expect(message).not.toContain(ALLOW_DEMO_SEED_DATABASE_ENV);
    expect(message).not.toContain('ALLOW_REMOTE_DB');
  });

  it('tells an unrecognized remote target which names pass and how to confirm another', () => {
    const message = refusalMessage(() => assertDemoSeedTarget(remote('accounter_uat'), {}));

    expect(message).toContain('nothing marks this remote database as a demo');
    expect(message).toContain('staging, stage, demo, test, testing, preview, sandbox, e2e, local');
    expect(message).toContain(
      `${ALLOW_DEMO_SEED_DATABASE_ENV}=<database name> ALLOW_DEMO_SEED=1 yarn seed:staging-demo`,
    );
    // The name has to be typed by someone who knows which database it is, not pasted back.
    expect(message).not.toContain(`${ALLOW_DEMO_SEED_DATABASE_ENV}=accounter_uat`);
    expect(message).not.toContain('ALLOW_REMOTE_DB');
  });

  it('says which two names disagree when the confirmation does not match', () => {
    const message = refusalMessage(() =>
      assertDemoSeedTarget(remote('accounter_main'), {
        [ALLOW_DEMO_SEED_DATABASE_ENV]: 'accounter_uat',
      }),
    );

    expect(message).toContain(`${ALLOW_DEMO_SEED_DATABASE_ENV} names "accounter_uat"`);
    expect(message).toContain('this command targets "accounter_main"');
  });

  it.each([PRODUCTION, remote('accounter_uat')])(
    'says what the seed destroys and how to inspect .env without the password (%#)',
    target => {
      const message = refusalMessage(() => assertDemoSeedTarget(target, {}));

      expect(message).toContain('truncating the domain tables');
      expect(message).toContain("grep -E '^POSTGRES_(HOST|PORT|DB|USER)=' .env");
      // The older guard's hint, which also prints POSTGRES_PASSWORD.
      expect(message).not.toContain("grep '^POSTGRES' .env");
    },
  );

  it('never puts a password in the message', () => {
    const withSecret = { ...PRODUCTION, password: 'super-secret' } as never;
    expect(refusalMessage(() => assertDemoSeedTarget(withSecret, {}))).not.toContain(
      'super-secret',
    );
  });

  it('strips control characters from the name it prints', () => {
    const message = refusalMessage(() =>
      assertDemoSeedTarget(remote('accounter\u001B[31m_prod'), {}),
    );

    // eslint-disable-next-line no-control-regex -- asserting control characters are gone
    expect(message).not.toMatch(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/);
  });
});

describe('resetDemoSeedTables', () => {
  /** A pg client stand-in: records every statement and answers `current_database()`. */
  function fakeClient(connectedDatabase: unknown) {
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql);
      return /current_database\(\)/.test(sql)
        ? { rows: connectedDatabase === undefined ? [] : [{ database: connectedDatabase }] }
        : { rows: [] };
    });
    const client: DemoSeedQueryable = { query };
    return { client, statements };
  }

  const truncates = (statements: string[]) => statements.filter(sql => /truncate/i.test(sql));

  it('clears exactly the tables the seed owns', () => {
    // Pinned on purpose: adding a table here widens what one command can destroy, and
    // reference data (countries, exchange rates) must never join the list.
    expect(DEMO_SEED_TABLES).toEqual([
      'ledger_records',
      'documents',
      'transactions',
      'charges',
      'financial_accounts_tax_categories',
      'financial_accounts',
      'invitations',
      'business_users',
      'tags',
      'tax_categories',
      'businesses',
      'user_context',
      'financial_entities',
    ]);
  });

  it('asks the server which database it is on, then truncates', async () => {
    const { client, statements } = fakeClient('accounter_test');

    await resetDemoSeedTables(client, CI, {});

    expect(statements).toHaveLength(2);
    expect(statements[0]).toBe('SELECT current_database() AS database');
    expect(statements[1]).toBe(
      `TRUNCATE TABLE ${DEMO_SEED_TABLES.map(table => `accounter_schema.${table}`).join(', ')} ` +
        'RESTART IDENTITY CASCADE',
    );
  });

  it('truncates the staging database, as the staging deploy needs', async () => {
    const { client, statements } = fakeClient('accounter_staging_db');

    await resetDemoSeedTables(client, STAGING, {});

    expect(truncates(statements)).toHaveLength(1);
  });

  it('refuses when a staging name is configured but the server says production', async () => {
    // A pooler or proxy can map one database name onto another. The configured name passed
    // the first check, so only this one stands between the command and production.
    const { client, statements } = fakeClient('accounter_prod_db');

    await expect(resetDemoSeedTables(client, STAGING, {})).rejects.toThrow(DemoSeedRefusedError);
    await expect(resetDemoSeedTables(client, STAGING, {})).rejects.toThrow(
      /server reports this connection is on "accounter_prod_db"[\s\S]*"accounter_staging_db"/,
    );

    expect(truncates(statements)).toEqual([]);
  });

  it('refuses production behind a tunnel on localhost', async () => {
    const { client, statements } = fakeClient('accounter_prod_db');

    await expect(resetDemoSeedTables(client, LOCAL_DEV, {})).rejects.toThrow(/says production/);

    expect(truncates(statements)).toEqual([]);
  });

  it('refuses a remote database the server names differently from the confirmation', async () => {
    const env = { [ALLOW_DEMO_SEED_DATABASE_ENV]: 'accounter_uat' };
    const { client, statements } = fakeClient('accounter_main');

    // The configured name is the confirmed one, so the first check passes.
    expect(assertDemoSeedTarget(remote('accounter_uat'), env).allowed).toBe(true);
    await expect(resetDemoSeedTables(client, remote('accounter_uat'), env)).rejects.toThrow(
      DemoSeedRefusedError,
    );

    expect(truncates(statements)).toEqual([]);
  });

  it.each([undefined, null, '', 42])(
    'refuses when the server does not report a database name (%j)',
    async answer => {
      const { client, statements } = fakeClient(answer);

      await expect(resetDemoSeedTables(client, CI, {})).rejects.toThrow(
        /did not say which database/,
      );

      expect(truncates(statements)).toEqual([]);
    },
  );

  it('does not truncate when the identity query fails', async () => {
    const query = vi.fn(async (sql: string) => {
      if (/current_database\(\)/.test(sql)) throw new Error('connection lost');
      return { rows: [] };
    });

    await expect(resetDemoSeedTables({ query }, CI, {})).rejects.toThrow('connection lost');

    expect(query).toHaveBeenCalledTimes(1);
  });
});
