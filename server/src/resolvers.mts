import { IUpdateChargeParams } from './__generated__/charges.types.mjs';
import { IInsertLedgerRecordsResult, IUpdateLedgerRecordParams } from './__generated__/ledger-records.types.mjs';
import {
  BankFinancialAccountResolvers,
  CardFinancialAccountResolvers,
  CommonTransactionResolvers,
  ConversionTransactionResolvers,
  Currency,
  DocumentResolvers,
  FeeTransactionResolvers,
  LtdFinancialEntityResolvers,
  PersonalFinancialEntityResolvers,
  Resolvers,
  TransactionDirection,
  WireTransactionResolvers,
} from './__generated__/types.mjs';
import { formatFinancialAmount } from './helpers/amount.mjs';
import { ENTITIES_WITHOUT_ACCOUNTING } from './helpers/constants.mjs';
import { getILSForDate } from './helpers/exchange.mjs';
import {
  generateEntryForAccountingValues,
  generateEntryForExchangeRatesDifferenceValues,
  generateEntryForFinancialAccountValues,
  hashavshevetFormat,
} from './helpers/hashavshevet.mjs';
import { buildLedgerEntries, decorateCharge } from './helpers/misc.mjs';
import {
  getChargeByFinancialAccountNumberLoader,
  getChargeByFinancialEntityIdLoader,
  getChargeByIdLoader,
  getChargesByFinancialAccountNumbers,
  getChargesByFinancialEntityIds,
  getConversionOtherSide,
  updateCharge,
} from './providers/charges.mjs';
import { pool } from './providers/db.mjs';
import { getDocsByChargeIdLoader, getDocsByFinancialEntityIds, getEmailDocs } from './providers/documents.mjs';
import { getChargeExchangeRates } from './providers/exchange.mjs';
import {
  getFinancialAccountByAccountNumberLoader,
  getFinancialAccountsByFinancialEntityIdLoader,
} from './providers/financial-accounts.mjs';
import { getFinancialEntityByIdLoader } from './providers/financial-entities.mjs';
import {
  getHashavshevetBusinessIndexes,
  getHashavshevetIsracardIndex,
  getHashavshevetVatIndexes,
} from './providers/hashavshevet.mjs';
import {
  getLedgerRecordsByChargeIdLoader,
  insertLedgerRecords,
  updateLedgerRecord,
} from './providers/ledger-records.mjs';

const commonFinancialEntityFields: LtdFinancialEntityResolvers | PersonalFinancialEntityResolvers = {
  id: DbBusiness => DbBusiness.id,
  accounts: async DbBusiness => {
    // TODO: add functionality for linkedEntities data
    const accounts = await getFinancialAccountsByFinancialEntityIdLoader.load(DbBusiness.id);
    return accounts;
  },
  charges: async (DbBusiness, { filter }) => {
    if (!filter || Object.keys(filter).length === 0) {
      const charges = await getChargeByFinancialEntityIdLoader.load(DbBusiness.id);
      return charges;
    }
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
  documents: async DbBusiness => {
    const documents = await getDocsByFinancialEntityIds.run({ financialEntityIds: [DbBusiness.id] }, pool);
    return documents;
  },
};

const commonFinancialAccountFields: CardFinancialAccountResolvers | BankFinancialAccountResolvers = {
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
      pool
    );
    return charges;
  },
};

const commonDocumentsFields: DocumentResolvers = {
  id: documentRoot => documentRoot.id,
  charge: async documentRoot => {
    if (!documentRoot.transaction_id) {
      return null;
    }
    const charge = await getChargeByIdLoader.load(documentRoot.transaction_id);
    return charge ?? null;
  },
  image: documentRoot => documentRoot.image_url,
  file: documentRoot => `https://mail.google.com/mail/u/0/#inbox/${documentRoot.email_id}`,
};

