import { formatFinancialAmount, optionalDateToTimelessDateString } from '@shared/helpers';
import { DocumentType } from '../../../shared/enums.js';
import { DocumentsProvider } from '../providers/documents.provider.js';
import type { document_type, DocumentsModule } from '../types.js';

export const normalizeDocumentType = (type: document_type): DocumentType => {
  switch (type) {
    case 'CREDIT_INVOICE':
      return DocumentType.CreditInvoice;
    case 'INVOICE':
      return DocumentType.Invoice;
    case 'INVOICE_RECEIPT':
      return DocumentType.InvoiceReceipt;
    case 'OTHER':
      return DocumentType.Other;
    case 'PROFORMA':
      return DocumentType.Proforma;
    case 'RECEIPT':
      return DocumentType.Receipt;
    case 'UNPROCESSED':
      return DocumentType.Unprocessed;
    default:
      throw new Error(`Unknown document type: ${type}`);
  }
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
  documentType: documentRoot => normalizeDocumentType(documentRoot.type),
};

export const commonFinancialDocumentsFields:
  | DocumentsModule.InvoiceResolvers
  | DocumentsModule.ReceiptResolvers
  | DocumentsModule.InvoiceReceiptResolvers
  | DocumentsModule.ProformaResolvers = {
  serialNumber: documentRoot => documentRoot.serial_number ?? '',
  date: documentRoot => optionalDateToTimelessDateString(documentRoot.date),
  amount: documentRoot =>
    formatFinancialAmount(documentRoot.total_amount, documentRoot.currency_code),
  vat: documentRoot =>
    documentRoot.vat_amount == null
      ? null
      : formatFinancialAmount(documentRoot.vat_amount, documentRoot.currency_code),
  vatReportDateOverride: documentRoot =>
    optionalDateToTimelessDateString(documentRoot.vat_report_date_override),
  noVatAmount: documentRoot =>
    documentRoot.no_vat_amount ? Number(documentRoot.no_vat_amount) : null,
  allocationNumber: documentRoot => documentRoot.allocation_number,
  exchangeRateOverride: documentRoot =>
    documentRoot.exchange_rate_override == null
      ? null
      : Number(documentRoot.exchange_rate_override),
};

export const commonChargeFields: DocumentsModule.ChargeResolvers = {
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
};
