import { createRequire } from 'node:module';
import { createYoga } from 'graphql-yoga';
import { useSchema } from '@envelop/core';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUUID } from '../demo-fixtures/helpers/deterministic-uuid.js';
import { env } from '../environment.js';
import { createGraphQLApp } from '../modules-app.js';
import { dbCleanupPlugin } from '../plugins/db-cleanup-plugin.js';
import { CountryCode, Currency } from '../shared/enums.js';
import {
  createBusiness,
  createCharge,
  createDocument,
  createFinancialAccount,
  createTaxCategory,
  createTransaction,
} from './factories/index.js';
import { TestDatabase } from './helpers/db-setup.js';
import { insertFixture } from './helpers/fixture-loader.js';
import type { Fixture } from './helpers/fixture-types.js';
import { qualifyTable } from './helpers/test-db-config.js';
import { TEST_TIMEZONES, useTimezone } from './helpers/timezones.js';

/**
 * Date-only values (`yyyy-mm-dd`) end to end: Postgres `date` columns → providers → resolvers →
 * scalars → the JSON a client receives, and back through filters and mutation inputs (#4560).
 *
 * Every assertion runs under each of `TEST_TIMEZONES`: a calendar day must come out exactly as it
 * went in, whatever timezone the server process runs in.
 *
 * The operations run through the real application (`createGraphQLApp`): the same modules,
 * providers, scalars and auth directives the server serves, with a dev-bypass identity in place of
 * the HTTP auth plugin.
 */

/*
 * Under vitest, source files resolve `graphql` to its ESM build while graphql-modules (loaded by
 * Node from node_modules) gets the CommonJS one, and the two do not recognise each other's schema
 * objects — graphql-modules would not see the server's scalars as scalars. Pointing this file's
 * module graph at the CommonJS copy puts everything in one realm, as it is in production.
 */
vi.mock('graphql', () => createRequire(import.meta.url)('graphql'));

/*
 * The app imports these workspace packages, which only exist once built (the Green Invoice SDK is
 * even generated), and the test job does not build them. Nothing here reaches Green Invoice or the
 * SHAAM generators, so each is replaced by a stub whose every export is an inert function.
 */
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
                throw new Error(`${String(key)} is stubbed in the timeless dates test`);
              },
      },
    ),
);
vi.mock('@accounter/green-invoice-graphql', unbuiltPackageStub);
vi.mock('@accounter/shaam-uniform-format-generator', unbuiltPackageStub);
vi.mock('@accounter/shaam6111-generator', unbuiltPackageStub);

const ADMIN_ID = makeUUID('business', 'Admin Business');
const USER_ID = makeUUID('user', 'timeless-dates-user');
const SUPPLIER_ID = makeUUID('business', 'timeless-dates-supplier');
const EXPENSE_TAX_CATEGORY_ID = makeUUID('tax-category', 'timeless-dates-expense');
const BANK_TAX_CATEGORY_ID = makeUUID('tax-category', 'timeless-dates-bank');
const ACCOUNT_NUMBER = 'TIMELESS-DATES-BANK-001';

/** A receipt-backed expense whose dates sit on month boundaries. */
const CHARGE_ID = makeUUID('charge', 'timeless-dates-charge');
const TRANSACTION_ID = makeUUID('transaction', 'timeless-dates-transaction');
const DOCUMENT_ID = makeUUID('document', 'timeless-dates-document');

/** A VAT invoice dated on the first day of its month, for the VAT report month boundaries. */
const VAT_CHARGE_ID = makeUUID('charge', 'timeless-dates-vat-charge');
const VAT_TRANSACTION_ID = makeUUID('transaction', 'timeless-dates-vat-transaction');
const VAT_DOCUMENT_ID = makeUUID('document', 'timeless-dates-vat-document');

const EVENT_DATE = '2026-05-01';
const DEBIT_DATE = '2026-05-31';
const DOCUMENT_DATE = '2026-05-01';
const VAT_DOCUMENT_DATE = '2026-05-01';
/** Seeded by `seedAdminCore`: a first of January, so a one-day shift also changes the year. */
const DATE_ESTABLISHED = '2020-01-01';

