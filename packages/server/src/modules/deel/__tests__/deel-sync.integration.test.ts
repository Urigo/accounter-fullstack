import type { Injector } from 'graphql-modules';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectTestDb } from '../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../__tests__/helpers/db-migrations.js';
import type { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { CloudinaryProvider } from '../../app-providers/cloudinary.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import { DeelClientProvider } from '../../app-providers/deel/deel-client.provider.js';
import type { Invoice } from '../../app-providers/deel/schemas.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import type { ChargesAuthorizationProvider } from '../../charges/providers/charges-authorization.provider.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import type { ReceiptSyncUnit } from '../helpers/deel-sync-plan.helper.js';
import { createDeelInvoiceMatchFromUnmatchedInvoice, type DeelInvoiceMatch } from '../helpers/deel.helper.js';
import { DeelContractsProvider } from '../providers/deel-contracts.provider.js';
import { DeelInvoicesProvider } from '../providers/deel-invoices.provider.js';

vi.mock('../../documents/helpers/upload.helper.js', () => ({
  uploadToCloudinary: vi.fn(async () => ({
    fileUrl: 'https://files.example/deel.pdf',
    imageUrl: 'https://files.example/deel.jpg',
  })),
  releaseDbConnectionForExternalWork: vi.fn(async () => undefined),
}));

const { syncUnit } = await import('../helpers/deel-sync-execute.helper.js');

const OWNER_ID = '00000000-0000-0000-0000-0000000d0e10';
const DEEL_BUSINESS_ID = '00000000-0000-0000-0000-0000000d0e11';
// what getDeelChargeDescription names a receipt charge whose workers it does not know
const CHARGE_DESCRIPTION = 'Deel payment';

let pool: Pool;

function createInjector(): Injector {
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
  const adminContextProvider = {
    getVerifiedAdminContext: () => Promise.resolve({ ownerId: OWNER_ID }),
  } as unknown as AdminContextProvider;

  const db = new TenantAwareDBClient(new DBProvider(pool), authContextProvider);
  const providers = new Map<unknown, unknown>([
    [TenantAwareDBClient, db],
    [
      ChargesProvider,
      new ChargesProvider(db, {
        canWriteCharge: async () => undefined,
      } as unknown as ChargesAuthorizationProvider),
    ],
    [DocumentsProvider, new DocumentsProvider(db, adminContextProvider)],
    [DeelInvoicesProvider, new DeelInvoicesProvider(db, adminContextProvider)],
    [
      DeelClientProvider,
      { getSalaryInvoiceFile: async (id: string) => new Blob([`pdf of ${id}`]) },
    ],
    [CloudinaryProvider, { deleteUpload: async () => undefined }],
    [DeelContractsProvider, { getEmployeeByContractIdLoader: { loadMany: async () => [] } }],
  ]);
  return {
    get: (token: unknown) => {
      if (!providers.has(token)) {
        throw new Error(`Unexpected provider ${String(token)}`);
      }
      return providers.get(token);
    },
  } as unknown as Injector;
}

function match(id: string, overrides: Partial<Invoice> = {}): DeelInvoiceMatch {
  return {
    ...createDeelInvoiceMatchFromUnmatchedInvoice({
      id,
      label: `INV-${id}`,
      amount: '100.00',
      total: '100.00',
      currency: 'USD',
      deel_fee: '0.00',
      status: 'paid',
      contract_id: null,
      billing_type: 'WORK',
      document_type: 'INVOICE',
      created_at: '2026-01-05T10:00:00.000Z',
      issued_at: 'Mon, 05 Jan 2026 10:00:00 GMT',
      due_date: 'Mon, 19 Jan 2026 10:00:00 GMT',
      paid_at: '2026-01-06T10:00:00.000Z',
      is_overdue: false,
      vat_id: '',
      vat_percentage: '',
      vat_total: '0.00',
      recipient_legal_entity_id: '1dee10b1-0000-4000-8000-000000000000',
      ...overrides,
    } as Invoice),
    breakdown_receipt_id: 'rcpt-int-1',
    breakdown_contractor_employee_name: 'Jane Doe',
  };
}

function receiptUnit(inserts: DeelInvoiceMatch[]): ReceiptSyncUnit {
  return { kind: 'receipt', receiptId: 'rcpt-int-1', existingChargeId: null, workers: [], inserts, updates: [] };
}

async function seedBusiness(id: string, ownerId: string | null, name: string) {
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
     VALUES ($1, $2, 'business', $3)
     ON CONFLICT (id) DO NOTHING`,
    [id, name, ownerId],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id, country)
     VALUES ($1, $2, 'ISR')
     ON CONFLICT (id) DO NOTHING`,
    [id, ownerId ?? id],
  );
}

