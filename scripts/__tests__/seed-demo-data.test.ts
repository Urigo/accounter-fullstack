import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockInstance,
} from 'vitest';

/**
 * Runs the real `scripts/seed-demo-data.ts` against a fake pg client, to hold the wiring in
 * place: the target check comes before any connection, and the only TRUNCATE sits behind the
 * check of what the server says it is connected to.
 *
 * Nothing in this file can reach a database:
 * - `pg` is replaced, so `new pg.Client()` returns a recorder with no socket behind it;
 * - `dotenv` is replaced, so no `.env` on the machine running the suite is read;
 * - the seeding steps are replaced, so nothing else runs SQL;
 * - and should the `pg` mock ever stop applying, remote hosts here use the reserved `.invalid`
 *   TLD and local ones use port 1, so a real driver would have nothing to connect to.
 *
 * `process.exit` is replaced with a recorder. The script only calls it from its final error
 * handler, so recording instead of exiting does not let anything run that would not have.
 */

type FakeClient = {
  host: string;
  port: number;
  database: string | undefined;
  user: string | undefined;
  statements: string[];
  connect: Mock;
  query: Mock;
  end: Mock;
};

const pgState = vi.hoisted(() => ({
  clients: [] as FakeClient[],
  /** What the fake server answers to `current_database()`. `null`: the configured name. */
  serverDatabase: null as string | null,
}));

const steps = vi.hoisted(() => ({
  seedCountries: vi.fn(async () => {}),
  seedExchangeRates: vi.fn(async () => {}),
  seedVATDefault: vi.fn(async () => {}),
  seedAdminCore: vi.fn(),
  seedDemoUsers: vi.fn(async () => ({ adminUserId: 'admin-user', accountantUserId: 'accountant' })),
  insertFixture: vi.fn(async () => {}),
}));

vi.mock('pg', async importOriginal => {
  const actual = await importOriginal<typeof import('pg')>();
  const RealClient = actual.default.Client;

  class Client implements FakeClient {
    host: string;
    port: number;
    database: string | undefined;
    user: string | undefined;
    statements: string[] = [];
    connect = vi.fn(async () => {});
    end = vi.fn(async () => {});
    query = vi.fn(async (sql: string) => {
      this.statements.push(sql);
      return /current_database\(\)/.test(sql)
        ? { rows: [{ database: pgState.serverDatabase ?? this.database }] }
        : { rows: [] };
    });

    constructor(config: ConstructorParameters<typeof RealClient>[0]) {
      // The script reads its target back from the client, so let the real driver resolve it
      // (PGHOST / PGDATABASE fallbacks, defaults). Constructing a client opens no connection;
      // this one is dropped as soon as its four fields are copied.
      const resolved = new RealClient(config);
      this.host = resolved.host;
      this.port = resolved.port;
      this.database = resolved.database;
      this.user = resolved.user;
      pgState.clients.push(this);
    }
  }

  return { ...actual, default: { ...actual.default, Client }, Client };
});

vi.mock('dotenv', () => ({ config: vi.fn(() => ({ parsed: {} })) }));

vi.mock('../../packages/server/scripts/seed-admin-context.js', () => ({
  seedAdminCore: steps.seedAdminCore,
}));
vi.mock('../../packages/server/src/__tests__/helpers/fixture-loader.js', () => ({
  insertFixture: steps.insertFixture,
}));
vi.mock('../../packages/server/src/demo-fixtures/helpers/seed-demo-users.js', () => ({
  seedDemoUsers: steps.seedDemoUsers,
}));
vi.mock('../../packages/server/src/demo-fixtures/helpers/seed-exchange-rates.js', () => ({
  seedExchangeRates: steps.seedExchangeRates,
}));
vi.mock('../../packages/server/src/demo-fixtures/helpers/seed-vat.js', () => ({
  seedVATDefault: steps.seedVATDefault,
}));
vi.mock('../../packages/server/src/demo-fixtures/use-cases/index.js', () => ({
  getAllUseCases: () => [],
}));
vi.mock('../../packages/server/src/modules/countries/helpers/seed-countries.helper.js', () => ({
  seedCountries: steps.seedCountries,
}));

const REMOTE_HOST = 'accounter.postgres.database.azure.invalid';

/** Every variable the script or node-postgres reads, cleared so the shell cannot leak in. */
const CLEARED = [
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_SSL',
  'PGHOST',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
  'ALLOW_DEMO_SEED',
  'ALLOW_DEMO_SEED_DATABASE',
  'ALLOW_REMOTE_DB',
  'ENFORCE_LOCAL_DB',
] as const;

