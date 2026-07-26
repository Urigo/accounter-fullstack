import { GraphQLError } from 'graphql';
import { AuthContextProvider } from '../providers/auth-context.provider.js';
import type { AuthModule } from '../types.js';

/**
 * Expose the authenticated caller's own business memberships.
 *
 * Gated with `@requiresAuth` only (never `@requiresRole`, never dependent on a
 * selected business scope): the MCP connector reads a user's businesses BEFORE
 * any scope is chosen, so a role-/scope-gated query cannot be used.
 *
 * The memberships are already resolved on the request auth context
 * (`AuthContextProvider.getAuthContext()`), so no additional DB query is needed.
 * An authenticated user with no memberships returns an empty list, not an error.
 */
export const membershipsResolvers: AuthModule.Resolvers = {
  Query: {
    myMemberships: async (_, __, { injector }) => {
      try {
        const authContext = await injector.get(AuthContextProvider).getAuthContext();
        return (authContext?.memberships ?? []).map(membership => ({
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
