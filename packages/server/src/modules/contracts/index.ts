import contracts from './typeDefs/contracts.graphql.js';
import { createModule } from 'graphql-modules';
import { ContractsProvider } from './providers/contracts.provider.js';
import { contractsResolvers } from './resolvers/contracts.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const contractsModule = createModule({
  id: 'contracts',
  dirname: __dirname,
  typeDefs: [contracts],
  resolvers: [contractsResolvers],
  providers: () => [ContractsProvider],
});

export * as ContractsTypes from './types.js';