const PRODUCTION = {
  POSTGRES_HOST: REMOTE_HOST,
  POSTGRES_PORT: '5432',
  POSTGRES_DB: 'accounter_prod_db',
  POSTGRES_USER: 'accounter_prod_user',
  POSTGRES_SSL: '1',
};
const STAGING = {
  ...PRODUCTION,
  POSTGRES_DB: 'accounter_staging_db',
  POSTGRES_USER: 'accounter_staging_user',
};
const LOCAL_DEV = {
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '1',
  POSTGRES_DB: 'accounter',
  POSTGRES_USER: 'postgres',
};
const CI = { ...LOCAL_DEV, POSTGRES_HOST: '127.0.0.1', POSTGRES_DB: 'accounter_test' };

let exit: MockInstance;
let errors: MockInstance;
let warnings: MockInstance;

/** Load the script with this environment and wait for its run to finish. */
async function runSeedScript(env: Record<string, string>): Promise<void> {
  for (const name of CLEARED) vi.stubEnv(name, undefined);
  vi.stubEnv('NODE_ENV', 'test');
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);

  vi.resetModules();
  const { demoSeedRun } = await import('../seed-demo-data.js');
  await demoSeedRun;
}

const printed = (spy: MockInstance) =>
  spy.mock.calls.map(call => call.map(String).join(' ')).join('\n');

/** The single client the script created, and what it was asked to do. */
function client(): FakeClient {
  expect(pgState.clients).toHaveLength(1);
  return pgState.clients[0]!;
}

const truncates = () => client().statements.filter(sql => /truncate/i.test(sql));

function expectRefusedBeforeConnecting(): void {
  expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  expect(client().connect).not.toHaveBeenCalled();
  expect(client().statements).toEqual([]);
  expect(steps.seedCountries).not.toHaveBeenCalled();
}

function expectSeeded(): void {
  expect(exit).not.toHaveBeenCalled();
  expect(client().connect).toHaveBeenCalledOnce();
  expect(truncates()).toHaveLength(1);
  expect(steps.seedCountries).toHaveBeenCalledOnce();
  expect(steps.seedAdminCore).toHaveBeenCalledOnce();
  expect(client().end).toHaveBeenCalledOnce();
}

