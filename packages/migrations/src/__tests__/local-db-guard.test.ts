import { describe, expect, it, vi } from 'vitest';
import {
  ALLOW_DEMO_SEED_ENV,
  ALLOW_REMOTE_DB_ENV,
  ENFORCE_LOCAL_DB_ENV,
  PER_COMMAND_OPT_INS,
  assertLocalDatabase,
  assertLocalDatabaseOnly,
  assertOptInsNotInEnvFile,
  describeDatabaseTarget,
  isLocalDatabaseHost,
  isRemoteDatabaseAllowed,
  warnIfRemoteDatabase,
} from '../local-db-guard.js';

const REMOTE = {
  host: 'accounter2.postgres.database.azure.com',
  port: 5432,
  db: 'accounter_prod_db',
  user: 'accounter_prod_user',
};

const LOCAL = { host: 'localhost', port: 5432, db: 'accounter', user: 'postgres' };

describe('isLocalDatabaseHost', () => {
  it.each([
    'localhost',
    'LOCALHOST',
    '  localhost  ',
    "'localhost'",
    '"localhost"',
    '127.0.0.1',
    '127.1.2.3',
    '::1',
    '[::1]',
    '0.0.0.0',
    'db',
    'host.docker.internal',
    '/var/run/postgresql',
  ])('treats %j as local', host => {
    expect(isLocalDatabaseHost(host)).toBe(true);
  });

  it.each([
    'accounter2.postgres.database.azure.com',
    'db.example.com',
    '10.0.0.5',
    '192.168.1.10',
    'localhost.evil.com',
    'notlocalhost',
  ])('treats %j as non-local', host => {
    expect(isLocalDatabaseHost(host)).toBe(false);
  });

  it('treats an absent host as local, matching libpq defaults', () => {
    // `pg` connects locally when no host is given, so calling this "remote" would be wrong.
    expect(isLocalDatabaseHost(undefined)).toBe(true);
    expect(isLocalDatabaseHost(null)).toBe(true);
    expect(isLocalDatabaseHost('')).toBe(true);
    expect(isLocalDatabaseHost('   ')).toBe(true);
  });

  it('does not treat a private LAN address as local', () => {
    // A deployed database reachable on a VPN is still not the dev container.
    expect(isLocalDatabaseHost('172.16.0.9')).toBe(false);
  });
});

describe('describeDatabaseTarget', () => {
  it('renders user, host, port and database', () => {
    expect(describeDatabaseTarget(REMOTE)).toBe(
      'accounter_prod_user@accounter2.postgres.database.azure.com:5432/accounter_prod_db',
    );
  });

  it('never includes a password even when one is present on the object', () => {
    const withSecret = { ...REMOTE, password: 'super-secret' } as never;
    expect(describeDatabaseTarget(withSecret)).not.toContain('super-secret');
  });

  it('marks an absent host explicitly', () => {
    expect(describeDatabaseTarget({ db: 'accounter' })).toBe('<default>/accounter');
  });

  // The displayed value must match the value that was classified, or the message describes
  // a different target than the one the guard judged.
  it('shows the trimmed, unquoted host rather than the raw .env value', () => {
    expect(describeDatabaseTarget({ host: "  'db.example.com'  " })).toBe('db.example.com');
  });

  it('applies the same trimming to port, user and database', () => {
    expect(
      describeDatabaseTarget({
        host: ' "db.example.com" ',
        port: " '5433' ",
        db: "  'prod_db' ",
        user: ' "prod_user" ',
      }),
    ).toBe('prod_user@db.example.com:5433/prod_db');
  });

  it('strips control characters so an ANSI escape cannot reach the terminal', () => {
    const withEscape = describeDatabaseTarget({
      host: 'db.example.com\u001B[31m',
      user: 'user\u0000\u0007',
      db: 'prod\u007F',
    });

    // The ESC byte is removed, which is what disarms the sequence; the remaining "[31m" is
    // inert printable text and is deliberately left visible rather than silently rewritten.
    expect(withEscape).toBe('user@db.example.com[31m/prod');
    // eslint-disable-next-line no-control-regex -- asserting control characters are gone
    expect(withEscape).not.toMatch(/[\u0000-\u001F\u007F-\u009F]/);
  });

  it('treats a host that is only quotes and whitespace as absent', () => {
    expect(describeDatabaseTarget({ host: "  ''  " })).toBe('<default>');
  });

  it('truncates a pathologically long value instead of flooding the message', () => {
    const long = 'a'.repeat(500);
    const rendered = describeDatabaseTarget({ host: long });
    expect(rendered.length).toBeLessThan(130);
    expect(rendered.endsWith('…')).toBe(true);
  });
});

