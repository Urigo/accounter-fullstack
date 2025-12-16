import { GraphQLError } from 'graphql';
import type { _DOLLAR_defs_Document } from '@accounter/green-invoice-graphql';
import { GreenInvoiceClientProvider } from '../../app-providers/green-invoice-client.js';
import { IssuedDocumentsProvider } from '../../documents/providers/issued-documents.provider.js';
import type {
  IGetAllIssuedDocumentsResult,
  IInsertDocumentsResult,
  IUpdateIssuedDocumentParams,
} from '../../documents/types.js';
import { validateClientIntegrations } from '../../financial-entities/helpers/clients.helper.js';
import { ClientsProvider } from '../../financial-entities/providers/clients.provider.js';
import {
  convertGreenInvoiceDocumentToDocumentDraft,
  getGreenInvoiceDocuments,
  getLinkedDocuments,
  greenInvoiceCountryToCountryCode,
  greenInvoiceToDocumentStatus,
  insertNewDocumentFromGreenInvoice,
} from '../helpers/green-invoice.helper.js';
import type { GreenInvoiceModule } from '../types.js';

export const greenInvoiceResolvers: GreenInvoiceModule.Resolvers = {
  Query: {
    greenInvoiceClient: async (_, { clientId }, { injector }) => {
      try {
        const client = await injector.get(ClientsProvider).getClientByIdLoader.load(clientId);
        if (!client) {
          throw new GraphQLError(`Client not found for ID="${clientId}"`);
        }

        const greenInvoiceId = validateClientIntegrations(client.integrations)?.greenInvoiceId;
        if (!greenInvoiceId) {
          throw new GraphQLError(`Client ID="${clientId}" is missing Green Invoice integration`);
        }

        return greenInvoiceId;
      } catch (error) {
        const message = 'Failed to fetch Green Invoice client';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
  },
  Mutation: {
    syncGreenInvoiceDocuments: async (
      _,
      { ownerId: inputOwnerId, singlePageLimit = true },
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      const ownerId = inputOwnerId ?? defaultAdminBusinessId;
      const greenInvoiceDocuments = await getGreenInvoiceDocuments(injector, !singlePageLimit);

      const issuedDocuments = await injector.get(IssuedDocumentsProvider).getAllIssuedDocuments();

      // check for new or updated documents
      const newDocuments: _DOLLAR_defs_Document[] = [];
      const documentToUpdate: {
        localDoc: IGetAllIssuedDocumentsResult;
        externalDoc: _DOLLAR_defs_Document;
      }[] = [];
      await Promise.all(
        greenInvoiceDocuments.map(async item => {
          const existingDocs = issuedDocuments.filter(doc => doc.external_id === item.id);

          // Throw an error if more than one document found with the same external ID
          if (existingDocs.length > 1) {
            throw new GraphQLError(
              `Found multiple issued documents with the same external ID: ${item.id}`,
            );
          }

          // If no existing document found, add it to the new documents list
          if (existingDocs.length === 0) {
            newDocuments.push(item);
            return;
          }

          // For existing document => check for updates
          const existingDoc = existingDocs[0];

          documentToUpdate.push({
            localDoc: existingDoc,
            externalDoc: item,
          });
        }),
      );

      const addedDocs: IInsertDocumentsResult[] = [];

      // run insertions first, to avoid broken linked documents
      await Promise.all(
        newDocuments.map(async greenInvoiceDoc => {
          const newDocument = await insertNewDocumentFromGreenInvoice(
            injector,
            greenInvoiceDoc,
            ownerId,
          );

          if (newDocument) {
            addedDocs.push(newDocument);
          }
        }),
      );

      // Check for updates
      await Promise.all(
        documentToUpdate.map(async ({ localDoc, externalDoc }) => {
          const docToUpdate: Partial<IUpdateIssuedDocumentParams> = {};
          // check if the document status has changed
          const latestStatus = greenInvoiceToDocumentStatus(externalDoc.status);
          if (latestStatus !== localDoc.status) {
            docToUpdate.status = latestStatus;
          }

          // check if the linked documents have changed
          const linkedDocuments = await getLinkedDocuments(injector, externalDoc.id).catch(e => {
            console.error('Failed to fetch linked documents', e);
            return null;
          });
          if (
            linkedDocuments?.length &&
            (!localDoc.linked_document_ids ||
              localDoc.linked_document_ids.length !== linkedDocuments.length ||
              localDoc.linked_document_ids?.some(id => !linkedDocuments.includes(id)))
          ) {
            docToUpdate.linkedDocumentIds = linkedDocuments;
          }

          // if has attributes to update, add to the update list
          if (Object.keys(docToUpdate).length > 0) {
            await injector
              .get(IssuedDocumentsProvider)
              .updateIssuedDocument({
                documentId: localDoc.id,
                ...docToUpdate,
              })
              .catch(e => {
                console.error('Failed to update issued document linked documents', e);
                throw new GraphQLError(
                  `Failed to update issued document linked documents for Green Invoice ID: ${docToUpdate.documentId}`,
                );
              });
          }
        }),
      );

      return addedDocs;
    },
  },
  IssuedDocumentInfo: {
    originalDocument: async (info, _, { injector }) => {
      if (!info?.externalId) {
        throw new GraphQLError('External ID is required to fetch original document');
      }
      try {
        const document = await injector
          .get(GreenInvoiceClientProvider)
          .documentLoader.load(info.externalId);
        if (!document) {
          throw new GraphQLError('Original document not found');
        }
        return await convertGreenInvoiceDocumentToDocumentDraft(document, injector);
      } catch (error) {
        console.error('Error fetching original document:', error);
        throw new GraphQLError('Error fetching original document');
      }
    },
  },
  ClientIntegrations: {
    greenInvoiceInfo: business =>
      validateClientIntegrations(business.integrations).greenInvoiceId ?? null,
  },
  GreenInvoiceClient: {
    greenInvoiceId: clientId => clientId,
    businessId: async (clientId, _, { injector }) => {
      const client = await injector
        .get(ClientsProvider)
        .getClientByGreenInvoiceIdLoader.load(clientId);
      if (!client) {
        throw new GraphQLError(`Client not found for Green Invoice ID="${clientId}"`);
      }
      return client.business_id;
    },
    country: async (clientId, _, { injector }) => {
      return injector
        .get(GreenInvoiceClientProvider)
        .clientLoader.load(clientId)
        .then(client => {
          if (client?.country) {
            return greenInvoiceCountryToCountryCode(client.country);
          }
          return null;
        });
    },
    emails: async (clientId, _, { injector }) => {
      const emails = await injector
        .get(GreenInvoiceClientProvider)
        .clientLoader.load(clientId)
        .then(client => client?.emails);

      return [...((emails?.filter(Boolean) as string[]) ?? []), 'ap@the-guild.dev']; // TODO: remove hardcoded email
    },
    name: async (clientId, _, { injector }) => {
      return injector
        .get(GreenInvoiceClientProvider)
        .clientLoader.load(clientId)
        .then(client => client?.name ?? null);
    },
    phone: async (clientId, _, { injector }) => {
      return injector
        .get(GreenInvoiceClientProvider)
        .clientLoader.load(clientId)
        .then(client => client?.phone ?? null);
    },
    taxId: async (clientId, _, { injector }) => {
      return injector
        .get(GreenInvoiceClientProvider)
        .clientLoader.load(clientId)
        .then(client => client?.taxId ?? null);
    },
    address: async (clientId, _, { injector }) => {
      return injector
        .get(GreenInvoiceClientProvider)
        .clientLoader.load(clientId)
        .then(client => client?.address ?? null);
    },
    city: async (clientId, _, { injector }) => {
      return injector
        .get(GreenInvoiceClientProvider)
        .clientLoader.load(clientId)
        .then(client => client?.city ?? null);
    },
    zip: async (clientId, _, { injector }) => {
      return injector
        .get(GreenInvoiceClientProvider)
        .clientLoader.load(clientId)
        .then(client => client?.zip ?? null);
    },
    fax: async (clientId, _, { injector }) => {
      return injector
        .get(GreenInvoiceClientProvider)
        .clientLoader.load(clientId)
        .then(client => client?.fax ?? null);
    },
    mobile: async (clientId, _, { injector }) => {
      return injector
        .get(GreenInvoiceClientProvider)
        .clientLoader.load(clientId)
        .then(client => client?.mobile ?? null);
    },
  },
};
