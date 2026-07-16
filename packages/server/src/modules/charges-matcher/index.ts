import { createModule } from 'graphql-modules';
import { ChargesMatcherProvider } from './providers/charges-matcher.provider.js';
import { QueueMatchEvaluatorProvider } from './providers/queue-match-evaluator.provider.js';
import { chargesMatcherResolvers } from './resolvers/index.js';
import chargesMatcherTypeDefs from './typeDefs/charges-matcher.graphql.js';

const __dirname = import.meta.dirname;

export const chargesMatcherModule = createModule({
  id: 'charges-matcher',
  dirname: __dirname,
  typeDefs: [chargesMatcherTypeDefs],
  resolvers: [chargesMatcherResolvers],
  providers: () => [ChargesMatcherProvider, QueueMatchEvaluatorProvider],
});

export * as ChargesMatcherTypes from './types.js';
