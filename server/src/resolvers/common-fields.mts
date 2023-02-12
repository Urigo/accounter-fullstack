import { format } from 'date-fns';
import type { IGetChargesByIdsResult } from '../__generated__/charges.types.mjs';
import type { IGetAllDocumentsResult } from '../__generated__/documents.types.mjs';
import {
  BankFinancialAccountResolvers,
  CardFinancialAccountResolvers,
  CommonTransactionResolvers,
  ConversionTransactionResolvers,
  DocumentResolvers,
  DocumentType,
  FeeTransactionResolvers,
  InvoiceReceiptResolvers,
  InvoiceResolvers,
  LtdFinancialEntityResolvers,
  PersonalFinancialEntityResolvers,
  ProformaResolvers,
  ReceiptResolvers,
  Resolver,
  TransactionDirection,
  WireTransactionResolvers,
} from '../__generated__/types.mjs';
import { formatFinancialAmount } from '../helpers/amount.mjs';
import { effectiveDateSuplement } from '../helpers/misc.mjs';
import {
  getChargeByFinancialAccountNumberLoader,
  getChargeByFinancialEntityIdLoader,
  getChargeByIdLoader,
  getChargesByFinancialAccountNumbers,
  getChargesByFinancialEntityIds,
} from '../providers/charges.mjs';
import { pool } from '../providers/db.mjs';
import { getDocumentsByFinancialEntityIds } from '../providers/documents.mjs';
import {
  getFinancialAccountByAccountNumberLoader,
  getFinancialAccountsByFinancialEntityIdLoader,
} from '../providers/financial-accounts.mjs';
import { TimelessDateString } from '../scalars/index.js';

export const commonFinancialEntityFields:
  | LtdFinancialEntityResolvers
  | PersonalFinancialEntityResolvers = {
  id: DbBusiness => DbBusiness.id,
  accounts: async DbBusiness => {
    // TODO: add functionality for linkedEntities data
    const accounts = await getFinancialAccountsByFinancialEntityIdLoader.load(DbBusiness.id);
    return accounts;
  },
  charges: async (DbBusiness, { filter, page, limit }) => {
    const charges: IGetChargesByIdsResult[] = [];
    if (!filter || Object.keys(filter).length === 0) {
      const newCharges = await getChargeByFinancialEntityIdLoader.load(DbBusiness.id);
      charges.push(...newCharges);
    } else {
      const newCharges = await getChargesByFinancialEntityIds.run(
        {
          financialEntityIds: [DbBusiness.id],
          fromDate: filter?.fromDate,
          toDate: filter?.toDate,
        },
        pool,
      );
      charges.push(...newCharges);
    }
    return {
      __typename: 'PaginatedCharges',
      nodes: charges.slice(page * limit - limit, page * limit),
      pageInfo: {
        totalPages: Math.ceil(charges.length / limit),
      },
    };
  },
  linkedEntities: () => [], // TODO: implement
  documents: async DbBusiness => {
    const documents = await getDocumentsByFinancialEntityIds.run(
      { financialEntityIds: [DbBusiness.id] },
      pool,
    );
    return documents;
  },
};

export const commonFinancialAccountFields:
  | CardFinancialAccountResolvers
  | BankFinancialAccountResolvers = {
  id: DbAccount => DbAccount.id,
  charges: async (DbAccount, { filter }) => {
    if (!filter || Object.keys(filter).length === 0) {
      const charges = await getChargeByFinancialAccountNumberLoader.load(DbAccount.account_number);
      return charges;
    }
    const charges = await getChargesByFinancialAccountNumbers.run(
      {
        financialAccountNumbers: [DbAccount.account_number],
        fromDate: filter?.fromDate,
        toDate: filter?.toDate,
      },
      pool,
    );
    return charges;
  },
};

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
    documentRoot.vat_amount != null ? formatFinancialAmount(documentRoot.vat_amount) : null,
  creditor: documentRoot => documentRoot.creditor,
  debtor: documentRoot => documentRoot.debtor,
};

export const commonTransactionFields:
  | ConversionTransactionResolvers
  | FeeTransactionResolvers
  | WireTransactionResolvers
  | CommonTransactionResolvers = {
  id: DbTransaction => DbTransaction.id,
  referenceNumber: DbTransaction => DbTransaction.bank_reference ?? 'Missing',
  createdAt: DbTransaction => DbTransaction.event_date,
  effectiveDate: DbTransaction => effectiveDateSuplement(DbTransaction),
  direction: DbTransaction =>
    parseFloat(DbTransaction.event_amount) > 0
      ? TransactionDirection.Credit
      : TransactionDirection.Debit,
  amount: DbTransaction =>
    formatFinancialAmount(DbTransaction.event_amount, DbTransaction.currency_code),
  description: DbTransaction =>
    `${DbTransaction.bank_description} ${DbTransaction.detailed_bank_description}`,
  userNote: DbTransaction => DbTransaction.user_description,
  account: async DbTransaction => {
    // TODO: enhance logic to be based on ID instead of account_number
    if (!DbTransaction.account_number) {
      throw new Error(`Transaction ID="${DbTransaction.id}" is missing account_number`);
    }
    const account = await getFinancialAccountByAccountNumberLoader.load(
      DbTransaction.account_number,
    );
    if (!account) {
      throw new Error(`Account number "${DbTransaction.account_number}" is missing`);
    }
    return account;
  },
  balance: DbTransaction => formatFinancialAmount(DbTransaction.current_balance),
  accountantApproval: DbTransaction => ({
    approved: DbTransaction.reviewed ?? false,
    remark: 'Missing', // TODO: missing in DB
  }),
  hashavshevetId: DbTransaction => DbTransaction.hashavshevet_id,
};
