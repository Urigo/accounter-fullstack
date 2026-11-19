import { randomUUID } from 'node:crypto';
import type { Injector } from 'graphql-modules';
import type { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import {
  autoLinkCreditCardStatements,
  type AutoLinkedStatements,
} from '../../helpers/link-creditcard-statements.helper.js';
import { CreditCardStatementsProvider } from '../creditcard-statements.provider.js';
import { CreditCardTransactionsProvider } from '../creditcard-transactions.provider.js';

/**
 * The bank ⇄ card statement linkage against a real database: the read path (with its regression
 * oracle, the Poalim-only SQL it replaced) and the LINK_CREDITCARD_STATEMENTS automation, for three
 * bank × issuer pairs. All values are fake.
 */

let pool: Pool;

const OWNER_ID = '00000000-0000-4000-8000-00000000cc01';
const ISSUER_ID = '00000000-0000-4000-8000-00000000cc02';

const created = {
  chargeIds: [] as string[],
  rawListIds: [] as string[],
  otsarRawIds: [] as string[],
  accountIds: [] as string[],
};

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

/** One simulated request: fresh operation-scoped providers sharing one DB client. */
function createInjector(): Injector {
  const db = new TenantAwareDBClient(new DBProvider(pool), createAuthContextProvider(OWNER_ID));
  dbClients.push(db);
  const statements = new CreditCardStatementsProvider(db);
  const transactions = new CreditCardTransactionsProvider(statements);
  const providers = new Map<unknown, unknown>([
    [CreditCardStatementsProvider, statements],
    [CreditCardTransactionsProvider, transactions],
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

async function seedBusiness(id: string, name: string, ownerId: string | null) {
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
     VALUES ($1, $2, 'business', $3)
     ON CONFLICT (id) DO NOTHING`,
    [id, name, ownerId],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id, country)
     VALUES ($1, $2, 'ISR')
     ON CONFLICT (id) DO NOTHING`,
    [id, ownerId ?? id],
  );
}

async function createAccount(
  type: 'BANK_ACCOUNT' | 'CREDIT_CARD',
  accountNumber: string,
  accountName: string | null = null,
) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO accounter_schema.financial_accounts
       (id, account_number, account_name, private_business, owner, type, owner_id)
     VALUES ($1, $2, $3, 'BUSINESS', $4, $5, $4)`,
    [id, accountNumber, accountName, OWNER_ID, type],
  );
  created.accountIds.push(id);
  return id;
}

type TransactionSeed = {
  accountId: string;
  amount: string;
  eventDate: string;
  debitDate?: string | null;
  sourceReference?: string;
  sourceDescription?: string;
  sourceOrigin?: string;
  businessId?: string | null;
  chargeId?: string;
  /** Otsar Hahayal ILS raw row's origin_reference, to create the transaction from such a row */
  otsarOriginReference?: string;
};

/** A raw Otsar Hahayal ILS row, inserted with triggers off so it doesn't create its own transaction */
async function createOtsarRawRow(originReference: string): Promise<string> {
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL session_replication_role = replica');
    await client.query(
      `INSERT INTO accounter_schema.otsar_hahayal_ils_account_transactions (
         id, owner_id, account_number, account_type, branch_number, action_code, bfb_source,
         closing_balance, correspondent_account, correspondent_account_type, correspondent_bank,
         correspondent_branch, credit_amount, customer_name, date_of_business_day,
         date_of_registration, debit_amount, depositor_id, description, drill_down_url,
         first_transaction_of_day, last_transaction_of_day, name, opening_balance,
         operation_source, reference, salary_ind, transaction_source, transaction_reason,
         origin_reference
       )
       VALUES ($1, $2, 111, 0, 222, 0, '77', 0, 0, 0, 0, 0, 0, 'Test Customer', now(), now(),
         500, 0, 'Card breakdown', 'https://example.com', true, false, 'Test', 0, 'WEB',
         floor(random() * 1000000)::int, 0, 'BANK', 'Test', $3)`,
      [id, OWNER_ID, originReference],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  created.otsarRawIds.push(id);
  return id;
}

async function createTransaction(seed: TransactionSeed) {
  const chargeId = seed.chargeId ?? randomUUID();
  if (!seed.chargeId) {
    await pool.query(`INSERT INTO accounter_schema.charges (id, owner_id) VALUES ($1, $2)`, [
      chargeId,
      OWNER_ID,
    ]);
    created.chargeIds.push(chargeId);
  }

  const rawListId = randomUUID();
  if (seed.otsarOriginReference === undefined) {
    await pool.query(
      `INSERT INTO accounter_schema.transactions_raw_list (id, etana_id) VALUES ($1, $2)`,
      [rawListId, `cc-statements-test-${rawListId}`],
    );
  } else {
    const otsarRawId = await createOtsarRawRow(seed.otsarOriginReference);
    await pool.query(
      `INSERT INTO accounter_schema.transactions_raw_list (id, otsar_hahayal_ils_id) VALUES ($1, $2)`,
      [rawListId, otsarRawId],
    );
  }
  created.rawListIds.push(rawListId);

  const id = randomUUID();
  await pool.query(
    `INSERT INTO accounter_schema.transactions (
       id, account_id, charge_id, source_id, source_description, currency, event_date, debit_date,
       amount, current_balance, business_id, source_reference, source_origin, origin_key, owner_id
     )
     VALUES ($1, $2, $3, $4, $5, 'ILS', $6, $7, $8, 0, $9, $10, $11, $12, $13)`,
    [
      id,
      seed.accountId,
      chargeId,
      rawListId,
      seed.sourceDescription ?? 'Test transaction',
      seed.eventDate,
      seed.debitDate === undefined ? seed.eventDate : seed.debitDate,
      seed.amount,
      seed.businessId ?? null,
      seed.sourceReference ?? randomUUID().slice(0, 8),
      seed.sourceOrigin ?? 'TEST',
      `cc-statements-test-${id}`,
      OWNER_ID,
    ],
  );
  return { id, chargeId };
}

/** The Poalim-only SQL the read path replaced, kept verbatim as the regression oracle. */
async function oldCreditCardTransactionIds(chargeId: string): Promise<string[]> {
  const { rows } = await pool.query<{ id: string | null }>(
    `SELECT t.id
     FROM accounter_schema.transactions origin_transaction
       left join lateral (SELECT t.*,
           origin_transaction.id        as origin_transaction_id,
           origin_transaction.charge_id as origin_charge_id,
           a.type,
           a.account_number,
           a.account_name
         FROM accounter_schema.transactions t
         left join accounter_schema.financial_accounts a
           on a.id = t.account_id) t
         on (t.account_number = origin_transaction.source_reference
            OR (t.account_name IS NOT NULL AND t.account_name <> '' AND origin_transaction.source_description LIKE '%' || t.account_name || '%'))
            and t.type = 'CREDIT_CARD'
           and t.currency = origin_transaction.currency
           and COALESCE(t.debit_date_override, t.debit_date) = COALESCE(origin_transaction.debit_date_override, origin_transaction.debit_date)
     WHERE origin_transaction.charge_id in ($1)`,
    [chargeId],
  );
  return rows.map(row => row.id).filter((id): id is string => !!id);
}

async function collect(
  run: AsyncGenerator<AutoLinkedStatements, unknown, undefined>,
): Promise<AutoLinkedStatements[]> {
  const linked: AutoLinkedStatements[] = [];
  for await (const item of run) {
    linked.push(item);
  }
  return linked;
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  await seedBusiness(OWNER_ID, 'cc-statements-test-owner', null);
  await seedBusiness(ISSUER_ID, 'cc-statements-test-issuer', OWNER_ID);
});

afterEach(async () => {
  await Promise.all(dbClients.splice(0).map(client => client.dispose()));
});

afterAll(async () => {
  // links cascade with their bank transactions, side-table rows with their accounts
  await pool.query('DELETE FROM accounter_schema.transactions WHERE owner_id = $1', [OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.transactions_raw_list WHERE id = ANY($1)', [
    created.rawListIds,
  ]);
  await pool.query(
    'DELETE FROM accounter_schema.otsar_hahayal_ils_account_transactions WHERE id = ANY($1)',
    [created.otsarRawIds],
  );
  await pool.query('DELETE FROM accounter_schema.charges WHERE id = ANY($1)', [created.chargeIds]);
  await pool.query('DELETE FROM accounter_schema.financial_accounts WHERE id = ANY($1)', [
    created.accountIds,
  ]);
  for (const id of [ISSUER_ID, OWNER_ID]) {
    await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [id]);
    await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [id]);
  }
  // Do NOT close the shared pool here — it is shared with other concurrently-running suites.
});

describe('credit card statements', () => {
  const scenario = {} as {
    poalim: { bankChargeId: string; cardTransactionIds: string[] };
    otsar: { bankTransactionId: string; bankChargeId: string; cardAccountId: string };
    discount: { bankTransactionId: string; bankChargeId: string; cardAccountId: string };
  };

  beforeAll(async () => {
    // Poalim + Isracard: the bank row's reference is the card number
    const poalimAccount = await createAccount('BANK_ACCOUNT', '900001');
    const isracardAccount = await createAccount('CREDIT_CARD', '1357');
    const otherCard = await createAccount('CREDIT_CARD', '2468');
    const poalimDebit = await createTransaction({
      accountId: poalimAccount,
      amount: '-350.00',
      eventDate: '2026-02-10',
      sourceReference: '1357',
      sourceDescription: 'ISRACARD',
      sourceOrigin: 'POALIM',
      businessId: ISSUER_ID,
    });
    const card1 = await createTransaction({
      accountId: isracardAccount,
      amount: '-100.00',
      eventDate: '2026-01-15',
      debitDate: '2026-02-10',
    });
    const card2 = await createTransaction({
      accountId: isracardAccount,
      amount: '-250.00',
      eventDate: '2026-01-20',
      debitDate: '2026-02-10',
    });
    // the card's next cycle, and another card on the same day: neither belongs to the debit
    await createTransaction({
      accountId: isracardAccount,
      amount: '-75.00',
      eventDate: '2026-02-15',
      debitDate: '2026-03-10',
    });
    await createTransaction({
      accountId: otherCard,
      amount: '-350.00',
      eventDate: '2026-01-18',
      debitDate: '2026-02-10',
    });
    scenario.poalim = {
      bankChargeId: poalimDebit.chargeId,
      cardTransactionIds: [card1.id, card2.id],
    };

    // Otsar Hahayal ILS + Otsar card: masked PAN on the card side, last 4 in the raw bank row,
    // and a one-day shift between the issuer and bank dates
    const otsarAccount = await createAccount('BANK_ACCOUNT', '900002');
    const otsarCard = await createAccount('CREDIT_CARD', '123456xxxxxx4321');
    const otsarOtherCard = await createAccount('CREDIT_CARD', '123456xxxxxx8765');
    const otsarDebit = await createTransaction({
      accountId: otsarAccount,
      amount: '-500.00',
      eventDate: '2026-04-15',
      sourceReference: '7001',
      sourceDescription: 'Card charges',
      sourceOrigin: 'OTSAR_HAHAYAL',
      otsarOriginReference: '4321',
    });
    await createTransaction({
      accountId: otsarCard,
      amount: '-500.00',
      eventDate: '2026-03-20',
      debitDate: '2026-04-14',
    });
    await createTransaction({
      accountId: otsarOtherCard,
      amount: '-500.00',
      eventDate: '2026-03-21',
      debitDate: '2026-04-14',
    });
    scenario.otsar = {
      bankTransactionId: otsarDebit.id,
      bankChargeId: otsarDebit.chargeId,
      cardAccountId: otsarCard,
    };

    // Discount + Cal: a generic reference, the card's last 4 digits only in the description
    const discountAccount = await createAccount('BANK_ACCOUNT', '900003');
    const calCard = await createAccount('CREDIT_CARD', '9012');
    const calOtherCard = await createAccount('CREDIT_CARD', '3456');
    const discountDebit = await createTransaction({
      accountId: discountAccount,
      amount: '-42.50',
      eventDate: '2026-06-02',
      sourceReference: 'URN-0001',
      sourceDescription: 'CAL 9012 DEBIT',
      sourceOrigin: 'BANK_DISCOUNT',
      businessId: ISSUER_ID,
    });
    await createTransaction({
      accountId: calCard,
      amount: '-40.00',
      eventDate: '2026-05-10',
      debitDate: '2026-06-02',
    });
    await createTransaction({
      accountId: calCard,
      amount: '-2.50',
      eventDate: '2026-05-11',
      debitDate: '2026-06-02',
    });
    await createTransaction({
      accountId: calOtherCard,
      amount: '-42.50',
      eventDate: '2026-05-12',
      debitDate: '2026-06-02',
    });
    scenario.discount = {
      bankTransactionId: discountDebit.id,
      bankChargeId: discountDebit.chargeId,
      cardAccountId: calCard,
    };
  });

  it('returns the same card transactions as the Poalim-only SQL it replaced', async () => {
    const oracle = await oldCreditCardTransactionIds(scenario.poalim.bankChargeId);
    const provider = createInjector().get(CreditCardTransactionsProvider);
    const ids = await provider.getCreditCardTransactionIdsByChargeId(scenario.poalim.bankChargeId);

    expect(oracle.sort()).toEqual([...scenario.poalim.cardTransactionIds].sort());
    expect(ids.sort()).toEqual(oracle.sort());
    expect(await provider.isCreditCardAmountValid(scenario.poalim.bankChargeId)).toBe(true);
  });

  it('matches other bank × issuer pairs on read, unconfirmed, without writing', async () => {
    const provider = createInjector().get(CreditCardTransactionsProvider);
    const [otsar] = await provider.getStatementsByChargeIdLoader.load(scenario.otsar.bankChargeId);
    expect(otsar.statements).toEqual([
      {
        cardAccountId: scenario.otsar.cardAccountId,
        currency: 'ILS',
        debitDate: '2026-04-14',
        bankTransactionId: scenario.otsar.bankTransactionId,
        linkMethod: 'REFERENCE',
        confirmed: false,
      },
    ]);
    expect(await provider.isCreditCardAmountValid(scenario.otsar.bankChargeId)).toBe(true);
    // the old SQL found nothing here
    expect(await oldCreditCardTransactionIds(scenario.otsar.bankChargeId)).toEqual([]);

    const { rows } = await pool.query(
      'SELECT 1 FROM accounter_schema.creditcard_statement_links WHERE owner_id = $1',
      [OWNER_ID],
    );
    expect(rows).toHaveLength(0);
  });

  it('links Poalim+Isracard, Otsar and Discount+Cal debits, once', async () => {
    const linked = await collect(
      autoLinkCreditCardStatements(createInjector(), {
        ownerId: OWNER_ID,
        creditCardBusinessIds: [ISSUER_ID],
      }),
    );

    expect(
      linked
        .map(({ bankTransactionId, method, statements }) => ({
          bankTransactionId,
          method,
          statements: statements.map(s => `${s.cardAccountId}@${s.debitDate}`),
        }))
        .filter(
          ({ bankTransactionId }) =>
            bankTransactionId === scenario.otsar.bankTransactionId ||
            bankTransactionId === scenario.discount.bankTransactionId,
        ),
    ).toEqual([
      {
        bankTransactionId: scenario.otsar.bankTransactionId,
        method: 'REFERENCE',
        statements: [`${scenario.otsar.cardAccountId}@2026-04-14`],
      },
      {
        bankTransactionId: scenario.discount.bankTransactionId,
        method: 'REFERENCE',
        statements: [`${scenario.discount.cardAccountId}@2026-06-02`],
      },
    ]);
    expect(linked).toHaveLength(3);

    const { rows } = await pool.query<{ link_method: string }>(
      'SELECT link_method FROM accounter_schema.creditcard_statement_links WHERE owner_id = $1',
      [OWNER_ID],
    );
    expect(rows.map(row => row.link_method)).toEqual(['REFERENCE', 'REFERENCE', 'REFERENCE']);

    // the read path now serves the stored links, confirmed
    const provider = createInjector().get(CreditCardTransactionsProvider);
    for (const chargeId of [
      scenario.poalim.bankChargeId,
      scenario.otsar.bankChargeId,
      scenario.discount.bankChargeId,
    ]) {
      const [bank] = await provider.getStatementsByChargeIdLoader.load(chargeId);
      expect(bank.statements.every(statement => statement.confirmed)).toBe(true);
      expect(await provider.isCreditCardAmountValid(chargeId)).toBe(true);
    }
    const ids = await provider.getCreditCardTransactionIdsByChargeId(scenario.poalim.bankChargeId);
    expect(ids.sort()).toEqual([...scenario.poalim.cardTransactionIds].sort());

    // a second run finds nothing left to link
    const again = await collect(
      autoLinkCreditCardStatements(createInjector(), {
        ownerId: OWNER_ID,
        creditCardBusinessIds: [ISSUER_ID],
      }),
    );
    expect(again).toEqual([]);
  });

  it('refuses to link a statement already settled by another bank transaction', async () => {
    const statements = createInjector().get(CreditCardStatementsProvider);
    await expect(
      statements.insertLinks([
        {
          ownerId: OWNER_ID,
          bankTransactionId: scenario.discount.bankTransactionId,
          cardAccountId: scenario.otsar.cardAccountId,
          currency: 'ILS',
          debitDate: '2026-04-14',
          linkMethod: 'MANUAL',
        },
      ]),
    ).rejects.toThrow('already linked to another bank transaction');
  });

  it('unlinks a statement, leaving the debit to be matched on read again', async () => {
    const injector = createInjector();
    const deleted = await injector.get(CreditCardStatementsProvider).deleteLink({
      ownerId: OWNER_ID,
      bankTransactionId: scenario.discount.bankTransactionId,
      cardAccountId: scenario.discount.cardAccountId,
      currency: 'ILS',
      debitDate: '2026-06-02',
    });
    expect(deleted).toHaveLength(1);

    const [bank] = await injector
      .get(CreditCardTransactionsProvider)
      .getStatementsByChargeIdLoader.load(scenario.discount.bankChargeId);
    expect(bank.statements).toMatchObject([{ confirmed: false, linkMethod: 'REFERENCE' }]);
  });
});