async function cleanup() {
  await pool.query('DELETE FROM accounter_schema.deel_invoices WHERE owner_id = $1', [OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.documents WHERE owner_id = $1', [OWNER_ID]);
  await pool.query('DELETE FROM accounter_schema.charges WHERE owner_id = $1', [OWNER_ID]);
}

async function countRows() {
  const { rows } = await pool.query<{ charges: number; documents: number; invoices: number }>(
    `SELECT
       (SELECT count(*)::int FROM accounter_schema.charges
          WHERE owner_id = $1 AND user_description = $2) AS charges,
       (SELECT count(*)::int FROM accounter_schema.documents
          WHERE owner_id = $1 AND remarks IN ('int-1', 'int-2')) AS documents,
       (SELECT count(*)::int FROM accounter_schema.deel_invoices
          WHERE owner_id = $1 AND id IN ('int-1', 'int-2')) AS invoices`,
    [OWNER_ID, CHARGE_DESCRIPTION],
  );
  return rows[0];
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  await seedBusiness(OWNER_ID, null, 'deel-sync-test-owner');
  await seedBusiness(DEEL_BUSINESS_ID, OWNER_ID, 'Deel');
});

beforeEach(async () => {
  await cleanup();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterAll(async () => {
  await cleanup();
  for (const id of [DEEL_BUSINESS_ID, OWNER_ID]) {
    await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [id]);
    await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [id]);
  }
  // Do NOT close the pool here — it is shared with other concurrently-running suites.
});

describe('Deel sync unit persistence', () => {
  const context = { ownerId: OWNER_ID, deelBusinessId: DEEL_BUSINESS_ID };

  it('saves the charge, documents and deel_invoices rows of a receipt together', async () => {
    const injector = createInjector();

    const outcome = await syncUnit(injector, receiptUnit([match('int-1'), match('int-2')]), context);

    expect(outcome).toMatchObject({ ok: true });
    expect(await countRows()).toEqual({ charges: 1, documents: 2, invoices: 2 });
  });

  it('saves an invoice Deel sends without due and paid dates', async () => {
    const injector = createInjector();

    const outcome = await syncUnit(
      injector,
      receiptUnit([match('int-1', { due_date: '', paid_at: '' })]),
      context,
    );

    expect(outcome).toMatchObject({ ok: true });
    const { rows } = await pool.query(
      'SELECT due_date, paid_at FROM accounter_schema.deel_invoices WHERE id = $1',
      ['int-1'],
    );
    expect(rows[0]).toEqual({ due_date: null, paid_at: null });
  });

  it('leaves nothing behind when the last row of a receipt fails to insert', async () => {
    const injector = createInjector();

    // `is_overdue` is NOT NULL: the second invoice fails after the charge, both documents and the
    // first deel_invoices row were already written in the same transaction
    const outcome = await syncUnit(
      injector,
      receiptUnit([match('int-1'), match('int-2', { is_overdue: null as unknown as boolean })]),
      context,
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.issue.code).toBe('PERSIST_FAILED');
    expect(outcome.issue.message).toContain(
      'failed while inserting the deel_invoices row of Deel invoice [int-2]',
    );
    expect(await countRows()).toEqual({ charges: 0, documents: 0, invoices: 0 });

  });
});
