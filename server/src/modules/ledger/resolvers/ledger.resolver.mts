import {
  IInsertLedgerRecordsParams,
  IInsertLedgerRecordsResult,
  IUpdateLedgerRecordParams,
} from '../../../__generated__/ledger-records.types.mjs';
import { Resolvers } from '../../../__generated__/types.mjs';
import { formatAmount, formatCurrency, formatFinancialAmount } from '../../../helpers/amount.mjs';
import { ENTITIES_WITHOUT_ACCOUNTING } from '../../../helpers/constants.mjs';
import { getILSForDate } from '../../../helpers/exchange.mjs';
import {
  generateEntryForAccountingValues,
  generateEntryForExchangeRatesDifferenceValues,
  generateEntryForFinancialAccountValues,
  generateEntryForforeignTransferFeesValues,
  hashavshevetFormat,
  parseDate,
} from '../../../helpers/hashavshevet.mjs';
import { buildLedgerEntries, decorateCharge } from '../../../helpers/misc.mjs';
import { TimelessDateString } from '../../../models/index.mjs';
import { getChargeByIdLoader, getConversionOtherSide } from '../../../providers/charges.mjs';
import { pool } from '../../../providers/db.mjs';
import { getDocumentsByChargeIdLoader } from '../../../providers/documents.mjs';
import { getExchangeRates } from '../../../providers/exchange.mjs';
import { getFinancialAccountByAccountNumberLoader } from '../../../providers/financial-accounts.mjs';
import { getFinancialEntityByIdLoader } from '../../../providers/financial-entities.mjs';
import {
  getHashavshevetBusinessIndexes,
  getHashavshevetIsracardIndex,
  getHashavshevetVatIndexes,
} from '../../../providers/hashavshevet.mjs';
import {
  deleteLedgerRecord,
  getLedgerRecordsByChargeIdLoader,
  insertLedgerRecords,
  updateLedgerRecord,
} from '../../../providers/ledger-records.mjs';
import { GraphQLError } from 'graphql';

