import sortCodes from './typeDefs/sort-codes.graphql.js';
import { createModule } from 'graphql-modules';
import { SortCodesProvider } from './providers/sort-codes.provider.js';
import { sortCodesResolvers } from './resolvers/sort-codes.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const sortCodesModule = createModule({
  id: 'sortCodes',
  dirname: __dirname,
  typeDefs: [sortCodes],
  resolvers: [sortCodesResolvers],
  providers: () => [SortCodesProvider],
});

export * as SortCodesTypes from './types.js';
