import { GraphQLError } from 'graphql';
import type {
  IGetChargesByIdsResult,
  IUpdateChargeParams,
} from '../../__generated__/charges.types.mjs';
import type {
  IInsertDocumentsParams,
  IUpdateDocumentParams,
} from '../../__generated__/documents.types.mjs';
import { DocumentType, Resolvers } from '../../__generated__/types.mjs';
import { getChargeByIdLoader, updateCharge } from '../../providers/charges.mjs';
import { pool } from '../../providers/db.mjs';
import {
  deleteDocument,
  getAllDocuments,
  getDocumentsByChargeIdLoader,
  insertDocuments,
  updateDocument,
} from '../../providers/documents.mjs';
import { commonDocumentsFields, commonFinancialDocumentsFields } from './common.mjs';
import { uploadDocument } from './document-handling.mjs';
import { fetchEmailDocument } from './email-handling.mjs';

export const documentsResolvers: Resolvers = {
  Query: {
    documents: async () => {
      const dbDocs = await getAllDocuments.run(void 0, pool);
      return dbDocs;
    },
  },
  Mutation: {
    uploadDocument,
    fetchEmailDocument,
    updateDocument: async (_, { fields, documentId }) => {
      try {
        let charge: IGetChargesByIdsResult | undefined;

        if (fields.chargeId) {
          charge = await getChargeByIdLoader.load(fields.chargeId);
          if (!charge) {
            throw new Error(`Charge ID="${fields.chargeId}" not valid`);
          }
        }

        const adjustedFields: IUpdateDocumentParams = {
          documentId,
          chargeId: fields.chargeId ?? null,
          currencyCode: fields.amount?.currency ?? null,
          date: fields.date ? new Date(fields.date) : null,
          fileUrl: fields.file ? fields.file.toString() : null,
          imageUrl: fields.image ? fields.image.toString() : null,
          serialNumber: fields.serialNumber ?? null,
          totalAmount: fields.amount?.raw ?? null,
          type: fields.documentType ?? null,
          vatAmount: fields.vat?.raw ?? null,
          isReviewed: true,
        };
        const res = await updateDocument.run({ ...adjustedFields }, pool);
        if (!res || res.length === 0) {
          throw new Error(`Document ID="${documentId}" not found`);
        }

        const updatedDoc = res[0];

        if (charge?.id && !charge.vat && updatedDoc.vat_amount) {
          const adjustedFields: IUpdateChargeParams = {
            accountNumber: null,
            accountType: null,
            bankDescription: null,
            bankReference: null,
            businessTrip: null,
            contraCurrencyCode: null,
            currencyCode: null,
            currencyRate: null,
            currentBalance: null,
            debitDate: null,
            detailedBankDescription: null,
            eventAmount: null,
            eventDate: null,
            eventNumber: null,
            financialAccountsToBalance: null,
            financialEntity: null,
            hashavshevetId: null,
            interest: null,
            isConversion: null,
            isProperty: null,
            links: null,
            originalId: null,
            personalCategory: null,
            proformaInvoiceFile: null,
            receiptDate: null,
            receiptImage: null,
            receiptNumber: null,
            receiptUrl: null,
            reviewed: null,
            taxCategory: null,
            taxInvoiceAmount: null,
            taxInvoiceCurrency: null,
            taxInvoiceDate: null,
            taxInvoiceFile: null,
            taxInvoiceNumber: null,
            userDescription: null,
            vat: updatedDoc.vat_amount,
            withholdingTax: null,
            chargeId: charge.id,
          };
          const res = await updateCharge.run(adjustedFields, pool);
          if (!res || res.length === 0) {
            throw new Error(
              `Could not update vat from Document ID="${documentId}" to Charge ID="${fields.chargeId}"`,
            );
          }
        }

        return {
          document: updatedDoc,
        };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
    deleteDocument: async (_, { documentId }) => {
      const res = await deleteDocument.run({ documentId }, pool);
      if (res.length === 1) {
        return true;
      }
      throw new GraphQLError(
        res.length === 0
          ? 'Document not found'
          : `More than one document found and deleted: ${res}`,
      );
    },
    insertDocument: async (_, { record }) => {
      try {
        if (record.chargeId) {
          const charge = await getChargeByIdLoader.load(record.chargeId);

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
        const res = await insertDocuments.run({ document: [{ ...newDocument }] }, pool);

        if (!res || res.length === 0) {
          throw new Error(`Failed to insert ledger record to charge ID='${record.chargeId}'`);
        }

        if (record.chargeId) {
          /* clear cache */
          getDocumentsByChargeIdLoader.clear(record.chargeId);
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
    __isTypeOf(documentRoot) {
      return documentRoot.type === 'INVOICE';
    },
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  InvoiceReceipt: {
    __isTypeOf(documentRoot) {
      return documentRoot.type === 'INVOICE_RECEIPT';
    },
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  Proforma: {
    __isTypeOf: () => false,
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  Unprocessed: {
    __isTypeOf(documentRoot) {
      return !documentRoot.type || documentRoot.type === 'UNPROCESSED';
    },
    ...commonDocumentsFields,
  },
  Receipt: {
    __isTypeOf(documentRoot) {
      return documentRoot.type === 'RECEIPT';
    },
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
};
