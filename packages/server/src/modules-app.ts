import { createApplication, Scope } from 'graphql-modules';
import postgres from 'pg';
import type { UserType } from 'plugins/auth-plugin.js';
import { deprecationModule } from '@modules/deprecation/index.js';
import { accountantApprovalModule } from './modules/accountant-approval/index.js';
import { CloudinaryProvider } from './modules/app-providers/cloudinary.js';
import { CoinMarketCapProvider } from './modules/app-providers/coinmarketcap.js';
import { DBProvider } from './modules/app-providers/db.provider.js';
import { GreenInvoiceProvider } from './modules/app-providers/green-invoice.js';
import { businessTripsModule } from './modules/business-trips/index.js';
import { chargesModule } from './modules/charges/index.js';
import { chartsModule } from './modules/charts/index.js';
import { commonModule } from './modules/common/index.js';
import { cornJobsModule } from './modules/corn-jobs/index.js';
import { dividendsModule } from './modules/dividends/index.js';
import { documentsModule } from './modules/documents/index.js';
import { exchangeRatesModule } from './modules/exchange-rates/index.js';
import { financialAccountsModule } from './modules/financial-accounts/index.js';
import { financialEntitiesModule } from './modules/financial-entities/index.js';
import { ledgerModule } from './modules/ledger/index.js';
import { miscExpensesModule } from './modules/misc-expenses/index.js';
import { reportsModule } from './modules/reports/index.js';
import { salariesModule } from './modules/salaries/index.js';
import { sortCodesModule } from './modules/sort-codes/index.js';
import { tagsModule } from './modules/tags/index.js';
import { transactionsModule } from './modules/transactions/index.js';
import { ENVIRONMENT } from './shared/tokens.js';
import type { Environment } from './shared/types/index.js';

const { Pool } = postgres;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace GraphQLModules {
    interface GlobalContext {
      env: Environment;
      currentUser: UserType;
    }
  }
}

export async function createGraphQLApp(env: Environment) {
  return createApplication({
    modules: [
      commonModule,
      accountantApprovalModule,
      businessTripsModule,
      chargesModule,
      cornJobsModule,
      deprecationModule,
      documentsModule,
      dividendsModule,
      exchangeRatesModule,
      financialAccountsModule,
      financialEntitiesModule,
      ledgerModule,
      miscExpensesModule,
      reportsModule,
      salariesModule,
      sortCodesModule,
      tagsModule,
      transactionsModule,
      chartsModule,
    ],
    providers: [
      {
        provide: Pool,
        useFactory: () =>
          new Pool({
            user: env.postgres.user,
            password: env.postgres.password,
            host: env.postgres.host,
            port: Number(env.postgres.port),
            database: env.postgres.db,
            ssl: env.postgres.ssl ? { rejectUnauthorized: false } : false,
          }),
      },
      DBProvider,
      CloudinaryProvider,
      GreenInvoiceProvider,
      CoinMarketCapProvider,
      {
        provide: ENVIRONMENT,
        useValue: env,
        scope: Scope.Singleton,
      },
    ],
  });
}
