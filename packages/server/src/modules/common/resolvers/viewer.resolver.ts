import type { Injector } from 'graphql-modules';
import { AcceptInvitationsProvider } from '../../auth/providers/accept-invitations.provider.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { Auth0ManagementProvider } from '../../auth/providers/auth0-management.provider.js';
import { SuperAdminProvider } from '../../auth/providers/super-admin.provider.js';
import type { CommonModule } from '../types.js';

/**
 * The caller's email and whether it is verified, for an identity linked to no business.
 *
 * Access tokens for a custom API often carry no `email` claim. Without one, the token alone would
 * report every such caller as unverified, so the Auth0 profile is read instead, as
 * `acceptInvitation` does. A failed lookup keeps what the token said.
 */
async function resolveUnlinkedEmail(
  injector: Injector,
  identity: { auth0UserId: string; email: string | null; emailVerified: boolean },
): Promise<{ email: string | null; emailVerified: boolean }> {
  if (identity.email) {
    return { email: identity.email, emailVerified: identity.emailVerified };
  }
  try {
    const profile = await injector
      .get(Auth0ManagementProvider)
      .getUserEmailById(identity.auth0UserId);
    if (profile?.email) {
      return { email: profile.email, emailVerified: profile.emailVerified };
    }
  } catch {
    // Auth0 management not configured or unreachable: fall back to the token's claims.
  }
  return { email: identity.email, emailVerified: identity.emailVerified };
}

async function hasPendingInvitation(injector: Injector, email: string | null): Promise<boolean> {
  if (!email) {
    return false;
  }
  try {
    return await injector.get(AcceptInvitationsProvider).hasPendingInvitationForEmail(email);
  } catch (error) {
    // A hint for the welcome screen; never fail `viewer` (the boot request) over it.
    console.error('Failed to check pending invitations for viewer:', error);
    return false;
  }
}

async function isSuperAdmin(injector: Injector, auth0UserId: string | undefined): Promise<boolean> {
  if (!auth0UserId) {
    return false;
  }
  try {
    return await injector.get(SuperAdminProvider).isSuperAdmin(auth0UserId);
  } catch (error) {
    // Hides super-admin UI only; the operations themselves check again on the server.
    console.error('Failed to check super-admin status for viewer:', error);
    return false;
  }
}

/**
 * `viewer` is intentionally not `@requiresAuth`: its whole purpose is to describe
 * identities that have no auth context yet (a valid Auth0 login that is not linked
 * to any business). It therefore verifies the JWT itself via `getJwtIdentity()` and
 * returns nothing beyond the caller's own identity and provisioning state.
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
          // API keys and the gateway identity carry no Auth0 subject, so they are never one.
          isSuperAdmin: await isSuperAdmin(injector, authContext.user.auth0UserId ?? undefined),
          hasPendingInvitation: false,
        };
      }

      // No context: fall back to the raw verified identity. Absent/invalid
      // credentials resolve to null here, and `viewer` stays null.
      const identity = await authProvider.getJwtIdentity();
      if (!identity) {
        return null;
      }

      const { email, emailVerified } = await resolveUnlinkedEmail(injector, identity);

      return {
        email,
        emailVerified,
        status: emailVerified ? 'NO_WORKSPACE' : 'EMAIL_UNVERIFIED',
        // Super-admin operations need a business membership (see `requireSuperAdmin`).
        isSuperAdmin: false,
        hasPendingInvitation: await hasPendingInvitation(injector, email),
      };
    },
  },
};
