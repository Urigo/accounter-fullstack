import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { TagsProvider } from '@modules/tags/providers/tags.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { ChargesProvider } from '../providers/charges.provider.js';

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

      // clear tags
      const clearAllChargeTagsPromise = injector
        .get(TagsProvider)
        .clearAllChargeTags({ chargeId: id });

      return Promise.all([
        replaceDocumentsChargeIdPromise,
        replaceTransactionsChargeIdPromise,
        clearAllChargeTagsPromise,
      ]);
    });

    await Promise.all(chargeCleaner);

    // delete charge
    await injector.get(ChargesProvider).deleteChargesByIds({ chargeIds: chargeIdsToMerge });
  } catch (e) {
    throw new GraphQLError(`Failed to merge charges: ${e}`);
  }
};
