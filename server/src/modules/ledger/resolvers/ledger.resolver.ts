import { GraphQLError } from 'graphql';
import { ChargesProvider } from 'modules/charges/providers/charges.provider.js';
import { DocumentsProvider } from 'modules/documents/providers/documents.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import {
  generateEntryForAccountingValues,
  generateEntryForExchangeRatesDifferenceValues,
  generateEntryForFinancialAccountValues,
  generateEntryForforeignTransferFeesValues,
  hashavshevetFormat,
  parseDate,
} from '@modules/hashavshevet/helpers/hashavshevet.helper.js';
import { HashavshevetProvider } from '@modules/hashavshevet/providers/hashavshevet.provider.js';
import { ENTITIES_WITHOUT_ACCOUNTING } from '@shared/constants';
import { formatAmount, formatCurrency, formatFinancialAmount } from '@shared/helpers';
import type { TimelessDateString } from '@shared/types';
import { getILSForDate } from '../helpers/exchange.helper.js';
import { buildLedgerEntries, decorateCharge } from '../helpers/generation.helper.js';
import { ExchangeProvider } from '../providers/exchange.provider.js';
import { LedgerProvider } from '../providers/ledger.provider.js';
import type {
  IInsertLedgerRecordsParams,
  IInsertLedgerRecordsResult,
  IUpdateLedgerRecordParams,
  LedgerModule,
} from '../types.js';

