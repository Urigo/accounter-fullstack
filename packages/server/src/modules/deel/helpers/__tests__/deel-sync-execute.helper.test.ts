import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudinaryProvider } from '../../../app-providers/cloudinary.js';
import { DeelClientProvider } from '../../../app-providers/deel/deel-client.provider.js';
import type { Invoice } from '../../../app-providers/deel/schemas.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { DocumentsProvider } from '../../../documents/providers/documents.provider.js';
import { DeelContractsProvider } from '../../providers/deel-contracts.provider.js';
import { DeelInvoicesProvider } from '../../providers/deel-invoices.provider.js';
import type { ReceiptSyncUnit, StandaloneSyncUnit } from '../deel-sync-plan.helper.js';
import { createDeelInvoiceMatchFromUnmatchedInvoice, type DeelInvoiceMatch } from '../deel.helper.js';

const { degradeMock, deleteChargesMock, isChargeEmptyMock, uploadMock } = vi.hoisted(() => ({
  degradeMock: vi.fn(async (..._args: unknown[]) => new Map()),
  deleteChargesMock: vi.fn(async (..._args: unknown[]) => undefined),
  isChargeEmptyMock: vi.fn(async (..._args: unknown[]) => true),
  uploadMock: vi.fn(),
}));

vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: degradeMock,
}));
vi.mock('../../../charges/helpers/delete-charges.helper.js', () => ({
  deleteCharges: deleteChargesMock,
}));
// what makes a charge "empty" is the shared helper's business; here it is a switch
vi.mock('../../../charges/helpers/delete-empty-charges.helper.js', () => ({
  isChargeEmpty: isChargeEmptyMock,
}));
vi.mock('../../../documents/helpers/upload.helper.js', () => ({
  uploadToCloudinary: uploadMock,
  releaseDbConnectionForExternalWork: vi.fn(async () => undefined),
}));

const { syncUnit } = await import('../deel-sync-execute.helper.js');

const CONTEXT = { ownerId: 'owner-1', deelBusinessId: 'deel-business' };

function match(id: string, receiptId = 'r1'): DeelInvoiceMatch {
  return {
    ...createDeelInvoiceMatchFromUnmatchedInvoice({
      id,
      label: `L-${id}`,
      amount: '100.00',
      total: '100.00',
      currency: 'USD',
      status: 'paid',
      contract_id: 'c1',
      issued_at: 'Mon, 05 Jan 2026 10:00:00 GMT',
      vat_total: '0.00',
    } as Invoice),
    breakdown_receipt_id: receiptId,
    breakdown_contractor_employee_name: 'Jane Doe',
  };
}

function receiptUnit(overrides: Partial<ReceiptSyncUnit> = {}): ReceiptSyncUnit {
  return {
    kind: 'receipt',
    receiptId: 'r1',
    existingChargeId: null,
    workers: [],
    inserts: [match('i1'), match('i2')],
    updates: [],
    ...overrides,
  };
}

function setup() {
  const events: string[] = [];
  let depth = 0;

  const db = {
    transaction: vi.fn(async (fn: () => Promise<unknown>) => {
      depth++;
      events.push(depth === 1 ? 'BEGIN' : 'SAVEPOINT');
      try {
        const result = await fn();
        events.push(depth === 1 ? 'COMMIT' : 'RELEASE');
        return result;
      } catch (error) {
        events.push(depth === 1 ? 'ROLLBACK' : 'ROLLBACK TO SAVEPOINT');
        throw error;
      } finally {
        depth--;
      }
    }),
  };
  const deelInvoices = {
    lockInvoicesForSync: vi.fn(async (_ids: readonly string[]) => [] as unknown[]),
    insertDeelInvoiceRecords: vi.fn(async (params: { id?: string }) => {
      events.push(`insert deel_invoices ${params.id}`);
      return [];
    }),
    updateDeelInvoiceRecords: vi.fn(async (params: { id?: string }) => {
      events.push(`update deel_invoices ${params.id}`);
      return [];
    }),
    clearCache: vi.fn(),
  };
  let documentCounter = 0;
  const documents = {
    insertDocuments: vi.fn(async () => {
      documentCounter++;
      events.push(`insert document d${documentCounter}`);
      return [{ id: `d${documentCounter}` }];
    }),
    updateDocument: vi.fn(async (params: { documentId: string; chargeId: string }) => {
      events.push(`move ${params.documentId} to ${params.chargeId}`);
      return [];
    }),
    getDocumentsByChargeIdLoader: {
      clear: vi.fn(),
      load: vi.fn(async (_chargeId: string) => [] as unknown[]),
    },
    clearCache: vi.fn(),
  };
  const charges = {
    generateCharge: vi.fn(async () => {
      events.push('generate charge');
      return { id: 'new-charge' };
    }),
    clearCache: vi.fn(),
  };
  const deelClient = {
    getSalaryInvoiceFile: vi.fn(async (id: string) => new Blob([`pdf ${id}`])),
  };
  const cloudinary = { deleteUpload: vi.fn(async () => undefined) };
  const deelContracts = {
    getEmployeeByContractIdLoader: { loadMany: vi.fn(async () => []) },
  };

  const providers = new Map<unknown, unknown>([
    [TenantAwareDBClient, db],
    [DeelInvoicesProvider, deelInvoices],
    [DocumentsProvider, documents],
    [ChargesProvider, charges],
    [DeelClientProvider, deelClient],
    [CloudinaryProvider, cloudinary],
    [DeelContractsProvider, deelContracts],
  ]);
  const injector = {
    get: (token: unknown) => {
      if (!providers.has(token)) {
        throw new Error(`Unexpected provider ${String(token)}`);
      }
      return providers.get(token);
    },
  } as unknown as Injector;

  let uploadCounter = 0;
  uploadMock.mockImplementation(async () => {
    uploadCounter++;
    return {
      fileUrl: `https://files/${uploadCounter}.pdf`,
      imageUrl: `https://files/${uploadCounter}.jpg`,
      publicId: `upload-${uploadCounter}`,
      resourceType: 'image',
    };
  });

  return { injector, events, db, deelInvoices, documents, charges, deelClient, cloudinary };
}

