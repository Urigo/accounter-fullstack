import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import {
  ensureBusinessForEntity,
  ensureFinancialEntity,
} from '../../../../__tests__/helpers/seed-helpers.js';
import type {
  LeumiCreditCardTransactionInput,
  LeumiForeignTransactionInput,
  LeumiIlsTransactionInput,
} from '../../../../__generated__/types.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { LeumiScraperIngestionProvider } from '../leumi-scraper-ingestion.provider.js';

// Made-up accounts. Both businesses hold the same numbers on purpose: an accountant and a
// client, or two partners, can each scrape one shared account.
const ILS_ACCOUNT = '99900000000001';
const USD_ACCOUNT = '99900000000000000002';
const CARD = '9901';

let pool: Pool;
let businessA: string;
let businessB: string;

function providerFor(businessId: string): LeumiScraperIngestionProvider {
  const auth = {
    getAuthContext: () =>
      Promise.resolve({
        authType: 'apiKey' as const,
        token: 'test-token',
        tenant: { businessId },
        user: {
          userId: 'api-key:test',
          auth0UserId: null,
          email: '',
          roleId: 'scraper',
          permissions: [],
          emailVerified: true,
          permissionsVersion: 0,
        },
      }),
  } as unknown as AuthContextProvider;
  return new LeumiScraperIngestionProvider(
    new TenantAwareDBClient(new DBProvider(pool), auth),
    auth,
  );
}

async function createBusiness(name: string): Promise<string> {
  const client = await pool.connect();
  try {
    const { id } = await ensureFinancialEntity(client, { name, type: 'business' });
    await ensureBusinessForEntity(client, id, { ownerId: id });
    await client.query(`UPDATE accounter_schema.financial_entities SET owner_id = $1 WHERE id = $1`, [
      id,
    ]);
    for (const [number, type] of [
      [ILS_ACCOUNT, 'BANK_ACCOUNT'],
      [USD_ACCOUNT, 'BANK_ACCOUNT'],
      [CARD, 'CREDIT_CARD'],
    ] as const) {
      await client.query(
        `INSERT INTO accounter_schema.financial_accounts (account_number, type, owner, owner_id)
         SELECT $1, $2::accounter_schema.financial_account_type, $3, $3
         WHERE NOT EXISTS (
           SELECT 1 FROM accounter_schema.financial_accounts
           WHERE account_number = $1 AND owner_id = $3
         )`,
        [number, type, id],
      );
    }
    return id;
  } finally {
    client.release();
  }
}

async function cleanUp() {
  const owners = [businessA, businessB];
  // The raw rows cascade to the raw list; transactions and charges are removed by owner.
  await pool.query(`DELETE FROM accounter_schema.transactions WHERE owner_id = ANY($1)`, [owners]);
  for (const table of [
    'leumi_ils_account_transactions',
    'leumi_foreign_account_transactions',
    'leumi_creditcard_transactions',
  ]) {
    await pool.query(`DELETE FROM accounter_schema.${table} WHERE owner_id = ANY($1)`, [owners]);
  }
  await pool.query(`DELETE FROM accounter_schema.charges WHERE owner_id = ANY($1)`, [owners]);
}

async function transactionsOf(businessId: string) {
  const { rows } = await pool.query<{
    source_origin: string;
    currency: string;
    amount: string;
    event_date: string;
    debit_date: string;
    source_description: string;
    account_owner: string;
    account_number: string;
  }>(
    `SELECT t.source_origin, t.currency, t.amount, t.event_date::text, t.debit_date::text,
            t.source_description, fa.owner_id AS account_owner, fa.account_number
     FROM accounter_schema.transactions t
     JOIN accounter_schema.financial_accounts fa ON fa.id = t.account_id
     WHERE t.owner_id = $1
     ORDER BY t.event_date, t.amount`,
    [businessId],
  );
  return rows;
}

const ilsTx: LeumiIlsTransactionInput = {
  accountNumber: ILS_ACCOUNT,
  date: '2026-01-15',
  effectiveDate: '2026-01-16',
  amount: -120.5,
  credit: 0,
  debit: 120.5,
  description: 'Standing order',
  additionalData: 'To: someone',
  runningBalance: 1000,
  referenceNumber: '12345',
  checkNumber: '12345',
  fitid: '202601150012345',
  typeCode: 4,
  additionalActivityType: 0,
  extensionTypeCode: 0,
  segmentationFlag: 0,
  creditCardIndex: 0,
  ifLink: 0,
};

const foreignTx: LeumiForeignTransactionInput = {
  accountNumber: USD_ACCOUNT,
  currency: 'USD',
  date: '2026-02-01',
  description: 'Conversion',
  reference: '700000001',
  debit: 10,
  credit: 0,
  balance: 90,
};

const cardTx: LeumiCreditCardTransactionInput = {
  cardLast4: CARD,
  relatedAccountNumber: ILS_ACCOUNT,
  cardTransactionId: 'TX-1',
  dealDate: '2026-03-05',
  debitDate: '2026-04-10',
  merchantName: 'Some shop',
  dealDescription: '',
  dealAmount: 300,
  dealCurrencyCode: '-1',
  chargeAmount: 100,
  chargeCurrency: 'ILS',
  transactionType: 111,
  tableId: 1,
};

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  businessA = await createBusiness('Leumi ingestion test A');
  businessB = await createBusiness('Leumi ingestion test B');
});

