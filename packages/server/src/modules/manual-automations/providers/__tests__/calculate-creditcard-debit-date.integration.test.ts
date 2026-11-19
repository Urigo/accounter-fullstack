import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { ManualAutomationsProvider } from '../manual-automations.provider.js';

/**
 * FILL_CREDITCARD_DEBIT_DATES against a real database: the bank-agnostic rule, checked against the
 * Poalim-only SQL it replaced (kept verbatim below as the regression oracle), plus the clues only
 * the new rule reads. All values are fake.
 */

let pool: Pool;

const OWNER_ID = '00000000-0000-4000-8000-00000000ee01';
const ISSUER_ID = '00000000-0000-4000-8000-00000000ee02';

const created = {
  chargeIds: [] as string[],
  rawListIds: [] as string[],
  poalimRawIds: [] as string[],
  otsarRawIds: [] as string[],
  accountIds: [] as string[],
};
const dbClients: TenantAwareDBClient[] = [];

function createProvider() {
  const authContextProvider = {
    getAuthContext: () =>
      Promise.resolve({
        authType: 'apiKey' as const,
        token: 'test-token',
        tenant: { businessId: OWNER_ID },
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
  const db = new TenantAwareDBClient(new DBProvider(pool), authContextProvider);
  dbClients.push(db);
  return new ManualAutomationsProvider(db);
}

/** Runs inserts with triggers off, so a raw row doesn't create its own transaction */
async function withoutTriggers(fn: (client: PoolClient) => Promise<unknown>) {
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

async function createPoalim491RawRow(referenceNumber: number, eventDate: string) {
  const id = randomUUID();
  const compact = eventDate.replaceAll('-', '');
  await withoutTriggers(client =>
    client.query(
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
       VALUES ($1, $3, $4, 1, 491, 'CARD', 0, $2, 0, $3, $4, 100, 2, 0, 0, 0, 'REGULAR', 0,
         $5, 0, floor(random() * 1000000000)::bigint, '', 0, 0, 0, 0, 0, 0, B'0', B'0', B'0',
         12, 345, 900101)`,
      [id, referenceNumber, eventDate, compact, Number(compact)],
    ),
  );
  created.poalimRawIds.push(id);
  return id;
}

/** An Otsar ILS raw row; its drill-down is a card breakdown naming `originReference` by default */
async function createOtsarRawRow(originReference: string, drillDownType = 'T20C2211') {
  const drillDownData =
    drillDownType === 'T20C2211'
      ? {
          T20C2211: {
            'OUT-DATA': { 'ALL-CARDS': { 'KARTIS-DETAILS': { 'OUT-MSKART': originReference } } },
          },
        }
      : { [drillDownType]: { 'OUT-DATA': {} } };
  const id = randomUUID();
  await withoutTriggers(client =>
    client.query(
      `INSERT INTO accounter_schema.otsar_hahayal_ils_account_transactions (
         id, owner_id, account_number, account_type, branch_number, action_code, bfb_source,
         closing_balance, correspondent_account, correspondent_account_type, correspondent_bank,
         correspondent_branch, credit_amount, customer_name, date_of_business_day,
         date_of_registration, debit_amount, depositor_id, description, drill_down_url,
         first_transaction_of_day, last_transaction_of_day, name, opening_balance,
         operation_source, reference, salary_ind, transaction_source, transaction_reason,
         origin_reference, drill_down_data
       )
       VALUES ($1, $2, 900102, 0, 1, 0, '77', 0, 0, 0, 0, 0, 0, ' ', now(), now(), 100, 0,
         'Card charges', '', true, false, ' ', 0, ' ', floor(random() * 1000000)::int, 0, ' ',
         ' ', $3, $4::jsonb)`,
      [id, OWNER_ID, originReference, JSON.stringify(drillDownData)],
    ),
  );
  created.otsarRawIds.push(id);
  return id;
}

type TransactionSeed = {
  accountId: string;
  eventDate: string;
  debitDate?: string | null;
  sourceOrigin: string;
  sourceReference?: string;
  sourceDescription?: string;
  businessId?: string;
  isFee?: boolean;
  poalimRawId?: string;
  otsarRawId?: string;
};

async function createTransaction(seed: TransactionSeed) {
  const chargeId = randomUUID();
  await pool.query(`INSERT INTO accounter_schema.charges (id, owner_id) VALUES ($1, $2)`, [
    chargeId,
    OWNER_ID,
  ]);
  created.chargeIds.push(chargeId);

  const rawListId = randomUUID();
  if (seed.poalimRawId) {
    await pool.query(
      `INSERT INTO accounter_schema.transactions_raw_list (id, poalim_ils_id) VALUES ($1, $2)`,
      [rawListId, seed.poalimRawId],
    );
  } else if (seed.otsarRawId) {
    await pool.query(
      `INSERT INTO accounter_schema.transactions_raw_list (id, otsar_hahayal_ils_id) VALUES ($1, $2)`,
      [rawListId, seed.otsarRawId],
    );
  } else {
    await pool.query(
      `INSERT INTO accounter_schema.transactions_raw_list (id, etana_id) VALUES ($1, $2)`,
      [rawListId, `debit-date-test-${rawListId}`],
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
     VALUES ($1, $2, $3, $4, $5, 'ILS', $6, $7, -100, 0, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      seed.accountId,
      chargeId,
      rawListId,
      seed.sourceDescription ?? 'Test transaction',
      seed.eventDate,
      seed.debitDate === undefined ? seed.eventDate : seed.debitDate,
      seed.businessId ?? null,
      seed.sourceReference ?? randomUUID().slice(0, 8),
      seed.sourceOrigin,
      `debit-date-test-${id}`,
      OWNER_ID,
      seed.isFee ?? false,
    ],
  );
  return id;
}

/** A card row without a debit date */
function createCardRow(accountId: string, eventDate: string, sourceOrigin = 'ISRACARD') {
  return createTransaction({ accountId, eventDate, debitDate: null, sourceOrigin });
}

/** The Poalim-only SQL the automation used before, as a read-only query: the regression oracle */
async function oldDebitDates(): Promise<Map<string, string>> {
  const { rows } = await pool.query<{ id: string; alt_debit_date: string }>(
    `WITH alt_debit_date AS (SELECT p.event_date,
                                    p.reference_number::text
                             FROM accounter_schema.poalim_ils_account_transactions p
                             WHERE p.activity_type_code = 491
                             ORDER BY p.event_date DESC),
          altered_transactions AS (SELECT DISTINCT ON (t.id) t.id,
                                                             alt_debit_date.event_date AS alt_debit_date,
                                                             t.owner_id
                                   FROM accounter_schema.transactions t
                                            LEFT JOIN accounter_schema.financial_accounts a ON a.id = t.account_id
                                            LEFT JOIN alt_debit_date
                                                      ON alt_debit_date.reference_number = a.account_number AND
                                                         alt_debit_date.event_date > t.event_date AND
                                                         alt_debit_date.event_date < (t.event_date + '40 days'::interval) AND
                                                         alt_debit_date.event_date = ((SELECT min(add.event_date) AS min
                                                                                       FROM alt_debit_date add
                                                                                       WHERE add.reference_number = a.account_number
                                                                                         AND add.event_date > t.event_date
                                                                                         AND add.event_date < (t.event_date + '40 days'::interval)))
                                   WHERE t.debit_date IS NULL
                                     AND t.debit_date_override IS NULL
                                     AND currency = 'ILS'
                                     AND (t.source_origin = 'ISRACARD' OR t.source_origin = 'AMEX'))
     SELECT at.id, at.alt_debit_date::text AS alt_debit_date
     FROM altered_transactions at
     WHERE at.alt_debit_date IS NOT NULL
       AND at.owner_id = $1`,
    [OWNER_ID],
  );
  return new Map(rows.map(row => [row.id, row.alt_debit_date]));
}

const cards = {} as Record<
  | 'poalimCycle1'
  | 'poalimCycle2'
  | 'poalimTooLate'
  | 'poalimAmex'
  | 'otsarHinted'
  | 'calByIssuerReference'
  | 'nameByIssuer'
  | 'weakDescription'
  | 'referenceWithoutIssuer'
  | 'alreadyDated'
  | 'otsarTransferReference'
  | 'namedPoalimCard'
  | 'earliestOfTwo'
  | 'zeroPadded'
  | 'maskedPan',
  string
>;

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  for (const [id, ownerId] of [
    [OWNER_ID, null],
    [ISSUER_ID, OWNER_ID],
  ] as const) {
    await pool.query(
      `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
       VALUES ($1, $2, 'business', $3)
       ON CONFLICT (id) DO NOTHING`,
      [id, `debit-date-test-${id.slice(-4)}`, ownerId],
    );
    await pool.query(
      `INSERT INTO accounter_schema.businesses (id, owner_id, country)
       VALUES ($1, $2, 'ISR')
       ON CONFLICT (id) DO NOTHING`,
      [id, ownerId ?? id],
    );
  }

  // Poalim: card-debit rows (activity 491) carry the card number as reference
  const poalim = await createAccount('BANK_ACCOUNT', '900101');
  const isracard = await createAccount('CREDIT_CARD', '7531');
  const amex = await createAccount('CREDIT_CARD', '8642');
  for (const [reference, date] of [
    [7531, '2026-06-10'],
    [7531, '2026-07-10'],
    [8642, '2026-06-12'],
  ] as const) {
    await createTransaction({
      accountId: poalim,
      eventDate: date,
      sourceOrigin: 'POALIM',
      sourceReference: String(reference),
      poalimRawId: await createPoalim491RawRow(reference, date),
    });
  }
  cards.poalimCycle1 = await createCardRow(isracard, '2026-05-20');
  cards.poalimCycle2 = await createCardRow(isracard, '2026-06-15');
  // the next debit is more than 40 days later
  cards.poalimTooLate = await createCardRow(isracard, '2026-04-01');
  cards.poalimAmex = await createCardRow(amex, '2026-06-01', 'AMEX');
  // a row that has its debit date is left alone
  cards.alreadyDated = await createTransaction({
    accountId: isracard,
    eventDate: '2026-05-25',
    debitDate: '2026-06-20',
    sourceOrigin: 'ISRACARD',
  });

  // Otsar Hahayal: the card's last 4 digits in the raw row's origin_reference, generic reference
  const otsar = await createAccount('BANK_ACCOUNT', '900102');
  const otsarPaidCard = await createAccount('CREDIT_CARD', '9753');
  await createTransaction({
    accountId: otsar,
    eventDate: '2026-08-05',
    sourceOrigin: 'OTSAR_HAHAYAL',
    sourceReference: '55501',
    otsarRawId: await createOtsarRawRow('9753'),
  });
  // a fee row with the same hint, earlier: fees are not card debits
  await createTransaction({
    accountId: otsar,
    eventDate: '2026-07-25',
    sourceOrigin: 'OTSAR_HAHAYAL',
    isFee: true,
    otsarRawId: await createOtsarRawRow('9753'),
  });
  cards.otsarHinted = await createCardRow(otsarPaidCard, '2026-07-20');

  // Cal (its debit date can be NULL too): reference equal to the card number, issuer counterparty
  const discount = await createAccount('BANK_ACCOUNT', '900103');
  const calCard = await createAccount('CREDIT_CARD', '1597');
  await createTransaction({
    accountId: discount,
    eventDate: '2026-08-20',
    sourceOrigin: 'BANK_DISCOUNT',
    sourceReference: '1597',
    businessId: ISSUER_ID,
  });
  cards.calByIssuerReference = await createCardRow(calCard, '2026-08-01', 'CAL');

  // the card's name in the description of a debit to the issuer
  const namedCard = await createAccount('CREDIT_CARD', '2468');
  await pool.query(`UPDATE accounter_schema.financial_accounts SET account_name = $2 WHERE id = $1`, [
    namedCard,
    'Test Gold Card',
  ]);
  await createTransaction({
    accountId: discount,
    eventDate: '2026-09-12',
    sourceOrigin: 'BANK_DISCOUNT',
    sourceDescription: 'Payment Test Gold Card',
    businessId: ISSUER_ID,
  });
  cards.nameByIssuer = await createCardRow(namedCard, '2026-09-01');

  // weak clues fill nothing: the last 4 digits in a description, or the card number as reference
  // on a debit to a counterparty that is not a card issuer
  const weakCard = await createAccount('CREDIT_CARD', '3579');
  await createTransaction({
    accountId: discount,
    eventDate: '2026-10-05',
    sourceOrigin: 'BANK_DISCOUNT',
    sourceDescription: 'Payment 3579',
  });
  cards.weakDescription = await createCardRow(weakCard, '2026-09-25');
  const unknownCounterpartyCard = await createAccount('CREDIT_CARD', '4680');
  await createTransaction({
    accountId: discount,
    eventDate: '2026-10-15',
    sourceOrigin: 'BANK_DISCOUNT',
    sourceReference: '4680',
  });
  cards.referenceWithoutIssuer = await createCardRow(unknownCounterpartyCard, '2026-10-01');

  // an Otsar transfer (validateSchema stores its reference in origin_reference) whose last 4
  // digits are a card's: not a card hint
  const transferCard = await createAccount('CREDIT_CARD', '6543');
  await createTransaction({
    accountId: otsar,
    eventDate: '2026-11-05',
    sourceOrigin: 'OTSAR_HAHAYAL',
    otsarRawId: await createOtsarRawRow('6543', 'T10C1523'),
  });
  cards.otsarTransferReference = await createCardRow(transferCard, '2026-10-25');

  // a named Poalim card, and another card's earlier 491 debit to the issuer whose description
  // holds that name: the raw hint decides, so the named card gets its own 491 date
  const namedPoalimCard = await createAccount('CREDIT_CARD', '1122');
  await pool.query(`UPDATE accounter_schema.financial_accounts SET account_name = $2 WHERE id = $1`, [
    namedPoalimCard,
    'Test Silver Card',
  ]);
  await createAccount('CREDIT_CARD', '3344');
  for (const [reference, date, description] of [
    [3344, '2026-12-05', 'ISRACARD Test Silver Card'],
    [1122, '2026-12-15', 'ISRACARD'],
  ] as const) {
    await createTransaction({
      accountId: poalim,
      eventDate: date,
      sourceOrigin: 'POALIM',
      sourceReference: String(reference),
      sourceDescription: description,
      businessId: ISSUER_ID,
      poalimRawId: await createPoalim491RawRow(reference, date),
    });
  }
  cards.namedPoalimCard = await createCardRow(namedPoalimCard, '2026-11-30');

  // two strong debits in the window: the earliest wins
  const twoDebitsCard = await createAccount('CREDIT_CARD', '5566');
  for (const date of ['2027-01-20', '2027-01-10']) {
    await createTransaction({
      accountId: poalim,
      eventDate: date,
      sourceOrigin: 'POALIM',
      sourceReference: '5566',
      poalimRawId: await createPoalim491RawRow(5566, date),
    });
  }
  cards.earliestOfTwo = await createCardRow(twoDebitsCard, '2027-01-01');

  // a card number with a leading zero, against Poalim's numeric reference
  const zeroPaddedCard = await createAccount('CREDIT_CARD', '0123');
  await createTransaction({
    accountId: poalim,
    eventDate: '2027-02-10',
    sourceOrigin: 'POALIM',
    sourceReference: '123',
    poalimRawId: await createPoalim491RawRow(123, '2027-02-10'),
  });
  cards.zeroPadded = await createCardRow(zeroPaddedCard, '2027-02-01');

  // a masked PAN card account, matched on its last 4 digits
  const maskedPanCard = await createAccount('CREDIT_CARD', '123456xxxxxx7788');
  await createTransaction({
    accountId: otsar,
    eventDate: '2027-03-10',
    sourceOrigin: 'OTSAR_HAHAYAL',
    otsarRawId: await createOtsarRawRow('7788'),
  });
  cards.maskedPan = await createCardRow(maskedPanCard, '2027-03-01');
});

afterEach(async () => {
  await Promise.all(dbClients.splice(0).map(client => client.dispose()));
});

afterAll(async () => {
  await pool.query('DELETE FROM accounter_schema.transactions WHERE owner_id = $1', [OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.transactions_raw_list WHERE id = ANY($1)', [
    created.rawListIds,
  ]);
  await pool.query('DELETE FROM accounter_schema.poalim_ils_account_transactions WHERE id = ANY($1)', [
    created.poalimRawIds,
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
});

describe('calculateCreditcardDebitDate', () => {
  it('fills debit dates from every strong card clue, and Poalim exactly as before', async () => {
    const before = await oldDebitDates();
    // the oracle's Poalim results, before anything is written
    expect(Object.fromEntries(before)).toEqual({
      [cards.poalimCycle1]: '2026-06-10',
      [cards.poalimCycle2]: '2026-07-10',
      [cards.poalimAmex]: '2026-06-12',
      [cards.namedPoalimCard]: '2026-12-15',
      [cards.earliestOfTwo]: '2027-01-10',
    });

    const filled = await createProvider().calculateCreditcardDebitDate({
      ownerId: OWNER_ID,
      creditCardBusinessIds: [ISSUER_ID],
    });
    const byId = Object.fromEntries(filled.map(row => [row.id, row.debit_date_override]));

    // Poalim parity: the same rows, the same dates
    for (const [id, date] of before) {
      expect(byId[id]).toBe(date);
    }
    expect(byId).toEqual({
      ...Object.fromEntries(before),
      [cards.otsarHinted]: '2026-08-05',
      [cards.calByIssuerReference]: '2026-08-20',
      [cards.nameByIssuer]: '2026-09-12',
      // the old rule compared text: '123' never matched the card numbered '0123'
      [cards.zeroPadded]: '2027-02-10',
      [cards.maskedPan]: '2027-03-10',
    });
    for (const id of [
      cards.otsarTransferReference,
      cards.poalimTooLate,
      cards.weakDescription,
      cards.referenceWithoutIssuer,
      cards.alreadyDated,
    ]) {
      expect(byId[id]).toBeUndefined();
    }

    // stored, and nothing left for the old rule or a second run
    const { rows } = await pool.query<{ id: string; debit_date_override: string | null }>(
      `SELECT id, debit_date_override::text AS debit_date_override
       FROM accounter_schema.transactions
       WHERE id = ANY($1)`,
      [Object.values(cards)],
    );
    expect(Object.fromEntries(rows.map(row => [row.id, row.debit_date_override]))).toMatchObject(
      byId,
    );
    expect((await oldDebitDates()).size).toBe(0);
    expect(
      await createProvider().calculateCreditcardDebitDate({
        ownerId: OWNER_ID,
        creditCardBusinessIds: [ISSUER_ID],
      }),
    ).toEqual([]);
  });

  it('reads a reference or card name only on debits to the given card issuers', async () => {
    await pool.query(
      `UPDATE accounter_schema.transactions SET debit_date_override = NULL WHERE id = ANY($1)`,
      [[cards.calByIssuerReference, cards.nameByIssuer, cards.otsarHinted]],
    );

    const filled = await createProvider().calculateCreditcardDebitDate({
      ownerId: OWNER_ID,
      creditCardBusinessIds: [],
    });

    // the raw hint needs no issuer; the reference and the name do
    expect(filled).toEqual([{ id: cards.otsarHinted, debit_date_override: '2026-08-05' }]);
  });
});
