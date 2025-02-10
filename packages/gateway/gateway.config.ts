import { useExtendContext } from 'graphql-yoga';
import { defineConfig } from '@graphql-hive/gateway';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { env } from '../server/src/environment.js';
import { UserType } from '../server/src/shared/types/index.js';
import { fetchContext, normalizeContext } from './plugins/admin-context-plugin.js';
import { getAcceptableRoles, resolveUser, validateUser } from './plugins/auth.js';

export const gatewayConfig = defineConfig({
  supergraph: '../../supergraph.graphql',
  port: env.hive.hiveGatewayPort,
  genericAuth: {
    mode: 'protect-granular',
    resolveUserFn: context => resolveUser(context),
    validateUser: ({ user, fieldDirectives, parentType }) =>
      validateUser({ user, fieldDirectives, parentType }),
    extractScopes: user => getAcceptableRoles((user as UserType)?.role),
  },
  plugins: () => [
    useDeferStream(),
    useExtendContext(async ctx => {
      const rawContext = await fetchContext(ctx.currentUser.userId);
      const adminContext = normalizeContext(rawContext);

      return {
        ...ctx,
        ...adminContext,
      };
    }),
  ],
});
