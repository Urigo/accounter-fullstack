import { createRequire } from 'node:module';
import type { PoolClient } from 'pg';
import { createYoga } from 'graphql-yoga';
import { useSchema } from '@envelop/core';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OtsarHahayalCreditCardTransactionInput } from '../../../__generated__/types.js';
import { TestDatabase } from '../../../__tests__/helpers/db-setup.js';
import {
  ensureBusinessForEntity,
  ensureFinancialEntity,
} from '../../../__tests__/helpers/seed-helpers.js';
import { qualifyTable } from '../../../__tests__/helpers/test-db-config.js';
import { makeUUID } from '../../../demo-fixtures/helpers/deterministic-uuid.js';
import { env } from '../../../environment.js';
import { createGraphQLApp } from '../../../modules-app.js';
import { dbCleanupPlugin } from '../../../plugins/db-cleanup-plugin.js';

/**
 * Otsar Hahayal credit-card restatements, end to end: the upload mutation (resolver transaction +
 * accountant-approval reset), the provider's restatement pairing, and the migration triggers that
 * create and then rewrite the linked transaction.
 *
 * All data is synthetic.
 */

// See timeless-dates.integration.test.ts: keep graphql and graphql-modules in one module realm.
vi.mock('graphql', () => createRequire(import.meta.url)('graphql'));

// Workspace packages the app imports but this suite never reaches (and the test job doesn't build).
const unbuiltPackageStub = vi.hoisted(
  () => () =>
    new Proxy(
      {},
      {
        has: () => true,
        get: (_, key) =>
          key === 'then'
            ? undefined
            : () => {
                throw new Error(`${String(key)} is stubbed in the Otsar restatement test`);
              },
      },
    ),
);
vi.mock('@accounter/green-invoice-graphql', unbuiltPackageStub);
vi.mock('@accounter/shaam-uniform-format-generator', unbuiltPackageStub);
vi.mock('@accounter/shaam6111-generator', unbuiltPackageStub);

const ADMIN_ID = makeUUID('business', 'Admin Business');
const SCRAPER_USER_ID = makeUUID('user', 'otsar-restatement-scraper');
const RESOURCE_ID = makeUUID('otsar-card-resource', 'otsar-restatement-card');
const CARD_PAN = 'OTSAR-RESTATEMENT-CARD-1';
const REPLACEMENT_CARD_PAN = 'OTSAR-RESTATEMENT-CARD-2';
const UNKNOWN_CARD_PAN = 'OTSAR-RESTATEMENT-CARD-UNKNOWN';
const SUPPLIER_NAME = 'Otsar Restatement Supplier';

const ILS = 'שקל חדש';

/** The deal as first scraped: name truncated and upper-cased, no notes. */
const provisionalDeal: OtsarHahayalCreditCardTransactionInput = {
  resourceId: RESOURCE_ID,
  maskedPan: CARD_PAN,
  cardType: 1,
  dealGroup: 'localDeals',
  date: '2026-01-15',
  chargeDate: '2026-02-02',
  name: 'ACME HARDWARE',
  dealAmount: 120.5,
  chargeAmount: 120.5,
  notes: '',
  walletType: 0,
  chargeCurrency: ILS,
  dealCurrency: ILS,
  counter: 0,
};

/** The same deal after the bank's restatement: a day earlier, full name, notes filled in. */
const restatedDeal: OtsarHahayalCreditCardTransactionInput = {
  ...provisionalDeal,
  date: '2026-01-14',
  name: 'Acme Hardware Supplies',
  notes: 'Order 1',
};

let db: TestDatabase;
let yoga: { fetch: (url: string, init: RequestInit) => Response | Promise<Response> };
let supplierId: string;
let createdBusinessUserRow = false;

type UploadResult = {
  inserted: number;
  skipped: number;
  insertedIds: string[];
  changedTransactions: { id: string; changedFields: { field: string }[] }[];
};

type GraphQLResponse<T> = { data?: T | null; errors?: { message: string }[] };

const UPLOAD_MUTATION = /* GraphQL */ `
  mutation UploadOtsarCreditCard($transactions: [OtsarHahayalCreditCardTransactionInput!]!) {
    uploadOtsarHahayalCreditCardTransactions(transactions: $transactions) {
      inserted
      skipped
      insertedIds
      changedTransactions {
        id
        changedFields {
          field
        }
      }
    }
  }
`;

async function upload(
  transactions: OtsarHahayalCreditCardTransactionInput[],
): Promise<GraphQLResponse<{ uploadOtsarHahayalCreditCardTransactions: UploadResult }>> {
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: UPLOAD_MUTATION, variables: { transactions } }),
  });
  return (await response.json()) as GraphQLResponse<{
    uploadOtsarHahayalCreditCardTransactions: UploadResult;
  }>;
}

async function uploadOk(transactions: OtsarHahayalCreditCardTransactionInput[]) {
  const json = await upload(transactions);
  expect(json.errors).toBeUndefined();
  return json.data!.uploadOtsarHahayalCreditCardTransactions;
}

