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
import { ForeignSecuritiesProvider } from '../foreign-securities.provider.js';

let pool: Pool;

// poalim_securities.owner_id is a NOT NULL FK, so the tenants this suite acts as must
// exist in accounter_schema.businesses. Seeded in beforeAll, removed in afterAll.
const TEST_OWNER_ID = '00000000-0000-0000-0000-0000000006ec';
const OTHER_OWNER_ID = '00000000-0000-0000-0000-0000000006ed';

const CHARGE_ID = '00000000-0000-0000-0000-00000000c001';

const ACCOUNT_ID = '00000000-0000-0000-0000-00000000a001';
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
  event_date?: Date;
  debit_date?: Date | null;
  debit_date_override?: Date | null;
  account_id?: string;
};

/**
 * The provider reads only the identity, description, account and date/amount fields off each
 * transaction. Stubbing the loader keeps these cases focused on the DB-dependent behaviour
 * (RLS scoping, the freshest-row pick, execution matching) instead of seeding the
 * financial_accounts → transactions_raw_list → transactions FK chain.
 */
function createStubTransactionsProvider(transactions: StubTransaction[]): TransactionsProvider {
  return {
    transactionsByChargeIDLoader: {
      load: (_chargeId: string) =>
        Promise.resolve(
          transactions.map(transaction => ({
            amount: '-1000.00',
            event_date: new Date('2024-03-10T00:00:00'),
            debit_date: null,
            debit_date_override: null,
            account_id: ACCOUNT_ID,
            ...transaction,
          })),
        ),
    },
  } as unknown as TransactionsProvider;
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
  tradeType?: string;
  netValueTradeCurrency?: string;
};

// Synthetic values only — never lifted from a real bank capture.
async function insertExecution({
  ownerId = TEST_OWNER_ID,
  branchNumber = BRANCH_NUMBER,
  accountNumber = ACCOUNT_NUMBER,
  security,
  tradeDate = '2024-03-10',
  tradeType = 'Buy',
  netValueTradeCurrency = '1000.00',
}: ExecutionFixture) {
  await pool.query(
    `INSERT INTO accounter_schema.poalim_securities_transactions (
       owner_id, bank_number, branch_number, account_number, security, trade_date,
       trade_type, transaction_type, nv, trade_price, net_value_trade_currency, trade_currency
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Trade', 10, 100, $8, 'USD')`,
    [
      ownerId,
      BANK_NUMBER,
      branchNumber,
      accountNumber,
      security,
      tradeDate,
      tradeType,
      netValueTradeCurrency,
    ],
  );
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
    ],
  });
});

afterAll(async () => {
  await dropRlsRole(pool);
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
});

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
    expect(securities[0].executions[0].trade_type).toBe('Buy');
    expect(securities[0].executions[0].net_value_trade_currency).toBe('1000.00');
  });

  it('picks the same-day execution whose amount matches the transaction', async () => {
    await insertSecurity({ securityKey: '5129523' });
    await insertExecution({ security: '5129523', netValueTradeCurrency: '1000.00' });
    await insertExecution({
      security: '5129523',
      netValueTradeCurrency: '2500.50',
      tradeType: 'Sell',
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

  it('excludes an execution far outside the transaction date window', async () => {
    await insertSecurity({ securityKey: '5129523' });
    await insertExecution({ security: '5129523', tradeDate: '2024-01-05' });
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