beforeEach(async () => {
  pgState.clients.length = 0;
  pgState.serverDatabase = null;
  vi.clearAllMocks();

  // The script checks that seedAdminCore returns the id it pinned the session to.
  const { makeUUID } =
    await import('../../packages/server/src/demo-fixtures/helpers/deterministic-uuid.js');
  steps.seedAdminCore.mockResolvedValue({ adminEntityId: makeUUID('business', 'Admin Business') });

  exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('scripts/seed-demo-data.ts', () => {
  describe('ALLOW_DEMO_SEED=1 with POSTGRES_* on production', () => {
    it('refuses without opening a connection', async () => {
      await runSeedScript({ ...PRODUCTION, ALLOW_DEMO_SEED: '1' });

      expectRefusedBeforeConnecting();
      expect(printed(errors)).toContain('the database name "accounter_prod_db" says production');
    });

    it('still refuses with every opt-in variable there is', async () => {
      await runSeedScript({
        ...PRODUCTION,
        ALLOW_DEMO_SEED: '1',
        ALLOW_REMOTE_DB: '1',
        ALLOW_DEMO_SEED_DATABASE: 'accounter_prod_db',
      });

      expectRefusedBeforeConnecting();
    });

    it('prints the refusal as a message, not as a crash with a stack trace', async () => {
      await runSeedScript({ ...PRODUCTION, ALLOW_DEMO_SEED: '1' });

      expect(printed(errors)).toMatch(/^❌ Refusing to seed demo data into /);
      expect(printed(errors)).not.toContain('Fatal seed error');
      expect(printed(errors)).not.toContain('Stack:');
    });
  });

  describe('the staging deploy: ALLOW_DEMO_SEED=1 yarn seed:staging-demo', () => {
    it('resets and seeds a remote staging database with no other variable', async () => {
      await runSeedScript({ ...STAGING, ALLOW_DEMO_SEED: '1' });

      expectSeeded();
      // Still announced, so a build log shows which database was reset.
      expect(printed(warnings)).toContain('the demo data seed is targeting a NON-LOCAL database');
    });

    it('checks the connected database after pinning the tenant and before the TRUNCATE', async () => {
      await runSeedScript({ ...STAGING, ALLOW_DEMO_SEED: '1' });

      expect(client().statements.map(sql => sql.replaceAll(/\s+/g, ' ').trim())).toEqual([
        `SELECT set_config('app.current_business_id', $1, false)`,
        'SELECT accounter_schema.get_current_business_id()',
        'SELECT current_database() AS database',
        expect.stringMatching(/^TRUNCATE TABLE accounter_schema\.ledger_records, /),
        expect.stringMatching(/^INSERT INTO accounter_schema\.businesses_admin /),
        'BEGIN',
        'COMMIT',
      ]);
    });

    it('refuses when ENFORCE_LOCAL_DB=1 is set, as documented for developer machines', async () => {
      await runSeedScript({ ...STAGING, ALLOW_DEMO_SEED: '1', ENFORCE_LOCAL_DB: '1' });

      expectRefusedBeforeConnecting();
    });
  });

  describe('local targets', () => {
    it.each([
      ['the dev container', LOCAL_DEV],
      ['the CI service container', CI],
    ])('resets and seeds %s', async (_name, target) => {
      await runSeedScript({ ...target, ALLOW_DEMO_SEED: '1' });

      expectSeeded();
      expect(warnings).not.toHaveBeenCalled();
    });
  });

  describe('a remote database whose name says nothing', () => {
    const UNNAMED = { ...PRODUCTION, POSTGRES_DB: 'accounter', POSTGRES_USER: 'accounter_user' };

    it('is refused without opening a connection', async () => {
      await runSeedScript({ ...UNNAMED, ALLOW_DEMO_SEED: '1' });

      expectRefusedBeforeConnecting();
      expect(printed(errors)).toContain('nothing marks this remote database as a demo');
    });

    it('is not unlocked by ALLOW_REMOTE_DB=1, the switch the older guards print', async () => {
      await runSeedScript({ ...UNNAMED, ALLOW_DEMO_SEED: '1', ALLOW_REMOTE_DB: '1' });

      expectRefusedBeforeConnecting();
    });

    it('is reset once ALLOW_DEMO_SEED_DATABASE names it', async () => {
      await runSeedScript({
        ...UNNAMED,
        ALLOW_DEMO_SEED: '1',
        ALLOW_DEMO_SEED_DATABASE: 'accounter',
      });

      expectSeeded();
    });
  });

  describe('when the server is not the database that was configured', () => {
    it('does not truncate production reached under a staging name', async () => {
      pgState.serverDatabase = 'accounter_prod_db';

      await runSeedScript({ ...STAGING, ALLOW_DEMO_SEED: '1' });

      expect(exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(client().connect).toHaveBeenCalledOnce();
      expect(truncates()).toEqual([]);
      expect(steps.seedCountries).not.toHaveBeenCalled();
      expect(steps.seedAdminCore).not.toHaveBeenCalled();
      expect(client().end).toHaveBeenCalledOnce();
      expect(printed(errors)).toContain(
        'The server reports this connection is on "accounter_prod_db"',
      );
      expect(printed(errors)).not.toContain('Fatal seed error');
    });

    it('does not truncate production reached through a tunnel on localhost', async () => {
      pgState.serverDatabase = 'accounter_prod_db';

      await runSeedScript({ ...LOCAL_DEV, ALLOW_DEMO_SEED: '1' });

      expect(exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(truncates()).toEqual([]);
      expect(steps.seedCountries).not.toHaveBeenCalled();
    });
  });

  describe('the target the driver would really use', () => {
    it('judges PGHOST when POSTGRES_HOST is unset, because node-postgres falls back to it', async () => {
      await runSeedScript({
        POSTGRES_PORT: '5432',
        POSTGRES_DB: 'accounter',
        POSTGRES_USER: 'accounter_user',
        PGHOST: REMOTE_HOST,
        ALLOW_DEMO_SEED: '1',
      });

      expect(client().host).toBe(REMOTE_HOST);
      expectRefusedBeforeConnecting();
    });

    it('judges PGDATABASE when POSTGRES_DB is unset', async () => {
      await runSeedScript({
        POSTGRES_HOST: REMOTE_HOST,
        POSTGRES_USER: 'accounter_user',
        PGDATABASE: 'accounter_prod_db',
        ALLOW_DEMO_SEED: '1',
      });

      expectRefusedBeforeConnecting();
      expect(printed(errors)).toContain('says production');
    });
  });

  describe('the gates that were already there', () => {
    it('does nothing without ALLOW_DEMO_SEED=1, not even build a client', async () => {
      await runSeedScript({ ...LOCAL_DEV });

      expect(exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(pgState.clients).toEqual([]);
      expect(printed(errors)).toBe('❌ ALLOW_DEMO_SEED=1 required to run demo seed');
    });

    it('does nothing with NODE_ENV=production', async () => {
      await runSeedScript({ ...LOCAL_DEV, ALLOW_DEMO_SEED: '1', NODE_ENV: 'production' });

      expect(exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(pgState.clients).toEqual([]);
      expect(printed(errors)).toBe('❌ Refusing to seed demo data in production environment');
    });
  });
});
