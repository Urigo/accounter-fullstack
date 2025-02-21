import { defineConfig } from '@graphql-hive/gateway';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { env } from '../server/src/environment.js';
import { AUTH_ROLE, AUTH_USER_ID, AUTH_USERNAME } from '../server/src/shared/constants.js';
import { UserType } from '../server/src/shared/types/index.js';
import { getAcceptableRoles, resolveUser, validateUser } from './plugins/auth.js';
import { AccounterGatewayPlugin, ValidateUserType } from './plugins/types.js';

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

function useForwordAuthInfoToSubgraph(): AccounterGatewayPlugin {
  return {
    onFetch(params) {
      const { currentUser } = params.context;
      if (!currentUser) {
        return;
      }
      params.setOptions({
        ...params.options,
        headers: {
          ...params.options.headers,
          [AUTH_ROLE]: currentUser.role,
          [AUTH_USERNAME]: currentUser.username,
          [AUTH_USER_ID]: currentUser.userId,
        },
      });
    },
  };
}
