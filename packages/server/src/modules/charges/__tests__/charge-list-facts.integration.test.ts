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
import type { IGetChargesByFiltersResult } from '../types.js';

/**
 * `charge_list_facts` stores, per charge, the values the charges list sorts and filters by. Its
 * refresh function repeats expressions of the list query (`getChargesByFilters`), so the two can
 * drift apart. These tests hold them together: after every kind of write that feeds the list,
 * the stored row has to equal what the list query derives for the same charge.
 */

// Ids of its own, so this file does not share rows with other suites that insert the scenario.
const { fixture: scenario, idOf } = withFreshIds(expenseScenarioA);
const OWNER_ID = idOf(makeUUID('business', 'admin-business-scenario-a'));
const SUPPLIER_ID = idOf(makeUUID('business', 'supplier-local-ltd'));
const CHARGE_ID = idOf(makeUUID('charge', 'charge-office-supplies'));
const TRANSACTION_ID = idOf(makeUUID('transaction', 'transaction-supplies-payment'));
const DOCUMENT_ID = idOf(makeUUID('document', 'document-supplies-receipt'));

type Facts = {
  sort_date: unknown;
  sort_date_tiebreak: unknown;
  event_amount: number | null;
  transactions_event_amount: number | null;
  main_min_date: unknown;
  main_max_date: unknown;
  any_min_date: unknown;
  any_max_date: unknown;
  invoices_count: number;
  receipts_count: number;
  documents_count: number;
  transactions_count: number;
  ledger_count: number;
  has_open_documents: boolean;
  missing_counterparty: boolean;
  business_ids: string[];
  main_business_id: string | null;
  account_ids: string[];
};

const day = (value: unknown): string | null =>
  value == null ? null : value instanceof Date ? value.toISOString() : String(value);
const amount = (value: unknown): number | null => (value == null ? null : Number(value));
const firstOf = (...values: unknown[]): string | null =>
  values.map(day).find(value => value !== null) ?? null;
const ids = (value: unknown): string[] => [...((value as string[] | null) ?? [])].sort();

/** The earliest or latest of the given dates. Both ISO strings and `YYYY-MM-DD` sort as text. */
function boundOf(pick: 'min' | 'max', ...values: unknown[]): string | null {
  const days = values
    .map(day)
    .filter((value): value is string => value !== null)
    .sort();
  return (pick === 'min' ? days[0] : days.at(-1)) ?? null;
}

/** What the list query derives for a charge, written the way its WHERE and ORDER BY use it. */
function factsOfListRow(row: IGetChargesByFiltersResult): Facts {
  return {
    sort_date: firstOf(
      row.transactions_min_debit_date,
      row.transactions_min_event_date,
      row.documents_min_date,
      row.ledger_min_value_date,
      row.ledger_min_invoice_date,
      row.securities_executions_min_date,
    ),
    sort_date_tiebreak: firstOf(row.documents_min_date, row.transactions_min_event_date),
    event_amount: amount(row.event_amount),
    transactions_event_amount: amount(row.transactions_event_amount),
    main_min_date: firstOf(
      row.documents_min_date,
      row.transactions_min_event_date,
      row.securities_executions_min_date,
    ),
    main_max_date: firstOf(
      row.documents_max_date,
      row.transactions_max_event_date,
      row.securities_executions_max_date,
    ),
    any_min_date: boundOf(
      'min',
      row.documents_min_date,
      row.transactions_min_event_date,
      row.transactions_min_debit_date,
      row.ledger_min_invoice_date,
      row.ledger_min_value_date,
      row.securities_executions_min_date,
    ),
    any_max_date: boundOf(
      'max',
      row.documents_max_date,
      row.transactions_max_event_date,
      row.transactions_max_debit_date,
      row.ledger_max_invoice_date,
      row.ledger_max_value_date,
      row.securities_executions_max_date,
    ),
    invoices_count: Number(row.invoices_count ?? 0),
    receipts_count: Number(row.receipts_count ?? 0),
    documents_count: Number(row.documents_count ?? 0),
    transactions_count: Number(row.transactions_count ?? 0),
    ledger_count: Number(row.ledger_count ?? 0),
    has_open_documents: row.open_docs_flag ?? false,
    missing_counterparty:
      (row.missing_counterparty_transactions ?? false) ||
      (row.missing_counterparty_documents ?? false),
    business_ids: ids(row.business_array),
    main_business_id: (row.business_id as string | null) ?? null,
    account_ids: ids(row.account_array),
  };
}

