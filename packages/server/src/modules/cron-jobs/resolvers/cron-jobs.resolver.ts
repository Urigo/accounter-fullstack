import { GraphQLError } from 'graphql';
import type { Resolvers, ResolversTypes } from '../../../__generated__/types.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import type { IGetChargesByIdsResult } from '../../charges/types.js';
import {
  executeReferenceMergePlan,
  loadReferenceMergePlans,
  runCronJobs,
} from '../helpers/run-cron-jobs.helper.js';
import { CronJobsProvider } from '../providers/cron-jobs.provider.js';
import type { CronJobsModule } from '../types.js';

export const cronJobsResolvers: CronJobsModule.Resolvers & Pick<Resolvers, 'CronJobEvent'> = {
  Mutation: {
    runCronJobs: async (_, __, { injector }) => {
      const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
      return {
        // An async iterable list, so the client can @stream the events as they happen
        events: runCronJobs(
          injector,
          ownerId,
        ) as unknown as readonly ResolversTypes['CronJobEvent'][],
      };
    },
    mergeChargesByTransactionReference: async (_, { dryRun = true }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        const {
          chargeById,
          plans,
          errors: planningErrors,
        } = await loadReferenceMergePlans(injector, ownerId);
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

        for (const plan of plans) {
          const { reference, baseChargeId } = plan;
          try {
            await executeReferenceMergePlan(injector, plan, chargeById);
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
  CronJobEvent: {
    __resolveType: parent => parent.__typename!,
  },
};
