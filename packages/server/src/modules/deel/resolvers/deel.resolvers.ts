import { GraphQLError } from 'graphql';
import { DeelProvider } from '../providers/deel.provider.js';
import type { DeelModule } from '../types.js';

export const deelResolvers: DeelModule.Resolvers = {
  Mutation: {
    addDeelEmployee: async (_, { deelId, businessId }, { injector }) => {
      try {
        await injector.get(DeelProvider).insertDeelEmployee({ deelId: Number(deelId), businessId });
        return true;
      } catch (error) {
        const message = `Error adding Deel employee [${deelId}]`;
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
    addDeelPaymentInfo: async (_, { records }, { injector }) => {
      try {
        const deelDocumentRecords = records.map(record => ({
          ...record,
          contractId: record.contractId ?? null,
          contractOrFeeDescription: record.contractOrFeeDescription ?? null,
          deelWorkerId: record.deelWorkerId ?? null,
          entity: record.entity ?? null,
          workerName: record.workerName ?? null,
        }));
        await injector.get(DeelProvider).insertDeelDocumentRecords({ deelDocumentRecords });
        return true;
      } catch (error) {
        const message = 'Error adding Deel document records';
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
  },
};
