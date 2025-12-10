import { GraphQLError } from 'graphql';
import { mergeChargesExecutor } from '../../charges/helpers/merge-charges.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../charges/types.js';
import type { IGetTransactionsByChargeIdsResult } from '../../transactions/types.js';
import { CornJobsProvider } from '../providers/corn-jobs.provider.js';
import type { CornJobsModule } from '../types.js';

const WIDE_DATE_DIFF_MILLISECONDS = 2_592_000_000; // 30 days
const ACCEPTABLE_DATE_DIFF_MILLISECONDS = 86_400_000; // 1 days

export const cornJobsResolvers: CornJobsModule.Resolvers = {
  Mutation: {
    mergeChargesByTransactionReference: async (
      _,
      __,
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      try {
        const candidates = await injector.get(CornJobsProvider).getReferenceMergeCandidates({
          ownerId: defaultAdminBusinessId,
        });

        const chargeIds = new Set<string>(candidates.map(candidate => candidate.charge_id!));
        const charges = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.loadMany(Array.from(chargeIds))
          .then(res => res.filter(charge => charge && 'id' in charge) as IGetChargesByIdsResult[]);

        const referenceMap = new Map<
          string,
          { transaction: IGetTransactionsByChargeIdsResult; charge: IGetChargesByIdsResult }[]
        >();
        candidates.map(candidate => {
          const reference = candidate.source_reference;
          if (!reference) {
            throw new GraphQLError('reference is missing');
          }

          const charge = charges.find(charge => charge.id === candidate.charge_id);
          if (!charge) {
            throw new GraphQLError(`Charge is missing for transaction ID=${candidate.id}`);
          }

          if (!referenceMap.has(reference)) {
            referenceMap.set(reference, []);
          }
          referenceMap.get(reference)?.push({ transaction: candidate, charge });
        });

        const mergableMathces: Record<string, string[]> = {};
        Array.from(referenceMap.values()).map(candidates => {
          const candidatesIDs = new Set<string>(
            candidates.map(candidate => candidate.transaction.id!),
          );
          for (const { transaction, charge } of candidates) {
            if (!transaction.id || !candidatesIDs.has(transaction.id) || !transaction.event_date) {
              continue;
            }
            candidatesIDs.delete(transaction.id);

            // filter candidates
            const fromDate = transaction.event_date.getTime() - ACCEPTABLE_DATE_DIFF_MILLISECONDS;
            const toDate = transaction.event_date.getTime() + ACCEPTABLE_DATE_DIFF_MILLISECONDS;
            const widelyFromDate = transaction.event_date.getTime() - WIDE_DATE_DIFF_MILLISECONDS;
            const widelyToDate = transaction.event_date.getTime() + WIDE_DATE_DIFF_MILLISECONDS;

            const matches = candidates.filter(({ transaction: internatTransaction }) => {
              if (!candidatesIDs.has(internatTransaction.id)) {
                return false;
              }

              const isWithinTimeRange =
                internatTransaction.event_date.getTime() >= fromDate &&
                internatTransaction.event_date.getTime() <= toDate;

              // check if details match
              const isWidelyInTimeRange =
                internatTransaction.event_date.getTime() >= widelyFromDate &&
                internatTransaction.event_date.getTime() <= widelyToDate;
              const areDetailsSufficient =
                isWidelyInTimeRange &&
                internatTransaction.source_description &&
                internatTransaction.source_description.length >= 5 &&
                transaction.source_description &&
                transaction.source_description.length >= 5;
              const isMatchingDetails =
                areDetailsSufficient &&
                (internatTransaction.source_description?.includes(
                  transaction.source_description!,
                ) ||
                  internatTransaction.source_description?.includes(
                    transaction.source_description!,
                  ));

              return isWithinTimeRange || isMatchingDetails;
            });

            if (matches.length === 0) {
              return;
            }
            matches.map(match => candidatesIDs.delete(match.transaction.id!));
            matches.push({ transaction, charge });

            // preparation for merge: rearrange based on charge
            const chargesWithTransactions = new Map<
              string,
              { transactions: IGetTransactionsByChargeIdsResult[]; charge: IGetChargesByIdsResult }
            >();
            matches.map(({ transaction, charge }) => {
              if (!chargesWithTransactions.has(charge.id)) {
                chargesWithTransactions.set(charge.id, { transactions: [], charge });
              }
              chargesWithTransactions.get(charge.id)?.transactions.push(transaction);
            });
            if (chargesWithTransactions.size === 1) {
              return;
            }

            // figure which charge will be the main for merge
            const chargeMatches = Array.from(chargesWithTransactions.values());
            const mainCandidates = chargeMatches.filter(({ charge, transactions }) => {
              const isFee = !transactions.some(transaction => !transaction.is_fee);
              const isUnlinked = !!charge.user_description?.includes('unlinked from charge');
              return !isFee && !isUnlinked;
            });

            if (mainCandidates.length === 0) {
              const main = chargeMatches.shift();
              logMatch(main!, chargeMatches);
              mergableMathces[main!.charge.id] = chargeMatches.map(match => match.charge.id);
              return;
            }

            if (mainCandidates.length === 1) {
              const main = mainCandidates[0];
              const chargesToMerge = chargeMatches.filter(
                match => match.charge.id !== main.charge.id,
              );
              logMatch(main, chargesToMerge);
              mergableMathces[main.charge.id] = chargesToMerge.map(match => match.charge.id);
              return;
            }

            const main = chargeMatches.shift();
            logMatch(main!, chargeMatches);
            console.log('not sure what to do now');
          }
        });

        // execute merges
        const chargeMergePromises = Object.entries(mergableMathces).map(
          async ([baseChargeID, chargeIdsToMerge]) => {
            await mergeChargesExecutor(chargeIdsToMerge, baseChargeID, injector);
            console.log(`Merged into charge ID=${baseChargeID} successfully`);
          },
        );
        await Promise.all(chargeMergePromises);

        return {
          success: true,
          charges: Object.keys(mergableMathces)
            .map(id => charges.find(charge => charge.id === id))
            .filter(charge => charge) as IGetChargesByIdsResult[],
        };
      } catch (e) {
        if (e instanceof GraphQLError) {
          throw e;
        }
        return {
          success: false,
          errors: [(e as Error)?.message ?? 'Unknown error'],
        };
      }
    },
    flagForeignFeeTransactions: async (
      _,
      __,
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      try {
        const res = await injector
          .get(CornJobsProvider)
          .flagForeignFeeTransactions({ ownerId: defaultAdminBusinessId });
        const updatedTransactionsIds = res.map(({ id }) => id);
        return {
          success: true,
          transactions: updatedTransactionsIds,
        };
      } catch (e) {
        return {
          success: false,
          errors: [(e as Error)?.message ?? 'Unknown error'],
        };
      }
    },
    calculateCreditcardTransactionsDebitDate: async (
      _,
      __,
      { injector, adminContext: { defaultAdminBusinessId } },
    ) => {
      try {
        await injector
          .get(CornJobsProvider)
          .calculateCreditcardDebitDate({ ownerId: defaultAdminBusinessId });
        return true;
      } catch (e) {
        console.error(e);
        throw new GraphQLError('Failed to calculate creditcard transactions debit date');
      }
    },
  },
};

function logMatch(
  main: { transactions: IGetTransactionsByChargeIdsResult[]; charge: IGetChargesByIdsResult },
  others: { transactions: IGetTransactionsByChargeIdsResult[]; charge: IGetChargesByIdsResult }[],
) {
  console.log('\n\n\n');
  for (const { charge, transactions } of [main, ...others]) {
    console.log(charge.user_description);
    for (const transaction of transactions) {
      console.log('  ', transaction.source_description);
    }
  }
}