const commonTransactionFields:
  | ConversionTransactionResolvers
  | FeeTransactionResolvers
  | WireTransactionResolvers
  | CommonTransactionResolvers = {
  id: DbTransaction => DbTransaction.id,
  referenceNumber: DbTransaction => DbTransaction.bank_reference ?? 'Missing',
  createdAt: DbTransaction => DbTransaction.event_date,
  effectiveDate: DbTransaction => DbTransaction.debit_date,
  direction: DbTransaction =>
    parseFloat(DbTransaction.event_amount) > 0 ? TransactionDirection.Credit : TransactionDirection.Debit,
  amount: DbTransaction => formatFinancialAmount(DbTransaction.event_amount, DbTransaction.currency_code),
  description: DbTransaction => `${DbTransaction.bank_description} ${DbTransaction.detailed_bank_description}`,
  userNote: DbTransaction => DbTransaction.user_description,
  account: async DbTransaction => {
    // TODO: enhance logic to be based on ID instead of account_number
    if (!DbTransaction.account_number) {
      throw new Error(`Transaction ID="${DbTransaction.id}" is missing account_number`);
    }
    const account = await getFinancialAccountByAccountNumberLoader.load(DbTransaction.account_number);
    if (!account) {
      throw new Error(`Transaction ID="${DbTransaction.id}" is missing account_number`);
    }
    return account;
  },
  balance: DbTransaction => formatFinancialAmount(DbTransaction.current_balance),
  accountantApproval: DbTransaction => ({
    approved: DbTransaction.reviewed ?? false,
    remark: 'Missing', // TODO: missing in DB
  }),
  hashavshevetId: DbTransaction => DbTransaction.hashavshevet_id?.toString() ?? '',
};

