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
  'poalim_ils_account_transactions',
  'poalim_foreign_account_transactions',
  'poalim_swift_account_transactions',
  'isracard_creditcard_transactions',
  'amex_creditcard_transactions',
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
    referenceNumber: 7001,
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
    amount: '5000',
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
