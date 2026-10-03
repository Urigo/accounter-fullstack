import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { PendingInvitationsProvider } from '../../auth/providers/pending-invitations.provider.js';
import type { CommonModule } from '../types.js';

/**
 * `viewer` is intentionally not `@requiresAuth`: its whole purpose is to describe
 * identities that have no auth context yet (a valid Auth0 login that is not linked
 * to any business). It therefore verifies the JWT itself via `getJwtIdentity()` and
 * returns nothing beyond the caller's own token claims.
 */
export const viewerResolvers: CommonModule.Resolvers = {
  Query: {
    viewer: async (_, __, { injector }) => {
      const authProvider = injector.get(AuthContextProvider);

      // A resolvable auth context means the identity is linked to at least one
      // business. This also covers the non-JWT auth types (API key, dev bypass).
      const authContext = await authProvider.getAuthContext();
      if (authContext?.user) {
        return {
          email: authContext.user.email || null,
          emailVerified: authContext.user.emailVerified,
          status: 'ACTIVE',
          // Already inside a workspace: any further invitations are claimed
          // through the emailed link, not through this screen.
          pendingInvitations: [],
        };
      }

      // No context: fall back to the raw verified identity. Absent/invalid
      // credentials resolve to null here, and `viewer` stays null.
      const identity = await authProvider.getJwtIdentity();
      if (!identity) {
        return null;
      }

      if (!identity.emailVerified || !identity.email) {
        // An unverified address proves nothing about who the caller is, so it
        // must never be matched against invitations.
        return {
          email: identity.email,
          emailVerified: identity.emailVerified,
          status: 'EMAIL_UNVERIFIED',
          pendingInvitations: [],
        };
      }

      const pendingInvitations = await injector
        .get(PendingInvitationsProvider)
        .getPendingInvitationsByVerifiedEmail(identity.email);

      return {
        email: identity.email,
        emailVerified: true,
        status: 'NO_WORKSPACE',
        pendingInvitations,
      };
    },
  },
};
