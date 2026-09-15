import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Currency, DocumentType } from '../../../shared/enums.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import type { IGetAllDocumentsResult, IInsertDocumentsParams } from '../types.js';

const fetchRemoteDocument = vi.fn();
const getOcrData = vi.fn();
const getDocumentFromUrlsAndOcrData = vi.fn();
const releaseDbConnectionForExternalWork = vi.fn().mockResolvedValue(undefined);
const resolveOwnerSideFromUuids = vi.fn();
const degradeChargesAccountantApproval = vi.fn().mockResolvedValue(new Map());

class RemoteDocumentError extends Error {}

vi.mock('./fetch-remote-document.helper.js', () => ({
  fetchRemoteDocument: (...args: unknown[]) => fetchRemoteDocument(...args),
  RemoteDocumentError,
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
const OTHER_OWNER_ID = '00000000-0000-0000-0000-00000000000f';
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

/** The row as the database hands it back once the fill statement has run. */
function filledRow(overrides: Partial<IGetAllDocumentsResult> = {}): IGetAllDocumentsResult {
  return unprocessedRow({
    type: DocumentType.Invoice,
    serial_number: 'INV-42',
    date: new Date('2026-03-01'),
    total_amount: 1170,
    currency_code: Currency.Ils,
    vat_amount: 170,
    description: 'Consulting',
    creditor_id: COUNTERPARTY_ID,
    debtor_id: OWNER_ID,
    ...overrides,
  });
}

function makeInjector(
  document: IGetAllDocumentsResult | undefined,
  filled: IGetAllDocumentsResult | undefined = document,
  { ownerId = OWNER_ID }: { ownerId?: string } = {},
) {
  const fillDocumentFromOcr = vi.fn().mockResolvedValue(filled ? [filled] : []);
  const documentsProvider = {
    getDocumentsByIdLoader: { load: vi.fn().mockResolvedValue(document) },
    fillDocumentFromOcr,
  };
  const adminContextProvider = {
    getVerifiedAdminContext: vi.fn().mockResolvedValue({ ownerId, locality: 'IL' }),
  };
  const injector = {
    get: (token: unknown) =>
      token === AdminContextProvider ? adminContextProvider : documentsProvider,
  } as unknown as Injector;
  return { injector, fillDocumentFromOcr };
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
  it('lifts the document out of UNPROCESSED and reports the columns that were filled', async () => {
    const { injector, fillDocumentFromOcr } = makeInjector(unprocessedRow(), filledRow());

    const result = await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(fillDocumentFromOcr).toHaveBeenCalledTimes(1);
    expect(result.updatedFields).toEqual(
      expect.arrayContaining(['serial_number', 'total_amount', 'type']),
    );
  });

  it('hands the query every value the model produced, without pre-filtering on its own read', async () => {
    // The guarantee that nothing already filled gets overwritten belongs to the UPDATE statement,
    // not to this function. Filtering here against the pre-OCR read is exactly the race that was
    // reported: minutes pass, and a field an accountant filled meanwhile would be clobbered by a
    // decision made before they touched it. So a populated column must NOT suppress the parameter.
    const { injector, fillDocumentFromOcr } = makeInjector(
      unprocessedRow({ total_amount: 999, serial_number: 'HAND-1' }),
      filledRow({ total_amount: 999, serial_number: 'HAND-1' }),
    );

    await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(fillDocumentFromOcr.mock.calls[0]![0]).toMatchObject({
      documentId: DOCUMENT_ID,
      totalAmount: 1170,
      serialNumber: 'INV-42',
    });
  });

  it('reports only what actually changed, not what was offered', async () => {
    // The hand-entered values survive the statement, so they must not be named as filled.
    const { injector } = makeInjector(
      unprocessedRow({ total_amount: 999, serial_number: 'HAND-1' }),
      filledRow({ total_amount: 999, serial_number: 'HAND-1' }),
    );

    const result = await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(result.updatedFields).not.toContain('total_amount');
    expect(result.updatedFields).not.toContain('serial_number');
    expect(result.updatedFields).toContain('type');
  });

  it('does not offer UNPROCESSED back as a type', async () => {
    const { injector, fillDocumentFromOcr } = makeInjector(unprocessedRow(), filledRow());
    getDocumentFromUrlsAndOcrData.mockResolvedValue(
      ocrParams({ documentType: DocumentType.Unprocessed }),
    );

    await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(fillDocumentFromOcr.mock.calls[0]![0].type).toBeNull();
  });

  it('treats an empty result as "nothing was blank" rather than a failure', async () => {
    // Everything the pass could have filled was filled by someone else while OCR ran. The query
    // matches no rows, so `updated_at` is untouched and no approval is degraded.
    const document = unprocessedRow();
    const { injector } = makeInjector(document, undefined);

    const result = await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(result.updatedFields).toEqual([]);
    expect(result.document).toBe(document);
  });

  it('issues no statement at all when the model returned nothing usable', async () => {
    const { injector, fillDocumentFromOcr } = makeInjector(unprocessedRow());
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

    expect(fillDocumentFromOcr).not.toHaveBeenCalled();
    expect(result.updatedFields).toEqual([]);
  });

  it('rejects a document owned by another business before spending anything on it', async () => {
    // Reads span the whole business scope while writes are pinned to one business, so this row can
    // be listed and still be unwritable. Catching it late would mean paying for a download and an
    // OCR call first.
    const { injector, fillDocumentFromOcr } = makeInjector(
      unprocessedRow({ owner_id: OTHER_OWNER_ID }),
    );

    await expect(reprocessDocumentOcr(injector, DOCUMENT_ID)).rejects.toThrow(
      /belongs to another business/,
    );
    expect(fetchRemoteDocument).not.toHaveBeenCalled();
    expect(getOcrData).not.toHaveBeenCalled();
    expect(fillDocumentFromOcr).not.toHaveBeenCalled();
  });

  it('runs OCR rather than short-circuiting on the sensitive default', async () => {
    // `getOcrData` defaults its third argument to "sensitive", which returns UNPROCESSED without
    // calling the model. Passing `false` explicitly is what makes this path do any work at all.
    const { injector } = makeInjector(unprocessedRow(), filledRow());

    await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(getOcrData).toHaveBeenCalledWith(injector, expect.anything(), false);
  });

  it('releases the pooled connection before the download and OCR round trip', async () => {
    const { injector } = makeInjector(unprocessedRow(), filledRow());

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

  it('falls back to the image derivative when the original fetches but is not OCR-able', async () => {
    // heic/heif/tiff pass the fetch allowlist and are rejected by the model.
    const document = unprocessedRow({ file_url: 'https://res.cloudinary.com/demo/doc.heic' });
    const { injector } = makeInjector(document, filledRow(document));
    fetchRemoteDocument
      .mockResolvedValueOnce(new File([new Uint8Array([1])], 'doc.heic', { type: 'image/heic' }))
      .mockResolvedValueOnce(new File([new Uint8Array([1])], 'doc.jpg', { type: 'image/jpeg' }));

    await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(fetchRemoteDocument).toHaveBeenNthCalledWith(1, document.file_url);
    expect(fetchRemoteDocument).toHaveBeenNthCalledWith(2, document.image_url);
    expect(getOcrData).toHaveBeenCalledTimes(1);
  });

  it('falls back to the image derivative when the original cannot be fetched at all', async () => {
    // A stored GIF is the motivating case: the model accepts image/gif but the fetch allowlist does
    // not, so the original is refused before its type can even be inspected.
    const document = unprocessedRow({ file_url: 'https://res.cloudinary.com/demo/doc.gif' });
    const { injector } = makeInjector(document, filledRow(document));
    fetchRemoteDocument
      .mockRejectedValueOnce(new RemoteDocumentError('Unsupported content type: image/gif'))
      .mockResolvedValueOnce(new File([new Uint8Array([1])], 'doc.jpg', { type: 'image/jpeg' }));

    await reprocessDocumentOcr(injector, DOCUMENT_ID);

    expect(fetchRemoteDocument).toHaveBeenNthCalledWith(2, document.image_url);
    expect(getOcrData).toHaveBeenCalledTimes(1);
  });

  it('gives up with one clear error when neither representation can be read', async () => {
    const { injector } = makeInjector(
      unprocessedRow({ file_url: 'https://res.cloudinary.com/demo/doc.gif' }),
    );
    fetchRemoteDocument.mockRejectedValue(new RemoteDocumentError('Unsupported content type'));

    await expect(reprocessDocumentOcr(injector, DOCUMENT_ID)).rejects.toThrow(
      /image derivative could not be read either/,
    );
  });

  it('does not disguise a non-fetch failure as an unreadable document', async () => {
    const { injector } = makeInjector(unprocessedRow());
    fetchRemoteDocument.mockRejectedValue(new TypeError('boom'));

    await expect(reprocessDocumentOcr(injector, DOCUMENT_ID)).rejects.toBeInstanceOf(TypeError);
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
    const documentsProvider = {
      getDocumentsByIdLoader: { load: vi.fn(async (id: string) => byId.get(id)) },
      fillDocumentFromOcr: vi.fn().mockResolvedValue([filledRow()]),
    };
    const injector = {
      get: (token: unknown) =>
        token === AdminContextProvider
          ? { getVerifiedAdminContext: vi.fn().mockResolvedValue({ ownerId: OWNER_ID }) }
          : documentsProvider,
    } as unknown as Injector;

    const results = await reprocessDocumentsOcr(injector, [DOCUMENT_ID, 'doc-2']);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ document: expect.objectContaining({ id: DOCUMENT_ID }) });
    expect(results[1]).toMatchObject({ __typename: 'CommonError' });
    expect((results[1] as { message: string }).message).toContain('doc-2');
  });

  it('re-flags only the charges whose documents actually gained information', async () => {
    const { injector } = makeInjector(unprocessedRow(), filledRow());

    await reprocessDocumentsOcr(injector, [DOCUMENT_ID]);

    expect(degradeChargesAccountantApproval).toHaveBeenCalledWith(injector, [CHARGE_ID]);
  });

  it('does not re-flag a charge when the pass changed nothing', async () => {
    const { injector } = makeInjector(unprocessedRow(), undefined);

    await reprocessDocumentsOcr(injector, [DOCUMENT_ID]);

    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });
});
