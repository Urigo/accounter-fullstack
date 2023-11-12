import salaries from './typeDefs/salaries.graphql.js';
import { createModule } from 'graphql-modules';
import { SalariesProvider } from './providers/salaries.provider.js';
import { salariesResolvers } from './resolvers/salaries.resolvers.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const salariesModule = createModule({
  id: 'salaries',
  dirname: __dirname,
  typeDefs: [salaries],
  resolvers: [salariesResolvers],
  providers: [SalariesProvider],
});

export * as SalariesTypes from './types.js';
