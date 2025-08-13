import { GraphQLError } from 'graphql';
import { GoogleDriveProvider } from '@modules/app-providers/google-drive/google-drive.provider.js';
import { GreenInvoiceClientProvider } from '@modules/app-providers/green-invoice-client.js';
import { deleteCharges } from '@modules/charges/helpers/delete-charges.helper.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { EMPTY_UUID } from '@shared/constants';
import { DocumentType } from '@shared/enums';
import { Resolvers } from '@shared/gql-types';
import { getDocumentFromFile } from '../helpers/upload.helper.js';
import { DocumentsProvider } from '../providers/documents.provider.js';
import { IssuedDocumentsProvider } from '../providers/issued-documents.provider.js';
import type {
  DocumentsModule,
  IGetAllDocumentsResult,
  IInsertDocumentsParams,
  IUpdateDocumentParams,
} from '../types.js';
import {
  commonChargeFields,
  commonDocumentsFields,
  commonFinancialDocumentsFields,
} from './common.js';

export const documentsResolvers: DocumentsModule.Resolvers &
  Pick<
    Resolvers,
    | 'UpdateDocumentResult'
    | 'InsertDocumentResult'
    | 'UploadDocumentResult'
    | 'Document'
    | 'FinancialDocument'
  > = {
  Query: {
    documents: async (_, __, { injector }) => {
      const dbDocs = await injector.get(DocumentsProvider).getAllDocuments();
      return dbDocs;
    },
    documentsByFilters: async (_, { filters }, { injector }) => {
      const dbDocs = await injector.get(DocumentsProvider).getDocumentsByExtendedFilters(filters);
      return dbDocs;
    },
    documentById: async (_, { documentId }, { injector }) => {
      const doc = await injector.get(DocumentsProvider).getDocumentsByIdLoader.load(documentId);
      return doc ?? null;
    },
    recentDocumentsByClient: async (_, { clientId, limit }, { injector }) => {
      const clientDocs = await injector
        .get(IssuedDocumentsProvider)
        .getIssuedDocumentsByClientIdLoader.load(clientId);
      if (!clientDocs?.length) {
        return [];
      }
      const sortedDocs = [...clientDocs].sort(
        (a, b) => (b.date ?? b.created_at).getTime() - (a.date ?? a.created_at).getTime(),
      );
      return sortedDocs.slice(0, limit ?? 7);
    },
    recentIssuedDocumentsByType: async (_, { documentType, limit = 3 }, { injector }) => {
      const docs = await injector
        .get(IssuedDocumentsProvider)
        .getIssuedDocumentsByType({ type: documentType, limit });
      return docs;
    },
  },
  Mutation: {
    uploadDocument: async (_, { file, chargeId }, context) => {
      const { injector } = context;

      try {
        const newDocument = await getDocumentFromFile(context, file, chargeId);

        const [document] = await injector
          .get(DocumentsProvider)
          .insertDocuments({ document: [newDocument] });

        return { document };
      } catch (e) {
        const message = 'Error uploading document';
        console.error(`${message}: ${e}`);
        return {
          __typename: 'CommonError',
          message,
        };
      }
    },
    batchUploadDocuments: async (_, { documents, isSensitive, chargeId }, context) => {
      const {
        injector,
        adminContext: { defaultAdminBusinessId },
      } = context;

      if (!chargeId) {
        // generate new charge
        const [newCharge] = await injector.get(ChargesProvider).generateCharge({
          ownerId: defaultAdminBusinessId,
          userDescription: 'New uploaded documents',
        });
        if (!newCharge) {
          throw new GraphQLError(`Failed to generate new charge for new document`);
        }
        chargeId = newCharge.id;
      }

      const newDocuments: Array<IInsertDocumentsParams['document'][number]> = [];
      await Promise.all(
        documents.map(async document => {
          // get new document data
          const newDocument = await getDocumentFromFile(context, document, chargeId, isSensitive);
          newDocuments.push(newDocument);
        }),
      );

      const res = await injector.get(DocumentsProvider).insertDocuments({ document: newDocuments });
      return res.map(document => ({ document: document as IGetAllDocumentsResult }));
    },
    batchUploadDocumentsFromGoogleDrive: async (
      _,
      { sharedFolderUrl, chargeId, isSensitive },
      context,
    ) => {
      const isValidGoogleDriveUrl = (url: string): boolean => {
        try {
          const parsedUrl = new URL(url);
          return (
            parsedUrl.hostname === 'drive.google.com' && parsedUrl.pathname.includes('/folders/')
          );
        } catch {
          return false;
        }
      };

      if (!isValidGoogleDriveUrl(sharedFolderUrl)) {
        throw new GraphQLError('Invalid Google Drive folder URL');
      }

      const {
        injector,
        adminContext: { defaultAdminBusinessId },
      } = context;

      const files = await injector
        .get(GoogleDriveProvider)
        .fetchFilesFromSharedFolder(sharedFolderUrl);

      if (!chargeId) {
        // generate new charge
        const [newCharge] = await injector.get(ChargesProvider).generateCharge({
          ownerId: defaultAdminBusinessId,
          userDescription: 'New uploaded documents',
        });
        if (!newCharge) {
          throw new GraphQLError(`Failed to generate new charge for new document`);
        }
        chargeId = newCharge.id;
      }

      const newDocuments: Array<IInsertDocumentsParams['document'][number]> = [];
      await Promise.all(
        files.map(async file => {
          // get new document data
          try {
            const newDocument = await getDocumentFromFile(context, file, chargeId, isSensitive);
            newDocuments.push(newDocument);
          } catch (error) {
            // Skip this file and continue with other files
            console.error(error);
          }
        }),
      );

      const res = await injector.get(DocumentsProvider).insertDocuments({ document: newDocuments });
      return res.map(document => ({ document: document as IGetAllDocumentsResult }));
    },
    updateDocument: async (_, { fields, documentId }, { injector }) => {
      let postUpdateActions = async (): Promise<void> => void 0;

      try {
        let chargeId: string | undefined = undefined;

        if (fields.chargeId === EMPTY_UUID) {
          // case unlinked from charge
          const document = await injector
            .get(DocumentsProvider)
            .getDocumentsByIdLoader.load(documentId);
          if (!document) {
            throw new GraphQLError(`Document ID="${documentId}" not valid`);
          }
          if (document.charge_id) {
            const charge = await injector
              .get(ChargesProvider)
              .getChargeByIdLoader.load(document.charge_id);
            if (!charge) {
              throw new GraphQLError(
                `Former document's charge ID ("${fields.chargeId}") not valid`,
              );
            }

            // generate new charge
            const newCharge = await injector.get(ChargesProvider).generateCharge({
              ownerId: charge.owner_id,
              userDescription: 'Document unlinked from charge',
            });
            if (!newCharge || newCharge.length === 0) {
              throw new GraphQLError(
                `Failed to generate new charge for document ID="${documentId}"`,
              );
            }
            chargeId = newCharge?.[0]?.id;

            if (
              Number(charge.documents_count ?? 1) === 1 &&
              Number(charge.transactions_count ?? 0) === 0
            ) {
              postUpdateActions = async () => {
                try {
                  await deleteCharges([charge.id], injector);
                } catch (e) {
                  if (e instanceof GraphQLError) {
                    throw e;
                  }
                  console.error(e);
                  throw new GraphQLError(
                    `Failed to delete the empty former charge ID="${charge.id}"`,
                  );
                }
                return postUpdateActions();
              };
            }
          }
        } else if (fields.chargeId) {
          // case new charge ID
          const charge = await injector
            .get(ChargesProvider)
            .getChargeByIdLoader.load(fields.chargeId);
          if (!charge) {
            throw new GraphQLError(`Charge ID="${fields.chargeId}" not valid`);
          }
          chargeId = charge.id;
        }

        const adjustedFields: IUpdateDocumentParams = {
          documentId,
          chargeId: chargeId ?? null,
          currencyCode: fields.amount?.currency ?? null,
          creditorId: fields.creditorId ?? null,
          debtorId: fields.debtorId ?? null,
          date: fields.date ? new Date(fields.date) : null,
          fileUrl: fields.file ? fields.file.toString() : null,
          imageUrl: fields.image ? fields.image.toString() : null,
          serialNumber: fields.serialNumber ?? null,
          totalAmount: fields.amount?.raw ?? null,
          type: fields.documentType ?? null,
          vatAmount: fields.vat?.raw ?? null,
          vatReportDateOverride: fields.vatReportDateOverride
            ? new Date(fields.vatReportDateOverride)
            : null,
          noVatAmount: fields.noVatAmount ?? null,
          isReviewed: true,
          allocationNumber: fields.allocationNumber ?? null,
          exchangeRateOverride: fields.exchangeRateOverride ?? null,
        };
        const res = await injector.get(DocumentsProvider).updateDocument({ ...adjustedFields });
        if (!res || res.length === 0) {
          throw new Error(`Document ID="${documentId}" not found`);
        }

        await postUpdateActions();

        return {
          document: res[0],
        };
      } catch (e) {
        if (e instanceof GraphQLError) {
          throw e;
        }
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
    deleteDocument: async (_, { documentId }, { injector }) => {
      try {
        const document = await injector
          .get(DocumentsProvider)
          .getDocumentsByIdLoader.load(documentId);
        if (!document) {
          throw new GraphQLError(`Document ID="${documentId}" not found`);
        }
        const res = await injector.get(DocumentsProvider).deleteDocument({ documentId });
        if (res.length === 1) {
          if (document.charge_id) {
            const charge = await injector
              .get(ChargesProvider)
              .getChargeByIdLoader.load(document.charge_id);
            if (charge && !charge.documents_count && !charge.transactions_count) {
              await deleteCharges([charge.id], injector);
            }
          }
          return true;
        }
        throw new GraphQLError(
          res.length === 0
            ? 'Document not found'
            : `More than one document found and deleted: ${res}`,
        );
      } catch (e) {
        if (e instanceof GraphQLError) {
          throw e;
        }
        throw new GraphQLError(`Failed to delete document ID="${documentId}": ${e}`);
      }
    },
    insertDocument: async (_, { record }, { injector }) => {
      try {
        if (record.chargeId) {
          const charge = await injector
            .get(ChargesProvider)
            .getChargeByIdLoader.load(record.chargeId);

          if (!charge) {
            throw new Error(`Charge ID='${record.chargeId}' not found`);
          }
        }

        const newDocument: IInsertDocumentsParams['document']['0'] = {
          image: record.image ? record.image.toString() : null,
          file: record.file ? record.file.toString() : null,
          documentType: record.documentType ?? DocumentType.Unprocessed,
          serialNumber: record.serialNumber ?? null,
          date: record.date ? new Date(record.date) : null,
          amount: record.amount?.raw ?? null,
          currencyCode: record.amount?.currency ?? null,
          vat: record.vat?.raw ?? null,
          chargeId: record.chargeId ?? null,
          vatReportDateOverride: record.vatReportDateOverride
            ? new Date(record.vatReportDateOverride)
            : null,
          noVatAmount: record.noVatAmount ?? null,
          creditorId: record.creditorId ?? null,
          debtorId: record.debtorId ?? null,
          allocationNumber: record.allocationNumber ?? null,
          exchangeRateOverride: record.exchangeRateOverride ?? null,
        };
        const res = await injector
          .get(DocumentsProvider)
          .insertDocuments({ document: [newDocument] });

        if (!res || res.length === 0) {
          throw new Error(`Failed to insert ledger record to charge ID='${record.chargeId}'`);
        }

        if (record.chargeId) {
          /* clear cache */
          injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.clear(record.chargeId);
        }

        return { document: res[0] };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Error inserting new ledger record:\n  ${
            (e as Error)?.message ?? 'Unknown error'
          }`,
        };
      }
    },
    closeDocument: async (_, { id }, { injector }) => {
      try {
        const issuedDocument = await injector
          .get(IssuedDocumentsProvider)
          .getIssuedDocumentsByIdLoader.load(id);
        if (!issuedDocument) {
          throw new GraphQLError(`Issued document ID="${id}" not found. Are you sure it exists?`);
        }
        if (!issuedDocument.external_id) {
          throw new GraphQLError(`Issued document ID="${id}" has no external ID. Cannot close it.`);
        }
        const res = await injector
          .get(GreenInvoiceClientProvider)
          .closeDocument({ id: issuedDocument.external_id });

        if (res) {
          // update document's status
          await injector
            .get(IssuedDocumentsProvider)
            .updateIssuedDocument({
              documentId: id,
              status: 'CLOSED',
            })
            .catch(e => {
              throw new Error(`Failed to update document's status (ID ${id}): ${e.message}`);
            });

          return true;
        }
        throw new GraphQLError(`Failed to close document ID="${id}"`);
      } catch (e) {
        console.error(`Failed to close document ID="${id}":`, e);
        throw new GraphQLError(`Failed to close document ID="${id}"`);
      }
    },
  },
  Document: {
    __resolveType: (documentRoot, _context, _info) => {
      switch (documentRoot?.type) {
        case DocumentType.Invoice: {
          return 'Invoice';
        }
        case DocumentType.Receipt: {
          return 'Receipt';
        }
        case DocumentType.InvoiceReceipt: {
          return 'InvoiceReceipt';
        }
        case DocumentType.CreditInvoice: {
          return 'CreditInvoice';
        }

        case DocumentType.Proforma: {
          return 'Proforma';
        }
        default: {
          return 'Unprocessed';
        }
      }
    },
  },
  FinancialDocument: {
    __resolveType: (documentRoot, _context, _info) => {
      switch (documentRoot?.type) {
        case DocumentType.Invoice: {
          return 'Invoice';
        }
        case DocumentType.Receipt: {
          return 'Receipt';
        }
        case DocumentType.InvoiceReceipt: {
          return 'InvoiceReceipt';
        }
        case DocumentType.CreditInvoice: {
          return 'CreditInvoice';
        }

        case DocumentType.Proforma: {
          return 'Proforma';
        }
        default: {
          throw new GraphQLError(`FinancialDocument type "${documentRoot?.type}" is not supported`);
        }
      }
    },
  },
  UpdateDocumentResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'UpdateDocumentSuccessfulResult';
    },
  },
  InsertDocumentResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'InsertDocumentSuccessfulResult';
    },
  },
  UploadDocumentResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'UploadDocumentSuccessfulResult';
    },
  },
  Invoice: {
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  InvoiceReceipt: {
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  CreditInvoice: {
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  Proforma: {
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  Unprocessed: {
    ...commonDocumentsFields,
  },
  OtherDocument: {
    ...commonDocumentsFields,
  },
  Receipt: {
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  CommonCharge: commonChargeFields,
  FinancialCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
  DividendCharge: commonChargeFields,
  BusinessTripCharge: commonChargeFields,
  MonthlyVatCharge: commonChargeFields,
  BankDepositCharge: commonChargeFields,
  ForeignSecuritiesCharge: commonChargeFields,
  CreditcardBankCharge: commonChargeFields,
};
