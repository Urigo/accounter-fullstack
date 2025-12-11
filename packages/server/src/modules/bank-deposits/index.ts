import { createModule } from 'graphql-modules';
import { BankDepositTransactionsProvider } from './providers/bank-deposit-transactions.provider.js';
import { bankDepositTransactionsResolvers } from './resolvers/bank-deposit-transactions.resolver.js';
import bankDeposits from './typeDefs/bank-deposits.graphql.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const bankDepositsModule = createModule({
  id: 'bankDeposits',
  dirname: __dirname,
  typeDefs: [bankDeposits],
  resolvers: [bankDepositTransactionsResolvers],
  providers: () => [BankDepositTransactionsProvider],
});

export * as BankDepositsTypes from './types.js';
