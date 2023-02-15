import hashavshevet from './typeDefs/hashavshevet.graphql.js';
import sortCodes from './typeDefs/sort-codes.graphql.js';
import { createModule } from 'graphql-modules';
import { AccountCardsProvider } from './providers/account-cards.provider.js';
import { HashavshevetProvider } from './providers/hashavshevet.provider.js';
import { SortCodesProvider } from './providers/sort-codes.provider.js';
import { hashavshevetResolvers } from './resolvers/hashavshevet.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const hashavshevetModule = createModule({
  id: 'hashavshevet',
  dirname: __dirname,
  typeDefs: [hashavshevet, sortCodes],
  resolvers: [hashavshevetResolvers],
  providers: () => [HashavshevetProvider, AccountCardsProvider, SortCodesProvider],
});

export * as HashavshevetTypes from './types.js';
