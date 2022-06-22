import { loadFiles } from '@graphql-tools/load-files';
import { makeExecutableSchema } from '@graphql-tools/schema';

// import { addMocksToSchema } from '@graphql-tools/mock';
import { resolvers } from './resolvers.mjs';

export const getSchema = async () =>
  makeExecutableSchema({
    typeDefs: await loadFiles('../*.graphql'),
    resolvers,
  });
// const schemaWithMocks = addMocksToSchema({ schema });
