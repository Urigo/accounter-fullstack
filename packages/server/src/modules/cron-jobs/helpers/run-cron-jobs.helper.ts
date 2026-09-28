import type { Injector } from 'graphql-modules';
import type {
  CronJobStep,
  CronJobStepState,
  CronJobStepStatus,
  MergedChargeSnapshot,
} from '../../../__generated__/types.js';
import { formatFinancialAmount } from '../../../shared/helpers/amount.js';
import { dateToTimelessDateString } from '../../../shared/helpers/misc.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { mergeChargesExecutor } from '../../charges/helpers/merge-charges.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../charges/types.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { CronJobsProvider } from '../providers/cron-jobs.provider.js';
import type { IGetReferenceMergeCandidatesResult } from '../types.js';
import {
  buildMergeChargesByTransactionReferencePlan,
  type MergeChargePlan,
} from './merge-charges-by-reference.helper.js';

export type CronJobEventProto =
  | ({ __typename: 'CronJobStepStatus' } & CronJobStepStatus)
  | { __typename: 'ForeignFeeTransactionFlagged'; transaction: string }
  | {
      __typename: 'ChargesMergedByReference';
      reference: string;
      baseCharge: IGetChargesByIdsResult;
      mergedCharges: MergedChargeSnapshot[];
    }
  | { __typename: 'CreditcardDebitDateFilled'; transaction: string; debitDate: TimelessDateString };

type StepOutcome = {
  affectedCount: number;
  errors: string[];
};

type StepRunner = (
  injector: Injector,
  ownerId: string,
) => AsyncGenerator<CronJobEventProto, StepOutcome, undefined>;

