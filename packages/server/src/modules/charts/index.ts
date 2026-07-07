import { createModule } from 'graphql-modules';
import { chartsResolvers } from './resolvers/charts.resolver.js';
import charts from './typeDefs/charts.graphql.js';

const __dirname = import.meta.dirname;

export const chartsModule = createModule({
  id: 'charts',
  dirname: __dirname,
  typeDefs: [charts],
  resolvers: [chartsResolvers],
  providers: () => [],
});

export * as ChartsTypes from './types.js';
