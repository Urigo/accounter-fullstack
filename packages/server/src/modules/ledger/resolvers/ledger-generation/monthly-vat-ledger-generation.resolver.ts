import { format } from 'date-fns';
import { GraphQLError } from 'graphql';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { RawVatReportRecord } from '@modules/reports/helpers/vat-report.helper.js';
import { getVatRecords } from '@modules/reports/resolvers/get-vat-records.resolver.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import {
  BALANCE_CANCELLATION_TAX_CATEGORY_ID,
  DEFAULT_LOCAL_CURRENCY,
  INPUT_VAT_TAX_CATEGORY_ID,
  OUTPUT_VAT_TAX_CATEGORY_ID,
  VAT_BUSINESS_ID,
} from '@shared/constants';
import type { Maybe, ResolverFn, ResolversParentTypes, ResolversTypes } from '@shared/gql-types';
import { getMonthFromDescription } from '@shared/helpers';
import type { LedgerProto, TimelessDateString } from '@shared/types';
import { getVatDataFromVatReportRecords } from '../../helpers/monthly-vat-ledger-generation.helper.js';
import {
  generatePartialLedgerEntry,
  getLedgerBalanceInfo,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionRequiredVariables,
} from '../../helpers/utils.helper.js';

export const generateLedgerRecordsForMonthlyVat: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  GraphQLModules.Context,
  object
