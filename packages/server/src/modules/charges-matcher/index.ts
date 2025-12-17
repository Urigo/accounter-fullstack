import { createModule } from 'graphql-modules';
import { ChargesMatcherProvider } from './providers/charges-matcher.provider.js';
import { chargesMatcherResolvers } from './resolvers/index.js';
import chargesMatcherTypeDefs from './typeDefs/charges-matcher.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const chargesMatcherModule = createModule({
  id: 'charges-matcher',
  dirname: __dirname,
  typeDefs: [chargesMatcherTypeDefs],
  resolvers: [chargesMatcherResolvers],
  providers: [ChargesMatcherProvider],
});

export * as ChargesMatcherTypes from './types.js';
