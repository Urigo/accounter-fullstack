import { fileURLToPath } from 'node:url';
import { createModule } from 'graphql-modules';
import { BankDepositChargesProvider } from './providers/bank-deposit-charges.provider.js';
import { BankDepositsProvider } from './providers/bank-deposits.provider.js';
import { bankDepositChargesResolvers } from './resolvers/bank-deposit-charges.resolver.js';
import { bankDepositsResolvers } from './resolvers/bank-deposits.resolver.js';
import bankDepositCharges from './typeDefs/bank-deposit-charges.graphql.js';
import bankDeposits from './typeDefs/bank-deposits.graphql.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const bankDepositsModule = createModule({
  id: 'bankDeposits',
  dirname: __dirname,
  typeDefs: [bankDeposits, bankDepositCharges],
  resolvers: [bankDepositsResolvers, bankDepositChargesResolvers],
  providers: () => [BankDepositsProvider, BankDepositChargesProvider],
});

export * as BankDepositsTypes from './types.js';