function stepStatus(
  step: CronJobStep,
  state: CronJobStepState,
  outcome?: Partial<StepOutcome>,
): CronJobEventProto {
  return {
    __typename: 'CronJobStepStatus',
    step,
    state,
    affectedCount: outcome?.affectedCount ?? null,
    errors: outcome?.errors?.length ? outcome.errors : null,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Runs the cron jobs steps in order, yielding a status event when each step starts and ends, and
 * an event for every change a step makes. A failed step skips the steps after it; a step that
 * completes with item-level errors does not.
 */
export async function* runCronJobs(
  injector: Injector,
  ownerId: string,
): AsyncGenerator<CronJobEventProto, void, undefined> {
  const steps: [CronJobStep, StepRunner][] = [
    ['FLAG_FOREIGN_FEES', flagForeignFees],
    ['MERGE_CHARGES_BY_REFERENCE', mergeChargesByReference],
    ['FILL_CREDITCARD_DEBIT_DATES', fillCreditcardDebitDates],
  ];

  let failed = false;
  for (const [step, run] of steps) {
    if (failed) {
      yield stepStatus(step, 'SKIPPED');
      continue;
    }

    yield stepStatus(step, 'RUNNING');
    try {
      const outcome = yield* run(injector, ownerId);
      yield stepStatus(
        step,
        outcome.errors.length ? 'COMPLETED_WITH_ERRORS' : 'SUCCEEDED',
        outcome,
      );
    } catch (error) {
      failed = true;
      console.error(`Cron job step ${step} failed:`, error);
      yield stepStatus(step, 'FAILED', { errors: [errorMessage(error)] });
    }
  }
}

async function* flagForeignFees(
  injector: Injector,
  ownerId: string,
): AsyncGenerator<CronJobEventProto, StepOutcome, undefined> {
  const flagged = await injector.get(CronJobsProvider).flagForeignFeeTransactions({ ownerId });
  const transactionsProvider = injector.get(TransactionsProvider);
  for (const { id } of flagged) {
    transactionsProvider.transactionByIdLoader.clear(id);
    yield { __typename: 'ForeignFeeTransactionFlagged', transaction: id };
  }
  return { affectedCount: flagged.length, errors: [] };
}

async function* mergeChargesByReference(
  injector: Injector,
  ownerId: string,
): AsyncGenerator<CronJobEventProto, StepOutcome, undefined> {
  const { candidates, chargeById, plans, errors } = await loadReferenceMergePlans(
    injector,
    ownerId,
  );
  const stepErrors = [...errors];
  let mergedCount = 0;

  for (const plan of plans) {
    // Snapshot before merging: the merged charges are deleted by the merge
    const mergedCharges = buildMergedChargeSnapshots(plan.chargeIdsToMerge, candidates, chargeById);
    let merge: Awaited<ReturnType<typeof executeReferenceMergePlan>>;
    try {
      merge = await executeReferenceMergePlan(injector, plan, chargeById);
    } catch (error) {
      stepErrors.push(
        `Failed to merge reference "${plan.reference}" into charge ID=${plan.baseChargeId}: ${errorMessage(error)}`,
      );
      continue;
    }

    mergedCount++;
    if (merge.approvalError) {
      stepErrors.push(merge.approvalError);
    }
    if (!merge.baseCharge) {
      stepErrors.push(
        `Merged reference "${plan.reference}", but charge ID=${plan.baseChargeId} could not be loaded`,
      );
      continue;
    }
    yield {
      __typename: 'ChargesMergedByReference',
      reference: plan.reference,
      baseCharge: merge.baseCharge,
      mergedCharges,
    };
  }

  return { affectedCount: mergedCount, errors: stepErrors };
}

async function* fillCreditcardDebitDates(
  injector: Injector,
  ownerId: string,
): AsyncGenerator<CronJobEventProto, StepOutcome, undefined> {
  const filled = await injector.get(CronJobsProvider).calculateCreditcardDebitDate({ ownerId });
  const transactionsProvider = injector.get(TransactionsProvider);
  let filledCount = 0;
  for (const { id, debit_date_override } of filled) {
    transactionsProvider.transactionByIdLoader.clear(id);
    if (!debit_date_override) {
      continue;
    }
    filledCount++;
    yield {
      __typename: 'CreditcardDebitDateFilled',
      transaction: id,
      debitDate: dateToTimelessDateString(debit_date_override),
    };
  }
  return { affectedCount: filledCount, errors: [] };
}

export async function loadReferenceMergePlans(injector: Injector, ownerId: string) {
  const candidates = await injector.get(CronJobsProvider).getReferenceMergeCandidates({
    ownerId,
  });

  const chargeIds = new Set<string>(candidates.map(candidate => candidate.charge_id));
  const charges = await injector
    .get(ChargesProvider)
    .getChargeByIdLoader.loadMany(Array.from(chargeIds))
    .then(
      res => res.filter(charge => charge && !(charge instanceof Error)) as IGetChargesByIdsResult[],
    );

  const chargeById = new Map(charges.map(charge => [charge.id, charge]));
  const { plans, errors } = buildMergeChargesByTransactionReferencePlan({
    candidates,
    chargeById,
  });

  return { candidates, chargeById, plans, errors };
}

/**
 * Merges the plan's charges into its base charge and re-flags the base charge for accountant
 * review. Throws only when the merge itself fails, so nothing was merged. A failed re-flag comes
 * back as `approvalError`: the merge is already committed by then, and must still be reported.
 */
export async function executeReferenceMergePlan(
  injector: Injector,
  { reference, baseChargeId, chargeIdsToMerge }: MergeChargePlan,
  chargeById: Map<string, IGetChargesByIdsResult>,
): Promise<{ baseCharge: IGetChargesByIdsResult | undefined; approvalError?: string }> {
  await mergeChargesExecutor(chargeIdsToMerge, baseChargeId, injector);
  try {
    const degradedCharges = await degradeChargesAccountantApproval(injector, [baseChargeId]);
    const degradedBaseCharge = degradedCharges.get(baseChargeId);
    if (degradedBaseCharge) {
      // keep the cached charge in sync with its fresh (PENDING) state
      chargeById.set(baseChargeId, degradedBaseCharge);
    }
  } catch (error) {
    return {
      baseCharge: chargeById.get(baseChargeId),
      approvalError: `Merged reference "${reference}" into charge ID=${baseChargeId}, but failed to flag it for accountant review: ${errorMessage(error)}`,
    };
  }
  return { baseCharge: chargeById.get(baseChargeId) };
}

/**
 * Describes charges that are about to be merged (and deleted), from their matched transactions.
 */
export function buildMergedChargeSnapshots(
  chargeIds: readonly string[],
  candidates: readonly IGetReferenceMergeCandidatesResult[],
  chargeById: ReadonlyMap<string, IGetChargesByIdsResult>,
): MergedChargeSnapshot[] {
  return chargeIds.map(id => {
    const transactions = candidates.filter(candidate => candidate.charge_id === id);

    const earliestDate = transactions.reduce<Date | null>(
      (earliest, { event_date }) => (!earliest || event_date < earliest ? event_date : earliest),
      null,
    );

    const currencies = new Set(transactions.map(transaction => transaction.currency));
    const amount =
      currencies.size === 1
        ? formatFinancialAmount(
            transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0),
            transactions[0].currency,
          )
        : null;

    const description =
      chargeById.get(id)?.user_description?.trim() ||
      transactions.find(transaction => transaction.source_description?.trim())
        ?.source_description ||
      null;

    return {
      id,
      description,
      date: earliestDate ? dateToTimelessDateString(earliestDate) : null,
      amount,
    };
  });
}
