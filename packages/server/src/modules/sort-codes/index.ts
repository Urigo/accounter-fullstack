import { fileURLToPath } from 'node:url';
import { createModule } from 'graphql-modules';
import { SortCodesProvider } from './providers/sort-codes.provider.js';
import { sortCodesResolvers } from './resolvers/sort-codes.resolver.js';
import sortCodes from './typeDefs/sort-codes.graphql.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const sortCodesModule = createModule({
  id: 'sortCodes',
  dirname: __dirname,
  typeDefs: [sortCodes],
  resolvers: [sortCodesResolvers],
  providers: () => [SortCodesProvider],
});

export * as SortCodesTypes from './types.js';
