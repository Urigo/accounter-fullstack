import chargesMatcherTypeDefs from './typeDefs/charges-matcher.graphql.js';
import { createModule } from 'graphql-modules';

const __dirname = new URL('.', import.meta.url).pathname;

export const chargesMatcherModule = createModule({
  id: 'charges-matcher',
  dirname: __dirname,
  typeDefs: [chargesMatcherTypeDefs],
  resolvers: [],
  providers: () => [],
});

export * as ChargesMatcherTypes from './types.js';
