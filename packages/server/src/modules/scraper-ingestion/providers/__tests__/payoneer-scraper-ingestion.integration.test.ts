import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import {
  ensureBusinessForEntity,
  ensureFinancialEntity,
} from '../../../../__tests__/helpers/seed-helpers.js';
import type { PayoneerTransactionInput } from '../../../../__generated__/types.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import {
  PayoneerScraperIngestionProvider,
  toPayoneerInstant,
} from '../payoneer-scraper-ingestion.provider.js';

let pool: Pool;
let provider: PayoneerScraperIngestionProvider;
let ownerId: string;
let financialAccountId: string;

const RUN = randomUUID().slice(0, 8);
const PAYONEER_ACCOUNT = `payoneer-test-${RUN}`;

function createMockAuthContextProvider(businessId: string): AuthContextProvider {
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
          roleId: 'scraper',
          permissions: [],
          emailVerified: true,
          permissionsVersion: 0,
        },
      }),
  } as unknown as AuthContextProvider;
}

const payment: PayoneerTransactionInput = {
  accountId: PAYONEER_ACCOUNT,
  transactionId: `${RUN}-2000000001`,
  activityType: 10,
  status: 2,
  activityDate: '2026-01-15T06:04:27.577',
  currency: 'USD',
  amount: 990,
  fee: -10,
  balance: 1_500,
  description: 'Payment from ACME CORP - XX-000001 (TEST CO)',
  counterpartyName: 'ACME CORP',
  paymentDescription: 'RMR*IV*90001**1000\\',
  receivingAccount: '70500000000000001',
  grossAmount: 1_000,
};

const withdrawal: PayoneerTransactionInput = {
  accountId: PAYONEER_ACCOUNT,
  transactionId: `${RUN}-2000000002`,
  activityType: 1,
  status: 2,
  activityDate: '2026-01-20T03:06:40.983',
  currency: 'USD',
  amount: -500,
  fee: -20,
  balance: 0,
  description: 'Withdrawal to Test Bank (0001)',
  counterpartyName: 'Test Bank (0001)',
  paymentDescription: 'Invoice 90002',
  transferId: '4366000000000001',
  targetAccount: 'IL000000000000000000001',
  amountSent: 480,
  rawData: JSON.stringify({ activityMainData: { ActivityItemId: '2000000002' } }),
};

