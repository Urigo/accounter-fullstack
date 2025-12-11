import { createModule } from 'graphql-modules';
import { scalarsResolvers } from './resolvers/common.resolver.js';
import { gmailListenerResolvers } from './resolvers/gmail-listener.resolver.js';
import { userContextResolvers } from './resolvers/user-context.resolver.js';
import common from './typeDefs/common.graphql.js';
import errors from './typeDefs/errors.graphql.js';
import gmailListener from './typeDefs/gmail-listener.graphql.js';
import userContext from './typeDefs/user-context.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const commonModule = createModule({
  id: 'common',
  dirname: __dirname,
  typeDefs: [common, errors, userContext, gmailListener],
  resolvers: [scalarsResolvers, userContextResolvers, gmailListenerResolvers],
});

export * as CommonTypes from './types.js';
