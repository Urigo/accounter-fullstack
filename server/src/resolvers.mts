import { formatFinancialAmount } from './helpers/amount.mjs';
import currency from 'currency.js';
import {
  getChargesByFinancialAccountIds,
  getChargesByFinancialEntityIds,
} from './providers/charges.mjs';
import { pool } from './providers/db.mjs';
import { getFinancialAccountsByFeIds } from './providers/financialAccounts.mjs';
import { getFinancialEntitiesByIds } from './providers/financialEntities.mjs';
import { getLedgerRecordsByChargeIds } from './providers/ledgerRecords.mjs';
import { getDocsByChargeId, getEmailDocs } from './providers/sqlQueries.mjs';
import {
  BankFinancialAccountResolvers,
  CardFinancialAccountResolvers,
  LtdFinancialEntityResolvers,
  PersonalFinancialEntityResolvers,
  Resolvers,
} from './__generated__/types.mjs';

const commonFinancialEntityFields:
  | LtdFinancialEntityResolvers
  | PersonalFinancialEntityResolvers = {
  id: (DbBusiness) => DbBusiness.id,
  accounts: async (DbBusiness) => {
    // TODO: add funcionality for linkedEntities data
    const accounts = await getFinancialAccountsByFeIds.run(
      { financialEntityIds: [DbBusiness.id] },
      pool
    );
    return accounts;
  },
  charges: async (DbBusiness, { filter }) => {
    const charges = await getChargesByFinancialEntityIds.run(
      {
        financialEntityIds: [DbBusiness.id],
        fromDate: filter?.fromDate,
        toDate: filter?.toDate,
      },
      pool
    );
    return charges;
  },
  linkedEntities: () => [], // TODO: implement
};

const commonFinancialAccountFields:
  | CardFinancialAccountResolvers
  | BankFinancialAccountResolvers = {
  id: (DbAccount) => DbAccount.account_number.toString(),
  charges: async (DbAccount, { filter }) => {
    const charges = await getChargesByFinancialAccountIds.run(
      {
        financialAccountIds: [DbAccount.account_number],
        fromDate: filter?.fromDate,
        toDate: filter?.toDate,
      },
      pool
    );
    return charges;
  },
};