> = async (charge, _, context, __) => {
  const { injector } = context;
  const chargeId = charge.id;

  try {
    // figure out VAT month
    const transactionDate =
      charge.transactions_min_debit_date ?? charge.transactions_min_event_date ?? undefined;
    if (!charge.user_description) {
      throw new GraphQLError(
        `Monthly VAT charge must have description that indicates it's month (ID="${chargeId}")`,
      );
    }
    const vatDate = getMonthFromDescription(charge.user_description, transactionDate);
    if (!vatDate) {
      throw new GraphQLError(`Cannot extract charge ID="${chargeId}" VAT month`);
    }

    const [year, month] = vatDate.split('-').map(Number);
    const ledgerDate = new Date(year, month, 0);
    const fromDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd') as TimelessDateString;
    const toDate = format(ledgerDate, 'yyyy-MM-dd') as TimelessDateString;

    // get VAT relevant records
    const vatRecordsPromise = getVatRecords(
      charge,
      { filters: { financialEntityId: charge.owner_id, fromDate, toDate } },
      context,
      __,
    );

    const transactionsPromise = injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);

    const inputsVatTaxCategoryPromise = injector
      .get(TaxCategoriesProvider)
      .taxCategoryByIDsLoader.load(INPUT_VAT_TAX_CATEGORY_ID);
    const outputsVatTaxCategoryPromise = injector
      .get(TaxCategoriesProvider)
      .taxCategoryByIDsLoader.load(OUTPUT_VAT_TAX_CATEGORY_ID);

    const balanceCancellationTaxCategoryPromise = injector
      .get(TaxCategoriesProvider)
      .taxCategoryByIDsLoader.load(BALANCE_CANCELLATION_TAX_CATEGORY_ID);

    const [
      { income, expenses },
      transactions,
      inputsVatTaxCategory,
      outputsVatTaxCategory,
      balanceCancellationTaxCategory,
    ] = await Promise.all([
      vatRecordsPromise,
      transactionsPromise,
      inputsVatTaxCategoryPromise,
      outputsVatTaxCategoryPromise,
      balanceCancellationTaxCategoryPromise,
    ]);

    if (!inputsVatTaxCategory || !outputsVatTaxCategory || !balanceCancellationTaxCategory) {
      throw new GraphQLError(`Missing some of the VAT tax categories`);
    }

    const [incomeVat, roundedIncomeVat] = getVatDataFromVatReportRecords(
      income as RawVatReportRecord[],
    );
    const [expensesVat, roundedExpensesVat] = getVatDataFromVatReportRecords(
      expenses as RawVatReportRecord[],
    );

    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entityId: string }>();
    ledgerBalance.set(outputsVatTaxCategory.id, {
      amount: incomeVat,
      entityId: outputsVatTaxCategory.id,
    });
    ledgerBalance.set(inputsVatTaxCategory.id, {
      amount: expensesVat * -1,
      entityId: inputsVatTaxCategory.id,
    });

    const accountingLedgerEntries: LedgerProto[] = [];
    const financialAccountLedgerEntries: LedgerProto[] = [];

    // for each transaction, create a ledger record
    const mainTransactionsPromises = transactions.map(async preValidatedTransaction => {
      const transaction = validateTransactionRequiredVariables(preValidatedTransaction);
      if (transaction.currency !== DEFAULT_LOCAL_CURRENCY) {
        throw new GraphQLError(
          `Monthly VAT currency supposed to be local, got ${transaction.currency}`,
        );
      }

      // preparations for core ledger entries
      let exchangeRate: number | undefined = undefined;
      if (transaction.currency !== DEFAULT_LOCAL_CURRENCY) {
        // get exchange rate for currency
        exchangeRate = await injector
          .get(ExchangeProvider)
          .getExchangeRates(
            transaction.currency,
            DEFAULT_LOCAL_CURRENCY,
            transaction.debit_timestamp,
          );
      }

      const partialEntry = generatePartialLedgerEntry(transaction, charge.owner_id, exchangeRate);
      const ledgerEntry: LedgerProto = {
        ...partialEntry,
        ...(partialEntry.isCreditorCounterparty
          ? {
              creditAccountID1: VAT_BUSINESS_ID,
            }
          : {
              debitAccountID1: VAT_BUSINESS_ID,
            }),
      };

      financialAccountLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    });

    await Promise.all(mainTransactionsPromises);

    const accountingLedgerMaterials: Array<{
      amount: number;
      taxCategoryId: string;
      counterpartyId?: string;
    }> = [];
    accountingLedgerMaterials.push(
      {
        amount: roundedIncomeVat,
        taxCategoryId: outputsVatTaxCategory.id,
        counterpartyId: VAT_BUSINESS_ID,
      },
      {
        amount: roundedExpensesVat * -1,
        taxCategoryId: inputsVatTaxCategory.id,
        counterpartyId: VAT_BUSINESS_ID,
      },
    );

    const roundedIncomeVatDiff = Math.round((roundedIncomeVat - incomeVat) * 100) / 100;
    if (roundedIncomeVatDiff) {
      accountingLedgerMaterials.push({
        amount: roundedIncomeVatDiff * -1,
        taxCategoryId: outputsVatTaxCategory.id,
      });
    }

    const roundedExpensesVatDiff = Math.round((roundedExpensesVat - expensesVat) * 100) / 100;
    if (roundedExpensesVatDiff) {
      accountingLedgerMaterials.push({
        amount: roundedExpensesVatDiff,
        taxCategoryId: inputsVatTaxCategory.id,
      });
    }

    accountingLedgerMaterials.map(({ amount, taxCategoryId, counterpartyId }) => {
      if (amount === 0) {
        return;
      }

      const isCreditorCounterparty = amount > 0;

      const ledgerProto: LedgerProto = {
        id: chargeId,
        invoiceDate: ledgerDate,
        valueDate: ledgerDate,
        currency: DEFAULT_LOCAL_CURRENCY,
        creditAccountID1: isCreditorCounterparty ? counterpartyId : taxCategoryId,
        localCurrencyCreditAmount1: Math.abs(amount),
        debitAccountID1: isCreditorCounterparty ? taxCategoryId : counterpartyId,
        localCurrencyDebitAmount1: Math.abs(amount),
        description: counterpartyId ? `VAT command ${vatDate}` : 'Balance cancellation',
        isCreditorCounterparty,
        ownerId: charge.owner_id,
        chargeId,
      };

      accountingLedgerEntries.push(ledgerProto);
      updateLedgerBalanceByEntry(ledgerProto, ledgerBalance);
    });

    const ledgerBalanceInfo = await getLedgerBalanceInfo(injector, ledgerBalance);

    const records = [...financialAccountLedgerEntries, ...accountingLedgerEntries];
    await storeInitialGeneratedRecords(charge, records, injector);

    return {
      records: ledgerProtoToRecordsConverter(records),
      charge,
      balance: ledgerBalanceInfo,
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
