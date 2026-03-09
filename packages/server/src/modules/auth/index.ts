import { createModule } from 'graphql-modules';
import { AcceptInvitationsProvider } from './providers/accept-invitations.provider.js';
import { Auth0ManagementProvider } from './providers/auth0-management.provider.js';
import { AuthorizationProvider } from './providers/authorization.provider.js';
import { BusinessUsersProvider } from './providers/business-users.provider.js';
import { InvitationsProvider } from './providers/invitations.provider.js';
import { invitationsResolvers } from './resolvers/invitations.resolver.js';
import authDirectives from './typeDefs/auth.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const authModule = createModule({
  id: 'auth',
  dirname: __dirname,
  typeDefs: [authDirectives],
  resolvers: [invitationsResolvers],
  providers: () => [
    Auth0ManagementProvider,
    AuthorizationProvider,
    BusinessUsersProvider,
    InvitationsProvider,
    AcceptInvitationsProvider,
  ], // AuthContextProvider is added in the root module to avoid circular dependency
});

export * from './directives/auth-directives.js';
