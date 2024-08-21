import charts from './typeDefs/charts.graphql.js';
import { createModule } from 'graphql-modules';
import { chartsResolvers } from './resolvers/charts.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const chartsModule = createModule({
  id: 'charts',
  dirname: __dirname,
  typeDefs: [charts],
  resolvers: [chartsResolvers],
  providers: () => [],
});

export * as ChartsTypes from './types.js';
