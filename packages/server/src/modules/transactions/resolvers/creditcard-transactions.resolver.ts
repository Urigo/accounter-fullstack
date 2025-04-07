import { CreditCardTransactionsProvider } from '../providers/creditcard-transactions.provider.js';
import type { TransactionsModule } from '../types.js';

export const CreditCardTransactionsResolvers: TransactionsModule.Resolvers = {
  CreditcardBankCharge: {
    creditCardTransactions: async (dbCharge, _, { injector }) => {
      return injector
        .get(CreditCardTransactionsProvider)
        .getCreditCardTransactionsByChargeIdLoader.load(dbCharge.id)
        .then(res => res.map(dbTransaction => dbTransaction.id).filter(Boolean) as string[]);
    },
    validCreditCardAmount: async (dbCharge, _, { injector }) => {
      try {
        const res = await injector
          .get(CreditCardTransactionsProvider)
          .validateCreditCardTransactionsAmountByChargeIdLoader.load(dbCharge.id);
        return res ?? false;
      } catch (error) {
        console.error(error);
        return false;
      }
    },
  },
};
