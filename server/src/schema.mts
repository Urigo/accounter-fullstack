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

import { createApplication } from 'graphql-modules';
import { Pool } from 'pg';
import { commonModule } from './modules/common/index.mjs';

export async function createGraphQLApp() {
  return createApplication({
    modules: [commonModule],
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
