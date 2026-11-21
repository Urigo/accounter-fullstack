import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import type { IGetChargesByFiltersResult } from '../../types.js';
import type { ChargesAuthorizationProvider } from '../charges-authorization.provider.js';
import { ChargesProvider } from '../charges.provider.js';

/**
 * `ChargesProvider.getChargesByFilters` against a real database.
 *
 * The query behind the charges list is one statement with a dozen CTEs: it aggregates every
 * charge's transactions, documents, ledger records, tags and counterparties, then filters and
 * sorts the enriched rows. Each charge seeded below isolates one behavior, so a test reads as
 * "this filter keeps exactly these charges" or "this charge computes exactly these fields".
 *
 * The suite owns a fresh owner business, and every query is scoped to it, so other suites seeding
 * concurrently can't leak into the results.
 */

let pool: Pool;

const OWNER = randomUUID();
const SUPPLIER = randomUUID(); // can settle with a receipt
const CLIENT = randomUUID(); // can't
const EXEMPT = randomUUID(); // no invoices required
const BANK = randomUUID(); // fee counterparty
const OTHER = randomUUID(); // misc-expense and tax-category-match counterparty
const GLOBEX = randomUUID(); // only ever a document creditor
const INITECH = randomUUID(); // only ever a document debtor
const UMBRELLA = randomUUID(); // only ever in a ledger record
const TAX_CATEGORY = randomUUID();
const TAX_CATEGORY_OVERRIDE = randomUUID();
const ACCOUNT_A = randomUUID();
const ACCOUNT_B = randomUUID();
const TAG_1 = randomUUID();
const TAG_2 = randomUUID();
const TRIP = randomUUID();

const BUSINESSES = [
  { id: SUPPLIER, name: 'Northwind Supplies', canSettleWithReceipt: true },
  { id: CLIENT, name: 'Contoso Clients' },
  { id: EXEMPT, name: 'Exempt Fees Ltd', noInvoicesRequired: true },
  { id: BANK, name: 'Bank Fees Co' },
  { id: OTHER, name: 'Fabrikam Other' },
  { id: GLOBEX, name: 'Globex Creditor' },
  { id: INITECH, name: 'Initech Debtor' },
  { id: UMBRELLA, name: 'Umbrella Ledger' },
] as const;

type DocumentType =
  | 'INVOICE'
  | 'RECEIPT'
  | 'INVOICE_RECEIPT'
  | 'PROFORMA'
  | 'UNPROCESSED'
  | 'CREDIT_INVOICE'
  | 'OTHER';

type TransactionSpec = {
  amount: string;
  eventDate: string;
  currency?: 'ILS' | 'USD';
  /** Defaults to the event date; pass null for a transaction that hasn't been debited. */
  debitDate?: string | null;
  debitDateOverride?: string;
  businessId?: string | null;
  accountId?: string;
  isFee?: boolean;
  description?: string;
  reference?: string;
};

type DocumentSpec = {
  type: DocumentType;
  date?: string | null;
  total?: number | null;
  vat?: number | null;
  currency?: 'ILS' | 'USD' | null;
  creditorId?: string | null;
  debtorId?: string | null;
  serial?: string | null;
  description?: string;
  remarks?: string;
  issuedStatus?: 'OPEN' | 'CLOSED';
};

type ChargeSpec = {
  description?: string;
  accountantStatus?: 'UNAPPROVED' | 'APPROVED' | 'PENDING';
  type?: 'PAYROLL';
  taxCategoryId?: string;
  transactions?: TransactionSpec[];
  documents?: DocumentSpec[];
  ledger?: { invoiceDate: string; valueDate: string; credit1?: string; debit1?: string }[];
  miscExpenses?: { creditorId: string; debtorId: string }[];
  tags?: string[];
  tripId?: string;
  spreadYears?: string[];
  securities?: { tradeDate: string; valueDate: string }[];
};

/** Expense from a counterparty that can settle with a receipt, owner is the debtor. */
const supplierReceipt: DocumentSpec = {
  type: 'RECEIPT',
  date: '2025-03-05',
  total: 500,
  vat: 76.27,
  currency: 'ILS',
  creditorId: SUPPLIER,
  debtorId: OWNER,
  serial: 'R-77',
};

