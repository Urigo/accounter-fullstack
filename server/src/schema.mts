// import { loadFiles } from '@graphql-tools/load-files';
// import { makeExecutableSchema } from '@graphql-tools/schema';
// // import { addMocksToSchema } from '@graphql-tools/mock';
// import { resolvers } from './resolvers/index.mjs';
// export const getSchema = async () =>
//   makeExecutableSchema({
//     typeDefs: await loadFiles('../*.graphql'),
//     resolvers,
//   });
// // const schemaWithMocks = addMocksToSchema({ schema });
import { accountantApprovalModule } from './modules/accountant-approval/index.mjs';
import { businessTripModule } from './modules/business-trip/index.mjs';
import { chargesModule } from './modules/charges/index.mjs';
import { commonModule } from './modules/common/index.mjs';
import { documentsModule } from './modules/documents/index.mjs';
import { financialAccountsModule } from './modules/financial-accounts/index.mjs';
import { financialEntitiesModule } from './modules/financial-entities/index.mjs';
import { hashavshevetModule } from './modules/hashavshevet/index.mjs';
import { ledgerModule } from './modules/ledger/index.mjs';
import { reportsModule } from './modules/reports/index.mjs';
import { tagsModule } from './modules/tags/index.mjs';
import { createApplication } from 'graphql-modules';
import postgres from 'pg';

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
    ],
  });
}