describe('syncUnit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('saves a new receipt unit in one transaction: charge, documents and deel_invoices rows', async () => {
    const { injector, events } = setup();

    const outcome = await syncUnit(injector, receiptUnit(), CONTEXT);

    expect(outcome).toEqual({ ok: true, chargeId: 'new-charge', warnings: [] });
    expect(events).toEqual([
      'BEGIN',
      'generate charge',
      'insert document d1',
      'insert deel_invoices i1',
      'insert document d2',
      'insert deel_invoices i2',
      'COMMIT',
    ]);
    // a freshly generated charge has no approval to reset
    expect(degradeMock).toHaveBeenCalledWith(injector, [null]);
  });

  it('records the documents against the configured Deel business', async () => {
    const { injector, documents } = setup();

    await syncUnit(injector, receiptUnit({ inserts: [match('i1')] }), CONTEXT);

    const [[{ documents: inserted }]] = documents.insertDocuments.mock.calls as unknown as [
      [{ documents: Array<Record<string, unknown>> }],
    ];
    expect(inserted[0]).toMatchObject({
      creditorId: 'deel-business',
      debtorId: 'owner-1',
      chargeId: 'new-charge',
      remarks: 'i1',
      file: 'https://files/1.pdf',
    });
  });

  it.each([
    ['inserting the document of Deel invoice [i2]', 'insertDocuments'],
    ['inserting the deel_invoices row of Deel invoice [i2]', 'insertDeelInvoiceRecords'],
  ])('rolls back the whole unit when %s fails', async (step, method) => {
    const { injector, events, documents, deelInvoices, charges, cloudinary } = setup();
    const target = (method === 'insertDocuments' ? documents : deelInvoices) as unknown as Record<
      string,
      ReturnType<typeof vi.fn<(params: { id?: string }) => Promise<unknown>>>
    >;
    const original = target[method].getMockImplementation()!;
    target[method].mockImplementation(async (params: { id?: string }) => {
      if (target[method].mock.calls.length === 2) {
        throw new Error('duplicate key value violates unique constraint');
      }
      return original(params);
    });

    const outcome = await syncUnit(injector, receiptUnit(), CONTEXT);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.issue.code).toBe('PERSIST_FAILED');
    expect(outcome.issue.receiptId).toBe('r1');
    expect(outcome.issue.invoiceIds).toEqual(['i1', 'i2']);
    expect(outcome.issue.message).toContain(`failed while ${step}`);
    expect(outcome.issue.message).toContain('duplicate key value');
    expect(events.at(-1)).toBe('ROLLBACK');
    expect(events).not.toContain('COMMIT');
    // the rolled-back writes must not linger in the caches
    expect(charges.clearCache).toHaveBeenCalled();
    expect(documents.clearCache).toHaveBeenCalled();
    expect(deelInvoices.clearCache).toHaveBeenCalled();
    // nor their files in storage
    expect(cloudinary.deleteUpload).toHaveBeenCalledTimes(2);
  });

  it('writes nothing when an invoice file cannot be fetched, and removes uploads already made', async () => {
    const { injector, events, deelClient, cloudinary } = setup();
    deelClient.getSalaryInvoiceFile.mockImplementation(async (id: string) => {
      if (id === 'i2') throw new Error('Deel API GET /invoices/i2/download responded 404');
      return new Blob([`pdf ${id}`]);
    });

    const outcome = await syncUnit(injector, receiptUnit(), CONTEXT);

    expect(outcome).toMatchObject({ ok: false, issue: { code: 'INVOICE_FILE_UNAVAILABLE' } });
    if (!outcome.ok) expect(outcome.issue.message).toContain('responded 404');
    expect(events).toEqual([]);
    expect(cloudinary.deleteUpload).toHaveBeenCalledWith('upload-1', 'image');
  });

  it('reports invoices another run saved meanwhile as ALREADY_PROCESSED', async () => {
    const { injector, events, deelInvoices } = setup();
    deelInvoices.lockInvoicesForSync.mockResolvedValue([
      { id: 'i2', payment_id: 'r1', document_id: 'd9', charge_id: 'c9' },
    ]);

    const outcome = await syncUnit(injector, receiptUnit(), CONTEXT);

    expect(outcome).toMatchObject({ ok: false, issue: { code: 'ALREADY_PROCESSED' } });
    expect(events).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('moves re-matched documents, deletes their emptied charge and degrades the existing one', async () => {
    const { injector, events, deelInvoices } = setup();
    deelInvoices.lockInvoicesForSync.mockResolvedValue([
      { id: 'i3', payment_id: '', document_id: 'd3', charge_id: 'old-charge' },
    ]);

    const outcome = await syncUnit(
      injector,
      receiptUnit({ existingChargeId: 'receipt-charge', inserts: [], updates: [match('i3')] }),
      CONTEXT,
    );

    expect(outcome).toEqual({ ok: true, chargeId: 'receipt-charge', warnings: [] });
    expect(events).toEqual([
      'BEGIN',
      'move d3 to receipt-charge',
      'update deel_invoices i3',
      'SAVEPOINT',
      'RELEASE',
      'COMMIT',
    ]);
    expect(deleteChargesMock).toHaveBeenCalledWith(['old-charge'], injector);
    expect(degradeMock).toHaveBeenCalledWith(injector, ['receipt-charge']);
  });

  it('keeps a previous charge that still holds records, and degrades it too', async () => {
    const { injector, deelInvoices } = setup();
    deelInvoices.lockInvoicesForSync.mockResolvedValue([
      { id: 'i3', payment_id: '', document_id: 'd3', charge_id: 'old-charge' },
    ]);
    isChargeEmptyMock.mockResolvedValueOnce(false);

    await syncUnit(
      injector,
      receiptUnit({ existingChargeId: 'receipt-charge', inserts: [], updates: [match('i3')] }),
      CONTEXT,
    );

    expect(deleteChargesMock).not.toHaveBeenCalled();
    expect(degradeMock).toHaveBeenCalledWith(injector, ['receipt-charge', 'old-charge']);
  });

  it('still saves the unit when an emptied charge cannot be deleted, with a warning', async () => {
    const { injector, events, deelInvoices } = setup();
    deelInvoices.lockInvoicesForSync.mockResolvedValue([
      { id: 'i3', payment_id: '', document_id: 'd3', charge_id: 'old-charge' },
    ]);
    deleteChargesMock.mockRejectedValueOnce(new Error('Ledger is locked'));

    const outcome = await syncUnit(
      injector,
      receiptUnit({ existingChargeId: 'receipt-charge', inserts: [], updates: [match('i3')] }),
      CONTEXT,
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.warnings).toEqual([
      expect.objectContaining({ code: 'CLEANUP_FAILED', receiptId: 'r1', invoiceIds: ['i3'] }),
    ]);
    expect(outcome.warnings[0].message).toContain('Ledger is locked');
    expect(events).toContain('ROLLBACK TO SAVEPOINT');
    expect(events.at(-1)).toBe('COMMIT');
  });

  it('saves a standalone invoice under its own new charge', async () => {
    const { injector, events, charges } = setup();
    const unit: StandaloneSyncUnit = {
      kind: 'standalone',
      invoice: { ...match('i9'), breakdown_receipt_id: '' },
      existingChargeId: null,
    };

    const outcome = await syncUnit(injector, unit, CONTEXT);

    expect(outcome).toEqual({ ok: true, chargeId: 'new-charge', warnings: [] });
    expect(charges.generateCharge).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      userDescription: 'Deel invoice L-i9',
    });
    expect(events).toEqual([
      'BEGIN',
      'generate charge',
      'insert document d1',
      'insert deel_invoices i9',
      'COMMIT',
    ]);
  });
});
