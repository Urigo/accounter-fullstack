import { createPool, sql, type DatabasePool } from 'slonik';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import z from 'zod';
import legacyLinks, {
  CREDITCARD_LEGACY_LINKS_TABLES,
} from '../actions/2026-11-19T13-00-00.creditcard-legacy-links.js';
import { createConnectionString } from '../connection-string.js';
import { env } from '../environment.js';
import { assertLocalDatabase } from '../local-db-guard.js';
import { runMigrations } from '../pg-migrator.js';
import { MIGRATIONS } from '../run-pg-migrations.js';

/** Every table the migration lifts FORCE RLS on, and must restore it on */
const RLS_TABLES = [
  'businesses_securities',
  'creditcard_statement_links',
  'documents',
  'financial_accounts',
  'transactions',
  'user_context',
];

const TEST_DB_NAME = `accounter_migration_test_cc_legacy_links_${Date.now()}`;

/** The migration before the one under test: rows are seeded into the schema it leaves. */
const PREVIOUS_MIGRATION = MIGRATIONS[MIGRATIONS.indexOf(legacyLinks) - 1]!.name;

/**
 * Runs the migration as a role without superuser or BYPASSRLS that owns the tables through
 * membership, the way a managed database's owner role runs it: FORCE RLS applies to it.
 */
const MIGRATOR_ROLE = `cc_legacy_links_migrator_${Date.now()}`;

// The card account ids the deleted ledger fallback pointed at; everything else is fake
const CARD_9200 = '6fed9073-f571-402e-9da0-ac0669f658d2';
const CARD_2260 = '0e86514c-9ddb-4c82-b731-6107f7293b1f';
const CARD_4333 = '782070ce-ec7e-4be0-ab69-46c89528bf04';

const OWNER_ID = '00000000-0000-4000-8000-00000000c101';
const OTHER_OWNER_ID = '00000000-0000-4000-8000-00000000c102';
const BANK_ACCOUNT = '00000000-0000-4000-8000-00000000c111';
const OTHER_BANK_ACCOUNT = '00000000-0000-4000-8000-00000000c112';
const ACCOUNT_11200 = '00000000-0000-4000-8000-00000000c113';
const LINKED_ELSEWHERE_CARD = '00000000-0000-4000-8000-00000000c114';
/** The owner's card issuer business: one of its wallets */
const ISSUER_ID = '00000000-0000-4000-8000-00000000c121';
const SUPPLIER_ID = '00000000-0000-4000-8000-00000000c122';
const INVOICED_CHARGE_ID = '00000000-0000-4000-8000-00000000c131';
const PROFORMA_CHARGE_ID = '00000000-0000-4000-8000-00000000c132';

let sequence = 0;
function nextId() {
  sequence++;
  return `00000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`;
}

type Row = {
  id: string;
  accountId: string;
  reference: string;
  description?: string;
  date: string;
  amount?: string;
  currency?: 'ILS' | 'USD';
  isFee?: boolean;
  ownerId?: string;
  /** Defaults to the issuer for bank debits */
  businessId?: string | null;
  chargeId?: string;
};

function row(input: Omit<Row, 'id'>): Row {
  return { id: nextId(), ...input };
}

