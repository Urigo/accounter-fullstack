import { GraphQLError } from 'graphql';
import { Currency } from '@shared/enums';
import { dateToTimelessDateString, formatFinancialAmount } from '@shared/helpers';
import { BalanceReportProvider } from '../providers/balance-report.provider.js';
import type { ReportsModule } from '../types.js';

export const balanceReportResolver: ReportsModule.Resolvers = {
  Query: {
    transactionsForBalanceReport: async (_, { fromDate, toDate, ownerId }, context) => {
      const {
        injector,
        adminContext: { defaultAdminBusinessId },
      } = context;

      try {
        return injector.get(BalanceReportProvider).getNormalizedBalanceTransactions({
          fromDate,
          toDate,
          ownerId: ownerId ?? defaultAdminBusinessId,
        });
      } catch (error) {
        const message = 'Failed to get balance transactions';
        console.error(`${message}: ${error}`);
        throw new GraphQLError(message);
      }
    },
  },
  BalanceTransactions: {
    id: t => t.id!,
    chargeId: t => t.charge_id!,
    amount: t => formatFinancialAmount(t.amount, Currency.Usd),
    date: t => dateToTimelessDateString(t.debit_date!),
    month: t => t.month!,
    year: t => t.year!,
  },
};