describe('isRemoteDatabaseAllowed', () => {
  it('requires exactly "1"', () => {
    expect(isRemoteDatabaseAllowed({ [ALLOW_REMOTE_DB_ENV]: '1' })).toBe(true);
    expect(isRemoteDatabaseAllowed({ [ALLOW_REMOTE_DB_ENV]: 'true' })).toBe(false);
    expect(isRemoteDatabaseAllowed({ [ALLOW_REMOTE_DB_ENV]: '0' })).toBe(false);
    expect(isRemoteDatabaseAllowed({})).toBe(false);
  });
});

describe('assertLocalDatabase', () => {
  it('passes for a local target', () => {
    expect(() => assertLocalDatabase(LOCAL, 'the test harness', {})).not.toThrow();
  });

  it('throws for a non-local target', () => {
    expect(() => assertLocalDatabase(REMOTE, 'the test harness', {})).toThrow(
      /Refusing to run the test harness against a non-local database/,
    );
  });

  it('names the offending host and the opt-in variable in the message', () => {
    let message = '';
    try {
      assertLocalDatabase(REMOTE, 'the test harness', {});
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('accounter2.postgres.database.azure.com');
    expect(message).toContain(ALLOW_REMOTE_DB_ENV);
    // The hint must not be one that prints POSTGRES_PASSWORD along with the rest.
    expect(message).toContain("grep -E '^POSTGRES_(HOST|PORT|DB|USER)=' .env");
    expect(message).not.toContain("grep '^POSTGRES' .env");
  });

  it('never leaks a password into the error message', () => {
    let message = '';
    try {
      assertLocalDatabase({ ...REMOTE, password: 'super-secret' } as never, 'ctx', {});
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain('super-secret');
  });

  it('allows a non-local target when explicitly opted in', () => {
    expect(() =>
      assertLocalDatabase(REMOTE, 'the RLS suite', { [ALLOW_REMOTE_DB_ENV]: '1' }),
    ).not.toThrow();
  });
});

describe('assertLocalDatabaseOnly', () => {
  // Every call passes its own `env`, so a PGHOST exported in the shell running the suite
  // cannot change a result.
  const messageFor = (target: object, env: NodeJS.ProcessEnv = {}): string => {
    try {
      assertLocalDatabaseOnly(target as never, 'the demo seed test', env);
    } catch (error) {
      return (error as Error).message;
    }
    return '';
  };

  it('passes for a local target', () => {
    expect(() => assertLocalDatabaseOnly(LOCAL, 'the demo seed test', {})).not.toThrow();
  });

  it('treats an absent host as local when PGHOST is unset too, like the rest of the guard', () => {
    expect(() =>
      assertLocalDatabaseOnly({ db: 'accounter' }, 'the demo seed test', {}),
    ).not.toThrow();
  });

  it('throws for a non-local target and names it', () => {
    expect(() => assertLocalDatabaseOnly(REMOTE, 'the demo seed test', {})).toThrow(
      'Refusing to run the demo seed test against a non-local database: ' +
        `${REMOTE.user}@${REMOTE.host}:${REMOTE.port}/${REMOTE.db}`,
    );
  });

  it('is not switched off by ALLOW_REMOTE_DB=1, unlike assertLocalDatabase', () => {
    const optedIn = { [ALLOW_REMOTE_DB_ENV]: '1' };

    expect(() => assertLocalDatabase(REMOTE, 'the test harness', optedIn)).not.toThrow();
    expect(() => assertLocalDatabaseOnly(REMOTE, 'the demo seed test', optedIn)).toThrow(
      /non-local database/,
    );
  });

  it('resolves a blank host through PGHOST, as assertLocalDatabase does', () => {
    const pgHost = { PGHOST: 'prod.invalid' };

    expect(messageFor({ db: 'accounter' }, pgHost)).toContain(
      'against a non-local database: prod.invalid/accounter',
    );
    expect(messageFor({ host: '  ', db: 'accounter' }, pgHost)).toContain('comes from PGHOST');
    // An explicit host wins over PGHOST, as it does in pg.
    expect(messageFor(LOCAL, pgHost)).toBe('');
    expect(messageFor({ db: 'accounter' }, { PGHOST: 'localhost' })).toBe('');
    // And no opt-in gets a PGHOST target through either.
    expect(messageFor({}, { ...pgHost, [ALLOW_REMOTE_DB_ENV]: '1' })).toContain(
      'non-local database: prod.invalid',
    );
  });

  it('says there is no override instead of advertising one', () => {
    const message = messageFor(REMOTE);

    expect(message).toContain(
      `${ALLOW_REMOTE_DB_ENV} does not apply here and there is no other override`,
    );
    expect(message).not.toContain(`${ALLOW_REMOTE_DB_ENV}=1`);
  });

  it('points at .env without a command that would print the password', () => {
    const message = messageFor(REMOTE);

    expect(message).toContain("grep -E '^POSTGRES_(HOST|PORT|DB|USER)=' .env");
    expect(message).not.toContain("grep '^POSTGRES' .env");
  });

  it('never leaks a password into the error message', () => {
    const message = messageFor({ ...REMOTE, password: 'super-secret' });

    expect(message).toContain('non-local database');
    expect(message).not.toContain('super-secret');
  });
});

describe('warnIfRemoteDatabase', () => {
  it('stays silent for a local target', () => {
    const logger = { warn: vi.fn() };
    warnIfRemoteDatabase(LOCAL, 'migration:run', {}, logger);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns but does not throw for a non-local target by default', () => {
    const logger = { warn: vi.fn() };
    expect(() => warnIfRemoteDatabase(REMOTE, 'migration:run', {}, logger)).not.toThrow();
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn.mock.calls[0]?.[0]).toContain(
      'accounter2.postgres.database.azure.com',
    );
  });

  it('suggests a way to inspect .env that does not print the password', () => {
    const logger = { warn: vi.fn() };
    warnIfRemoteDatabase(REMOTE, 'migration:run', {}, logger);

    const banner = String(logger.warn.mock.calls[0]?.[0]);
    expect(banner).toContain("grep -E '^POSTGRES_(HOST|PORT|DB|USER)=' .env");
    expect(banner).not.toContain("grep '^POSTGRES' .env");
  });

  it('throws instead of warning when ENFORCE_LOCAL_DB=1', () => {
    const logger = { warn: vi.fn() };
    expect(() =>
      warnIfRemoteDatabase(REMOTE, 'migration:run', { [ENFORCE_LOCAL_DB_ENV]: '1' }, logger),
    ).toThrow(/non-local database/);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('stays silent when opted in, even with enforcement on', () => {
    const logger = { warn: vi.fn() };
    expect(() =>
      warnIfRemoteDatabase(
        REMOTE,
        'migration:run',
        { [ENFORCE_LOCAL_DB_ENV]: '1', [ALLOW_REMOTE_DB_ENV]: '1' },
        logger,
      ),
    ).not.toThrow();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

/**
 * `pg` resolves a blank host as `config.host || process.env.PGHOST || 'localhost'`, so an unset
 * POSTGRES_HOST is only local if PGHOST is unset too. The guard used to call it local
 * regardless, and the seeds pass POSTGRES_HOST straight through to `pg.Client`.
 */
describe('PGHOST fallback', () => {
  const PG_HOST = 'prod.invalid';
  const withPgHost = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
    PGHOST: PG_HOST,
    ...extra,
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['blank', '  '],
    ['only quotes', "''"],
  ])('refuses an %s host when PGHOST is remote', (_label, host) => {
    expect(() => assertLocalDatabase({ host, db: 'accounter' }, 'the seed', withPgHost())).toThrow(
      /Refusing to run the seed against a non-local database: prod\.invalid\/accounter/,
    );
  });

  it('says the host came from PGHOST', () => {
    expect(() => assertLocalDatabase({}, 'the seed', withPgHost())).toThrow(/comes from PGHOST/);
  });

  it('lets an explicit host win over PGHOST, as pg does', () => {
    expect(() => assertLocalDatabase(LOCAL, 'the seed', withPgHost())).not.toThrow();
    expect(() => assertLocalDatabase(REMOTE, 'the seed', { PGHOST: 'localhost' })).toThrow(
      /accounter2\.postgres\.database\.azure\.com/,
    );
  });

  it('passes an absent host when PGHOST is local or blank', () => {
    expect(() => assertLocalDatabase({}, 'the seed', { PGHOST: 'localhost' })).not.toThrow();
    expect(() => assertLocalDatabase({}, 'the seed', { PGHOST: '' })).not.toThrow();
    expect(() => assertLocalDatabase({}, 'the seed', {})).not.toThrow();
  });

  it('still honors ALLOW_REMOTE_DB=1', () => {
    expect(() =>
      assertLocalDatabase({}, 'the seed', withPgHost({ [ALLOW_REMOTE_DB_ENV]: '1' })),
    ).not.toThrow();
  });

  it('applies to warnIfRemoteDatabase too', () => {
    const logger = { warn: vi.fn() };
    warnIfRemoteDatabase({ host: '' }, 'migration:run', withPgHost(), logger);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn.mock.calls[0]?.[0]).toContain(`${PG_HOST} (from PGHOST)`);

    expect(() =>
      warnIfRemoteDatabase(
        { host: '' },
        'migration:run',
        withPgHost({ [ENFORCE_LOCAL_DB_ENV]: '1' }),
        logger,
      ),
    ).toThrow(/comes from PGHOST/);
  });
});

describe('assertOptInsNotInEnvFile', () => {
  it('passes when the file sets no opt-in', () => {
    expect(() => assertOptInsNotInEnvFile(undefined, '.env')).not.toThrow();
    expect(() => assertOptInsNotInEnvFile({}, '.env')).not.toThrow();
    expect(() =>
      assertOptInsNotInEnvFile({ POSTGRES_HOST: 'localhost', ENFORCE_LOCAL_DB: '1' }, '.env'),
    ).not.toThrow();
  });

  it.each(PER_COMMAND_OPT_INS)('refuses %s set in the file', key => {
    expect(() => assertOptInsNotInEnvFile({ [key]: '1' }, '.env')).toThrow(
      new RegExp(`${key} is set in \\.env`),
    );
  });

  it('refuses on presence, whatever the value', () => {
    // A dormant `=0` is one edit away from switching a guard off for every command.
    expect(() => assertOptInsNotInEnvFile({ [ALLOW_REMOTE_DB_ENV]: '0' }, '.env')).toThrow(
      /ALLOW_REMOTE_DB is set/,
    );
  });

  it('shows the database-name opt-in as it is written on a command', () => {
    expect(() =>
      assertOptInsNotInEnvFile({ ALLOW_DEMO_SEED_DATABASE: 'accounter_perf' }, '.env'),
    ).toThrow(
      /ALLOW_DEMO_SEED_DATABASE is set in \.env[\s\S]*ALLOW_DEMO_SEED_DATABASE=<database name> <your command>/,
    );
  });

  it('names every offending key and how to pass it per command', () => {
    expect(() =>
      assertOptInsNotInEnvFile(
        { [ALLOW_REMOTE_DB_ENV]: '1', [ALLOW_DEMO_SEED_ENV]: '1' },
        'the root .env',
      ),
    ).toThrow(
      /ALLOW_REMOTE_DB and ALLOW_DEMO_SEED are set in the root \.env[\s\S]*ALLOW_REMOTE_DB=1 <your command>[\s\S]*ALLOW_DEMO_SEED=1 <your command>/,
    );
  });
});
