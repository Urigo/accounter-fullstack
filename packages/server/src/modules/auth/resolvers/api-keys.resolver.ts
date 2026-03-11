import { GraphQLError } from 'graphql';
import { ApiKeysProvider } from '../providers/api-keys.provider.js';
import type { AuthModule } from '../types.js';

export const apiKeysResolvers: AuthModule.Resolvers = {
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
  },
};