const fixture: Fixture = {
  businesses: {
    businesses: [
      // The seeded admin business: listed so the fixture validates; `ensure*` leaves it as is.
      createBusiness({ id: ADMIN_ID, name: 'Admin Business', country: CountryCode.Israel }),
      createBusiness({
        id: SUPPLIER_ID,
        name: 'Timeless Dates Supplier',
        country: CountryCode.Israel,
        governmentId: '514000000',
        isReceiptEnough: true,
        ownerId: ADMIN_ID,
      }),
    ],
  },
  taxCategories: {
    taxCategories: [
      createTaxCategory({
        id: EXPENSE_TAX_CATEGORY_ID,
        name: 'Timeless Dates Expenses',
        ownerId: ADMIN_ID,
      }),
      createTaxCategory({ id: BANK_TAX_CATEGORY_ID, name: 'Timeless Dates Bank', ownerId: ADMIN_ID }),
    ],
  },
  accounts: {
    accounts: [
      createFinancialAccount({
        accountNumber: ACCOUNT_NUMBER,
        type: 'BANK_ACCOUNT',
        ownerId: ADMIN_ID,
      }),
    ],
  },
  accountTaxCategories: {
    mappings: [
      {
        accountNumber: ACCOUNT_NUMBER,
        currency: Currency.Ils,
        taxCategoryId: BANK_TAX_CATEGORY_ID,
        ownerId: ADMIN_ID,
      },
    ],
  },
  charges: {
    charges: [
      createCharge(
        { owner_id: ADMIN_ID, tax_category_id: EXPENSE_TAX_CATEGORY_ID },
        { id: CHARGE_ID, user_description: 'Timeless dates receipt' },
      ),
      createCharge(
        { owner_id: ADMIN_ID, tax_category_id: EXPENSE_TAX_CATEGORY_ID },
        { id: VAT_CHARGE_ID, user_description: 'Timeless dates VAT invoice' },
      ),
    ],
  },
  transactions: {
    transactions: [
      createTransaction(
        {
          charge_id: CHARGE_ID,
          business_id: SUPPLIER_ID,
          amount: '-500.00',
          currency: Currency.Ils,
          event_date: EVENT_DATE,
          is_fee: false,
          owner_id: ADMIN_ID,
        },
        {
          id: TRANSACTION_ID,
          account_id: ACCOUNT_NUMBER,
          debit_date: DEBIT_DATE,
          current_balance: '0',
          owner_id: ADMIN_ID,
        },
      ),
      createTransaction(
        {
          charge_id: VAT_CHARGE_ID,
          business_id: SUPPLIER_ID,
          amount: '-1180.00',
          currency: Currency.Ils,
          event_date: VAT_DOCUMENT_DATE,
          is_fee: false,
          owner_id: ADMIN_ID,
        },
        {
          id: VAT_TRANSACTION_ID,
          account_id: ACCOUNT_NUMBER,
          debit_date: VAT_DOCUMENT_DATE,
          current_balance: '0',
          owner_id: ADMIN_ID,
        },
      ),
    ],
  },
  documents: {
    documents: [
      createDocument(
        {
          charge_id: CHARGE_ID,
          creditor_id: SUPPLIER_ID,
          debtor_id: ADMIN_ID,
          type: 'RECEIPT',
          total_amount: 500,
          currency_code: Currency.Ils,
          date: DOCUMENT_DATE,
          owner_id: ADMIN_ID,
        },
        { id: DOCUMENT_ID, serial_number: 'TIMELESS-DATES-001', owner_id: ADMIN_ID },
      ),
      createDocument(
        {
          charge_id: VAT_CHARGE_ID,
          creditor_id: SUPPLIER_ID,
          debtor_id: ADMIN_ID,
          type: 'INVOICE',
          total_amount: 1180,
          currency_code: Currency.Ils,
          date: VAT_DOCUMENT_DATE,
          owner_id: ADMIN_ID,
        },
        {
          id: VAT_DOCUMENT_ID,
          serial_number: 'TIMELESS-DATES-002',
          vat_amount: 180,
          owner_id: ADMIN_ID,
        },
      ),
    ],
  },
};

// ── Operations ───────────────────────────────────────────────────────────────

