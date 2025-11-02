import chargesMatcherTypeDefs from './typeDefs/charges-matcher.graphql.js';
import { createModule } from 'graphql-modules';
import { ChargesMatcherProvider } from './providers/charges-matcher.provider.js';
import { chargesMatcherResolvers } from './resolvers/index.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const chargesMatcherModule = createModule({
  id: 'charges-matcher',
  dirname: __dirname,
  typeDefs: [chargesMatcherTypeDefs],
  resolvers: [chargesMatcherResolvers],
  providers: [ChargesMatcherProvider],
});

export { ChargesMatcherProvider } from './providers/charges-matcher.provider.js';
export * as ChargesMatcherTypes from './types.js';
