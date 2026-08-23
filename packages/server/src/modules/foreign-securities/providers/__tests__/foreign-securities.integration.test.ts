import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import { dropRlsRole, ensureRlsRole, runAsRlsRole } from '../../../../__tests__/helpers/rls-role.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { FinancialAccountsProvider } from '../../../financial-accounts/providers/financial-accounts.provider.js';
import type { FinancialBankAccountsProvider } from '../../../financial-accounts/providers/financial-bank-accounts.provider.js';
import type { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import { dateToTimelessDateString } from '../../../../shared/helpers/misc.js';
import { ForeignSecuritiesProvider, MAX_CHARGE_LINK_SECURITIES } from '../foreign-securities.provider.js';
import { SecurityBusinessesProvider } from '../security-businesses.provider.js';

let pool: Pool;

// poalim_securities.owner_id is a NOT NULL FK, so the tenants this suite acts as must
// exist in accounter_schema.businesses. Seeded in beforeAll, removed in afterAll.
const TEST_OWNER_ID = '00000000-0000-0000-0000-0000000006ec';
const OTHER_OWNER_ID = '00000000-0000-0000-0000-0000000006ed';

const CHARGE_ID = '00000000-0000-0000-0000-00000000c001';

const ACCOUNT_ID = '00000000-0000-0000-0000-00000000a001';

// The synthetic security businesses. Fixed ids so cleanup and assertions are deterministic.
const APPLE_BUSINESS_ID = '00000000-0000-0000-0000-0000000005a1';
const MSFT_BUSINESS_ID = '00000000-0000-0000-0000-0000000005a2';
const ISIN_ONLY_BUSINESS_ID = '00000000-0000-0000-0000-0000000005a3';
/**
 * Filler security businesses, used only to push a tenant past
 * `MAX_CHARGE_LINK_SECURITIES`. Declared here rather than inline so the shared
 * cleanup covers them — a leaked security business is visible to every other case
 * in the file, since this suite connects as a superuser and so is not scoped by RLS.
 */
const OVERFLOW_BUSINESS_IDS = Array.from(
  { length: MAX_CHARGE_LINK_SECURITIES },
  (_unused, index) => `00000000-0000-0000-0000-0000000007${String(index).padStart(2, '0')}`,
);
const SECURITY_BUSINESS_IDS = [
  APPLE_BUSINESS_ID,
  MSFT_BUSINESS_ID,
  ISIN_ONLY_BUSINESS_ID,
  ...OVERFLOW_BUSINESS_IDS,
];
/**
 * ISINs here are synthetic (`ZZ…`) rather than real ones.
 *
 * The securities lookups carry no `owner_id` predicate — RLS does that, and this
 * suite connects as a superuser which bypasses it — so every security business in
 * the database is visible to a lookup by ISIN. Sharing a real ISIN with
 * `security-businesses.integration.test.ts`, which runs concurrently and asserts
 * on the row it gets back for one, is a genuine cross-suite collision.
 */
const BANK_NUMBER = 12;
const BRANCH_NUMBER = 615;
const ACCOUNT_NUMBER = 100000;

function createMockAuthContextProvider(businessId: string): AuthContextProvider {
  return {
    getAuthContext: () =>
      Promise.resolve({
        authType: 'apiKey' as const,
        token: 'test-token',
        tenant: { businessId },
        user: {
          userId: 'api-key:test',
          auth0UserId: null,
          email: '',
          roleId: 'admin',
          permissions: [],
          emailVerified: true,
          permissionsVersion: 0,
        },
      }),
  } as unknown as AuthContextProvider;
}

type StubTransaction = {
  id: string;
  source_description: string | null;
  amount?: string;
  currency?: string;
  debit_date?: Date | null;
  debit_date_override?: Date | null;
  account_id?: string;
};

/** The day the fixtures settle on: execution value date and transaction debit date alike. */
const VALUE_DATE = '2024-03-12';

/**
 * The provider reads only the identity, description, account and date/amount fields off each
 * transaction. Stubbing the loader keeps these cases focused on the DB-dependent behaviour
 * (RLS scoping, the freshest-row pick, execution matching) instead of seeding the
 * financial_accounts → transactions_raw_list → transactions FK chain.
 */
function createStubTransactionsProvider(transactions: StubTransaction[]): TransactionsProvider {
  return {
    transactionsByChargeIDLoader: {
      load: (chargeId: string) => Promise.resolve(transactions.map(row => withDefaults(chargeId, row))),
    },
    // The reverse direction, used by `getSecurityBusinessHistory`: the candidate cash
    // movements are the security business's own transactions.
    getTransactionsByFilters: () =>
      Promise.resolve(transactions.map(row => withDefaults(CHARGE_ID, row))),
  } as unknown as TransactionsProvider;
}

function withDefaults(chargeId: string, transaction: StubTransaction) {
  return {
    charge_id: chargeId,
    amount: '-1000.00',
    currency: 'USD',
    debit_date: new Date(`${VALUE_DATE}T00:00:00`),
    debit_date_override: null,
    account_id: ACCOUNT_ID,
    ...transaction,
  };
}

/**
 * The account lookups are pure id → row maps in the real providers; stubbing them keeps this
 * suite off the financial_accounts fixtures while still exercising the tuple resolution
 * (text account_number → integer) the provider does.
 */
function createStubFinancialAccountsProvider(accountNumber = String(ACCOUNT_NUMBER)) {
  return {
    getFinancialAccountByAccountIDLoader: {
      load: (id: string) =>
        Promise.resolve(id === ACCOUNT_ID ? { id, account_number: accountNumber } : undefined),
    },
  } as unknown as FinancialAccountsProvider;
}

function createStubFinancialBankAccountsProvider() {
  return {
    getFinancialBankAccountByIdLoader: {
      load: (id: string) =>
        Promise.resolve(
          id === ACCOUNT_ID
            ? { id, bank_number: BANK_NUMBER, branch_number: BRANCH_NUMBER }
            : undefined,
        ),
    },
  } as unknown as FinancialBankAccountsProvider;
}

function createProvider(
  transactions: StubTransaction[],
  businessId = TEST_OWNER_ID,
  accountNumber?: string,
) {
  const authContextProvider = createMockAuthContextProvider(businessId);
  const dbClient = new TenantAwareDBClient(new DBProvider(pool), authContextProvider);
  return new ForeignSecuritiesProvider(
    dbClient,
    createStubTransactionsProvider(transactions),
    createStubFinancialAccountsProvider(accountNumber),
    createStubFinancialBankAccountsProvider(),
    // The holdings path reads security businesses and their identifiers, so this one has to be
    // real. Only `db` is exercised: the four remaining constructor deps drive the create path,
    // which these cases seed around by inserting the rows directly.
    new SecurityBusinessesProvider(
      dbClient,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    ),
  );
}

type SecurityFixture = {
  ownerId?: string;
  branchNumber?: number;
  accountNumber?: number;
  securityKey: string;
  engName?: string;
  asOfDate?: string;
};

// Synthetic values only — never lifted from a real bank capture.
async function insertSecurity({
  ownerId = TEST_OWNER_ID,
  branchNumber = 615,
  accountNumber = 100000,
  securityKey,
  engName = 'Example Corp',
  asOfDate = '2024-01-15T10:00:00.000+02:00',
}: SecurityFixture) {
  await pool.query(
    `INSERT INTO accounter_schema.poalim_securities (
       owner_id, bank_number, branch_number, account_number, as_of_date, security_key,
       eng_name, heb_name, item_type, is_etf, is_foreign, currency_code, exchange,
       equity_type, equity_sub_type, eng_symbol, heb_symbol, symbol, stock_type
     ) VALUES ($1, 12, $2, $3, $4, $5, $6, 'אקזמפל', 'Equity', false, true, 'USD', 'NYQ',
               1, 1, 'EXMP', 'EXMP', 'EXMP', 'Equity')`,
    [ownerId, branchNumber, accountNumber, asOfDate, securityKey, engName],
  );
}

type ExecutionFixture = {
  ownerId?: string;
  branchNumber?: number;
  accountNumber?: number;
  security: string;
  tradeDate?: string;
  valueDate?: string | null;
  tradeType?: string;
  /** Defaults to `tradeType`, which is the invariant on a plain buy or sale. */
  transactionType?: string;
  netValueTradeCurrency?: string;
  /** Units moved. Fractional on purpose in the holdings cases — ETFs trade that way. */
  nv?: string;
};

// Synthetic values only — never lifted from a real bank capture.
async function insertExecution({
  ownerId = TEST_OWNER_ID,
  branchNumber = BRANCH_NUMBER,
  accountNumber = ACCOUNT_NUMBER,
  security,
  tradeDate = '2024-03-10',
  valueDate = VALUE_DATE,
  tradeType = 'קניה',
  transactionType,
  netValueTradeCurrency = '1000.00',
  nv = '10',
}: ExecutionFixture) {
  // trade_type/transaction_type carry the bank's own Hebrew vocabulary; on a plain buy or sale
  // the two agree (an invariant the scraper's zod schema enforces).
  await pool.query(
    `INSERT INTO accounter_schema.poalim_securities_transactions (
       owner_id, bank_number, branch_number, account_number, security, trade_date, value_date,
       trade_type, transaction_type, nv, trade_price, net_value_trade_currency, trade_currency
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $11, $10, 100, $9, 'דולר ארה"ב')`,
    [
      ownerId,
      BANK_NUMBER,
      branchNumber,
      accountNumber,
      security,
      tradeDate,
      valueDate,
      tradeType,
      netValueTradeCurrency,
      nv,
      transactionType ?? tradeType,
    ],
  );
}

/**
 * A security business and the Poalim keys it answers to, inserted directly rather than through
 * `SecurityBusinessesProvider.ensureSecurityBusiness` — that path needs an admin context and a
 * general foreign-securities business, neither of which the holdings query reads.
 */
async function insertSecurityBusiness({
  id,
  isin,
  engName = 'Example Corp',
  securityKeys = [],
  ownerId = TEST_OWNER_ID,
}: {
  id: string;
  isin: string;
  engName?: string;
  securityKeys?: string[];
  ownerId?: string;
}) {
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, owner_id, name, type)
     VALUES ($1, $2, $3, 'business')`,
    [id, ownerId, `${engName} (${isin})`],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id) VALUES ($1, $2)`,
    [id, ownerId],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses_securities (id, owner_id, isin, eng_name, symbol)
     VALUES ($1, $2, $3, $4, 'EXMP')`,
    [id, ownerId, isin, engName],
  );
  for (const securityKey of securityKeys) {
    await pool.query(
      `INSERT INTO accounter_schema.security_identifiers
         (owner_id, business_id, identifier_type, identifier_value)
       VALUES ($1, $2, 'POALIM_SECURITY_KEY', $3)`,
      [ownerId, id, securityKey],
    );
  }
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);

  for (const [index, ownerId] of [TEST_OWNER_ID, OTHER_OWNER_ID].entries()) {
    await pool.query(
      `INSERT INTO accounter_schema.financial_entities (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [ownerId, `foreign-securities-test-owner-${index}`],
    );
    await pool.query(
      `INSERT INTO accounter_schema.businesses (id, owner_id)
       VALUES ($1, $1)
       ON CONFLICT (id) DO NOTHING`,
      [ownerId],
    );
  }

  await ensureRlsRole(pool, {
    grants: [
      { table: 'poalim_securities', privileges: 'SELECT' },
      { table: 'poalim_securities_transactions', privileges: 'SELECT' },
      { table: 'businesses_securities', privileges: 'SELECT' },
      { table: 'security_identifiers', privileges: 'SELECT' },
    ],
  });
});

