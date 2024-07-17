import pcn from './typeDefs/pcn.graphql.js';
import profitAndLoss from './typeDefs/profit-and-loss.graphql.js';
import taxReport from './typeDefs/tax-report.graphql.js';
import vatReport from './typeDefs/vat-report.graphql.js';
import { createModule } from 'graphql-modules';
import { reportsResolvers } from './resolvers/reports.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const reportsModule = createModule({
  id: 'reports',
  dirname: __dirname,
  typeDefs: [vatReport, pcn, profitAndLoss, taxReport],
  resolvers: [reportsResolvers],
  providers: () => [],
});

export * as ReportsTypes from './types.js';
