import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import type { ChargesAuthorizationProvider } from '../../../charges/providers/charges-authorization.provider.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { SecurityExecutionChargesProvider } from '../security-execution-charges.provider.js';

/*
 * The charges ingestion creates for stock distributions paid as a dividend in kind — executions
 * with no cash leg, which would otherwise reach no charge. All values are synthetic.
 */

let pool: Pool;

const TEST_OWNER_ID = '00000000-0000-0000-0000-0000000008ec';

const DISTRIBUTION = 'הטבה חלוקת מניות';
const DIVIDEND_IN_KIND = 'דיבידנד בעין';

function createProvider() {
  const authContextProvider = {
    getAuthContext: () =>
      Promise.resolve({
        authType: 'apiKey' as const,
        token: 'test-token',
        tenant: { businessId: TEST_OWNER_ID },
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
  const dbClient = new TenantAwareDBClient(new DBProvider(pool), authContextProvider);
  // the scraper role may write charges (charges-authorization.test.ts); not what this suite tests
  const chargesAuthorization = {
    canWriteCharge: () => Promise.resolve(),
  } as unknown as ChargesAuthorizationProvider;
  return new SecurityExecutionChargesProvider(
    dbClient,
    new ChargesProvider(dbClient, chargesAuthorization),
  );
}

let executionCounter = 0;

async function insertExecution({
  tradeType = DISTRIBUTION,
  paymentType = DIVIDEND_IN_KIND,
  tradeDate = '2025-03-10',
  valueDate = '2025-03-10' as string | null,
  isCancelled = false,
}: {
  tradeType?: string;
  paymentType?: string | null;
  tradeDate?: string;
  valueDate?: string | null;
  isCancelled?: boolean;
} = {}): Promise<string> {
  executionCounter += 1;
  const {
    rows: [row],
  } = await pool.query<{ id: string }>(
    `INSERT INTO accounter_schema.poalim_securities_transactions (
       owner_id, bank_number, branch_number, account_number, security, trade_date, value_date,
       trade_type, transaction_type, payment_type, nv, trade_price, trade_gross_value_trade_currency,
       net_value_trade_currency, trade_currency, symbol, is_cancel_transaction, occurrence
     ) VALUES ($1, 12, 600, 100000, '7654321', $2, $3, $4, 'תשלומים ואירועי חברה', $5, 10, 100,
               1000, 0, 'דולר ארה"ב', 'MOCK', $6, $7)
     RETURNING id`,
    [
      TEST_OWNER_ID,
      tradeDate,
      valueDate,
      tradeType,
      paymentType,
      isCancelled ? 'כן' : 'לא',
      executionCounter,
    ],
  );
  return row!.id;
}

async function linksOf(executionIds: string[]) {
  const { rows } = await pool.query<{ execution_id: string; charge_id: string }>(
    `SELECT execution_id, charge_id
     FROM accounter_schema.charges_securities_executions
     WHERE execution_id = ANY($1)`,
    [executionIds],
  );
  return rows;
}

async function cleanUp() {
  await pool.query(
    'DELETE FROM accounter_schema.charges_securities_executions WHERE owner_id = $1',
    [TEST_OWNER_ID],
  );
  await pool.query('DELETE FROM accounter_schema.charges WHERE owner_id = $1', [TEST_OWNER_ID]);
  await pool.query(
    'DELETE FROM accounter_schema.poalim_securities_transactions WHERE owner_id = $1',
    [TEST_OWNER_ID],
  );
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name)
     VALUES ($1, 'security-execution-charges-test-owner')
     ON CONFLICT (id) DO NOTHING`,
    [TEST_OWNER_ID],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id)
     VALUES ($1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [TEST_OWNER_ID],
  );
});

afterEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [TEST_OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [
    TEST_OWNER_ID,
  ]);
  await pool.end();
});

describe('SecurityExecutionChargesProvider.ensureDistributionCharges', () => {
  it('creates a foreign-securities charge per dividend in kind and links it', async () => {
    const first = await insertExecution();
    const second = await insertExecution({ tradeDate: '2025-04-10', valueDate: '2025-04-10' });

    const chargeIds = await createProvider().ensureDistributionCharges(TEST_OWNER_ID, null);

    expect(chargeIds).toHaveLength(2);
    const links = await linksOf([first, second]);
    expect(links.map(link => link.charge_id).sort()).toEqual([...chargeIds].sort());

    const { rows: charges } = await pool.query(
      'SELECT owner_id, type, user_description FROM accounter_schema.charges WHERE id = ANY($1)',
      [chargeIds],
    );
    expect(charges).toEqual([
      { owner_id: TEST_OWNER_ID, type: 'FOREIGN_SECURITIES', user_description: 'Stock distribution: MOCK' },
      { owner_id: TEST_OWNER_ID, type: 'FOREIGN_SECURITIES', user_description: 'Stock distribution: MOCK' },
    ]);
  });

  it('is a no-op once every distribution is linked', async () => {
    const execution = await insertExecution();
    const provider = createProvider();

    const [chargeId] = await provider.ensureDistributionCharges(TEST_OWNER_ID, null);
    const again = await createProvider().ensureDistributionCharges(TEST_OWNER_ID, null);

    expect(again).toEqual([]);
    expect(await linksOf([execution])).toEqual([{ execution_id: execution, charge_id: chargeId }]);
  });

  it('leaves cancelled distributions, other distributions and other executions alone', async () => {
    const executions = [
      await insertExecution({ isCancelled: true }),
      await insertExecution({ paymentType: null }),
      await insertExecution({ tradeType: 'קניה', paymentType: null }),
    ];

    const chargeIds = await createProvider().ensureDistributionCharges(TEST_OWNER_ID, null);

    expect(chargeIds).toEqual([]);
    expect(await linksOf(executions)).toEqual([]);
  });

  it('does not create charges in a locked period', async () => {
    const locked = await insertExecution({ tradeDate: '2024-12-30', valueDate: '2024-12-31' });
    const open = await insertExecution({ tradeDate: '2024-12-31', valueDate: null });
    const after = await insertExecution({ tradeDate: '2025-01-01', valueDate: '2025-01-01' });

    await createProvider().ensureDistributionCharges(TEST_OWNER_ID, '2024-12-31');

    const links = await linksOf([locked, open, after]);
    expect(links.map(link => link.execution_id)).toEqual([after]);
  });

  it('exposes the link both ways and moves it on a merge', async () => {
    const execution = await insertExecution();
    const provider = createProvider();
    const [chargeId] = await provider.ensureDistributionCharges(TEST_OWNER_ID, null);

    expect(await provider.linkedExecutionIdsByChargeIdLoader.load(chargeId!)).toEqual([execution]);
    expect(await provider.chargeIdByExecutionIdLoader.load(execution)).toBe(chargeId);

    const {
      rows: [base],
    } = await pool.query<{ id: string }>(
      `INSERT INTO accounter_schema.charges (owner_id) VALUES ($1) RETURNING id`,
      [TEST_OWNER_ID],
    );
    await provider.replaceChargeId({ replaceChargeID: chargeId!, assertChargeID: base!.id });

    expect(await provider.linkedExecutionIdsByChargeIdLoader.load(chargeId!)).toEqual([]);
    expect(await provider.linkedExecutionIdsByChargeIdLoader.load(base!.id)).toEqual([execution]);
    expect(await provider.chargeIdByExecutionIdLoader.load(execution)).toBe(base!.id);
  });
});
