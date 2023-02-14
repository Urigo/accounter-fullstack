import { format } from 'date-fns';
import { formatFinancialAmount } from '../../../helpers/amount.js';
import { DocumentType } from '../../../models/enums.js';
import { TimelessDateString } from '../../../models/index.js';
import { pool } from '../../../providers/db.js';
import { getDocumentsByFinancialEntityIds } from '../../../providers/documents.js';
import { DocumentsModule } from '../__generated__/types.js';

export const documentType: DocumentsModule.DocumentResolvers['documentType'] = documentRoot => {
  let key = documentRoot.type[0].toUpperCase() + documentRoot.type.substring(1).toLocaleLowerCase();
  if (key == 'Invoice_receipt') {
    key = 'InvoiceReceipt';
  }
  return DocumentType[key as keyof typeof DocumentType];
};

export const commonDocumentsFields: DocumentsModule.DocumentResolvers = {
  id: documentRoot => documentRoot.id,
  image: documentRoot => documentRoot.image_url ?? null,
  file: documentRoot => documentRoot.file_url ?? null,
  creditor: documentRoot => documentRoot.creditor,
  debtor: documentRoot => documentRoot.debtor,
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
    documentRoot.vat_amount == null ? null : formatFinancialAmount(documentRoot.vat_amount),
  creditor: documentRoot => documentRoot.creditor,
  debtor: documentRoot => documentRoot.debtor,
};

export const commonFinancialEntityFields:
  | DocumentsModule.LtdFinancialEntityResolvers
  | DocumentsModule.PersonalFinancialEntityResolvers = {
  documents: async DbBusiness => {
    const documents = await getDocumentsByFinancialEntityIds.run(
      { financialEntityIds: [DbBusiness.id] },
      pool,
    );
    return documents;
  },
};