async function withAdminClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.getPool().connect();
  try {
    await client.query("SELECT set_config('app.current_business_id', $1, false)", [ADMIN_ID]);
    return await fn(client);
  } finally {
    client.release();
  }
}

type StoredState = {
  sourceRows: { id: string; date: string; name: string; notes: string }[];
  transactions: {
    id: string;
    charge_id: string;
    account_id: string;
    business_id: string | null;
    event_date: string;
    debit_date: string;
    debit_date_override: string | null;
    source_description: string | null;
    is_fee: boolean;
    accountant_status: string;
  }[];
};

async function readState(): Promise<StoredState> {
  return withAdminClient(async client => {
    const { rows: sourceRows } = await client.query(
      `SELECT id, date::text AS date, name, notes
       FROM ${qualifyTable('otsar_hahayal_creditcard_transactions')}
       WHERE resource_id = $1
       ORDER BY date`,
      [RESOURCE_ID],
    );
    const { rows: transactions } = await client.query(
      `SELECT t.id, t.charge_id, t.account_id, t.business_id, t.event_date::text AS event_date,
              t.debit_date::text AS debit_date, t.debit_date_override::text AS debit_date_override,
              t.source_description, t.is_fee, c.accountant_status
       FROM ${qualifyTable('transactions')} t
       JOIN ${qualifyTable('charges')} c ON c.id = t.charge_id
       WHERE t.origin_key = ANY($1::uuid[])
       ORDER BY t.event_date`,
      [sourceRows.map(row => row.id)],
    );
    return { sourceRows, transactions } as StoredState;
  });
}

async function accountIdFor(maskedPan: string): Promise<string> {
  return withAdminClient(async client => {
    const { rows } = await client.query(
      `SELECT id FROM ${qualifyTable('financial_accounts')} WHERE account_number = $1`,
      [maskedPan],
    );
    return rows[0].id as string;
  });
}

/** Classifies and approves a transaction the way a user would after the first upload. */
async function classifyAndApprove(transactionId: string, chargeId: string) {
  await withAdminClient(async client => {
    await client.query(
      `UPDATE ${qualifyTable('transactions')}
       SET business_id = $2, debit_date_override = '2026-02-03', is_fee = true
       WHERE id = $1`,
      [transactionId, supplierId],
    );
    await client.query(
      `UPDATE ${qualifyTable('charges')} SET accountant_status = 'APPROVED' WHERE id = $1`,
      [chargeId],
    );
  });
}

/** Removes the uploaded deals and everything their triggers created. */
async function removeUploads() {
  await withAdminClient(async client => {
    const { rows } = await client.query<{ id: string; charge_id: string | null }>(
      `SELECT s.id, t.charge_id
       FROM ${qualifyTable('otsar_hahayal_creditcard_transactions')} s
       LEFT JOIN ${qualifyTable('transactions')} t ON t.origin_key = s.id
       WHERE s.resource_id = $1`,
      [RESOURCE_ID],
    );
    const sourceIds = rows.map(row => row.id);
    const chargeIds = rows.map(row => row.charge_id).filter(Boolean);
    // transactions.source_id has no cascade; the raw list cascades from the source rows.
    await client.query(`DELETE FROM ${qualifyTable('transactions')} WHERE origin_key = ANY($1)`, [
      sourceIds,
    ]);
    await client.query(
      `DELETE FROM ${qualifyTable('otsar_hahayal_creditcard_transactions')} WHERE id = ANY($1)`,
      [sourceIds],
    );
    await client.query(`DELETE FROM ${qualifyTable('charges')} WHERE id = ANY($1)`, [chargeIds]);
  });
}

beforeAll(async () => {
  db = new TestDatabase();
  await db.connect();
  await db.ensureLatestSchema();
  await db.seedAdmin();

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [ADMIN_ID]);
    // The upload mutation requires the `scraper` role.
    const { rowCount } = await client.query(
      `INSERT INTO ${qualifyTable('business_users')} (user_id, business_id, role_id)
       VALUES ($1, $2, 'scraper') ON CONFLICT DO NOTHING`,
      [SCRAPER_USER_ID, ADMIN_ID],
    );
    createdBusinessUserRow = rowCount === 1;
    for (const pan of [CARD_PAN, REPLACEMENT_CARD_PAN]) {
      await client.query(
        `INSERT INTO ${qualifyTable('financial_accounts')}
           (account_number, account_name, private_business, owner, type, owner_id)
         SELECT $1, $1, 'BUSINESS', $2, 'CREDIT_CARD', $2
         WHERE NOT EXISTS (
           SELECT 1 FROM ${qualifyTable('financial_accounts')} WHERE account_number = $1
         )`,
        [pan, ADMIN_ID],
      );
    }
    const supplier = await ensureFinancialEntity(client, {
      name: SUPPLIER_NAME,
      type: 'business',
      ownerId: ADMIN_ID,
    });
    await ensureBusinessForEntity(client, supplier.id);
    supplierId = supplier.id;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const pool = db.getPool();
  const { application, transformedSchema } = await createGraphQLApp(env, pool);
  yoga = createYoga({
    maskedErrors: false,
    logging: false,
    plugins: [dbCleanupPlugin(), useGraphQLModules(application), useSchema(transformedSchema)],
    context: () => ({ env, pool, rawAuth: { authType: 'devBypass', token: SCRAPER_USER_ID } }),
  });
});

