import { formatFinancialAmount } from './helpers/amount.mjs';
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
  CommonTransactionResolvers,
  ConversionTransactionResolvers,
  FeeTransactionResolvers,
  LtdFinancialEntityResolvers,
  PersonalFinancialEntityResolvers,
  Resolvers,
  TransactionDirection,
  WireTransactionResolvers,
} from './__generated__/types.mjs';

const commonFinancialEntityFields:
  | LtdFinancialEntityResolvers
  | PersonalFinancialEntityResolvers = {
  id: (DbBusiness) => DbBusiness.id,
  accounts: async (DbBusiness) => {
    // TODO: add functionality for linkedEntities data
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

const commonTransactionFields:
  | ConversionTransactionResolvers
  | FeeTransactionResolvers
  | WireTransactionResolvers
  | CommonTransactionResolvers = {
  id: (DbTransaction) => DbTransaction.id!,
  referenceNumber: (DbTransaction) => DbTransaction.bank_reference ?? 'Missing',
  createdAt: (DbTransaction) => DbTransaction.event_date,
  effectiveDate: (DbTransaction) => DbTransaction.debit_date,
  direction: (DbTransaction) =>
    parseFloat(DbTransaction.event_amount!) > 0
      ? TransactionDirection.Credit
      : TransactionDirection.Debit,
  amount: (DbTransaction) => formatFinancialAmount(DbTransaction.event_amount),
  description: (DbTransaction) =>
    `${DbTransaction.bank_description} ${DbTransaction.detailed_bank_description}`,
  userNote: (DbTransaction) => DbTransaction.user_description,
  account: async (DbTransaction) => {
    if (!DbTransaction.account_number) {
      throw new Error(
        `Transaction ID="${DbTransaction.id}" is missing account_number`
      );
    }
    const accounts = await getFinancialAccountsByFeIds.run(
      { financialEntityIds: [DbTransaction.account_number.toString()] },
      pool
    );
    return accounts[0];
  },
  balance: (DbTransaction) =>
    formatFinancialAmount(DbTransaction.current_balance),
  accountantApproval: (DbTransaction) => ({
    approved: DbTransaction.reviewed ?? false,
    remark: 'Missing', // TODO: missing in DB
  }),
  hashavshevetId: (DbTransaction) =>
    DbTransaction.hashavshevet_id?.toString() ?? '',
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
    transactions: (DbCharge) => [DbCharge],
    counterparty: (DbCharge) => DbCharge.financial_entity ?? '',
    description: () => 'Missing', // TODO: implement
    tags: (DbCharge) =>
      DbCharge.personal_category ? [DbCharge.personal_category] : [],
    beneficiaries: async (DbCharge) => {
      switch (DbCharge.financial_accounts_to_balance) {
        case 'no':
          return [
            {
              name: 'Uri',
              percentage: 50,
            },
            {
              name: 'Dotan',
              percentage: 50,
            },
          ];
        case 'uri':
          return [
            {
              name: 'Uri',
              percentage: 100,
            },
          ];
        case 'dotan':
          return [
            {
              name: 'dotan',
              percentage: 100,
            },
          ];
        default:
          {
            // case Guild account
            const guildAccounts = await getFinancialAccountsByFeIds.run(
              { financialEntityIds: ['6a20aa69-57ff-446e-8d6a-1e96d095e988'] },
              pool
            );
            const guildAccountsIds = guildAccounts.map((a) => a.account_number);
            if (guildAccountsIds.includes(DbCharge.account_number!)) {
              return [
                {
                  name: 'Uri',
                  percentage: 50,
                },
                {
                  name: 'Dotan',
                  percentage: 50,
                },
              ];
            }

            // case UriLTD account
            const uriAccounts = await getFinancialAccountsByFeIds.run(
              { financialEntityIds: ['a1f66c23-cea3-48a8-9a4b-0b4a0422851a'] },
              pool
            );
            const uriAccountsIds = uriAccounts.map((a) => a.account_number);
            if (uriAccountsIds.includes(DbCharge.account_number!)) {
              return [
                {
                  name: 'Uri',
                  percentage: 100,
                },
              ];
            }
          }
          return [];
      }
    },
    vat: (DbCharge) =>
      DbCharge.vat != null ? formatFinancialAmount(DbCharge.vat) : null,
    withholdingTax: (DbCharge) =>
      formatFinancialAmount(DbCharge.withholding_tax),
    invoice: () => null, // TODO: implement
    accountantApproval: (DbCharge) => ({
      approved: DbCharge.reviewed ?? false,
      remark: 'Missing', // TODO: missing in DB
    }),
    property: (DbCharge) => DbCharge.is_property,
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
    description: () => 'Missing', // TODO: missing in DB
    accountantApproval: (DbLedgerRecord) => ({
      approved: DbLedgerRecord.reviewed ?? false,
      remark: 'Missing', // TODO: missing in DB
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
  BeneficiaryCounterparty: {
    __isTypeOf: () => true,
    counterparty: (parent) => parent.name,
    percentage: (parent) => parent.percentage,
  },
  // WireTransaction: {
  //   ...commonTransactionFields,
  // },
  // FeeTransaction: {
  //   ...commonTransactionFields,
  // },
  // ConversionTransaction: {
  //   // __isTypeOf: (DbTransaction) => DbTransaction.is_conversion ?? false,
  //   ...commonTransactionFields,
  // },
  CommonTransaction: {
    __isTypeOf: () => true,
    ...commonTransactionFields,
  },
};