const CHARGES = {
  empty: {},
  coffee: {
    description: 'Morning Coffee',
    accountantStatus: 'APPROVED',
    tags: [TAG_1],
    transactions: [
      {
        amount: '-12.50',
        eventDate: '2025-01-10',
        debitDate: '2025-01-11',
        businessId: SUPPLIER,
        description: 'CAFE NOIR',
        reference: 'REF-COFFEE',
      },
    ],
  },
  consulting: {
    accountantStatus: 'PENDING',
    tags: [TAG_2],
    transactions: [
      { amount: '11700.00', eventDate: '2025-02-03', businessId: CLIENT, accountId: ACCOUNT_B },
    ],
    documents: [
      {
        type: 'INVOICE',
        date: '2025-01-28',
        total: 11_700,
        vat: 1700,
        currency: 'ILS',
        creditorId: OWNER,
        debtorId: CLIENT,
        serial: 'INV-1001',
        description: 'January consulting',
        issuedStatus: 'OPEN',
      },
    ],
  },
  supplierReceipt: {
    transactions: [{ amount: '-500.00', eventDate: '2025-03-05', businessId: SUPPLIER }],
    documents: [supplierReceipt],
  },
  clientReceipt: {
    transactions: [
      { amount: '800.00', eventDate: '2025-03-10', businessId: CLIENT, accountId: ACCOUNT_B },
    ],
    documents: [
      {
        ...supplierReceipt,
        date: '2025-03-10',
        total: 800,
        vat: 0,
        creditorId: OWNER,
        debtorId: CLIENT,
        serial: 'R-78',
      },
    ],
  },
  receiptOwnerCreditor: {
    documents: [
      {
        ...supplierReceipt,
        date: '2025-03-12',
        total: 300,
        vat: 0,
        creditorId: OWNER,
        debtorId: SUPPLIER,
        serial: 'R-79',
      },
    ],
  },
  // The owner (debtor here) can settle with receipts but the creditor can't, so this only
  // stays out of the documents amount if the counterparty is resolved to the creditor.
  receiptFromNonSettling: {
    documents: [
      {
        ...supplierReceipt,
        date: '2025-03-18',
        total: 650,
        vat: 0,
        creditorId: CLIENT,
        debtorId: OWNER,
        serial: 'R-82',
      },
    ],
  },
  thirdPartyReceipt: {
    documents: [
      {
        ...supplierReceipt,
        date: '2025-03-14',
        total: 100,
        vat: 0,
        creditorId: SUPPLIER,
        debtorId: CLIENT,
        serial: 'R-80',
      },
    ],
  },
  selfReceipt: {
    documents: [
      {
        ...supplierReceipt,
        date: '2025-03-16',
        total: 50,
        vat: 0,
        creditorId: OWNER,
        debtorId: OWNER,
        serial: 'R-81',
      },
    ],
  },
  invoiceAndReceipt: {
    documents: [
      {
        ...supplierReceipt,
        type: 'INVOICE',
        date: '2025-04-01',
        total: 1000,
        vat: 170,
        serial: 'I-90',
      },
      { ...supplierReceipt, date: '2025-04-20', total: 1000, vat: 170, serial: 'R-90' },
    ],
  },
  creditInvoice: {
    documents: [
      {
        type: 'CREDIT_INVOICE',
        date: '2025-04-25',
        total: 200,
        vat: 34,
        currency: 'ILS',
        creditorId: OWNER,
        debtorId: INITECH,
        serial: 'CI-1',
      },
    ],
  },
  proforma: {
    documents: [
      {
        type: 'PROFORMA',
        date: '2025-05-01',
        total: 2000,
        vat: 340,
        currency: 'USD',
        creditorId: OWNER,
        debtorId: CLIENT,
        serial: 'P-1',
      },
    ],
  },
  unprocessedDocument: {
    documents: [{ type: 'UNPROCESSED' }],
  },
  missingCounterpartyDocument: {
    documents: [
      {
        type: 'INVOICE',
        date: '2025-06-01',
        total: 100,
        vat: 17,
        currency: 'ILS',
        creditorId: OWNER,
        debtorId: null,
        serial: 'INV-X',
      },
    ],
  },
  missingCounterpartyTransaction: {
    transactions: [{ amount: '-40.00', eventDate: '2025-06-05', businessId: null }],
  },
  undebitedTransaction: {
    transactions: [
      { amount: '-45.00', eventDate: '2025-06-07', debitDate: null, businessId: SUPPLIER },
    ],
  },
  withFee: {
    transactions: [
      { amount: '-1000.00', currency: 'USD', eventDate: '2025-07-01', businessId: SUPPLIER },
      { amount: '-15.00', eventDate: '2025-07-01', businessId: BANK, isFee: true },
    ],
  },
  onlyFees: {
    transactions: [{ amount: '-20.00', eventDate: '2025-07-05', businessId: BANK, isFee: true }],
  },
  debitOverride: {
    transactions: [
      {
        amount: '-60.00',
        eventDate: '2025-08-01',
        debitDate: '2025-08-03',
        debitDateOverride: '2025-08-10',
        businessId: SUPPLIER,
      },
    ],
  },
  ledgerOnly: {
    ledger: [
      { invoiceDate: '2024-06-30', valueDate: '2024-07-02', credit1: UMBRELLA, debit1: OWNER },
    ],
  },
  miscExpense: {
    transactions: [{ amount: '-70.00', eventDate: '2025-09-01', businessId: SUPPLIER }],
    miscExpenses: [{ creditorId: OTHER, debtorId: OWNER }],
  },
  tripCharge: {
    tripId: TRIP,
    transactions: [
      { amount: '-300.00', eventDate: '2025-09-10', businessId: SUPPLIER, accountId: ACCOUNT_B },
    ],
  },
  spreadCharge: {
    spreadYears: ['2024-01-01', '2025-01-01'],
    transactions: [{ amount: '-90.00', eventDate: '2025-09-15', businessId: SUPPLIER }],
  },
  exemptCounterparty: {
    transactions: [{ amount: '-25.00', eventDate: '2025-10-01', businessId: EXEMPT }],
  },
  matchedTaxCategory: {
    transactions: [{ amount: '-33.00', eventDate: '2025-10-05', businessId: OTHER }],
  },
  chargeTaxCategory: {
    taxCategoryId: TAX_CATEGORY_OVERRIDE,
    transactions: [{ amount: '-34.00', eventDate: '2025-10-06', businessId: OTHER }],
  },
  payroll: {
    type: 'PAYROLL',
    transactions: [
      { amount: '-5000.00', eventDate: '2025-10-25', businessId: OTHER, accountId: ACCOUNT_B },
    ],
  },
  multiCounterparty: {
    transactions: [{ amount: '-100.00', eventDate: '2025-11-01', businessId: SUPPLIER }],
    documents: [
      {
        type: 'INVOICE',
        date: '2025-11-01',
        total: 100,
        vat: 17,
        currency: 'ILS',
        creditorId: CLIENT,
        debtorId: OWNER,
        serial: 'INV-MC',
      },
    ],
  },
  closedInvoice: {
    documents: [
      {
        type: 'INVOICE',
        date: '2025-11-10',
        total: 400,
        vat: 68,
        currency: 'ILS',
        creditorId: OWNER,
        debtorId: CLIENT,
        serial: 'INV-CL',
        issuedStatus: 'CLOSED',
      },
    ],
  },
  remarksDocument: {
    documents: [
      {
        type: 'OTHER',
        date: '2025-11-20',
        creditorId: GLOBEX,
        debtorId: OWNER,
        remarks: 'Quarterly retainer',
      },
    ],
  },
  securities: {
    securities: [{ tradeDate: '2025-12-01', valueDate: '2025-12-03' }],
  },
  bigAmount: {
    transactions: [{ amount: '-1234.56', eventDate: '2025-12-10', businessId: SUPPLIER }],
  },
} satisfies Record<string, ChargeSpec>;

type ChargeName = keyof typeof CHARGES;

