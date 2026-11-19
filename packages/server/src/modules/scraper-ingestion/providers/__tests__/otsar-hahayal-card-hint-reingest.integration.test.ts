import { randomUUID } from 'node:crypto';
import type { Injector } from 'graphql-modules';
import type { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import type { OtsarHahayalIlsTransactionInput } from '../../../../__generated__/types.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { autoLinkCreditCardStatements } from '../../../transactions/helpers/link-creditcard-statements.helper.js';
import { CreditCardStatementsProvider } from '../../../transactions/providers/creditcard-statements.provider.js';
import { OtsarHahayalScraperIngestionProvider } from '../otsar-hahayal-scraper-ingestion.provider.js';

/**
 * Re-ingesting an Otsar Hahayal ILS card-debit row once the scraper finds its card hint
 * (`origin_reference`, part of the raw conflict key) must not duplicate the raw row, its
 * transaction or its charge, and the hint must then link the debit to its card statement. Runs
 * with the raw table's insert trigger on, as in production. All values are fake.
 */

let pool: Pool;

const OWNER_ID = '00000000-0000-4000-8000-00000000dd01';
const BANK_ACCOUNT_NUMBER = 987_001;
const CARD_LAST_FOUR = '1234';

const created = { accountIds: [] as string[], rawListIds: [] as string[], chargeIds: [] as string[] };
const dbClients: TenantAwareDBClient[] = [];

function createAuthContextProvider(businessId: string): AuthContextProvider {
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

function createDbClient() {
  const db = new TenantAwareDBClient(new DBProvider(pool), createAuthContextProvider(OWNER_ID));
  dbClients.push(db);
  return db;
}

/** One simulated upload request */
function createIngestionProvider() {
  return new OtsarHahayalScraperIngestionProvider(
    createDbClient(),
    createAuthContextProvider(OWNER_ID),
  );
}

function createInjector(): Injector {
  const adminContext = {
    getVerifiedAdminContext: async () => ({ ownerId: OWNER_ID }),
    adminContextByOwnerIdLoader: {
      load: async () => ({ financialAccounts: { creditCardIds: [] } }),
    },
  } as unknown as AdminContextProvider;
  const statements = new CreditCardStatementsProvider(createDbClient(), adminContext);
  const providers = new Map<unknown, unknown>([
    [AdminContextProvider, adminContext],
    [CreditCardStatementsProvider, statements],
  ]);
  return {
    get: (token: unknown) => {
      const provider = providers.get(token);
      if (!provider) {
        throw new Error(`Provider not available in test injector: ${String(token)}`);
      }
      return provider;
    },
  } as unknown as Injector;
}

async function runAutomation() {
  const linked = [];
  for await (const item of autoLinkCreditCardStatements(createInjector(), {
    ownerId: OWNER_ID,
    creditCardBusinessIds: [],
  })) {
    linked.push(item);
  }
  return linked;
}

async function createAccount(type: 'BANK_ACCOUNT' | 'CREDIT_CARD', accountNumber: string) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO accounter_schema.financial_accounts
       (id, account_number, private_business, owner, type, owner_id)
     VALUES ($1, $2, 'BUSINESS', $3, $4, $3)`,
    [id, accountNumber, OWNER_ID, type],
  );
  created.accountIds.push(id);
  return id;
}

/** A card transaction of the statement debited on `debitDate`, without a raw scraper row */
async function createCardTransaction(accountId: string, amount: string, debitDate: string) {
  const chargeId = randomUUID();
  await pool.query(`INSERT INTO accounter_schema.charges (id, owner_id) VALUES ($1, $2)`, [
    chargeId,
    OWNER_ID,
  ]);
  created.chargeIds.push(chargeId);
  const rawListId = randomUUID();
  await pool.query(
    `INSERT INTO accounter_schema.transactions_raw_list (id, etana_id) VALUES ($1, $2)`,
    [rawListId, `otsar-reingest-test-${rawListId}`],
  );
  created.rawListIds.push(rawListId);
  const id = randomUUID();
  await pool.query(
    `INSERT INTO accounter_schema.transactions (
       id, account_id, charge_id, source_id, source_description, currency, event_date, debit_date,
       amount, current_balance, source_reference, source_origin, origin_key, owner_id, is_fee
     )
     VALUES ($1, $2, $3, $4, 'Card purchase', 'ILS', $5::date - 20, $5, $6, 0, 'ref', 'TEST',
       $7, $8, false)`,
    [id, accountId, chargeId, rawListId, debitDate, amount, `otsar-reingest-test-${id}`, OWNER_ID],
  );
}

function cardDebitRow(
  overrides: Partial<OtsarHahayalIlsTransactionInput> = {},
): OtsarHahayalIlsTransactionInput {
  return {
    accountNumber: BANK_ACCOUNT_NUMBER,
    accountType: 409,
    branchNumber: 101,
    actionCode: 0,
    bfbSource: '77',
    closingBalance: 1000,
    correspondentAccount: 0,
    correspondentAccountType: 0,
    correspondentBank: 0,
    correspondentBranch: 0,
    creditAmount: 0,
    customerName: ' ',
    dateOfBusinessDay: '2026-05-10T00:00:00',
    dateOfRegistration: '2026-05-10T00:00:00',
    debitAmount: 321.5,
    depositorId: 0,
    description: 'Card charges',
    drillDownUrl: '/drill?SUGBAKA=211&ID=1',
    firstTransactionOfDay: true,
    lastTransactionOfDay: true,
    name: ' ',
    openingBalance: 1321.5,
    operationSource: ' ',
    reference: 4242,
    salaryInd: 0,
    transactionSource: ' ',
    transactionReason: ' ',
    ...overrides,
  };
}

const CARD_BREAKDOWN = JSON.stringify({
  T20C2211: { 'OUT-DATA': { 'ALL-CARDS': { 'KARTIS-DETAILS': { 'OUT-MSKART': CARD_LAST_FOUR } } } },
});

/** The raw rows, transactions and charges stored for the test bank account */
async function storedState() {
  const { rows: rawRows } = await pool.query<{
    id: string;
    origin_reference: string;
    drill_down_data: unknown;
  }>(
    `SELECT id, origin_reference, drill_down_data
     FROM accounter_schema.otsar_hahayal_ils_account_transactions
     WHERE account_number = $1`,
    [BANK_ACCOUNT_NUMBER],
  );
  const { rows: transactions } = await pool.query<{ id: string; charge_id: string }>(
    `SELECT t.id, t.charge_id
     FROM accounter_schema.transactions t
       JOIN accounter_schema.transactions_raw_list rl ON rl.id = t.source_id
       JOIN accounter_schema.otsar_hahayal_ils_account_transactions o
         ON o.id = rl.otsar_hahayal_ils_id
     WHERE o.account_number = $1`,
    [BANK_ACCOUNT_NUMBER],
  );
  const { rows: charges } = await pool.query<{ id: string }>(
    `SELECT id FROM accounter_schema.charges WHERE id = ANY($1)`,
    [transactions.map(t => t.charge_id)],
  );
  return { rawRows, transactions, charges };
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
     VALUES ($1, 'otsar-reingest-test-owner', 'business', NULL)
     ON CONFLICT (id) DO NOTHING`,
    [OWNER_ID],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id, country)
     VALUES ($1, $1, 'ISR')
     ON CONFLICT (id) DO NOTHING`,
    [OWNER_ID],
  );
  await createAccount('BANK_ACCOUNT', String(BANK_ACCOUNT_NUMBER));
  const card = await createAccount('CREDIT_CARD', `123456xxxxxx${CARD_LAST_FOUR}`);
  // the card statement the debit settles: same total, issuer date one day before the bank's
  await createCardTransaction(card, '-300.00', '2026-05-09');
  await createCardTransaction(card, '-21.50', '2026-05-09');
  // another card's statement with the same total, so only the hint can tell them apart
  const otherCard = await createAccount('CREDIT_CARD', '123456xxxxxx9876');
  await createCardTransaction(otherCard, '-321.50', '2026-05-11');
});

afterEach(async () => {
  await Promise.all(dbClients.splice(0).map(client => client.dispose()));
});

afterAll(async () => {
  const { transactions } = await storedState();
  await pool.query('DELETE FROM accounter_schema.transactions WHERE owner_id = $1', [OWNER_ID]);
  await pool.query(
    'DELETE FROM accounter_schema.otsar_hahayal_ils_account_transactions WHERE account_number = $1',
    [BANK_ACCOUNT_NUMBER],
  );
  await pool.query('DELETE FROM accounter_schema.transactions_raw_list WHERE id = ANY($1)', [
    created.rawListIds,
  ]);
  await pool.query('DELETE FROM accounter_schema.charges WHERE id = ANY($1)', [
    [...created.chargeIds, ...transactions.map(t => t.charge_id)],
  ]);
  await pool.query('DELETE FROM accounter_schema.financial_accounts WHERE id = ANY($1)', [
    created.accountIds,
  ]);
  await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [OWNER_ID]);
});

describe('re-ingesting an Otsar Hahayal card debit with its card hint', () => {
  it('fills the stored row instead of duplicating it, and the hint then links the debit', async () => {
    // 1. the row as scraped before card hints: no origin_reference
    const first = await createIngestionProvider().uploadOtsarHahayalIlsTransactions([
      cardDebitRow(),
    ]);
    expect(first.inserted).toBe(1);
    const before = await storedState();
    expect(before.rawRows).toHaveLength(1);
    expect(before.rawRows[0]?.origin_reference).toBe('');
    expect(before.transactions).toHaveLength(1);
    expect(before.charges).toHaveLength(1);

    // without the hint, two statements with the same total: nothing is linked
    expect(await runAutomation()).toHaveLength(0);

    // 2. the same row, now with the card's last 4 digits and its card breakdown
    const second = await createIngestionProvider().uploadOtsarHahayalIlsTransactions([
      cardDebitRow({ originReference: CARD_LAST_FOUR, drillDownData: CARD_BREAKDOWN }),
    ]);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(1);
    expect(second.changedTransactions).toEqual([
      {
        id: before.rawRows[0]?.id,
        changedFields: [{ field: 'origin_reference', oldValue: '', newValue: CARD_LAST_FOUR }],
      },
    ]);

    // 3. one raw row, one transaction, one charge: the same ones, the raw row now hinted
    const after = await storedState();
    expect(after.rawRows).toHaveLength(1);
    expect(after.rawRows[0]?.id).toBe(before.rawRows[0]?.id);
    expect(after.rawRows[0]?.origin_reference).toBe(CARD_LAST_FOUR);
    expect(after.rawRows[0]?.drill_down_data).toEqual(JSON.parse(CARD_BREAKDOWN));
    expect(after.transactions).toEqual(before.transactions);
    expect(after.charges).toEqual(before.charges);

    // the Phase 1 hint now resolves: linked to the hinted card's statement by REFERENCE
    const linked = await runAutomation();
    expect(linked).toHaveLength(1);
    expect(linked[0]).toMatchObject({
      bankTransactionId: before.transactions[0]?.id,
      method: 'REFERENCE',
    });
    const { rows: links } = await pool.query<{
      card_account_id: string;
      debit_date: string;
      link_method: string;
    }>(
      `SELECT card_account_id, debit_date::text AS debit_date, link_method
       FROM accounter_schema.creditcard_statement_links
       WHERE bank_transaction_id = $1`,
      [before.transactions[0]?.id],
    );
    expect(links).toEqual([
      { card_account_id: created.accountIds[1], debit_date: '2026-05-09', link_method: 'REFERENCE' },
    ]);
  });

  it('keeps the hinted row when a later scrape misses the hint, and re-uploads are no-ops', async () => {
    const upload = (row: OtsarHahayalIlsTransactionInput) =>
      createIngestionProvider().uploadOtsarHahayalIlsTransactions([row]);

    // the drill-down failed this time: no hint
    const withoutHint = await upload(cardDebitRow());
    expect(withoutHint).toMatchObject({ inserted: 0, skipped: 1 });
    // the same hinted row again
    const withHint = await upload(
      cardDebitRow({ originReference: CARD_LAST_FOUR, drillDownData: CARD_BREAKDOWN }),
    );
    expect(withHint).toMatchObject({ inserted: 0, skipped: 1, changedTransactions: [] });

    const state = await storedState();
    expect(state.rawRows).toHaveLength(1);
    expect(state.rawRows[0]?.origin_reference).toBe(CARD_LAST_FOUR);
    expect(state.transactions).toHaveLength(1);
    expect(state.charges).toHaveLength(1);
  });

  it('claims a stored row once: a second hinted row in the same upload is a new row', async () => {
    const otherReference = 4343;
    const first = await createIngestionProvider().uploadOtsarHahayalIlsTransactions([
      cardDebitRow({ reference: otherReference }),
    ]);
    expect(first.inserted).toBe(1);

    // two card debits that only their hints tell apart (scraped before as one row)
    const second = await createIngestionProvider().uploadOtsarHahayalIlsTransactions([
      cardDebitRow({ reference: otherReference, originReference: '1111' }),
      cardDebitRow({ reference: otherReference, originReference: '2222' }),
    ]);
    expect(second.inserted).toBe(1);

    const { rows } = await pool.query<{ origin_reference: string }>(
      `SELECT origin_reference
       FROM accounter_schema.otsar_hahayal_ils_account_transactions
       WHERE account_number = $1 AND reference = $2
       ORDER BY origin_reference`,
      [BANK_ACCOUNT_NUMBER, otherReference],
    );
    expect(rows.map(row => row.origin_reference)).toEqual(['1111', '2222']);
  });
});
