import balanceReport from './typeDefs/balance-report.graphql.js';
import corporateTaxRulingComplianceReport from './typeDefs/corporate-tax-ruling-compliance-report.graphql.js';
import depreciationReport from './typeDefs/depreciation-report.graphql.js';
import dynamicReport from './typeDefs/dynamic-report.graphql.js';
import pcn from './typeDefs/pcn.graphql.js';
import profitAndLoss from './typeDefs/profit-and-loss.graphql.js';
import shaam6111Report from './typeDefs/shaam6111-report.graphql.js';
import taxReport from './typeDefs/tax-report.graphql.js';
import vatReport from './typeDefs/vat-report.graphql.js';
import yearlyLedger from './typeDefs/yearly-ledger.graphql.js';
import { createModule } from 'graphql-modules';
import { BalanceReportProvider } from './providers/balance-report.provider.js';
import { DynamicReportProvider } from './providers/dynamic-report.provider.js';
import { VatReportProvider } from './providers/vat-report.provider.js';
import { balanceReportResolver } from './resolvers/balance-report.resolver.js';
import { depreciationReportResolvers } from './resolvers/depreciation-report.resolver.js';
import { dynamicReportResolver } from './resolvers/dynamic-report.resolver.js';
import { pcn874Resolvers } from './resolvers/pcn874.resolver.js';
import { reportsResolvers } from './resolvers/reports.resolver.js';
import { shaam6111Resolvers } from './resolvers/shaam6111.resolver.js';

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
    depreciationReport,
    shaam6111Report,
  ],
  resolvers: [
    reportsResolvers,
    dynamicReportResolver,
    balanceReportResolver,
    pcn874Resolvers,
    depreciationReportResolvers,
    shaam6111Resolvers,
  ],
  providers: () => [DynamicReportProvider, BalanceReportProvider, VatReportProvider],
});

export * as ReportsTypes from './types.js';
