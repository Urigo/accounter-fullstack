import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { deleteCharges } from './delete-charges.helper.js';

export const mergeChargesExecutor = async (
  chargeIdsToMerge: readonly string[],
  baseChargeID: string,
  injector: Injector,
) => {
  try {
    const chargeCleaner = chargeIdsToMerge.map(id => {
      // update linked documents
      const replaceDocumentsChargeIdPromise = injector
        .get(DocumentsProvider)
        .replaceDocumentsChargeId({
          replaceChargeID: id,
          assertChargeID: baseChargeID,
        });

      // update linked transactions
      const replaceTransactionsChargeIdPromise = injector
        .get(TransactionsProvider)
        .replaceTransactionsChargeId({
          replaceChargeID: id,
          assertChargeID: baseChargeID,
        });

      return Promise.all([replaceDocumentsChargeIdPromise, replaceTransactionsChargeIdPromise]);
    });

    await Promise.all(chargeCleaner);

    // delete charge
    await deleteCharges([...chargeIdsToMerge], injector);
  } catch (e) {
    throw new GraphQLError(`Failed to merge charges: ${e}`);
  }
};
