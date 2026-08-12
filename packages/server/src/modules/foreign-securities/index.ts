import { createModule } from 'graphql-modules';
import { ForeignSecuritiesProvider } from './providers/foreign-securities.provider.js';
import { foreignSecuritiesResolvers } from './resolvers/foreign-securities.resolver.js';
import foreignSecurities from './typeDefs/foreign-securities.graphql.js';

const __dirname = import.meta.dirname;

export const foreignSecuritiesModule = createModule({
  id: 'foreignSecurities',
  dirname: __dirname,
  typeDefs: [foreignSecurities],
  resolvers: [foreignSecuritiesResolvers],
  providers: () => [ForeignSecuritiesProvider],
});

export * as ForeignSecuritiesTypes from './types.js';
