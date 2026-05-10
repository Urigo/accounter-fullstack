import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb, closeTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import type {
  IsracardTransactionInput,
  PoalimForeignTransactionInput,
  PoalimIlsTransactionInput,
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

function createMockAuthContextProvider(): AuthContextProvider {
  return {
    getAuthContext: () =>
      Promise.resolve({
        authType: 'apiKey' as const,
        token: 'test-token',
        tenant: { businessId: '00000000-0000-0000-0000-000000000000' },
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
  const dbClient = new TenantAwareDBClient(dbProvider, createMockAuthContextProvider());
  provider = new PoalimScraperIngestionProvider(dbClient);

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

