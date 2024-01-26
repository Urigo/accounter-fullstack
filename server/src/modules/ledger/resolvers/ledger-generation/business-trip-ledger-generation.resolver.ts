import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { BusinessTripAttendeesProvider } from '@modules/business-trips/providers/business-trips-attendees.provider.js';
import { BusinessTripTransactionsProvider } from '@modules/business-trips/providers/business-trips-transactions.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { storeInitialGeneratedRecords } from '@modules/ledger/helpers/ledgrer-storage.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { DEFAULT_LOCAL_CURRENCY, FEE_CATEGORY_NAME } from '@shared/constants';
import {
  Currency,
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import type { CounterAccountProto, LedgerProto, StrictLedgerProto } from '@shared/types';
import {
  isSupplementalFeeTransaction,
  splitFeeTransactions,
} from '../../helpers/fee-transactions.js';
import {
  generatePartialLedgerEntry,
  getLedgerBalanceInfo,
  getTaxCategoryNameByAccountCurrency,
  ledgerProtoToRecordsConverter,
  updateLedgerBalanceByEntry,
  validateTransactionBasicVariables,
  validateTransactionRequiredVariables,
} from '../../helpers/utils.helper.js';

export const generateLedgerRecordsForBusinessTrip: ResolverFn<
  Maybe<ResolversTypes['GeneratedLedgerRecords']>,
  ResolversParentTypes['Charge'],
  { injector: Injector },
  object
> = async (charge, _, { injector }) => {
  const chargeId = charge.id;

  if (!charge.tax_category_id) {
    throw new GraphQLError(`Business trip charge ID="${charge.id}" is missing tax category`);
  }
  const tripTaxCategory = await injector
    .get(TaxCategoriesProvider)
    .taxCategoryByIDsLoader.load(charge.tax_category_id);
  if (!tripTaxCategory) {
    throw new GraphQLError(`Charge ID="${charge.tax_category_id}" tax category is faulty`);
  }

  try {
    // validate ledger records are balanced
    const ledgerBalance = new Map<string, { amount: number; entity: CounterAccountProto }>();

    // Get all transactions and business trip transactions
    const transactionsPromise = injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);
    const businessTripTransactionsPromise = injector
      .get(BusinessTripTransactionsProvider)
      .getBusinessTripsTransactionsByChargeIdLoader.load(chargeId);
    const businessTripAttendeesPromise = injector
      .get(BusinessTripAttendeesProvider)
      .getBusinessTripsAttendeesByChargeIdLoader.load(chargeId);
    const [transactions, businessTripTransactions, businessTripAttendees] = await Promise.all([
      transactionsPromise,
      businessTripTransactionsPromise,
      businessTripAttendeesPromise,
    ]);

    // generate ledger from transactions
    let entriesPromises: Array<Promise<void>> = [];
    const financialAccountLedgerEntries: StrictLedgerProto[] = [];
    const feeFinancialAccountLedgerEntries: LedgerProto[] = [];

    // generate ledger from transactions
    const { mainTransactions, feeTransactions } = splitFeeTransactions(transactions);

    // for each transaction, create a ledger record
    const mainTransactionsPromises = mainTransactions.map(async preValidatedTransaction => {
      const transaction = validateTransactionRequiredVariables(preValidatedTransaction);

      // get tax category
      const account = await injector
        .get(FinancialAccountsProvider)
        .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
      if (!account) {
        throw new GraphQLError(`Transaction ID="${transaction.id}" is missing account`);
      }
      const taxCategoryName = getTaxCategoryNameByAccountCurrency(account, transaction.currency);
      const taxCategory = await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByNamesLoader.load(taxCategoryName);
      if (!taxCategory) {
        throw new GraphQLError(`Account ID="${account.id}" is missing tax category`);
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
      const ledgerEntry: StrictLedgerProto = {
        ...partialEntry,
        creditAccountID1: partialEntry.isCreditorCounterparty
          ? transaction.business_id
          : taxCategory,
        debitAccountID1: partialEntry.isCreditorCounterparty
          ? taxCategory
          : transaction.business_id,
      };

      financialAccountLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    });

    // create a ledger record for fee transactions
    const feeTransactionsPromises = feeTransactions.map(async transaction => {
      if (!transaction.is_fee) {
        throw new GraphQLError(
          `Who did a non-fee transaction marked as fee? (Transaction ID="${transaction.id}")`,
        );
      }

      const isSupplementalFee = isSupplementalFeeTransaction(transaction);
      const { currency, valueDate, transactionBusinessId } =
        validateTransactionBasicVariables(transaction);

      let amount = Number(transaction.amount);
      let foreignAmount: number | undefined = undefined;

      if (currency !== DEFAULT_LOCAL_CURRENCY) {
        // get exchange rate for currency
        const exchangeRate = await injector
          .get(ExchangeProvider)
          .getExchangeRates(currency, DEFAULT_LOCAL_CURRENCY, valueDate);

        foreignAmount = amount;
        // calculate amounts in ILS
        amount = exchangeRate * amount;
      }

      const feeTaxCategory = await injector
        .get(TaxCategoriesProvider)
        .taxCategoryByNamesLoader.load(FEE_CATEGORY_NAME);
      if (!feeTaxCategory) {
        throw new GraphQLError(`Tax category "${FEE_CATEGORY_NAME}" not found`);
      }

      const isCreditorCounterparty = amount > 0;

      let mainAccount: CounterAccountProto = transactionBusinessId;

      const partialLedgerEntry: Omit<StrictLedgerProto, 'creditAccountID1' | 'debitAccountID1'> = {
        id: transaction.id,
        invoiceDate: transaction.event_date,
        valueDate,
        currency,
        creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyCreditAmount1: Math.abs(amount),
        debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
        localCurrencyDebitAmount1: Math.abs(amount),
        description: transaction.source_description ?? undefined,
        reference1: transaction.source_id,
        isCreditorCounterparty: isSupplementalFee
          ? isCreditorCounterparty
          : !isCreditorCounterparty,
        ownerId: charge.owner_id,
        currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
        chargeId: transaction.charge_id,
      };

      if (isSupplementalFee) {
        const account = await injector
          .get(FinancialAccountsProvider)
          .getFinancialAccountByAccountIDLoader.load(transaction.account_id);
        if (!account) {
          throw new GraphQLError(`Transaction ID="${transaction.id}" is missing account`);
        }
        const taxCategoryName = getTaxCategoryNameByAccountCurrency(account, currency);
        const businessTaxCategory = await injector
          .get(TaxCategoriesProvider)
          .taxCategoryByNamesLoader.load(taxCategoryName);
        if (!businessTaxCategory) {
          throw new GraphQLError(`Account ID="${account.id}" is missing tax category`);
        }

        mainAccount = businessTaxCategory;
      } else {
        const mainBusiness = charge.business_id ?? undefined;

        const ledgerEntry: LedgerProto = {
          ...partialLedgerEntry,
          creditAccountID1: isCreditorCounterparty ? mainAccount : mainBusiness,
          debitAccountID1: isCreditorCounterparty ? mainBusiness : mainAccount,
        };

        feeFinancialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      }

      const ledgerEntry: StrictLedgerProto = {
        ...partialLedgerEntry,
        creditAccountID1: isCreditorCounterparty ? feeTaxCategory : mainAccount,
        debitAccountID1: isCreditorCounterparty ? mainAccount : feeTaxCategory,
      };

      feeFinancialAccountLedgerEntries.push(ledgerEntry);
      updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
    });

    entriesPromises.push(...mainTransactionsPromises, ...feeTransactionsPromises);
    await Promise.all(entriesPromises);

    // generate ledger from business trip transactions
    entriesPromises = [];
    const businessTripTransactionsPromises = businessTripTransactions.map(
      async businessTripTransaction => {
        const isTransactionBased = !!businessTripTransaction.transaction_id;
        if (isTransactionBased) {
          const matchingEntry = financialAccountLedgerEntries.find(
            entry => entry.id === businessTripTransaction.transaction_id,
          );
          if (!matchingEntry) {
            throw new GraphQLError(
              `Flight transaction ID="${businessTripTransaction.transaction_id}" is missing from transactions`,
            );
          }

          const isCreditorCounterparty = !matchingEntry.isCreditorCounterparty;
          const businessId = isCreditorCounterparty
            ? matchingEntry.debitAccountID1
            : matchingEntry.creditAccountID1;
          const ledgerEntry: StrictLedgerProto = {
            ...matchingEntry,
            id: businessTripTransaction.id,
            isCreditorCounterparty,
            creditAccountID1: isCreditorCounterparty ? businessId : tripTaxCategory,
            debitAccountID1: isCreditorCounterparty ? tripTaxCategory : businessId,
          };

          financialAccountLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        } else {
          if (
            !businessTripTransaction.employee_business_id ||
            !businessTripTransaction.date ||
            !businessTripTransaction.amount ||
            !businessTripTransaction.currency
          ) {
            throw new GraphQLError(
              `Business trip flight transaction ID="${businessTripTransaction.id}" is missing required fields`,
            );
          }

          // preparations for core ledger entries
          let exchangeRate: number | undefined = undefined;
          if (businessTripTransaction.currency !== DEFAULT_LOCAL_CURRENCY) {
            // get exchange rate for currency
            exchangeRate = await injector
              .get(ExchangeProvider)
              .getExchangeRates(
                businessTripTransaction.currency as Currency,
                DEFAULT_LOCAL_CURRENCY,
                businessTripTransaction.date,
              );
          }

          // set amounts
          let amount = Number(businessTripTransaction.amount);
          let foreignAmount: number | undefined = undefined;
          if (exchangeRate) {
            foreignAmount = amount;
            // calculate amounts in ILS
            amount = exchangeRate * amount;
          }
          const absAmount = Math.abs(amount);
          const absForeignAmount = foreignAmount ? Math.abs(foreignAmount) : undefined;

          const isCreditorCounterparty = amount > 0;
          const ledgerEntry: StrictLedgerProto = {
            id: businessTripTransaction.id,
            invoiceDate: businessTripTransaction.date,
            valueDate: businessTripTransaction.date,
            currency: businessTripTransaction.currency as Currency,
            creditAccountID1: isCreditorCounterparty
              ? businessTripTransaction.employee_business_id
              : tripTaxCategory,
            creditAmount1: absForeignAmount,
            localCurrencyCreditAmount1: absAmount,
            debitAccountID1: isCreditorCounterparty
              ? tripTaxCategory
              : businessTripTransaction.employee_business_id,
            debitAmount1: absForeignAmount,
            localCurrencyDebitAmount1: absAmount,
            reference1: businessTripTransaction.id,
            isCreditorCounterparty,
            ownerId: charge.owner_id,
            currencyRate: exchangeRate,
            chargeId: charge.id,
          };

          financialAccountLedgerEntries.push(ledgerEntry);
          updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
        }
      },
    );

    entriesPromises = businessTripTransactionsPromises;
    await Promise.all(entriesPromises);

    const allowedUnbalancedBusinesses = new Set(businessTripAttendees.map(attendee => attendee.id));

    const ledgerBalanceInfo = getLedgerBalanceInfo(ledgerBalance, allowedUnbalancedBusinesses);

    const records = [...financialAccountLedgerEntries, ...feeFinancialAccountLedgerEntries];
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
