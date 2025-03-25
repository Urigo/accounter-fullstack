import type { CommonModule } from '../types.js';

export const userContextResolvers: CommonModule.Resolvers = {
  Query: {
    userContext: (_, __, { adminContext }) => {
      return {
        adminBusinessId: adminContext.defaultAdminBusinessId,
        defaultLocalCurrency: adminContext.defaultLocalCurrency,
        defaultCryptoConversionFiatCurrency: adminContext.defaultCryptoConversionFiatCurrency,
        ledgerLock: adminContext.ledgerLock,
      };
    },
  },
};
