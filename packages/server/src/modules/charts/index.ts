import { fileURLToPath } from 'node:url';
import { createModule } from 'graphql-modules';
import { chartsResolvers } from './resolvers/charts.resolver.js';
import charts from './typeDefs/charts.graphql.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const chartsModule = createModule({
  id: 'charts',
  dirname: __dirname,
  typeDefs: [charts],
  resolvers: [chartsResolvers],
  providers: () => [],
});

export * as ChartsTypes from './types.js';
