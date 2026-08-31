import { describe, expect, it, vi } from 'vitest';
import {
  ALLOW_REMOTE_DB_ENV,
  ENFORCE_LOCAL_DB_ENV,
  assertLocalDatabase,
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
    expect(message).toContain("grep '^POSTGRES' .env");
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
