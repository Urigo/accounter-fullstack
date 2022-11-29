import { GraphQLError } from 'graphql';

import type { IGetChargesByIdsResult, IUpdateChargeParams } from '../__generated__/charges.types.mjs';
import type { IInsertDocumentsParams, IUpdateDocumentParams } from '../__generated__/documents.types.mjs';
import {
  IInsertLedgerRecordsParams,
  IInsertLedgerRecordsResult,
  IUpdateLedgerRecordParams,
} from '../__generated__/ledger-records.types.mjs';
import { Currency, DocumentType, Resolvers } from '../__generated__/types.mjs';
import { formatFinancialAmount } from '../helpers/amount.mjs';
import { ENTITIES_WITHOUT_ACCOUNTING } from '../helpers/constants.mjs';
import { getILSForDate } from '../helpers/exchange.mjs';
import {
  generateEntryForAccountingValues,
  generateEntryForExchangeRatesDifferenceValues,
  generateEntryForFinancialAccountValues,
  hashavshevetFormat,
  parseDate,
} from '../helpers/hashavshevet.mjs';
import { buildLedgerEntries, decorateCharge } from '../helpers/misc.mjs';
import { getChargeByIdLoader, getConversionOtherSide, updateCharge } from '../providers/charges.mjs';
import { pool } from '../providers/db.mjs';
import {
  deleteDocument,
  getAllDocuments,
  getDocumentsByChargeIdLoader,
  insertDocuments,
  updateDocument,
} from '../providers/documents.mjs';
import { getExchangeRates } from '../providers/exchange.mjs';
import {
  getFinancialAccountByAccountNumberLoader,
  getFinancialAccountsByFinancialEntityIdLoader,
} from '../providers/financial-accounts.mjs';
import { getFinancialEntityByIdLoader } from '../providers/financial-entities.mjs';
import {
  getHashavshevetBusinessIndexes,
  getHashavshevetIsracardIndex,
  getHashavshevetVatIndexes,
} from '../providers/hashavshevet.mjs';
import {
  deleteLedgerRecord,
  getLedgerRecordsByChargeIdLoader,
  insertLedgerRecords,
  updateLedgerRecord,
} from '../providers/ledger-records.mjs';
import { TimelessDateScalar, TimelessDateString } from '../scalars/timeless-date.mjs';
import {
  commonDocumentsFields,
  commonFinancialAccountFields,
  commonFinancialDocumentsFields,
  commonFinancialEntityFields,
  commonTransactionFields,
} from './common-fields.mjs';
import { uploadDocument } from './document-handling.mjs';
import { fetchEmailDocument } from './email-handling.mjs';

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
      const dbDocs = await getAllDocuments.run(void 0, pool);
      return dbDocs;
    },
    chargeById: async (_, { id }) => {
      const dbCharge = await getChargeByIdLoader.load(id);
      if (!dbCharge) {
        throw new Error(`Charge ID="${id}" not found`);
      }
      return dbCharge;
    },
  },
  Mutation: {
    uploadDocument,
    fetchEmailDocument,
    updateDocument: async (_, { fields, documentId }) => {
      try {
        let charge: IGetChargesByIdsResult | undefined;

        if (fields.chargeId) {
          charge = await getChargeByIdLoader.load(fields.chargeId);
          if (!charge) {
            throw new Error(`Charge ID="${fields.chargeId}" not valid`);
          }
        }

        const adjustedFields: IUpdateDocumentParams = {
          documentId,
          chargeId: fields.chargeId ?? null,
          currencyCode: fields.amount?.currency ?? null,
          date: fields.date ? new Date(fields.date) : null,
          fileUrl: fields.file ? fields.file.toString() : null,
          imageUrl: fields.image ? fields.image.toString() : null,
          serialNumber: fields.serialNumber ?? null,
          totalAmount: fields.amount?.raw ?? null,
          type: fields.documentType ?? null,
          vatAmount: fields.vat?.raw ?? null,
          isReviewed: true,
        };
        const res = await updateDocument.run({ ...adjustedFields }, pool);
        if (!res || res.length === 0) {
          throw new Error(`Document ID="${documentId}" not found`);
        }

        const updatedDoc = res[0];

        if (charge?.id && !charge.vat && updatedDoc.vat_amount) {
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
            financialAccountsToBalance: null,
            financialEntity: null,
            hashavshevetId: null,
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
            reviewed: null,
            taxCategory: null,
            taxInvoiceAmount: null,
            taxInvoiceCurrency: null,
            taxInvoiceDate: null,
            taxInvoiceFile: null,
            taxInvoiceNumber: null,
            userDescription: null,
            vat: updatedDoc.vat_amount,
            withholdingTax: null,
            chargeId: charge.id,
          };
          const res = await updateCharge.run(adjustedFields, pool);
          if (!res || res.length === 0) {
            throw new Error(`Could not update vat from Document ID="${documentId}" to Charge ID="${fields.chargeId}"`);
          }
        }

        return {
          document: updatedDoc,
        };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
    },
    deleteDocument: async (_, { documentId }) => {
      const res = await deleteDocument.run({ documentId }, pool);
      if (res.length === 1) {
        return true;
      }
      throw new GraphQLError(
        res.length === 0 ? 'Document not found' : `More than one document found and deleted: ${res}`
      );
    },
    updateCharge: async (_, { chargeId, fields }) => {
      const financialAccountsToBalance = fields.beneficiaries
        ? JSON.stringify(fields.beneficiaries.map(b => ({ name: b.counterparty.name, percentage: b.percentage })))
        : null;
      const adjustedFields: IUpdateChargeParams = {
        accountNumber: null,
        accountType: null,
        bankDescription: null,
        bankReference: null,
        businessTrip: null,
        contraCurrencyCode: null,
        currencyCode: fields.totalAmount?.currency ?? null,
        currencyRate: null,
        currentBalance: null,
        debitDate: null,
        detailedBankDescription: null,
        eventAmount: fields.totalAmount?.raw?.toFixed(2) ?? null,
        eventDate: null,
        eventNumber: null,
        financialAccountsToBalance,
        financialEntity: fields.counterparty?.name,
        hashavshevetId: null,
        interest: null,
        isConversion: null,
        isProperty: fields.isProperty,
        links: null,
        originalId: null,
        personalCategory: fields.tags ? JSON.stringify(fields.tags) : null,
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
        vat: fields.vat ?? null,
        withholdingTax: fields.withholdingTax ?? null,
        chargeId,
      };
      try {
        getChargeByIdLoader.clear(chargeId);
        const res = await updateCharge.run({ ...adjustedFields }, pool);
        return res[0];
      } catch (e) {
        return {
          __typename: 'CommonError',
          message:
            (e as Error)?.message ??
            (e as { errors: Error[] })?.errors.map(e => e.message).toString() ??
            'Unknown error',
        };
      }
    },
    updateLedgerRecord: async (_, { ledgerRecordId, fields }) => {
      const currency =
        fields.originalAmount?.currency || fields.localCurrencyAmount?.currency
          ? hashavshevetFormat.currency(fields.originalAmount?.currency ?? fields.localCurrencyAmount?.currency ?? '')
          : null;

      const adjustedFields: IUpdateLedgerRecordParams = {
        ledgerRecordId,
        business: null,
        creditAccount1: fields.creditAccount?.name ?? null,
        creditAccount2: null,
        creditAmount1: fields.localCurrencyAmount?.raw.toFixed(2) ?? null,
        creditAmount2: null,
        currency,
        date3: null,
        debitAccount1: fields.debitAccount?.name ?? null,
        debitAccount2: null,
        debitAmount1: fields.localCurrencyAmount?.raw.toFixed(2) ?? null,
        debitAmount2: null,
        details: fields.description ?? null,
        foreignCreditAmount1: fields.originalAmount?.raw.toFixed(2) ?? null,
        foreignCreditAmount2: null,
        foreignDebitAmount1: fields.originalAmount?.raw.toFixed(2) ?? null,
        foreignDebitAmount2: null,
        hashavshevetId: fields.hashavshevetId ?? null,
        invoiceDate: fields.date ? hashavshevetFormat.date(fields.date) : null,
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
          message: `Error executing updateLedgerRecord:\n${(e as Error)?.message ?? 'Unknown error'}`,
        };
      }
    },
    insertLedgerRecord: async (_, { chargeId, record }) => {
      try {
        const charge = await getChargeByIdLoader.load(chargeId);

        if (!charge) {
          throw new Error(`Charge ID='${chargeId}' not found`);
        }

        const financialAccount = await getFinancialAccountByAccountNumberLoader.load(charge.account_number);

        if (!financialAccount || !financialAccount.owner) {
          throw new Error(`Financial entity for charge ID='${chargeId}' not found`);
        }

        const currency =
          record.originalAmount?.currency || record.localCurrencyAmount?.currency
            ? hashavshevetFormat.currency(record.originalAmount?.currency ?? record.localCurrencyAmount?.currency ?? '')
            : null;

        const newLedgerRecord: IInsertLedgerRecordsParams['ledgerRecord']['0'] = {
          business: financialAccount.owner,
          creditAccount1: record.creditAccount?.name ?? null,
          creditAccount2: null,
          creditAmount1: record.localCurrencyAmount?.raw.toFixed(2) ?? null,
          creditAmount2: null,
          currency,
          date3: record.date3 ? hashavshevetFormat.date(record.date3) : null,
          debitAccount1: record.debitAccount?.name ?? null,
          debitAccount2: null,
          debitAmount1: record.localCurrencyAmount?.raw.toFixed(2) ?? null,
          debitAmount2: null,
          details: record.description ?? null,
          foreignCreditAmount1: record.originalAmount?.raw.toFixed(2) ?? null,
          foreignCreditAmount2: null,
          foreignDebitAmount1: record.originalAmount?.raw.toFixed(2) ?? null,
          foreignDebitAmount2: null,
          hashavshevetId: record.hashavshevetId ? Number(record.hashavshevetId) : null,
          invoiceDate: record.date ? hashavshevetFormat.date(record.date) : null,
          movementType: null,
          origin: 'manual',
          originalId: chargeId,
          proformaInvoiceFile: null,
          reference1: null,
          reference2: null,
          reviewed: record.accountantApproval?.approved ?? null,
          valueDate: record.valueDate ? hashavshevetFormat.date(record.valueDate) : null,
        };
        const res = await insertLedgerRecords.run({ ledgerRecord: [{ ...newLedgerRecord }] }, pool);

        if (!res || res.length === 0) {
          throw new Error(`Failed to insert ledger record to charge ID='${chargeId}'`);
        }

        /* clear cache */
        getLedgerRecordsByChargeIdLoader.clear(chargeId);

        return charge;
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Error inserting new ledger record:\n  ${(e as Error)?.message ?? 'Unknown error'}`,
        };
      }
    },
    deleteLedgerRecord: async (_, { ledgerRecordId }) => {
      const res = await deleteLedgerRecord.run({ ledgerRecordId }, pool);
      if (res.length === 1) {
        return true;
      }
      throw new GraphQLError(
        res.length === 0 ? 'Ledger record not found' : `More than one ledger records found and deleted: ${res}`
      );
    },
    toggleLedgerRecordAccountantApproval: async (_, { ledgerRecordId, approved }) => {
      const adjustedFields: IUpdateLedgerRecordParams = {
        ledgerRecordId,
        business: null,
        creditAccount1: null,
        creditAccount2: null,
        creditAmount1: null,
        creditAmount2: null,
        currency: null,
        date3: null,
        debitAccount1: null,
        debitAccount2: null,
        debitAmount1: null,
        debitAmount2: null,
        details: null,
        foreignCreditAmount1: null,
        foreignCreditAmount2: null,
        foreignDebitAmount1: null,
        foreignDebitAmount2: null,
        hashavshevetId: null,
        invoiceDate: null,
        movementType: null,
        origin: null,
        originalId: null,
        proformaInvoiceFile: null,
        reference1: null,
        reference2: null,
        reviewed: approved,
        valueDate: null,
      };
      const res = await updateLedgerRecord.run({ ...adjustedFields }, pool);

      if (!res || res.length === 0) {
        throw new Error(`Failed to update ledger record ID='${ledgerRecordId}'`);
      }

      /* clear cache */
      if (res[0].original_id) {
        getLedgerRecordsByChargeIdLoader.clear(res[0].original_id);
      }
      return res[0].reviewed || false;
    },
    insertDocument: async (_, { record }) => {
      try {
        if (record.chargeId) {
          const charge = await getChargeByIdLoader.load(record.chargeId);

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
        const res = await insertDocuments.run({ document: [{ ...newDocument }] }, pool);

        if (!res || res.length === 0) {
          throw new Error(`Failed to insert ledger record to charge ID='${record.chargeId}'`);
        }

        if (record.chargeId) {
          /* clear cache */
          getDocumentsByChargeIdLoader.clear(record.chargeId);
        }

        return { document: res[0] };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Error inserting new ledger record:\n  ${(e as Error)?.message ?? 'Unknown error'}`,
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
        // TODO: implement not-Ils logic. currently if vatCurrency is set and not to Ils, ignoring the update
        currentBalance:
          fields.balance?.currency && fields.balance.currency !== Currency.Ils ? null : fields.balance?.raw?.toFixed(2),
        debitDate: fields.effectiveDate ? new Date(fields.effectiveDate) : null,
        detailedBankDescription: null,
        // TODO: implement not-Ils logic. currently if vatCurrency is set and not to Ils, ignoring the update
        eventAmount:
          fields.amount?.currency && fields.amount.currency !== Currency.Ils ? null : fields.amount?.raw?.toFixed(2),
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
    generateLedgerRecords: async (_, { chargeId }) => {
      try {
        const charge = await getChargeByIdLoader.load(chargeId);
        if (!charge) {
          throw new Error(`Charge ID="${chargeId}" not found`);
        }
        if (!charge.account_number) {
          throw new Error(`Charge ID="${chargeId}" has no account number`);
        }
        const docs = await getDocumentsByChargeIdLoader.load(chargeId);
        const invoices = docs.filter(d => ['INVOICE', 'INVOICE_RECEIPT', 'RECEIPT'].includes(d.type ?? ''));
        if (invoices.length > 1) {
          console.log(`Charge ${chargeId} has more than one invoices: [${invoices.map(r => `"${r.id}"`).join(', ')}]`);
        }
        const mainInvoice = invoices.shift() ?? null;

        if (mainInvoice) {
          console.log(mainInvoice);
          charge.tax_invoice_date = mainInvoice.date;
          charge.tax_invoice_amount = mainInvoice.total_amount ? mainInvoice.total_amount.toString() : null;
          charge.tax_invoice_number = mainInvoice.serial_number;
        } else if (!ENTITIES_WITHOUT_ACCOUNTING.includes(charge.financial_entity ?? '')) {
          throw new Error(`Charge ID="${chargeId}" has no invoices`);
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
        if (charge.financial_entity == 'Isracard') {
          charge.tax_category = isracardHashIndex;
        } else {
          charge.tax_category = hashBusinessIndexes.auto_tax_category;
        }

        if (charge.account_type == 'creditcard' && charge.currency_code == 'ILS') {
          charge.debit_date = charge.event_date;
        }

        if (!charge.debit_date) {
          throw new Error(`Charge ID=${charge.id} has no debit date`);
        }
        const debitExchangeRates = await getExchangeRates(charge.debit_date);

        if (!charge.tax_invoice_date) {
          charge.tax_invoice_date = charge.debit_date;
        }
        const invoiceExchangeRates = await getExchangeRates(charge.tax_invoice_date);

        const decoratedCharge = decorateCharge(charge);

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
    createdAt: () => new Date('1900-01-01'), // TODO: missing in DB
    additionalDocuments: async DbCharge => {
      if (!DbCharge.id) {
        return [];
      }
      const docs = await getDocumentsByChargeIdLoader.load(DbCharge.id);
      return docs;
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
    tags: DbCharge => {
      const raw = DbCharge.personal_category;
      if (!raw) {
        return [];
      }
      try {
        return JSON.parse(DbCharge.personal_category!);
      } catch {
        null;
      }
      return [{ name: DbCharge.personal_category }];
    },
    beneficiaries: async DbCharge => {
      // TODO: update to better implementation after DB is updated
      try {
        if (DbCharge.financial_accounts_to_balance) {
          return JSON.parse(DbCharge.financial_accounts_to_balance);
        }
      } catch {
        null;
      }
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
    vat: DbCharge => (DbCharge.vat != null ? formatFinancialAmount(DbCharge.vat, DbCharge.currency_code) : null),
    withholdingTax: DbCharge =>
      DbCharge.withholding_tax != null ? formatFinancialAmount(DbCharge.withholding_tax, DbCharge.currency_code) : null,
    totalAmount: DbCharge =>
      DbCharge.event_amount != null ? formatFinancialAmount(DbCharge.event_amount, DbCharge.currency_code) : null,
    invoice: async DbCharge => {
      if (!DbCharge.id) {
        return null;
      }
      const docs = await getDocumentsByChargeIdLoader.load(DbCharge.id);
      const invoices = docs.filter(d => ['INVOICE', 'INVOICE_RECEIPT'].includes(d.type ?? ''));
      if (invoices.length > 1) {
        console.log(`Charge ${DbCharge.id} has more than one invoices: [${invoices.map(r => `"${r.id}"`).join(', ')}]`);
      }
      return invoices.shift() ?? null;
    },
    receipt: async DbCharge => {
      if (!DbCharge.id) {
        return null;
      }
      const docs = await getDocumentsByChargeIdLoader.load(DbCharge.id);
      const receipts = docs.filter(d => ['RECEIPT', 'INVOICE_RECEIPT'].includes(d.type ?? ''));
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
  UpdateLedgerRecordResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'LedgerRecord';
    },
  },
  UpdateChargeResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'Charge';
    },
  },
  InsertLedgerRecordResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'Charge';
    },
  },
  GenerateLedgerRecordsResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'Charge';
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
  LedgerRecord: {
    id: DbLedgerRecord => DbLedgerRecord.id,
    creditAccount: DbLedgerRecord => DbLedgerRecord.credit_account_1,
    debitAccount: DbLedgerRecord => DbLedgerRecord.debit_account_1,
    originalAmount: DbLedgerRecord =>
      formatFinancialAmount(
        DbLedgerRecord.foreign_debit_amount_1 ?? DbLedgerRecord.debit_amount_1,
        DbLedgerRecord.currency
      ),
    date: DbLedgerRecord => parseDate(DbLedgerRecord.invoice_date) as TimelessDateString,
    description: DbLedgerRecord => DbLedgerRecord.details ?? '',
    accountantApproval: DbLedgerRecord => ({
      approved: DbLedgerRecord.reviewed ?? false,
      remark: 'Missing', // TODO: missing in DB
    }),
    localCurrencyAmount: DbLedgerRecord => formatFinancialAmount(DbLedgerRecord.debit_amount_1, null),
    hashavshevetId: DbLedgerRecord => DbLedgerRecord.hashavshevet_id,
  },
  NamedCounterparty: {
    __isTypeOf: parent => !!parent,
    name: parent => parent ?? '',
  },
  BeneficiaryCounterparty: {
    // TODO: improve counterparty handle
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
  TimelessDate: TimelessDateScalar,
};
