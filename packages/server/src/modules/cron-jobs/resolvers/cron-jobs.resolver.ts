import { GraphQLError } from 'graphql';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { mergeChargesExecutor } from '../../charges/helpers/merge-charges.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../charges/types.js';
import { buildMergeChargesByTransactionReferencePlan } from '../helpers/merge-charges-by-reference.helper.js';
import { CronJobsProvider } from '../providers/cron-jobs.provider.js';
import type { CronJobsModule } from '../types.js';

export const cronJobsResolvers: CronJobsModule.Resolvers = {
  Mutation: {
    mergeChargesByTransactionReference: async (_, { dryRun = true }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        const candidates = await injector.get(CronJobsProvider).getReferenceMergeCandidates({
          ownerId,
        });

        const chargeIds = new Set<string>(candidates.map(candidate => candidate.charge_id));
        const charges = await injector
          .get(ChargesProvider)
          .getChargeByIdLoader.loadMany(Array.from(chargeIds))
          .then(
            res =>
              res.filter(
                charge => charge && !(charge instanceof Error),
              ) as IGetChargesByIdsResult[],
          );

        const chargeById = new Map(charges.map(charge => [charge.id, charge]));
        const { plans, errors: planningErrors } = buildMergeChargesByTransactionReferencePlan({
          candidates,
          chargeById,
        });
        const plannedMerges = plans.map(({ reference, baseChargeId, chargeIdsToMerge }) => ({
          reference,
          baseChargeId,
          chargeIdsToMerge,
        }));
        const plannedBaseChargeIds = new Set(plans.map(plan => plan.baseChargeId));

        if (dryRun) {
          return {
            success: planningErrors.length === 0,
            charges: Array.from(plannedBaseChargeIds)
              .map(id => chargeById.get(id))
              .filter(charge => charge) as IGetChargesByIdsResult[],
            plannedMerges,
            errors: planningErrors.length > 0 ? planningErrors : undefined,
          };
        }

        const executionErrors = [...planningErrors];
        const mergedBaseChargeIds = new Set<string>();

        for (const { reference, baseChargeId, chargeIdsToMerge } of plans) {
          try {
            await mergeChargesExecutor(chargeIdsToMerge, baseChargeId, injector);
            mergedBaseChargeIds.add(baseChargeId);
          } catch (error) {
            const message =
              error instanceof GraphQLError
                ? error.message
                : ((error as Error)?.message ?? 'Unknown error');
            executionErrors.push(
              `Failed to merge reference "${reference}" into charge ID=${baseChargeId}: ${message}`,
            );
          }
        }

        return {
          success: executionErrors.length === 0,
          charges: Array.from(mergedBaseChargeIds)
            .map(id => chargeById.get(id))
            .filter(charge => charge) as IGetChargesByIdsResult[],
          plannedMerges,
          errors: executionErrors.length > 0 ? executionErrors : undefined,
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
    flagForeignFeeTransactions: async (_, __, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        const res = await injector.get(CronJobsProvider).flagForeignFeeTransactions({ ownerId });
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
    calculateCreditcardTransactionsDebitDate: async (_, __, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        await injector.get(CronJobsProvider).calculateCreditcardDebitDate({ ownerId });
        return true;
      } catch (e) {
        console.error(e);
        throw new GraphQLError('Failed to calculate creditcard transactions debit date');
      }
    },
  },
};
