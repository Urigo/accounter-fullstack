import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { ChargesProvider } from 'modules/charges/providers/charges.provider.js';
import { CloudinaryProvider } from '@modules/app-providers/cloudinary.js';
import { GreenInvoiceProvider } from '@modules/app-providers/green-invoice.js';
import type { ChargesTypes } from '@modules/charges';
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
  commonDocumentsFields,
  commonFinancialDocumentsFields,
  commonFinancialEntityFields,
} from './common.js';
import { uploadDocument } from './document-handling.js';
import { fetchEmailDocument } from './email-handling.js';

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
  },
  Mutation: {
    uploadDocument,
    fetchEmailDocument,
    updateDocument: async (_, { fields, documentId }, { injector }) => {
      try {
        let charge: ChargesTypes.IGetChargesByIdsResult | undefined;

        if (fields.chargeId && fields.chargeId !== 'NULL') {
          charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(fields.chargeId);
          if (!charge) {
            throw new Error(`Charge ID="${fields.chargeId}" not valid`);
          }
        }

        const adjustedFields: IUpdateDocumentParams = {
          documentId,
          chargeId: fields.chargeId ?? null,
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
          message: `Error inserting new ledger record:\n  ${
            (e as Error)?.message ?? 'Unknown error'
          }`,
        };
      }
    },
    fetchIncomeDocuments: async (_, { ownerId }, { injector }) => {
      const data = await injector
        .get(GreenInvoiceProvider)
        .getSDK()
        .searchDocuments_query({
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
          if (!greenInvoiceDoc || greenInvoiceDoc.type === '_300') {
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
  // UpdateDocumentResult: {
  //   __resolveType: (obj, _context, _info) => {
  //     if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
  //     return 'UpdateDocumentSuccessfulResult';
  //   },
  // },
  // InsertDocumentResult: {
  //   __resolveType: (obj, _context, _info) => {
  //     if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
  //     return 'InsertDocumentSuccessfulResult';
  //   },
  // },
  // UploadDocumentResult: {
  //   __resolveType: (obj, _context, _info) => {
  //     if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
  //     return 'UploadDocumentSuccessfulResult';
  //   },
  // },
  Invoice: {
    ...commonDocumentsFields,
    ...commonFinancialDocumentsFields,
  },
  InvoiceReceipt: {
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
  Charge: {
    additionalDocuments: async (DbCharge, _, { injector }) => {
      if (!DbCharge.id) {
        return [];
      }
      try {
        const docs = await injector
          .get(DocumentsProvider)
          .getDocumentsByChargeIdLoader.load(DbCharge.id);
        return docs;
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    invoice: async (DbCharge, _, { injector }) => {
      if (!DbCharge.id) {
        return null;
      }
      const docs = await injector
        .get(DocumentsProvider)
        .getDocumentsByChargeIdLoader.load(DbCharge.id);
      const invoices = docs.filter(d => ['INVOICE', 'INVOICE_RECEIPT'].includes(d.type ?? ''));
      if (invoices.length > 1) {
        console.log(
          `Charge ${DbCharge.id} has more than one invoices: [${invoices
            .map(r => `"${r.id}"`)
            .join(', ')}]`,
        );
      }
      return invoices.shift() ?? null;
    },
    receipt: async (DbCharge, _, { injector }) => {
      if (!DbCharge.id) {
        return null;
      }
      const docs = await injector
        .get(DocumentsProvider)
        .getDocumentsByChargeIdLoader.load(DbCharge.id);
      const receipts = docs.filter(d => ['RECEIPT', 'INVOICE_RECEIPT'].includes(d.type ?? ''));
      if (receipts.length > 1) {
        console.log(
          `Charge ${DbCharge.id} has more than one receipt: [${receipts
            .map(r => `"${r.id}"`)
            .join(', ')}]`,
        );
      }
      return receipts.shift() ?? null;
    },
  },
  LtdFinancialEntity: {
    ...commonFinancialEntityFields,
  },
  PersonalFinancialEntity: {
    ...commonFinancialEntityFields,
  },
};