async function listRow(client: PoolClient): Promise<IGetChargesByFiltersResult> {
  const provider = new ChargesProvider(
    client as unknown as TenantAwareDBClient,
    {} as ChargesAuthorizationProvider,
  );
  const rows = await provider.getChargesByFilters({ IDs: [CHARGE_ID] });
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

async function storedFacts(client: PoolClient): Promise<Facts> {
  const { rows } = await client.query(
    `SELECT * FROM ${qualifyTable('charge_list_facts')} WHERE charge_id = $1`,
    [CHARGE_ID],
  );
  expect(rows).toHaveLength(1);
  const row = rows[0];
  return {
    sort_date: day(row.sort_date),
    sort_date_tiebreak: day(row.sort_date_tiebreak),
    event_amount: amount(row.event_amount),
    transactions_event_amount: amount(row.transactions_event_amount),
    main_min_date: day(row.main_min_date),
    main_max_date: day(row.main_max_date),
    any_min_date: day(row.any_min_date),
    any_max_date: day(row.any_max_date),
    invoices_count: row.invoices_count,
    receipts_count: row.receipts_count,
    documents_count: row.documents_count,
    transactions_count: row.transactions_count,
    ledger_count: row.ledger_count,
    has_open_documents: row.has_open_documents,
    missing_counterparty: row.missing_counterparty,
    business_ids: ids(row.business_ids),
    main_business_id: row.main_business_id,
    account_ids: ids(row.account_ids),
  };
}

/** The stored row agrees with the list query, and returns it for further assertions. */
async function expectFactsToMatchTheList(client: PoolClient): Promise<Facts> {
  const stored = await storedFacts(client);
  expect(stored).toEqual(factsOfListRow(await listRow(client)));
  return stored;
}

/** Runs `fn` on the scenario's charge inside a transaction that is rolled back afterwards. */
function withScenario(fn: (client: PoolClient) => Promise<void>): Promise<void> {
  return withTestTransaction(db.getPool(), async client => {
    const adminContext = await buildAdminContextFromDb(client);
    await insertFixture(client, scenario, adminContext.ownerId);
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [OWNER_ID]);
    // The fixture files the supplier under the seeded admin business. A tenant's counterparties
    // are its own, and one owned by another business is invisible to the charge's owner and so
    // to its facts. Nothing tracks a business changing owner, hence the explicit refresh.
    await client.query(`UPDATE ${qualifyTable('businesses')} SET owner_id = $1 WHERE id = $2`, [
      OWNER_ID,
      SUPPLIER_ID,
    ]);
    await client.query(`SELECT accounter_schema.refresh_charge_list_facts(ARRAY[$1::uuid])`, [
      CHARGE_ID,
    ]);
    await fn(client);
  });
}

let db: TestDatabase;

beforeAll(async () => {
  db = new TestDatabase();
  await db.connect();
  await db.ensureLatestSchema();
  await db.seedAdmin();
});

