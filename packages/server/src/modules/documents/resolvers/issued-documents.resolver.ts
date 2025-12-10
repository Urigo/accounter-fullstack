import { GraphQLError } from 'graphql';
import type { ResolverFn } from '../../../__generated__/types.js';
import { DocumentsProvider } from '../providers/documents.provider.js';
import { IssuedDocumentsProvider } from '../providers/issued-documents.provider.js';
import type { DocumentsModule, IGetAllDocumentsResult, IssuedDocumentInfoProto } from '../types.js';

const issuedDocumentInfo: ResolverFn<
  Promise<IssuedDocumentInfoProto>,
  IGetAllDocumentsResult,
  GraphQLModules.ModuleContext,
  object
> = async (document, _, { injector }) => {
  const issuedDocument = await injector
    .get(IssuedDocumentsProvider)
    .getIssuedDocumentsByIdLoader.load(document.id);
  if (!issuedDocument) {
    return null;
  }

  return {
    externalId: issuedDocument.external_id,
    status: issuedDocument.status,
    linkedDocumentIds: issuedDocument.linked_document_ids ?? undefined,
  };
};

export const issuedDocumentsResolvers: DocumentsModule.Resolvers = {
  Invoice: {
    issuedDocumentInfo,
  },
  InvoiceReceipt: {
    issuedDocumentInfo,
  },
  CreditInvoice: {
    issuedDocumentInfo,
  },
  Proforma: {
    issuedDocumentInfo,
  },
  Receipt: {
    issuedDocumentInfo,
  },
  IssuedDocumentInfo: {
    id: info => info!.externalId,
    externalId: info => info!.externalId,
    status: info => info!.status,
    linkedDocuments: async (info, _, { injector }) => {
      if (!info?.linkedDocumentIds?.length) {
        return null;
      }
      return await Promise.all(
        info.linkedDocumentIds.map(async id => {
          const document = await injector.get(DocumentsProvider).getDocumentsByIdLoader.load(id);
          if (!document) {
            throw new GraphQLError(
              `Linked document with ID ${id} not found for issued document with external ID ${info.externalId}`,
            );
          }
          return document;
        }),
      );
    },
  },
};
