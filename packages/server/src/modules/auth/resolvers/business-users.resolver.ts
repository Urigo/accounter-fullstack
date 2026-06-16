import { GraphQLError } from 'graphql';
import { BusinessUsersProvider } from '../providers/business-users.provider.js';
import type { AuthModule } from '../types.js';

export const businessUsersResolvers: AuthModule.Resolvers = {
  Query: {
    listBusinessUsers: async (_, __, { injector }) => {
      try {
        return await injector.get(BusinessUsersProvider).listBusinessUsers();
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        throw new GraphQLError('Failed to list business users', {
          originalError: error instanceof Error ? error : undefined,
          extensions: { code: 'BUSINESS_USER_LIST_FAILED' },
        });
      }
    },
  },
  Mutation: {
    removeBusinessUser: async (_, { userId }, { injector }) => {
      try {
        return await injector.get(BusinessUsersProvider).removeBusinessUser(userId);
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        throw new GraphQLError('Failed to remove business user', {
          originalError: error instanceof Error ? error : undefined,
          extensions: { code: 'BUSINESS_USER_REMOVAL_FAILED' },
        });
      }
    },
  },
};