// Bank debits, by what the migration must do with them
const debits = {
  // linked to the closest statement of the card
  ref8547: row({ accountId: BANK_ACCOUNT, reference: '8547', date: '2026-01-10' }),
  // the next debit of the same card: the closest statement is taken, so it gets the next one
  ref8547Next: row({ accountId: BANK_ACCOUNT, reference: '8547', date: '2026-01-12' }),
  ref13795Card2260: row({
    accountId: BANK_ACCOUNT,
    reference: '13795',
    description: 'CARD 2260 DEBIT',
    date: '2026-02-03',
  }),
  // no statement in the window: the debit's own date
  ref13795Card4333: row({
    accountId: BANK_ACCOUNT,
    reference: '13795',
    description: 'CARD 4333 DEBIT',
    date: '2026-02-20',
  }),
  ref22200Mastercard: row({
    accountId: BANK_ACCOUNT,
    reference: '22200',
    description: 'חיוב מסטרקארד',
    date: '2026-03-01',
  }),
  // another currency's statements don't count
  ref8547Usd: row({ accountId: BANK_ACCOUNT, reference: '8547', date: '2026-01-11', currency: 'USD' }),
  // skipped:
  ref13795NoCard: row({ accountId: BANK_ACCOUNT, reference: '13795', description: 'CARD', date: '2026-02-03' }),
  ref22200NoMastercard: row({ accountId: BANK_ACCOUNT, reference: '22200', description: 'OTHER', date: '2026-03-01' }),
  ref11200ByReference: row({
    accountId: BANK_ACCOUNT,
    reference: '11200',
    description: 'כ.א.ל',
    date: '2026-03-05',
  }),
  fee: row({ accountId: BANK_ACCOUNT, reference: '8547', date: '2026-01-10', isFee: true }),
  onCardAccount: row({ accountId: CARD_2260, reference: '8547', date: '2026-01-10' }),
  otherOwner: row({
    accountId: OTHER_BANK_ACCOUNT,
    reference: '8547',
    date: '2026-01-10',
    ownerId: OTHER_OWNER_ID,
  }),
  alreadyLinked: row({ accountId: BANK_ACCOUNT, reference: '8547', date: '2026-04-01' }),
  // the fallback only served debits counted against a wallet business
  nonWallet: row({
    accountId: BANK_ACCOUNT,
    reference: '8547',
    date: '2026-05-10',
    businessId: SUPPLIER_ID,
  }),
  // nor charges booked from their documents
  invoiced: row({
    accountId: BANK_ACCOUNT,
    reference: '8547',
    date: '2026-05-20',
    chargeId: INVOICED_CHARGE_ID,
  }),
  // a proforma is not a relevant document
  withProforma: row({
    accountId: BANK_ACCOUNT,
    reference: '8547',
    date: '2026-06-01',
    chargeId: PROFORMA_CHARGE_ID,
  }),
  // two debits falling back to the same statement key: the later one is left unlinked
  collisionFirst: row({ accountId: BANK_ACCOUNT, reference: '8547', date: '2026-07-01' }),
  collisionSecond: row({ accountId: BANK_ACCOUNT, reference: '8547', date: '2026-07-01' }),
};

// Card rows, making up statements (card account, currency, debit date)
const cardRow = (accountId: string, date: string, amount: string) =>
  row({ accountId, reference: 'card', date, amount, businessId: null });
const cardRows = [
  cardRow(CARD_9200, '2026-01-11', '-10'),
  cardRow(CARD_9200, '2026-01-13', '-20'),
  cardRow(CARD_9200, '2026-01-16', '-30'),
  cardRow(CARD_2260, '2026-02-01', '-40'),
  cardRow(CARD_2260, '2026-02-01', '-41'),
  cardRow(CARD_4333, '2026-03-03', '-50'),
];

