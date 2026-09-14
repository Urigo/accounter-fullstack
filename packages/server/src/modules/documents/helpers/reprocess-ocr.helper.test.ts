import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Currency, DocumentType } from '../../../shared/enums.js';
import type { IGetAllDocumentsResult, IInsertDocumentsParams } from '../types.js';

const fetchRemoteDocument = vi.fn();
const getOcrData = vi.fn();
const getDocumentFromUrlsAndOcrData = vi.fn();
const releaseDbConnectionForExternalWork = vi.fn().mockResolvedValue(undefined);
const resolveOwnerSideFromUuids = vi.fn();
const degradeChargesAccountantApproval = vi.fn().mockResolvedValue(new Map());

vi.mock('./fetch-remote-document.helper.js', () => ({
  fetchRemoteDocument: (...args: unknown[]) => fetchRemoteDocument(...args),
}));
vi.mock('./upload.helper.js', () => ({
  getOcrData: (...args: unknown[]) => getOcrData(...args),
  getDocumentFromUrlsAndOcrData: (...args: unknown[]) => getDocumentFromUrlsAndOcrData(...args),
  releaseDbConnectionForExternalWork: (...args: unknown[]) =>
    releaseDbConnectionForExternalWork(...args),
  resolveOwnerSideFromUuids: (...args: unknown[]) => resolveOwnerSideFromUuids(...args),
}));
vi.mock('../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: (...args: unknown[]) =>
    degradeChargesAccountantApproval(...args),
}));

const { ReprocessOcrError, reprocessDocumentOcr, reprocessDocumentsOcr } =
  await import('./reprocess-ocr.helper.js');

const OWNER_ID = '00000000-0000-0000-0000-000000000001';
const COUNTERPARTY_ID = '00000000-0000-0000-0000-000000000002';
const DOCUMENT_ID = '00000000-0000-0000-0000-0000000000aa';
const CHARGE_ID = '00000000-0000-0000-0000-0000000000bb';

/** A row in the shape the bug produced: OCR never ran, but the Cloudinary upload did. */
function unprocessedRow(overrides: Partial<IGetAllDocumentsResult> = {}): IGetAllDocumentsResult {
  return {
    id: DOCUMENT_ID,
    owner_id: OWNER_ID,
    charge_id: CHARGE_ID,
    file_url: 'https://res.cloudinary.com/demo/raw/upload/doc.pdf',
    image_url: 'https://res.cloudinary.com/demo/raw/upload/doc.jpg',
    type: DocumentType.Unprocessed,
    is_reviewed: false,
    created_at: new Date(),
    updated_at: new Date(),
    serial_number: null,
    date: null,
    total_amount: null,
    currency_code: null,
    vat_amount: null,
    creditor_id: null,
    debtor_id: null,
    no_vat_amount: null,
    vat_report_date_override: null,
    allocation_number: null,
    exchange_rate_override: null,
    file_hash: '12345',
    description: null,
    remarks: 'email-ingestion: <msg-1@example.com>',
    ...overrides,
  } as IGetAllDocumentsResult;
}

/** What `getDocumentFromUrlsAndOcrData` hands back once the model has read the file. */
function ocrParams(
  overrides: Partial<IInsertDocumentsParams['documents'][number]> = {},
): IInsertDocumentsParams['documents'][number] {
  return {
    ownerId: OWNER_ID,
    image: null,
    file: null,
    documentType: DocumentType.Invoice,
    serialNumber: 'INV-42',
    date: new Date('2026-03-01'),
    amount: 1170,
    currencyCode: Currency.Ils,
    vat: 170,
    chargeId: null,
    vatReportDateOverride: null,
    noVatAmount: null,
    allocationNumber: null,
    exchangeRateOverride: null,
    fileHash: '12345',
    description: 'Consulting',
    remarks: 'Acme Ltd',
    creditorId: COUNTERPARTY_ID,
    debtorId: OWNER_ID,
    ...overrides,
  } as IInsertDocumentsParams['documents'][number];
}

function makeInjector(document: IGetAllDocumentsResult | undefined, updated = document) {
  const updateDocument = vi.fn().mockResolvedValue(updated ? [updated] : []);
  const provider = {
    getDocumentsByIdLoader: { load: vi.fn().mockResolvedValue(document) },
    updateDocument,
  };
  return {
    injector: { get: () => provider } as unknown as Injector,
    updateDocument,
  };
}

