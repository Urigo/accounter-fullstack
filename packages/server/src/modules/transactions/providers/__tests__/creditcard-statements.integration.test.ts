import { randomUUID } from 'node:crypto';
import type { Injector } from 'graphql-modules';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { FinancialCreditCardAccountsProvider } from '../../../financial-accounts/providers/financial-credit-card-accounts.provider.js';
import {
  autoLinkCreditCardStatements,
  type AutoLinkedStatements,
} from '../../helpers/link-creditcard-statements.helper.js';
import { CreditCardTransactionsResolvers } from '../../resolvers/creditcard-transactions.resolver.js';
import { CreditCardStatementsProvider } from '../creditcard-statements.provider.js';
import { CreditCardTransactionsProvider } from '../creditcard-transactions.provider.js';

vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));

/**
 * The bank ⇄ card statement linkage against a real database: the read path (with its regression
 * oracle, the Poalim-only SQL it replaced), the LINK_CREDITCARD_STATEMENTS automation for four
 * bank × issuer pairs, and the link / unlink mutations. All values are fake.
 */

let pool: Pool;

const OWNER_ID = '00000000-0000-4000-8000-00000000cc01';
const ISSUER_ID = '00000000-0000-4000-8000-00000000cc02';
const OTHER_OWNER_ID = '00000000-0000-4000-8000-00000000cc03';

