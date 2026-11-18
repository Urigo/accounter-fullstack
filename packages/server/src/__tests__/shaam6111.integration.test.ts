import { createRequire } from 'node:module';
import { createYoga } from 'graphql-yoga';
import { useSchema } from '@envelop/core';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { decode } from 'iconv-lite';
import { makeUUID } from '../demo-fixtures/helpers/deterministic-uuid.js';
import { env } from '../environment.js';
import { createGraphQLApp } from '../modules-app.js';
import { dbCleanupPlugin } from '../plugins/db-cleanup-plugin.js';
import { TestDatabase } from './helpers/db-setup.js';
import { qualifyTable } from './helpers/test-db-config.js';

/**
 * SHAAM 6111 end to end: ledger records → `shaam6111` query → validation and the file to upload,
 * through the real application (`createGraphQLApp`) with a dev-bypass identity.
 *
 * The books: a company incorporated in 2024 with share capital and a first sale, then a 2025
 * with a sale, salaries, non-deductible gifts and the year's tax expense. The bank account has no
 * IRS code of its own, so its sort code's default IRS code must be used.
 */

// See timeless-dates.integration.test.ts: keep graphql in one (CommonJS) realm with graphql-modules
vi.mock('graphql', () => createRequire(import.meta.url)('graphql'));

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
                throw new Error(`${String(key)} is stubbed in the 6111 test`);
              },
      },
    ),
);
vi.mock('@accounter/green-invoice-graphql', unbuiltPackageStub);
vi.mock('@accounter/shaam-uniform-format-generator', unbuiltPackageStub);

const ADMIN_ID = makeUUID('business', 'Admin Business');
const USER_ID = makeUUID('user', 'shaam6111-user');
const CHARGE_ID = makeUUID('charge', 'shaam6111-charge');
/** A valid company number (51…) and withholding file number (9…), check digits included */
const COMPANY_NUMBER = '516123452';
const WITHHOLDING_FILE_NUMBER = '937000008';

const entityId = (name: string) => makeUUID('tax-category', `shaam6111-${name}`);
const ENTITIES = {
  bank: { sortCode: 9101, irsCode: null }, // falls back to the sort code's default (7110)
  customers: { sortCode: 9102, irsCode: 7310 },
  payables: { sortCode: 9103, irsCode: 9420 },
  equity: { sortCode: 9104, irsCode: 9910 },
  revenue: { sortCode: 810, irsCode: 1040 },
  salaries: { sortCode: 940, irsCode: 3511 },
  taxes: { sortCode: 9105, irsCode: 5610 },
  unmapped: { sortCode: 9106, irsCode: null },
} as const;
type EntityName = keyof typeof ENTITIES | 'gifts';

/** Test-only sort codes; 810 / 940 are the revenue / G&A sort codes the tax report reads */
const SORT_CODES: Array<{ key: number; name: string; defaultIrsCode: number | null }> = [
  { key: 9101, name: '6111 test banks', defaultIrsCode: 7110 },
  { key: 9102, name: '6111 test customers', defaultIrsCode: null },
  { key: 9103, name: '6111 test payables', defaultIrsCode: null },
  { key: 9104, name: '6111 test equity', defaultIrsCode: null },
  { key: 9105, name: '6111 test taxes', defaultIrsCode: null },
  { key: 9106, name: '6111 test unmapped', defaultIrsCode: null },
  { key: 810, name: 'Revenue', defaultIrsCode: null },
  { key: 940, name: 'General and administrative', defaultIrsCode: null },
];

const SHAAM_6111_QUERY = /* GraphQL */ `
  query Shaam6111Integration($year: Int!, $businessId: UUID) {
    shaam6111(year: $year, businessId: $businessId) {
      year
      data {
        individualOrCompany
        header {
          taxYear
          withholdingTaxFileNumber
          profitLossEntryCount
          taxAdjustmentEntryCount
          balanceSheetEntryCount
        }
        profitAndLoss {
          code
          amount
        }
        taxAdjustment {
          code
          amount
        }
        balanceSheet {
          code
          amount
        }
      }
      validation {
        isValid
        issues {
          severity
          message
          path
        }
      }
    }
  }
`;