async function transactionsOf(transactionId: string) {
  const { rows } = await pool.query<{
    charge_id: string;
    amount: string;
    current_balance: string;
    is_fee: boolean;
    business_id: string | null;
    currency: string;
    event_date: string;
    source_description: string | null;
    counter_account: string | null;
    origin_key: string;
  }>(
    `SELECT charge_id, amount, current_balance, is_fee, business_id, currency,
            to_char(event_date, 'YYYY-MM-DD') AS event_date, source_description, counter_account, origin_key
     FROM accounter_schema.transactions
     WHERE source_origin = 'PAYONEER' AND source_reference = $1 AND account_id = $2
     ORDER BY is_fee`,
    [transactionId, financialAccountId],
  );
  return rows;
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);

  const client = await pool.connect();
  try {
    ({ id: ownerId } = await ensureFinancialEntity(client, {
      name: `Payoneer Ingestion Owner ${RUN}`,
      type: 'business',
    }));
    await ensureBusinessForEntity(client, ownerId, { ownerId });
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO accounter_schema.financial_accounts (account_number, account_name, private_business, owner, type, owner_id)
       VALUES ($1, 'Payoneer', 'business', $2, 'BANK_ACCOUNT', $2)
       RETURNING id`,
      [PAYONEER_ACCOUNT, ownerId],
    );
    financialAccountId = rows[0].id;
  } finally {
    client.release();
  }

  const authContextProvider = createMockAuthContextProvider(ownerId);
  const dbClient = new TenantAwareDBClient(new DBProvider(pool), authContextProvider);
  provider = new PayoneerScraperIngestionProvider(dbClient, authContextProvider);
});

afterAll(async () => {
  if (!ownerId) return;
  // Payoneer rows cascade to transactions_raw_list; transactions and charges go explicitly.
  await pool.query(`DELETE FROM accounter_schema.transactions WHERE owner_id = $1`, [ownerId]);
  await pool.query(`DELETE FROM accounter_schema.charges WHERE owner_id = $1`, [ownerId]);
  await pool.query(`DELETE FROM accounter_schema.payoneer_transactions WHERE owner_id = $1`, [
    ownerId,
  ]);
  await pool.query(`DELETE FROM accounter_schema.financial_accounts WHERE id = $1`, [
    financialAccountId,
  ]);
  // Do NOT close db here — the shared pool is managed by vitest-global-setup teardown.
});

describe('toPayoneerInstant', () => {
  it('pins an offset-less Payoneer time to UTC', () => {
    expect(toPayoneerInstant('2026-01-15T06:04:27.577')).toBe('2026-01-15T06:04:27.577Z');
  });

  it('keeps an explicit offset', () => {
    expect(toPayoneerInstant('2026-01-15T06:04:27Z')).toBe('2026-01-15T06:04:27Z');
    expect(toPayoneerInstant('2026-01-15T08:04:27+02:00')).toBe('2026-01-15T08:04:27+02:00');
  });
});

describe('uploadPayoneerTransactions', () => {
  it('returns an empty result for empty input', async () => {
    await expect(provider.uploadPayoneerTransactions([])).resolves.toEqual({
      inserted: 0,
      skipped: 0,
      insertedIds: [],
      insertedTransactions: [],
      changedTransactions: [],
    });
  });

  it('books an incoming payment as the gross amount plus a fee transaction on one charge', async () => {
    const result = await provider.uploadPayoneerTransactions([payment]);
    expect(result.inserted).toBe(1);
    expect(result.insertedTransactions[0]).toMatchObject({
      account: PAYONEER_ACCOUNT,
      amount: '990',
      date: '2026-01-15T06:04:27.577Z',
    });

    const [main, fee] = await transactionsOf(payment.transactionId);
    expect(main).toMatchObject({
      is_fee: false,
      currency: 'USD',
      // 06:04 UTC is 08:04 in Israel, same day
      event_date: '2026-01-15',
      source_description:
        'Payment from ACME CORP - XX-000001 (TEST CO) | RMR*IV*90001**1000\\',
    });
    expect(Number(main.amount)).toBe(1_000);
    expect(Number(main.current_balance)).toBe(1_510);
    expect(fee).toMatchObject({ is_fee: true, counter_account: 'PAYONEER_fee' });
    expect(Number(fee.amount)).toBe(-10);
    expect(Number(fee.current_balance)).toBe(1_500);
    expect(fee.charge_id).toBe(main.charge_id);
    expect(fee.origin_key).toBe(`${main.origin_key}_fee`);
  });

  it('books a withdrawal as the amount sent plus the withdrawal fee', async () => {
    await provider.uploadPayoneerTransactions([withdrawal]);
    const [main, fee] = await transactionsOf(withdrawal.transactionId);
    expect(Number(main.amount)).toBe(-480);
    expect(main.counter_account).toBe('IL000000000000000000001');
    expect(main.event_date).toBe('2026-01-20');
    expect(Number(fee.amount)).toBe(-20);
    expect(fee.charge_id).toBe(main.charge_id);
  });

  it('creates no fee transaction when there is no fee', async () => {
    const noFee = { ...payment, transactionId: `${RUN}-nofee`, fee: 0, grossAmount: 990 };
    await provider.uploadPayoneerTransactions([noFee]);
    const rows = await transactionsOf(noFee.transactionId);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amount)).toBe(990);
  });

  it('skips a known item and reports what changed on it', async () => {
    const result = await provider.uploadPayoneerTransactions([{ ...payment, fee: -5 }]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.changedTransactions).toHaveLength(1);
    expect(result.changedTransactions[0].changedFields).toEqual([
      { field: 'fee', oldValue: '-10', newValue: '-5' },
    ]);
    // the booked transactions are untouched
    expect(await transactionsOf(payment.transactionId)).toHaveLength(2);
  });

  it('rejects an item for a Payoneer account the owner does not have', async () => {
    await expect(
      provider.uploadPayoneerTransactions([
        { ...payment, accountId: `missing-${RUN}`, transactionId: `${RUN}-missing` },
      ]),
    ).rejects.toThrow(/Financial account not found/);
  });
});