function pdf(): File {
  return new File([new Uint8Array([1, 2, 3])], 'doc.pdf', { type: 'application/pdf' });
}

beforeEach(() => {
  vi.clearAllMocks();
  releaseDbConnectionForExternalWork.mockResolvedValue(undefined);
  degradeChargesAccountantApproval.mockResolvedValue(new Map());
  fetchRemoteDocument.mockResolvedValue(pdf());
  getOcrData.mockResolvedValue({ documentType: DocumentType.Invoice });
  getDocumentFromUrlsAndOcrData.mockResolvedValue(ocrParams());
});

describe('reprocessDocumentOcr', () => {
  it('fills every blank column and lifts the document out of UNPROCESSED', async () => {
    const { injector, updateDocument } = makeInjector(unprocessedRow());

    const result = await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(updateDocument).toHaveBeenCalledTimes(1);
    expect(updateDocument.mock.calls[0]![0]).toMatchObject({
      documentId: DOCUMENT_ID,
      type: DocumentType.Invoice,
      serialNumber: 'INV-42',
      totalAmount: 1170,
      currencyCode: Currency.Ils,
      vatAmount: 170,
      description: 'Consulting',
      creditorId: COUNTERPARTY_ID,
      debtorId: OWNER_ID,
    });
    expect(result.updatedFields).toContain('type');
    expect(result.updatedFields).toContain('total_amount');
  });

  it('never overwrites a value the document already has', async () => {
    // The whole point of the fill-only rule: an accountant who corrected the amount by hand must
    // not have it replaced by a later model run.
    const { injector, updateDocument } = makeInjector(
      unprocessedRow({ total_amount: 999, serial_number: 'HAND-1' }),
    );

    const result = await reprocessDocumentOcr(injector, DOCUMENT_ID);

    const params = updateDocument.mock.calls[0]![0];
    expect(params.totalAmount).toBeNull();
    expect(params.serialNumber).toBeNull();
    expect(result.updatedFields).not.toContain('total_amount');
    expect(result.updatedFields).not.toContain('serial_number');
  });

  it('leaves the review flag, the charge link and the stored files alone', async () => {
    const { injector, updateDocument } = makeInjector(unprocessedRow());

    await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(updateDocument.mock.calls[0]![0]).toMatchObject({
      isReviewed: null,
      chargeId: null,
      fileUrl: null,
      imageUrl: null,
      vatReportDateOverride: null,
      exchangeRateOverride: null,
    });
  });

  it('keeps the existing remarks, which carry the email-ingestion marker', async () => {
    const { injector, updateDocument } = makeInjector(unprocessedRow());

    await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(updateDocument.mock.calls[0]![0].remarks).toBeNull();
  });

  it('replaces the type only while the document is still UNPROCESSED', async () => {
    const { injector, updateDocument } = makeInjector(
      unprocessedRow({ type: DocumentType.Receipt }),
    );
    getDocumentFromUrlsAndOcrData.mockResolvedValue(
      ocrParams({ documentType: DocumentType.Invoice }),
    );

    await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(updateDocument.mock.calls[0]![0].type).toBeNull();
  });

  it('writes nothing when the pass produces nothing the document was missing', async () => {
    // A second click, or a scan the model still cannot read. Writing here would bump `updated_at`
    // and drag an approved charge back to PENDING for no gain.
    const document = unprocessedRow();
    const { injector, updateDocument } = makeInjector(document);
    getDocumentFromUrlsAndOcrData.mockResolvedValue(
      ocrParams({
        documentType: DocumentType.Unprocessed,
        serialNumber: null,
        date: null,
        amount: null,
        currencyCode: null,
        vat: null,
        description: null,
        remarks: null,
        creditorId: null,
        debtorId: null,
      }),
    );

    const result = await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(updateDocument).not.toHaveBeenCalled();
    expect(result.updatedFields).toEqual([]);
    expect(result.document).toBe(document);
  });

  it('runs OCR rather than short-circuiting on the sensitive default', async () => {
    // `getOcrData` defaults its third argument to "sensitive", which returns UNPROCESSED without
    // calling the model. Passing `false` explicitly is what makes this path do any work at all.
    const { injector } = makeInjector(unprocessedRow());

    await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(getOcrData).toHaveBeenCalledWith(injector, expect.anything(), false);
  });

  it('releases the pooled connection before the download and OCR round trip', async () => {
    const { injector } = makeInjector(unprocessedRow());

    await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(releaseDbConnectionForExternalWork).toHaveBeenCalledTimes(1);
  });

  it('rejects a document that was never found', async () => {
    const { injector } = makeInjector(undefined);

    await expect(reprocessDocumentOcr(injector, DOCUMENT_ID)).rejects.toBeInstanceOf(
      ReprocessOcrError,
    );
  });

  it('rejects a document with no stored file to read back', async () => {
    const { injector } = makeInjector(unprocessedRow({ file_url: null, image_url: null }));

    await expect(reprocessDocumentOcr(injector, DOCUMENT_ID)).rejects.toThrow(
      /no stored file to re-process/,
    );
  });

  it('falls back to the image derivative when the original is not an OCR-able type', async () => {
    // `fetchRemoteDocument` passes heic/tiff, which the model rejects — but Cloudinary always
    // derives a .jpg alongside the original.
    const document = unprocessedRow({ file_url: 'https://res.cloudinary.com/demo/doc.heic' });
    const { injector } = makeInjector(document);
    fetchRemoteDocument
      .mockResolvedValueOnce(new File([new Uint8Array([1])], 'doc.heic', { type: 'image/heic' }))
      .mockResolvedValueOnce(new File([new Uint8Array([1])], 'doc.jpg', { type: 'image/jpeg' }));

    await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(fetchRemoteDocument).toHaveBeenNthCalledWith(1, document.file_url);
    expect(fetchRemoteDocument).toHaveBeenNthCalledWith(2, document.image_url);
    expect(getOcrData).toHaveBeenCalledTimes(1);
  });

  it('rejects a document with no OCR-compatible representation at all', async () => {
    const { injector } = makeInjector(
      unprocessedRow({ file_url: 'https://res.cloudinary.com/demo/doc.heic' }),
    );
    fetchRemoteDocument.mockResolvedValue(
      new File([new Uint8Array([1])], 'doc.heic', { type: 'image/heic' }),
    );

    await expect(reprocessDocumentOcr(injector, DOCUMENT_ID)).rejects.toThrow(
      /no OCR-compatible representation/,
    );
  });
});