const SHAAM_6111_FILE_QUERY = /* GraphQL */ `
  query Shaam6111IntegrationFile($year: Int!, $businessId: UUID) {
    shaam6111(year: $year, businessId: $businessId) {
      file {
        fileName
        reportContent
        encodedContent
      }
    }
  }
`;

const TAX_REPORT_QUERY = /* GraphQL */ `
  query Shaam6111IntegrationTaxReport($year: Int!) {
    taxReport(reportYear: $year, referenceYears: []) {
      report {
        taxableIncome {
          raw
        }
      }
    }
  }
`;

type Entry = { code: number; amount: number };
type Shaam6111Response = {
  shaam6111: {
    year: number;
    data: {
      individualOrCompany: string;
      header: {
        taxYear: string;
        withholdingTaxFileNumber: string | null;
        profitLossEntryCount: number;
        taxAdjustmentEntryCount: number;
        balanceSheetEntryCount: number;
      };
      profitAndLoss: Entry[];
      taxAdjustment: Entry[];
      balanceSheet: Entry[];
    };
    validation: {
      isValid: boolean;
      issues: Array<{ severity: string; message: string; path: string | null }>;
    };
  };
};

type GraphQLResponse<T> = { data?: T; errors?: Array<{ message: string }> };

let db: TestDatabase;
let yoga: { fetch: (url: string, init: RequestInit) => Response | Promise<Response> };
/** `businesses_admin.company_tax_id` before this suite set it (the row is shared, see below) */
let originalCompanyTaxId: string | null = null;
let createdCorporateTaxRow = false;
let originalVatNumber: string | null = null;
let giftsEntityId: string;
let originalGiftsCodes: { sort_code: number | null; irs_code: number | null } | null = null;

async function executeRaw<T>(query: string, variables: Record<string, unknown> = {}) {
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return (await response.json()) as GraphQLResponse<T>;
}

async function execute<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const json = await executeRaw<T>(query, variables);
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

const amountOf = (entries: Entry[], code: number) =>
  entries.find(entry => entry.code === code)?.amount;

function idOf(name: EntityName) {
  return name === 'gifts' ? giftsEntityId : entityId(name);
}

async function insertLedgerRecord(
  client: import('pg').PoolClient,
  date: string,
  debit: EntityName,
  credit: EntityName,
  amount: number,
) {
  await client.query(
    `INSERT INTO ${qualifyTable('ledger_records')}
       (owner_id, charge_id, debit_entity1, debit_local_amount1, credit_entity1,
        credit_local_amount1, currency, invoice_date, value_date)
     VALUES ($1, $2, $3, $4, $5, $4, 'ILS', $6, $6)`,
    [ADMIN_ID, CHARGE_ID, idOf(debit), amount, idOf(credit), date],
  );
}

async function removeFixture() {
  await withAdminClient(async client => {
    await client.query(`DELETE FROM ${qualifyTable('ledger_records')} WHERE charge_id = $1`, [
      CHARGE_ID,
    ]);
    await client.query(`DELETE FROM ${qualifyTable('charges')} WHERE id = $1`, [CHARGE_ID]);
    await client.query(`DELETE FROM ${qualifyTable('financial_entities')} WHERE id = ANY($1)`, [
      Object.keys(ENTITIES).map(name => entityId(name)),
    ]);
    if (giftsEntityId && originalGiftsCodes) {
      await client.query(
        `UPDATE ${qualifyTable('financial_entities')} SET sort_code = $2, irs_code = $3 WHERE id = $1`,
        [giftsEntityId, originalGiftsCodes.sort_code, originalGiftsCodes.irs_code],
      );
    }
    await client.query(
      `DELETE FROM ${qualifyTable('sort_codes')} WHERE owner_id = $1 AND key = ANY($2)
         AND NOT EXISTS (
           SELECT 1 FROM ${qualifyTable('financial_entities')} fe
           WHERE fe.owner_id = $1 AND fe.sort_code = ${qualifyTable('sort_codes')}.key
         )`,
      [ADMIN_ID, SORT_CODES.map(({ key }) => key)],
    );
  });
}

