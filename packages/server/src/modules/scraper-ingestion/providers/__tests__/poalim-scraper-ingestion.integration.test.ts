import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb, closeTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import type {
  IsracardTransactionInput,
  PoalimForeignTransactionInput,
  PoalimIlsTransactionInput,
  PoalimSecurityInput,
  PoalimSecurityTransactionInput,
  PoalimSwiftTransactionInput,
} from '../../../../__generated__/types.js';
import { Currency } from '../../../../shared/enums.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { PoalimScraperIngestionProvider } from '../poalim-scraper-ingestion.provider.js';

let pool: Pool;
let provider: PoalimScraperIngestionProvider;

const TRIGGER_TABLES = [
  'poalim_ils_account_transactions',
  'poalim_foreign_account_transactions',
  'poalim_swift_account_transactions',
];

// poalim_securities and poalim_securities_transactions carry a real owner_id FK, so the tenant this suite acts as
// must exist in accounter_schema.businesses. Seeded in beforeAll, removed in afterAll.
const TEST_OWNER_ID = '00000000-0000-0000-0000-0000000005ec';

function createMockAuthContextProvider(): AuthContextProvider {
  return {
    getAuthContext: () =>
      Promise.resolve({
        authType: 'apiKey' as const,
        token: 'test-token',
        tenant: { businessId: TEST_OWNER_ID },
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

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  const dbProvider = new DBProvider(pool);
  const authContextProvider = createMockAuthContextProvider();
  const dbClient = new TenantAwareDBClient(dbProvider, authContextProvider);
  provider = new PoalimScraperIngestionProvider(dbClient, authContextProvider);

  // poalim_securities.owner_id is a real FK, so the acting tenant must exist.
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name)
     VALUES ($1, 'poalim-ingestion-test-owner')
     ON CONFLICT (id) DO NOTHING`,
    [TEST_OWNER_ID],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id)
     VALUES ($1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [TEST_OWNER_ID],
  );

  // Disable triggers so inserts don't cascade into charges/transactions,
  // which require financial_accounts and owner_id to be set up.
  for (const table of TRIGGER_TABLES) {
    await pool.query(`ALTER TABLE accounter_schema.${table} DISABLE TRIGGER ALL`);
  }
});

afterAll(async () => {
  for (const table of TRIGGER_TABLES) {
    await pool.query(`ALTER TABLE accounter_schema.${table} ENABLE TRIGGER ALL`);
  }
  // Drop the seeded tenant; poalim_securities* rows cascade with it.
  await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [TEST_OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [
    TEST_OWNER_ID,
  ]);
  // Do NOT close db here — the shared pool is managed by vitest-global-setup teardown.
  // Closing it here destroys the pool for all other concurrently-running integration test suites.
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function truncate(table: string) {
  // Use DELETE instead of TRUNCATE CASCADE to avoid acquiring ACCESS EXCLUSIVE locks on
  // tables with FK references (e.g. transactions_raw_list), which deadlocks with
  // concurrently-running integration tests. Triggers are disabled in beforeAll so
  // no dependent rows exist in other tables.
  await pool.query(`DELETE FROM accounter_schema.${table}`);
}

// ── Poalim ILS ────────────────────────────────────────────────────────────────

describe('uploadPoalimIlsTransactions', () => {
  beforeEach(() => truncate('poalim_ils_account_transactions'));

  const baseTx: PoalimIlsTransactionInput = {
    eventDate: '2024-01-15',
    formattedEventDate: '15/01/2024',
    serialNumber: 1,
    activityTypeCode: 1,
    activityDescription: 'Test txn',
    textCode: 0,
    referenceNumber: '1001',
    referenceCatenatedNumber: 0,
    valueDate: '2024-01-15',
    formattedValueDate: '15/01/2024',
    eventAmount: 500.00,
    eventActivityTypeCode: 1,
    currentBalance: 10000.00,
    internalLinkCode: 0,
    originalEventCreateDate: 0,
    transactionType: 'NORMAL',
    dataGroupCode: 0,
    expandedEventDate: '20240115',
    executingBranchNumber: 600,
    eventId: '1',
    differentDateIndication: 'N',
    tableNumber: 0,
    recordNumber: 0,
    contraBankNumber: 0,
    contraBranchNumber: 0,
    contraAccountNumber: 0,
    contraAccountTypeCode: 0,
    marketingOfferContext: 0 as unknown as boolean,
    commentExistenceSwitch: 0 as unknown as boolean,
    fieldDescDisplaySwitch: 0 as unknown as boolean,
    bankNumber: 12,
    branchNumber: 600,
    accountNumber: 100000,
  };

  it('inserts new transactions', async () => {
    const result = await provider.uploadPoalimIlsTransactions([baseTx]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.insertedIds).toHaveLength(1);
  });

  it('skips duplicate transactions (ON CONFLICT)', async () => {
    await provider.uploadPoalimIlsTransactions([baseTx]);
    const result = await provider.uploadPoalimIlsTransactions([baseTx]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.insertedIds).toHaveLength(0);
  });

  it('returns correct counts for mixed new and duplicate', async () => {
    await provider.uploadPoalimIlsTransactions([baseTx]);
    const newTx: PoalimIlsTransactionInput = { ...baseTx, serialNumber: 2, referenceNumber: '1002' };
    const result = await provider.uploadPoalimIlsTransactions([baseTx, newTx]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('returns empty result for empty input', async () => {
    const result = await provider.uploadPoalimIlsTransactions([]);
    expect(result).toEqual({ inserted: 0, skipped: 0, insertedIds: [], changedTransactions: [], insertedTransactions: [] });
  });
});

// ── Poalim Foreign ────────────────────────────────────────────────────────────

describe('uploadPoalimForeignTransactions', () => {
  beforeEach(() => truncate('poalim_foreign_account_transactions'));

  const baseTx: PoalimForeignTransactionInput = {
    executingDate: '2024-01-15',
    formattedExecutingDate: '15/01/2024',
    valueDate: '2024-01-15',
    formattedValueDate: '15/01/2024',
    originalSystemId: 0,
    activityDescription: 'FX transfer',
    eventAmount: 1000.00,
    currency: Currency.Usd,
    currentBalance: 5000.00,
    referenceCatenatedNumber: 0,
    referenceNumber: '7001',
    currencyRate: 3.71,
    rateFixingCode: 0,
    contraCurrencyCode: 0,
    eventActivityTypeCode: 1,
    transactionType: 'NORMAL',
    rateFixingShortDescription: '',
    currencyLongDescription: 'US Dollar',
    activityTypeCode: 1,
    eventNumber: 1,
    validityDate: '2024-01-15',
    commentExistenceSwitch: 0 as unknown as boolean,
    contraBankNumber: 0,
    contraBranchNumber: 0,
    contraAccountNumber: 0,
    originalEventKey: 0 as unknown as boolean,
    dataGroupCode: 0 as unknown as boolean,
    rateFixingDescription: '',
    currencySwiftCode: 'USD',
    bankNumber: 12,
    branchNumber: 600,
    accountNumber: 100000,
  };

  it('inserts new foreign transactions', async () => {
    const result = await provider.uploadPoalimForeignTransactions([baseTx]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips duplicate foreign transactions', async () => {
    await provider.uploadPoalimForeignTransactions([baseTx]);
    const result = await provider.uploadPoalimForeignTransactions([baseTx]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

// ── Poalim Swift ──────────────────────────────────────────────────────────────

describe('uploadPoalimSwiftTransactions', () => {
  beforeEach(() => truncate('poalim_swift_account_transactions'));

  const baseSwift: PoalimSwiftTransactionInput = {
    transferCatenatedId: 'SWIFT-001',
    accountNumber: 100000,
    branchNumber: 600,
    bankNumber: 12,
    startDate: '20240115',
    amount: 5000.00,
    currencyCodeCatenatedKey: 'USD',
  };

  it('inserts new swift transactions', async () => {
    const result = await provider.uploadPoalimSwiftTransactions([baseSwift]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips duplicate swift transactions by transferCatenatedId', async () => {
    await provider.uploadPoalimSwiftTransactions([baseSwift]);
    const result = await provider.uploadPoalimSwiftTransactions([baseSwift]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });
});


// ── Poalim Securities ─────────────────────────────────────────────────────────

describe('uploadPoalimSecurities', () => {
  beforeEach(() => truncate('poalim_securities'));

  // Synthetic values only — never lifted from a real bank capture.
  const baseSecurity: PoalimSecurityInput = {
    bankNumber: 12,
    branchNumber: 615,
    accountNumber: 100000,
    asOfDate: '2024-01-15T10:00:00.000+02:00',
    securityKey: '1234567',
    engName: 'Example Corp',
    hebName: 'אקזמפל',
    itemType: 'Equity',
    isEtf: false,
    isForeign: true,
    currencyCode: 'USD',
    exchange: 'NYQ',
    equityType: 1,
    allowedOrderDirection: 'BuyAndSell',
    equitySubType: 1,
    engSymbol: 'EXMP',
    hebSymbol: 'EXMP',
    symbol: 'EXMP',
    expirationDate: null,
    stockType: 'Equity',
    creationEquityNum: null,
    contractType: null,
  };

  it('inserts new securities', async () => {
    const result = await provider.uploadPoalimSecurities([baseSecurity]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.insertedIds).toHaveLength(1);
    expect(result.changedTransactions).toEqual([]);
  });

  it('stamps owner_id from the auth context', async () => {
    await provider.uploadPoalimSecurities([baseSecurity]);
    const { rows } = await pool.query(
      'SELECT owner_id FROM accounter_schema.poalim_securities WHERE security_key = $1',
      [baseSecurity.securityKey],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].owner_id).toBe(TEST_OWNER_ID);
  });

  it('is idempotent — re-uploading the same securities inserts nothing', async () => {
    await provider.uploadPoalimSecurities([baseSecurity]);
    const result = await provider.uploadPoalimSecurities([baseSecurity]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.insertedIds).toHaveLength(0);
    expect(result.changedTransactions).toEqual([]);
  });

  it('reports changed attributes on an existing security', async () => {
    await provider.uploadPoalimSecurities([baseSecurity]);
    const result = await provider.uploadPoalimSecurities([
      { ...baseSecurity, stockType: 'ETF', isEtf: true },
    ]);

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.changedTransactions).toHaveLength(1);
    expect(result.changedTransactions[0].changedFields).toEqual(
      expect.arrayContaining([
        { field: 'stock_type', oldValue: 'Equity', newValue: 'ETF' },
        { field: 'is_etf', oldValue: 'false', newValue: 'true' },
      ]),
    );
  });

  it('does not report a change when only asOfDate moves', async () => {
    await provider.uploadPoalimSecurities([baseSecurity]);
    const result = await provider.uploadPoalimSecurities([
      { ...baseSecurity, asOfDate: '2024-06-30T10:00:00.000+03:00' },
    ]);
    expect(result.changedTransactions).toEqual([]);
  });

  it('treats the same security key on a different account as a distinct row', async () => {
    await provider.uploadPoalimSecurities([baseSecurity]);
    const result = await provider.uploadPoalimSecurities([
      { ...baseSecurity, accountNumber: 200000 },
    ]);
    expect(result.inserted).toBe(1);
  });

  it('returns correct counts for mixed new and duplicate', async () => {
    await provider.uploadPoalimSecurities([baseSecurity]);
    const result = await provider.uploadPoalimSecurities([
      baseSecurity,
      { ...baseSecurity, securityKey: '7654321', engName: 'Other Corp' },
    ]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('returns empty result for empty input', async () => {
    const result = await provider.uploadPoalimSecurities([]);
    expect(result).toEqual({
      inserted: 0,
      skipped: 0,
      insertedIds: [],
      changedTransactions: [],
      insertedTransactions: [],
    });
  });
});

// ── Poalim Securities Transactions ────────────────────────────────────────────

describe('uploadPoalimSecuritiesTransactions', () => {
  beforeEach(() => truncate('poalim_securities_transactions'));

  // Synthetic values only — never lifted from a real bank capture.
  const baseTransaction: PoalimSecurityTransactionInput = {
    bankNumber: 12,
    branchNumber: 615,
    accountNumber: 100000,
    security: '1234567',
    tradeDate: '2024-01-15T00:00:00.000+02:00',
    valueDate: '2024-01-16T00:00:00.000+02:00',
    settlementDate: '2024-01-17T00:00:00.000+02:00',
    tradeType: 'קניה',
    transactionType: 'קניה',
    nv: 10,
    tradePrice: 100,
    netValueTradeCurrency: -1000,
    paymentType: null,
    paymentDate: null,
    exDate: null,
    cancelDate: null,
    isin: 'US0000000001',
    symbol: 'EXMP',
    engName: 'EXAMPLE CORP',
    hebName: 'אקזמפל',
    securityGroup: 'מניות ניע"ז',
    tradeCurrency: 'דולר ארה"ב',
    settlementCurrency: 'דולר ארה"ב',
    tradeGrossValueTradeCurrency: 1000,
    tradeGrossValueNis: 3700,
    netValueNis: -3.7,
    netValueSettlementCurrency: -1000,
    tradeCommissionValueNis: 3.7,
    israeTaxValue: 0,
    foreignTaxValueSettlementCurrency: 0,
    capitalTaxValueSettlementCurrency: 0,
    isCancelTransaction: 'לא',
    isJumbo: false,
    executionDate: '0001-01-01T00:00:00.000Z',
    lastTranactionDate: '2024-01-15T00:00:00.000+02:00',
    peymentPecentage: 0,
    tradeCurrnecyRate: 1,
    fundPlusAccumulatedInerestValue: 1000,
  };

  // A dividend payment on the same security and trade date: the corporate-action
  // fields are what separate it from the trade above.
  const dividend: PoalimSecurityTransactionInput = {
    ...baseTransaction,
    tradeType: 'דבידנד תשלום',
    transactionType: 'תשלומים ואירועי חברה',
    paymentType: 'דיבידנד',
    paymentDate: '2024-02-05T00:00:00.000+02:00',
    exDate: '2024-01-30T00:00:00.000+02:00',
    nv: 0,
    tradePrice: 0,
    netValueTradeCurrency: 22.5,
  };

  it('inserts new executions', async () => {
    const result = await provider.uploadPoalimSecuritiesTransactions([baseTransaction, dividend]);
    expect(result.inserted).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.insertedIds).toHaveLength(2);
    expect(result.changedTransactions).toEqual([]);
  });

  it('stamps owner_id from the auth context', async () => {
    await provider.uploadPoalimSecuritiesTransactions([baseTransaction]);
    const { rows } = await pool.query(
      'SELECT owner_id FROM accounter_schema.poalim_securities_transactions WHERE security = $1',
      [baseTransaction.security],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].owner_id).toBe(TEST_OWNER_ID);
  });

  it('is idempotent — re-uploading the same executions inserts nothing', async () => {
    await provider.uploadPoalimSecuritiesTransactions([baseTransaction, dividend]);
    const result = await provider.uploadPoalimSecuritiesTransactions([baseTransaction, dividend]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.insertedIds).toHaveLength(0);
    expect(result.changedTransactions).toEqual([]);
  });

  // The corporate-action dates are part of the dedup key and are null on a trade,
  // so the unique index has to treat those nulls as equal.
  it('deduplicates rows whose key includes null corporate-action dates', async () => {
    await provider.uploadPoalimSecuritiesTransactions([baseTransaction]);
    const result = await provider.uploadPoalimSecuritiesTransactions([baseTransaction]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('treats two same-day executions on one security as distinct rows', async () => {
    await provider.uploadPoalimSecuritiesTransactions([baseTransaction]);
    const result = await provider.uploadPoalimSecuritiesTransactions([
      { ...baseTransaction, nv: 5, tradePrice: 101, netValueTradeCurrency: -505 },
    ]);
    expect(result.inserted).toBe(1);
  });

  it('treats the same execution on a different account as a distinct row', async () => {
    await provider.uploadPoalimSecuritiesTransactions([baseTransaction]);
    const result = await provider.uploadPoalimSecuritiesTransactions([
      { ...baseTransaction, accountNumber: 200000 },
    ]);
    expect(result.inserted).toBe(1);
  });

  it('reports restated values on an existing execution', async () => {
    await provider.uploadPoalimSecuritiesTransactions([baseTransaction]);
    const result = await provider.uploadPoalimSecuritiesTransactions([
      { ...baseTransaction, tradeGrossValueNis: 3750, isCancelTransaction: 'כן' },
    ]);

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.changedTransactions).toHaveLength(1);
    expect(result.changedTransactions[0].changedFields).toEqual(
      expect.arrayContaining([
        { field: 'trade_gross_value_nis', oldValue: '3700', newValue: '3750' },
        { field: 'is_cancel_transaction', oldValue: 'לא', newValue: 'כן' },
      ]),
    );
  });

  it('summarises inserted rows with the trade date, type and account', async () => {
    const result = await provider.uploadPoalimSecuritiesTransactions([baseTransaction]);
    expect(result.insertedTransactions[0]).toMatchObject({
      date: '2024-01-15',
      description: 'קניה — EXAMPLE CORP',
      account: '615-100000',
    });
  });

  it('returns correct counts for mixed new and duplicate', async () => {
    await provider.uploadPoalimSecuritiesTransactions([baseTransaction]);
    const result = await provider.uploadPoalimSecuritiesTransactions([baseTransaction, dividend]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('returns empty result for empty input', async () => {
    const result = await provider.uploadPoalimSecuritiesTransactions([]);
    expect(result).toEqual({
      inserted: 0,
      skipped: 0,
      insertedIds: [],
      changedTransactions: [],
      insertedTransactions: [],
    });
  });
});
