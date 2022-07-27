import { config } from 'dotenv';
import { createApplication } from 'graphql-modules';
import pkg from 'pg';

import { accountantModule } from './accountant/index.mjs';
import { chargesModule } from './charges/index.mjs';
import { commonModule } from './common/index.mjs';
import { documentsModule } from './documents/index.mjs';
import { financialAccountsModule } from './financial-accounts/index.mjs';
import { financialEntitiesModule } from './financial-entities/index.mjs';
import { HashavshevetModule } from './hashavshevet/index.mjs';
import { ledgerRecordsModule } from './ledger-records/index.mjs';
import { ExchangeProvider } from './providers/exchange.providers.mjs';
import { TaxesModule } from './taxes/index.mjs';

config();

const { Pool } = pkg;

export function createGraphQLApp() {
  return createApplication({
    modules: [
      accountantModule,
      chargesModule,
      commonModule,
      documentsModule,
      financialAccountsModule,
      financialEntitiesModule,
      HashavshevetModule,
      ledgerRecordsModule,
      TaxesModule,
    ],
    providers: [
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
      ExchangeProvider,
    ],
  });
}
