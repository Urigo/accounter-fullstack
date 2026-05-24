import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import type {
  OtsarHahayalForeignTransactionInput,
  OtsarHahayalIlsTransactionInput,
} from '../../../../__generated__/types.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { OtsarHahayalScraperIngestionProvider } from '../otsar-hahayal-scraper-ingestion.provider.js';

let pool: Pool;
let provider: OtsarHahayalScraperIngestionProvider;

const TRIGGER_TABLES = [
  'otsar_hahayal_ils_account_transactions',
  'otsar_hahayal_foreign_account_transactions',
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
  provider = new OtsarHahayalScraperIngestionProvider(dbClient, createMockAuthContextProvider());

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
});

async function truncate(table: string) {
  // Use DELETE instead of TRUNCATE CASCADE to avoid ACCESS EXCLUSIVE locks on tables with FK
  // references (e.g. transactions_raw_list), which can deadlock with concurrent integration tests.
  await pool.query(`DELETE FROM accounter_schema.${table}`);
}

// ── Otsar HaHayal ILS ─────────────────────────────────────────────────────────

describe('uploadOtsarHahayalIlsTransactions', () => {
  beforeEach(() => truncate('otsar_hahayal_ils_account_transactions'));

  const baseTx: OtsarHahayalIlsTransactionInput = {
    accountNumber: 345763,
    accountType: 0,
    branchNumber: 361,
    actionCode: 0,
    bfbSource: '77',
    closingBalance: 9500,
    correspondentAccount: 0,
    correspondentAccountType: 0,
    correspondentBank: 0,
    correspondentBranch: 0,
    creditAmount: 500,
    customerName: 'Test Customer',
    dateOfBusinessDay: '2024-06-01T00:00:00.000Z',
    dateOfRegistration: '2024-06-01T00:00:00.000Z',
    debitAmount: 0,
    depositorId: 0,
    description: 'Test transaction',
    drillDownUrl: 'https://example.com',
    drillDownData: null,
    firstTransactionOfDay: true,
    lastTransactionOfDay: false,
    name: 'Test Name',
    openingBalance: 10000,
    operationSource: 'WEB',
    reference: 1001,
    salaryInd: 0,
    transactionSource: 'BANK',
    transactionReason: 'Payment',
  };

  it('inserts new ILS transactions', async () => {
    const result = await provider.uploadOtsarHahayalIlsTransactions([baseTx]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.insertedIds).toHaveLength(1);
  });

  it('skips duplicate ILS transactions (ON CONFLICT)', async () => {
    await provider.uploadOtsarHahayalIlsTransactions([baseTx]);
    const result = await provider.uploadOtsarHahayalIlsTransactions([baseTx]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.insertedIds).toHaveLength(0);
  });

  it('returns correct counts for mixed new and duplicate', async () => {
    await provider.uploadOtsarHahayalIlsTransactions([baseTx]);
    const newTx: OtsarHahayalIlsTransactionInput = {
      ...baseTx,
      reference: 1002,
      dateOfRegistration: '2024-06-02T00:00:00.000Z',
    };
    const result = await provider.uploadOtsarHahayalIlsTransactions([baseTx, newTx]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('returns empty result for empty input', async () => {
    const result = await provider.uploadOtsarHahayalIlsTransactions([]);
    expect(result).toEqual({
      inserted: 0,
      skipped: 0,
      insertedIds: [],
      changedTransactions: [],
      insertedTransactions: [],
    });
  });

  it('reports changed fields for existing row with updated data', async () => {
    await provider.uploadOtsarHahayalIlsTransactions([baseTx]);
    const modified: OtsarHahayalIlsTransactionInput = {
      ...baseTx,
      description: 'Updated description',
    };
    const result = await provider.uploadOtsarHahayalIlsTransactions([modified]);
    expect(result.skipped).toBe(1);
    expect(result.changedTransactions).toHaveLength(1);
    const changed = result.changedTransactions[0];
    expect(changed.changedFields.some(f => f.field === 'description')).toBe(true);
  });
});

// ── Otsar HaHayal Foreign ─────────────────────────────────────────────────────

describe('uploadOtsarHahayalForeignTransactions', () => {
  beforeEach(() => truncate('otsar_hahayal_foreign_account_transactions'));

  const baseTx: OtsarHahayalForeignTransactionInput = {
    account: 345763,
    branch: 361,
    accountType: '106 פמח תאגידים',
    currency: 'USD',
    openingBalance: 14731.42,
    balance: 15231.42,
    valueDate: '2024-06-01',
    credit: 500,
    debit: 0,
    description: 'Wire transfer',
    sp: null,
    reference: 'REF-001',
    date: '2024-06-01',
    subTransactions: '[]',
  };

  it('inserts new foreign transactions', async () => {
    const result = await provider.uploadOtsarHahayalForeignTransactions([baseTx]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.insertedIds).toHaveLength(1);
  });

  it('skips duplicate foreign transactions (ON CONFLICT)', async () => {
    await provider.uploadOtsarHahayalForeignTransactions([baseTx]);
    const result = await provider.uploadOtsarHahayalForeignTransactions([baseTx]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.insertedIds).toHaveLength(0);
  });

  it('returns correct counts for mixed new and duplicate', async () => {
    await provider.uploadOtsarHahayalForeignTransactions([baseTx]);
    const newTx: OtsarHahayalForeignTransactionInput = {
      ...baseTx,
      reference: 'REF-002',
      date: '2024-06-02',
    };
    const result = await provider.uploadOtsarHahayalForeignTransactions([baseTx, newTx]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('returns empty result for empty input', async () => {
    const result = await provider.uploadOtsarHahayalForeignTransactions([]);
    expect(result).toEqual({
      inserted: 0,
      skipped: 0,
      insertedIds: [],
      changedTransactions: [],
      insertedTransactions: [],
    });
  });

  it('reports changed fields for existing row with updated data', async () => {
    await provider.uploadOtsarHahayalForeignTransactions([baseTx]);
    const modified: OtsarHahayalForeignTransactionInput = {
      ...baseTx,
      balance: 99999.99,
    };
    const result = await provider.uploadOtsarHahayalForeignTransactions([modified]);
    expect(result.skipped).toBe(1);
    expect(result.changedTransactions).toHaveLength(1);
    const changed = result.changedTransactions[0];
    expect(changed.changedFields.some(f => f.field === 'balance')).toBe(true);
  });
});
