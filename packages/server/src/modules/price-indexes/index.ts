import { createModule } from 'graphql-modules';
import { PriceIndexSyncProvider } from './providers/price-index-sync.provider.js';
import { PriceIndexesProvider } from './providers/price-indexes.provider.js';
import { priceIndexesResolvers } from './resolvers/price-indexes.resolver.js';
import priceIndexes from './typeDefs/price-indexes.graphql.js';

const __dirname = import.meta.dirname;

export const priceIndexesModule = createModule({
  id: 'priceIndexes',
  dirname: __dirname,
  typeDefs: [priceIndexes],
  resolvers: [priceIndexesResolvers],
  providers: () => [PriceIndexesProvider, PriceIndexSyncProvider],
});
