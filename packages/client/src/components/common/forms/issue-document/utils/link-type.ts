import { DocumentLinkType, DocumentType } from '../../../../../gql/graphql.js';

/**
 * The link type that follows a change of document type: a credit invoice defaults to cancelling the
 * documents it links to (the form lets the user downgrade that to a plain link for a partial
 * credit), and anything else can only link to them. With no linked documents there is nothing to
 * link.
 */
export function getLinkTypeForDocumentType(
  type: DocumentType,
  linkedDocumentIds?: readonly string[] | null,
): DocumentLinkType | undefined {
  if (!linkedDocumentIds?.length) {
    return undefined;
  }
  return type === DocumentType.CreditInvoice ? DocumentLinkType.Cancel : DocumentLinkType.Link;
}
