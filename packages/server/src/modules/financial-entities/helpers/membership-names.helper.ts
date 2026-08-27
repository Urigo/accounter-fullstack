import type { Injector } from 'graphql-modules';
import type { BusinessMembership } from '../../../shared/types/auth.js';
import { FinancialEntitiesProvider } from '../providers/financial-entities.provider.js';

/**
 * Business display names for a set of memberships, keyed by business id.
 *
 * A membership carries no name of its own — `business_users` stores only ids —
 * so the name comes from the business's `financial_entities` row, which RLS
 * narrows to the request's read scope. A request that sends no
 * `X-Business-Scope` reads all of the user's memberships and resolves every
 * name; a scoped one resolves only the businesses in scope, and the rest are
 * simply absent from the map.
 *
 * Failures are per-id on purpose: one unreadable business must not blank the
 * names of the others.
 */
export async function resolveMembershipBusinessNames(
  injector: Injector,
  memberships: readonly BusinessMembership[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();

  await Promise.all(
    memberships
      .filter(membership => membership.businessId)
      .map(async membership => {
        try {
          const financialEntity = await injector
            .get(FinancialEntitiesProvider)
            .getFinancialEntityByIdLoader.load(membership.businessId);
          if (financialEntity?.name) {
            names.set(membership.businessId, financialEntity.name);
          }
        } catch (error) {
          console.error(
            `Failed to load financial entity for business ${membership.businessId}:`,
            error,
          );
        }
      }),
  );

  return names;
}
