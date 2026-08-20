import { createModule } from 'graphql-modules';
import { ForeignSecuritiesProvider } from './providers/foreign-securities.provider.js';
import { SecurityBusinessesProvider } from './providers/security-businesses.provider.js';
import { foreignSecuritiesResolvers } from './resolvers/foreign-securities.resolver.js';
import { securityBusinessesResolvers } from './resolvers/security-businesses.resolver.js';
import foreignSecurities from './typeDefs/foreign-securities.graphql.js';
import securityBusinesses from './typeDefs/security-businesses.graphql.js';

const __dirname = import.meta.dirname;

export const foreignSecuritiesModule = createModule({
  id: 'foreignSecurities',
  dirname: __dirname,
  typeDefs: [foreignSecurities, securityBusinesses],
  resolvers: [foreignSecuritiesResolvers, securityBusinessesResolvers],
  providers: () => [ForeignSecuritiesProvider, SecurityBusinessesProvider],
});

export * as ForeignSecuritiesTypes from './types.js';