async function seedFixture() {
  await removeFixture();
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [ADMIN_ID]);
    // The seeded admin's `businesses_admin` row is shared with other suites running in parallel,
    // which may create or delete it: ensure it before every test, and never delete it.
    await client.query(
      `INSERT INTO ${qualifyTable('businesses_admin')} (id, owner_id, company_tax_id)
       VALUES ($1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET company_tax_id = EXCLUDED.company_tax_id`,
      [ADMIN_ID, WITHHOLDING_FILE_NUMBER],
    );
    // deleting the row cascades to `business_users`, so the dev-bypass user is re-linked too
    await client.query(
      `INSERT INTO ${qualifyTable('business_users')} (user_id, business_id, role_id)
       VALUES ($1, $2, 'business_owner') ON CONFLICT DO NOTHING`,
      [USER_ID, ADMIN_ID],
    );
    await client.query(
      `INSERT INTO ${qualifyTable('charges')} (id, owner_id, user_description) VALUES ($1, $2, $3)`,
      [CHARGE_ID, ADMIN_ID, '6111 books'],
    );
    for (const { key, name, defaultIrsCode } of SORT_CODES) {
      await client.query(
        `INSERT INTO ${qualifyTable('sort_codes')} (key, name, default_irs_code, owner_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key, owner_id) DO UPDATE SET default_irs_code = EXCLUDED.default_irs_code`,
        [key, name, defaultIrsCode, ADMIN_ID],
      );
    }
    for (const [name, { sortCode, irsCode }] of Object.entries(ENTITIES)) {
      await client.query(
        `INSERT INTO ${qualifyTable('financial_entities')} (id, name, type, owner_id, sort_code, irs_code)
         VALUES ($1, $2, 'tax_category', $3, $4, $5)`,
        [entityId(name), `6111 test ${name}`, ADMIN_ID, sortCode, irsCode],
      );
    }
    // The admin context's untaxable-gifts category feeds tax adjustment line 110
    await client.query(
      `UPDATE ${qualifyTable('financial_entities')} SET sort_code = 940, irs_code = 3625 WHERE id = $1`,
      [giftsEntityId],
    );

    await insertLedgerRecord(client, '2024-03-01', 'bank', 'equity', 100_000);
    await insertLedgerRecord(client, '2024-06-01', 'customers', 'revenue', 10_000);
    await insertLedgerRecord(client, '2025-02-01', 'customers', 'revenue', 100_000);
    await insertLedgerRecord(client, '2025-03-01', 'salaries', 'bank', 60_000);
    await insertLedgerRecord(client, '2025-04-01', 'gifts', 'bank', 2000);
    await insertLedgerRecord(client, '2025-12-31', 'taxes', 'payables', 9000);
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

  await withAdminClient(async client => {
    await client.query('BEGIN');
    try {
      const adminRow = await client.query<{ company_tax_id: string | null }>(
        `SELECT company_tax_id FROM ${qualifyTable('businesses_admin')} WHERE id = $1`,
        [ADMIN_ID],
      );
      originalCompanyTaxId = adminRow.rows[0]?.company_tax_id ?? null;
      // `business_users` references `businesses_admin`: make sure the shared row exists
      await client.query(
        `INSERT INTO ${qualifyTable('businesses_admin')} (id, owner_id) VALUES ($1, $1)
         ON CONFLICT DO NOTHING`,
        [ADMIN_ID],
      );
      await client.query(
        `INSERT INTO ${qualifyTable('business_users')} (user_id, business_id, role_id)
         VALUES ($1, $2, 'business_owner') ON CONFLICT DO NOTHING`,
        [USER_ID, ADMIN_ID],
      );
      const business = await client.query<{ vat_number: string | null }>(
        `SELECT vat_number FROM ${qualifyTable('businesses')} WHERE id = $1`,
        [ADMIN_ID],
      );
      originalVatNumber = business.rows[0]?.vat_number ?? null;
      await client.query(`UPDATE ${qualifyTable('businesses')} SET vat_number = $2 WHERE id = $1`, [
        ADMIN_ID,
        COMPANY_NUMBER,
      ]);
      const corporateTax = await client.query(
        `INSERT INTO ${qualifyTable('corporate_tax_variables')}
           (corporate_id, date, tax_rate, original_tax_rate, owner_id)
         VALUES ($1, '2000-01-01', 23, 23, $1) ON CONFLICT DO NOTHING`,
        [ADMIN_ID],
      );
      createdCorporateTaxRow = corporateTax.rowCount === 1;
      const gifts = await client.query<{
        untaxable_gifts_tax_category_id: string;
        sort_code: number | null;
        irs_code: number | null;
      }>(
        `SELECT uc.untaxable_gifts_tax_category_id, fe.sort_code, fe.irs_code
         FROM ${qualifyTable('user_context')} uc
         JOIN ${qualifyTable('financial_entities')} fe ON fe.id = uc.untaxable_gifts_tax_category_id
         WHERE uc.owner_id = $1`,
        [ADMIN_ID],
      );
      giftsEntityId = gifts.rows[0].untaxable_gifts_tax_category_id;
      originalGiftsCodes = { sort_code: gifts.rows[0].sort_code, irs_code: gifts.rows[0].irs_code };
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

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
  if (!db) {
    return;
  }
  await removeFixture();
  await withAdminClient(async client => {
    if (createdCorporateTaxRow) {
      await client.query(
        `DELETE FROM ${qualifyTable('corporate_tax_variables')} WHERE corporate_id = $1 AND date = '2000-01-01'`,
        [ADMIN_ID],
      );
    }
    await client.query(`UPDATE ${qualifyTable('businesses')} SET vat_number = $2 WHERE id = $1`, [
      ADMIN_ID,
      originalVatNumber,
    ]);
    await client.query(`DELETE FROM ${qualifyTable('business_users')} WHERE user_id = $1`, [
      USER_ID,
    ]);
    // Restore the shared row's withholding file number; the row itself stays (see seedFixture)
    await client.query(
      `UPDATE ${qualifyTable('businesses_admin')} SET company_tax_id = $2 WHERE id = $1`,
      [ADMIN_ID, originalCompanyTaxId],
    );
  });
});

describe('SHAAM 6111 report', () => {
  it('builds a valid 2025 company report from the books', async () => {
    const { shaam6111 } = await execute<Shaam6111Response>(SHAAM_6111_QUERY, {
      year: 2025,
      businessId: ADMIN_ID,
    });
    const { data, validation } = shaam6111;

    expect(validation.issues).toEqual([]);
    expect(validation.isValid).toBe(true);
    expect(data.individualOrCompany).toBe('COMPANY');
    expect(data.header.taxYear).toBe('2025');
    expect(data.header.withholdingTaxFileNumber).toBe(WITHHOLDING_FILE_NUMBER);

    // P&L: only 2025
    expect(amountOf(data.profitAndLoss, 1040)).toBe(100_000);
    expect(amountOf(data.profitAndLoss, 3511)).toBe(60_000);
    expect(amountOf(data.profitAndLoss, 3625)).toBe(2000);
    expect(amountOf(data.profitAndLoss, 6666)).toBe(38_000);
    expect(amountOf(data.profitAndLoss, 5610)).toBe(9000);

    // Tax adjustment: gifts are added back as excess expenses
    expect(amountOf(data.taxAdjustment, 100)).toBe(38_000);
    expect(amountOf(data.taxAdjustment, 110)).toBe(2000);
    expect(amountOf(data.taxAdjustment, 370)).toBe(2000);
    expect(amountOf(data.taxAdjustment, 400)).toBe(40_000);
    expect(amountOf(data.taxAdjustment, 500)).toBe(40_000);

    // Balance sheet: cumulative, with the bank on its sort code's default IRS code (7110)
    expect(amountOf(data.balanceSheet, 7110)).toBe(100_000 - 60_000 - 2000);
    expect(amountOf(data.balanceSheet, 7310)).toBe(110_000);
    expect(amountOf(data.balanceSheet, 9420)).toBe(9000);
    expect(amountOf(data.balanceSheet, 9910)).toBe(100_000);
    // retained earnings: 2024 profit + 2025 profit after tax
    expect(amountOf(data.balanceSheet, 9980)).toBe(10_000 + 38_000 - 9000);
    expect(amountOf(data.balanceSheet, 8888)).toBe(148_000);
    expect(amountOf(data.balanceSheet, 9999)).toBe(148_000);

    // Only non-zero lines and mandatory totals are counted for the file
    expect(data.header.balanceSheetEntryCount).toBeLessThan(150);
    expect(data.header.profitLossEntryCount).toBeLessThan(150);
  });

  it('matches the tax report: 500 equals the taxable income', async () => {
    const [{ shaam6111 }, { taxReport }] = await Promise.all([
      execute<Shaam6111Response>(SHAAM_6111_QUERY, { year: 2025, businessId: ADMIN_ID }),
      execute<{ taxReport: { report: { taxableIncome: { raw: number } } } }>(TAX_REPORT_QUERY, {
        year: 2025,
      }),
    ]);
    expect(amountOf(shaam6111.data.taxAdjustment, 500)).toBe(
      Math.round(taxReport.report.taxableIncome.raw),
    );
  });

  it('returns the file to upload: one framed record, Windows-1255 encoded', async () => {
    const { shaam6111 } = await execute<{
      shaam6111: { file: { fileName: string; reportContent: string; encodedContent: string } };
    }>(SHAAM_6111_FILE_QUERY, { year: 2025, businessId: ADMIN_ID });
    const { fileName, reportContent, encodedContent } = shaam6111.file;

    expect(fileName).toBe('DKASPI.DAT');
    expect(reportContent).toHaveLength(8612);
    const bytes = Buffer.from(encodedContent, 'base64');
    expect(bytes).toHaveLength(8612 + 3);
    expect([...bytes.subarray(-3)]).toEqual([0x0d, 0x0a, 0x1a]);
    expect(decode(bytes.subarray(0, 8612), 'windows-1255')).toBe(reportContent);
    expect(reportContent.slice(0, 9)).toBe(COMPANY_NUMBER);
    expect(reportContent.slice(9, 13)).toBe('2025');
  });

  it('flags entities without an IRS code and blocks the file', async () => {
    await withAdminClient(client =>
      insertLedgerRecord(client, '2025-05-01', 'unmapped', 'bank', 500),
    );

    const { shaam6111 } = await execute<Shaam6111Response>(SHAAM_6111_QUERY, {
      year: 2025,
      businessId: ADMIN_ID,
    });
    const { issues, isValid } = shaam6111.validation;
    expect(isValid).toBe(false);
    expect(
      issues.some(
        issue =>
          issue.severity === 'WARNING' &&
          issue.path === 'mapping' &&
          issue.message.includes('6111 test unmapped'),
      ),
    ).toBe(true);
    // the bank went down without a mapped counterpart: the balance sheet no longer balances
    expect(issues.some(issue => issue.severity === 'ERROR' && /8888/.test(issue.message))).toBe(
      true,
    );

    const fileResponse = await executeRaw(SHAAM_6111_FILE_QUERY, {
      year: 2025,
      businessId: ADMIN_ID,
    });
    expect(fileResponse.errors?.[0]?.message).toMatch(/does not pass SHAAM validation/);
  });
});
