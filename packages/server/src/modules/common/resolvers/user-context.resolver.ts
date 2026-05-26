import type { BusinessMembership } from '../../../shared/types/auth.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import type { CommonModule } from '../types.js';

export const userContextResolvers: CommonModule.Resolvers = {
  Query: {
    userContext: async (_, __, { injector }) => {
      const authContext = await injector.get(AuthContextProvider).getAuthContext();

      const memberships = (authContext?.memberships ?? []).map(
        (membership: BusinessMembership) => ({
          businessId: membership.businessId,
          role: membership.roleId,
          businessName: membership.businessName ?? null,
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
          locality: null,
        };
      }

      const {
        financialAccounts: { internalWalletsIds },
        bankDeposits: { bankDepositBusinessId },
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
        locality,
      };
    },
  },
};