const CHARGE_NAMES = Object.keys(CHARGES) as ChargeName[];
const chargeIds = Object.fromEntries(CHARGE_NAMES.map(name => [name, randomUUID()])) as Record<
  ChargeName,
  string
>;
const chargeNamesById = new Map(CHARGE_NAMES.map(name => [chargeIds[name], name]));

const rawTransactionIds: string[] = [];

function createProvider(): ChargesProvider {
  const authContextProvider = {
    getAuthContext: () =>
      Promise.resolve({
        authType: 'apiKey' as const,
        token: 'test-token',
        tenant: { businessId: OWNER },
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
  // getChargesByFilters is a read and never consults the write-authorization provider.
  return new ChargesProvider(db, {} as ChargesAuthorizationProvider);
}

type Filters = Parameters<ChargesProvider['getChargesByFilters']>[0];

/** Runs the query for this suite's owner (unless the filters name other owners). */
function query(filters: Partial<Filters> = {}): Promise<IGetChargesByFiltersResult[]> {
  return createProvider().getChargesByFilters({ ownerIds: [OWNER], ...filters } as Filters);
}

/** Names of the matching charges, sorted, so a test states the exact set a filter keeps. */
async function matching(filters: Partial<Filters> = {}): Promise<ChargeName[]> {
  const rows = await query(filters);
  return rows.map(row => chargeNamesById.get(row.id)!).sort();
}

/** Names in the order the query returned them. */
async function ordered(filters: Partial<Filters>): Promise<ChargeName[]> {
  const rows = await query(filters);
  return rows.map(row => chargeNamesById.get(row.id)!);
}

/** Restricts a query to the named charges, for filters that only make sense on a small set. */
function among(...names: ChargeName[]): Pick<Filters, 'IDs'> {
  return { IDs: names.map(name => chargeIds[name]) };
}

function allExcept(...names: ChargeName[]): ChargeName[] {
  return CHARGE_NAMES.filter(name => !names.includes(name)).sort();
}

async function row(name: ChargeName): Promise<IGetChargesByFiltersResult> {
  const [result] = await query(among(name));
  expect(result, `charge "${name}" should be returned`).toBeDefined();
  return result!;
}

const sorted = (values: readonly (string | null)[] | null | undefined) => [...(values ?? [])].sort();

async function seed() {
  // `financial_entities.owner_id` references `businesses`, so the owner entity is created with no
  // owner first, then its business row points at itself.
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
     VALUES ($1, 'charges-by-filters owner', 'business', NULL)`,
    [OWNER],
  );
  // The owner can settle with a receipt so a document it issues to itself has a counterparty
  // that does.
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id, can_settle_with_receipt)
     VALUES ($1, $1, true)`,
    [OWNER],
  );

  for (const business of BUSINESSES) {
    await pool.query(
      `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
       VALUES ($1, $2, 'business', $3)`,
      [business.id, business.name, OWNER],
    );
    await pool.query(
      `INSERT INTO accounter_schema.businesses
         (id, owner_id, can_settle_with_receipt, no_invoices_required)
       VALUES ($1, $2, $3, $4)`,
      [
        business.id,
        OWNER,
        'canSettleWithReceipt' in business,
        'noInvoicesRequired' in business,
      ],
    );
  }

  for (const [id, name] of [
    [TAX_CATEGORY, 'Matched category'],
    [TAX_CATEGORY_OVERRIDE, 'Charge category'],
  ] as const) {
    await pool.query(
      `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
       VALUES ($1, $2, 'tax_category', $3)`,
      [id, name, OWNER],
    );
    await pool.query('INSERT INTO accounter_schema.tax_categories (id, owner_id) VALUES ($1, $2)', [
      id,
      OWNER,
    ]);
  }
  await pool.query(
    `INSERT INTO accounter_schema.business_tax_category_match (business_id, owner_id, tax_category_id)
     VALUES ($1, $2, $3)`,
    [OTHER, OWNER, TAX_CATEGORY],
  );

  for (const id of [ACCOUNT_A, ACCOUNT_B]) {
    await pool.query(
      `INSERT INTO accounter_schema.financial_accounts (id, account_number, type, owner_id)
       VALUES ($1, $2, 'BANK_ACCOUNT', $3)`,
      [id, `cbf-${id.slice(0, 8)}`, OWNER],
    );
  }
  for (const [id, name] of [
    [TAG_1, 'cbf tag 1'],
    [TAG_2, 'cbf tag 2'],
  ] as const) {
    await pool.query('INSERT INTO accounter_schema.tags (id, name, owner_id) VALUES ($1, $2, $3)', [
      id,
      name,
      OWNER,
    ]);
  }
  await pool.query(
    `INSERT INTO accounter_schema.business_trips (id, name, owner_id) VALUES ($1, 'cbf trip', $2)`,
    [TRIP, OWNER],
  );

  for (const name of CHARGE_NAMES) {
    await seedCharge(chargeIds[name], CHARGES[name]);
  }
}

async function seedCharge(chargeId: string, spec: ChargeSpec) {
  await pool.query(
    `INSERT INTO accounter_schema.charges
       (id, owner_id, user_description, accountant_status, type, tax_category_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      chargeId,
      OWNER,
      spec.description ?? null,
      spec.accountantStatus ?? 'UNAPPROVED',
      spec.type ?? null,
      spec.taxCategoryId ?? null,
    ],
  );

  for (const [index, tx] of (spec.transactions ?? []).entries()) {
    // Every transaction needs a raw-list row; an etherscan id is the one source with no trigger.
    const originKey = randomUUID();
    const {
      rows: [raw],
    } = await pool.query<{ id: string }>(
      'INSERT INTO accounter_schema.transactions_raw_list (etherscan_id) VALUES ($1) RETURNING id',
      [originKey],
    );
    rawTransactionIds.push(raw!.id);
    await pool.query(
      `INSERT INTO accounter_schema.transactions (
         id, account_id, charge_id, source_id, source_description, source_reference, source_origin,
         origin_key, currency, event_date, debit_date, debit_date_override, amount, current_balance,
         business_id, is_fee, currency_rate, owner_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'TEST', $7, $8, $9, $10, $11, $12, 0, $13, $14, 1, $15)`,
      [
        randomUUID(),
        tx.accountId ?? ACCOUNT_A,
        chargeId,
        raw!.id,
        tx.description ?? null,
        // Unique and free of any search term used below.
        tx.reference ?? `zz-${chargeId.slice(0, 8)}-${index}`,
        originKey,
        tx.currency ?? 'ILS',
        tx.eventDate,
        tx.debitDate === undefined ? tx.eventDate : tx.debitDate,
        tx.debitDateOverride ?? null,
        tx.amount,
        tx.businessId ?? null,
        tx.isFee ?? false,
        OWNER,
      ],
    );
  }

  for (const doc of spec.documents ?? []) {
    const documentId = randomUUID();
    await pool.query(
      `INSERT INTO accounter_schema.documents (
         id, charge_id, type, date, total_amount, vat_amount, currency_code, creditor_id,
         debtor_id, serial_number, description, remarks, owner_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        documentId,
        chargeId,
        doc.type,
        doc.date ?? null,
        doc.total ?? null,
        doc.vat ?? null,
        doc.currency ?? null,
        doc.creditorId ?? null,
        doc.debtorId ?? null,
        doc.serial ?? null,
        doc.description ?? null,
        doc.remarks ?? null,
        OWNER,
      ],
    );
    if (doc.issuedStatus) {
      await pool.query(
        `INSERT INTO accounter_schema.documents_issued (id, external_id, status, owner_id)
         VALUES ($1, $2, $3, $4)`,
        [documentId, randomUUID(), doc.issuedStatus, OWNER],
      );
    }
  }

  for (const record of spec.ledger ?? []) {
    await pool.query(
      `INSERT INTO accounter_schema.ledger_records
         (owner_id, charge_id, currency, invoice_date, value_date, credit_entity1, debit_entity1)
       VALUES ($1, $2, 'ILS', $3, $4, $5, $6)`,
      [
        OWNER,
        chargeId,
        record.invoiceDate,
        record.valueDate,
        record.credit1 ?? null,
        record.debit1 ?? null,
      ],
    );
  }

  for (const expense of spec.miscExpenses ?? []) {
    await pool.query(
      `INSERT INTO accounter_schema.misc_expenses
         (charge_id, amount, currency, creditor_id, debtor_id, invoice_date, value_date, owner_id)
       VALUES ($1, 10, 'ILS', $2, $3, '2025-09-01', '2025-09-01', $4)`,
      [chargeId, expense.creditorId, expense.debtorId, OWNER],
    );
  }

  for (const tagId of spec.tags ?? []) {
    await pool.query(
      'INSERT INTO accounter_schema.charge_tags (charge_id, tag_id, owner_id) VALUES ($1, $2, $3)',
      [chargeId, tagId, OWNER],
    );
  }

  if (spec.tripId) {
    await pool.query(
      `INSERT INTO accounter_schema.business_trip_charges (business_trip_id, charge_id, owner_id)
       VALUES ($1, $2, $3)`,
      [spec.tripId, chargeId, OWNER],
    );
  }

  for (const year of spec.spreadYears ?? []) {
    await pool.query(
      `INSERT INTO accounter_schema.charge_spread (charge_id, year_of_relevance, owner_id)
       VALUES ($1, $2, $3)`,
      [chargeId, year, OWNER],
    );
  }

  for (const execution of spec.securities ?? []) {
    const executionId = randomUUID();
    await pool.query(
      `INSERT INTO accounter_schema.poalim_securities_transactions (
         id, owner_id, bank_number, branch_number, account_number, security, trade_date,
         value_date, trade_type, transaction_type, occurrence
       )
       VALUES ($1, $2, 12, 600, 123456, 'TEST', $3, $4, 'BUY', 'TEST', 1)`,
      [executionId, OWNER, execution.tradeDate, execution.valueDate],
    );
    await pool.query(
      `INSERT INTO accounter_schema.charges_securities_executions (execution_id, charge_id, owner_id)
       VALUES ($1, $2, $3)`,
      [executionId, chargeId, OWNER],
    );
  }
}

async function cleanUp() {
  for (const table of [
    'charge_tags',
    'business_trip_charges',
    'charge_spread',
    'charges_securities_executions',
    'poalim_securities_transactions',
    'documents_issued',
    'documents',
    'ledger_records',
    'misc_expenses',
    'transactions',
    'charges',
    'business_trips',
    'tags',
    'financial_accounts',
    'business_tax_category_match',
    'tax_categories',
  ]) {
    await pool.query(`DELETE FROM accounter_schema.${table} WHERE owner_id = $1`, [OWNER]);
  }
  await pool.query('DELETE FROM accounter_schema.transactions_raw_list WHERE id = ANY($1)', [
    rawTransactionIds,
  ]);
  await pool.query('DELETE FROM accounter_schema.businesses WHERE owner_id = $1 AND id <> $1', [
    OWNER,
  ]);
  await pool.query('DELETE FROM accounter_schema.financial_entities WHERE owner_id = $1', [OWNER]);
  await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [OWNER]);
  await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [OWNER]);
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  await seed();
});

