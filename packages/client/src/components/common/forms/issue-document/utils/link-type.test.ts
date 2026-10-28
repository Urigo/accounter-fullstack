import { describe, expect, it } from 'vitest';
import { DocumentLinkType, DocumentType } from '../../../../../gql/graphql.js';
import { getLinkTypeForDocumentType } from './link-type.js';

describe('getLinkTypeForDocumentType', () => {
  const linked = ['gi-document-1'];

  it('cancels the linked documents from a credit invoice', () => {
    expect(getLinkTypeForDocumentType(DocumentType.CreditInvoice, linked)).toBe(
      DocumentLinkType.Cancel,
    );
  });

  it.each([DocumentType.Receipt, DocumentType.InvoiceReceipt, DocumentType.Invoice])(
    'only links the linked documents from a %s',
    type => {
      expect(getLinkTypeForDocumentType(type, linked)).toBe(DocumentLinkType.Link);
    },
  );

  it.each([undefined, null, []])('has no link type without linked documents (%j)', ids => {
    expect(getLinkTypeForDocumentType(DocumentType.CreditInvoice, ids)).toBeUndefined();
  });
});
