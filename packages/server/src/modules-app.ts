import { CONTEXT, createApplication, Scope } from 'graphql-modules';
import pg from 'pg';
import { accountantApprovalModule } from './modules/accountant-approval/index.js';
import { adminContextModule } from './modules/admin-context/index.js';
import { AdminContextProvider } from './modules/admin-context/providers/admin-context.provider.js';
import { AnthropicProvider } from './modules/app-providers/anthropic.js';
import { CloudinaryProvider } from './modules/app-providers/cloudinary.js';
import { CoinMarketCapProvider } from './modules/app-providers/coinmarketcap.js';
import { DBProvider } from './modules/app-providers/db.provider.js';
import { DeelClientProvider } from './modules/app-providers/deel/deel-client.provider.js';
import { PriorityClientProvider } from './modules/app-providers/priority/priority-client.provider.js';
// import { GmailServiceProvider } from './modules/app-providers/gmail-listener/gmail-service.provider.js';
// import { PubsubServiceProvider } from './modules/app-providers/gmail-listener/pubsub-service.provider.js';
import { GoogleDriveProvider } from './modules/app-providers/google-drive/google-drive.provider.js';
import { GreenInvoiceClientProvider } from './modules/app-providers/green-invoice-client.js';
import { TenantAwareDBClient } from './modules/app-providers/tenant-db-client.js';
import { authDirectiveTransformer } from './modules/auth/directives/auth-directives.js';
import { authModule } from './modules/auth/index.js';
import { AuthContextProvider } from './modules/auth/providers/auth-context.provider.js';
import { bankDepositsModule } from './modules/bank-deposits/index.js';
import { businessTripsModule } from './modules/business-trips/index.js';
import { chargesMatcherModule } from './modules/charges-matcher/index.js';
import { chargesModule } from './modules/charges/index.js';
import { chartsModule } from './modules/charts/index.js';
import { commonModule } from './modules/common/index.js';
import { contractsModule } from './modules/contracts/index.js';
import { cornJobsModule } from './modules/corn-jobs/index.js';
import { corporateTaxesModule } from './modules/corporate-taxes/index.js';
import { countriesModule } from './modules/countries/index.js';
import { deelModule } from './modules/deel/index.js';
import { depreciationModule } from './modules/depreciation/index.js';
import { dividendsModule } from './modules/dividends/index.js';
import { documentsModule } from './modules/documents/index.js';
import { exchangeRatesModule } from './modules/exchange-rates/index.js';
import { financialAccountsModule } from './modules/financial-accounts/index.js';
import { financialEntitiesModule } from './modules/financial-entities/index.js';
import { greenInvoiceModule } from './modules/green-invoice/index.js';
import { ledgerModule } from './modules/ledger/index.js';
import { miscExpensesModule } from './modules/misc-expenses/index.js';
import { reportsModule } from './modules/reports/index.js';
import { salariesModule } from './modules/salaries/index.js';
import { sortCodesModule } from './modules/sort-codes/index.js';
import { tagsModule } from './modules/tags/index.js';
import { transactionsModule } from './modules/transactions/index.js';
import { vatModule } from './modules/vat/index.js';
import { workspaceSettingsModule } from './modules/workspace-settings/index.js';
import { priorityModule } from './modules/priority/index.js';
import type { RawAuth } from './plugins/auth-plugin.js';
import { ENVIRONMENT, RAW_AUTH } from './shared/tokens.js';
import type { Environment } from './shared/types/index.js';

const { Pool } = pg;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace GraphQLModules {
    interface GlobalContext {
      env: Environment;
      rawAuth: RawAuth;
    }
  }
}

export async function createGraphQLApp(env: Environment, pool: pg.Pool) {
  const application = createApplication({
    modules: [
      commonModule,
      authModule,
      accountantApprovalModule,
      businessTripsModule,
      chargesModule,
      chargesMatcherModule,
      cornJobsModule,
      depreciationModule,
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
      corporateTaxesModule,
      countriesModule,
      vatModule,
      deelModule,
      greenInvoiceModule,
      contractsModule,
      bankDepositsModule,
      adminContextModule,
      workspaceSettingsModule,
      priorityModule,
    ],
    providers: [
      {
        provide: Pool,
        useFactory: () => pool,
      },
      DBProvider,
      {
        provide: ENVIRONMENT,
        useValue: env,
        scope: Scope.Singleton,
      },
      {
        provide: RAW_AUTH,
        useFactory: (context: GraphQLModules.GlobalContext) => {
          // This bridges the Yoga context rawAuth to the InjectionToken
          return context.rawAuth || { authType: null, token: null };
        },
        scope: Scope.Operation,
        deps: [CONTEXT],
      },
      AuthContextProvider,
      TenantAwareDBClient,
      AdminContextProvider,
      CloudinaryProvider,
      DeelClientProvider,
      PriorityClientProvider,
      GreenInvoiceClientProvider,
      CoinMarketCapProvider,
      AnthropicProvider,
      GoogleDriveProvider,
      // TODO: add GmailListener back after required adjustments where made
      // ...(env.gmail ? [GmailServiceProvider, PubsubServiceProvider] : []),
    ],
  });

  const transformedSchema = authDirectiveTransformer(application.schema);

  return {
    application,
    transformedSchema,
  };
}