const CHARGE_DATES_QUERY = /* GraphQL */ `
  query TimelessDatesCharge($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      minEventDate
      maxEventDate
      minDebitDate
      maxDebitDate
      minDocumentsDate
      maxDocumentsDate
      transactions {
        id
        eventDate
        effectiveDate
        sourceEffectiveDate
      }
      additionalDocuments {
        id
        ... on FinancialDocument {
          date
          vatReportDateOverride
        }
      }
    }
  }
`;

const REGENERATE_LEDGER_MUTATION = /* GraphQL */ `
  mutation TimelessDatesRegenerateLedger($chargeIds: [UUID!]!) {
    regenerateLedgerRecords(chargeIds: $chargeIds) {
      __typename
      ... on CommonError {
        message
      }
    }
  }
`;

const CHARGE_LEDGER_QUERY = /* GraphQL */ `
  query TimelessDatesChargeLedger($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      ledger {
        records {
          id
          invoiceDate
          valueDate
        }
      }
    }
  }
`;

const LEDGER_BY_DATES_QUERY = /* GraphQL */ `
  query TimelessDatesLedgerByDates($fromDate: TimelessDate!, $toDate: TimelessDate!) {
    ledgerRecordsByDates(fromDate: $fromDate, toDate: $toDate) {
      id
    }
  }
`;

const CHARGES_BY_FILTERS_QUERY = /* GraphQL */ `
  query TimelessDatesChargesByFilters($filters: ChargeFilter) {
    allCharges(filters: $filters) {
      nodes {
        id
      }
    }
  }
`;

const DOCUMENTS_BY_FILTERS_QUERY = /* GraphQL */ `
  query TimelessDatesDocumentsByFilters($filters: DocumentsFilters!) {
    documentsByFilters(filters: $filters) {
      id
    }
  }
`;

const UPDATE_DOCUMENT_DATE_MUTATION = /* GraphQL */ `
  mutation TimelessDatesUpdateDocument($documentId: UUID!, $fields: UpdateDocumentFieldsInput!) {
    updateDocument(documentId: $documentId, fields: $fields) {
      __typename
      ... on CommonError {
        message
      }
    }
  }
`;

const UPDATE_TRANSACTION_MUTATION = /* GraphQL */ `
  mutation TimelessDatesUpdateTransaction(
    $transactionId: UUID!
    $fields: UpdateTransactionInput!
  ) {
    updateTransaction(transactionId: $transactionId, fields: $fields) {
      __typename
      ... on CommonError {
        message
      }
    }
  }
`;

const VAT_REPORT_QUERY = /* GraphQL */ `
  query TimelessDatesVatReport($filters: VatReportFilter!) {
    vatReport(filters: $filters) {
      expenses {
        documentId
        documentDate
      }
      income {
        documentId
      }
    }
  }
`;

const ADMIN_CONTEXT_QUERY = /* GraphQL */ `
  query TimelessDatesAdminContext {
    adminContext {
      dateEstablished
    }
  }
`;

// ── Harness ──────────────────────────────────────────────────────────────────

type GraphQLResponse<T> = { data?: T; errors?: Array<{ message: string }> };

let db: TestDatabase;
let yoga: { fetch: (url: string, init: RequestInit) => Response | Promise<Response> };
/** Whether this suite created the admin's `businesses_admin` row (and so must remove it). */
let createdBusinessesAdminRow = false;
/** The VAT rate the VAT report needs for the invoice's date, when the DB had none. */
const VAT_RATE_DATE = '2025-01-01';
let createdVatRateRow = false;

async function execute<T = Record<string, unknown>>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await response.json()) as GraphQLResponse<T>;
  expect(json.errors).toBeUndefined();
  return json.data!;
}

