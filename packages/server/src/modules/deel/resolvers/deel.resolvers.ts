import { GraphQLError } from 'graphql';
import { describeError } from '../helpers/deel-sync-errors.js';
import { syncDeelDocuments } from '../helpers/deel-sync.helper.js';
import { DeelContractsProvider } from '../providers/deel-contracts.provider.js';
import type { DeelModule } from '../types.js';

export const deelResolvers: DeelModule.Resolvers = {
  Mutation: {
    addDeelContract: async (
      _,
      { contractId, contractorId, contractorName, contractStartDate, businessId },
      { injector },
    ) => {
      try {
        await injector.get(DeelContractsProvider).insertDeelContract({
          contractId,
          contractorId,
          contractorName,
          contractStartDate,
          businessId,
        });
        return true;
      } catch (error) {
        const message = `Error adding Deel contract [${contractId}]`;
        console.error(message, error);
        throw new GraphQLError(message);
      }
    },
    fetchDeelDocuments: async (_, __, { injector }) => {
      try {
        const { charges, issues } = await syncDeelDocuments(injector);
        return { __typename: 'DeelSyncResult' as const, charges, issues };
      } catch (error) {
        console.error('Error fetching Deel documents:', error);
        return {
          __typename: 'CommonError' as const,
          message: `Error fetching Deel documents: ${describeError(error)}`,
        };
      }
    },
  },
};
