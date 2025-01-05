import { createApplication, Scope } from 'graphql-modules';
import postgres from 'pg';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { GraphQLResolverMap } from '@apollo/subgraph/dist/schema-helper/resolverMap.js';
import { mergeResolvers, mergeTypeDefs } from '@graphql-tools/merge';
import { AnthropicProvider } from '@modules/app-providers/anthropic.js';
import { GoogleDriveProvider } from '@modules/app-providers/google-drive/google-drive.provider.js';
import { corporateTaxesModule } from '@modules/corporate-taxes/index.js';
import { countriesModule } from '@modules/countries/index.js';
import { depreciationModule } from '@modules/depreciation/index.js';
import { vatModule } from '@modules/vat/index.js';
import { Currency } from '@shared/gql-types';
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
import type { Environment, UserType } from './shared/types/index.js';

const { Pool } = postgres;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace GraphQLModules {
    interface GlobalContext {
      env: Environment;
      currentUser: UserType;
      adminContext: AdminContext;
    }
  }
}

export async function createGraphQLApp(env: Environment) {
  return createApplication({
    schemaBuilder: ({ typeDefs, resolvers }) => {
      return buildSubgraphSchema({
        typeDefs: mergeTypeDefs(typeDefs),
        resolvers: mergeResolvers(resolvers) as unknown as GraphQLResolverMap<unknown>,
      });
    },
    modules: [
      commonModule,
      accountantApprovalModule,
      businessTripsModule,
      chargesModule,
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
      AnthropicProvider,
      GoogleDriveProvider,
      {
        provide: ENVIRONMENT,
        useValue: env,
        scope: Scope.Singleton,
      },
    ],
  });
}

export type AdminContext = {
  defaultLocalCurrency: Currency;
  defaultCryptoConversionFiatCurrency: Currency;
  defaultAdminBusinessId: string;
  defaultTaxCategoryId: string;
  authorities: {
    vatBusinessId: string;
    inputVatTaxCategoryId: string;
    outputVatTaxCategoryId: string;
    taxBusinessId: string;
    taxExpensesTaxCategoryId: string;
    socialSecurityBusinessId: string;
    vatReportExcludedBusinessNames: string[];
  };
  general: {
    taxCategories: {
      exchangeRateTaxCategoryId: string;
      incomeExchangeRateTaxCategoryId: string;
      exchangeRevaluationTaxCategoryId: string;
      feeTaxCategoryId: string;
      generalFeeTaxCategoryId: string;
      fineTaxCategoryId: string;
      untaxableGiftsTaxCategoryId: string;
      balanceCancellationTaxCategoryId: string;
      developmentForeignTaxCategoryId: string;
      developmentLocalTaxCategoryId: string;
    };
  };
  crossYear: {
    expensesToPayTaxCategoryId: string;
    expensesInAdvanceTaxCategoryId: string;
    incomeToCollectTaxCategoryId: string;
    incomeInAdvanceTaxCategoryId: string;
  };
  financialAccounts: {
    poalimBusinessId: string | null;
    discountBusinessId: string | null;
    swiftBusinessId: string | null;
    isracardBusinessId: string | null;
    amexBusinessId: string | null;
    calBusinessId: string | null;
    etanaBusinessId: string | null;
    krakenBusinessId: string | null;
    etherScanBusinessId: string | null;
    bankAccountIds: string[];
    creditCardIds: string[];
    internalWalletsIds: string[];
  };
  bankDeposits: {
    bankDepositBusinessId: string | null;
    bankDepositInterestIncomeTaxCategoryId: string | null;
  };
  salaries: {
    zkufotExpensesTaxCategoryId: string | null;
    zkufotIncomeTaxCategoryId: string | null;
    socialSecurityExpensesTaxCategoryId: string | null;
    salaryExpensesTaxCategoryId: string | null;
    trainingFundExpensesTaxCategoryId: string | null;
    compensationFundExpensesTaxCategoryId: string | null;
    pensionExpensesTaxCategoryId: string | null;
    batchedEmployeesBusinessId: string | null;
    batchedFundsBusinessId: string | null;
    salaryBatchedBusinessIds: string[];
    taxDeductionsBusinessId: string | null;
    recoveryReserveExpensesTaxCategoryId: string | null;
    recoveryReserveTaxCategoryId: string | null;
    vacationReserveExpensesTaxCategoryId: string | null;
    vacationReserveTaxCategoryId: string | null;
  };
  businessTrips: {
    businessTripTaxCategoryId: string | null;
    businessTripTagId: string | null;
  };
  dividends: {
    dividendWithholdingTaxBusinessId: string | null;
    dividendTaxCategoryId: string | null;
    dividendPaymentBusinessIds: string[];
    dividendBusinessIds: string[];
  };
  depreciation: {
    accumulatedDepreciationTaxCategoryId: string | null;
    rndDepreciationExpensesTaxCategoryId: string | null;
    gnmDepreciationExpensesTaxCategoryId: string | null;
    marketingDepreciationExpensesTaxCategoryId: string | null;
  };
};
