import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ALLOW_REMOTE_DB_ENV } from '../../packages/migrations/src/local-db-guard.js';
import {
  DEFAULT_BUSINESS_NAME,
  LOCAL_TENANT_REFUSAL_REASON,
  parseLocalTenantArgs,
  resolveLocalConnection,
  startCommands,
} from '../local-tenant-options.js';

/**
 * `yarn local:tenant` writes a dev-auth owner and a scraper API key, so it must never reach a
 * deployed database. These pin its argument handling and its guard, the latter both as a function
 * and through the script's own entry point.
 *
 * Nothing here can reach a database: remote hosts use the reserved `.invalid` TLD, and the
 * spawned script gets a temp cwd and an env built from scratch.
 */

const REMOTE = 'prod.invalid';

describe('parseLocalTenantArgs', () => {
  it('defaults the business name and leaves the key alone', () => {
    expect(parseLocalTenantArgs([])).toEqual({
      help: false,
      name: DEFAULT_BUSINESS_NAME,
      rotateApiKey: false,
    });
  });

  it('takes --name (trimmed), --rotate-api-key and -h', () => {
    expect(parseLocalTenantArgs(['--name', '  Acme Ltd ', '--rotate-api-key'])).toEqual({
      help: false,
      name: 'Acme Ltd',
      rotateApiKey: true,
    });
    expect(parseLocalTenantArgs(['--name=Acme']).name).toBe('Acme');
    expect(parseLocalTenantArgs(['-h']).help).toBe(true);
  });

  it('refuses an empty name, unknown options and stray arguments', () => {
    expect(() => parseLocalTenantArgs(['--name', '  '])).toThrow('--name cannot be empty');
    expect(() => parseLocalTenantArgs(['--force'])).toThrow(/Unknown option/);
    expect(() => parseLocalTenantArgs(['Acme'])).toThrow('Unexpected argument: Acme');
  });
});

describe('resolveLocalConnection', () => {
  it('defaults to the docker compose database', () => {
    expect(resolveLocalConnection({})).toEqual({
      host: 'localhost',
      port: 5432,
      db: 'accounter',
      user: 'postgres',
      password: 'postgres',
      ssl: false,
    });
  });

  it('takes the target from POSTGRES_* when it is local', () => {
    expect(
      resolveLocalConnection({
        POSTGRES_HOST: '127.0.0.1',
        POSTGRES_PORT: '5440',
        POSTGRES_DB: 'scratch',
        POSTGRES_USER: 'me',
        POSTGRES_PASSWORD: 'secret',
        POSTGRES_SSL: '1',
      }),
    ).toEqual({
      host: '127.0.0.1',
      port: 5440,
      db: 'scratch',
      user: 'me',
      password: 'secret',
      ssl: true,
    });
  });

  it('refuses a non-local host and says why', () => {
    expect(() => resolveLocalConnection({ POSTGRES_HOST: REMOTE })).toThrow(
      `Refusing to run yarn local:tenant against a non-local database: postgres@${REMOTE}:5432/accounter`,
    );
    expect(() => resolveLocalConnection({ POSTGRES_HOST: REMOTE })).toThrow(
      LOCAL_TENANT_REFUSAL_REASON,
    );
  });

  it('has no override: ALLOW_REMOTE_DB=1 does not let a remote host through', () => {
    expect(() =>
      resolveLocalConnection({ POSTGRES_HOST: REMOTE, [ALLOW_REMOTE_DB_ENV]: '1' }),
    ).toThrow(/no other override/);
  });

  it('judges a blank POSTGRES_HOST by PGHOST, and an explicit local host wins over it', () => {
    expect(() => resolveLocalConnection({ POSTGRES_HOST: ' ', PGHOST: REMOTE })).toThrow(
      /non-local database/,
    );
    expect(() => resolveLocalConnection({ PGHOST: REMOTE })).toThrow(/non-local database/);
    expect(resolveLocalConnection({ POSTGRES_HOST: 'localhost', PGHOST: REMOTE }).host).toBe(
      'localhost',
    );
  });

  it('refuses a port that is not a number', () => {
    expect(() => resolveLocalConnection({ POSTGRES_PORT: 'abc' })).toThrow(/POSTGRES_PORT/);
  });
});

describe('startCommands', () => {
  const userId = '00000000-0000-0000-0000-000000000001';

  it('pins the server to the checked database and turns dev auth on for both sides', () => {
    const commands = startCommands(resolveLocalConnection({}), userId);

    expect(commands.server).toContain('POSTGRES_HOST=localhost');
    expect(commands.server).toContain('PGHOST=localhost');
    expect(commands.server).toContain('POSTGRES_SSL=0');
    expect(commands.server).toMatch(/ALLOW_DEV_AUTH=1 yarn workspace @accounter\/server dev$/);
    expect(commands.client).toBe(
      `ALLOW_DEV_AUTH=1 DEV_AUTH_USER_ID=${userId} yarn workspace @accounter/client dev`,
    );
    expect(commands.devAuthHeader).toBe(`X-Dev-Auth: ${userId}`);
  });

  it('prints only the docker compose default password', () => {
    const commands = startCommands(resolveLocalConnection({ POSTGRES_PASSWORD: 'hunter2' }), userId);

    expect(commands.server).not.toContain('hunter2');
    expect(commands.server).toContain('POSTGRES_PASSWORD="$POSTGRES_PASSWORD"');
  });
});

describe('scripts/local-tenant.ts entry point', () => {
  const repoRoot = join(import.meta.dirname, '../..');
  const tempDirs: string[] = [];

  afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  });

  function runScript(args: string[], env: Record<string, string>) {
    const cwd = mkdtempSync(join(tmpdir(), 'accounter-local-tenant-'));
    tempDirs.push(cwd);
    // A .env saying "local" must not matter: the script never takes its target from one.
    writeFileSync(join(cwd, '.env'), 'POSTGRES_HOST=localhost\n', 'utf8');
    const baseEnv: Record<string, string> = {};
    for (const key of ['PATH', 'HOME', 'TMPDIR']) {
      const value = process.env[key];
      if (value !== undefined) baseEnv[key] = value;
    }
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        join(repoRoot, 'scripts/register-esm.js'),
        join(repoRoot, 'scripts/local-tenant.ts'),
        ...args,
      ],
      { cwd, env: { ...baseEnv, ...env }, encoding: 'utf8', timeout: 60_000 },
    );
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  it('refuses a remote host before connecting, whatever opt-in is set', () => {
    const { status, output } = runScript([], {
      POSTGRES_HOST: REMOTE,
      [ALLOW_REMOTE_DB_ENV]: '1',
    });

    expect(status).toBe(1);
    expect(output).toContain('Refusing to run yarn local:tenant against a non-local database');
    // A connection attempt to the .invalid host would fail with a DNS error instead.
    expect(output).not.toMatch(/ENOTFOUND|EAI_AGAIN|getaddrinfo/);
  });

  it('prints usage for --help and rejects unknown arguments, without connecting', () => {
    const help = runScript(['--help'], { POSTGRES_HOST: REMOTE });
    expect(help.status).toBe(0);
    expect(help.output).toContain('Usage: yarn local:tenant');

    const bad = runScript(['--bogus'], {});
    expect(bad.status).toBe(1);
    expect(bad.output).toMatch(/Unknown option '--bogus'/);
  });
});
