import { GraphQLError } from 'graphql';

import { formatFinancialAmount } from '../../../helpers/amount.mjs';
import { ChargesProvider } from '../../charges/providers/charges.provider.mjs';
import { IInsertDocumentsParams, IUpdateDocumentParams } from '../generated-types/documents.provider.types.mjs';
import { DocumentsModule } from '../generated-types/graphql';
import { DocumentsProvider } from '../providers/documents.provider.mjs';

const commonDocumentsFields: DocumentsModule.DocumentResolvers = {
  id: documentRoot => documentRoot.id,
  charge: async (documentRoot, _, { injector }) => {
    if (!documentRoot.charge_id) {
      return null;
    }
    const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(documentRoot.charge_id);
    return charge ?? null;
  },
  image: documentRoot => documentRoot.image_url,
  file: documentRoot => documentRoot.file_url,
  creditor: documentRoot => documentRoot.creditor,
  debtor: documentRoot => documentRoot.debtor,
  isReviewed: documentRoot => documentRoot.is_reviewed,
  documentType: documentRoot => documentRoot.type,
};

const commonFinancialDocumentsFields:
  | DocumentsModule.InvoiceResolvers
  | DocumentsModule.ReceiptResolvers
  | DocumentsModule.InvoiceReceiptResolvers
  | DocumentsModule.ProformaResolvers = {
  serialNumber: documentRoot => documentRoot.serial_number ?? '',
  date: documentRoot => documentRoot.date,
  amount: documentRoot => formatFinancialAmount(documentRoot.total_amount, documentRoot.currency_code),
  vat: documentRoot => (documentRoot.vat_amount != null ? formatFinancialAmount(documentRoot.vat_amount) : null),
  creditor: documentRoot => documentRoot.creditor,
  debtor: documentRoot => documentRoot.debtor,
};

const commonFinancialEntityFields:
  | DocumentsModule.LtdFinancialEntityResolvers
  | DocumentsModule.PersonalFinancialEntityResolvers = {
  documents: async (DbBusiness, _, { injector }) => {
    const documents = await injector
      .get(DocumentsProvider)
      .getDocumentsByFinancialEntityIds({ financialEntityIds: [DbBusiness.id] });
    return documents;
  },
};

export const resolvers: DocumentsModule.Resolvers = {
  Query: {
    documents: async (_, __, { injector }) => {
      const dbDocs = await injector.get(DocumentsProvider).getAllDocuments();
      return dbDocs;
    },
  },
  Mutation: {
    updateDocument: async (_, { fields, documentId }, { injector }) => {
      try {
        const adjustedFields: IUpdateDocumentParams = {
          documentId,
          chargeId: fields.chargeId ?? null,
          currencyCode: fields.amount?.currency ?? null,
          date: fields.date ?? null,
          fileUrl: fields.file ?? null,
          imageUrl: fields.image ?? null,
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
          __typename: 'UpdateDocumentSuccessfulResult',
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
        res.length === 0 ? 'Document not found' : `More than one document found and deleted: ${res}`
      );
    },
    insertDocument: async (_, { record }, { injector }) => {
      try {
        if (record.chargeId) {
          const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(record.chargeId);

          if (!charge) {
            throw new Error(`Charge ID='${record.chargeId}' not found`);
          }
        }

        const newDocument: IInsertDocumentsParams['document']['0'] = {
          image: record.image ?? null,
          file: record.file ?? null,
          documentType: record.documentType ?? 'UNPROCESSED',
          serialNumber: record.serialNumber ?? null,
          date: record.date ?? null,
          amount: record.amount?.raw ?? null,
          currencyCode: record.amount?.currency ?? null,
          vat: record.vat?.raw ?? null,
          chargeId: record.chargeId ?? null,
        };
        const res = await injector.get(DocumentsProvider).insertDocuments({ document: [{ ...newDocument }] });

        if (!res || res.length === 0) {
          throw new Error(`Failed to insert ledger record to charge ID='${record.chargeId}'`);
        }

        if (record.chargeId) {
          /* clear cache */
          injector.get(ChargesProvider).getDocumentsByChargeIdLoader.clear(record.chargeId);
        }

        return { __typename: 'InsertDocumentSuccessfulResult', document: res[0] };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Error inserting new ledger record:\n  ${(e as Error)?.message ?? 'Unknown error'}`,
        };
      }
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
  Charge: {
    additionalDocuments: async (DbCharge, _, { injector }) => {
      if (!DbCharge.id) {
        return [];
      }
      const docs = await injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(DbCharge.id);
      return docs;
    },
    invoice: async (DbCharge, _, { injector }) => {
      if (!DbCharge.id) {
        return null;
      }
      const docs = await injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(DbCharge.id);
      const invoices = docs.filter(d => ['INVOICE', 'INVOICE_RECEIPT'].includes(d.type ?? ''));
      if (invoices.length > 1) {
        console.log(`Charge ${DbCharge.id} has more than one invoices: [${invoices.map(r => `"${r.id}"`).join(', ')}]`);
      }
      return invoices.shift() ?? null;
    },
    receipt: async (DbCharge, _, { injector }) => {
      if (!DbCharge.id) {
        return null;
      }
      const docs = await injector.get(DocumentsProvider).getDocumentsByChargeIdLoader.load(DbCharge.id);
      const receipts = docs.filter(d => ['RECEIPT', 'INVOICE_RECEIPT'].includes(d.type ?? ''));
      if (receipts.length > 1) {
        console.log(`Charge ${DbCharge.id} has more than one receipt: [${receipts.map(r => `"${r.id}"`).join(', ')}]`);
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
