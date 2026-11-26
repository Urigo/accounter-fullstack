import { createModule } from 'graphql-modules';
import { CreditCardTransactionsProvider } from './providers/creditcard-transactions.provider.js';
import { TransactionsProvider } from './providers/transactions.provider.js';
import { CreditCardTransactionsResolvers } from './resolvers/creditcard-transactions.resolver.js';
import { transactionSuggestionsResolvers } from './resolvers/transaction-suggestions.resolver.js';
import { transactionsResolvers } from './resolvers/transactions.resolver.js';
import { uncategorizedTransactionGroupsResolvers } from './resolvers/uncategorized-transaction-groups.resolver.js';
import creditcardTransactions from './typeDefs/creditcard-transactions.graphql.js';
import transactionSuggestions from './typeDefs/transaction-suggestions.graphql.js';
import transactions from './typeDefs/transactions.graphql.js';
import uncategorizedTransactionGroups from './typeDefs/uncategorized-transaction-groups.graphql.js';

const __dirname = import.meta.dirname;

export const transactionsModule = createModule({
  id: 'transactions',
  dirname: __dirname,
  typeDefs: [
    transactions,
    transactionSuggestions,
    creditcardTransactions,
    uncategorizedTransactionGroups,
  ],
  resolvers: [
    transactionsResolvers,
    transactionSuggestionsResolvers,
    CreditCardTransactionsResolvers,
    uncategorizedTransactionGroupsResolvers,
  ],
  providers: () => [CreditCardTransactionsProvider, TransactionsProvider],
});

export * as transactionsTypes from './types.js';
