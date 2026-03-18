import { createModule } from 'graphql-modules';
import { AuditLogsProvider } from './providers/audit-logs.provider.js';
import { scalarsResolvers } from './resolvers/common.resolver.js';
import { userContextResolvers } from './resolvers/user-context.resolver.js';
import common from './typeDefs/common.graphql.js';
import errors from './typeDefs/errors.graphql.js';
import userContext from './typeDefs/user-context.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const commonModule = createModule({
  id: 'common',
  dirname: __dirname,
  typeDefs: [common, errors, userContext],
  resolvers: [scalarsResolvers, userContextResolvers],
  providers: () => [AuditLogsProvider],
});

export * as CommonTypes from './types.js';
