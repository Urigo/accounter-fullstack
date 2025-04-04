import balanceReport from './typeDefs/balance-report.graphql.js';
import corporateTaxRulingComplianceReport from './typeDefs/corporate-tax-ruling-compliance-report.graphql.js';
import dynamicReport from './typeDefs/dynamic-report.graphql.js';
import pcn from './typeDefs/pcn.graphql.js';
import profitAndLoss from './typeDefs/profit-and-loss.graphql.js';
import taxReport from './typeDefs/tax-report.graphql.js';
import vatReport from './typeDefs/vat-report.graphql.js';
import yearlyLedger from './typeDefs/yearly-ledger.graphql.js';
import { createModule } from 'graphql-modules';
import { BalanceReportProvider } from './providers/balance-report.provider.js';
import { DynamicReportProvider } from './providers/dynamic-report.provider.js';
import { balanceReportResolver } from './resolvers/balance-report.resolver.js';
import { dynamicReportResolver } from './resolvers/dynamic-report.resolver.js';
import { reportsResolvers } from './resolvers/reports.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const reportsModule = createModule({
  id: 'reports',
  dirname: __dirname,
  typeDefs: [
    vatReport,
    pcn,
    profitAndLoss,
    taxReport,
    corporateTaxRulingComplianceReport,
    yearlyLedger,
    dynamicReport,
    balanceReport,
  ],
  resolvers: [reportsResolvers, dynamicReportResolver, balanceReportResolver],
  providers: () => [DynamicReportProvider, BalanceReportProvider],
});

export * as ReportsTypes from './types.js';
