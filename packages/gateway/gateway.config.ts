import { defineConfig } from '@graphql-hive/gateway';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { env } from '../server/src/environment.js';
import { UserType } from '../server/src/shared/types/index.js';
import { useForwordAuthInfoToSubgraph } from './helpers.js';
import { getAcceptableRoles, resolveUser, validateUser } from './plugins/auth.js';
import { ValidateUserType } from './plugins/types.js';

export const gatewayConfig = defineConfig({
  supergraph: env.accounter.acconterEnv
    ? {
        type: 'hive',
        endpoint: 'https://cdn.graphql-hive.com/artifacts/v1/1766c3d3-f0ba-46ff-8252-1ec116d07123',
        key: env.hive.hiveMainRegistryToken || '',
      }
    : '../../supergraph.graphql',
  graphqlEndpoint: '/graphql',
  genericAuth: {
    mode: 'protect-granular',
    resolveUserFn: context => resolveUser(context),
    validateUser: (validateUserFields: ValidateUserType) => {
      const { parentType, fieldDirectives, user } = validateUserFields;

      return validateUser({ user, fieldDirectives, parentType });
    },
    extractScopes: (user: UserType) => getAcceptableRoles(user.role),
  },
  plugins: _ctx => {
    return [useForwordAuthInfoToSubgraph(), useDeferStream()];
  },
});
