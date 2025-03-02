import { defineConfig } from '@graphql-hive/gateway';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { env } from '../server/src/environment.js';
import { UserType } from '../server/src/shared/types/index.js';
import { useForwordAuthInfoToSubgraph } from './helpers.js';
import { getAcceptableRoles, resolveUser, validateUser } from './plugins/auth.js';
import { ValidateUserType } from './plugins/types.js';

export const gatewayConfig = defineConfig({
  supergraph: '../../supergraph.graphql',
  port: env.hive.hiveGatewayPort,
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
