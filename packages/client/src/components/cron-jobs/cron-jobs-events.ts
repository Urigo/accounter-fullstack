import { CronJobStep, CronJobStepState, type RunCronJobsMutation } from '../../gql/graphql.js';

export type CronJobsRunEvent = RunCronJobsMutation['runCronJobs']['events'][number];

type EventOf<T extends CronJobsRunEvent['__typename']> = Extract<
  CronJobsRunEvent,
  { __typename: T }
>;

export type FlaggedFee = EventOf<'ForeignFeeTransactionFlagged'>;
export type MergedCharges = EventOf<'ChargesMergedByReference'>;
export type FilledDebitDate = EventOf<'CreditcardDebitDateFilled'>;

/** A step that has not reported any status yet is `PENDING`. */
export type CronJobStepView = {
  state: CronJobStepState | 'PENDING';
  affectedCount: number | null;
  errors: readonly string[];
};

export type CronJobsRunView = {
  steps: Record<CronJobStep, CronJobStepView>;
  flaggedFees: FlaggedFee[];
  mergedCharges: MergedCharges[];
  filledDebitDates: FilledDebitDate[];
};

/** Steps in execution order, as the server runs them. */
export const CRON_JOB_STEPS = [
  CronJobStep.FlagForeignFees,
  CronJobStep.MergeChargesByReference,
  CronJobStep.FillCreditcardDebitDates,
] as const;

const PENDING_STEP: CronJobStepView = { state: 'PENDING', affectedCount: null, errors: [] };

/** Folds the streamed events into the latest state of each step and the changes it made. */
export function groupCronJobEvents(events: readonly CronJobsRunEvent[]): CronJobsRunView {
  const view: CronJobsRunView = {
    steps: {
      [CronJobStep.FlagForeignFees]: PENDING_STEP,
      [CronJobStep.MergeChargesByReference]: PENDING_STEP,
      [CronJobStep.FillCreditcardDebitDates]: PENDING_STEP,
    },
    flaggedFees: [],
    mergedCharges: [],
    filledDebitDates: [],
  };

  for (const event of events) {
    switch (event.__typename) {
      case 'CronJobStepStatus':
        view.steps[event.step] = {
          state: event.state,
          affectedCount: event.affectedCount ?? null,
          errors: event.errors ?? [],
        };
        break;
      case 'ForeignFeeTransactionFlagged':
        view.flaggedFees.push(event);
        break;
      case 'ChargesMergedByReference':
        view.mergedCharges.push(event);
        break;
      case 'CreditcardDebitDateFilled':
        view.filledDebitDates.push(event);
        break;
    }
  }

  return view;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** One-line outcome of a run, e.g. "3 charges merged · 5 fees flagged · 12 debit dates filled". */
export function summarizeCronJobEvents(events: readonly CronJobsRunEvent[]): {
  failed: boolean;
  withErrors: boolean;
  description: string;
} {
  const { steps, flaggedFees, mergedCharges, filledDebitDates } = groupCronJobEvents(events);
  const states = CRON_JOB_STEPS.map(step => steps[step].state);
  // count the charges that were folded into others, not the merge groups
  const mergedAwayCount = mergedCharges.reduce((sum, merge) => sum + merge.mergedCharges.length, 0);

  return {
    failed: states.includes(CronJobStepState.Failed),
    withErrors: states.includes(CronJobStepState.CompletedWithErrors),
    description: [
      `${plural(mergedAwayCount, 'charge')} merged`,
      `${plural(flaggedFees.length, 'fee')} flagged`,
      `${plural(filledDebitDates.length, 'debit date')} filled`,
    ].join(' · '),
  };
}
