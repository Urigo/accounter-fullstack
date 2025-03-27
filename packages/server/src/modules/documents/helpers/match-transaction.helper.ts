import type { Injector } from 'graphql-modules';
import { LLMProvider, type DocumentData } from '@modules/app-providers/llm.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';

/**
 * Attempts to match a document to unmatched transactions in the system
 * @param injector The GraphQL modules injector
 * @param document The document data to match
 * @returns The ID of the matched transaction, or null if no match found
 */
export async function matchTransactionToDocument(
  injector: Injector,
  document: DocumentData,
  context: GraphQLModules.ModuleContext,
): Promise<string | null> {
  try {
    // Get unmatched transactions (those with a charge_id but no matching document)
    const unmatchedTransactions = await injector
      .get(TransactionsProvider)
      .getTransactionsWithChargeButNoDocument(context.adminContext.defaultAdminBusinessId);

    if (!unmatchedTransactions || unmatchedTransactions.length === 0) {
      return null;
    }

    // Use LLM to find the best match
    const matchedTransaction = await injector
      .get(LLMProvider)
      .matchDocumentToTransaction(document, unmatchedTransactions);

    return matchedTransaction?.id ?? null;
  } catch (error) {
    console.error('Error matching transaction to document:', error);
    throw new Error('Failed to match transaction to document');
  }
}
