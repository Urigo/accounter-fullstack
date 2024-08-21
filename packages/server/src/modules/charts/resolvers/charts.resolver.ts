import { GraphQLError } from 'graphql';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY } from '@shared/constants';
import { Currency } from '@shared/enums';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import type { ChartsModule, MonthDataProto } from '../types.js';

export const chartsResolvers: ChartsModule.Resolvers = {
  Query: {
    incomeExpenseChart: async (_, { filters }, { injector }) => {
      try {
        const transactions = await injector.get(TransactionsProvider).getTransactionsByFilters({
          fromDebitDate: filters.fromDate,
          toDebitDate: filters.toDate,
        });

        const currency = filters.currency ?? DEFAULT_CRYPTO_FIAT_CONVERSION_CURRENCY;

        const monthDataMap = new Map<
          TimelessDateString,
          Omit<MonthDataProto, 'date' | 'currency'>
        >();

        await Promise.all(
          transactions.map(async transaction => {
            const date =
              transaction.debit_timestamp || transaction.debit_date || transaction.event_date;

            // convert amount to chart currency
            const exchangeRate = await injector
              .get(ExchangeProvider)
              .getExchangeRates(transaction.currency as Currency, currency, date);

            // add amount to relevant month
            const monthTag = dateToTimelessDateString(
              new Date(date.getFullYear(), date.getMonth(), 1),
            );
            if (!monthDataMap.has(monthTag)) {
              monthDataMap.set(monthTag, { income: 0, expense: 0, balance: 0 });
            }

            const monthData = monthDataMap.get(monthTag)!;
            const amount = Number(transaction.amount);
            if (amount > 0) {
              monthData.income += Math.abs(amount) * exchangeRate;
            } else {
              monthData.expense += Math.abs(amount) * exchangeRate;
            }
          }),
        );

        const INITIAL_BALANCE = 0;
        let balance = INITIAL_BALANCE;

        const orderedMonthInfo = Array.from(monthDataMap.entries()).sort(([dateA], [dateB]) =>
          dateA.localeCompare(dateB),
        );

        const monthlyData: Array<MonthDataProto> = [];
        for (const [date, data] of orderedMonthInfo) {
          balance += data.income - data.expense;
          const monthBalance = balance;
          monthlyData.push({
            date,
            ...data,
            balance: monthBalance,
            currency,
          });
        }

        return {
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          currency,
          monthlyData,
        };
      } catch (e) {
        console.error('Error fetching income/expense chart info', e);
        throw new GraphQLError((e as Error)?.message ?? 'Error fetching chart info');
      }
    },
  },
  IncomeExpenseChartMonthData: {
    date: proto => proto.date,
    income: proto => formatFinancialAmount(proto.income, proto.currency),
    expense: proto => formatFinancialAmount(proto.expense, proto.currency),
    balance: proto => formatFinancialAmount(proto.balance, proto.currency),
  },
};
