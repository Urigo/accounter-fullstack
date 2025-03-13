import deel from './typeDefs/deel.graphql.js';
import { createModule } from 'graphql-modules';
import { DeelProvider } from './providers/deel.provider.js';
import { deelResolvers } from './resolvers/deel.resolvers.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const deelModule = createModule({
  id: 'deel',
  dirname: __dirname,
  typeDefs: [deel],
  resolvers: [deelResolvers],
  providers: () => [DeelProvider],
});

export * as DeelTypes from './types.js';
