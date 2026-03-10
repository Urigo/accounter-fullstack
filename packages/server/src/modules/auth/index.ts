import { createModule } from 'graphql-modules';
import { AcceptInvitationsProvider } from './providers/accept-invitations.provider.js';
import { ApiKeysProvider } from './providers/api-keys.provider.js';
import { Auth0ManagementProvider } from './providers/auth0-management.provider.js';
import { AuthorizationProvider } from './providers/authorization.provider.js';
import { BusinessUsersProvider } from './providers/business-users.provider.js';
import { InvitationsProvider } from './providers/invitations.provider.js';
import { apiKeysResolvers } from './resolvers/api-keys.resolver.js';
import { invitationsResolvers } from './resolvers/invitations.resolver.js';
import authDirectives from './typeDefs/auth.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const authModule = createModule({
  id: 'auth',
  dirname: __dirname,
  typeDefs: [authDirectives],
  resolvers: [invitationsResolvers, apiKeysResolvers],
  providers: () => [
    AcceptInvitationsProvider,
    Auth0ManagementProvider,
    // AuthContextProvider is added in the root module to avoid circular dependency
    AuthorizationProvider,
    ApiKeysProvider,
    BusinessUsersProvider,
    InvitationsProvider,
  ],
});

export * from './directives/auth-directives.js';
