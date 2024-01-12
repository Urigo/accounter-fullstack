import { FundsProvider } from '../providers/funds.provider.js';
import type { SalariesModule } from '../types.js';

export const fundsResolvers: SalariesModule.Resolvers = {
  Query: {
    allPensionFunds: async (_, __, { injector }) => {
      const pensionFunds = await injector.get(FundsProvider).getAllPensionFunds();
      return pensionFunds.map(fund => ({
        id: fund.id,
        name: fund.name,
      }));
    },
    allTrainingFunds: async (_, __, { injector }) => {
      const trainingFunds = await injector.get(FundsProvider).getAllTrainingFunds();
      return trainingFunds.map(fund => ({
        id: fund.id,
        name: fund.name,
      }));
    },
  },
};
