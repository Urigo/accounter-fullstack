import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb, closeTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import type {
  AmexTransactionInput,
  IsracardTransactionInput,
} from '../../../../__generated__/types.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { IsracardAmexScraperIngestionProvider } from '../isracard-amex-scraper-ingestion.provider.js';

let pool: Pool;
let provider: IsracardAmexScraperIngestionProvider;

const TRIGGER_TABLES = [
  'isracard_creditcard_transactions',
  'amex_creditcard_transactions',
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
  provider = new IsracardAmexScraperIngestionProvider(dbClient);

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
  await closeTestDb();
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function truncate(table: string) {
  await pool.query(`TRUNCATE TABLE accounter_schema.${table} CASCADE`);
}

// ── Isracard ──────────────────────────────────────────────────────────────────

describe('uploadIsracardTransactions', () => {
  beforeEach(() => truncate('isracard_creditcard_transactions'));

  const baseTx: IsracardTransactionInput = {
    card: "1234",
    cardIndex: 0,
    fullPurchaseDate: '15/01/2024',
    paymentSum: '250.00',
    voucherNumber: 9001,
    supplierName: 'Test Store',
    isHoraatKeva: 'N',
    isError: 'N',
    isCaptcha: 'N',
    isButton: 'N',
    tablePageNum: 0 as unknown as boolean,
  };

  it('inserts new isracard transactions', async () => {
    const result = await provider.uploadIsracardTransactions([baseTx]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips duplicate isracard transactions', async () => {
    await provider.uploadIsracardTransactions([baseTx]);
    const result = await provider.uploadIsracardTransactions([baseTx]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

// ── Amex ──────────────────────────────────────────────────────────────────────

describe('uploadAmexTransactions', () => {
  beforeEach(() => truncate('amex_creditcard_transactions'));

  const baseTx: AmexTransactionInput = {
    card: "5678",
    cardIndex: 0,
    fullPurchaseDate: '20/01/2024',
    paymentSum: '180.00',
    voucherNumber: 8001,
    supplierName: 'Amex Merchant',
    isHoraatKeva: 'N',
    isError: 'N',
    isCaptcha: 'N',
    isButton: 'N',
    tablePageNum: 0 as unknown as boolean,
  };

  it('inserts new amex transactions', async () => {
    const result = await provider.uploadAmexTransactions([baseTx]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips duplicate amex transactions', async () => {
    await provider.uploadAmexTransactions([baseTx]);
    const result = await provider.uploadAmexTransactions([baseTx]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });
});