describe('reprocessDocumentsOcr', () => {
  it('reports one result per input id, in order, and keeps a failure from sinking the rest', async () => {
    const good = unprocessedRow();
    const broken = unprocessedRow({ id: 'doc-2', file_url: null, image_url: null });
    const byId = new Map([
      [DOCUMENT_ID, good],
      ['doc-2', broken],
    ]);
    const provider = {
      getDocumentsByIdLoader: { load: vi.fn(async (id: string) => byId.get(id)) },
      updateDocument: vi.fn().mockResolvedValue([good]),
    };
    const injector = { get: () => provider } as unknown as Injector;

    const results = await reprocessDocumentsOcr(injector, [DOCUMENT_ID, 'doc-2']);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ document: good });
    expect(results[1]).toMatchObject({ __typename: 'CommonError' });
    expect((results[1] as { message: string }).message).toContain('doc-2');
  });

  it('re-flags only the charges whose documents actually gained information', async () => {
    const document = unprocessedRow();
    const { injector } = makeInjector(document);

    await reprocessDocumentsOcr(injector, [DOCUMENT_ID]);

    expect(degradeChargesAccountantApproval).toHaveBeenCalledWith(injector, [CHARGE_ID]);
  });

  it('does not re-flag a charge when the pass changed nothing', async () => {
    const { injector } = makeInjector(unprocessedRow());
    getDocumentFromUrlsAndOcrData.mockResolvedValue(
      ocrParams({
        documentType: DocumentType.Unprocessed,
        serialNumber: null,
        date: null,
        amount: null,
        currencyCode: null,
        vat: null,
        description: null,
        remarks: null,
        creditorId: null,
        debtorId: null,
      }),
    );

    await reprocessDocumentsOcr(injector, [DOCUMENT_ID]);

    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });
});
