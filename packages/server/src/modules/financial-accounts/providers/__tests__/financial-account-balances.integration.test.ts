import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import type { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { FinancialAccountsProvider } from '../financial-accounts.provider.js';

const OWNER_ID = '00000000-0000-0000-0000-00000000ba1a';
const BANK_ACCOUNT_ID = '00000000-0000-0000-0000-00000000ba1b';
const CARD_ACCOUNT_ID = '00000000-0000-0000-0000-00000000ba1c';
const RAW_TABLES = ['poalim_ils_account_transactions'];

let pool: Pool;
let provider: FinancialAccountsProvider;

function authContextProvider(): AuthContextProvider {
  return {
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
}

/** A Poalim ILS raw row, so the same-day ordering by the bank's serial number is exercised. */
async function insertRawIls(serialNumber: number, balance: number): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO accounter_schema.poalim_ils_account_transactions (
       event_date, formatted_event_date, serial_number, activity_type_code, activity_description,
       text_code, reference_number, reference_catenated_number, value_date, formatted_value_date,
       event_amount, event_activity_type_code, current_balance, internal_link_code,
       original_event_create_date, transaction_type, data_group_code, expanded_event_date,
       executing_branch_number, event_id, different_date_indication, table_number, record_number,
       contra_bank_number, contra_branch_number, contra_account_number, contra_account_type_code,
       marketing_offer_context, comment_existence_switch, field_desc_display_switch,
       bank_number, branch_number, account_number)
     VALUES ('2026-10-21', '2026-10-21', $1::int, 1, 'test', 0, $1::bigint, 0, '2026-10-21', '2026-10-21',
       100, 1, $2, 0, 0, 'REGULAR', 0, $1::bigint, 0, $1::bigint, '', 0, 0, 0, 0, 0, 0,
       B'0', B'0', B'0', 12, 615, 990001)
     RETURNING id`,
    [serialNumber, balance],
  );
  return rows[0].id;
}

async function insertTransaction(args: {
  accountId: string;
  currency: string;
  eventDate: string;
  balance: number;
  rawIlsId?: string;
  createdAt?: string;
}) {
  // transactions_raw_list needs exactly one source; rows without a bank sequence use a
  // kraken id (no FK), so only insertion time orders them within a day.
  const raw = await pool.query<{ id: string }>(
    'INSERT INTO accounter_schema.transactions_raw_list (poalim_ils_id, kraken_id) VALUES ($1, $2) RETURNING id',
    [args.rawIlsId ?? null, args.rawIlsId ? null : `balances-test-${Math.random()}`],
  );
  const charge = await pool.query<{ id: string }>(
    'INSERT INTO accounter_schema.charges (owner_id) VALUES ($1) RETURNING id',
    [OWNER_ID],
  );
  await pool.query(
    `INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, currency, event_date,
       debit_date, amount, current_balance, source_reference, source_origin, origin_key, owner_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $5, 1, $6, 'ref', 'test', 'test', $7, COALESCE($8::timestamp, now()))`,
    [
      args.accountId,
      charge.rows[0].id,
      raw.rows[0].id,
      args.currency,
      args.eventDate,
      args.balance,
      OWNER_ID,
      args.createdAt ?? null,
    ],
  );
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  const dbClient = new TenantAwareDBClient(new DBProvider(pool), authContextProvider());
  provider = new FinancialAccountsProvider(dbClient, {} as unknown as AdminContextProvider);

  for (const table of RAW_TABLES) {
    await pool.query(`ALTER TABLE accounter_schema.${table} DISABLE TRIGGER ALL`);
  }
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name) VALUES ($1, 'balances-test-owner')
     ON CONFLICT (id) DO NOTHING`,
    [OWNER_ID],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
    [OWNER_ID],
  );
  await pool.query(
    `INSERT INTO accounter_schema.financial_accounts (id, account_number, type, owner, owner_id)
     VALUES ($1, '990001', 'BANK_ACCOUNT', $3, $3), ($2, '9901', 'CREDIT_CARD', $3, $3)`,
    [BANK_ACCOUNT_ID, CARD_ACCOUNT_ID, OWNER_ID],
  );

  // ILS: three days; on the last day the bank's serial order (2 after 1) must win over insert order.
  await insertTransaction({ accountId: BANK_ACCOUNT_ID, currency: 'ILS', eventDate: '2026-10-19', balance: 100 });
  const later = await insertRawIls(2, 300);
  const earlier = await insertRawIls(1, 200);
  await insertTransaction({
    accountId: BANK_ACCOUNT_ID,
    currency: 'ILS',
    eventDate: '2026-10-21',
    balance: 300,
    rawIlsId: later,
    createdAt: '2026-10-21T08:00:00',
  });
  await insertTransaction({
    accountId: BANK_ACCOUNT_ID,
    currency: 'ILS',
    eventDate: '2026-10-21',
    balance: 200,
    rawIlsId: earlier,
    createdAt: '2026-10-21T09:00:00',
  });
  // USD on the same account is reported separately.
  await insertTransaction({ accountId: BANK_ACCOUNT_ID, currency: 'USD', eventDate: '2026-10-20', balance: 5000 });
  await insertTransaction({ accountId: BANK_ACCOUNT_ID, currency: 'USD', eventDate: '2026-10-23', balance: 7500.5 });
  // Card accounts carry no bank balance and are left out.
  await insertTransaction({ accountId: CARD_ACCOUNT_ID, currency: 'ILS', eventDate: '2026-10-22', balance: -40 });
});

afterAll(async () => {
  await pool.query('DELETE FROM accounter_schema.transactions WHERE owner_id = $1', [OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.charges WHERE owner_id = $1', [OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.poalim_ils_account_transactions WHERE account_number = 990001');
  await pool.query('DELETE FROM accounter_schema.financial_accounts WHERE owner_id = $1', [OWNER_ID]);
  for (const table of RAW_TABLES) {
    await pool.query(`ALTER TABLE accounter_schema.${table} ENABLE TRIGGER ALL`);
  }
  await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [OWNER_ID]);
});

describe('FinancialAccountsProvider.getLatestAccountBalances', () => {
  it('returns the newest bank-reported balance per account and currency', async () => {
    const rows = await provider.getLatestAccountBalances({ accountIds: [BANK_ACCOUNT_ID, CARD_ACCOUNT_ID] });
    const byCurrency = Object.fromEntries(rows.map(r => [r.currency, r]));
    expect(rows).toHaveLength(2);
    expect(Number(byCurrency.ILS.current_balance)).toBe(300);
    expect(byCurrency.ILS.event_date).toBe('2026-10-21');
    expect(Number(byCurrency.USD.current_balance)).toBe(7500.5);
    expect(rows.every(r => r.account_id === BANK_ACCOUNT_ID)).toBe(true);
  });

  it('honours asOfDate', async () => {
    const rows = await provider.getLatestAccountBalances({
      accountIds: [BANK_ACCOUNT_ID],
      asOfDate: '2026-10-20',
    });
    const byCurrency = Object.fromEntries(rows.map(r => [r.currency, Number(r.current_balance)]));
    expect(byCurrency).toEqual({ ILS: 100, USD: 5000 });
  });
});
