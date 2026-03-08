import { createModule } from 'graphql-modules';
import { adminContextResolvers } from './resolvers/admin-context.resolvers.js';
import adminContext from './typeDefs/admin-context.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const adminContextModule = createModule({
  id: 'adminContext',
  dirname: __dirname,
  typeDefs: [adminContext],
  resolvers: [adminContextResolvers],
});

export * as AdminContextTypes from './types.js';
