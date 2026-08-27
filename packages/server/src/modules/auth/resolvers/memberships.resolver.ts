import { GraphQLError } from 'graphql';
import { resolveMembershipBusinessNames } from '../../financial-entities/helpers/membership-names.helper.js';
import { AuthContextProvider } from '../providers/auth-context.provider.js';
import type { AuthModule } from '../types.js';

/**
 * Expose the authenticated caller's own business memberships.
 *
 * Gated with `@requiresAnyRole(["business_owner", "accountant"])`: only callers
 * holding one of these roles may enumerate their memberships.
 *
 * The memberships themselves are already resolved on the request auth context
 * (`AuthContextProvider.getAuthContext()`). Only their display names need a
 * lookup: `business_users` stores ids alone, so the name comes from each
 * business's `financial_entities` row, which RLS narrows to the request's read
 * scope. Callers that need every name — the client's business-scope switcher —
 * must send this query without `X-Business-Scope`, whose absence widens the
 * scope to all of the user's memberships. A scoped caller still gets a valid
 * answer, just with out-of-scope names left null.
 *
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
        const memberships = authContext?.memberships ?? [];
        const businessNames = await resolveMembershipBusinessNames(injector, memberships);

        return memberships.map(membership => ({
          id: `${userId}:${membership.businessId}`,
          businessId: membership.businessId,
          roleId: membership.roleId,
          businessName: membership.businessName ?? businessNames.get(membership.businessId) ?? null,
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
