import { BusinessUsageProvider } from '../providers/businesses-usage.provider.js';
import type { FinancialEntitiesModule } from '../types.js';

export const businessesUsageResolvers: FinancialEntitiesModule.Resolvers = {
  Query: {
    businessesUsage: async (_, { ids }, { injector }) => {
      const usageMap = await injector.get(BusinessUsageProvider).getUsageByBusinessIds(ids);
      return ids.map(id => {
        const counts = usageMap.get(id) ?? {
          transactions: 0,
          documents: 0,
          miscExpenses: 0,
          ledgerRecords: 0,
        };
        return {
          id,
          businessId: id,
          totalTransactions: counts.transactions,
          totalDocuments: counts.documents,
          totalMiscExpenses: counts.miscExpenses,
          totalLedgerRecords: counts.ledgerRecords,
        };
      });
    },
  },
};
