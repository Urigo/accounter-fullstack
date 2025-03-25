import common from './typeDefs/common.graphql.js';
import errors from './typeDefs/errors.graphql.js';
import userContext from './typeDefs/user-context.graphql.js';
import { createModule } from 'graphql-modules';
import { scalarsResolvers } from './resolvers/common.resolver.js';
import { userContextResolvers } from './resolvers/user-context.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const commonModule = createModule({
  id: 'common',
  dirname: __dirname,
  typeDefs: [common, errors, userContext],
  resolvers: [scalarsResolvers, userContextResolvers],
});

export * as CommonTypes from './types.js';