describe('credit card legacy links migration', () => {
  let rootPool: DatabasePool;
  let testPool: DatabasePool;
  /** What the migration printed with `console.warn` */
  const warnings: string[] = [];

  beforeAll(async () => {
    assertLocalDatabase({ ...env.postgres }, 'the credit card legacy links migration suite');

    rootPool = await createPool(createConnectionString({ ...env.postgres, db: 'postgres' }), {
      statementTimeout: 5000,
    });
    await rootPool.query(sql.unsafe`CREATE DATABASE ${sql.identifier([TEST_DB_NAME])}`);
    testPool = await createPool(createConnectionString({ ...env.postgres, db: TEST_DB_NAME }), {
      statementTimeout: 60_000,
    });

    await runMigrations({ slonik: testPool, migrations: [...MIGRATIONS], runTo: PREVIOUS_MIGRATION });

    await testPool.transaction(async connection => {
      // Skips FKs and triggers: no charges or raw rows needed
      await connection.query(sql.unsafe`SET LOCAL session_replication_role = replica`);
      for (const ownerId of [OWNER_ID, OTHER_OWNER_ID]) {
        await connection.query(sql.unsafe`
          INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
          VALUES (${ownerId}, 'Test owner', 'business', NULL)
        `);
        await connection.query(sql.unsafe`
          INSERT INTO accounter_schema.businesses (id, owner_id) VALUES (${ownerId}, ${ownerId})
        `);
      }
      const accounts: [string, string, 'BANK_ACCOUNT' | 'CREDIT_CARD', string][] = [
        [BANK_ACCOUNT, '900001', 'BANK_ACCOUNT', OWNER_ID],
        [OTHER_BANK_ACCOUNT, '900002', 'BANK_ACCOUNT', OTHER_OWNER_ID],
        [CARD_9200, '9200', 'CREDIT_CARD', OWNER_ID],
        [CARD_2260, '2260', 'CREDIT_CARD', OWNER_ID],
        [CARD_4333, '4333', 'CREDIT_CARD', OWNER_ID],
        // the reference lookup resolves '11200' for this owner, so the fallback never applied
        [ACCOUNT_11200, '11200', 'BANK_ACCOUNT', OWNER_ID],
        [LINKED_ELSEWHERE_CARD, '5555', 'CREDIT_CARD', OWNER_ID],
      ];
      for (const [id, accountNumber, type, ownerId] of accounts) {
        await connection.query(sql.unsafe`
          INSERT INTO accounter_schema.financial_accounts (id, account_number, type, owner, owner_id)
          VALUES (${id}, ${accountNumber}, ${type}, ${ownerId}, ${ownerId})
        `);
      }
      for (const seed of [...Object.values(debits), ...cardRows]) {
        await connection.query(sql.unsafe`
          INSERT INTO accounter_schema.transactions (
            id, account_id, charge_id, source_id, source_description, currency, event_date,
            debit_date, amount, current_balance, source_reference, source_origin, origin_key,
            owner_id, is_fee, business_id
          ) VALUES (
            ${seed.id}, ${seed.accountId}, ${seed.chargeId ?? nextId()}, ${nextId()},
            ${seed.description ?? 'TEST'},
            ${seed.currency ?? 'ILS'}, ${seed.date}, ${seed.date}, ${seed.amount ?? '-100'}, 0,
            ${seed.reference}, 'TEST', ${seed.id}, ${seed.ownerId ?? OWNER_ID},
            ${seed.isFee ?? false}, ${seed.businessId === undefined ? ISSUER_ID : seed.businessId}
          )
        `);
      }
      // the issuer is one of the owner's wallets; the other required columns get a filler id
      const requiredColumns = await connection.anyFirst(
        sql.type(z.object({ column_name: z.string() }))`
          SELECT column_name::text
          FROM information_schema.columns
          WHERE table_schema = 'accounter_schema'
            AND table_name = 'user_context'
            AND is_nullable = 'NO'
            AND column_default IS NULL
            AND data_type = 'uuid'
            AND column_name <> 'owner_id'
        `,
      );
      for (const ownerId of [OWNER_ID, OTHER_OWNER_ID]) {
        await connection.query(sql.unsafe`
          INSERT INTO accounter_schema.user_context (
            owner_id, isracard_business_id, ${sql.join(
              requiredColumns.map(column => sql.identifier([column])),
              sql.fragment`, `,
            )}
          ) VALUES (
            ${ownerId}, ${ISSUER_ID}, ${sql.join(
              requiredColumns.map(() => sql.fragment`${nextId()}`),
              sql.fragment`, `,
            )}
          )
        `);
      }
      for (const [chargeId, type] of [
        [INVOICED_CHARGE_ID, 'INVOICE'],
        [PROFORMA_CHARGE_ID, 'PROFORMA'],
      ] as const) {
        await connection.query(sql.unsafe`
          INSERT INTO accounter_schema.documents (charge_id, type, owner_id)
          VALUES (${chargeId}, ${type}, ${OWNER_ID})
        `);
      }
      await connection.query(sql.unsafe`
        INSERT INTO accounter_schema.creditcard_statement_links (
          owner_id, bank_transaction_id, card_account_id, currency, debit_date, link_method
        ) VALUES (
          ${OWNER_ID}, ${debits.alreadyLinked.id}, ${LINKED_ELSEWHERE_CARD}, 'ILS', '2026-04-01',
          'MANUAL'
        )
      `);

      await connection.query(sql.unsafe`
        CREATE ROLE ${sql.identifier([MIGRATOR_ROLE])} NOSUPERUSER NOBYPASSRLS INHERIT
      `);
      await connection.query(sql.unsafe`
        GRANT ${sql.identifier([env.postgres.user])} TO ${sql.identifier([MIGRATOR_ROLE])}
      `);
    });

    // the role is subject to FORCE RLS: with no tenant session, it can't read the transactions
    await expect(
      testPool.transaction(async connection => {
        await connection.query(sql.unsafe`SET LOCAL ROLE ${sql.identifier([MIGRATOR_ROLE])}`);
        await connection.query(sql.unsafe`SELECT 1 FROM accounter_schema.transactions LIMIT 1`);
      }),
    ).rejects.toThrow(/No business context set/);

    await testPool.transaction(async connection => {
      await connection.query(sql.unsafe`SET LOCAL ROLE ${sql.identifier([MIGRATOR_ROLE])}`);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        // the migration runs its own queries and returns nothing to run
        await legacyLinks.run({ sql: sql.unsafe, connection });
      } finally {
        warnings.push(...warn.mock.calls.map(args => args.map(String).join(' ')));
        warn.mockRestore();
      }
    });
  }, 180_000);

  afterAll(async () => {
    if (testPool) {
      await testPool.end();
    }
    if (rootPool) {
      try {
        await rootPool.query(sql.unsafe`
          SELECT pg_terminate_backend(pg_stat_activity.pid)
          FROM pg_stat_activity
          WHERE pg_stat_activity.datname = ${TEST_DB_NAME}
            AND pid <> pg_backend_pid();
        `);
        await rootPool.query(sql.unsafe`DROP DATABASE IF EXISTS ${sql.identifier([TEST_DB_NAME])}`);
        await rootPool.query(sql.unsafe`DROP ROLE IF EXISTS ${sql.identifier([MIGRATOR_ROLE])}`);
      } catch (e) {
        console.error('Failed to cleanup test database', e);
      }
      await rootPool.end();
    }
  });

  async function links() {
    return testPool.any(
      sql.type(
        z.object({
          bank_transaction_id: z.string(),
          card_account_id: z.string(),
          currency: z.string(),
          debit_date: z.string(),
          link_method: z.string(),
        }),
      )`
        SELECT bank_transaction_id, card_account_id, currency::text, debit_date::text, link_method::text
        FROM accounter_schema.creditcard_statement_links
        ORDER BY debit_date, bank_transaction_id
      `,
    );
  }

  it('links exactly the debits the ledger fallback resolved, to the closest free statement', async () => {
    const linkOf = (bankTransactionId: string, cardAccountId: string, currency: string, debitDate: string) => ({
      bank_transaction_id: bankTransactionId,
      card_account_id: cardAccountId,
      currency,
      debit_date: debitDate,
      link_method: 'MANUAL',
    });
    expect(await links()).toEqual([
      linkOf(debits.ref8547.id, CARD_9200, 'ILS', '2026-01-11'),
      // no USD statement: the debit's own date
      linkOf(debits.ref8547Usd.id, CARD_9200, 'USD', '2026-01-11'),
      // 2026-01-11 and 2026-01-13 are as close; the earlier one is taken
      linkOf(debits.ref8547Next.id, CARD_9200, 'ILS', '2026-01-13'),
      linkOf(debits.ref13795Card2260.id, CARD_2260, 'ILS', '2026-02-01'),
      linkOf(debits.ref13795Card4333.id, CARD_4333, 'ILS', '2026-02-20'),
      linkOf(debits.ref22200Mastercard.id, CARD_4333, 'ILS', '2026-03-03'),
      // untouched
      linkOf(debits.alreadyLinked.id, LINKED_ELSEWHERE_CARD, 'ILS', '2026-04-01'),
      linkOf(debits.withProforma.id, CARD_9200, 'ILS', '2026-06-01'),
      linkOf(debits.collisionFirst.id, CARD_9200, 'ILS', '2026-07-01'),
    ]);
  });

  it('prints the debits it could not link to the deploy output', () => {
    expect(warnings).toEqual([
      expect.stringContaining(
        `creditcard-legacy-links: 1 bank transaction(s) not linked, their card statement key is already taken`,
      ),
    ]);
    expect(warnings[0]).toContain(debits.collisionSecond.id);
  });

  it('leaves non-wallet, invoiced and colliding debits unlinked', async () => {
    const linked = new Set((await links()).map(link => link.bank_transaction_id));
    for (const debit of [debits.nonWallet, debits.invoiced, debits.collisionSecond]) {
      expect(linked.has(debit.id)).toBe(false);
    }
  });

  it('restores FORCE RLS on every table it opened', async () => {
    expect([...CREDITCARD_LEGACY_LINKS_TABLES].sort()).toEqual(RLS_TABLES);
    const forced = await testPool.anyFirst(
      sql.type(z.object({ relname: z.string() }))`
        SELECT c.relname::text
        FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'accounter_schema'
          AND c.relname = ANY(${sql.array(RLS_TABLES, 'text')})
          AND c.relforcerowsecurity
        ORDER BY c.relname
      `,
    );
    expect(forced).toEqual(RLS_TABLES);
  });
});
