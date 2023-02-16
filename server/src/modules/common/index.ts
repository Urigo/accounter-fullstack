import common from './typeDefs/common.graphql.js';
import errors from './typeDefs/errors.graphql.js';
import { createModule } from 'graphql-modules';
import { scalarsResolvers } from './resolvers/common.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const commonModule = createModule({
  id: 'common',
  dirname: __dirname,
  typeDefs: [common, errors],
  resolvers: [scalarsResolvers],
});

export * as CommonTypes from './types.js';
