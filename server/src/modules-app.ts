import { createApplication } from 'graphql-modules';
import postgres from 'pg';
import { CloudinaryProvider } from '@modules/app-providers/cloudinary.js';
import { GreenInvoiceProvider } from '@modules/app-providers/green-invoice.js';
import { exchangeRatesModule } from '@modules/exchange-rates/index.js';
import { salariesModule } from '@modules/salaries/index.js';
import { accountantApprovalModule } from './modules/accountant-approval/index.js';
import { DBProvider } from './modules/app-providers/db.provider.js';
import { businessTripsModule } from './modules/business-trips/index.js';
import { chargesModule } from './modules/charges/index.js';
import { commonModule } from './modules/common/index.js';
import { documentsModule } from './modules/documents/index.js';
import { financialAccountsModule } from './modules/financial-accounts/index.js';
import { financialEntitiesModule } from './modules/financial-entities/index.js';
import { ledgerModule } from './modules/ledger/index.js';
import { reportsModule } from './modules/reports/index.js';
import { sortCodesModule } from './modules/sort-codes/index.js';
import { tagsModule } from './modules/tags/index.js';
import { transactionsModule } from './modules/transactions/index.js';

const { Pool } = postgres;

export async function createGraphQLApp() {
  return createApplication({
    modules: [
      commonModule,
      accountantApprovalModule,
      businessTripsModule,
      chargesModule,
      documentsModule,
      exchangeRatesModule,
      financialAccountsModule,
      financialEntitiesModule,
      ledgerModule,
      reportsModule,
      salariesModule,
      sortCodesModule,
      tagsModule,
      transactionsModule,
    ],
    providers: () => [
      {
        provide: Pool,
        useFactory: () =>
          new Pool({
            connectionString: process.env.PGURI,
            ssl: {
              rejectUnauthorized: false,
            },
          }),
      },
      DBProvider,
      CloudinaryProvider,
      GreenInvoiceProvider,
    ],
  });
}
