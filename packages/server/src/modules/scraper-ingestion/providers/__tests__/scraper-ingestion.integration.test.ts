import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb, closeTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import type {
  AmexTransactionInput,
  CalTransactionInput,
  DiscountTransactionInput,
  IsracardTransactionInput,
  MaxTransactionInput,
  PoalimForeignTransactionInput,
  PoalimIlsTransactionInput,
  PoalimSwiftTransactionInput,
} from '../../../../__generated__/types.js';
import { Currency } from '../../../../shared/enums.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { FiatExchangeProvider } from '../../../exchange-rates/providers/fiat-exchange.provider.js';
import { ScraperIngestionProvider } from '../scraper-ingestion.provider.js';

let pool: Pool;
let provider: ScraperIngestionProvider;

const TRIGGER_TABLES = [
  'cal_creditcard_transactions',
  'bank_discount_transactions',
  'max_creditcard_transactions',
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
  const fiatExchangeProvider = new FiatExchangeProvider(dbProvider);
  // Stub the DataLoader so it returns null for any date (no pre-existing rates in test DB)
  fiatExchangeProvider.getExchangeRatesByDatesLoader = {
    loadMany: async (dates: readonly Date[]) => dates.map(() => null),
  } as unknown as typeof fiatExchangeProvider.getExchangeRatesByDatesLoader;
  provider = new ScraperIngestionProvider(dbClient, fiatExchangeProvider);

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

// ── Cal ───────────────────────────────────────────────────────────────────────

describe('uploadCalTransactions', () => {
  beforeEach(() => truncate('cal_creditcard_transactions'));

  const baseTx: CalTransactionInput = {
    trnIntId: 'CAL-TXN-001',
    card: 4321,
    merchantName: 'Cal Store',
    trnAmt: '150.00',
    trnCurrencySymbol: 'ILS',
    debCrdCurrencySymbol: 'ILS',
  };

  it('inserts new cal transactions', async () => {
    const result = await provider.uploadCalTransactions([baseTx]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips duplicate cal transactions by trnIntId', async () => {
    await provider.uploadCalTransactions([baseTx]);
    const result = await provider.uploadCalTransactions([baseTx]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('inserts two transactions with different trnIntId', async () => {
    const tx2: CalTransactionInput = { ...baseTx, trnIntId: 'CAL-TXN-002' };
    const result = await provider.uploadCalTransactions([baseTx, tx2]);
    expect(result.inserted).toBe(2);
    expect(result.skipped).toBe(0);
  });
});

// ── Discount ──────────────────────────────────────────────────────────────────

describe('uploadDiscountTransactions', () => {
  beforeEach(() => truncate('bank_discount_transactions'));

  const baseTx: DiscountTransactionInput = {
    urn: 'DISCOUNT-URN-001',
    accountNumber: 'ACC-001',
    operationDate: '2024-01-15',
    operationAmount: '300.00',
    operationDescription: 'Transfer',
  };

  it('inserts new discount transactions', async () => {
    const result = await provider.uploadDiscountTransactions([baseTx]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips duplicate discount transactions by urn + accountNumber', async () => {
    await provider.uploadDiscountTransactions([baseTx]);
    const result = await provider.uploadDiscountTransactions([baseTx]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('inserts same urn with different accountNumber', async () => {
    const tx2: DiscountTransactionInput = { ...baseTx, accountNumber: 'ACC-002' };
    const result = await provider.uploadDiscountTransactions([baseTx, tx2]);
    expect(result.inserted).toBe(2);
    expect(result.skipped).toBe(0);
  });
});

// ── Max ───────────────────────────────────────────────────────────────────────

describe('uploadMaxTransactions', () => {
  beforeEach(() => truncate('max_creditcard_transactions'));

  const baseTx: MaxTransactionInput = {
    uid: 'MAX-UID-001',
    merchantName: 'Max Store',
    merchant: 'Max Store',
    originalAmount: '400.00',
    originalCurrency: 'ILS',
    purchaseDate: '2024-01-15',
    paymentDate: '2024-02-15',
    cardIndex: 1,
    categoryId: 100,
    planName: 'regular',
    planTypeId: 1,
    actualPaymentAmount: '400.00',
    arn: 'ARN-001',
    comments: '',
    dealDataAcq: '',
    dealDataAdjustmentType: '0',
    dealDataAmount: '400.00',
    dealDataAmountIls: '400.00',
    dealDataAmountLeft: '0',
    dealDataArn: 'ARN-001',
    dealDataAuthorizationNumber: '000000',
    dealDataCommissionVat: '0',
    dealDataExchangeDirect: 'N',
    dealDataExchangeRate: '1',
    dealDataInterestAmount: '0',
    dealDataIsAllowedSpreadWithBenefit: 0 as unknown as boolean,
    dealDataIssuerCurrency: 'ILS',
    dealDataPlan: '0',
    dealDataPosEntryEmv: '0',
    dealDataProcessingDate: '2024-01-15',
    dealDataRefNbr: 'REF001',
    dealDataShowCancelDebit: 0 as unknown as boolean,
    dealDataShowSpread: 0 as unknown as boolean,
    dealDataShowSpreadBenefitButton: 0 as unknown as boolean,
    dealDataShowSpreadButton: 0 as unknown as boolean,
    dealDataShowSpreadForLeumi: 0 as unknown as boolean,
    dealDataTdmCardToken: '',
    dealDataTdmTransactionType: 0,
    dealDataTransactionType: 0,
    dealDataTxnCode: 0,
    dealDataUserName: '',
    dealDataWithdrawalCommissionAmount: '0',
    ethocaInd: 0 as unknown as boolean,
    isRegisterCh: 0 as unknown as boolean,
    isSpreadingAutorizationAllowed: 0 as unknown as boolean,
    issuerId: 0,
    merchantMaxPhone: 0 as unknown as boolean,
    merchantNumber: '0',
    merchantPhone: '',
    merchantTaxId: '',
    promotionClub: '',
    refIndex: 0,
    runtimeReferenceInternalId: '',
    runtimeReferenceType: 0,
    spreadTransactionByCampainInd: 0 as unknown as boolean,
    tableType: 0,
    userIndex: 0,
  };

  it('inserts new max transactions', async () => {
    const result = await provider.uploadMaxTransactions([baseTx]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips duplicate max transactions by uid', async () => {
    await provider.uploadMaxTransactions([baseTx]);
    const result = await provider.uploadMaxTransactions([baseTx]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

// ── Currency Rates ────────────────────────────────────────────────────────────

describe('uploadCurrencyRates', () => {
  beforeEach(() => truncate('exchange_rates'));

  const baseRate = {
    exchangeDate: '2024-01-15' as const,
    usd: 3.712,
    eur: 4.01,
    gbp: 4.65,
  };

  it('inserts new currency rates', async () => {
    const result = await provider.uploadCurrencyRates([baseRate]);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips duplicate currency rates by exchangeDate', async () => {
    await provider.uploadCurrencyRates([baseRate]);
    const result = await provider.uploadCurrencyRates([baseRate]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('inserts rates for different dates', async () => {
    const rate2 = { ...baseRate, exchangeDate: '2024-01-16' as const, usd: 3.72 };
    const result = await provider.uploadCurrencyRates([baseRate, rate2]);
    expect(result.inserted).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('returns empty result for empty input', async () => {
    const result = await provider.uploadCurrencyRates([]);
    expect(result).toEqual({ inserted: 0, skipped: 0, insertedIds: [], changedTransactions: [], insertedTransactions: [] });
  });
});