async function withAdminClient<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.getPool().connect();
  try {
    await client.query("SELECT set_config('app.current_business_id', $1, false)", [ADMIN_ID]);
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Removes the fixture's rows (the charges and everything they reference). */
async function removeFixture() {
  await withAdminClient(async client => {
    const chargeIds = [CHARGE_ID, VAT_CHARGE_ID];
    for (const table of ['ledger_records', 'documents', 'transactions']) {
      await client.query(`DELETE FROM ${qualifyTable(table)} WHERE charge_id = ANY($1)`, [
        chargeIds,
      ]);
    }
    await client.query(`DELETE FROM ${qualifyTable('charges')} WHERE id = ANY($1)`, [chargeIds]);
    await client.query(
      `DELETE FROM ${qualifyTable('financial_accounts_tax_categories')} WHERE tax_category_id = $1`,
      [BANK_TAX_CATEGORY_ID],
    );
    await client.query(
      `DELETE FROM ${qualifyTable('financial_accounts')} WHERE account_number = $1`,
      [ACCOUNT_NUMBER],
    );
    await client.query(`DELETE FROM ${qualifyTable('tax_categories')} WHERE id = ANY($1)`, [
      [EXPENSE_TAX_CATEGORY_ID, BANK_TAX_CATEGORY_ID],
    ]);
    await client.query(`DELETE FROM ${qualifyTable('businesses')} WHERE id = $1`, [SUPPLIER_ID]);
    await client.query(`DELETE FROM ${qualifyTable('financial_entities')} WHERE id = ANY($1)`, [
      [SUPPLIER_ID, EXPENSE_TAX_CATEGORY_ID, BANK_TAX_CATEGORY_ID],
    ]);
  });
}

/** Removes everything this suite created. */
async function cleanup() {
  await removeFixture();
  await withAdminClient(async client => {
    await client.query(`DELETE FROM ${qualifyTable('business_users')} WHERE user_id = $1`, [
      USER_ID,
    ]);
    if (createdBusinessesAdminRow) {
      await client.query(`DELETE FROM ${qualifyTable('businesses_admin')} WHERE id = $1`, [
        ADMIN_ID,
      ]);
    }
    if (createdVatRateRow) {
      await client.query(`DELETE FROM ${qualifyTable('vat_value')} WHERE date = $1`, [
        VAT_RATE_DATE,
      ]);
    }
  });
}

/**
 * (Re)inserts the fixture. Runs before every test, not once: other integration suites running in
 * parallel `TRUNCATE ... CASCADE` raw bank tables, which wipes `transactions` database-wide, so
 * rows inserted once could vanish between tests.
 */
async function seedFixture() {
  await removeFixture();
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    await insertFixture(client, fixture, ADMIN_ID);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  db = new TestDatabase();
  await db.connect();
  await db.ensureLatestSchema();
  await db.seedAdmin();

  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    // The dev-bypass identity: a business owner of the seeded admin business.
    const { rowCount } = await client.query(
      `INSERT INTO ${qualifyTable('businesses_admin')} (id, owner_id) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [ADMIN_ID],
    );
    createdBusinessesAdminRow = rowCount === 1;
    await client.query(
      `INSERT INTO ${qualifyTable('business_users')} (user_id, business_id, role_id)
       VALUES ($1, $2, 'business_owner') ON CONFLICT DO NOTHING`,
      [USER_ID, ADMIN_ID],
    );
    const vatRate = await client.query(
      `INSERT INTO ${qualifyTable('vat_value')} (date, percentage) VALUES ($1, 0.18)
       ON CONFLICT DO NOTHING`,
      [VAT_RATE_DATE],
    );
    createdVatRateRow = vatRate.rowCount === 1;
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
    context: () => ({ env, pool, rawAuth: { authType: 'devBypass', token: USER_ID } }),
  });
});

beforeEach(seedFixture);

afterAll(async () => {
  // The shared pool itself is closed by the vitest global teardown.
  if (db) {
    await cleanup();
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe.each(TEST_TIMEZONES)('date-only values with the server in TZ=%s', timeZone => {
  useTimezone(timeZone);

  it('serializes charge, transaction and document dates as the stored calendar day', async () => {
    const { charge } = await execute<{
      charge: {
        minEventDate: string;
        maxEventDate: string;
        minDebitDate: string;
        maxDebitDate: string;
        minDocumentsDate: string;
        maxDocumentsDate: string;
        transactions: Array<{
          id: string;
          eventDate: string;
          effectiveDate: string;
          sourceEffectiveDate: string | null;
        }>;
        additionalDocuments: Array<{
          id: string;
          date: string;
          vatReportDateOverride: string | null;
        }>;
      };
    }>(CHARGE_DATES_QUERY, { chargeId: CHARGE_ID });

    expect({
      minEventDate: charge.minEventDate,
      maxEventDate: charge.maxEventDate,
      minDebitDate: charge.minDebitDate,
      maxDebitDate: charge.maxDebitDate,
      minDocumentsDate: charge.minDocumentsDate,
      maxDocumentsDate: charge.maxDocumentsDate,
    }).toEqual({
      minEventDate: EVENT_DATE,
      maxEventDate: EVENT_DATE,
      minDebitDate: DEBIT_DATE,
      maxDebitDate: DEBIT_DATE,
      minDocumentsDate: DOCUMENT_DATE,
      maxDocumentsDate: DOCUMENT_DATE,
    });
    expect(charge.transactions).toEqual([
      {
        id: TRANSACTION_ID,
        eventDate: EVENT_DATE,
        effectiveDate: DEBIT_DATE,
        // only set when it differs from the effective date (see the mutation case below)
        sourceEffectiveDate: null,
      },
    ]);
    expect(charge.additionalDocuments).toEqual([
      { id: DOCUMENT_ID, date: DOCUMENT_DATE, vatReportDateOverride: null },
    ]);
  });

  it('generates ledger records dated on the document and transaction days', async () => {
    const { regenerateLedgerRecords } = await execute<{
      regenerateLedgerRecords: Array<{ __typename: string; message?: string }>;
    }>(REGENERATE_LEDGER_MUTATION, { chargeIds: [CHARGE_ID] });
    expect(regenerateLedgerRecords).toEqual([{ __typename: 'Ledger' }]);

    const { charge } = await execute<{
      charge: { ledger: { records: Array<{ id: string; invoiceDate: string; valueDate: string }> } };
    }>(CHARGE_LEDGER_QUERY, { chargeId: CHARGE_ID });

    const dates = charge.ledger.records
      .map(({ invoiceDate, valueDate }) => ({ invoiceDate, valueDate }))
      .sort((a, b) => a.valueDate.localeCompare(b.valueDate));
    expect(dates).toEqual([
      // The receipt: recognised on its own date.
      { invoiceDate: DOCUMENT_DATE, valueDate: DOCUMENT_DATE },
      // The bank payment: invoiced on the document date, valued on the debit date.
      { invoiceDate: DOCUMENT_DATE, valueDate: DEBIT_DATE },
    ]);

    // The stored rows are found by the same calendar days they carry.
    const ledgerIds = charge.ledger.records.map(record => record.id).sort();
    const { ledgerRecordsByDates } = await execute<{ ledgerRecordsByDates: Array<{ id: string }> }>(
      LEDGER_BY_DATES_QUERY,
      { fromDate: DOCUMENT_DATE, toDate: DEBIT_DATE },
    );
    expect(ledgerRecordsByDates.map(record => record.id)).toEqual(
      expect.arrayContaining(ledgerIds),
    );
  });

  it('treats date filters as inclusive calendar-day bounds', async () => {
    const chargeIds = async (filters: Record<string, unknown>) => {
      const { allCharges } = await execute<{ allCharges: { nodes: Array<{ id: string }> } }>(
        CHARGES_BY_FILTERS_QUERY,
        { filters: { byOwners: [ADMIN_ID], ...filters } },
      );
      return allCharges.nodes.map(node => node.id);
    };

    // The charge's main date is its document date.
    expect(await chargeIds({ fromDate: DOCUMENT_DATE, toDate: DOCUMENT_DATE })).toContain(
      CHARGE_ID,
    );
    expect(await chargeIds({ fromDate: '2026-05-02' })).not.toContain(CHARGE_ID);
    expect(await chargeIds({ toDate: '2026-04-30' })).not.toContain(CHARGE_ID);
    // "Any date" also covers the debit date at the end of the month.
    expect(await chargeIds({ fromAnyDate: DEBIT_DATE, toAnyDate: DEBIT_DATE })).toContain(
      CHARGE_ID,
    );
    expect(await chargeIds({ fromAnyDate: '2026-06-01' })).not.toContain(CHARGE_ID);

    const documentIds = async (filters: Record<string, unknown>) => {
      const { documentsByFilters } = await execute<{ documentsByFilters: Array<{ id: string }> }>(
        DOCUMENTS_BY_FILTERS_QUERY,
        { filters: { ownerIDs: [ADMIN_ID], ...filters } },
      );
      return documentsByFilters.map(document => document.id);
    };

    expect(await documentIds({ fromDate: DOCUMENT_DATE, toDate: DOCUMENT_DATE })).toContain(
      DOCUMENT_ID,
    );
    expect(await documentIds({ fromDate: '2026-05-02' })).not.toContain(DOCUMENT_ID);
    expect(await documentIds({ toDate: '2026-04-30' })).not.toContain(DOCUMENT_ID);
  });

  it('stores date inputs from mutations as the given calendar day', async () => {
    const { updateDocument } = await execute<{ updateDocument: { __typename: string } }>(
      UPDATE_DOCUMENT_DATE_MUTATION,
      {
        documentId: DOCUMENT_ID,
        fields: { date: '2026-06-30', vatReportDateOverride: '2026-07-01' },
      },
    );
    expect(updateDocument.__typename).not.toBe('CommonError');

    const { updateTransaction } = await execute<{ updateTransaction: { __typename: string } }>(
      UPDATE_TRANSACTION_MUTATION,
      { transactionId: TRANSACTION_ID, fields: { effectiveDate: '2026-01-01' } },
    );
    expect(updateTransaction.__typename).not.toBe('CommonError');

    const { charge } = await execute<{
      charge: {
        transactions: Array<{ effectiveDate: string; sourceEffectiveDate: string }>;
        additionalDocuments: Array<{ date: string; vatReportDateOverride: string }>;
      };
    }>(CHARGE_DATES_QUERY, { chargeId: CHARGE_ID });

    expect(charge.additionalDocuments).toEqual([
      expect.objectContaining({ date: '2026-06-30', vatReportDateOverride: '2026-07-01' }),
    ]);
    expect(charge.transactions).toEqual([
      expect.objectContaining({ effectiveDate: '2026-01-01', sourceEffectiveDate: DEBIT_DATE }),
    ]);

    // And the raw columns hold exactly those days.
    const stored = await withAdminClient(async client => {
      const document = await client.query(
        `SELECT date::text AS date, vat_report_date_override::text AS vat_report_date_override
         FROM ${qualifyTable('documents')} WHERE id = $1`,
        [DOCUMENT_ID],
      );
      const transaction = await client.query(
        `SELECT debit_date_override::text AS debit_date_override
         FROM ${qualifyTable('transactions')} WHERE id = $1`,
        [TRANSACTION_ID],
      );
      return { ...document.rows[0], ...transaction.rows[0] };
    });
    expect(stored).toEqual({
      date: '2026-06-30',
      vat_report_date_override: '2026-07-01',
      debit_date_override: '2026-01-01',
    });
  });

  it('builds the VAT report from exactly the calendar days of the requested month', async () => {
    const expenseDocumentIds = async (monthDate: string) => {
      const { vatReport } = await execute<{
        vatReport: { expenses: Array<{ documentId: string; documentDate: string }> };
      }>(VAT_REPORT_QUERY, { filters: { monthDate, financialEntityId: ADMIN_ID } });
      return vatReport.expenses;
    };

    const may = await expenseDocumentIds('2026-05-01');
    expect(may).toEqual(
      expect.arrayContaining([{ documentId: VAT_DOCUMENT_ID, documentDate: VAT_DOCUMENT_DATE }]),
    );
    expect((await expenseDocumentIds('2026-04-01')).map(r => r.documentId)).not.toContain(
      VAT_DOCUMENT_ID,
    );
    expect((await expenseDocumentIds('2026-06-01')).map(r => r.documentId)).not.toContain(
      VAT_DOCUMENT_ID,
    );
  });

  it('serializes the admin context dates as stored', async () => {
    const { adminContext } = await execute<{ adminContext: { dateEstablished: string } }>(
      ADMIN_CONTEXT_QUERY,
    );
    expect(adminContext.dateEstablished).toBe(DATE_ESTABLISHED);
  });
});