export const ledgerResolvers: Resolvers = {
  Mutation: {
    updateLedgerRecord: async (_, { ledgerRecordId, fields }) => {
      const currency =
        fields.originalAmount?.currency || fields.localCurrencyAmount?.currency
          ? hashavshevetFormat.currency(
              fields.originalAmount?.currency ?? fields.localCurrencyAmount?.currency ?? '',
            )
          : null;

      const adjustedFields: IUpdateLedgerRecordParams = {
        ledgerRecordId,
        business: null,
        creditAccount1: fields.creditAccount?.name ?? null,
        creditAccount2: null,
        creditAmount1: fields.localCurrencyAmount?.raw.toFixed(2) ?? null,
        creditAmount2: null,
        currency,
        date3: fields.date3 ? hashavshevetFormat.date(fields.date3) : null, // Temporary. this field shouldn't exist
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
        valueDate: fields.valueDate ? hashavshevetFormat.date(fields.valueDate) : null, // Temporary. this field shouldn't exist
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
          message: `Error executing updateLedgerRecord:\n${
            (e as Error)?.message ?? 'Unknown error'
          }`,
        };
      }
    },
    insertLedgerRecord: async (_, { chargeId, record }) => {
      try {
        const charge = await getChargeByIdLoader.load(chargeId);

        if (!charge) {
          throw new Error(`Charge ID='${chargeId}' not found`);
        }

        const financialAccount = await getFinancialAccountByAccountNumberLoader.load(
          charge.account_number,
        );

        if (!financialAccount?.owner) {
          throw new Error(`Financial entity for charge ID='${chargeId}' not found`);
        }

        const currency =
          record.originalAmount?.currency || record.localCurrencyAmount?.currency
            ? hashavshevetFormat.currency(
                record.originalAmount?.currency ?? record.localCurrencyAmount?.currency ?? '',
              )
            : null;

        const newLedgerRecord: IInsertLedgerRecordsParams['ledgerRecord']['0'] = {
          business: financialAccount.owner,
          creditAccount1: record.creditAccount?.name ?? null,
          creditAccount2: null,
          creditAmount1: record.localCurrencyAmount?.raw.toFixed(2) ?? null,
          creditAmount2: null,
          currency,
          date3: record.date3 ? hashavshevetFormat.date(record.date3) : null, // Temporary. this field shouldn't exist
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
          valueDate: record.valueDate ? hashavshevetFormat.date(record.valueDate) : null, // Temporary. this field shouldn't exist
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
          message: `Error inserting new ledger record:\n  ${
            (e as Error)?.message ?? 'Unknown error'
          }`,
        };
      }
    },
    updateDbLedgerRecord: async (_, { ledgerRecordId, fields }) => {
      /* TEMPORARY: this is a temporary solution to update the ledger record in the DB. */
      const adjustedFields: IUpdateLedgerRecordParams = {
        ledgerRecordId,
        business: null,
        creditAccount1: fields.credit_account_1 ?? null,
        creditAccount2: fields.credit_account_2 ?? null,
        creditAmount1: Number.isNaN(fields.credit_amount_1)
          ? null
          : fields.credit_amount_1?.toFixed(2),
        creditAmount2: Number.isNaN(fields.credit_amount_2)
          ? null
          : fields.credit_amount_2?.toFixed(2),
        currency: fields.currency ? hashavshevetFormat.currency(fields.currency) : null,
        date3: fields.date3 ? hashavshevetFormat.date(fields.date3) : null,
        debitAccount1: fields.debit_account_1 ?? null,
        debitAccount2: fields.debit_account_2 ?? null,
        debitAmount1: Number.isNaN(fields.debit_amount_1)
          ? null
          : fields.debit_amount_1?.toFixed(2),
        debitAmount2: Number.isNaN(fields.debit_amount_2)
          ? null
          : fields.debit_amount_2?.toFixed(2),
        details: fields.details ?? null,
        foreignCreditAmount1: Number.isNaN(fields.foreign_credit_amount_1)
          ? null
          : fields.foreign_credit_amount_1?.toFixed(2),
        foreignCreditAmount2: Number.isNaN(fields.foreign_credit_amount_2)
          ? null
          : fields.foreign_credit_amount_2?.toFixed(2),
        foreignDebitAmount1: Number.isNaN(fields.foreign_debit_amount_1)
          ? null
          : fields.foreign_debit_amount_1?.toFixed(2),
        foreignDebitAmount2: Number.isNaN(fields.foreign_debit_amount_2)
          ? null
          : fields.foreign_debit_amount_2?.toFixed(2),
        hashavshevetId: Number.isInteger(fields.hashavshevet_id) ? fields.hashavshevet_id : null,
        invoiceDate: fields.invoice_date
          ? hashavshevetFormat.date(new Date(fields.invoice_date))
          : null,
        movementType: fields.movement_type ?? null,
        origin: null,
        originalId: null,
        proformaInvoiceFile: null,
        reference1: fields.reference_1 ?? null,
        reference2: fields.reference_2 ?? null,
        reviewed: fields.reviewed ?? false,
        valueDate: fields.value_date ? hashavshevetFormat.date(new Date(fields.value_date)) : null,
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
          message: `Error executing updateLedgerRecord:\n${
            (e as Error)?.message ?? 'Unknown error'
          }`,
        };
      }
    },
    insertDbLedgerRecord: async (_, { chargeId, record }) => {
      /* TEMPORARY: this is a temporary solution to insert a ledger record to the DB. */
      try {
        const charge = await getChargeByIdLoader.load(chargeId);

        if (!charge) {
          throw new Error(`Charge ID='${chargeId}' not found`);
        }

        const financialAccount = await getFinancialAccountByAccountNumberLoader.load(
          charge.account_number,
        );

        if (!financialAccount?.owner) {
          throw new Error(`Financial entity for charge ID='${chargeId}' not found`);
        }

        const newLedgerRecord: IInsertLedgerRecordsParams['ledgerRecord']['0'] = {
          business: financialAccount.owner,
          creditAccount1: record.credit_account_1 ?? null,
          creditAccount2: record.credit_account_2 ?? null,
          creditAmount1: Number.isNaN(record.credit_amount_1)
            ? null
            : record.credit_amount_1?.toFixed(2),
          creditAmount2: Number.isNaN(record.credit_amount_2)
            ? null
            : record.credit_amount_2?.toFixed(2),
          currency: hashavshevetFormat.currency(record.currency ?? ''),
          date3: record.date3 ? hashavshevetFormat.date(record.date3) : null,
          debitAccount1: record.debit_account_1 ?? null,
          debitAccount2: record.debit_account_2 ?? null,
          debitAmount1: Number.isNaN(record.debit_amount_1)
            ? null
            : record.debit_amount_1?.toFixed(2),
          debitAmount2: Number.isNaN(record.debit_amount_2)
            ? null
            : record.debit_amount_2?.toFixed(2),
          details: record.details ?? null,
          foreignCreditAmount1: Number.isNaN(record.foreign_credit_amount_1)
            ? null
            : record.foreign_credit_amount_1?.toFixed(2),
          foreignCreditAmount2: Number.isNaN(record.foreign_credit_amount_2)
            ? null
            : record.foreign_credit_amount_2?.toFixed(2),
          foreignDebitAmount1: Number.isNaN(record.foreign_debit_amount_1)
            ? null
            : record.foreign_debit_amount_1?.toFixed(2),
          foreignDebitAmount2: Number.isNaN(record.foreign_debit_amount_2)
            ? null
            : record.foreign_debit_amount_2?.toFixed(2),
          hashavshevetId: Number.isInteger(record.hashavshevet_id) ? record.hashavshevet_id : null,
          invoiceDate: record.invoice_date
            ? hashavshevetFormat.date(new Date(record.invoice_date))
            : null,
          movementType: record.movement_type ?? null,
          origin: 'manual',
          originalId: chargeId,
          proformaInvoiceFile: null,
          reference1: record.reference_1 ?? null,
          reference2: record.reference_2 ?? null,
          reviewed: record.reviewed ?? false,
          valueDate: record.value_date
            ? hashavshevetFormat.date(new Date(record.value_date))
            : null,
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
          message: `Error inserting new ledger record:\n  ${
            (e as Error)?.message ?? 'Unknown error'
          }`,
        };
      }
    },
    deleteLedgerRecord: async (_, { ledgerRecordId }) => {
      const res = await deleteLedgerRecord.run({ ledgerRecordId }, pool);
      if (res.length === 1) {
        return true;
      }
      throw new GraphQLError(
        res.length === 0
          ? 'Ledger record not found'
          : `More than one ledger records found and deleted: ${res}`,
      );
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
        let docTypes = ['INVOICE', 'INVOICE_RECEIPT', 'RECEIPT'];
        if (parseFloat(charge.event_amount) > 0) {
          docTypes = ['INVOICE', 'INVOICE_RECEIPT'];
        }
        const invoices = docs.filter(d => docTypes.includes(d.type ?? ''));
        if (invoices.length > 1) {
          console.log(
            `Charge ${chargeId} has more than one invoices: [${invoices
              .map(r => `"${r.id}"`)
              .join(', ')}]`,
          );
        }
        const mainInvoice = invoices.shift() ?? null;

        if (mainInvoice) {
          console.log(mainInvoice);
          charge.tax_invoice_date = mainInvoice.date;
          charge.tax_invoice_amount = mainInvoice.total_amount
            ? mainInvoice.total_amount.toString()
            : null;
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
          pool,
        );
        const hashVATIndexes = await getHashavshevetVatIndexes(owner.id);
        const isracardHashIndex = await getHashavshevetIsracardIndex(charge);
        if (charge.financial_entity == 'Isracard') {
          charge.tax_category = isracardHashIndex;
        } else if (!ENTITIES_WITHOUT_ACCOUNTING.includes(charge.financial_entity ?? '')) {
          charge.tax_category = hashBusinessIndexes.auto_tax_category;
        }

        if (charge.account_type == 'creditcard' && charge.currency_code == 'ILS') {
          charge.debit_date = charge.event_date;
        }

        if (!charge.debit_date) {
          throw new Error(`Charge ID=${charge.id} has no debit date`);
        }
        const debitExchangeRates = await getExchangeRates(charge.debit_date);

        charge.tax_invoice_date ||= charge.debit_date;
        const invoiceExchangeRates = await getExchangeRates(charge.tax_invoice_date);

        const decoratedCharge = decorateCharge(charge);

        const { entryForFinancialAccount, entryForAccounting } = await buildLedgerEntries(
          decoratedCharge,
          parseFloat(charge.event_amount),
          hashVATIndexes,
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
              owner,
            );
            const updateResult = await insertLedgerRecords.run(
              { ledgerRecord: [entryForAccountingValues] },
              pool,
            );
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
            pool,
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
            conversionOtherSide,
          );
          const updateResult = await insertLedgerRecords.run(
            { ledgerRecord: [entryForFinancialAccountValues] },
            pool,
          );
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
          !charge.vat &&
          charge.tax_invoice_amount &&
          parseFloat(charge.tax_invoice_amount) != parseFloat(charge.event_amount)
        ) {
          console.log('עמלת העברת מטח');
          try {
            const entryForgenerateEntryForforeignTransferFeesValues =
              generateEntryForforeignTransferFeesValues(
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
                invoiceExchangeRates,
              );
            const updateResult = await insertLedgerRecords.run(
              { ledgerRecord: [entryForgenerateEntryForforeignTransferFeesValues] },
              pool,
            );
            if (updateResult.length === 0) {
              throw new Error('Failed to insert foreign transfer fees record');
            }
            console.log(JSON.stringify(updateResult[0]));
            createdLedgerRecords.push(updateResult[0]);
          } catch (error) {
            // TODO: Log important checks
            throw new Error(`error in foreign transfer fees insert - ${error}`);
          }
        } else if (
          charge.tax_invoice_currency &&
          entryForFinancialAccount.debitAmountILS != entryForAccounting.debitAmountILS
        ) {
          console.log('שערררררררר של different currencies');
          try {
            const entryForExchangeRatesDifferenceValues =
              generateEntryForExchangeRatesDifferenceValues(
                decoratedCharge,
                entryForFinancialAccount,
                entryForAccounting,
                account,
                hashBusinessIndexes,
                hashVATIndexes,
                isracardHashIndex,
                owner,
              );
            const updateResult = await insertLedgerRecords.run(
              { ledgerRecord: [entryForExchangeRatesDifferenceValues] },
              pool,
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
            const entryForExchangeRatesDifferenceValues =
              generateEntryForExchangeRatesDifferenceValues(
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
                invoiceExchangeRates,
              );
            const updateResult = await insertLedgerRecords.run(
              { ledgerRecord: [entryForExchangeRatesDifferenceValues] },
              pool,
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
  UpdateLedgerRecordResult: {
    __resolveType: (obj, _context, _info) => {
      if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
      return 'LedgerRecord';
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
  LedgerRecord: {
    id: DbLedgerRecord => DbLedgerRecord.id,
    creditAccount: DbLedgerRecord => DbLedgerRecord.credit_account_1,
    debitAccount: DbLedgerRecord => DbLedgerRecord.debit_account_1,
    originalAmount: DbLedgerRecord =>
      formatFinancialAmount(
        DbLedgerRecord.foreign_debit_amount_1 ?? DbLedgerRecord.debit_amount_1,
        DbLedgerRecord.currency,
      ),
    date: DbLedgerRecord => parseDate(DbLedgerRecord.invoice_date) as TimelessDateString,
    valueDate: DbLedgerRecord => parseDate(DbLedgerRecord.value_date) as TimelessDateString,
    date3: DbLedgerRecord => parseDate(DbLedgerRecord.date_3) as TimelessDateString,
    description: DbLedgerRecord => DbLedgerRecord.details ?? '',
    accountantApproval: DbLedgerRecord => ({
      approved: DbLedgerRecord.reviewed ?? false,
      remark: 'Missing', // TODO: missing in DB
    }),
    localCurrencyAmount: DbLedgerRecord =>
      formatFinancialAmount(DbLedgerRecord.debit_amount_1, null),
    hashavshevetId: DbLedgerRecord => DbLedgerRecord.hashavshevet_id,

    /* next fields are temporary, to resemble the DB entity */
    credit_account_1: DbLedgerRecord => DbLedgerRecord.credit_account_1,
    credit_account_2: DbLedgerRecord => DbLedgerRecord.credit_account_2,
    credit_amount_1: DbLedgerRecord => formatAmount(DbLedgerRecord.credit_amount_1),
    credit_amount_2: DbLedgerRecord => formatAmount(DbLedgerRecord.credit_amount_2),
    currency: DbLedgerRecord => formatCurrency(DbLedgerRecord.currency),
    debit_account_1: DbLedgerRecord => DbLedgerRecord.debit_account_1,
    debit_account_2: DbLedgerRecord => DbLedgerRecord.debit_account_2,
    debit_amount_1: DbLedgerRecord => formatAmount(DbLedgerRecord.debit_amount_1),
    debit_amount_2: DbLedgerRecord => formatAmount(DbLedgerRecord.debit_amount_2),
    details: DbLedgerRecord => DbLedgerRecord.details,
    foreign_credit_amount_1: DbLedgerRecord => formatAmount(DbLedgerRecord.foreign_credit_amount_1),
    foreign_credit_amount_2: DbLedgerRecord => formatAmount(DbLedgerRecord.foreign_credit_amount_2),
    foreign_debit_amount_1: DbLedgerRecord => formatAmount(DbLedgerRecord.foreign_debit_amount_1),
    foreign_debit_amount_2: DbLedgerRecord => formatAmount(DbLedgerRecord.foreign_debit_amount_2),
    hashavshevet_id: DbLedgerRecord => DbLedgerRecord.hashavshevet_id,
    invoice_date: DbLedgerRecord => parseDate(DbLedgerRecord.invoice_date) as TimelessDateString,
    movement_type: DbLedgerRecord => DbLedgerRecord.movement_type,
    reference_1: DbLedgerRecord => DbLedgerRecord.reference_1,
    reference_2: DbLedgerRecord => DbLedgerRecord.reference_2,
    reviewed: DbLedgerRecord => DbLedgerRecord.reviewed,
    value_date: DbLedgerRecord => parseDate(DbLedgerRecord.value_date) as TimelessDateString,
  },
};