export const resolvers: Resolvers = {
  Query: {
    financialEntity: async (_, { id }) => {
      const dbFe = await getFinancialEntitiesByIds.run({ ids: [id] }, pool);
      return dbFe[0];
    },
    documents: async () => {
      const dbDocs = await getEmailDocs.run(void 0, pool);
      return dbDocs;
    },
  },
  Invoice: {
    __isTypeOf(DocumentRoot) {
      return (
        DocumentRoot.payper_document_type == 'חשבונית מס קבלה' ||
        DocumentRoot.payper_document_type == 'חשבונית'
      );
    },
    id: (DocumentRoot) => DocumentRoot.id,
    image: (DocumentRoot) => DocumentRoot.image_url,
    serialNumber: (DocumentRoot) => DocumentRoot.payper_document_id ?? '',
    date: (DocumentRoot) => DocumentRoot.payper_document_date,
    amount: (DocumentRoot) =>
      formatFinancialAmount(
        DocumentRoot.payper_total_for_payment,
          DocumentRoot.payper_currency_symbol
      ),
    file: (DocumentRoot) =>
      `https://mail.google.com/mail/u/0/#inbox/${DocumentRoot.email_id}`,
      vat: (DocumentRoot) =>
      formatFinancialAmount(
        DocumentRoot.payper_vat_paytment, DocumentRoot.payper_currency_symbol
      ),
  },
  Proforma: {
    __isTypeOf(DocumentRoot) {
      return DocumentRoot.payper_document_type == 'חשבון עסקה';
    },
    id: (DocumentRoot) => DocumentRoot.id,
    image: (DocumentRoot) => DocumentRoot.image_url,
    serialNumber: (DocumentRoot) => DocumentRoot.payper_document_id ?? '',
    date: (DocumentRoot) => DocumentRoot.payper_document_date,
    amount: (DocumentRoot) =>
      formatFinancialAmount(
        DocumentRoot.payper_total_for_payment,
          DocumentRoot.payper_currency_symbol
      ),
    vat: (DocumentRoot) =>
    formatFinancialAmount(
      DocumentRoot.payper_vat_paytment, DocumentRoot.payper_currency_symbol
    ),
  },
  Receipt: {
    __isTypeOf(DocumentRoot) {
      return DocumentRoot.payper_document_type == 'קבלה';
    },
    id: (DocumentRoot) => DocumentRoot.id,
    image: (DocumentRoot) => DocumentRoot.image_url,
    file: (DocumentRoot) => DocumentRoot.file_hash ?? '',
    serialNumber: (DocumentRoot) => DocumentRoot.payper_document_id ?? '',
    date: (DocumentRoot) => DocumentRoot.payper_document_date,
    vat: (DocumentRoot) =>
    formatFinancialAmount(
      DocumentRoot.payper_vat_paytment, DocumentRoot.payper_currency_symbol
    ),
  },
  LtdFinancialEntity: {
    __isTypeOf: () => true,
    ...commonFinancialEntityFields,
    govermentId: (DbBusiness) => DbBusiness.vat_number ?? '', // TODO: lots missing. should it stay mandatory?
    name: (DbBusiness) => DbBusiness.hebrew_name ?? DbBusiness.name,
    address: (DbBusiness) =>
      DbBusiness.address ?? DbBusiness.address_hebrew ?? '', // TODO: lots missing. should it stay mandatory?

    englishName: (DbBusiness) => DbBusiness.name ?? null,
    email: (DbBusiness) => DbBusiness.email,
    website: (DbBusiness) => DbBusiness.website,
    phoneNumber: (DbBusiness) => DbBusiness.phone_number,
  },
  PersonalFinancialEntity: {
    __isTypeOf: () => false,
    ...commonFinancialEntityFields,
    name: (DbBusiness) => DbBusiness.name,
    email: (DbBusiness) => DbBusiness.email ?? '', // TODO: remove alternative ''
    documents: () => [], // TODO: implement
  },
  BankFinancialAccount: {
    __isTypeOf: (DbAccount) => !!DbAccount.bank_number,
    ...commonFinancialAccountFields,
    accountNumber: (DbAccount) => DbAccount.account_number.toString(),
    bankNumber: (DbAccount) => DbAccount.bank_number?.toString() ?? '', // TODO: remove alternative ''
    branchNumber: (DbAccount) => DbAccount.branch_number?.toString() ?? '', // TODO: remove alternative ''
    routingNumber: () => '', // TODO: implement
    iban: () => '', // TODO: missing in DB
    swift: () => '', // TODO: missing in DB
    country: () => '', // TODO: missing in DB
    name: (DbAccount) => DbAccount.account_number.toString(),
  },
  CardFinancialAccount: {
    __isTypeOf: (DbAccount) => !DbAccount.bank_number,
    ...commonFinancialAccountFields,
    number: (DbAccount) => DbAccount.account_number.toString(),
    fourDigits: (DbAccount) => DbAccount.account_number.toString(),
  },
  Charge: {
    id: (DbCharge) => DbCharge.id!,
    createdAt: () => null, // TODO: missing in DB
    additionalDocument: (DbCharge) => {
      const docs = getDocsByChargeId.run({ chargeIds: [DbCharge.id] }, pool);
      return docs;
    },
    ledgerRecords: async (DbCharge) => {
      const records = await getLedgerRecordsByChargeIds.run(
        { chargeIds: [DbCharge.id] },
        pool
      );
      return records;
    },
    transactions: () => [], // TODO: implement
    counterparty: () => '', // TODO: implement
    description: () => '', // TODO: implement
    tags: (DbCharge) =>
      DbCharge.personal_category ? [DbCharge.personal_category] : [],
    beneficiaries: () => [], // TODO: implement
  },
  LedgerRecord: {
    id: (DbLedgerRecord) => DbLedgerRecord.id,
    creditAccount: (DbLedgerRecord) => DbLedgerRecord.חשבון_זכות_1 ?? '',
    debitAccount: (DbLedgerRecord) => DbLedgerRecord.חשבון_חובה_1 ?? '',
    originalAmount: (DbLedgerRecord) =>
      formatFinancialAmount(
        DbLedgerRecord.מטח_סכום_חובה_1 ?? DbLedgerRecord.סכום_חובה_1,
        DbLedgerRecord.מטבע
      ),
    date: (DbLedgerRecord) => DbLedgerRecord.תאריך_חשבונית,
    description: () => '', // TODO: missing in DB
    accountantApproval: (DbLedgerRecord) => ({
      approved: DbLedgerRecord.reviewed ?? false,
      remark: '', // TODO: missing in DB
    }),
    localCurrencyAmount: (DbLedgerRecord) =>
      formatFinancialAmount(DbLedgerRecord.סכום_חובה_1, null),
    hashavshevetId: (DbLedgerRecord) =>
      DbLedgerRecord.hashavshevet_id?.toString() ?? null,
  },
  NamedCounterparty: {
    __isTypeOf: () => true,
    name: (parent) => parent,
  },
};
