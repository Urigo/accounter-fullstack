import { formatFinancialAmount } from '../../../helpers/amount.mjs';
import { ENTITIES_WITHOUT_ACCOUNTING } from '../../../helpers/constants.mjs';
import { getILSForDate } from '../../../helpers/exchange.mjs';
import {
  generateEntryForAccountingValues,
  generateEntryForExchangeRatesDifferenceValues,
  generateEntryForFinancialAccountValues,
  hashavshevetFormat,
  parseDate,
} from '../../../helpers/hashavshevet.mjs';
import { decorateCharge } from '../../../helpers/misc.mjs';
import { ChargesProvider } from '../../charges/providers/charges.provider.mjs';
import { FinancialAccountsProvider } from '../../financial-accounts/providers/financial-accounts.providers.mjs';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.mjs';
import { HashavshevetProvider } from '../../hashavshevet/providers/hashavshevet.provider.mjs';
import { ExchangeProvider } from '../../providers/exchange.providers.mjs';
import { LedgerRecordsModule } from '../generated-types/graphql';
import {
  IInsertLedgerRecordsParams,
  IInsertLedgerRecordsResult,
  IUpdateLedgerRecordParams,
} from '../generated-types/ledger-records.provider.types.mjs';
import { GenerateLedgerRecordsProvider } from '../providers/generate-ledger-records.provider.mjs';
import { LedgerRecordsProvider } from '../providers/ledger-records.provider.mjs';

export const resolvers: LedgerRecordsModule.Resolvers = {
  Mutation: {
    updateLedgerRecord: async (_, { ledgerRecordId, fields }, { injector }) => {
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
        const res = await injector.get(LedgerRecordsProvider).updateLedgerRecord({ ...adjustedFields });

        if (!res || res.length === 0) {
          throw new Error(`Failed to update ledger record ID='${ledgerRecordId}'`);
        }

        /* clear cache */
        if (res[0].original_id) {
          injector.get(LedgerRecordsProvider).getLedgerRecordsByChargeIdLoader.clear(res[0].original_id);
        }
        return { __typename: 'LedgerRecord', ...res[0] };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Error executing updateLedgerRecord:\n${(e as Error)?.message ?? 'Unknown error'}`,
        };
      }
    },
    insertLedgerRecord: async (_, { chargeId, record }, { injector }) => {
      try {
        const charge = await injector.get(LedgerRecordsProvider).getChargeByIdLoader.load(chargeId);

        if (!charge) {
          throw new Error(`Charge ID='${chargeId}' not found`);
        }

        const financialAccount = await injector
          .get(FinancialAccountsProvider)
          .getFinancialAccountByAccountNumberLoader.load(charge.account_number);

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
        const res = await injector
          .get(LedgerRecordsProvider)
          .insertLedgerRecords({ ledgerRecord: [{ ...newLedgerRecord }] });

        if (!res || res.length === 0) {
          throw new Error(`Failed to insert ledger record to charge ID='${chargeId}'`);
        }

        /* clear cache */
        injector.get(LedgerRecordsProvider).getLedgerRecordsByChargeIdLoader.clear(chargeId);

        return { __typename: 'Charge', ...charge };
      } catch (e) {
        return {
          __typename: 'CommonError',
          message: `Error inserting new ledger record:\n  ${(e as Error)?.message ?? 'Unknown error'}`,
        };
      }
    },
    generateLedgerRecords: async (_, { chargeId }, { injector }) => {
      try {
        const charge = await injector.get(LedgerRecordsProvider).getChargeByIdLoader.load(chargeId);
        if (!charge) {
          throw new Error(`Charge ID="${chargeId}" not found`);
        }
        if (!charge.account_number) {
          throw new Error(`Charge ID="${chargeId}" has no account number`);
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
        const owner = await injector.get(FinancialEntitiesProvider).getFinancialEntityByIdLoader.load(account.owner);
        if (!owner) {
          throw new Error(`FinancialEntity ID="${charge.account_number}" not found`);
        }

        const [hashBusinessIndexes] = await injector
          .get(HashavshevetProvider)
          .getHashavshevetBusinessIndexes({ financialEntityName: charge.financial_entity, ownerId: owner.id });
        const hashVATIndexes = await injector.get(HashavshevetProvider).getHashavshevetVatIndexes(owner.id);
        const isracardHashIndex = await injector.get(HashavshevetProvider).getHashavshevetIsracardIndex(charge);
        const { debitExchangeRates, invoiceExchangeRates } = await injector
          .get(ExchangeProvider)
          .getChargeExchangeRates(charge);

        const decoratedCharge = decorateCharge(charge, hashBusinessIndexes.auto_tax_category);

        const { entryForFinancialAccount, entryForAccounting } = await injector
          .get(GenerateLedgerRecordsProvider)
          .buildLedgerEntries(decoratedCharge, parseFloat(charge.event_amount), hashVATIndexes);

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
            const updateResult = await injector
              .get(LedgerRecordsProvider)
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
          await injector
            .get(ChargesProvider)
            .getConversionOtherSide({ chargeId: decoratedCharge.id, bankReference: decoratedCharge.bank_reference })
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
          const updateResult = await injector
            .get(LedgerRecordsProvider)
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
            const updateResult = await injector
              .get(LedgerRecordsProvider)
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
            const updateResult = await injector
              .get(LedgerRecordsProvider)
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
        return { __typename: 'Charge', ...charge };
      } catch (e) {
        console.error(e);
        return {
          __typename: 'CommonError',
          message: (e as Error)?.message ?? 'Unknown error',
        };
      }
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
    date: DbLedgerRecord => parseDate(DbLedgerRecord.invoice_date),
    description: DbLedgerRecord => DbLedgerRecord.details ?? '',
    localCurrencyAmount: DbLedgerRecord => formatFinancialAmount(DbLedgerRecord.debit_amount_1, null),
  },
  Charge: {
    ledgerRecords: async (DbCharge, _, { injector }) => {
      if (!DbCharge.id) {
        return [];
      }
      const records = await injector.get(LedgerRecordsProvider).getLedgerRecordsByChargeIdLoader.load(DbCharge.id);
      return records;
    },
  },
};
