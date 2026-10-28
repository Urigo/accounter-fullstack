import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentIssueInput } from '../../../__generated__/types.js';
import { DocumentType } from '../../../shared/enums.js';
import { GreenInvoiceClientProvider } from '../../app-providers/green-invoice-client.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import {
  convertDocumentInputIntoGreenInvoiceInput,
  insertNewDocumentFromGreenInvoice,
} from '../../green-invoice/helpers/green-invoice.helper.js';
import { IssuedDocumentsProvider } from '../providers/issued-documents.provider.js';
import {
  executeDocumentIssue,
  getDraftTypeOutOfIssuedDocument,
  validateDocumentLinkType,
} from './issue-document.helper.js';

// The Green Invoice client pulls in generated mesh artifacts that only exist after
// `yarn build:tools`; these tests stub every call they make on it anyway.
vi.mock('../../app-providers/green-invoice-client.js', () => ({
  GreenInvoiceClientProvider: class GreenInvoiceClientProvider {},
}));

vi.mock('../../green-invoice/helpers/green-invoice.helper.js', async importOriginal => ({
  ...(await importOriginal<object>()),
  convertDocumentInputIntoGreenInvoiceInput: vi.fn(),
  insertNewDocumentFromGreenInvoice: vi.fn(),
}));

const DOCUMENT_ID = 'dd000000-0000-4000-8000-000000000001';

describe('getDraftTypeOutOfIssuedDocument', () => {
  it.each(['OPEN', 'CLOSED'] as const)(
    'drafts a cancelling credit invoice out of a %s invoice-receipt by default',
    status => {
      expect(
        getDraftTypeOutOfIssuedDocument({
          documentId: DOCUMENT_ID,
          documentType: DocumentType.InvoiceReceipt,
          status,
        }),
      ).toEqual({ type: DocumentType.CreditInvoice, isCancellation: true });
    },
  );

  it('drafts a receipt out of an open invoice by default', () => {
    expect(
      getDraftTypeOutOfIssuedDocument({
        documentId: DOCUMENT_ID,
        documentType: DocumentType.Invoice,
        status: 'OPEN',
      }),
    ).toEqual({ type: DocumentType.Receipt, isCancellation: false });
  });

  it('cancels an open invoice when a credit invoice is requested', () => {
    expect(
      getDraftTypeOutOfIssuedDocument({
        documentId: DOCUMENT_ID,
        documentType: DocumentType.Invoice,
        status: 'OPEN',
        requestedType: DocumentType.CreditInvoice,
      }),
    ).toEqual({ type: DocumentType.CreditInvoice, isCancellation: true });
  });

  it('honours a requested type that does not cancel', () => {
    expect(
      getDraftTypeOutOfIssuedDocument({
        documentId: DOCUMENT_ID,
        documentType: DocumentType.InvoiceReceipt,
        status: 'OPEN',
        requestedType: DocumentType.Receipt,
      }),
    ).toEqual({ type: DocumentType.Receipt, isCancellation: false });
  });

  it('refuses a non-cancelling draft out of a closed document', () => {
    expect(() =>
      getDraftTypeOutOfIssuedDocument({
        documentId: DOCUMENT_ID,
        documentType: DocumentType.InvoiceReceipt,
        status: 'CLOSED',
        requestedType: DocumentType.Receipt,
      }),
    ).toThrow('is closed');
  });

  it('refuses to cancel a closed invoice', () => {
    expect(() =>
      getDraftTypeOutOfIssuedDocument({
        documentId: DOCUMENT_ID,
        documentType: DocumentType.Invoice,
        status: 'CLOSED',
        requestedType: DocumentType.CreditInvoice,
      }),
    ).toThrow("can't be cancelled - its status is CLOSED");
  });

  it.each(['CANCELLED_BY_OTHER_DOC', 'CANCELLED', 'MANUALLY_CLOSED'] as const)(
    'refuses to cancel a %s invoice-receipt',
    status => {
      expect(() =>
        getDraftTypeOutOfIssuedDocument({
          documentId: DOCUMENT_ID,
          documentType: DocumentType.InvoiceReceipt,
          status,
        }),
      ).toThrow(`can't be cancelled - its status is ${status}`);
    },
  );

  it.each([DocumentType.Receipt, DocumentType.Proforma, DocumentType.CreditInvoice])(
    'refuses to cancel a %s',
    documentType => {
      expect(() =>
        getDraftTypeOutOfIssuedDocument({
          documentId: DOCUMENT_ID,
          documentType,
          status: 'OPEN',
          requestedType: DocumentType.CreditInvoice,
        }),
      ).toThrow('only invoices and invoice-receipts can');
    },
  );
});

