import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { CloudinaryProvider } from '@modules/app-providers/cloudinary.js';
import { GreenInvoiceProvider } from '@modules/app-providers/green-invoice.js';
import type { ChargesTypes } from '@modules/charges';
import { deleteCharge } from '@modules/charges/helpers/delete-charge.helper.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { TagsProvider } from '@modules/tags/providers/tags.provider.js';
import { EMPTY_UUID } from '@shared/constants';
import { DocumentType } from '@shared/enums';
import type { Resolvers } from '@shared/gql-types';
import { formatCurrency } from '@shared/helpers';
import { normalizeDocumentType } from '../helpers/green-invoice.helper.js';
import { DocumentsProvider } from '../providers/documents.provider.js';
import type {
  DocumentsModule,
  IInsertDocumentsParams,
  IInsertDocumentsResult,
  IUpdateDocumentParams,
} from '../types.js';
import {
  commonChargeFields,
  commonDocumentsFields,
  commonFinancialDocumentsFields,
  commonFinancialEntityFields,
} from './common.js';
import { uploadDocument } from './document-handling.js';

export const documentsResolvers: DocumentsModule.Resolvers &
  Pick<
    Resolvers,
    'UpdateDocumentResult' | 'InsertDocumentResult' | 'UploadDocumentResult' | 'Document'
  > = {
  Query: {
    documents: async (_, __, { injector }) => {
      const dbDocs = await injector.get(DocumentsProvider).getAllDocuments();
      return dbDocs;
    },
    documentsByFilters: async (_, { filters }, { injector }) => {
      const dbDocs = await injector.get(DocumentsProvider).getDocumentsByFilters(filters);
      return dbDocs;
    },
    documentById: async (_, { documentId }, { injector }) => {
      const doc = await injector.get(DocumentsProvider).getDocumentsByIdLoader.load(documentId);
      return doc ?? null;
    },
  },
  Mutation: {
    uploadDocument,
    updateDocument: async (_, { fields, documentId }, { injector }) => {
      let postUpdateActions = async (): Promise<void> => void 0;

      try {
        let charge: ChargesTypes.IGetChargesByIdsResult | undefined;

        if (fields.chargeId && fields.chargeId !== EMPTY_UUID) {
          // case new charge ID
          charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(fields.chargeId);
          if (!charge) {
            throw new GraphQLError(`Charge ID="${fields.chargeId}" not valid`);
          }
        }

        let chargeId = fields.chargeId;
        if (fields.chargeId === EMPTY_UUID) {
          // case unlinked from charge
          const document = await injector
            .get(DocumentsProvider)
            .getDocumentsByIdLoader.load(documentId);
          if (!document) {
            throw new GraphQLError(`Document ID="${documentId}" not valid`);
          }
          if (document.charge_id_new) {
            const charge = await injector
              .get(ChargesProvider)
              .getChargeByIdLoader.load(document.charge_id_new);
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
                  await deleteCharge(
                    charge.id,
                    injector.get(ChargesProvider),
                    injector.get(TagsProvider),
                  );
                } catch (e) {
                  throw new GraphQLError(
                    `Failed to delete the empty former charge ID="${charge.id}"`,
                  );
                }
                return postUpdateActions();
              };
            }
          }
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
          isReviewed: true,
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
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
    deleteDocument: async (_, { documentId }, { injector }) => {
      const res = await injector.get(DocumentsProvider).deleteDocument({ documentId });
      if (res.length === 1) {
        return true;
      }
      throw new GraphQLError(
        res.length === 0
          ? 'Document not found'
          : `More than one document found and deleted: ${res}`,
      );
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
        };
        const res = await injector
          .get(DocumentsProvider)
          .insertDocuments({ document: [{ ...newDocument }] });

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
          message: `Error inserting new document:\n  ${(e as Error)?.message ?? 'Unknown error'}`,
        };
      }
    },
    splitDocument: async (
      _,
      { documentId, splitAmount, underSameCharge = false },
      { injector },
    ) => {
      try {
        const document = await injector
          .get(DocumentsProvider)
          .getDocumentsByIdLoader.load(documentId);
        if (!document) {
          throw new Error(`Document ID='${documentId}' not found`);
        }

        if (!document.total_amount || Math.abs(splitAmount) > Math.abs(document.total_amount)) {
          throw new Error('Split amount is greater than the original amount');
        }

        const newAmount = document.total_amount - splitAmount;

        // set VAT values
        let newVat: number | undefined = undefined;
        let splitVat: number | undefined = undefined;
        if (document.vat_amount) {
          const splitPercentage = splitAmount / document.total_amount;
          splitVat = Number((document.vat_amount * splitPercentage).toFixed(2));
          newVat = document.vat_amount - splitVat;
        }

        let newChargeId = document.charge_id_new;
        if (!underSameCharge && document.charge_id_new) {
          const charge = await injector
            .get(ChargesProvider)
            .getChargeByIdLoader.load(document.charge_id_new);

          if (!charge) {
            throw new Error(`Charge ID='${document.charge_id_new}' not found`);
          }

          // generate new charge
          const newCharge = await injector.get(ChargesProvider).generateCharge({
            ownerId: charge.owner_id,
            userDescription: 'Document splitted from charge',
          });

          if (!newCharge || newCharge.length === 0) {
            throw new GraphQLError(`Failed to generate new charge for document ID="${documentId}"`);
          }
          newChargeId = newCharge?.[0]?.id;
        }

        const updatedDocument: IUpdateDocumentParams = {
          documentId: document.id,
          totalAmount: newAmount,
          vatAmount: newVat,
        };

        const newDocument: IInsertDocumentsParams['document']['0'] = {
          ...document,
          image: document.image_url,
          file: document.file_url,
          documentType: document.type,
          serialNumber: document.serial_number,
          date: document.date,
          currencyCode: document.currency_code,
          amount: splitAmount,
          vat: splitVat,
          chargeId: newChargeId,
        };

        const updatedDocumentPromise = injector
          .get(DocumentsProvider)
          .updateDocument(updatedDocument)
          .catch(e => {
            console.error(e);
            throw new Error('Failed to update splitted document');
          });

        const splittedDocumentPromise = injector
          .get(DocumentsProvider)
          .insertDocuments({ document: [{ ...newDocument }] })
          .catch(e => {
            console.error(e);
            throw new Error('Failed to insert splitted document');
          });

        const [res1, res2] = await Promise.all([updatedDocumentPromise, splittedDocumentPromise]);

        if (!res1 || res1.length === 0) {
          throw new Error(`Failed to update amount for splitted document ID='${document.id}'`);
        }
        if (!res2 || res2.length === 0) {
          throw new Error(`Failed to create splitted document out of document ID='${document.id}'`);
        }

        if (res1[0].charge_id_new) {
          /* clear cache */
          injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.clear(res1[0].charge_id_new);
        }

        return { documents: [res1[0], res2[0]] };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Error splitting document:\n  ${(e as Error)?.message ?? 'Unknown error'}`,
        };
      }
    },
    fetchIncomeDocuments: async (_, { ownerId }, { injector }) => {
      const data = await injector.get(GreenInvoiceProvider).searchDocuments({
        input: { pageSize: 100, sort: 'creationDate' },
      });
      if (!data.searchDocuments?.items) {
        throw new GraphQLError('Failed to fetch documents');
      }
      if (data.searchDocuments.items.length === 0) {
        return [];
      }

      const documents = await injector.get(DocumentsProvider).getAllDocuments();
      const newDocuments = data.searchDocuments.items.filter(
        item =>
          item &&
          !documents.some(
            doc =>
              doc.vat_amount === item.vat &&
              doc.total_amount === item.amount &&
              doc.serial_number === item.number &&
              doc.date &&
              format(doc.date, 'yyyy-MM-dd') === item.documentDate,
          ),
      );
      const addedDocs: IInsertDocumentsResult[] = [];

      await Promise.all(
        newDocuments.map(async greenInvoiceDoc => {
          if (!greenInvoiceDoc || greenInvoiceDoc.type === 300) {
            // ignore if no doc or חשבונית עסקה
            return;
          }
          try {
            // generate preview image via cloudinary
            const { imageUrl } = await injector
              .get(CloudinaryProvider)
              .uploadInvoiceToCloudinary(greenInvoiceDoc.url.origin);

            // Generate parent charge
            const [charge] = await injector.get(ChargesProvider).generateCharge({
              ownerId,
              userDescription: 'Green Invoice generated charge',
            });
            if (!charge) {
              throw new Error('Failed to generate charge');
            }
            console.log('Generated charge:', charge.id);

            // insert document
            const rawDocument: IInsertDocumentsParams['document']['0'] = {
              image: imageUrl,
              file: greenInvoiceDoc.url.origin,
              documentType: normalizeDocumentType(greenInvoiceDoc.type),
              serialNumber: greenInvoiceDoc.number,
              date: greenInvoiceDoc.documentDate,
              amount: greenInvoiceDoc.amount,
              currencyCode: formatCurrency(greenInvoiceDoc.currency),
              vat: greenInvoiceDoc.vat,
              chargeId: charge.id,
            };
            const newDocument = await injector
              .get(DocumentsProvider)
              .insertDocuments({ document: [rawDocument] });
            addedDocs.push(newDocument[0]);
          } catch (e) {
            throw new GraphQLError(
              `Error adding Green Invoice document: ${e}\n\n${JSON.stringify(
                greenInvoiceDoc,
                null,
                2,
              )}`,
            );
          }
        }),
      );

      return addedDocs;
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
  Receipt: {
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  CommonCharge: commonChargeFields,
  ConversionCharge: commonChargeFields,
  SalaryCharge: commonChargeFields,
  InternalTransferCharge: commonChargeFields,
  DividendCharge: commonChargeFields,
  BusinessTripCharge: commonChargeFields,
  MonthlyVatCharge: commonChargeFields,
  BankDepositCharge: commonChargeFields,
  LtdFinancialEntity: {
    ...commonFinancialEntityFields,
  },
  PersonalFinancialEntity: {
    ...commonFinancialEntityFields,
  },
};