export const resolvers: Resolvers = {
  Query: {
    financialEntity: async (_, { id }) => {
      const dbFe = await getFinancialEntityByIdLoader.load(id);
      if (!dbFe) {
        throw new Error(`Financial entity ID="${id}" not found`);
      }
      return dbFe;
    },
    documents: async () => {
      const dbDocs = await getEmailDocs.run(void 0, pool);
      return dbDocs;
    },
  },
  Mutation: {
    updateCharge: async (_, { chargeId, fields }) => {
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
        financialAccountsToBalance: fields.beneficiaries,
        financialEntity: fields.counterparty?.name,
        hashavshevetId: null,
        interest: null,
        isConversion: null,
        isProperty: fields.isProperty,
        links: null,
        originalId: null,
        personalCategory: fields.tag,
        proformaInvoiceFile: null,
        receiptDate: null,
        receiptImage: null,
        receiptNumber: null,
        receiptUrl: null,
        reviewed: fields.accountantApproval?.approved,
        taxCategory: null,
        taxInvoiceAmount: null,
        taxInvoiceCurrency: null,
        taxInvoiceDate: null,
        taxInvoiceFile: null,
        taxInvoiceNumber: null,
        userDescription: null,
        // TODO: implement not-Nis logic. currently if vatCurrency is set and not to Nis, ignoring the update
        vat: fields.vat?.currency && fields.vat.currency !== Currency.Nis ? null : fields.vat?.value,
        // TODO: implement not-Nis logic. currently if vatCurrency is set and not to Nis, ignoring the update
        withholdingTax:
          fields.withholdingTax?.currency && fields.withholdingTax.currency !== Currency.Nis
            ? null
            : fields.withholdingTax?.value,
        chargeId,
      };
      try {
        getChargeByIdLoader.clear(chargeId);
        const res = await updateCharge.run({ ...adjustedFields }, pool);
        return res[0];
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
    updateLedgerRecord: async (_, { ledgerRecordId, fields }) => {
      const currency =
        fields.originalAmount?.currency || fields.localCurrencyAmount?.currency
          ? hashavshevetFormat.currency(fields.originalAmount?.currency ?? fields.localCurrencyAmount?.currency ?? '')
          : null;

      const adjustedFields: IUpdateLedgerRecordParams = {
        // TODO: which fields should date & description inputs fill?
        ledgerRecordId,
        business: null,
        creditAccount1: fields.creditAccount?.name ?? null,
        creditAccount2: null,
        creditAmount1: fields.localCurrencyAmount?.value.toFixed(2) ?? null,
        creditAmount2: null,
        currency,
        date3: null,
        debitAccount1: fields.debitAccount?.name ?? null,
        debitAccount2: null,
        debitAmount1: fields.localCurrencyAmount?.value.toFixed(2) ?? null,
        debitAmount2: null,
        details: fields.description ?? null,
        foreignCreditAmount1: fields.originalAmount?.value.toFixed(2) ?? null,
        foreignCreditAmount2: null,
        foreignDebitAmount1: fields.originalAmount?.value.toFixed(2) ?? null,
        foreignDebitAmount2: null,
        hashavshevetId: Number(fields.hashavshevetId) ?? null,
        invoiceDate: fields.date ?? null,
        movementType: null,
        origin: null,
        originalId: null,
        proformaInvoiceFile: null,
        reference1: null,
        reference2: null,
        reviewed: fields.accountantApproval?.approved ?? null,
        valueDate: null,
      };
      try {
        const res = await updateLedgerRecord.run({ ...adjustedFields }, pool);

        if (!res || res.length === 0) {
          throw new Error(`Failed to update ledger record ID='${ledgerRecordId}'`);
        }

        /* clear cache */
        if (res[0].original_id) {
          getLedgerRecordsByChargeIdLoader.clear(res[0].original_id);
        }
        return res[0];
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
    updateTransaction: async (_, { transactionId, fields }) => {
      const adjustedFields: IUpdateChargeParams = {
        accountNumber: null,
        accountType: null,
        bankDescription: null,
        bankReference: fields.referenceNumber,
        businessTrip: null,
        contraCurrencyCode: null,
        currencyCode: null,
        currencyRate: null,
        // TODO: implement not-Nis logic. currently if vatCurrency is set and not to Nis, ignoring the update
        currentBalance:
          fields.balance?.currency && fields.balance.currency !== Currency.Nis
            ? null
            : fields.balance?.value?.toFixed(2),
        debitDate: fields.effectiveDate,
        detailedBankDescription: null,
        // TODO: implement not-Nis logic. currently if vatCurrency is set and not to Nis, ignoring the update
        eventAmount:
          fields.amount?.currency && fields.amount.currency !== Currency.Nis ? null : fields.amount?.value?.toFixed(2),
        eventDate: null,
        eventNumber: null,
        financialAccountsToBalance: null,
        financialEntity: null,
        hashavshevetId: fields.hashavshevetId,
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
        reviewed: fields.accountantApproval?.approved,
        taxCategory: null,
        taxInvoiceAmount: null,
        taxInvoiceCurrency: null,
        taxInvoiceDate: null,
        taxInvoiceFile: null,
        taxInvoiceNumber: null,
        userDescription: fields.userNote,
        vat: null,
        withholdingTax: null,
        chargeId: transactionId,
      };
      try {
        getChargeByIdLoader.clear(transactionId);
        const res = await updateCharge.run({ ...adjustedFields }, pool);
        return res[0];
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
    generateTaxMovement: async (_, { chargeId }) => {
      try {
        const charge = await getChargeByIdLoader.load(chargeId);
        if (!charge) {
          throw new Error(`Charge ID="${chargeId}" not found`);
        }
        if (!charge.account_number) {
          throw new Error(`Charge ID="${chargeId}" has no account number`);
        }

        const account = await getFinancialAccountByAccountNumberLoader.load(charge.account_number);
        if (!account) {
          throw new Error(`Account number="${charge.account_number}" not found`);
        }

        if (!account.owner) {
          throw new Error(`Account number="${charge.account_number}" has no owner`);
        }
        const owner = await getFinancialEntityByIdLoader.load(account.owner);
        if (!owner) {
          throw new Error(`FinancialEntity ID="${charge.account_number}" not found`);
        }

        const [hashBusinessIndexes] = await getHashavshevetBusinessIndexes.run(
          { financialEntityName: charge.financial_entity, ownerId: owner.id },
          pool
        );
        const hashVATIndexes = await getHashavshevetVatIndexes(owner.id);
        const isracardHashIndex = await getHashavshevetIsracardIndex(charge);
        const { debitExchangeRates, invoiceExchangeRates } = await getChargeExchangeRates(charge);

        const decoratedCharge = decorateCharge(charge, hashBusinessIndexes.auto_tax_category);

        const { entryForFinancialAccount, entryForAccounting } = await buildLedgerEntries(
          decoratedCharge,
          parseFloat(charge.event_amount),
          hashVATIndexes
        );

        const createdLedgerRecords: IInsertLedgerRecordsResult[] = [];

        // insert accounting ledger
        if (!ENTITIES_WITHOUT_ACCOUNTING.includes(decoratedCharge.financial_entity ?? '')) {
          try {
            const entryForAccountingValues = generateEntryForAccountingValues(
              decoratedCharge,
              entryForAccounting,
              account,
              hashBusinessIndexes,
              hashVATIndexes,
              isracardHashIndex,
              owner
            );
            const updateResult = await insertLedgerRecords.run({ ledgerRecord: [entryForAccountingValues] }, pool);
            if (updateResult.length === 0) {
              throw new Error('Failed to insert accounting ledger record');
            }
            console.log(JSON.stringify(updateResult[0]));
            createdLedgerRecords.push(updateResult[0]);
          } catch (error) {
            // TODO: Log important checks
            throw new Error(`error in Accounting insert - ${error}`);
          }
        }

        const conversionOtherSide = (
          await getConversionOtherSide.run(
            { chargeId: decoratedCharge.id, bankReference: decoratedCharge.bank_reference },
            pool
          )
        ).shift();

        // insert finacial account ledger
        try {
          const entryForFinancialAccountValues = generateEntryForFinancialAccountValues(
            decoratedCharge,
            entryForFinancialAccount,
            account,
            hashBusinessIndexes,
            hashVATIndexes,
            isracardHashIndex,
            owner,
            conversionOtherSide
          );
          const updateResult = await insertLedgerRecords.run({ ledgerRecord: [entryForFinancialAccountValues] }, pool);
          if (updateResult.length === 0) {
            throw new Error('Failed to insert financial account ledger record');
          }
          console.log(JSON.stringify(updateResult[0]));
          createdLedgerRecords.push(updateResult[0]);
        } catch (error) {
          // TODO: Log important checks
          throw new Error(`error in FinancialAccount insert - ${error}`);
        }

        if (
          charge.tax_invoice_currency &&
          entryForFinancialAccount.debitAmountILS != entryForAccounting.debitAmountILS
        ) {
          console.log('שערררררררר של different currencies');
          try {
            const entryForExchangeRatesDifferenceValues = generateEntryForExchangeRatesDifferenceValues(
              decoratedCharge,
              entryForFinancialAccount,
              entryForAccounting,
              account,
              hashBusinessIndexes,
              hashVATIndexes,
              isracardHashIndex,
              owner
            );
            const updateResult = await insertLedgerRecords.run(
              { ledgerRecord: [entryForExchangeRatesDifferenceValues] },
              pool
            );
            if (updateResult.length === 0) {
              throw new Error('Failed to insert exchange rates difference ledger record');
            }
            console.log(JSON.stringify(updateResult[0]));
            createdLedgerRecords.push(updateResult[0]);
          } catch (error) {
            // TODO: Log important checks
            throw new Error(`error in ExchangeRatesDifference insert - ${error}`);
          }
        } else if (
          getILSForDate(decoratedCharge, invoiceExchangeRates).eventAmountILS !=
            getILSForDate(decoratedCharge, debitExchangeRates).eventAmountILS &&
          decoratedCharge.account_type != 'creditcard' &&
          decoratedCharge.financial_entity != 'Isracard' &&
          decoratedCharge.tax_invoice_date
        ) {
          console.log('שערררררררר');
          try {
            const entryForExchangeRatesDifferenceValues = generateEntryForExchangeRatesDifferenceValues(
              decoratedCharge,
              entryForFinancialAccount,
              entryForAccounting,
              account,
              hashBusinessIndexes,
              hashVATIndexes,
              isracardHashIndex,
              owner,
              true,
              debitExchangeRates,
              invoiceExchangeRates
            );
            const updateResult = await insertLedgerRecords.run(
              { ledgerRecord: [entryForExchangeRatesDifferenceValues] },
              pool
            );
            if (updateResult.length === 0) {
              throw new Error('Failed to insert exchange rates difference ledger record');
            }
            console.log(JSON.stringify(updateResult[0]));
            createdLedgerRecords.push(updateResult[0]);
          } catch (error) {
            // TODO: Log important checks
            throw new Error(`error in ExchangeRatesDifference insert - ${error}`);
          }
        }

        console.log(`Ledger records generated: ${createdLedgerRecords.map(r => r.id)}`);
        return charge;
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
  },
  Invoice: {
    ...commonDocumentsFields,
    __isTypeOf(documentRoot) {
      return documentRoot.payper_document_type == 'חשבונית מס';
    },
    serialNumber: documentRoot => documentRoot.payper_document_id ?? '',
    date: documentRoot => documentRoot.payper_document_date,
    amount: documentRoot =>
      formatFinancialAmount(documentRoot.payper_total_for_payment, documentRoot.payper_currency_symbol),
    vat: documentRoot =>
      documentRoot.payper_vat_paytment != null ? formatFinancialAmount(documentRoot.payper_vat_paytment) : null,
  },
  InvoiceReceipt: {
    ...commonDocumentsFields,
    __isTypeOf(documentRoot) {
      return documentRoot.payper_document_type == 'חשבונית מס קבלה';
    },
    serialNumber: documentRoot => documentRoot.payper_document_id ?? '',
    date: documentRoot => documentRoot.payper_document_date,
    amount: documentRoot =>
      formatFinancialAmount(documentRoot.payper_total_for_payment, documentRoot.payper_currency_symbol),
    vat: documentRoot =>
      documentRoot.payper_vat_paytment != null ? formatFinancialAmount(documentRoot.payper_vat_paytment) : null,
  },

  Proforma: {
    ...commonDocumentsFields,
    __isTypeOf: () => false,
    serialNumber: documentRoot => documentRoot.payper_document_id ?? '',
    date: documentRoot => documentRoot.payper_document_date,
    amount: documentRoot =>
      formatFinancialAmount(documentRoot.payper_total_for_payment, documentRoot.payper_currency_symbol),
    vat: documentRoot =>
      documentRoot.payper_vat_paytment != null ? formatFinancialAmount(documentRoot.payper_vat_paytment) : null,
  },

  Unprocessed: {
    ...commonDocumentsFields,
    __isTypeOf(documentRoot) {
      return documentRoot.payper_document_type == null;
    },
  },

  Receipt: {
    ...commonDocumentsFields,
    __isTypeOf(documentRoot) {
      return documentRoot.payper_document_type == 'קבלה';
    },
    serialNumber: documentRoot => documentRoot.payper_document_id ?? '',
    date: documentRoot => documentRoot.payper_document_date,
    amount: documentRoot =>
      formatFinancialAmount(documentRoot.payper_total_for_payment, documentRoot.payper_currency_symbol),
    vat: documentRoot =>
      documentRoot.payper_vat_paytment != null ? formatFinancialAmount(documentRoot.payper_vat_paytment) : null,
  },

  LtdFinancialEntity: {
    __isTypeOf: () => true,
    ...commonFinancialEntityFields,
    govermentId: DbBusiness => DbBusiness.vat_number ?? '', // TODO: lots missing. should it stay mandatory?
    name: DbBusiness => DbBusiness.hebrew_name ?? DbBusiness.name,
    address: DbBusiness => DbBusiness.address ?? DbBusiness.address_hebrew ?? '', // TODO: lots missing. should it stay mandatory?

    englishName: DbBusiness => DbBusiness.name,
    email: DbBusiness => DbBusiness.email,
    website: DbBusiness => DbBusiness.website,
    phoneNumber: DbBusiness => DbBusiness.phone_number,
  },
  PersonalFinancialEntity: {
    __isTypeOf: () => false,
    ...commonFinancialEntityFields,
    name: DbBusiness => DbBusiness.name,
    email: DbBusiness => DbBusiness.email ?? '', // TODO: remove alternative ''
  },
  BankFinancialAccount: {
    __isTypeOf: DbAccount => !!DbAccount.bank_number,
    ...commonFinancialAccountFields,
    accountNumber: DbAccount => DbAccount.account_number.toString(),
    bankNumber: DbAccount => DbAccount.bank_number?.toString() ?? '', // TODO: remove alternative ''
    branchNumber: DbAccount => DbAccount.branch_number?.toString() ?? '', // TODO: remove alternative ''
    routingNumber: () => '', // TODO: implement
    iban: () => '', // TODO: missing in DB
    swift: () => '', // TODO: missing in DB
    country: () => '', // TODO: missing in DB
    name: DbAccount => DbAccount.account_number.toString(),
  },
  CardFinancialAccount: {
    __isTypeOf: DbAccount => !DbAccount.bank_number,
    ...commonFinancialAccountFields,
    number: DbAccount => DbAccount.account_number.toString(),
    fourDigits: DbAccount => DbAccount.account_number.toString(),
  },
  Charge: {
    id: DbCharge => DbCharge.id,
    createdAt: () => null ?? 'There is not Date value', // TODO: missing in DB
    additionalDocuments: async DbCharge => {
      if (!DbCharge.id) {
        return [];
      }
      const docs = await getDocsByChargeIdLoader.load(DbCharge.id);
      return docs.filter(d => !d.duplication_of);
    },
    ledgerRecords: async DbCharge => {
      if (!DbCharge.id) {
        return [];
      }
      const records = await getLedgerRecordsByChargeIdLoader.load(DbCharge.id);
      return records;
    },
    transactions: DbCharge => [DbCharge],
    counterparty: DbCharge => DbCharge.financial_entity,
    description: () => 'Missing', // TODO: implement
    tags: DbCharge => (DbCharge.personal_category ? [DbCharge.personal_category] : []),
    beneficiaries: async DbCharge => {
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
            const guildAccounts = await getFinancialAccountsByFinancialEntityIdLoader.load(
              '6a20aa69-57ff-446e-8d6a-1e96d095e988'
            );
            const guildAccountsNumbers = guildAccounts.map(a => a.account_number);
            if (guildAccountsNumbers.includes(DbCharge.account_number)) {
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
            const uriAccounts = await getFinancialAccountsByFinancialEntityIdLoader.load(
              'a1f66c23-cea3-48a8-9a4b-0b4a0422851a'
            );
            const uriAccountsNumbers = uriAccounts.map(a => a.account_number);
            if (uriAccountsNumbers.includes(DbCharge.account_number)) {
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
    vat: DbCharge => (DbCharge.vat != null ? formatFinancialAmount(DbCharge.vat) : null),
    withholdingTax: DbCharge => formatFinancialAmount(DbCharge.withholding_tax),
    invoice: async DbCharge => {
      if (!DbCharge.id) {
        return null;
      }
      const docs = await getDocsByChargeIdLoader.load(DbCharge.id);
      const invoices = docs.filter(
        d => !d.duplication_of && ['חשבונית מס', 'חשבונית מס קבלה'].includes(d.payper_document_type ?? '')
      );
      if (invoices.length > 1) {
        console.log(`Charge ${DbCharge.id} has more than one invoices: [${invoices.map(r => `"${r.id}"`).join(', ')}]`);
      }
      return invoices.shift() ?? null;
    },
    receipt: async DbCharge => {
      if (!DbCharge.id) {
        return null;
      }
      const docs = await getDocsByChargeIdLoader.load(DbCharge.id);
      const receipts = docs.filter(
        d => !d.duplication_of && ['קבלה', 'חשבונית מס קבלה'].includes(d.payper_document_type ?? '')
      );
      if (receipts.length > 1) {
        console.log(`Charge ${DbCharge.id} has more than one receipt: [${receipts.map(r => `"${r.id}"`).join(', ')}]`);
      }
      return receipts.shift() ?? null;
    },
    accountantApproval: DbCharge => ({
      approved: DbCharge.reviewed ?? false,
      remark: 'Missing', // TODO: missing in DB
    }),
    property: DbCharge => DbCharge.is_property,
  },
  LedgerRecord: {
    id: DbLedgerRecord => DbLedgerRecord.id,
    creditAccount: DbLedgerRecord => DbLedgerRecord.credit_account_1,
    debitAccount: DbLedgerRecord => DbLedgerRecord.debit_account_1,
    originalAmount: DbLedgerRecord =>
      formatFinancialAmount(
        DbLedgerRecord.foreign_debit_amount_1 ?? DbLedgerRecord.debit_amount_1,
        DbLedgerRecord.currency
      ),
    date: DbLedgerRecord => DbLedgerRecord.invoice_date,
    description: () => 'Missing', // TODO: missing in DB
    accountantApproval: DbLedgerRecord => ({
      approved: DbLedgerRecord.reviewed ?? false,
      remark: 'Missing', // TODO: missing in DB
    }),
    localCurrencyAmount: DbLedgerRecord => formatFinancialAmount(DbLedgerRecord.debit_amount_1, null),
    hashavshevetId: DbLedgerRecord => DbLedgerRecord.hashavshevet_id?.toString() ?? null,
  },
  NamedCounterparty: {
    __isTypeOf: parent => !!parent,
    name: parent => parent ?? '',
  },
  BeneficiaryCounterparty: {
    __isTypeOf: () => true,
    counterparty: parent => parent.name,
    percentage: parent => parent.percentage,
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
