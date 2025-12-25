import { createModule } from 'graphql-modules';
import { BankDepositChargesProvider } from './providers/bank-deposit-charges.provider.js';
import { bankDepositTransactionsResolvers } from './resolvers/bank-deposit-transactions.resolver.js';
import bankDeposits from './typeDefs/bank-deposits.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const bankDepositsModule = createModule({
  id: 'bankDeposits',
  dirname: __dirname,
  typeDefs: [bankDeposits],
  resolvers: [bankDepositTransactionsResolvers],
  providers: () => [BankDepositChargesProvider],
});

export * as BankDepositsTypes from './types.js';
