import type { IGetAllDocumentsResult } from '../../../__generated__/documents.types.mjs';
import {
  DocumentResolvers,
  DocumentType,
  InvoiceReceiptResolvers,
  InvoiceResolvers,
  ProformaResolvers,
  ReceiptResolvers,
  Resolver,
} from '../../../__generated__/types.mjs';
import { formatFinancialAmount } from '../../../helpers/amount.mjs';
import { TimelessDateString } from '../../../models/index.mjs';
import { getChargeByIdLoader } from '../../../providers/charges.mjs';
import { format } from 'date-fns';

export const documentType: Resolver<
  DocumentType,
  IGetAllDocumentsResult,
  unknown,
  Record<string, unknown>
> = documentRoot => {
  let key = documentRoot.type[0].toUpperCase() + documentRoot.type.substring(1).toLocaleLowerCase();
  if (key == 'Invoice_receipt') {
    key = 'InvoiceReceipt';
  }
  return DocumentType[key as keyof typeof DocumentType];
};

export const commonDocumentsFields: DocumentResolvers = {
  id: documentRoot => documentRoot.id,
  charge: async documentRoot => {
    if (!documentRoot.charge_id) {
      return null;
    }
    const charge = await getChargeByIdLoader.load(documentRoot.charge_id);
    return charge ?? null;
  },
  image: documentRoot => documentRoot.image_url ?? null,
  file: documentRoot => documentRoot.file_url ?? null,
  creditor: documentRoot => documentRoot.creditor,
  debtor: documentRoot => documentRoot.debtor,
  isReviewed: documentRoot => documentRoot.is_reviewed,
  documentType,
};

export const commonFinancialDocumentsFields:
  | InvoiceResolvers
  | ReceiptResolvers
  | InvoiceReceiptResolvers
  | ProformaResolvers = {
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
