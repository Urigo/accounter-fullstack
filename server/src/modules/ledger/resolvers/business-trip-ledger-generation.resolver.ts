import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { BusinessTripTransactionsProvider } from '@modules/business-trips/providers/business-trips-transactions.provider.js';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { DEFAULT_LOCAL_CURRENCY, UUID_REGEX } from '@shared/constants';
import {
  Currency,
  Maybe,
  ResolverFn,
  ResolversParentTypes,
  ResolversTypes,
} from '@shared/gql-types';
import type { StrictLedgerProto } from '@shared/types';
import {
  generatePartialLedgerEntry,
  getTaxCategoryNameByAccountCurrency,
  updateLedgerBalanceByEntry,
  validateTransactionRequiredVariables,
} from '../helpers/utils.helper.js';

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
    const ledgerBalance = new Map<string, number>();

    // Get all transactions and business trip transactions
    const transactionsPromise = injector
      .get(TransactionsProvider)
      .getTransactionsByChargeIDLoader.load(chargeId);
    const businessTripTransactionsPromise = injector
      .get(BusinessTripTransactionsProvider)
      .getBusinessTripsTransactionsByChargeIdLoader.load(chargeId);
    const [transactions, businessTripTransactions] = await Promise.all([
      transactionsPromise,
      businessTripTransactionsPromise,
    ]);

    // generate ledger from transactions
    const financialAccountLedgerEntries: StrictLedgerProto[] = [];

    // for each transaction, create a ledger record
    for (const preValidatedTransaction of transactions) {
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
    }

    // generate ledger from business trip transactions
    for (const businessTripTransaction of businessTripTransactions) {
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
        };

        financialAccountLedgerEntries.push(ledgerEntry);
        updateLedgerBalanceByEntry(ledgerEntry, ledgerBalance);
      }
    }

    const allowedUnbalancedBusinesses = [
      '7843b805-3bb7-4d1c-9219-ff783100334b', // Uri Employee
      'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df', // Dotan Employee
    ];

    // validate ledger balance
    let ledgerBalanceSum = 0;
    for (const [side, balance] of ledgerBalance.entries()) {
      if (Math.abs(balance) < 0.005) {
        continue;
      }
      if (UUID_REGEX.test(side)) {
        if (allowedUnbalancedBusinesses.includes(side)) {
          console.error(`Business ID="${side}" is not balanced`);
        } else {
          throw new GraphQLError(`Business ID="${side}" is not balanced`);
        }
      }
      ledgerBalanceSum += balance;
    }
    if (Math.abs(ledgerBalanceSum) >= 0.005) {
      throw new GraphQLError(`Ledger is not balanced`);
    }

    return {
      records: [
        ...financialAccountLedgerEntries,
        //  ...miscLedgerEntries
      ],
    };
  } catch (e) {
    return {
      __typename: 'CommonError',
      message: `Failed to generate ledger records for charge ID="${chargeId}"\n${e}`,
    };
  }
};
