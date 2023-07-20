import exchange from './typeDefs/exchange.graphql.js';
import { createModule } from 'graphql-modules';
import { ExchangeProvider } from './providers/exchange.provider.js';
import { exchangeResolvers } from './resolvers/exchange.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const exchangeRatesModule = createModule({
  id: 'exchangeRates',
  dirname: __dirname,
  typeDefs: [exchange],
  resolvers: [exchangeResolvers],
  providers: () => [ExchangeProvider],
});

export * as LedgerTypes from './types.js';
