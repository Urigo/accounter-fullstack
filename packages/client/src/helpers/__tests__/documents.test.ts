import { describe, expect, it } from 'vitest';
import { DocumentType } from '../../gql/graphql.js';
import { getDocumentViewerLabels } from '../documents.js';

/** Names are wrapped in FSI…PDI so a Hebrew name can't reorder the arrow. */
const iso = (name: string): string => `⁨${name}⁩`;

describe('getDocumentViewerLabels', () => {
  it('builds the full title and subtitle', () => {
    expect(
      getDocumentViewerLabels({
        documentType: DocumentType.Invoice,
        serialNumber: '1042',
        creditor: { name: 'Acme Ltd' },
        debtor: { name: 'Your Company Ltd' },
      }),
    ).toEqual({
      title: 'Tax Invoice 1042',
      subtitle: `${iso('Acme Ltd')} → ${iso('Your Company Ltd')}`,
    });
  });

  it('omits a missing serial', () => {
    expect(
      getDocumentViewerLabels({ documentType: DocumentType.Receipt, serialNumber: null }).title,
    ).toBe('Receipt');
    expect(
      getDocumentViewerLabels({ documentType: DocumentType.Receipt, serialNumber: '  ' }).title,
    ).toBe('Receipt');
  });

  it('has no subtitle without parties', () => {
    expect(getDocumentViewerLabels({ documentType: DocumentType.CreditInvoice })).toEqual({
      title: 'Credit Note',
    });
  });

  it('shows the one party that exists', () => {
    expect(
      getDocumentViewerLabels({ documentType: DocumentType.Invoice, debtor: { name: 'שלום בע"מ' } })
        .subtitle,
    ).toBe(iso('שלום בע"מ'));
  });

  it('falls back to "Document" for a null type', () => {
    expect(getDocumentViewerLabels({ documentType: null, serialNumber: '7' }).title).toBe(
      'Document 7',
    );
  });

  it('falls back to "Document" for an unknown type instead of throwing', () => {
    expect(
      getDocumentViewerLabels({ documentType: 'MYSTERY' as DocumentType, serialNumber: '7' }).title,
    ).toBe('Document 7');
  });
});
