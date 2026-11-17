import {
  ManualAutomationStep,
  ManualAutomationStepState,
  type RunManualAutomationsMutation,
} from '../../gql/graphql.js';

export type ManualAutomationsRunEvent =
  RunManualAutomationsMutation['runManualAutomations']['events'][number];

type EventOf<T extends ManualAutomationsRunEvent['__typename']> = Extract<
  ManualAutomationsRunEvent,
  { __typename: T }
>;

export type FlaggedFee = EventOf<'ForeignFeeTransactionFlagged'>;
export type MergedCharges = EventOf<'ChargesMergedByReference'>;
export type FilledDebitDate = EventOf<'CreditcardDebitDateFilled'>;
export type DeelCharge = EventOf<'DeelChargeSynced'>;

/** A step that has not reported any status yet is `PENDING`. */
export type AutomationStepView = {
  state: ManualAutomationStepState | 'PENDING';
  affectedCount: number | null;
  errors: readonly string[];
};

export type ManualAutomationsRunView = {
  steps: Record<ManualAutomationStep, AutomationStepView>;
  flaggedFees: FlaggedFee[];
  mergedCharges: MergedCharges[];
  filledDebitDates: FilledDebitDate[];
  deelCharges: DeelCharge[];
};

/** Steps in execution order, as the server runs them. */
export const AUTOMATION_STEPS = [
  ManualAutomationStep.FlagForeignFees,
  ManualAutomationStep.MergeChargesByReference,
  ManualAutomationStep.FillCreditcardDebitDates,
  ManualAutomationStep.FetchDeelDocuments,
] as const;

const PENDING_STEP: AutomationStepView = { state: 'PENDING', affectedCount: null, errors: [] };

/** Folds the streamed events into the latest state of each step and the changes it made. */
export function groupAutomationEvents(
  events: readonly ManualAutomationsRunEvent[],
): ManualAutomationsRunView {
  const view: ManualAutomationsRunView = {
    steps: {
      [ManualAutomationStep.FlagForeignFees]: PENDING_STEP,
      [ManualAutomationStep.MergeChargesByReference]: PENDING_STEP,
      [ManualAutomationStep.FillCreditcardDebitDates]: PENDING_STEP,
      [ManualAutomationStep.FetchDeelDocuments]: PENDING_STEP,
    },
    flaggedFees: [],
    mergedCharges: [],
    filledDebitDates: [],
    deelCharges: [],
  };

  for (const event of events) {
    switch (event.__typename) {
      case 'ManualAutomationStepStatus':
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
      case 'DeelChargeSynced':
        view.deelCharges.push(event);
        break;
    }
  }

  return view;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * One-line outcome of a run, e.g.
 * "3 charges merged · 5 fees flagged · 12 debit dates filled · 2 Deel charges pulled".
 */
export function summarizeAutomationEvents(events: readonly ManualAutomationsRunEvent[]): {
  failed: boolean;
  withErrors: boolean;
  description: string;
} {
  const { steps, flaggedFees, mergedCharges, filledDebitDates, deelCharges } =
    groupAutomationEvents(events);
  const states = AUTOMATION_STEPS.map(step => steps[step].state);
  // count the charges that were folded into others, not the merge groups
  const mergedAwayCount = mergedCharges.reduce((sum, merge) => sum + merge.mergedCharges.length, 0);

  return {
    failed: states.includes(ManualAutomationStepState.Failed),
    withErrors: states.includes(ManualAutomationStepState.CompletedWithErrors),
    description: [
      `${plural(mergedAwayCount, 'charge')} merged`,
      `${plural(flaggedFees.length, 'fee')} flagged`,
      `${plural(filledDebitDates.length, 'debit date')} filled`,
      // a business without Deel never ran the pull, so "0 pulled" would be misleading
      ...(steps[ManualAutomationStep.FetchDeelDocuments].state ===
      ManualAutomationStepState.NotConfigured
        ? []
        : [`${plural(deelCharges.length, 'Deel charge')} pulled`]),
    ].join(' · '),
  };
}
