import type { PoolClient } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { expenseScenarioA } from '../../../__tests__/fixtures/expenses/expense-scenario-a.js';
import { buildAdminContextFromDb } from '../../../__tests__/helpers/admin-context-builder.js';
import { TestDatabase, withTestTransaction } from '../../../__tests__/helpers/db-setup.js';
import { insertFixture } from '../../../__tests__/helpers/fixture-loader.js';
import { withFreshIds } from '../../../__tests__/helpers/fresh-fixture.js';
import { qualifyTable } from '../../../__tests__/helpers/test-db-config.js';
import { makeUUID } from '../../../demo-fixtures/helpers/deterministic-uuid.js';
import type { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { ChargesAuthorizationProvider } from '../providers/charges-authorization.provider.js';
import { ChargesProvider } from '../providers/charges.provider.js';

/**
 * A paged charges list picks its page from `charge_list_facts` and derives the full rows for that
 * page only. An unpaged call still derives every row in one query. Both have to agree: the same
 * charges, in the same order, with the same total.
 */

// Ids of its own, so this file does not share rows with other suites that insert the scenario.
const { fixture: scenario, idOf } = withFreshIds(expenseScenarioA);
const OWNER_ID = idOf(makeUUID('business', 'admin-business-scenario-a'));
const SUPPLIER_ID = idOf(makeUUID('business', 'supplier-local-ltd'));
const CHARGE_ID = idOf(makeUUID('charge', 'charge-office-supplies'));
const TRANSACTION_ID = idOf(makeUUID('transaction', 'transaction-supplies-payment'));

type ListParams = Parameters<ChargesProvider['getChargesByFilters']>[0];

let db: TestDatabase;

beforeAll(async () => {
  db = new TestDatabase();
  await db.connect();
  await db.ensureLatestSchema();
  await db.seedAdmin();
});

/**
 * The scenario's charge (a 500 ILS expense with a receipt, January 2024), a second charge holding
 * a copy of its transaction dated a month later, and a third with nothing attached.
 */
function withThreeCharges(
  fn: (provider: ChargesProvider, chargeIds: string[]) => Promise<void>,
): Promise<void> {
  return withTestTransaction(db.getPool(), async (client: PoolClient) => {
    const adminContext = await buildAdminContextFromDb(client);
    await insertFixture(client, scenario, adminContext.ownerId);
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [OWNER_ID]);
    // A tenant's counterparties are its own; the fixture files this one under the seeded admin.
    await client.query(`UPDATE ${qualifyTable('businesses')} SET owner_id = $1 WHERE id = $2`, [
      OWNER_ID,
      SUPPLIER_ID,
    ]);

    const { rows } = await client.query(
      `INSERT INTO ${qualifyTable('charges')} (owner_id) VALUES ($1), ($1) RETURNING id`,
      [OWNER_ID],
    );
    const [laterChargeId, emptyChargeId] = rows.map(row => row.id as string);
    await client.query(
      `INSERT INTO ${qualifyTable('transactions')}
         (account_id, charge_id, source_id, source_description, currency, event_date, debit_date,
          amount, current_balance, business_id, owner_id, source_reference, source_origin,
          origin_key)
       SELECT account_id, $1, source_id, 'later payment', currency, '2024-02-20', '2024-02-21',
              1200, current_balance, business_id, owner_id, 'later-payment-ref', source_origin,
              'later-payment-key'
       FROM ${qualifyTable('transactions')} WHERE id = $2`,
      [laterChargeId, TRANSACTION_ID],
    );
    await client.query(`SELECT accounter_schema.refresh_charge_list_facts($1::uuid[])`, [
      [CHARGE_ID, laterChargeId, emptyChargeId],
    ]);

    const provider = new ChargesProvider(
      client as unknown as TenantAwareDBClient,
      {} as ChargesAuthorizationProvider,
    );
    await fn(provider, [CHARGE_ID, laterChargeId!, emptyChargeId!]);
  });
}

/** Every page of one row, put back together, next to the unpaged list. */
async function expectPagesToMatchTheWholeList(provider: ChargesProvider, params: ListParams) {
  const whole = await provider.getChargesByFilters(params);
  const paged = [];
  for (let offset = 0; offset < whole.length + 1; offset++) {
    const page = await provider.getChargesByFilters({ ...params, limit: 1, offset });
    for (const row of page) {
      expect(Number(row.total_count)).toBe(whole.length);
    }
    paged.push(...page);
  }
  expect(paged.map(row => row.id)).toEqual(whole.map(row => row.id));
  expect(paged.map(row => ({ ...row, total_count: null }))).toEqual(
    whole.map(row => ({ ...row, total_count: null })),
  );
  return whole.map(row => row.id);
}

describe('paged charges list', () => {
  it.each([
    ['event_date', true],
    ['event_date', false],
    ['event_amount', true],
    ['event_amount', false],
    ['abs_event_amount', true],
    ['abs_event_amount', false],
  ] as const)('pages in the order of the whole list, sorted by %s (asc: %s)', (sortColumn, asc) =>
    withThreeCharges(async provider => {
      const ids = await expectPagesToMatchTheWholeList(provider, {
        ownerIds: [OWNER_ID],
        sortColumn,
        asc,
      });
      expect(ids).toHaveLength(3);
    }),
  );

  it.each<[string, ListParams, number]>([
    ['expenses only', { chargeType: 'EXPENSE' }, 1],
    ['income only', { chargeType: 'INCOME' }, 1],
    ['a main-date range', { fromDate: '2024-02-01', toDate: '2024-02-29' }, 1],
    ['an any-date range', { fromAnyDate: '2024-01-01', toAnyDate: '2024-01-31' }, 1],
    ['without documents', { withoutDocuments: true }, 2],
    ['without receipt', { withoutReceipt: true }, 2],
    ['without transactions', { withoutTransactions: true }, 1],
    ['without ledger', { withoutLedger: true }, 3],
    ['without tags', { withoutTags: true }, 3],
    ['by business', { businessIds: [SUPPLIER_ID] }, 2],
    ['excluding a business', { excludedBusinessIds: [SUPPLIER_ID] }, 1],
    ['missing a counterparty', { withMissingCounterparty: true }, 0],
  ])('applies the filter "%s" as the whole list does', (_name, filter, expected) =>
    withThreeCharges(async provider => {
      const ids = await expectPagesToMatchTheWholeList(provider, {
        ownerIds: [OWNER_ID],
        ...filter,
      });
      expect(ids).toHaveLength(expected);
    }),
  );

  it('returns nothing for a page past the end', () =>
    withThreeCharges(async provider => {
      const page = await provider.getChargesByFilters({
        ownerIds: [OWNER_ID],
        limit: 10,
        offset: 30,
      });
      expect(page).toEqual([]);
    }));

  it('still searches text through the single query', () =>
    withThreeCharges(async (provider, [, laterChargeId]) => {
      const page = await provider.getChargesByFilters({
        ownerIds: [OWNER_ID],
        freeText: 'later payment',
        limit: 10,
        offset: 0,
      });
      expect(page.map(row => row.id)).toEqual([laterChargeId]);
      expect(Number(page[0]!.total_count)).toBe(1);
    }));
});