beforeEach(cleanUp);
afterAll(cleanUp);

describe('uploadLeumiIlsTransactions', () => {
  it('stores a row and creates its transaction on the business own account', async () => {
    const result = await providerFor(businessA).uploadLeumiIlsTransactions([ilsTx]);
    expect(result).toMatchObject({ inserted: 1, skipped: 0, changedTransactions: [] });
    expect(result.insertedTransactions[0]).toMatchObject({
      date: '2026-01-15',
      amount: '-120.5',
      account: ILS_ACCOUNT,
    });

    expect(await transactionsOf(businessA)).toEqual([
      {
        source_origin: 'LEUMI',
        currency: 'ILS',
        amount: '-120.5',
        event_date: '2026-01-15',
        debit_date: '2026-01-16',
        source_description: 'Standing order To: someone',
        account_owner: businessA,
        account_number: ILS_ACCOUNT,
      },
    ]);
  });

  it('skips a row that is already stored', async () => {
    await providerFor(businessA).uploadLeumiIlsTransactions([ilsTx]);
    const again = await providerFor(businessA).uploadLeumiIlsTransactions([ilsTx]);
    expect(again).toMatchObject({ inserted: 0, skipped: 1 });
    expect(await transactionsOf(businessA)).toHaveLength(1);
  });

  it('keeps rows that share a bank reference but differ in amount or balance', async () => {
    const result = await providerFor(businessA).uploadLeumiIlsTransactions([
      ilsTx,
      { ...ilsTx, amount: -5, debit: 5, runningBalance: 995 },
    ]);
    expect(result).toMatchObject({ inserted: 2, skipped: 0 });
  });

  it('stores the same account for a second business, on that business own account', async () => {
    await providerFor(businessA).uploadLeumiIlsTransactions([ilsTx]);
    const second = await providerFor(businessB).uploadLeumiIlsTransactions([ilsTx]);
    expect(second).toMatchObject({ inserted: 1, skipped: 0 });

    const [transaction] = await transactionsOf(businessB);
    expect(transaction?.account_owner).toBe(businessB);
    expect(await transactionsOf(businessA)).toHaveLength(1);
  });

  it('refuses a row for an account that is not set up, naming the account', async () => {
    await expect(
      providerFor(businessA).uploadLeumiIlsTransactions([{ ...ilsTx, accountNumber: '111' }]),
    ).rejects.toThrow(/No bank account 111 is set up/);
    expect(await transactionsOf(businessA)).toHaveLength(0);
  });
});

describe('uploadLeumiForeignTransactions', () => {
  it('creates a transaction in the account currency, negative for a debit', async () => {
    const result = await providerFor(businessA).uploadLeumiForeignTransactions([foreignTx]);
    expect(result).toMatchObject({ inserted: 1, skipped: 0 });
    expect(await transactionsOf(businessA)).toEqual([
      expect.objectContaining({
        source_origin: 'LEUMI',
        currency: 'USD',
        amount: '-10',
        event_date: '2026-02-01',
        account_number: USD_ACCOUNT,
      }),
    ]);
  });

  it('skips a row that is already stored', async () => {
    await providerFor(businessA).uploadLeumiForeignTransactions([foreignTx]);
    const again = await providerFor(businessA).uploadLeumiForeignTransactions([foreignTx]);
    expect(again).toMatchObject({ inserted: 0, skipped: 1 });
  });
});

describe('uploadLeumiCreditCardTransactions', () => {
  it('creates a charge of the amount debited in the cycle, on the card', async () => {
    const result = await providerFor(businessA).uploadLeumiCreditCardTransactions([cardTx]);
    expect(result).toMatchObject({ inserted: 1, skipped: 0 });
    expect(await transactionsOf(businessA)).toEqual([
      expect.objectContaining({
        source_origin: 'LEUMI_CREDIT_CARD',
        currency: 'ILS',
        amount: '-100',
        event_date: '2026-03-05',
        debit_date: '2026-04-10',
        source_description: 'Some shop',
        account_number: CARD,
      }),
    ]);
  });

  it('stores a refund as money coming in', async () => {
    await providerFor(businessA).uploadLeumiCreditCardTransactions([
      { ...cardTx, cardTransactionId: 'TX-2', chargeAmount: -40 },
    ]);
    const [transaction] = await transactionsOf(businessA);
    expect(transaction?.amount).toBe('40');
  });

  it('stores each instalment of one deal, and skips one already stored', async () => {
    const provider = providerFor(businessA);
    const first = await provider.uploadLeumiCreditCardTransactions([
      cardTx,
      { ...cardTx, debitDate: '2026-05-10' },
    ]);
    expect(first).toMatchObject({ inserted: 2, skipped: 0 });
    const again = await provider.uploadLeumiCreditCardTransactions([cardTx]);
    expect(again).toMatchObject({ inserted: 0, skipped: 1 });
  });
});
