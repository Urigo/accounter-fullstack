import { createPool, sql, type DatabasePool } from 'slonik';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import z from 'zod';
import legacyLinks from '../actions/2026-11-19T13-00-00.creditcard-legacy-links.js';
import { createConnectionString } from '../connection-string.js';
import { env } from '../environment.js';
import { assertLocalDatabase } from '../local-db-guard.js';
import { runMigrations } from '../pg-migrator.js';
import { MIGRATIONS } from '../run-pg-migrations.js';

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
};

// Card rows, making up statements (card account, currency, debit date)
const cardRows = [
  row({ accountId: CARD_9200, reference: 'card', date: '2026-01-11', amount: '-10' }),
  row({ accountId: CARD_9200, reference: 'card', date: '2026-01-13', amount: '-20' }),
  row({ accountId: CARD_9200, reference: 'card', date: '2026-01-16', amount: '-30' }),
  row({ accountId: CARD_2260, reference: 'card', date: '2026-02-01', amount: '-40' }),
  row({ accountId: CARD_2260, reference: 'card', date: '2026-02-01', amount: '-41' }),
  row({ accountId: CARD_4333, reference: 'card', date: '2026-03-03', amount: '-50' }),
];

describe('credit card legacy links migration', () => {
  let rootPool: DatabasePool;
  let testPool: DatabasePool;

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
            owner_id, is_fee
          ) VALUES (
            ${seed.id}, ${seed.accountId}, ${nextId()}, ${nextId()}, ${seed.description ?? 'TEST'},
            ${seed.currency ?? 'ILS'}, ${seed.date}, ${seed.date}, ${seed.amount ?? '-100'}, 0,
            ${seed.reference}, 'TEST', ${seed.id}, ${seed.ownerId ?? OWNER_ID},
            ${seed.isFee ?? false}
          )
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
      const result = await legacyLinks.run({ sql: sql.unsafe, connection });
      if (result) {
        await connection.query(result);
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
    ]);
  });

  it('restores FORCE RLS on the tables it opened', async () => {
    const forced = await testPool.anyFirst(
      sql.type(z.object({ relname: z.string() }))`
        SELECT c.relname
        FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'accounter_schema'
          AND c.relname IN ('transactions', 'financial_accounts', 'creditcard_statement_links')
          AND c.relforcerowsecurity
        ORDER BY c.relname
      `,
    );
    expect(forced).toEqual(['creditcard_statement_links', 'financial_accounts', 'transactions']);
  });
});
