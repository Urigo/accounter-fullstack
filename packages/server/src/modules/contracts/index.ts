import { createModule } from 'graphql-modules';
import { ContractsProvider } from './providers/contracts.provider.js';
import { contractsResolvers } from './resolvers/contracts.resolver.js';
import contracts from './typeDefs/contracts.graphql.js';

const __dirname = import.meta.dirname;

export const contractsModule = createModule({
  id: 'contracts',
  dirname: __dirname,
  typeDefs: [contracts],
  resolvers: [contractsResolvers],
  providers: () => [ContractsProvider],
});

export * as ContractsTypes from './types.js';