describe('validateDocumentLinkType', () => {
  it('lets a credit invoice cancel', () => {
    expect(() =>
      validateDocumentLinkType({ type: DocumentType.CreditInvoice, linkType: 'CANCEL' }),
    ).not.toThrow();
  });

  it.each([
    { type: DocumentType.Receipt, linkType: 'LINK' as const },
    { type: DocumentType.CreditInvoice, linkType: 'LINK' as const },
    { type: DocumentType.Receipt, linkType: undefined },
  ])('lets $type go out with link type $linkType', input => {
    expect(() => validateDocumentLinkType(input)).not.toThrow();
  });

  it('rejects a cancelling link on anything but a credit invoice', () => {
    expect(() =>
      validateDocumentLinkType({ type: DocumentType.Receipt, linkType: 'CANCEL' }),
    ).toThrow('Only a credit invoice can cancel');
  });
});

describe('executeDocumentIssue - linked documents', () => {
  const LINKED_EXTERNAL_ID = 'gi-original-1';
  const CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';

  let addDocuments: ReturnType<typeof vi.fn>;
  let closeDocument: ReturnType<typeof vi.fn>;
  let updateIssuedDocumentByExternalId: ReturnType<typeof vi.fn>;
  // the linked document's local record, as the external-ID loader returns it
  let linkedDocument: { external_id: string; status: string } | undefined;
  let injector: Injector;

  beforeEach(() => {
    vi.mocked(convertDocumentInputIntoGreenInvoiceInput).mockImplementation(
      async input =>
        ({
          ...(input as unknown as Record<string, unknown>),
          linkedDocumentIds: [LINKED_EXTERNAL_ID],
        }) as never,
    );
    vi.mocked(insertNewDocumentFromGreenInvoice).mockResolvedValue({
      charge_id: CHARGE_ID,
    } as never);

    addDocuments = vi.fn().mockResolvedValue({ id: 'gi-new-1' });
    closeDocument = vi.fn().mockResolvedValue(true);
    updateIssuedDocumentByExternalId = vi.fn().mockResolvedValue(undefined);
    linkedDocument = { external_id: LINKED_EXTERNAL_ID, status: 'OPEN' };

    injector = {
      get: (token: unknown) => {
        if (token === GreenInvoiceClientProvider) {
          return {
            addDocuments,
            closeDocument,
            documentLoader: { load: vi.fn().mockResolvedValue({ id: 'gi-new-1' }) },
          };
        }
        if (token === IssuedDocumentsProvider) {
          return {
            updateIssuedDocumentByExternalId,
            getIssuedDocumentsByExternalIdLoader: {
              loadMany: vi.fn(async (ids: string[]) => ids.map(() => linkedDocument)),
            },
          };
        }
        if (token === ChargesProvider) {
          return { getChargeByIdLoader: { load: vi.fn(async (id: string) => ({ id })) } };
        }
        throw new Error(`Unexpected injector token: ${String(token)}`);
      },
    } as unknown as Injector;
  });

  const issue = (input: Pick<DocumentIssueInput, 'type' | 'linkType'>) =>
    executeDocumentIssue(injector, 'owner-1', {
      ...input,
      linkedDocumentIds: [LINKED_EXTERNAL_ID],
    } as unknown as DocumentIssueInput);

  it('leaves a cancelled document to Green Invoice and records it as cancelled', async () => {
    await issue({ type: DocumentType.CreditInvoice, linkType: 'CANCEL' });

    expect(addDocuments).toHaveBeenCalledOnce();
    expect(closeDocument).not.toHaveBeenCalled();
    expect(updateIssuedDocumentByExternalId).toHaveBeenCalledWith({
      externalId: LINKED_EXTERNAL_ID,
      status: 'CANCELLED_BY_OTHER_DOC',
    });
  });

  it('closes a plainly linked open document', async () => {
    await issue({ type: DocumentType.Receipt, linkType: 'LINK' });

    expect(closeDocument).toHaveBeenCalledWith(LINKED_EXTERNAL_ID);
    expect(updateIssuedDocumentByExternalId).toHaveBeenCalledWith({
      externalId: LINKED_EXTERNAL_ID,
      status: 'CLOSED',
    });
  });

  it('closes a plainly linked document that has no local record', async () => {
    linkedDocument = undefined;

    await issue({ type: DocumentType.Receipt, linkType: 'LINK' });

    expect(closeDocument).toHaveBeenCalledWith(LINKED_EXTERNAL_ID);
    expect(updateIssuedDocumentByExternalId).toHaveBeenCalledWith({
      externalId: LINKED_EXTERNAL_ID,
      status: 'CLOSED',
    });
  });

  it('leaves a closed document as it is when a partial credit only links to it', async () => {
    linkedDocument = { external_id: LINKED_EXTERNAL_ID, status: 'CLOSED' };

    await issue({ type: DocumentType.CreditInvoice, linkType: 'LINK' });

    expect(addDocuments).toHaveBeenCalledOnce();
    expect(closeDocument).not.toHaveBeenCalled();
    expect(updateIssuedDocumentByExternalId).not.toHaveBeenCalled();
  });

  it('rejects a cancelling link on a non-credit document before issuing anything', async () => {
    await expect(issue({ type: DocumentType.Receipt, linkType: 'CANCEL' })).rejects.toThrow(
      'Only a credit invoice can cancel',
    );
    expect(addDocuments).not.toHaveBeenCalled();
  });
});
