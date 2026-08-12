import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
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
        };
      }

      // No context: fall back to the raw verified identity. Absent/invalid
      // credentials resolve to null here, and `viewer` stays null.
      const identity = await authProvider.getJwtIdentity();
      if (!identity) {
        return null;
      }

      return {
        email: identity.email,
        emailVerified: identity.emailVerified,
        status: identity.emailVerified ? 'NO_WORKSPACE' : 'EMAIL_UNVERIFIED',
      };
    },
  },
};