const created = {
  chargeIds: [] as string[],
  rawListIds: [] as string[],
  otsarRawIds: [] as string[],
  poalimRawIds: [] as string[],
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
function createInjector(ownerId = OWNER_ID): Injector {
  const db = new TenantAwareDBClient(new DBProvider(pool), createAuthContextProvider(ownerId));
  dbClients.push(db);
  const adminContext = {
    getVerifiedAdminContext: async () => ({ ownerId }),
    adminContextByOwnerIdLoader: {
      load: async (id: string) =>
        id === OWNER_ID ? { financialAccounts: { creditCardIds: [ISSUER_ID] } } : null,
    },
  } as unknown as AdminContextProvider;
  const statements = new CreditCardStatementsProvider(db, adminContext);
  const transactions = new CreditCardTransactionsProvider(statements);
  const providers = new Map<unknown, unknown>([
    [AdminContextProvider, adminContext],
    [CreditCardStatementsProvider, statements],
    [CreditCardTransactionsProvider, transactions],
    [FinancialCreditCardAccountsProvider, new FinancialCreditCardAccountsProvider(db)],
    [ChargesProvider, { getChargeByIdLoader: { load: async (id: string) => ({ id }) } }],
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
  ownerId = OWNER_ID,
) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO accounter_schema.financial_accounts
       (id, account_number, account_name, private_business, owner, type, owner_id)
     VALUES ($1, $2, $3, 'BUSINESS', $4, $5, $4)`,
    [id, accountNumber, accountName, ownerId, type],
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
  /** Poalim ILS raw card-debit row (activity 491) reference, to create the transaction from one */
  poalim491Reference?: number;
  isFee?: boolean;
  ownerId?: string;
};

/** Runs inserts with triggers off, so a raw row doesn't create its own transaction */
async function withoutTriggers(fn: (client: PoolClient) => Promise<void>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL session_replication_role = replica');
    await fn(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createOtsarRawRow(originReference: string): Promise<string> {
  const id = randomUUID();
  await withoutTriggers(client =>
    client
      .query(
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
      )
      .then(() => undefined),
  );
  created.otsarRawIds.push(id);
  return id;
}

async function createPoalim491RawRow(referenceNumber: number): Promise<string> {
  const id = randomUUID();
  await withoutTriggers(client =>
    client
      .query(
        `INSERT INTO accounter_schema.poalim_ils_account_transactions (
           id, event_date, formatted_event_date, serial_number, activity_type_code,
           activity_description, text_code, reference_number, reference_catenated_number,
           value_date, formatted_value_date, event_amount, event_activity_type_code,
           current_balance, internal_link_code, original_event_create_date, transaction_type,
           data_group_code, expanded_event_date, executing_branch_number, event_id,
           different_date_indication, table_number, record_number, contra_bank_number,
           contra_branch_number, contra_account_number, contra_account_type_code,
           marketing_offer_context, comment_existence_switch, field_desc_display_switch,
           bank_number, branch_number, account_number
         )
         VALUES ($1, '2026-02-10', '20260210', 1, 491, 'CARD', 0, $2, 0, '2026-02-10',
           '20260210', 350, 2, 0, 0, 0, 'REGULAR', 0, 20260210, 0,
           floor(random() * 1000000000)::bigint, '', 0, 0, 0, 0, 0, 0, B'0', B'0', B'0',
           12, 345, 900001)`,
        [id, referenceNumber],
      )
      .then(() => undefined),
  );
  created.poalimRawIds.push(id);
  return id;
}

async function createTransaction(seed: TransactionSeed) {
  const ownerId = seed.ownerId ?? OWNER_ID;
  const chargeId = seed.chargeId ?? randomUUID();
  if (!seed.chargeId) {
    await pool.query(`INSERT INTO accounter_schema.charges (id, owner_id) VALUES ($1, $2)`, [
      chargeId,
      ownerId,
    ]);
    created.chargeIds.push(chargeId);
  }

  const rawListId = randomUUID();
  if (seed.otsarOriginReference !== undefined) {
    const otsarRawId = await createOtsarRawRow(seed.otsarOriginReference);
    await pool.query(
      `INSERT INTO accounter_schema.transactions_raw_list (id, otsar_hahayal_ils_id) VALUES ($1, $2)`,
      [rawListId, otsarRawId],
    );
  } else if (seed.poalim491Reference !== undefined) {
    const poalimRawId = await createPoalim491RawRow(seed.poalim491Reference);
    await pool.query(
      `INSERT INTO accounter_schema.transactions_raw_list (id, poalim_ils_id) VALUES ($1, $2)`,
      [rawListId, poalimRawId],
    );
  } else {
    await pool.query(
      `INSERT INTO accounter_schema.transactions_raw_list (id, etana_id) VALUES ($1, $2)`,
      [rawListId, `cc-statements-test-${rawListId}`],
    );
  }
  created.rawListIds.push(rawListId);

  const id = randomUUID();
  await pool.query(
    `INSERT INTO accounter_schema.transactions (
       id, account_id, charge_id, source_id, source_description, currency, event_date, debit_date,
       amount, current_balance, business_id, source_reference, source_origin, origin_key, owner_id,
       is_fee
     )
     VALUES ($1, $2, $3, $4, $5, 'ILS', $6, $7, $8, 0, $9, $10, $11, $12, $13, $14)`,
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
      ownerId,
      seed.isFee ?? false,
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
  await seedBusiness(OTHER_OWNER_ID, 'cc-statements-test-other-owner', null);
});

beforeEach(() => {
  vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
});

afterEach(async () => {
  await Promise.all(dbClients.splice(0).map(client => client.dispose()));
});

afterAll(async () => {
  // links cascade with their bank transactions, side-table rows with their accounts
  await pool.query('DELETE FROM accounter_schema.transactions WHERE owner_id = ANY($1)', [
    [OWNER_ID, OTHER_OWNER_ID],
  ]);
  await pool.query('DELETE FROM accounter_schema.transactions_raw_list WHERE id = ANY($1)', [
    created.rawListIds,
  ]);
  await pool.query(
    'DELETE FROM accounter_schema.otsar_hahayal_ils_account_transactions WHERE id = ANY($1)',
    [created.otsarRawIds],
  );
  await pool.query('DELETE FROM accounter_schema.poalim_ils_account_transactions WHERE id = ANY($1)', [
    created.poalimRawIds,
  ]);
  await pool.query('DELETE FROM accounter_schema.charges WHERE id = ANY($1)', [created.chargeIds]);
  await pool.query('DELETE FROM accounter_schema.financial_accounts WHERE id = ANY($1)', [
    created.accountIds,
  ]);
  for (const id of [ISSUER_ID, OWNER_ID, OTHER_OWNER_ID]) {
    await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [id]);
    await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [id]);
  }
  // Do NOT close the shared pool here — it is shared with other concurrently-running suites.
});

type MutationResult =
  | { __typename: 'CommonError'; message: string }
  | { charge: { id: string } };

async function callMutation(
  name: 'linkCreditCardStatements' | 'unlinkCreditCardStatement',
  args: Record<string, unknown>,
  injector = createInjector(),
): Promise<MutationResult> {
  const resolver = CreditCardTransactionsResolvers.Mutation![name] as unknown as (
    parent: unknown,
    args: unknown,
    context: unknown,
    info: unknown,
  ) => Promise<MutationResult>;
  return resolver({}, args, { injector }, {});
}

function errorOf(result: MutationResult): string | null {
  return '__typename' in result && result.__typename === 'CommonError' ? result.message : null;
}

async function linksOf(bankTransactionId: string) {
  const { rows } = await pool.query<{ card_account_id: string; link_method: string }>(
    `SELECT card_account_id, link_method
     FROM accounter_schema.creditcard_statement_links
     WHERE bank_transaction_id = $1`,
    [bankTransactionId],
  );
  return rows;
}

async function runAutomation() {
  return collect(
    autoLinkCreditCardStatements(createInjector(), {
      ownerId: OWNER_ID,
      creditCardBusinessIds: [ISSUER_ID],
    }),
  );
}

describe('credit card statements', () => {
  type Pair = { bankTransactionId: string; bankChargeId: string; cardAccountId: string };
  const scenario = {} as {
    poalim: Pair & { cardTransactionIds: string[] };
    otsar: Pair;
    discount: Pair;
    max: Pair;
  };

  beforeAll(async () => {
    // Poalim + Isracard: a card-debit row (activity 491) whose reference is the card number
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
      poalim491Reference: 1357,
    });
    // a bank fee in the same charge is not a card debit
    await createTransaction({
      accountId: poalimAccount,
      amount: '-5.00',
      eventDate: '2026-02-10',
      sourceDescription: 'FEE',
      chargeId: poalimDebit.chargeId,
      isFee: true,
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
      bankTransactionId: poalimDebit.id,
      bankChargeId: poalimDebit.chargeId,
      cardAccountId: isracardAccount,
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

    // Discount + Max: no issuer counterparty on the bank row, only the last 4 in the description
    const maxCard = await createAccount('CREDIT_CARD', '7788');
    const maxDebit = await createTransaction({
      accountId: discountAccount,
      amount: '-61.00',
      eventDate: '2026-08-03',
      sourceReference: 'URN-0002',
      sourceDescription: 'MAX 7788',
      sourceOrigin: 'BANK_DISCOUNT',
    });
    await createTransaction({
      accountId: maxCard,
      amount: '-61.00',
      eventDate: '2026-07-10',
      debitDate: '2026-08-03',
    });
    scenario.max = {
      bankTransactionId: maxDebit.id,
      bankChargeId: maxDebit.chargeId,
      cardAccountId: maxCard,
    };
  });

  it('returns the same card transactions as the Poalim-only SQL it replaced', async () => {
    const oracle = await oldCreditCardTransactionIds(scenario.poalim.bankChargeId);
    const provider = createInjector().get(CreditCardTransactionsProvider);
    const ids = await provider.getCreditCardTransactionIdsByChargeId(scenario.poalim.bankChargeId);

    expect(oracle.sort()).toEqual([...scenario.poalim.cardTransactionIds].sort());
    expect(ids.sort()).toEqual(oracle.sort());
    // the fee row in the same charge does not count as a debit
    expect(await provider.isCreditCardAmountValid(scenario.poalim.bankChargeId)).toBe(true);
    const perBank = await provider.getStatementsByChargeIdLoader.load(scenario.poalim.bankChargeId);
    expect(perBank.map(({ bankTransaction }) => bankTransaction.id)).toEqual([
      scenario.poalim.bankTransactionId,
    ]);
  });

  it('reads the Poalim 491 raw row as a card hint', async () => {
    const hints = await createInjector()
      .get(CreditCardStatementsProvider)
      .getBankCardHintsByTransactionIdLoader.load(scenario.poalim.bankTransactionId);
    expect(hints).toEqual([
      { transactionId: scenario.poalim.bankTransactionId, source: 'POALIM_491', hint: '1357' },
    ]);
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
    // the other card with the same amount is offered as an alternative
    expect(otsar.suggestions.map(s => s.statements.map(st => st.cardAccountId))).toHaveLength(1);
    expect(await provider.isCreditCardAmountValid(scenario.otsar.bankChargeId)).toBe(true);
    // the old SQL found nothing here
    expect(await oldCreditCardTransactionIds(scenario.otsar.bankChargeId)).toEqual([]);

    const { rows } = await pool.query(
      'SELECT 1 FROM accounter_schema.creditcard_statement_links WHERE owner_id = $1',
      [OWNER_ID],
    );
    expect(rows).toHaveLength(0);
  });

  it('links Poalim+Isracard, Otsar, Discount+Cal and Discount+Max debits, once', async () => {
    const linked = await runAutomation();

    expect(
      linked
        .map(({ bankTransactionId, method, statements }) => ({
          bankTransactionId,
          method,
          statements: statements.map(s => `${s.cardAccountId}@${s.debitDate}`),
        }))
        .sort((a, b) => a.statements[0].localeCompare(b.statements[0])),
    ).toEqual(
      [
        {
          bankTransactionId: scenario.poalim.bankTransactionId,
          method: 'REFERENCE',
          statements: [`${scenario.poalim.cardAccountId}@2026-02-10`],
        },
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
        {
          bankTransactionId: scenario.max.bankTransactionId,
          method: 'REFERENCE',
          statements: [`${scenario.max.cardAccountId}@2026-08-03`],
        },
      ].sort((a, b) => a.statements[0].localeCompare(b.statements[0])),
    );

    // the read path now serves the stored links, confirmed
    const provider = createInjector().get(CreditCardTransactionsProvider);
    for (const pair of [scenario.poalim, scenario.otsar, scenario.discount, scenario.max]) {
      const [bank] = await provider.getStatementsByChargeIdLoader.load(pair.bankChargeId);
      expect(bank.statements.every(statement => statement.confirmed)).toBe(true);
      expect(await provider.isCreditCardAmountValid(pair.bankChargeId)).toBe(true);
    }
    const ids = await provider.getCreditCardTransactionIdsByChargeId(scenario.poalim.bankChargeId);
    expect(ids.sort()).toEqual([...scenario.poalim.cardTransactionIds].sort());

    // a second run finds nothing left to link
    expect(await runAutomation()).toEqual([]);
  });

  describe('link and unlink mutations', () => {
    it("refuses another owner's bank transaction", async () => {
      const otherBank = await createAccount('BANK_ACCOUNT', '900009', null, OTHER_OWNER_ID);
      const otherDebit = await createTransaction({
        accountId: otherBank,
        amount: '-10.00',
        eventDate: '2026-08-01',
        ownerId: OTHER_OWNER_ID,
      });
      const result = await callMutation('linkCreditCardStatements', {
        bankTransactionId: otherDebit.id,
        statements: [{ cardAccountId: scenario.max.cardAccountId, currency: 'ILS', debitDate: '2026-08-03' }],
      });
      expect(errorOf(result)).toMatch(/not found/);
    });

    it("refuses another owner's card account", async () => {
      const otherCard = await createAccount('CREDIT_CARD', '5555', null, OTHER_OWNER_ID);
      const result = await callMutation('linkCreditCardStatements', {
        bankTransactionId: scenario.max.bankTransactionId,
        statements: [{ cardAccountId: otherCard, currency: 'ILS', debitDate: '2026-08-03' }],
      });
      expect(errorOf(result)).toMatch(/Card account .* not found/);
    });

    it('refuses a non-card account as the statement, and a card row as the bank debit', async () => {
      const bankAccount = await createAccount('BANK_ACCOUNT', '900010');
      expect(
        errorOf(
          await callMutation('linkCreditCardStatements', {
            bankTransactionId: scenario.max.bankTransactionId,
            statements: [{ cardAccountId: bankAccount, currency: 'ILS', debitDate: '2026-08-03' }],
          }),
        ),
      ).toMatch(/not a credit card account/);
      expect(
        errorOf(
          await callMutation('linkCreditCardStatements', {
            bankTransactionId: scenario.poalim.cardTransactionIds[0],
            statements: [
              { cardAccountId: scenario.max.cardAccountId, currency: 'ILS', debitDate: '2026-08-03' },
            ],
          }),
        ),
      ).toMatch(/cannot settle/);
    });

    it('refuses a statement already settled by another bank transaction', async () => {
      const result = await callMutation('linkCreditCardStatements', {
        bankTransactionId: scenario.discount.bankTransactionId,
        statements: [
          { cardAccountId: scenario.otsar.cardAccountId, currency: 'ILS', debitDate: '2026-04-14' },
        ],
      });
      expect(errorOf(result)).toMatch(/already linked to another bank transaction/);
      expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
    });

    it('unlinks for good: neither the read path nor the automation brings it back', async () => {
      const statement = {
        cardAccountId: scenario.max.cardAccountId,
        currency: 'ILS',
        debitDate: '2026-08-03',
      };
      const result = await callMutation('unlinkCreditCardStatement', {
        bankTransactionId: scenario.max.bankTransactionId,
        statement,
      });
      expect(errorOf(result)).toBeNull();
      expect(result).toEqual({ charge: { id: scenario.max.bankChargeId } });
      expect(degradeChargesAccountantApproval).toHaveBeenCalledWith(expect.anything(), [
        scenario.max.bankChargeId,
      ]);
      expect(await linksOf(scenario.max.bankTransactionId)).toEqual([]);

      const [bank] = await createInjector()
        .get(CreditCardTransactionsProvider)
        .getStatementsByChargeIdLoader.load(scenario.max.bankChargeId);
      expect(bank.statements).toEqual([]);
      expect(bank.suggestions).toEqual([]);

      expect(await runAutomation()).toEqual([]);
      expect(await linksOf(scenario.max.bankTransactionId)).toEqual([]);

      // linking it again by hand clears the rejection and stores a MANUAL link
      const relink = await callMutation('linkCreditCardStatements', {
        bankTransactionId: scenario.max.bankTransactionId,
        statements: [statement],
      });
      expect(errorOf(relink)).toBeNull();
      expect(degradeChargesAccountantApproval).toHaveBeenLastCalledWith(expect.anything(), [
        scenario.max.bankChargeId,
      ]);
      expect(await linksOf(scenario.max.bankTransactionId)).toEqual([
        { card_account_id: scenario.max.cardAccountId, link_method: 'MANUAL' },
      ]);
      const { rows } = await pool.query(
        `SELECT 1 FROM accounter_schema.creditcard_statement_link_rejections
         WHERE bank_transaction_id = $1`,
        [scenario.max.bankTransactionId],
      );
      expect(rows).toHaveLength(0);
    });
  });
});
