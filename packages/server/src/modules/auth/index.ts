import { createModule } from 'graphql-modules';
import { Auth0ManagementProvider } from './providers/auth0-management.provider.js';
import { AuthorizationProvider } from './providers/authorization.provider.js';
import authDirectives from './typeDefs/auth.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const authModule = createModule({
  id: 'auth',
  dirname: __dirname,
  typeDefs: [authDirectives],
  providers: () => [Auth0ManagementProvider, AuthorizationProvider], // AuthContextProvider is added in the root module to avoid circular dependency
});

export * from './directives/auth-directives.js';