afterAll(async () => {
  await dropRlsRole(pool);
  await deleteSecurityBusinesses();
  // poalim_securities and poalim_securities_transactions rows cascade with the owning business.
  for (const ownerId of [TEST_OWNER_ID, OTHER_OWNER_ID]) {
    await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [ownerId]);
    await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [ownerId]);
  }
  // Do NOT close the pool here — it is shared with other concurrently-running suites and
  // torn down by vitest-global-setup.
});

// DELETE rather than TRUNCATE CASCADE: TRUNCATE takes ACCESS EXCLUSIVE locks that deadlock
// against concurrently-running integration suites.
// Scoped to this suite's owners: the poalim_* tables are shared with the concurrently-running
// scraper-ingestion suite, and an unqualified DELETE wipes its fixtures mid-test.
beforeEach(async () => {
  const owners = [TEST_OWNER_ID, OTHER_OWNER_ID];
  await pool.query('DELETE FROM accounter_schema.poalim_securities WHERE owner_id = ANY($1)', [
    owners,
  ]);
  await pool.query(
    'DELETE FROM accounter_schema.poalim_securities_transactions WHERE owner_id = ANY($1)',
    [owners],
  );
  await deleteSecurityBusinesses();
});

/**
 * The synthetic security businesses, by explicit id so the tenants' own business rows survive
 * between tests. `businesses` first: its FK to `financial_entities` does not cascade, while
 * businesses_securities and security_identifiers do cascade from `businesses`.
 */
