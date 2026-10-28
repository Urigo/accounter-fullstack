import { DocumentLinkType, DocumentType } from '../../../../../gql/graphql.js';

/**
 * The link type follows the document type: only a credit invoice cancels the documents it links
 * to, anything else just links to them. With no linked documents there is nothing to link.
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
