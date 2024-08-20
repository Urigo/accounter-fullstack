import { GraphQLError } from 'graphql';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { validateTransactionBasicVariables } from '@modules/ledger/helpers/utils.helper.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';
import { DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY } from '@shared/constants';
import { Currency } from '@shared/enums';
import { formatFinancialAmount, optionalDateToTimelessDateString } from '@shared/helpers';
import { BusinessTripExpensesProvider } from '../providers/business-trips-expenses.provider.js';
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
  amount: async (DbTripExpense, _, { injector }) => {
    if (!DbTripExpense.amount || !DbTripExpense.currency) {
      return null;
    }

    if (DbTripExpense.currency === DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY) {
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
          DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY,
          date,
        );
      return formatFinancialAmount(
        Number(DbTripExpense.amount) * exchangeRate,
        DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY,
      );
    }

    if (!DbTripExpense.transaction_ids?.length) {
      return null;
    }

    const transactionMatchesPromise = injector
      .get(BusinessTripExpensesProvider)
      .getBusinessTripsExpenseMatchesByExpenseIdLoader.load(DbTripExpense.id);
    const transactionsPromise = injector
      .get(TransactionsProvider)
      .getTransactionByIdLoader.loadMany(DbTripExpense.transaction_ids)
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
          .getExchangeRates(currency, DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY, valueDate);
        const amount = Number(match.amount || transaction.amount);
        totalAmount += amount * exchangeRate;
      }),
    );

    return formatFinancialAmount(totalAmount, DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY);
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
  transactions: async (DbTripTransaction, _, { injector }) =>
    DbTripTransaction.transaction_ids?.length
      ? injector
          .get(TransactionsProvider)
          .getTransactionByIdLoader.loadMany(DbTripTransaction.transaction_ids)
          .then(res => {
            if (!res) {
              throw new GraphQLError(
                `Some transaction of business trip transaction id ${DbTripTransaction.id} were not found`,
              );
            }
            return res as IGetTransactionsByIdsResult[];
          })
      : Promise.resolve(null),
  payedByEmployee: dbTransaction => dbTransaction.payed_by_employee,
};
