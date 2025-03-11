import type { Injector } from 'graphql-modules';
import { LLMProvider, type DocumentData } from '@modules/app-providers/llm.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { dateToTimelessDateString, formatCurrency } from '@shared/helpers';
import type { IGetAllDocumentsResult } from '../types.js';
import { dbDocumentTypeToEnum } from './document-type.helper.js';

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
    // Get unmatched transactions (those without documents)
    const unmatchedTransactions = await injector
      .get(TransactionsProvider)
      .getTransactionsByFilters({
        fromEventDate: document.date
          ? dateToTimelessDateString(new Date(document.date))
          : undefined,
        // Add a buffer of a few days before the document date to catch related transactions
        toEventDate: document.date ? dateToTimelessDateString(new Date(document.date)) : undefined,
        ownerIDs: [context.adminContext.defaultAdminBusinessId],
      });

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

/**
 * Attempts to match a document to a transaction and update the transaction's charge ID
 * @param injector The GraphQL modules injector
 * @param doc The document to match
 * @param context The GraphQL context
 * TODO: qu: we can make this a different mutation.
 * TODO: if we leave it here, then we need to check if sensitive data. if yes, then skip.
 */
export async function tryMatchAndUpdateTransaction(
  injector: Injector,
  doc: IGetAllDocumentsResult,
  context: GraphQLModules.ModuleContext,
): Promise<void> {
  if (!doc?.total_amount || !doc?.currency_code) return;

  try {
    const matchedTransaction = await matchTransactionToDocument(
      injector,
      {
        type: dbDocumentTypeToEnum(doc.type),
        issuer: null,
        recipient: null,
        fullAmount: doc.total_amount,
        currency: formatCurrency(doc.currency_code),
        vatAmount: doc.vat_amount,
        date: doc.date ? dateToTimelessDateString(doc.date) : null,
        referenceCode: doc.serial_number,
      },
      context,
    );

    if (matchedTransaction) {
      // Update the transaction's charge ID to link it with the document's charge
      await injector.get(TransactionsProvider).updateTransaction({
        transactionId: matchedTransaction,
        chargeId: doc.charge_id,
      });
    }
  } catch (error) {
    console.error('Error matching document to transaction:', error);
    // Don't fail the upload if matching fails
  }
}
