import type { BusinessMembership } from '../../../shared/types/auth.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { resolveMembershipBusinessNames } from '../../financial-entities/helpers/membership-names.helper.js';
import type { CommonModule } from '../types.js';

export const userContextResolvers: CommonModule.Resolvers = {
  Query: {
    userContext: async (_, __, { injector }) => {
      const authContext = await injector.get(AuthContextProvider).getAuthContext();

      // Names come from each business's `financial_entities` row, so RLS limits
      // them to this request's read scope: a scoped request leaves out-of-scope
      // memberships unnamed. That is intentional here — the client's scope
      // switcher, which must name every membership to let a user leave a narrow
      // scope, reads `myMemberships` unscoped instead.
      const businessNamesMap = await resolveMembershipBusinessNames(
        injector,
        authContext?.memberships ?? [],
      );

      const memberships = (authContext?.memberships ?? []).map(
        (membership: BusinessMembership) => ({
          businessId: membership.businessId,
          role: membership.roleId,
          businessName:
            membership.businessName ?? businessNamesMap.get(membership.businessId) ?? null,
        }),
      );
      const activeReadScope = authContext?.activeReadScope?.businessIds ?? [];

      // Single-business preference fields only make sense when the request reads
      // from exactly one business; for multi-business reads they are null and
      // callers must narrow the scope to obtain them.
      if (activeReadScope.length !== 1) {
        return {
          memberships,
          activeReadScope,
          defaultLocalCurrency: null,
          defaultCryptoConversionFiatCurrency: null,
          ledgerLock: null,
          financialAccountsBusinessesIds: null,
          foreignSecuritiesBusinessId: null,
          locality: null,
        };
      }

      const {
        financialAccounts: { internalWalletsIds },
        bankDeposits: { bankDepositBusinessId },
        foreignSecurities: { foreignSecuritiesBusinessId },
        defaultLocalCurrency,
        defaultCryptoConversionFiatCurrency,
        ledgerLock,
        locality,
      } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

      const financialAccountsBusinessesIds = [...internalWalletsIds];
      if (bankDepositBusinessId) {
        // TODO: this should be removed after bank deposit conversion to financial account is done (then - it should be added to internalWalletsIds)
        financialAccountsBusinessesIds.push(bankDepositBusinessId);
      }

      return {
        memberships,
        activeReadScope,
        defaultLocalCurrency,
        defaultCryptoConversionFiatCurrency,
        ledgerLock,
        financialAccountsBusinessesIds,
        foreignSecuritiesBusinessId,
        locality,
      };
    },
  },
};
