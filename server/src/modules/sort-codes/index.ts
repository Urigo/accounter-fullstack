import sortCodes from './typeDefs/sort-codes.graphql.js';
import { createModule } from 'graphql-modules';
import { AccountCardsProvider } from './providers/account-cards.provider.js';
import { SortCodesProvider } from './providers/sort-codes.provider.js';
import { sortCodesResolvers } from './resolvers/sort-codes.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const sortCodesModule = createModule({
  id: 'sort-codes',
  dirname: __dirname,
  typeDefs: [sortCodes],
  resolvers: [sortCodesResolvers],
  providers: () => [AccountCardsProvider, SortCodesProvider],
});

export * as HashavshevetTypes from './types.js';
