import { GraphQLError } from 'graphql';
import { AuthContextProvider } from '../providers/auth-context.provider.js';
import type { AuthModule } from '../types.js';

/**
 * Expose the authenticated caller's own business memberships.
 *
 * Gated with `@requiresAnyRole(["business_owner", "accountant"])`: only callers
 * holding one of these roles may enumerate their memberships.
 *
 * The memberships are already resolved on the request auth context
 * (`AuthContextProvider.getAuthContext()`), so no additional DB query is needed.
 * An authenticated user with no memberships returns an empty list, not an error.
 *
 * Each membership's `id` is a composite of the caller's user id and the business
 * id, since a membership has no single-column identity of its own.
 */
export const membershipsResolvers: AuthModule.Resolvers = {
  Query: {
    myMemberships: async (_, __, { injector }) => {
      try {
        const authContext = await injector.get(AuthContextProvider).getAuthContext();
        const userId = authContext?.user?.userId ?? '';
        return (authContext?.memberships ?? []).map(membership => ({
          id: `${userId}:${membership.businessId}`,
          businessId: membership.businessId,
          roleId: membership.roleId,
          businessName: membership.businessName ?? null,
        }));
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        throw new GraphQLError('Failed to resolve memberships', {
          originalError: error instanceof Error ? error : undefined,
          extensions: { code: 'MEMBERSHIPS_RESOLUTION_FAILED' },
        });
      }
    },
  },
};
