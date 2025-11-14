import { GraphQLError } from 'graphql';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { validateTransactionBasicVariables } from '@modules/ledger/helpers/utils.helper.js';
import { getTransactionDebitDate } from '@modules/transactions/helpers/debit-date.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import type { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import { Currency } from '@shared/enums';
import { formatFinancialAmount, optionalDateToTimelessDateString } from '@shared/helpers';
import { BusinessTripExpensesTransactionsMatchProvider } from '../providers/business-trips-expenses-transactions-match.provider.js';
import { BusinessTripsProvider } from '../providers/business-trips.provider.js';
import type { BusinessTripsModule } from '../types.js';

export const commonBusinessTripExpenseFields: BusinessTripsModule.BusinessTripExpenseResolvers = {
  id: DbTripExpense => DbTripExpense.id!,
  businessTrip: (DbTripExpense, _, { injector }) =>
    injector
      .get(BusinessTripsProvider)
      .getBusinessTripsByIdLoader.load(DbTripExpense.business_trip_id!)
      .then(res => {
        if (!res) {
          throw new GraphQLError(
            `Business trip with id ${DbTripExpense.business_trip_id} not found`,
          );
        }
        return res;
      }),
  date: DbTripExpense => optionalDateToTimelessDateString(DbTripExpense.date),
  valueDate: DbTripExpense => optionalDateToTimelessDateString(DbTripExpense.value_date),
  amount: async (
    DbTripExpense,
    _,
    { injector, adminContext: { defaultCryptoConversionFiatCurrency } },
  ) => {
    if (!DbTripExpense.amount || !DbTripExpense.currency) {
      if (!DbTripExpense.transaction_ids?.length) {
        return null;
      }

      const transactionsPromise = injector
        .get(TransactionsProvider)
        .transactionByIdLoader.loadMany(DbTripExpense.transaction_ids);

      const [transactions] = await Promise.all([transactionsPromise]);

      const allTransactions = transactions.filter(
        transaction => transaction && !(transaction instanceof Error),
      ) as IGetTransactionsByIdsResult[];

      let amount = 0;

      await Promise.all(
        allTransactions.map(async transaction => {
          if (!transaction || transaction instanceof Error) {
            return;
          }
          const date = getTransactionDebitDate(transaction);

          const exchangeRate = await injector
            .get(ExchangeProvider)
            .getExchangeRates(
              transaction.currency as Currency,
              defaultCryptoConversionFiatCurrency,
              date,
            );

          const transactionAmount = Number(transaction.amount) * exchangeRate;
          amount += transactionAmount;
        }),
      );

      return formatFinancialAmount(amount, defaultCryptoConversionFiatCurrency);
    }

    if (DbTripExpense.currency === defaultCryptoConversionFiatCurrency) {
      return formatFinancialAmount(DbTripExpense.amount, DbTripExpense.currency);
    }

    // handle payed by employee cases
    if (DbTripExpense.payed_by_employee) {
      const date = DbTripExpense.value_date || DbTripExpense.date;
      if (!date) {
        return null;
      }
      const exchangeRate = await injector
        .get(ExchangeProvider)
        .getExchangeRates(
          DbTripExpense.currency as Currency,
          defaultCryptoConversionFiatCurrency,
          date,
        );
      return formatFinancialAmount(
        Number(DbTripExpense.amount) * exchangeRate,
        defaultCryptoConversionFiatCurrency,
      );
    }

    if (!DbTripExpense.transaction_ids?.length) {
      return null;
    }

    const transactionMatchesPromise = injector
      .get(BusinessTripExpensesTransactionsMatchProvider)
      .getBusinessTripsExpenseMatchesByExpenseIdLoader.load(DbTripExpense.id);
    const transactionsPromise = injector
      .get(TransactionsProvider)
      .transactionByIdLoader.loadMany(DbTripExpense.transaction_ids)
      .then(
        res =>
          res.filter(transaction => {
            if (!transaction) {
              return false;
            }
            if (transaction instanceof Error) {
              throw transaction;
            }
            return transaction;
          }) as IGetTransactionsByIdsResult[],
      );
    const [transactionMatches, transactions] = await Promise.all([
      transactionMatchesPromise,
      transactionsPromise,
    ]);

    let totalAmount = 0;
    await Promise.all(
      transactions.map(async transaction => {
        const match = transactionMatches.find(match => match.transaction_id === transaction.id);
        if (!match) {
          return;
        }
        const { currency, valueDate } = validateTransactionBasicVariables(transaction);
        const exchangeRate = await injector
          .get(ExchangeProvider)
          .getExchangeRates(currency, defaultCryptoConversionFiatCurrency, valueDate);
        const amount = Number(match.amount || transaction.amount);
        totalAmount += amount * exchangeRate;
      }),
    );

    return formatFinancialAmount(totalAmount, defaultCryptoConversionFiatCurrency);
  },
  employee: (DbTripExpense, _, { injector }) =>
    DbTripExpense.employee_business_id
      ? injector
          .get(BusinessesProvider)
          .getBusinessByIdLoader.load(DbTripExpense.employee_business_id)
          .then(res => {
            if (!res) {
              throw new GraphQLError(
                `Employee with id ${DbTripExpense.employee_business_id} not found`,
              );
            }
            return res;
          })
      : null,
  transactions: DbTripTransaction =>
    DbTripTransaction.transaction_ids?.length ? DbTripTransaction.transaction_ids : null,
  charges: DbTripTransaction => {
    if (!DbTripTransaction.charge_ids?.length) {
      return null;
    }

    return DbTripTransaction.charge_ids;
  },
  payedByEmployee: dbTransaction => dbTransaction.payed_by_employee,
};
