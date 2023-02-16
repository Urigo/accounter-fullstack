import { createApplication } from 'graphql-modules';
import postgres from 'pg';
import { CloudinaryProvider } from '@modules/app-providers/cloudinary.js';
import { GreenInvoiceProvider } from '@modules/app-providers/green-invoice.js';
import { accountantApprovalModule } from './modules/accountant-approval/index.js';
import { DBProvider } from './modules/app-providers/db.provider.js';
import { businessTripModule } from './modules/business-trip/index.js';
import { chargesModule } from './modules/charges/index.js';
import { commonModule } from './modules/common/index.js';
import { documentsModule } from './modules/documents/index.js';
import { financialAccountsModule } from './modules/financial-accounts/index.js';
import { financialEntitiesModule } from './modules/financial-entities/index.js';
import { hashavshevetModule } from './modules/hashavshevet/index.js';
import { ledgerModule } from './modules/ledger/index.js';
import { reportsModule } from './modules/reports/index.js';
import { tagsModule } from './modules/tags/index.js';

const { Pool } = postgres;

export async function createGraphQLApp() {
  return createApplication({
    modules: [
      commonModule,
      accountantApprovalModule,
      businessTripModule,
      chargesModule,
      documentsModule,
      financialAccountsModule,
      financialEntitiesModule,
      hashavshevetModule,
      ledgerModule,
      reportsModule,
      tagsModule,
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
