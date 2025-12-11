import { createModule } from 'graphql-modules';
import { AdminContextProvider } from './providers/admin-context.provider.js';
import { adminContextResolvers } from './resolvers/admin-context.resolvers.js';
import adminContext from './typeDefs/admin-context.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const adminContextModule = createModule({
  id: 'adminContext',
  dirname: __dirname,
  typeDefs: [adminContext],
  resolvers: [adminContextResolvers],
  providers: () => [AdminContextProvider],
});

export * as AdminContextTypes from './types.js';
