import type { Injector } from 'graphql-modules';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { SecurityBusinessesProvider } from '../providers/security-businesses.provider.js';

/**
 * Every business that stands for the foreign-securities portfolio: the tenant's general
 * foreign-securities business, plus one business per traded security.
 *
 * A securities transaction's counterparty is the specific security once it is recognized, and
 * the general business only where none could be resolved — so anything keyed on "is this the
 * securities side" has to ask about the whole set, not just the general id.
 *
 * Both sources are request-cached (admin context per operation, security ids per provider), so
 * calling this per transaction is cheap.
 */
export async function getForeignSecuritiesBusinessIds(injector: Injector): Promise<Set<string>> {
  const [adminContext, securityBusinessIds] = await Promise.all([
    injector.get(AdminContextProvider).getVerifiedAdminContext(),
    injector.get(SecurityBusinessesProvider).getAllSecurityBusinessIds(),
  ]);

  const { foreignSecuritiesBusinessId } = adminContext.foreignSecurities;
  if (!foreignSecuritiesBusinessId) {
    return securityBusinessIds;
  }
  return new Set([...securityBusinessIds, foreignSecuritiesBusinessId]);
}
