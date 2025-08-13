import creditcardTransactions from './typeDefs/creditcard-transactions.graphql.js';
import transactionSuggestions from './typeDefs/transaction-suggestions.graphql.js';
import transactions from './typeDefs/transactions.graphql.js';
import { createModule } from 'graphql-modules';
import { CreditCardTransactionsProvider } from './providers/creditcard-transactions.provider.js';
import { TransactionsProvider } from './providers/transactions.provider.js';
import { CreditCardTransactionsResolvers } from './resolvers/creditcard-transactions.resolver.js';
import { transactionSuggestionsResolvers } from './resolvers/transaction-suggestions.resolver.js';
import { transactionsResolvers } from './resolvers/transactions.resolver.js';

const __dirname = new URL('.', import.meta.url).pathname;

export const transactionsModule = createModule({
  id: 'transactions',
  dirname: __dirname,
  typeDefs: [transactions, transactionSuggestions, creditcardTransactions],
  resolvers: [
    transactionsResolvers,
    transactionSuggestionsResolvers,
    CreditCardTransactionsResolvers,
  ],
  providers: () => [CreditCardTransactionsProvider, TransactionsProvider],
});

export * as transactionsTypes from './types.js';