describe('charge_list_facts', () => {
  it('holds a row for a charge as soon as its rows are inserted', () =>
    withScenario(async client => {
      const facts = await expectFactsToMatchTheList(client);
      expect(facts).toMatchObject({
        transactions_count: 1,
        documents_count: 1,
        receipts_count: 1,
        invoices_count: 0,
        transactions_event_amount: -500,
        main_business_id: SUPPLIER_ID,
        business_ids: [SUPPLIER_ID],
      });
    }));

  it('gives a charge with nothing attached a row of its own', () =>
    withScenario(async client => {
      const { rows } = await client.query(
        `INSERT INTO ${qualifyTable('charges')} (owner_id) VALUES ($1) RETURNING id`,
        [OWNER_ID],
      );
      const facts = await client.query(
        `SELECT transactions_count, documents_count, sort_date
         FROM ${qualifyTable('charge_list_facts')} WHERE charge_id = $1`,
        [rows[0].id],
      );
      expect(facts.rows).toEqual([{ transactions_count: 0, documents_count: 0, sort_date: null }]);
    }));

  it('follows a transaction that changes amount and date', () =>
    withScenario(async client => {
      await client.query(
        `UPDATE ${qualifyTable('transactions')}
         SET amount = -620, debit_date_override = '2024-02-03' WHERE id = $1`,
        [TRANSACTION_ID],
      );
      const facts = await expectFactsToMatchTheList(client);
      expect(facts.transactions_event_amount).toBe(-620);
      expect(facts.sort_date).toBe(day((await listRow(client)).transactions_min_debit_date));
    }));

  it('follows a transaction that loses its counterparty', () =>
    withScenario(async client => {
      await client.query(
        `UPDATE ${qualifyTable('transactions')} SET business_id = NULL WHERE id = $1`,
        [TRANSACTION_ID],
      );
      const facts = await expectFactsToMatchTheList(client);
      expect(facts.missing_counterparty).toBe(true);
    }));

  it('follows a document that changes type, and one that is removed', () =>
    withScenario(async client => {
      await client.query(
        `UPDATE ${qualifyTable('documents')} SET type = 'INVOICE', total_amount = 750 WHERE id = $1`,
        [DOCUMENT_ID],
      );
      const asInvoice = await expectFactsToMatchTheList(client);
      expect(asInvoice).toMatchObject({ invoices_count: 1, receipts_count: 0, event_amount: -750 });

      await client.query(`DELETE FROM ${qualifyTable('documents')} WHERE id = $1`, [DOCUMENT_ID]);
      const withoutDocument = await expectFactsToMatchTheList(client);
      expect(withoutDocument).toMatchObject({ documents_count: 0, event_amount: -500 });
    }));

  it('updates both charges when a transaction moves from one to the other', () =>
    withScenario(async client => {
      const { rows } = await client.query(
        `INSERT INTO ${qualifyTable('charges')} (owner_id) VALUES ($1) RETURNING id`,
        [OWNER_ID],
      );
      const otherChargeId = rows[0].id as string;
      await client.query(
        `UPDATE ${qualifyTable('transactions')} SET charge_id = $1 WHERE id = $2`,
        [otherChargeId, TRANSACTION_ID],
      );

      const source = await expectFactsToMatchTheList(client);
      expect(source.transactions_count).toBe(0);
      const target = await client.query(
        `SELECT transactions_count, transactions_event_amount::float8 AS amount
         FROM ${qualifyTable('charge_list_facts')} WHERE charge_id = $1`,
        [otherChargeId],
      );
      expect(target.rows).toEqual([{ transactions_count: 1, amount: -500 }]);
    }));

  it('follows ledger records as they are written and removed', () =>
    withScenario(async client => {
      await client.query(
        `INSERT INTO ${qualifyTable('ledger_records')}
           (owner_id, charge_id, debit_entity1, credit_entity1, debit_local_amount1,
            credit_local_amount1, description, invoice_date, value_date, currency)
         VALUES ($1, $2, $3, $4, 500, 500, 'facts test', '2023-12-30', '2024-03-01', 'ILS')`,
        [
          OWNER_ID,
          CHARGE_ID,
          idOf(makeUUID('tax-category', 'expense-general')),
          idOf(makeUUID('tax-category', 'bank-account-tax-category')),
        ],
      );
      const withLedger = await expectFactsToMatchTheList(client);
      expect(withLedger.ledger_count).toBe(1);

      await client.query(`DELETE FROM ${qualifyTable('ledger_records')} WHERE charge_id = $1`, [
        CHARGE_ID,
      ]);
      const withoutLedger = await expectFactsToMatchTheList(client);
      expect(withoutLedger.ledger_count).toBe(0);
    }));

  it('removes the row with its charge', () =>
    withScenario(async client => {
      await client.query(`DELETE FROM ${qualifyTable('documents')} WHERE charge_id = $1`, [
        CHARGE_ID,
      ]);
      await client.query(`DELETE FROM ${qualifyTable('transactions')} WHERE charge_id = $1`, [
        CHARGE_ID,
      ]);
      await client.query(`DELETE FROM ${qualifyTable('charges')} WHERE id = $1`, [CHARGE_ID]);
      const { rows } = await client.query(
        `SELECT 1 FROM ${qualifyTable('charge_list_facts')} WHERE charge_id = $1`,
        [CHARGE_ID],
      );
      expect(rows).toHaveLength(0);
    }));
});
