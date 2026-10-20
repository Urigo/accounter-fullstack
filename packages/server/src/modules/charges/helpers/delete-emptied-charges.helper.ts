import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { MiscExpensesProvider } from '../../misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { deleteCharges } from './delete-charges.helper.js';

/**
 * Delete the charges a move left behind with nothing in them.
 *
 * Moving a transaction or a document onto another charge can leave its former charge with no
 * transactions, no documents and no misc expenses. Such a charge is useless to keep: it carries
 * nothing, cannot produce a ledger, and keeps surfacing in the missing-information views. The
 * `EMPTY_UUID` unlink paths already delete an emptied former charge; this helper gives moves onto
 * an existing charge the same behaviour.
 *
 * Call it after the move has been written. `targetChargeId` (the charge the rows moved onto) is
 * never a candidate even when it was also a source. Returns the ids that were deleted.
 */
export async function deleteFormerChargesIfEmptied(
  formerChargeIds: ReadonlyArray<string | null | undefined>,
  targetChargeId: string | null | undefined,
  injector: Injector,
): Promise<string[]> {
  const candidates = [
    ...new Set(formerChargeIds.filter((id): id is string => !!id && id !== targetChargeId)),
  ];
  if (candidates.length === 0) {
    return [];
  }

  const transactionsProvider = injector.get(TransactionsProvider);
  const documentsProvider = injector.get(DocumentsProvider);
  const miscExpensesProvider = injector.get(MiscExpensesProvider);

  const emptied: string[] = [];
  await Promise.all(
    candidates.map(async chargeId => {
      // The per-request loaders may still hold the rows as they were before the move.
      transactionsProvider.transactionsByChargeIDLoader.clear(chargeId);
      documentsProvider.getDocumentsByChargeIdLoader.clear(chargeId);
      miscExpensesProvider.getExpensesByChargeIdLoader.clear(chargeId);

      const [transactions, documents, miscExpenses] = await Promise.all([
        transactionsProvider.transactionsByChargeIDLoader.load(chargeId),
        documentsProvider.getDocumentsByChargeIdLoader.load(chargeId),
        miscExpensesProvider.getExpensesByChargeIdLoader.load(chargeId),
      ]);
      if (transactions.length === 0 && documents.length === 0 && miscExpenses.length === 0) {
        emptied.push(chargeId);
      }
    }),
  );

  if (emptied.length === 0) {
    return [];
  }

  await deleteCharges(emptied, injector).catch(e => {
    if (e instanceof GraphQLError) {
      throw e;
    }
    console.error(e);
    throw new GraphQLError(`Failed to delete the empty former charges: ${emptied.join(', ')}`);
  });

  return emptied;
}
