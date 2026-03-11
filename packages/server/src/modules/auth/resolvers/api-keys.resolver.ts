import { GraphQLError } from 'graphql';
import { ApiKeysProvider } from '../providers/api-keys.provider.js';
import type { AuthModule } from '../types.js';

export const apiKeysResolvers: AuthModule.Resolvers = {
  Query: {
    listApiKeys: async (_, __, { injector }) => {
      try {
        return await injector.get(ApiKeysProvider).listApiKeys();
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        throw new GraphQLError('Failed to list API keys', {
          extensions: { code: 'API_KEY_LIST_FAILED' },
        });
      }
    },
  },
  Mutation: {
    generateApiKey: async (_, { name, roleId }, { injector }) => {
      try {
        return await injector.get(ApiKeysProvider).generateApiKey(name, roleId);
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        throw new GraphQLError('Failed to generate API key', {
          extensions: { code: 'API_KEY_GENERATION_FAILED' },
        });
      }
    },
    revokeApiKey: async (_, { id }, { injector }) => {
      try {
        return await injector.get(ApiKeysProvider).revokeApiKey(id);
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        throw new GraphQLError('Failed to revoke API key', {
          extensions: { code: 'API_KEY_REVOCATION_FAILED' },
        });
      }
    },
  },
};
