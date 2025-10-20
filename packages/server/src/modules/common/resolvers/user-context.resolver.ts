import type { CommonModule } from '../types.js';

export const userContextResolvers: CommonModule.Resolvers = {
  Query: {
    userContext: (_, __, { adminContext }) => {
      const financialAccountsBusinessesIds = [...adminContext.financialAccounts.internalWalletsIds];
      if (adminContext.bankDeposits.bankDepositBusinessId) {
        // TODO: this should be removed after bank deposit conversion to financial account is done (then - it should be added to internalWalletsIds)
        financialAccountsBusinessesIds.push(adminContext.bankDeposits.bankDepositBusinessId);
      }
      return {
        adminBusinessId: adminContext.defaultAdminBusinessId,
        defaultLocalCurrency: adminContext.defaultLocalCurrency,
        defaultCryptoConversionFiatCurrency: adminContext.defaultCryptoConversionFiatCurrency,
        ledgerLock: adminContext.ledgerLock,
        financialAccountsBusinessesIds,
        locality: adminContext.locality,
      };
    },
  },
};