export const ledgerResolvers: LedgerModule.Resolvers = {
  Mutation: {
    updateLedgerRecord: async (_, { ledgerRecordId, fields }, { injector }) => {
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
        const res = await injector.get(LedgerProvider).updateLedgerRecord({ ...adjustedFields });

        if (!res || res.length === 0) {
          throw new Error(`Failed to update ledger record ID='${ledgerRecordId}'`);
        }

        /* clear cache */
        if (res[0].original_id) {
          injector.get(LedgerProvider).getLedgerRecordsByChargeIdLoader.clear(res[0].original_id);
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
    insertLedgerRecord: async (_, { chargeId, record }, { injector }) => {
      try {
        const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);

        if (!charge) {
          throw new Error(`Charge ID='${chargeId}' not found`);
        }

        const financialAccount = await injector
          .get(FinancialAccountsProvider)
          .getFinancialAccountByAccountNumberLoader.load(charge.account_number);

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
        const res = await injector
          .get(LedgerProvider)
          .insertLedgerRecords({ ledgerRecord: [{ ...newLedgerRecord }] });

        if (!res || res.length === 0) {
          throw new Error(`Failed to insert ledger record to charge ID='${chargeId}'`);
        }

        /* clear cache */
        injector.get(LedgerProvider).getLedgerRecordsByChargeIdLoader.clear(chargeId);

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
    updateDbLedgerRecord: async (_, { ledgerRecordId, fields }, { injector }) => {
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
        const res = await injector.get(LedgerProvider).updateLedgerRecord({ ...adjustedFields });

        if (!res || res.length === 0) {
          throw new Error(`Failed to update ledger record ID='${ledgerRecordId}'`);
        }

        /* clear cache */
        if (res[0].original_id) {
          injector.get(LedgerProvider).getLedgerRecordsByChargeIdLoader.clear(res[0].original_id);
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
    insertDbLedgerRecord: async (_, { chargeId, record }, { injector }) => {
      /* TEMPORARY: this is a temporary solution to insert a ledger record to the DB. */
      try {
        const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);

        if (!charge) {
          throw new Error(`Charge ID='${chargeId}' not found`);
        }

        const financialAccount = await injector
          .get(FinancialAccountsProvider)
          .getFinancialAccountByAccountNumberLoader.load(charge.account_number);

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
        const res = await injector
          .get(LedgerProvider)
          .insertLedgerRecords({ ledgerRecord: [{ ...newLedgerRecord }] });

        if (!res || res.length === 0) {
          throw new Error(`Failed to insert ledger record to charge ID='${chargeId}'`);
        }

        /* clear cache */
        injector.get(LedgerProvider).getLedgerRecordsByChargeIdLoader.clear(chargeId);

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
    deleteLedgerRecord: async (_, { ledgerRecordId }, { injector }) => {
      const res = await injector.get(LedgerProvider).deleteLedgerRecord({ ledgerRecordId });
      if (res.length === 1) {
        return true;
      }
      throw new GraphQLError(
        res.length === 0
          ? 'Ledger record not found'
          : `More than one ledger records found and deleted: ${res}`,
      );
    },
    generateLedgerRecords: async (_, { chargeId }, { injector }) => {
      try {
        const charge = await injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
        if (!charge) {
          throw new Error(`Charge ID="${chargeId}" not found`);
        }
        if (!charge.account_number) {
          throw new Error(`Charge ID="${chargeId}" has no account number`);
        }
        const docs = await injector
          .get(DocumentsProvider)
          .getDocumentsByChargeIdLoader.load(chargeId);
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

        const account = await injector
          .get(FinancialAccountsProvider)
          .getFinancialAccountByAccountNumberLoader.load(charge.account_number);
        if (!account) {
          throw new Error(`Account number="${charge.account_number}" not found`);
        }

        if (!account.owner) {
          throw new Error(`Account number="${charge.account_number}" has no owner`);
        }
        const owner = await injector
          .get(FinancialEntitiesProvider)
          .getFinancialEntityByIdLoader.load(account.owner);
        if (!owner) {
          throw new Error(`FinancialEntity ID="${charge.account_number}" not found`);
        }

        const [hashBusinessIndexes] = await injector
          .get(HashavshevetProvider)
          .getHashavshevetBusinessIndexesByName({
            financialEntityName: charge.financial_entity,
            ownerId: owner.id,
          });
        const hashVATIndexes = await injector
          .get(HashavshevetProvider)
          .getHashavshevetVatIndexes(owner.id);
        const isracardHashIndex = await injector
          .get(HashavshevetProvider)
          .getHashavshevetIsracardIndex(charge);
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
        const debitExchangeRates = await injector
          .get(ExchangeProvider)
          .getExchangeRates(charge.debit_date);

        charge.tax_invoice_date ||= charge.debit_date;
        const invoiceExchangeRates = await injector
          .get(ExchangeProvider)
          .getExchangeRates(charge.tax_invoice_date);

        const decoratedCharge = decorateCharge(charge);

        const { entryForFinancialAccount, entryForAccounting } = await buildLedgerEntries(
          injector,
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
            const updateResult = await injector
              .get(LedgerProvider)
              .insertLedgerRecords({ ledgerRecord: [entryForAccountingValues] });
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
          await injector.get(ChargesProvider).getConversionOtherSide({
            chargeId: decoratedCharge.id,
            bankReference: decoratedCharge.bank_reference,
          })
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
          const updateResult = await injector
            .get(LedgerProvider)
            .insertLedgerRecords({ ledgerRecord: [entryForFinancialAccountValues] });
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
            const updateResult = await injector.get(LedgerProvider).insertLedgerRecords({
              ledgerRecord: [entryForgenerateEntryForforeignTransferFeesValues],
            });
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
            const updateResult = await injector
              .get(LedgerProvider)
              .insertLedgerRecords({ ledgerRecord: [entryForExchangeRatesDifferenceValues] });
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
            const updateResult = await injector
              .get(LedgerProvider)
              .insertLedgerRecords({ ledgerRecord: [entryForExchangeRatesDifferenceValues] });
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
  // UpdateLedgerRecordResult: {
  //   __resolveType: (obj, _context, _info) => {
  //     if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
  //     return 'LedgerRecord';
  //   },
  // },
  // InsertLedgerRecordResult: {
  //   __resolveType: (obj, _context, _info) => {
  //     if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
  //     return 'Charge';
  //   },
  // },
  // GenerateLedgerRecordsResult: {
  //   __resolveType: (obj, _context, _info) => {
  //     if ('__typename' in obj && obj.__typename === 'CommonError') return 'CommonError';
  //     return 'Charge';
  //   },
  // },
  LedgerRecord: {
    id: DbLedgerRecord => DbLedgerRecord.id,
    originalAmount: DbLedgerRecord =>
      formatFinancialAmount(
        DbLedgerRecord.foreign_debit_amount_1 ?? DbLedgerRecord.debit_amount_1,
        DbLedgerRecord.currency,
      ),
    date: DbLedgerRecord => parseDate(DbLedgerRecord.invoice_date) as TimelessDateString,
    valueDate: DbLedgerRecord => parseDate(DbLedgerRecord.value_date) as TimelessDateString,
    date3: DbLedgerRecord => parseDate(DbLedgerRecord.date_3) as TimelessDateString,
    description: DbLedgerRecord => DbLedgerRecord.details ?? '',
    localCurrencyAmount: DbLedgerRecord =>
      formatFinancialAmount(DbLedgerRecord.debit_amount_1, null),

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
  Charge: {
    ledgerRecords: async (DbCharge, _, { injector }) => {
      if (!DbCharge.id) {
        return [];
      }
      const records = await injector
        .get(LedgerProvider)
        .getLedgerRecordsByChargeIdLoader.load(DbCharge.id);
      return records;
    },
  },
};
