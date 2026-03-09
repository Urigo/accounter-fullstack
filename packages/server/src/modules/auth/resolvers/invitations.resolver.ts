import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { GraphQLError } from 'graphql';
import { AuditLogsProvider } from '../../common/providers/audit-logs.provider.js';
import { ALLOWED_ROLES, mapAuth0Error } from '../helpers/invitations.helper.js';
import { AuthContextProvider } from '../providers/auth-context.provider.js';
import { Auth0ManagementProvider } from '../providers/auth0-management.provider.js';
import { BusinessUsersProvider } from '../providers/business-users.provider.js';
import { InvitationsProvider } from '../providers/invitations.provider.js';
import type { AuthModule } from '../types.js';

export const invitationsResolvers: AuthModule.Resolvers = {
  Mutation: {
    createInvitation: async (_, { email, roleId }, { injector }) => {
      const authProvider = injector.get(AuthContextProvider);
      const authContext = await authProvider.getAuthContext();

      if (!authContext?.user || !authContext.tenant?.businessId) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (authContext.user.roleId !== 'business_owner') {
        throw new GraphQLError('Requires role: business_owner', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (!ALLOWED_ROLES.has(roleId)) {
        throw new GraphQLError(`Invalid roleId: ${roleId}`, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const businessId = authContext.tenant.businessId;
      const inviterUserId = authContext.user.userId;

      const existingInvitation = await injector
        .get(InvitationsProvider)
        .getInvitationByEmailLoader.load(normalizedEmail);

      if ((existingInvitation?.length ?? 0) > 0) {
        throw new GraphQLError('An active invitation already exists for this user', {
          extensions: { code: 'INVITATION_ALREADY_PENDING' },
        });
      }

      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const localUserId = randomUUID();

      let auth0UserId: string;
      try {
        auth0UserId = await injector
          .get(Auth0ManagementProvider)
          .createBlockedUser(normalizedEmail);
      } catch (error) {
        throw mapAuth0Error(error);
      }

      try {
        const insertedInvitation = await injector.get(InvitationsProvider).insertInvitation({
          email: normalizedEmail,
          roleId,
          tokenHash,
          auth0UserCreated: true,
          auth0UserId,
          invitedByUserId: inviterUserId,
          invitedByBusinessId: businessId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        });
        const [invitation] = insertedInvitation;
        if (!invitation) {
          throw new GraphQLError('Invitation creation failed: no record returned from DB.', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        await injector.get(BusinessUsersProvider).insertBusinessUser({
          userId: localUserId,
          auth0UserId: null,
          roleId,
        });

        await injector.get(AuditLogsProvider).insertAuditLog({
          userId: inviterUserId,
          action: 'INVITATION_CREATED',
          entity: 'Invitation',
          entityId: invitation.id,
          details: { email: normalizedEmail, roleId, auth0UserId },
        });

        return {
          id: invitation.id,
          email: invitation.email,
          roleId: invitation.role_id,
          expiresAt: invitation.expires_at,
        };
      } catch (error) {
        // If DB operations fail, attempt to clean up the created Auth0 user to prevent dangling resources.
        await injector
          .get(Auth0ManagementProvider)
          .deleteUser(auth0UserId)
          .catch(cleanupError => {
            console.error(
              `Failed to cleanup Auth0 user ${auth0UserId} after DB error:`,
              cleanupError,
            );
          });
        // Re-throw the original error to ensure the GraphQL operation fails correctly.
        throw error;
      }
    },
  },
};