beforeEach(removeUploads);

afterAll(async () => {
  // The shared pool itself is closed by the vitest global teardown.
  if (!db) return;
  await removeUploads();
  await withAdminClient(async client => {
    await client.query(
      `DELETE FROM ${qualifyTable('financial_accounts')} WHERE account_number = ANY($1)`,
      [[CARD_PAN, REPLACEMENT_CARD_PAN]],
    );
    await client.query(`DELETE FROM ${qualifyTable('businesses')} WHERE id = $1`, [supplierId]);
    await client.query(`DELETE FROM ${qualifyTable('financial_entities')} WHERE id = $1`, [
      supplierId,
    ]);
    if (createdBusinessUserRow) {
      await client.query(`DELETE FROM ${qualifyTable('business_users')} WHERE user_id = $1`, [
        SCRAPER_USER_ID,
      ]);
    }
  });
});

describe('uploadOtsarHahayalCreditCardTransactions — restatements', () => {
  it('rewrites a restated deal in place, keeps its classification and re-flags its charge', async () => {
    const first = await uploadOk([provisionalDeal]);
    expect(first.inserted).toBe(1);

    const [original] = (await readState()).transactions;
    await classifyAndApprove(original.id, original.charge_id);

    const second = await uploadOk([restatedDeal]);
    expect(second.inserted).toBe(0);
    expect(second.changedTransactions).toHaveLength(1);
    expect(second.changedTransactions[0].changedFields.map(f => f.field)).toEqual(
      expect.arrayContaining(['date', 'name', 'notes']),
    );

    const { sourceRows, transactions } = await readState();
    expect(sourceRows).toHaveLength(1);
    expect(sourceRows[0]).toMatchObject({
      date: '2026-01-14',
      name: 'Acme Hardware Supplies',
      notes: 'Order 1',
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toEqual({
      // Same row, same charge and account; source-derived fields follow the restatement.
      id: original.id,
      charge_id: original.charge_id,
      account_id: original.account_id,
      event_date: '2026-01-14',
      debit_date: '2026-02-02',
      source_description: 'Acme Hardware Supplies Order 1',
      // User edits survive.
      business_id: supplierId,
      debit_date_override: '2026-02-03',
      is_fee: true,
      // The charge's data changed under the accountant: back to review.
      accountant_status: 'PENDING',
    });
  });

  it('treats a repeated upload of the restated deal as a no-op', async () => {
    await uploadOk([provisionalDeal]);
    await uploadOk([restatedDeal]);
    const [restated] = (await readState()).transactions;
    await classifyAndApprove(restated.id, restated.charge_id);

    const again = await uploadOk([restatedDeal]);
    expect(again).toMatchObject({ inserted: 0, skipped: 1, changedTransactions: [] });

    const { sourceRows, transactions } = await readState();
    expect(sourceRows).toHaveLength(1);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      id: restated.id,
      event_date: '2026-01-14',
      accountant_status: 'APPROVED',
    });
  });

  it('moves the transaction to the new card account when the restated deal has another PAN', async () => {
    await uploadOk([provisionalDeal]);
    const [original] = (await readState()).transactions;
    expect(original.account_id).toBe(await accountIdFor(CARD_PAN));

    await uploadOk([{ ...restatedDeal, maskedPan: REPLACEMENT_CARD_PAN }]);

    const { transactions } = await readState();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].id).toBe(original.id);
    expect(transactions[0].account_id).toBe(await accountIdFor(REPLACEMENT_CARD_PAN));
  });

  it('rolls the whole upload back on failure, so a retry still re-flags the charge', async () => {
    await uploadOk([provisionalDeal]);
    const [original] = (await readState()).transactions;
    await classifyAndApprove(original.id, original.charge_id);

    // The new deal's card has no account, so its insert trigger raises after the restatement
    // update has already run in the same upload.
    const failing = await upload([
      restatedDeal,
      { ...provisionalDeal, maskedPan: UNKNOWN_CARD_PAN, name: 'OTHER SHOP', dealAmount: 7, chargeAmount: 7 },
    ]);
    expect(failing.errors?.length).toBeGreaterThan(0);

    const afterFailure = await readState();
    expect(afterFailure.sourceRows).toHaveLength(1);
    expect(afterFailure.sourceRows[0]).toMatchObject({ date: '2026-01-15', name: 'ACME HARDWARE' });
    expect(afterFailure.transactions).toHaveLength(1);
    expect(afterFailure.transactions[0]).toMatchObject({
      id: original.id,
      event_date: '2026-01-15',
      accountant_status: 'APPROVED',
    });

    const retry = await uploadOk([restatedDeal]);
    expect(retry.changedTransactions).toHaveLength(1);

    const afterRetry = await readState();
    expect(afterRetry.transactions).toHaveLength(1);
    expect(afterRetry.transactions[0]).toMatchObject({
      id: original.id,
      event_date: '2026-01-14',
      accountant_status: 'PENDING',
    });
  });
});
