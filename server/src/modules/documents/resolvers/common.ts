import { format } from 'date-fns';
import { DocumentType } from '@shared/enums';
import { formatFinancialAmount } from '@shared/helpers';
import type { TimelessDateString } from '@shared/types';
import { DocumentsProvider } from '../providers/documents.provider.js';
import type { DocumentsModule } from '../types.js';

export const documentType: DocumentsModule.DocumentResolvers['documentType'] = documentRoot => {
  let key = documentRoot.type[0].toUpperCase() + documentRoot.type.substring(1).toLocaleLowerCase();
  if (key === 'Invoice_receipt') {
    key = 'InvoiceReceipt';
  }
  return DocumentType[key as keyof typeof DocumentType];
};

export const commonDocumentsFields: DocumentsModule.DocumentResolvers = {
  id: documentRoot => documentRoot.id,
  image: documentRoot => {
    const url = documentRoot.image_url ?? null;
    if (!url) {
      console.log('no image url', documentRoot.image_url, documentRoot.id);
    }
    return url;
  },
  file: documentRoot => {
    const url = documentRoot.file_url ?? null;
    if (!url) {
      console.log('no file url', documentRoot.file_url, documentRoot.id);
    }
    return url;
  },
  isReviewed: documentRoot => documentRoot.is_reviewed,
  documentType,
};

export const commonFinancialDocumentsFields:
  | DocumentsModule.InvoiceResolvers
  | DocumentsModule.ReceiptResolvers
  | DocumentsModule.InvoiceReceiptResolvers
  | DocumentsModule.ProformaResolvers = {
  serialNumber: documentRoot => documentRoot.serial_number ?? '',
  date: documentRoot =>
    documentRoot.date ? (format(documentRoot.date, 'yyyy-MM-dd') as TimelessDateString) : null,
  amount: documentRoot =>
    formatFinancialAmount(documentRoot.total_amount, documentRoot.currency_code),
  vat: documentRoot =>
    documentRoot.vat_amount == null
      ? null
      : formatFinancialAmount(documentRoot.vat_amount, documentRoot.currency_code),
};

export const commonFinancialEntityFields:
  | DocumentsModule.LtdFinancialEntityResolvers
  | DocumentsModule.PersonalFinancialEntityResolvers = {
  documents: async (DbBusiness, _, { injector }) => {
    const documents = await injector
      .get(DocumentsProvider)
      .getDocumentsByFinancialEntityIds({ ownerIds: [DbBusiness.id] });
    return documents;
  },
};