afterAll(async () => {
  await cleanUp();
  // Do NOT close the pool here — it is shared with other concurrently-running suites.
});

describe('ChargesProvider.getChargesByFilters', () => {
  describe('scope', () => {
    it('returns every charge of the owner when no other filter is set', async () => {
      expect(await matching()).toEqual([...CHARGE_NAMES].sort());
    });

    it('returns nothing for an owner with no charges', async () => {
      expect(await matching({ ownerIds: [randomUUID()] })).toEqual([]);
    });

    it('narrows to the given charge ids', async () => {
      expect(await matching(among('coffee', 'empty'))).toEqual(['coffee', 'empty']);
    });

    it('treats an empty id list as no id filter', async () => {
      expect(await matching({ IDs: [] })).toEqual([...CHARGE_NAMES].sort());
    });
  });

  describe('free text', () => {
    it('matches the charge description, case-insensitively', async () => {
      expect(await matching({ freeText: 'morning coffee' })).toEqual(['coffee']);
      expect(await matching({ freeText: 'MORNING' })).toEqual(['coffee']);
    });

    it('matches transaction descriptions and references', async () => {
      expect(await matching({ freeText: 'cafe noir' })).toEqual(['coffee']);
      expect(await matching({ freeText: 'ref-coffee' })).toEqual(['coffee']);
    });

    it('matches document descriptions, remarks and serial numbers', async () => {
      expect(await matching({ freeText: 'january consulting' })).toEqual(['consulting']);
      expect(await matching({ freeText: 'quarterly retainer' })).toEqual(['remarksDocument']);
      expect(await matching({ freeText: 'inv-1001' })).toEqual(['consulting']);
    });

    it('matches transaction amounts, signed or absolute, with or without thousands separators', async () => {
      expect(await matching({ freeText: '1234.56' })).toEqual(['bigAmount']);
      expect(await matching({ freeText: '1,234.56' })).toEqual(['bigAmount']);
      expect(await matching({ freeText: '-1234.56' })).toEqual(['bigAmount']);
    });

    it('matches document totals and VAT amounts', async () => {
      expect(await matching({ freeText: '11700' })).toEqual(['consulting']);
      expect(await matching({ freeText: '76.27' })).toEqual(['supplierReceipt']);
    });

    it('matches the counterparty name on a transaction', async () => {
      expect(await matching({ freeText: 'exempt fees' })).toEqual(['exemptCounterparty']);
    });

    it('matches the counterparty name on a document, as creditor or debtor', async () => {
      expect(await matching({ freeText: 'globex' })).toEqual(['remarksDocument']);
      expect(await matching({ freeText: 'initech' })).toEqual(['creditInvoice']);
    });

    // Misc expenses and ledger records aren't searched by counterparty name.
    it('does not match counterparties that appear only in misc expenses or ledger records', async () => {
      expect(await matching({ freeText: 'fabrikam' })).toEqual([
        'chargeTaxCategory',
        'matchedTaxCategory',
        'payroll',
      ]);
      expect(await matching({ freeText: 'umbrella' })).toEqual([]);
    });

    it('treats whitespace-only text as no filter', async () => {
      expect(await matching({ freeText: '   ' })).toEqual([...CHARGE_NAMES].sort());
    });
  });

  describe('excluded free text', () => {
    it('drops the charges that mention it and keeps charges with no text at all', async () => {
      expect(await matching({ excludedFreeText: 'coffee' })).toEqual(allExcept('coffee'));
    });

    it('drops by counterparty name and by amount, like the positive search', async () => {
      expect(await matching({ excludedFreeText: 'fabrikam' })).toEqual(
        allExcept('chargeTaxCategory', 'matchedTaxCategory', 'payroll'),
      );
      expect(await matching({ excludedFreeText: '1,234.56' })).toEqual(allExcept('bigAmount'));
    });

    it('combines with the positive search', async () => {
      expect(await matching({ freeText: 'fabrikam', excludedFreeText: 'payroll' })).toEqual([
        'chargeTaxCategory',
        'matchedTaxCategory',
        'payroll',
      ]);
      expect(await matching({ freeText: 'fabrikam', excludedFreeText: '5000' })).toEqual([
        'chargeTaxCategory',
        'matchedTaxCategory',
      ]);
    });

    it('treats whitespace-only text as no exclusion', async () => {
      expect(await matching({ excludedFreeText: '  ' })).toEqual([...CHARGE_NAMES].sort());
    });
  });

  describe('counterparties', () => {
    it('matches a counterparty from transactions, documents, misc expenses and ledger records', async () => {
      expect(await matching({ businessIds: [OTHER] })).toEqual([
        'chargeTaxCategory',
        'matchedTaxCategory',
        'miscExpense',
        'payroll',
      ]);
      expect(await matching({ businessIds: [GLOBEX] })).toEqual(['remarksDocument']);
      expect(await matching({ businessIds: [INITECH] })).toEqual(['creditInvoice']);
      expect(await matching({ businessIds: [UMBRELLA] })).toEqual(['ledgerOnly']);
    });

    it('matches any of several counterparties', async () => {
      expect(await matching({ businessIds: [GLOBEX, INITECH] })).toEqual([
        'creditInvoice',
        'remarksDocument',
      ]);
    });

    it('never treats the owner itself as a counterparty', async () => {
      expect(await matching({ businessIds: [OWNER] })).toEqual([]);
    });

    it('excludes charges involving a counterparty and keeps charges with none', async () => {
      expect(await matching({ excludedBusinessIds: [OTHER] })).toEqual(
        allExcept('chargeTaxCategory', 'matchedTaxCategory', 'miscExpense', 'payroll'),
      );
    });

    it('lets the exclusion win over the inclusion', async () => {
      expect(await matching({ businessIds: [OTHER], excludedBusinessIds: [OTHER] })).toEqual([]);
    });

    it('matches charges with a transaction or invoice-type document missing its counterparty', async () => {
      expect(await matching({ withMissingCounterparty: true })).toEqual([
        'missingCounterpartyDocument',
        'missingCounterpartyTransaction',
      ]);
    });
  });

  describe('dates', () => {
    // consulting: invoice 2025-01-28, transaction 2025-02-03 · debitOverride: transaction
    // 2025-08-01, debited 2025-08-10 · securities: executed 2025-12-03 · ledgerOnly: ledger
    // 2024-06-30 / 2024-07-02 · empty: no dates.
    const window = among('consulting', 'debitOverride', 'securities', 'ledgerOnly', 'empty');

    it('fromDate keeps charges that start on or after it (documents first, then transactions)', async () => {
      expect(await matching({ ...window, fromDate: '2025-02-01' })).toEqual([
        'debitOverride',
        'securities',
      ]);
      expect(await matching({ ...window, fromDate: '2025-01-28' })).toEqual([
        'consulting',
        'debitOverride',
        'securities',
      ]);
    });

    it('toDate keeps charges that end on or before it', async () => {
      expect(await matching({ ...window, toDate: '2025-01-31' })).toEqual(['consulting']);
      expect(await matching({ ...window, toDate: '2025-12-03' })).toEqual([
        'consulting',
        'debitOverride',
        'securities',
      ]);
    });

    // Containment ignores ledger dates, so a ledger-only charge never matches it.
    it('ignores ledger dates and dateless charges for fromDate/toDate', async () => {
      expect(await matching({ ...window, fromDate: '2000-01-01', toDate: '2100-01-01' })).toEqual([
        'consulting',
        'debitOverride',
        'securities',
      ]);
    });

    it('fromAnyDate keeps charges with any date on or after it, debit and ledger dates included', async () => {
      expect(await matching({ ...window, fromAnyDate: '2025-02-01' })).toEqual([
        'consulting',
        'debitOverride',
        'securities',
      ]);
      expect(await matching({ ...window, fromAnyDate: '2025-08-05' })).toEqual([
        'debitOverride',
        'securities',
      ]);
      expect(await matching({ ...window, fromAnyDate: '2024-07-01' })).toEqual([
        'consulting',
        'debitOverride',
        'ledgerOnly',
        'securities',
      ]);
    });

    it('toAnyDate keeps charges with any date on or before it', async () => {
      expect(await matching({ ...window, toAnyDate: '2024-12-31' })).toEqual(['ledgerOnly']);
      expect(await matching({ ...window, toAnyDate: '2025-01-31' })).toEqual([
        'consulting',
        'ledgerOnly',
      ]);
    });

    it('combines fromAnyDate and toAnyDate into an overlap window', async () => {
      expect(
        await matching({ ...window, fromAnyDate: '2025-02-01', toAnyDate: '2025-02-28' }),
      ).toEqual(['consulting']);
    });
  });

  describe('charge kind', () => {
    const kinds = among('consulting', 'clientReceipt', 'coffee', 'proforma', 'empty');

    it('splits income and expense by the transactions total', async () => {
      expect(await matching({ ...kinds, chargeType: 'INCOME' })).toEqual([
        'clientReceipt',
        'consulting',
      ]);
      // Charges with no transactions are neither.
      expect(await matching({ ...kinds, chargeType: 'EXPENSE' })).toEqual(['coffee']);
      expect(await matching({ ...kinds, chargeType: 'ALL' })).toEqual([
        'clientReceipt',
        'coffee',
        'consulting',
        'empty',
        'proforma',
      ]);
    });

    it('narrows to a charge type', async () => {
      expect(await matching({ type: 'PAYROLL' })).toEqual(['payroll']);
    });

    it('narrows to accountant statuses', async () => {
      expect(await matching({ accountantStatuses: ['APPROVED'] })).toEqual(['coffee']);
      expect(await matching({ accountantStatuses: ['APPROVED', 'PENDING'] })).toEqual([
        'coffee',
        'consulting',
      ]);
    });
  });

  describe('missing pieces', () => {
    it('withoutInvoice keeps charges with no invoice or credit invoice', async () => {
      expect(
        await matching({
          ...among('consulting', 'creditInvoice', 'supplierReceipt', 'proforma', 'empty'),
          withoutInvoice: true,
        }),
      ).toEqual(['empty', 'proforma', 'supplierReceipt']);
    });

    it('withoutReceipt keeps charges with no receipt, unless the counterparty needs no invoices', async () => {
      expect(
        await matching({
          ...among('supplierReceipt', 'consulting', 'exemptCounterparty', 'empty'),
          withoutReceipt: true,
        }),
      ).toEqual(['consulting', 'empty']);
    });

    it('withoutDocuments keeps charges with no documents of any type', async () => {
      expect(
        await matching({
          ...among('consulting', 'coffee', 'remarksDocument', 'empty'),
          withoutDocuments: true,
        }),
      ).toEqual(['coffee', 'empty']);
    });

    it('withoutTransactions keeps charges with no transactions', async () => {
      expect(
        await matching({
          ...among('consulting', 'coffee', 'proforma', 'empty'),
          withoutTransactions: true,
        }),
      ).toEqual(['empty', 'proforma']);
    });

    it('withOpenDocuments keeps charges with an open issued document', async () => {
      expect(
        await matching({
          ...among('consulting', 'closedInvoice', 'coffee'),
          withOpenDocuments: true,
        }),
      ).toEqual(['consulting']);
    });

    it('withoutLedger keeps charges with no ledger records', async () => {
      expect(await matching({ ...among('ledgerOnly', 'coffee'), withoutLedger: true })).toEqual([
        'coffee',
      ]);
    });

    it('treats false flags as unset', async () => {
      expect(
        await matching({
          withoutInvoice: false,
          withoutReceipt: false,
          withoutDocuments: false,
          withoutTransactions: false,
          withOpenDocuments: false,
          withoutLedger: false,
          withoutTags: false,
          withMissingCounterparty: false,
        }),
      ).toEqual([...CHARGE_NAMES].sort());
    });
  });

  describe('tags', () => {
    it('matches charges with any of the given tags', async () => {
      expect(await matching({ tags: [TAG_1] })).toEqual(['coffee']);
      expect(await matching({ tags: [TAG_1, TAG_2] })).toEqual(['coffee', 'consulting']);
    });

    it('excludes charges with a tag and keeps untagged ones', async () => {
      expect(await matching({ excludedTags: [TAG_1] })).toEqual(allExcept('coffee'));
    });

    it('lets the exclusion win over the inclusion', async () => {
      expect(await matching({ tags: [TAG_1], excludedTags: [TAG_1] })).toEqual([]);
    });

    it('withoutTags keeps only untagged charges', async () => {
      expect(await matching({ withoutTags: true })).toEqual(allExcept('coffee', 'consulting'));
    });
  });

  describe('trips and accounts', () => {
    it('narrows to business trips', async () => {
      expect(await matching({ businessTripIds: [TRIP] })).toEqual(['tripCharge']);
    });

    it('narrows to charges with a transaction on one of the accounts', async () => {
      expect(await matching({ accountIds: [ACCOUNT_B] })).toEqual([
        'clientReceipt',
        'consulting',
        'payroll',
        'tripCharge',
      ]);
    });

    it('excludes charges with a transaction on the account and keeps charges with none', async () => {
      expect(await matching({ excludedAccountIds: [ACCOUNT_B] })).toEqual(
        allExcept('clientReceipt', 'consulting', 'payroll', 'tripCharge'),
      );
    });
  });

  it('ANDs different filters together', async () => {
    expect(
      await matching({
        businessIds: [SUPPLIER],
        accountIds: [ACCOUNT_A],
        fromAnyDate: '2025-09-01',
        withoutDocuments: true,
        excludedFreeText: '1,234.56',
      }),
    ).toEqual(['miscExpense', 'spreadCharge']);
  });

  describe('sorting', () => {
    // Sort dates: coffee debited 2025-01-11 · consulting debited 2025-02-03 (before its invoice
    // date is considered) · supplierReceipt 2025-03-05 · proforma (no transactions) document
    // 2025-05-01 · ledgerOnly ledger value date 2024-07-02.
    const dated = among('coffee', 'consulting', 'supplierReceipt', 'proforma', 'ledgerOnly');

    it('sorts by date, newest first, by default', async () => {
      expect(await ordered(dated)).toEqual([
        'proforma',
        'supplierReceipt',
        'consulting',
        'coffee',
        'ledgerOnly',
      ]);
    });

    it('sorts by date, oldest first', async () => {
      expect(await ordered({ ...dated, asc: true })).toEqual([
        'ledgerOnly',
        'coffee',
        'consulting',
        'supplierReceipt',
        'proforma',
      ]);
    });

    // Amounts: supplierReceipt -500 · coffee -12.50 · proforma 2,000 · consulting 11,700.
    const amounts = among('coffee', 'consulting', 'supplierReceipt', 'proforma');

    it('sorts by signed amount', async () => {
      expect(await ordered({ ...amounts, sortColumn: 'event_amount', asc: true })).toEqual([
        'supplierReceipt',
        'coffee',
        'proforma',
        'consulting',
      ]);
      expect(await ordered({ ...amounts, sortColumn: 'event_amount', asc: false })).toEqual([
        'consulting',
        'proforma',
        'coffee',
        'supplierReceipt',
      ]);
    });

    it('sorts by absolute amount', async () => {
      expect(await ordered({ ...amounts, sortColumn: 'abs_event_amount', asc: true })).toEqual([
        'coffee',
        'supplierReceipt',
        'proforma',
        'consulting',
      ]);
      expect(await ordered({ ...amounts, sortColumn: 'abs_event_amount', asc: false })).toEqual([
        'consulting',
        'proforma',
        'supplierReceipt',
        'coffee',
      ]);
    });
  });

  describe('computed fields', () => {
    it('a charge with nothing attached has empty aggregates', async () => {
      expect(await row('empty')).toMatchObject({
        event_amount: null,
        transactions_count: null,
        documents_count: null,
        ledger_count: null,
        business_array: null,
        business_id: null,
        tags: null,
        can_settle_with_receipt: false,
        no_invoices_required: false,
      });
    });

    it('a transaction-only charge takes its amount, dates and currency from the transaction', async () => {
      expect(await row('coffee')).toMatchObject({
        user_description: 'Morning Coffee',
        accountant_status: 'APPROVED',
        event_amount: '-12.50',
        abs_event_amount: '12.50',
        transactions_event_amount: '-12.50',
        transactions_count: '1',
        transactions_currency: 'ILS',
        transactions_min_event_date: '2025-01-10',
        transactions_max_event_date: '2025-01-10',
        transactions_min_debit_date: '2025-01-11',
        transactions_max_debit_date: '2025-01-11',
        account_array: [ACCOUNT_A],
        business_array: [SUPPLIER],
        main_business_array: [SUPPLIER],
        business_id: SUPPLIER,
        can_settle_with_receipt: true,
        tags: [TAG_1],
        invalid_transactions: false,
        missing_counterparty_transactions: false,
        documents_count: null,
      });
    });

    it('an invoice sets the amount, VAT, dates, currency and counts', async () => {
      expect(await row('consulting')).toMatchObject({
        event_amount: '11700',
        documents_event_amount: 11_700,
        documents_vat_amount: 1700,
        documents_invoice_amount: 11_700,
        documents_invoice_vat_amount: 1700,
        documents_receipt_amount: null,
        documents_min_date: '2025-01-28',
        documents_max_date: '2025-01-28',
        documents_currency: 'ILS',
        documents_accountancy_currencies: ['ILS'],
        invoices_count: '1',
        receipts_count: '0',
        documents_count: '1',
        open_docs_flag: true,
        invalid_documents: false,
        missing_counterparty_documents: false,
        business_id: CLIENT,
      });
    });

    it('a closed issued document is not open', async () => {
      expect((await row('closedInvoice')).open_docs_flag).toBe(false);
    });

    /**
     * Receipts count toward the documents amount only when the counterparty (the side of the
     * document that isn't the owner) can settle with a receipt. These pin how that counterparty
     * is resolved.
     */
    describe('receipts and the counterparty that can settle with them', () => {
      it('counts a receipt from a supplier who can settle with receipts, as an expense', async () => {
        expect(await row('supplierReceipt')).toMatchObject({
          documents_event_amount: -500,
          documents_vat_amount: -76.27,
          documents_receipt_amount: -500,
          documents_receipt_vat_amount: -76.27,
          documents_currency: 'ILS',
          event_amount: '-500',
          receipts_count: '1',
          invoices_count: '0',
        });
      });

      it('resolves the counterparty from the debtor side when the owner is the creditor', async () => {
        expect(await row('receiptOwnerCreditor')).toMatchObject({
          documents_event_amount: 300,
          documents_receipt_amount: 300,
          documents_currency: 'ILS',
        });
      });

      it('ignores a receipt for documents amounts when the counterparty cannot settle with receipts', async () => {
        expect(await row('clientReceipt')).toMatchObject({
          documents_event_amount: null,
          documents_vat_amount: null,
          documents_currency: null,
          // The display amounts don't depend on the counterparty.
          documents_receipt_amount: 800,
          event_amount: '800',
          receipts_count: '1',
        });
      });

      it('resolves the counterparty from the creditor side when the owner is the debtor', async () => {
        expect(await row('receiptFromNonSettling')).toMatchObject({
          documents_event_amount: null,
          documents_currency: null,
          documents_receipt_amount: -650,
          event_amount: '-650',
        });
      });

      it('finds no counterparty when neither side of the document is the owner', async () => {
        expect(await row('thirdPartyReceipt')).toMatchObject({
          documents_event_amount: null,
          documents_currency: null,
          documents_receipt_amount: 100,
          event_amount: '100',
        });
      });

      it('treats the owner as the counterparty of a document it issued to itself', async () => {
        expect(await row('selfReceipt')).toMatchObject({
          // The two amount families sign by different sides: documents_* checks "owner is the
          // creditor" first (+), documents_receipt_* checks "owner is the debtor" first (-).
          documents_event_amount: 50,
          documents_receipt_amount: -50,
          documents_currency: 'ILS',
          business_array: [],
          business_id: null,
        });
      });
    });

    it('prefers invoices over receipts for the amount, and spans every document for dates', async () => {
      expect(await row('invoiceAndReceipt')).toMatchObject({
        event_amount: '-1000',
        documents_event_amount: -1000,
        documents_invoice_amount: -1000,
        documents_receipt_amount: -1000,
        invoices_count: '1',
        receipts_count: '1',
        documents_count: '2',
        documents_min_date: '2025-04-01',
        documents_max_date: '2025-04-20',
      });
    });

    it('counts a credit invoice as an invoice', async () => {
      expect(await row('creditInvoice')).toMatchObject({
        invoices_count: '1',
        documents_event_amount: 200,
        documents_vat_amount: 34,
        event_amount: '200',
      });
    });

    it('falls back to a proforma for the amount, currency and dates', async () => {
      expect(await row('proforma')).toMatchObject({
        event_amount: '2000',
        documents_proforma_amount: 2000,
        documents_proforma_currencies: ['USD'],
        documents_accountancy_currencies: null,
        documents_event_amount: null,
        documents_currency: null,
        documents_min_date: '2025-05-01',
        documents_max_date: '2025-05-01',
        invoices_count: '0',
        receipts_count: '0',
        documents_count: '1',
      });
    });

    it('flags invalid documents and missing counterparties', async () => {
      expect(await row('unprocessedDocument')).toMatchObject({
        invalid_documents: true,
        missing_counterparty_documents: false,
      });
      expect(await row('missingCounterpartyDocument')).toMatchObject({
        invalid_documents: true,
        missing_counterparty_documents: true,
      });
    });

    it('flags invalid transactions and missing counterparties', async () => {
      expect(await row('missingCounterpartyTransaction')).toMatchObject({
        invalid_transactions: true,
        missing_counterparty_transactions: true,
        business_id: null,
      });
      expect(await row('undebitedTransaction')).toMatchObject({
        invalid_transactions: true,
        missing_counterparty_transactions: false,
        transactions_min_debit_date: null,
      });
    });

    it('separates fees from the main amount, currency and counterparty', async () => {
      const charge = await row('withFee');
      expect(charge).toMatchObject({
        event_amount: '-1015.00',
        transactions_event_amount: '-1015.00',
        transactions_fee_excluded_amount: '-1000.00',
        transactions_fee_excluded_currencies: ['USD'],
        // Mixed currencies have no single transactions currency.
        transactions_currency: null,
        main_business_array: [SUPPLIER],
        business_id: SUPPLIER,
        transactions_count: '2',
      });
      expect(sorted(charge.business_array)).toEqual(sorted([SUPPLIER, BANK]));
    });

    it('falls back to the fees when a charge has nothing else', async () => {
      expect(await row('onlyFees')).toMatchObject({
        transactions_fee_excluded_amount: '-20.00',
        transactions_fee_excluded_currencies: ['ILS'],
        main_business_array: [],
        business_id: null,
      });
    });

    it('uses the debit date override over the bank debit date', async () => {
      expect(await row('debitOverride')).toMatchObject({
        transactions_min_debit_date: '2025-08-10',
        transactions_max_debit_date: '2025-08-10',
        transactions_min_event_date: '2025-08-01',
      });
    });

    it('takes ledger counts, entities and dates from ledger records', async () => {
      const charge = await row('ledgerOnly');
      expect(charge).toMatchObject({
        ledger_count: '1',
        ledger_min_invoice_date: '2024-06-30',
        ledger_max_invoice_date: '2024-06-30',
        ledger_min_value_date: '2024-07-02',
        ledger_max_value_date: '2024-07-02',
        business_array: [UMBRELLA],
        // Ledger counterparties never make the charge's main business.
        main_business_array: [],
        business_id: null,
      });
      expect(sorted(charge.ledger_financial_entities)).toEqual(sorted([UMBRELLA, OWNER]));
    });

    it('lists misc-expense counterparties without making them the main business', async () => {
      const charge = await row('miscExpense');
      expect(sorted(charge.business_array)).toEqual(sorted([SUPPLIER, OTHER]));
      expect(charge).toMatchObject({ main_business_array: [SUPPLIER], business_id: SUPPLIER });
    });

    it('has no main business when there are several counterparties', async () => {
      const charge = await row('multiCounterparty');
      expect(sorted(charge.business_array)).toEqual(sorted([SUPPLIER, CLIENT]));
      expect(charge).toMatchObject({ business_id: null, tax_category_id: null });
    });

    it('takes the tax category from the main business, unless the charge sets its own', async () => {
      expect((await row('matchedTaxCategory')).tax_category_id).toBe(TAX_CATEGORY);
      expect((await row('chargeTaxCategory')).tax_category_id).toBe(TAX_CATEGORY_OVERRIDE);
    });

    it('carries the business trip, years of relevance and charge type', async () => {
      expect((await row('tripCharge')).business_trip_id).toBe(TRIP);
      expect(sorted((await row('spreadCharge')).years_of_relevance)).toEqual([
        '2024-01-01',
        '2025-01-01',
      ]);
      expect((await row('payroll')).type).toBe('PAYROLL');
    });

    it('carries no-invoices-required from the main business', async () => {
      expect((await row('exemptCounterparty')).no_invoices_required).toBe(true);
    });

    it('takes dates from securities executions when a charge has nothing else', async () => {
      expect(await row('securities')).toMatchObject({
        securities_executions_min_date: '2025-12-03',
        securities_executions_max_date: '2025-12-03',
      });
    });
  });
});