async function deleteSecurityBusinesses() {
  await pool.query('DELETE FROM accounter_schema.businesses WHERE id = ANY($1)', [
    SECURITY_BUSINESS_IDS,
  ]);
  await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = ANY($1)', [
    SECURITY_BUSINESS_IDS,
  ]);
}

describe('getChargeSecurities', () => {
  it('resolves a key from a transaction description to its ingested security', async () => {
    await insertSecurity({ securityKey: '5129523', engName: 'Example Corp' });
    const provider = createProvider([
      { id: 't1', source_description: 'ניע"ז מכירה 0005129523' },
    ]);

    const securities = await provider.getChargeSecurities(CHARGE_ID);

    expect(securities).toHaveLength(1);
    expect(securities[0].securityKey).toBe('5129523');
    expect(securities[0].id).toBe(`${CHARGE_ID}-5129523`);
    expect(securities[0].details?.eng_name).toBe('Example Corp');
    expect(securities[0].transactionIds).toEqual(['t1']);
  });

  it('returns an unresolved entry when the key has no ingested row', async () => {
    const provider = createProvider([
      { id: 't1', source_description: 'ניע"ז קניה 0077774297' },
    ]);

    const securities = await provider.getChargeSecurities(CHARGE_ID);

    expect(securities).toHaveLength(1);
    expect(securities[0].securityKey).toBe('77774297');
    expect(securities[0].details).toBeNull();
    expect(securities[0].transactionIds).toEqual(['t1']);
  });

  it('groups every transaction carrying the same key under one entry', async () => {
    await insertSecurity({ securityKey: '5129523' });
    const provider = createProvider([
      { id: 'trade', source_description: 'ניע"ז קניה 0005129523' },
      { id: 'fee', source_description: 'ניע"ז עמ קניה 0005129523' },
    ]);

    const securities = await provider.getChargeSecurities(CHARGE_ID);

    expect(securities).toHaveLength(1);
    expect(securities[0].transactionIds).toEqual(['trade', 'fee']);
  });

  it('returns an empty array when no description carries a key', async () => {
    await insertSecurity({ securityKey: '5129523' });
    const provider = createProvider([
      { id: 't1', source_description: 'ניעז עמ תשלום fsec pymnt fee' },
      { id: 't2', source_description: null },
    ]);

    expect(await provider.getChargeSecurities(CHARGE_ID)).toEqual([]);
  });

  it('returns one entry per distinct key on a merged charge', async () => {
    await insertSecurity({ securityKey: '5129523', engName: 'Example Corp' });
    await insertSecurity({
      securityKey: '77774297',
      engName: 'Other Corp',
      accountNumber: 100001,
    });
    const provider = createProvider([
      { id: 't1', source_description: 'ניע"ז מכירה 0005129523' },
      { id: 't2', source_description: 'ניע"ז קניה 0077774297' },
    ]);

    const securities = await provider.getChargeSecurities(CHARGE_ID);

    expect(securities.map(s => s.securityKey)).toEqual(['5129523', '77774297']);
    expect(securities.map(s => s.details?.eng_name)).toEqual(['Example Corp', 'Other Corp']);
  });

  it('picks the freshest row when one tenant holds the key in several accounts', async () => {
    // The dedup index is (owner_id, bank, branch, account, key), so this is reachable.
    await insertSecurity({
      securityKey: '5129523',
      accountNumber: 100000,
      engName: 'Stale Name',
      asOfDate: '2024-01-15T10:00:00.000+02:00',
    });
    await insertSecurity({
      securityKey: '5129523',
      accountNumber: 100001,
      engName: 'Fresh Name',
      asOfDate: '2024-06-30T10:00:00.000+02:00',
    });
    const provider = createProvider([
      { id: 't1', source_description: 'ניע"ז מכירה 0005129523' },
    ]);

    const securities = await provider.getChargeSecurities(CHARGE_ID);

    expect(securities).toHaveLength(1);
    expect(securities[0].details?.eng_name).toBe('Fresh Name');
  });

  /**
   * The provider's query carries no owner_id predicate — RLS is what scopes it. The test
   * pool connects as postgres (BYPASSRLS), so asserting that through the provider would
   * prove nothing; this runs the same query shape under a non-superuser role, which is
   * the boundary the server actually operates behind.
   */
  it("does not expose another tenant's securities under the tenant_isolation policy", async () => {
    await insertSecurity({ ownerId: OTHER_OWNER_ID, securityKey: '5129523' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Session variables must be set as superuser, before privileges are dropped.
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [TEST_OWNER_ID]);

      const rows = await runAsRlsRole(client, async () => {
        const result = await client.query(
          `SELECT security_key FROM accounter_schema.poalim_securities
           WHERE security_key = ANY($1)`,
          [['5129523']],
        );
        return result.rows;
      });

      expect(rows).toEqual([]);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

describe('getChargeSecurities — matched executions', () => {
  it('attaches the execution behind the charge transaction', async () => {
    await insertSecurity({ securityKey: '5129523' });
    await insertExecution({ security: '5129523', netValueTradeCurrency: '1000.00' });
    const provider = createProvider([
      { id: 't1', source_description: 'ניע"ז קניה 0005129523', amount: '-1000.00' },
    ]);

    const securities = await provider.getChargeSecurities(CHARGE_ID);

    expect(securities[0].executions).toHaveLength(1);
    expect(securities[0].executions[0].trade_type).toBe('קניה');
    expect(securities[0].executions[0].net_value_trade_currency).toBe('1000.00');
  });

  it('picks the same-day execution whose amount matches the transaction', async () => {
    await insertSecurity({ securityKey: '5129523' });
    await insertExecution({ security: '5129523', netValueTradeCurrency: '1000.00' });
    await insertExecution({
      security: '5129523',
      netValueTradeCurrency: '2500.50',
      tradeType: 'מכירה',
    });
    const provider = createProvider([
      { id: 't1', source_description: 'ניע"ז מכירה 0005129523', amount: '2500.50' },
    ]);

    const securities = await provider.getChargeSecurities(CHARGE_ID);

    expect(securities[0].executions.map(e => e.net_value_trade_currency)).toEqual(['2500.50']);
  });

  it('excludes an execution booked in another account', async () => {
    await insertSecurity({ securityKey: '5129523' });
    await insertExecution({ security: '5129523', accountNumber: 100001 });
    const provider = createProvider([
      { id: 't1', source_description: 'ניע"ז קניה 0005129523', amount: '-1000.00' },
    ]);

    const securities = await provider.getChargeSecurities(CHARGE_ID);

    expect(securities[0].executions).toEqual([]);
  });

  it('excludes an execution whose amount does not match', async () => {
    await insertSecurity({ securityKey: '5129523' });
    await insertExecution({ security: '5129523', netValueTradeCurrency: '4321.00' });
    const provider = createProvider([
      { id: 't1', source_description: 'ניע"ז קניה 0005129523', amount: '-1000.00' },
    ]);

    const securities = await provider.getChargeSecurities(CHARGE_ID);

    expect(securities[0].executions).toEqual([]);
  });

  it('excludes an execution that settles on another day', async () => {
    await insertSecurity({ securityKey: '5129523' });
    await insertExecution({ security: '5129523', valueDate: '2024-01-05' });
    const provider = createProvider([
      { id: 't1', source_description: 'ניע"ז קניה 0005129523', amount: '-1000.00' },
    ]);

    const securities = await provider.getChargeSecurities(CHARGE_ID);

    expect(securities[0].executions).toEqual([]);
  });

  it('returns no executions when the account number is not a Poalim integer', async () => {
    await insertSecurity({ securityKey: '5129523' });
    await insertExecution({ security: '5129523' });
    const provider = createProvider(
      [{ id: 't1', source_description: 'ניע"ז קניה 0005129523', amount: '-1000.00' }],
      TEST_OWNER_ID,
      'IL12-3456',
    );

    const securities = await provider.getChargeSecurities(CHARGE_ID);

    expect(securities[0].executions).toEqual([]);
  });

  it("does not expose another tenant's executions under the tenant_isolation policy", async () => {
    await insertExecution({ ownerId: OTHER_OWNER_ID, security: '5129523' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [TEST_OWNER_ID]);

      const rows = await runAsRlsRole(client, async () => {
        const result = await client.query(
          `SELECT security FROM accounter_schema.poalim_securities_transactions
           WHERE security = ANY($1)`,
          [['5129523']],
        );
        return result.rows;
      });

      expect(rows).toEqual([]);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

/** This suite's own buckets out of a tenant-wide result. See the note on ISINs above. */
function ownedBuckets<T>(byBusinessId: Map<string, T[]>): T[][] {
  return SECURITY_BUSINESS_IDS.map(id => byBusinessId.get(id)).filter(
    (bucket): bucket is T[] => bucket !== undefined,
  );
}

describe('getExecutionsBySecurityBusiness', () => {
  it('gives every security business its own executions, chronologically', async () => {
    await insertSecurityBusiness({
      id: APPLE_BUSINESS_ID,
      isin: 'ZZ0000000601',
      engName: 'APPLE INC',
      securityKeys: ['1097'],
    });
    await insertSecurityBusiness({
      id: MSFT_BUSINESS_ID,
      isin: 'ZZ0000000602',
      engName: 'MICROSOFT CORP',
      securityKeys: ['2044'],
    });
    await insertExecution({ security: '1097', tradeDate: '2024-03-10' });
    await insertExecution({ security: '1097', tradeDate: '2024-01-05' });
    await insertExecution({ security: '2044', tradeDate: '2024-02-02' });

    const executionsByBusinessId = await createProvider([]).getExecutionsBySecurityBusiness();

    expect(executionsByBusinessId.get(APPLE_BUSINESS_ID)).toHaveLength(2);
    // The SQL orders globally by trade_date, so each business's slice stays chronological —
    // which is what the position derivation reads its currency and start date off.
    expect(
      executionsByBusinessId.get(APPLE_BUSINESS_ID)?.map(execution => execution.trade_date),
    ).toEqual([new Date('2024-01-05T00:00:00'), new Date('2024-03-10T00:00:00')]);
    expect(executionsByBusinessId.get(MSFT_BUSINESS_ID)).toHaveLength(1);
  });

  it('collapses several Poalim keys onto the one security business they name', async () => {
    await insertSecurityBusiness({
      id: APPLE_BUSINESS_ID,
      isin: 'ZZ0000000601',
      securityKeys: ['1097', '1098'],
    });
    await insertExecution({ security: '1097' });
    await insertExecution({ security: '1098' });

    const executionsByBusinessId = await createProvider([]).getExecutionsBySecurityBusiness();

    expect(executionsByBusinessId.get(APPLE_BUSINESS_ID)).toHaveLength(2);
  });

  it('keeps a security business with no Poalim key, with nothing against it', async () => {
    // Its ISIN was ingested but no execution ever named it by key. It is still a security the
    // tenant has, so it has to stay listable — a zero position, not a missing row.
    await insertSecurityBusiness({
      id: ISIN_ONLY_BUSINESS_ID,
      isin: 'IL0010811243',
      securityKeys: [],
    });

    const executionsByBusinessId = await createProvider([]).getExecutionsBySecurityBusiness();

    expect(executionsByBusinessId.has(ISIN_ONLY_BUSINESS_ID)).toBe(true);
    expect(executionsByBusinessId.get(ISIN_ONLY_BUSINESS_ID)).toEqual([]);
  });

  it('ignores executions whose key belongs to no security business', async () => {
    await insertSecurityBusiness({
      id: APPLE_BUSINESS_ID,
      isin: 'ZZ0000000601',
      securityKeys: ['1097'],
    });
    await insertExecution({ security: '1097' });
    await insertExecution({ security: '9999' });

    const executionsByBusinessId = await createProvider([]).getExecutionsBySecurityBusiness();

    // Asserted on this suite's own buckets rather than on the map's size: the
    // query carries no owner predicate — RLS is what scopes it in production, and
    // this suite connects as a superuser which bypasses it — so a concurrently
    // running suite's security businesses are legitimately in the result.
    expect(executionsByBusinessId.get(APPLE_BUSINESS_ID)).toHaveLength(1);
    // '9999' belongs to no security business, so it is nowhere in the map.
    expect(ownedBuckets(executionsByBusinessId).flat()).toHaveLength(1);
  });

  it('gives a security business with nothing ingested an empty bucket, not none', async () => {
    await insertSecurityBusiness({ id: APPLE_BUSINESS_ID, isin: 'ZZ0000000601' });
    await insertExecution({ security: '1097' });

    const executionsByBusinessId = await createProvider([]).getExecutionsBySecurityBusiness();

    // Apple carries no POALIM_SECURITY_KEY identifier, so the execution cannot
    // resolve to it — but the business still gets an entry, which is what keeps
    // "nothing ingested" distinguishable from "not a security".
    expect(executionsByBusinessId.has(APPLE_BUSINESS_ID)).toBe(true);
    expect(executionsByBusinessId.get(APPLE_BUSINESS_ID)).toEqual([]);
  });

  /**
   * As with the poalim_* tables above, a provider-level assertion proves nothing here: the
   * suite connects as a superuser, who bypasses RLS. This runs the query shape the holdings
   * path depends on under the non-superuser role the server actually operates behind.
   */
  it("does not expose another tenant's security businesses under tenant_isolation", async () => {
    await insertSecurityBusiness({
      id: APPLE_BUSINESS_ID,
      isin: 'ZZ0000000601',
      securityKeys: ['1097'],
      ownerId: OTHER_OWNER_ID,
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Session variables must be set as superuser, before privileges are dropped.
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [TEST_OWNER_ID]);

      const rows = await runAsRlsRole(client, async () => {
        const result = await client.query(
          `SELECT bs.isin, si.identifier_value
           FROM accounter_schema.businesses_securities bs
           LEFT JOIN accounter_schema.security_identifiers si ON si.business_id = bs.id`,
        );
        return result.rows;
      });

      expect(rows).toEqual([]);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

/**
 * `Query.securityExecutions` behind the provider: the SQL-pushdown path, the
 * unpaginated match path behind `includeCharges`, and the filter resolution both
 * share.
 */
describe('getSecurityExecutionsPage', () => {
  const APPLE_ISIN = 'ZZ0000000601';
  const MSFT_ISIN = 'ZZ0000000602';

  /**
   * Every case narrows to this suite's own two securities by default.
   *
   * Omitting the identity filter means "every security this tenant has", and the
   * suite connects as a superuser — so RLS does not scope the read and a
   * concurrently-running suite's fixtures would land in the result. Only the one
   * case that is actually about the unfiltered behaviour leaves this out, and it
   * asserts containment rather than an exact count.
   */
  const page = (
    overrides: Partial<Parameters<ForeignSecuritiesProvider['getSecurityExecutionsPage']>[0]> = {},
  ) =>
    createProvider([]).getSecurityExecutionsPage({
      page: 0,
      limit: 50,
      includeCharges: false,
      ownerId: TEST_OWNER_ID,
      ...overrides,
      filters: { isins: [APPLE_ISIN, MSFT_ISIN], ...overrides.filters },
    });

  beforeEach(async () => {
    await insertSecurityBusiness({
      id: APPLE_BUSINESS_ID,
      isin: APPLE_ISIN,
      engName: 'Apple',
      securityKeys: ['1097'],
    });
    await insertSecurityBusiness({
      id: MSFT_BUSINESS_ID,
      isin: MSFT_ISIN,
      engName: 'Microsoft',
      securityKeys: ['2098'],
    });
  });

  it('is empty, without erroring, when the tenant has no matching security', async () => {
    const result = await createProvider([]).getSecurityExecutionsPage({
      filters: { isins: ['ZZ0000000699'] },
      page: 0,
      limit: 50,
      includeCharges: false,
      ownerId: TEST_OWNER_ID,
    });

    expect(result.nodes).toEqual([]);
    expect(result.totalRecords).toBe(0);
  });

  it('covers every security when no identity filter is given', async () => {
    await insertExecution({ security: '1097' });
    await insertExecution({ security: '2098' });

    const result = await createProvider([]).getSecurityExecutionsPage({
      filters: {},
      page: 0,
      limit: 500,
      includeCharges: false,
      ownerId: TEST_OWNER_ID,
    });

    // Containment, not equality: with no identity filter and no RLS under a
    // superuser connection, a concurrent suite's fixtures can be in here too.
    const businessIds = new Set(result.nodes.map(node => node.securityBusinessId));
    expect(businessIds).toContain(APPLE_BUSINESS_ID);
    expect(businessIds).toContain(MSFT_BUSINESS_ID);
  });

  it('orders newest first — the opposite of the history query', async () => {
    await insertExecution({ security: '1097', tradeDate: '2024-01-01' });
    await insertExecution({ security: '1097', tradeDate: '2024-06-01' });
    await insertExecution({ security: '1097', tradeDate: '2024-03-01' });

    const result = await page();

    expect(result.nodes.map(node => dateToTimelessDateString(node.execution.trade_date))).toEqual([
      '2024-06-01',
      '2024-03-01',
      '2024-01-01',
    ]);
  });

  it('reports the full match count alongside a page of it', async () => {
    for (const day of ['01', '02', '03', '04', '05']) {
      await insertExecution({ security: '1097', tradeDate: `2024-03-${day}` });
    }

    const first = await page({ limit: 2, page: 0 });
    const second = await page({ limit: 2, page: 1 });

    expect(first.totalRecords).toBe(5);
    expect(first.nodes).toHaveLength(2);
    expect(second.totalRecords).toBe(5);
    // Consecutive pages must not overlap or skip.
    expect(second.nodes.map(node => node.id)).not.toEqual(first.nodes.map(node => node.id));
  });

  /**
   * The three identity filters name the same axis three ways, so they union.
   * Intersecting them would make "this ISIN and that symbol" mean the empty
   * overlap, which is never what a caller means.
   */
  it('unions the identity filters rather than intersecting them', async () => {
    await insertExecution({ security: '1097' });
    await insertExecution({ security: '2098' });

    const result = await createProvider([]).getSecurityExecutionsPage({
      filters: { isins: [APPLE_ISIN], securityBusinessIds: [MSFT_BUSINESS_ID] },
      page: 0,
      limit: 50,
      includeCharges: false,
      ownerId: TEST_OWNER_ID,
    });

    expect(result.totalRecords).toBe(2);
  });

  it('matches symbols case-insensitively', async () => {
    await insertExecution({ security: '1097' });

    const businessesFor = async (symbol: string) => {
      const result = await createProvider([]).getSecurityExecutionsPage({
        filters: { symbols: [symbol] },
        page: 0,
        limit: 500,
        includeCharges: false,
        ownerId: TEST_OWNER_ID,
      });
      return new Set(result.nodes.map(node => node.securityBusinessId));
    };

    // insertSecurityBusiness writes the symbol as 'EXMP', so the lowercase spelling
    // has to reach it. Asserted by which security came back rather than by a count:
    // with no ISIN filter and no RLS under a superuser connection, a concurrent
    // suite's fixtures can share the result.
    expect(await businessesFor('exmp')).toContain(APPLE_BUSINESS_ID);
    expect(await businessesFor('nope')).not.toContain(APPLE_BUSINESS_ID);
  });

  it('ignores an id that is not one of this tenant security businesses', async () => {
    await insertExecution({ security: '1097' });

    const result = await createProvider([]).getSecurityExecutionsPage({
      filters: { securityBusinessIds: [OTHER_OWNER_ID] },
      page: 0,
      limit: 50,
      includeCharges: false,
      ownerId: TEST_OWNER_ID,
    });

    expect(result.totalRecords).toBe(0);
  });

  it('pushes the trade-date range into SQL', async () => {
    await insertExecution({ security: '1097', tradeDate: '2024-01-15' });
    await insertExecution({ security: '1097', tradeDate: '2024-05-15' });

    const bounded = await page({
      filters: { fromTradeDate: '2024-04-01', toTradeDate: '2024-06-30' },
    });

    expect(bounded.totalRecords).toBe(1);
    expect(dateToTimelessDateString(bounded.nodes[0]!.execution.trade_date)).toBe('2024-05-15');
  });

  it('filters on the bank own labels for trade and transaction type', async () => {
    await insertExecution({ security: '1097', tradeType: 'קניה' });
    await insertExecution({ security: '1097', tradeType: 'מכירה' });

    expect((await page({ filters: { rawTradeTypes: ['מכירה'] } })).totalRecords).toBe(1);
    expect((await page({ filters: { rawTransactionTypes: ['קניה'] } })).totalRecords).toBe(1);
    // An empty list is "no restriction", not "match nothing" — the `is*` flag guard.
    expect((await page({ filters: { rawTradeTypes: [] } })).totalRecords).toBe(2);
    expect((await page()).totalRecords).toBe(2);
  });

  it('carries the security business on every row, so a flat list can be grouped', async () => {
    await insertExecution({ security: '2098' });

    const result = await page();

    expect(result.nodes[0]!.securityBusinessId).toBe(MSFT_BUSINESS_ID);
    // Not asked for, so no pairing was attempted.
    expect(result.nodes[0]!.transaction).toBeNull();
  });

  it('refuses to pair charge links across more securities than it can', async () => {
    // Two are seeded already; take the tenant past the cap so an unnarrowed
    // request has to be refused.
    for (const [index, id] of OVERFLOW_BUSINESS_IDS.entries()) {
      await insertSecurityBusiness({
        id,
        isin: `ZZ9${String(index).padStart(9, '0')}`,
        securityKeys: [`90${index}`],
      });
    }
    await insertExecution({ security: '1097' });

    await expect(
      createProvider([]).getSecurityExecutionsPage({
        filters: {},
        page: 0,
        limit: 50,
        includeCharges: true,
        ownerId: TEST_OWNER_ID,
      }),
    ).rejects.toThrow(/more than the \d+ it can pair at once/);
  });

  it('pairs charge links when the filter names few enough securities', async () => {
    await insertExecution({ security: '1097' });

    const result = await createProvider([]).getSecurityExecutionsPage({
      filters: { isins: [APPLE_ISIN] },
      page: 0,
      limit: 50,
      includeCharges: true,
      ownerId: TEST_OWNER_ID,
    });

    expect(result.totalRecords).toBe(1);
    expect(result.nodes[0]!.securityBusinessId).toBe(APPLE_BUSINESS_ID);
  });

  /**
   * The two paths must agree about what page 1 is, or paging with and without
   * charge links would return different rows for the same request.
   */
  it('orders the match path identically to the SQL path', async () => {
    await insertExecution({ security: '1097', tradeDate: '2024-01-01' });
    await insertExecution({ security: '1097', tradeDate: '2024-06-01' });
    await insertExecution({ security: '1097', tradeDate: '2024-03-01' });

    const pushdown = await page({ filters: { isins: [APPLE_ISIN] } });
    const matched = await createProvider([]).getSecurityExecutionsPage({
      filters: { isins: [APPLE_ISIN] },
      page: 0,
      limit: 50,
      includeCharges: true,
      ownerId: TEST_OWNER_ID,
    });

    expect(matched.nodes.map(node => node.id)).toEqual(pushdown.nodes.map(node => node.id));
  });

  it('applies the date and type filters on the match path too', async () => {
    await insertExecution({ security: '1097', tradeDate: '2024-01-15', tradeType: 'קניה' });
    await insertExecution({ security: '1097', tradeDate: '2024-05-15', tradeType: 'מכירה' });

    const result = await createProvider([]).getSecurityExecutionsPage({
      filters: {
        isins: [APPLE_ISIN],
        fromTradeDate: '2024-04-01',
        rawTradeTypes: ['מכירה'],
      },
      page: 0,
      limit: 50,
      includeCharges: true,
      ownerId: TEST_OWNER_ID,
    });

    expect(result.totalRecords).toBe(1);
    expect(result.nodes[0]!.execution.trade_type).toBe('מכירה');
  });

  /**
   * Tenant isolation is deliberately NOT asserted here: this suite connects as a
   * superuser, who bypasses RLS, so a green provider-level assertion would prove
   * nothing. The `multi-business read scope` cases below run the same tables under
   * the non-superuser role the server actually operates behind.
   */
});

/**
 * The read predicate on all four securities tables was pinned to the singular
 * `get_current_business_id()` until this was fixed, so a request whose authorized
 * scope spanned several businesses silently saw only one of them. A
 * provider-level assertion proves nothing — this suite connects as a superuser,
 * who bypasses RLS — so this runs under the non-superuser role the server
 * actually operates behind.
 */
describe('multi-business read scope', () => {
  async function readUnderScope(
    table: string,
    scope: string[] | null,
    currentBusinessId = TEST_OWNER_ID,
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Session variables must be set as superuser, before privileges are dropped.
      await client.query(`SELECT set_config('app.current_business_id', $1, true)`, [
        currentBusinessId,
      ]);
      await client.query(`SELECT set_config('app.current_business_scope', $1, true)`, [
        scope ? `{${scope.join(',')}}` : '',
      ]);

      return await runAsRlsRole(client, async () => {
        const result = await client.query(
          `SELECT owner_id FROM accounter_schema.${table} ORDER BY owner_id`,
        );
        return result.rows.map((row: { owner_id: string }) => row.owner_id);
      });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  beforeEach(async () => {
    await insertSecurityBusiness({
      id: APPLE_BUSINESS_ID,
      isin: 'ZZ0000000611',
      securityKeys: ['1097'],
    });
    await insertSecurityBusiness({
      id: MSFT_BUSINESS_ID,
      isin: 'ZZ0000000612',
      securityKeys: ['2098'],
      ownerId: OTHER_OWNER_ID,
    });
    await insertSecurity({ securityKey: '1097' });
    await insertSecurity({ ownerId: OTHER_OWNER_ID, securityKey: '2098' });
    await insertExecution({ security: '1097' });
    await insertExecution({ ownerId: OTHER_OWNER_ID, security: '2098' });
  });

  const TABLES = [
    'poalim_securities',
    'poalim_securities_transactions',
    'businesses_securities',
    'security_identifiers',
  ];

  it.each(TABLES)('%s returns every business in the scope', async table => {
    const owners = await readUnderScope(table, [TEST_OWNER_ID, OTHER_OWNER_ID]);

    expect(new Set(owners)).toEqual(new Set([TEST_OWNER_ID, OTHER_OWNER_ID]));
  });

  it.each(TABLES)('%s narrows to a single-business scope', async table => {
    const owners = await readUnderScope(table, [TEST_OWNER_ID]);

    expect(new Set(owners)).toEqual(new Set([TEST_OWNER_ID]));
  });

  /**
   * `get_current_business_scope()` falls back to `ARRAY[get_current_business_id()]`
   * when the GUC is unset, so a caller that never sets a scope behaves exactly as
   * it did before the predicate was widened.
   */
  it.each(TABLES)('%s falls back to the single business when no scope is set', async table => {
    const owners = await readUnderScope(table, null);

    expect(new Set(owners)).toEqual(new Set([TEST_OWNER_ID]));
  });
});
