import { CreditCardTransactionsProvider } from '../providers/creditcard-transactions.provider.js';
import type { IGetTransactionsByIdsResult, TransactionsModule } from '../types.js';

export const CreditCardTransactionsResolvers: TransactionsModule.Resolvers = {
  CreditcardBankCharge: {
    creditCardTransactions: async (dbCharge, _, { injector }) => {
      return injector
        .get(CreditCardTransactionsProvider)
        .getCreditCardTransactionsByChargeIdLoader.load(dbCharge.id) as Promise<
        IGetTransactionsByIdsResult[]
      >;
    },
    validCreditCardAmount: async (dbCharge, _, { injector }) => {
      try {
        const res = await injector
          .get(CreditCardTransactionsProvider)
          .validateCreditCardTransactionsAmountByChargeIdLoader.load(dbCharge.id);
        return res ?? false;
      } catch (error) {
        return false;
      }
    },
  },
};
