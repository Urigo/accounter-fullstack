import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `environment.ts` reads `process.env` at import time, so each case needs a
 * fresh module registry. dotenv does not override variables already present in
 * `process.env`, so the values set here win over any local `.env`.
 */
async function loadEnv(overrides: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
  const { env } = await import('./environment.js');
  return env;
}

const REQUIRED = {
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_DB: 'test',
  POSTGRES_USER: 'test',
  POSTGRES_PASSWORD: 'test',
  CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(64),
};

const MANAGED_KEYS = [
  'POSTGRES_WATCHDOG_INTERVAL_MS',
  'POSTGRES_CLIENT_MAX_IDLE_MS',
  'POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS',
  'POSTGRES_ABORTED_CLIENT_MAX_IDLE_MS',
  'POSTGRES_STATEMENT_TIMEOUT_MS',
  'POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS',
  'POSTGRES_MONITOR_INTERVAL_MS',
  'POSTGRES_CONNECTION_TIMEOUT_MS',
];

describe('postgres pool configuration', () => {
  let original: Record<string, string | undefined>;

  beforeEach(() => {
    original = Object.fromEntries(
      [...MANAGED_KEYS, ...Object.keys(REQUIRED)].map(key => [key, process.env[key]]),
    );
    for (const key of MANAGED_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.resetModules();
  });

  it('derives the watchdog interval when not configured', async () => {
    const env = await loadEnv(REQUIRED);

    expect(env.postgres.clientMaxIdleMs).toBe(240_000);
    expect(env.postgres.activeClientMaxIdleMs).toBe(240_000);
    expect(env.postgres.watchdogIntervalMs).toBe(30_000);
  });

  it('honours an explicit watchdog interval', async () => {
    const env = await loadEnv({ ...REQUIRED, POSTGRES_WATCHDOG_INTERVAL_MS: '5000' });

    expect(env.postgres.watchdogIntervalMs).toBe(5000);
  });

  it('keeps the derived sweep interval in step with a tightened idle ceiling', async () => {
    const env = await loadEnv({ ...REQUIRED, POSTGRES_CLIENT_MAX_IDLE_MS: '9000' });

    // Sweeping every 30s would let a leak sit for far longer than the ceiling.
    expect(env.postgres.watchdogIntervalMs).toBe(9000);
  });

  it('keeps the aborted ceiling above the statement timeout', async () => {
    // A long query bumps activity only at its start and end, so a ceiling under
    // the statement timeout would reclaim the connection mid-query. A setting
    // below the floor is raised rather than honoured.
    const env = await loadEnv({
      ...REQUIRED,
      POSTGRES_STATEMENT_TIMEOUT_MS: '300000',
      POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS: '900000',
      POSTGRES_ABORTED_CLIENT_MAX_IDLE_MS: '60000',
    });

    expect(env.postgres.abortedClientMaxIdleMs).toBe(330_000);
  });

  it('honours an aborted ceiling that already clears the floor', async () => {
    const env = await loadEnv({
      ...REQUIRED,
      POSTGRES_STATEMENT_TIMEOUT_MS: '120000',
      POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS: '900000',
      POSTGRES_ABORTED_CLIENT_MAX_IDLE_MS: '400000',
    });

    expect(env.postgres.abortedClientMaxIdleMs).toBe(400_000);
  });

  it('never lets the active ceiling fall below the ordinary one', async () => {
    const env = await loadEnv({
      ...REQUIRED,
      POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS: '900000',
      POSTGRES_CLIENT_MAX_IDLE_MS: '600000',
      POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS: '60000',
    });

    expect(env.postgres.activeClientMaxIdleMs).toBe(600_000);
  });

  it('keeps the active ceiling above the statement timeout', async () => {
    // An executing request may be mid-query when the watchdog sweeps, and a
    // query bumps activity only at its start and end.
    const env = await loadEnv({
      ...REQUIRED,
      POSTGRES_STATEMENT_TIMEOUT_MS: '300000',
      POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS: '900000',
    });

    expect(env.postgres.clientMaxIdleMs).toBe(240_000);
    expect(env.postgres.activeClientMaxIdleMs).toBe(330_000);
  });

  it('accepts 0 for the monitor interval, which disables the heartbeat', async () => {
    const env = await loadEnv({ ...REQUIRED, POSTGRES_MONITOR_INTERVAL_MS: '0' });

    expect(env.postgres.monitorIntervalMs).toBe(0);
  });

  it('rejects 0 for the connection timeout, keeping "wait forever" unreachable', async () => {
    // pg treats 0 as "queue indefinitely" — the behaviour that turns an
    // exhausted pool into a silent, permanent wedge.
    await expect(
      loadEnv({ ...REQUIRED, POSTGRES_CONNECTION_TIMEOUT_MS: '0' }),
    ).rejects.toBeDefined();
  });

  it('refuses to start when a watchdog ceiling would lose the race to Postgres', async () => {
    // The old 15-minute in-flight default: Postgres kills the session at 5
    // minutes, so the watchdog — and its log line — could never fire first.
    await expect(
      loadEnv({ ...REQUIRED, POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS: '900000' }),
    ).rejects.toBeDefined();
  });

  it('starts when a raised idle-in-transaction timeout clears every ceiling', async () => {
    const env = await loadEnv({
      ...REQUIRED,
      POSTGRES_IDLE_IN_TRANSACTION_TIMEOUT_MS: '1000000',
      POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS: '900000',
    });

    expect(env.postgres.activeClientMaxIdleMs).toBe(900_000);
  });
});

describe('watchdogCeilingProblems', () => {
  const DEFAULTS = {
    idleInTransactionTimeoutMs: 300_000,
    clientMaxIdleMs: 240_000,
    activeClientMaxIdleMs: 240_000,
    abortedClientMaxIdleMs: 150_000,
    watchdogIntervalMs: 30_000,
  };

  /** The module validates on import, so it needs a valid environment to load at all. */
  async function load() {
    const original = Object.fromEntries(Object.keys(REQUIRED).map(key => [key, process.env[key]]));
    try {
      await loadEnv(REQUIRED);
      const { watchdogCeilingProblems } = await import('./environment.js');
      return watchdogCeilingProblems;
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  }

  it('accepts the defaults', async () => {
    const watchdogCeilingProblems = await load();

    expect(watchdogCeilingProblems(DEFAULTS)).toEqual([]);
  });

  it.each([
    ['clientMaxIdleMs', 'POSTGRES_CLIENT_MAX_IDLE_MS'],
    ['activeClientMaxIdleMs', 'POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS'],
    ['abortedClientMaxIdleMs', 'POSTGRES_ABORTED_CLIENT_MAX_IDLE_MS'],
  ] as const)('flags %s at or above the idle-in-transaction timeout', async (key, variable) => {
    const watchdogCeilingProblems = await load();

    const problems = watchdogCeilingProblems({ ...DEFAULTS, [key]: 300_000 });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(variable);
  });

  it('flags a ceiling inside the two-sweep margin', async () => {
    const watchdogCeilingProblems = await load();

    // Below the timeout, but a sweep could land after Postgres already acted.
    expect(watchdogCeilingProblems({ ...DEFAULTS, clientMaxIdleMs: 240_001 })).toHaveLength(1);
  });
});

describe('server log level', () => {
  const KEYS = ['SERVER_LOG_LEVEL', 'DEBUG', ...Object.keys(REQUIRED)];
  let original: Record<string, string | undefined>;

  beforeEach(() => {
    original = Object.fromEntries(KEYS.map(key => [key, process.env[key]]));
    delete process.env['SERVER_LOG_LEVEL'];
    delete process.env['DEBUG'];
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.resetModules();
  });

  it.each([
    ['unset', {}],
    ['empty', { SERVER_LOG_LEVEL: '' }],
  ])('defaults to info when %s', async (_, overrides) => {
    const env = await loadEnv({ ...REQUIRED, ...overrides });
    expect(env.logging.level).toBe('info');
  });

  it('does not follow DEBUG', async () => {
    const env = await loadEnv({ ...REQUIRED, DEBUG: '1' });
    expect(env.logging.level).toBe('info');
  });

  it('accepts an explicit level', async () => {
    const env = await loadEnv({ ...REQUIRED, SERVER_LOG_LEVEL: 'debug' });
    expect(env.logging.level).toBe('debug');
  });

  it('rejects an unknown level at startup', async () => {
    await expect(loadEnv({ ...REQUIRED, SERVER_LOG_LEVEL: 'verbose' })).rejects.toBeDefined();
  });
});
