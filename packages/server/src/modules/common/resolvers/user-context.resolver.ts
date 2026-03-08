import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import type { CommonModule } from '../types.js';

export const userContextResolvers: CommonModule.Resolvers = {
  Query: {
    userContext: async (_, __, { injector }) => {
      const {
        financialAccounts: { internalWalletsIds },
        bankDeposits: { bankDepositBusinessId },
        ownerId,
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
        adminBusinessId: ownerId,
        defaultLocalCurrency,
        defaultCryptoConversionFiatCurrency,
        ledgerLock,
        financialAccountsBusinessesIds,
        locality,
      };
    },
  },
};
