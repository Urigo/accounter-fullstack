import exchange from './typeDefs/exchange.graphql.js';
import { createModule } from 'graphql-modules';
import { CryptoExchangeProvider } from './providers/crypto-exchange.provider.js';
import { ExchangeProvider } from './providers/exchange.provider.js';
import { FiatExchangeProvider } from './providers/fiat-exchange.provider.js';
import { exchangeResolvers } from './resolvers/exchange.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const exchangeRatesModule = createModule({
  id: 'exchangeRates',
  dirname: __dirname,
  typeDefs: [exchange],
  resolvers: [exchangeResolvers],
  providers: () => [ExchangeProvider, FiatExchangeProvider, CryptoExchangeProvider],
});

export * as LedgerTypes from './types.js';
