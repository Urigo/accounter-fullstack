import { GraphQLError } from 'graphql';
import { generateReport } from '@accounter/shaam6111-generator';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import {
  convertLocalReportDataToShaam6111ReportData,
  getShaam6111Data,
} from '../helpers/shaam6111.helper.js';
import type { ReportsModule } from '../types.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { ClientsProvider } from '@modules/financial-entities/providers/clients.provider.js';

export const annualRevenueResolvers: ReportsModule.Resolvers = {
  Query: {
    annualRevenueReport: async (_, { filters: { year, adminBusinessId } }, context) => {
      const adminId = adminBusinessId ?? context.adminContext.defaultAdminBusinessId;
      const clients = await context.injector.get(ClientsProvider).
      const transactions = await context.injector.get(TransactionsProvider).getTransactionsByFilters({

      })
      const reportData = await getShaam6111Data(context, businessId, year);

      return {
        businessId,
        reportData,
      };
    },
  },
};
