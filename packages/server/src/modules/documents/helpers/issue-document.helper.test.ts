import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentIssueInput } from '../../../__generated__/types.js';
import { DocumentType } from '../../../shared/enums.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { GreenInvoiceClientProvider } from '../../app-providers/green-invoice-client.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import {
  convertDocumentInputIntoGreenInvoiceInput,
  insertNewDocumentFromGreenInvoice,
} from '../../green-invoice/helpers/green-invoice.helper.js';
import type { IGetTransactionsByChargeIdsResult } from '../../transactions/types.js';
import { IssuedDocumentsProvider } from '../providers/issued-documents.provider.js';
import {
  executeDocumentIssue,
  filterAndHandleSwiftTransactions,
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

describe('filterAndHandleSwiftTransactions', () => {
  const SWIFT_BUSINESS_ID = 'bb000000-0000-4000-8000-00000000000f';
  let transactionCounter = 0;

  // `date` is the debit date; the event date is set apart from it, so matching on it would fail
  function transaction(
    amount: string,
    date: string,
    businessId: string | null = 'bb000000-0000-4000-8000-000000000001',
    overrides: Partial<IGetTransactionsByChargeIdsResult> = {},
  ): IGetTransactionsByChargeIdsResult {
    transactionCounter++;
    return {
      id: `tx-${transactionCounter}`,
      amount,
      business_id: businessId,
      event_date: '2025-06-01' as TimelessDateString,
      debit_date: date as TimelessDateString,
      debit_date_override: null,
      ...overrides,
    } as IGetTransactionsByChargeIdsResult;
  }
  const income = (
    amount: string,
    date: string,
    overrides?: Partial<IGetTransactionsByChargeIdsResult>,
  ) => transaction(amount, date, undefined, overrides);
  const swift = (
    amount: string,
    date: string,
    overrides?: Partial<IGetTransactionsByChargeIdsResult>,
  ) => transaction(amount, date, SWIFT_BUSINESS_ID, overrides);

  const amountsById = (transactions: IGetTransactionsByChargeIdsResult[]) =>
    transactions.map(tx => [tx.id, tx.amount]);

  it('returns only positive incomes when there are no swift fees', () => {
    const incomeA = income('100', '2026-01-10');
    const expense = income('-50', '2026-01-10');
    expect(filterAndHandleSwiftTransactions([incomeA, expense], SWIFT_BUSINESS_ID)).toEqual([
      incomeA,
    ]);
  });

  it('subtracts a single swift fee from a single income', () => {
    const incomeA = income('1000', '2026-01-10');
    const result = filterAndHandleSwiftTransactions(
      [incomeA, swift('-15', '2026-01-09')],
      SWIFT_BUSINESS_ID,
    );
    expect(amountsById(result)).toEqual([[incomeA.id, '1015.00']]);
  });

  it('throws when income and swift counts differ', () => {
    expect(() =>
      filterAndHandleSwiftTransactions(
        [income('1000', '2026-01-10'), income('500', '2026-02-10'), swift('-15', '2026-01-10')],
        SWIFT_BUSINESS_ID,
      ),
    ).toThrow('Found 2 income transactions but 1 swift fee transactions');
  });

  it('subtracts the fee from every income when all swift fees are equal, regardless of dates', () => {
    const incomeA = income('1000', '2026-01-10');
    const incomeB = income('500', '2026-03-10');
    const result = filterAndHandleSwiftTransactions(
      [incomeA, swift('-15', '2026-05-01'), incomeB, swift('-15', '2026-06-01')],
      SWIFT_BUSINESS_ID,
    );
    expect(amountsById(result)).toEqual([
      [incomeA.id, '1015.00'],
      [incomeB.id, '515.00'],
    ]);
  });

  it('matches differing swift fees by same-day or day-before date', () => {
    const incomeA = income('1000', '2026-01-10');
    const incomeB = income('500', '2026-02-10');
    const result = filterAndHandleSwiftTransactions(
      [swift('-20', '2026-02-09'), incomeA, incomeB, swift('-15', '2026-01-10')],
      SWIFT_BUSINESS_ID,
    );
    expect(amountsById(result)).toEqual([
      [incomeA.id, '1015.00'],
      [incomeB.id, '520.00'],
    ]);
  });

  it('resolves a swift fee that fits two incomes by elimination', () => {
    // the 01-10 fee fits both incomes (same day for A, day before for B); the 01-11 fee fits only B
    const incomeA = income('1000', '2026-01-10');
    const incomeB = income('500', '2026-01-11');
    const result = filterAndHandleSwiftTransactions(
      [incomeA, incomeB, swift('-15', '2026-01-10'), swift('-20', '2026-01-11')],
      SWIFT_BUSINESS_ID,
    );
    expect(amountsById(result)).toEqual([
      [incomeA.id, '1015.00'],
      [incomeB.id, '520.00'],
    ]);
  });

  it.each([
    ['two days before', '2026-01-08'],
    ['a day after', '2026-01-11'],
  ])('throws when a differing swift fee is dated %s its income', (_label, swiftDate) => {
    expect(() =>
      filterAndHandleSwiftTransactions(
        [
          income('1000', '2026-01-10'),
          income('500', '2026-02-10'),
          swift('-15', swiftDate),
          swift('-20', '2026-02-10'),
        ],
        SWIFT_BUSINESS_ID,
      ),
    ).toThrow("Couldn't match swift fees to income transactions by date");
  });

  it('treats differing fees with equal amounts as interchangeable', () => {
    // A and B can take either -15 fee; both pairings give them the same amount
    const incomeA = income('1000', '2026-01-10');
    const incomeB = income('500', '2026-01-10');
    const incomeC = income('700', '2026-02-10');
    const result = filterAndHandleSwiftTransactions(
      [
        incomeA,
        incomeB,
        incomeC,
        swift('-15', '2026-01-10'),
        swift('-15', '2026-01-10'),
        swift('-20', '2026-02-10'),
      ],
      SWIFT_BUSINESS_ID,
    );
    expect(amountsById(result)).toEqual([
      [incomeA.id, '1015.00'],
      [incomeB.id, '515.00'],
      [incomeC.id, '720.00'],
    ]);
  });

  it('matches on the debit date override when set', () => {
    const incomeA = income('1000', '2026-01-10', {
      debit_date_override: '2026-01-20' as TimelessDateString,
    });
    const incomeB = income('500', '2026-02-10');
    const result = filterAndHandleSwiftTransactions(
      [incomeA, incomeB, swift('-15', '2026-01-19'), swift('-20', '2026-02-10')],
      SWIFT_BUSINESS_ID,
    );
    expect(amountsById(result)).toEqual([
      [incomeA.id, '1015.00'],
      [incomeB.id, '520.00'],
    ]);
  });

  it('falls back to the event date when there is no debit date', () => {
    const incomeA = income('1000', '2026-01-10', {
      debit_date: null,
      event_date: '2026-03-01' as TimelessDateString,
    });
    const incomeB = income('500', '2026-02-10');
    const result = filterAndHandleSwiftTransactions(
      [incomeA, incomeB, swift('-15', '2026-02-28'), swift('-20', '2026-02-10')],
      SWIFT_BUSINESS_ID,
    );
    expect(amountsById(result)).toEqual([
      [incomeA.id, '1015.00'],
      [incomeB.id, '520.00'],
    ]);
  });

  it('throws when the date matching is ambiguous', () => {
    expect(() =>
      filterAndHandleSwiftTransactions(
        [
          income('1000', '2026-01-10'),
          income('500', '2026-01-10'),
          swift('-15', '2026-01-10'),
          swift('-20', '2026-01-10'),
        ],
        SWIFT_BUSINESS_ID,
      ),
    ).toThrow("Couldn't match swift fees to income transactions by date");
  });
});
