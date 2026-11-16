import { describe, expect, it } from 'vitest';
import { CronJobStep, CronJobStepState } from '../../../gql/graphql.js';
import {
  AUTOMATION_STEPS,
  groupAutomationEvents,
  summarizeAutomationEvents,
  type ManualAutomationsRunEvent,
} from '../manual-automations-events.js';

function status(
  step: CronJobStep,
  state: CronJobStepState,
  extra: { affectedCount?: number; errors?: string[] } = {},
): ManualAutomationsRunEvent {
  return {
    __typename: 'CronJobStepStatus',
    step,
    state,
    affectedCount: extra.affectedCount ?? null,
    errors: extra.errors ?? null,
  };
}

function transaction(id: string) {
  return {
    id,
    chargeId: `charge-of-${id}`,
    eventDate: '2026-01-10',
    sourceDescription: 'description',
    amount: { formatted: '₪ 10.00' },
    account: { id: 'account-1', name: 'Account' },
  } as const;
}

const merge: ManualAutomationsRunEvent = {
  __typename: 'ChargesMergedByReference',
  reference: 'REF-1',
  baseCharge: {
    id: 'charge-a',
    userDescription: null,
    minEventDate: '2026-01-10',
    totalAmount: { formatted: '₪ 10.00' },
    counterparty: null,
  },
  mergedCharges: [
    { id: 'charge-b', description: null, date: null, amount: null },
    { id: 'charge-c', description: null, date: null, amount: null },
  ],
};

const deelCharge: ManualAutomationsRunEvent = {
  __typename: 'DeelChargeSynced',
  isNew: true,
  invoiceCount: 2,
  charge: {
    id: 'charge-deel',
    userDescription: 'Deel payment for Dana',
    minDocumentsDate: '2026-02-01',
    totalAmount: { formatted: '$ -4,920.00' },
    counterparty: { id: 'business-deel', name: 'Deel' },
  },
};

describe('groupAutomationEvents', () => {
  it('reports steps without a status as pending', () => {
    const { steps } = groupAutomationEvents([]);

    expect(Object.values(steps).map(step => step.state)).toEqual(AUTOMATION_STEPS.map(() => 'PENDING'));
    expect(Object.keys(steps)).toEqual([...AUTOMATION_STEPS]);
  });

  it('keeps the latest status of each step and collects the changes', () => {
    const events: ManualAutomationsRunEvent[] = [
      status(CronJobStep.FlagForeignFees, CronJobStepState.Running),
      { __typename: 'ForeignFeeTransactionFlagged', transaction: transaction('fee-1') },
      status(CronJobStep.FlagForeignFees, CronJobStepState.Succeeded, { affectedCount: 1 }),
      status(CronJobStep.MergeChargesByReference, CronJobStepState.Running),
      merge,
    ];

    const view = groupAutomationEvents(events);

    expect(view.steps[CronJobStep.FlagForeignFees]).toEqual({
      state: CronJobStepState.Succeeded,
      affectedCount: 1,
      errors: [],
    });
    expect(view.steps[CronJobStep.MergeChargesByReference].state).toBe(CronJobStepState.Running);
    expect(view.steps[CronJobStep.FillCreditcardDebitDates].state).toBe('PENDING');
    expect(view.flaggedFees.map(fee => fee.transaction.id)).toEqual(['fee-1']);
    expect(view.mergedCharges).toEqual([merge]);
    expect(view.filledDebitDates).toEqual([]);
    expect(view.deelCharges).toEqual([]);
  });

  it('collects the charges the Deel step pulled', () => {
    const view = groupAutomationEvents([
      status(CronJobStep.FetchDeelDocuments, CronJobStepState.Running),
      deelCharge,
      status(CronJobStep.FetchDeelDocuments, CronJobStepState.Succeeded, { affectedCount: 1 }),
    ]);

    expect(view.deelCharges).toEqual([deelCharge]);
    expect(view.steps[CronJobStep.FetchDeelDocuments].state).toBe(CronJobStepState.Succeeded);
  });
});

describe('summarizeAutomationEvents', () => {
  it('counts merged-away charges, flagged fees and filled debit dates', () => {
    const summary = summarizeAutomationEvents([
      merge,
      { __typename: 'ForeignFeeTransactionFlagged', transaction: transaction('fee-1') },
      {
        __typename: 'CreditcardDebitDateFilled',
        debitDate: '2026-02-02',
        transaction: transaction('cc-1'),
      },
      {
        __typename: 'CreditcardDebitDateFilled',
        debitDate: '2026-02-02',
        transaction: transaction('cc-2'),
      },
      deelCharge,
    ]);

    expect(summary).toEqual({
      failed: false,
      withErrors: false,
      description:
        '2 charges merged · 1 fee flagged · 2 debit dates filled · 1 Deel charge pulled',
    });
  });

  it('leaves Deel out when it is not connected', () => {
    expect(
      summarizeAutomationEvents([
        status(CronJobStep.FetchDeelDocuments, CronJobStepState.NotConfigured, {
          affectedCount: 0,
        }),
      ]).description,
    ).toBe('0 charges merged · 0 fees flagged · 0 debit dates filled');
  });

  it('flags failed and partially failed runs', () => {
    expect(
      summarizeAutomationEvents([
        status(CronJobStep.FlagForeignFees, CronJobStepState.Failed, { errors: ['boom'] }),
      ]),
    ).toMatchObject({ failed: true, withErrors: false });
    expect(
      summarizeAutomationEvents([
        status(CronJobStep.MergeChargesByReference, CronJobStepState.CompletedWithErrors, {
          errors: ['one merge failed'],
        }),
      ]),
    ).toMatchObject({ failed: false, withErrors: true });
  });
});
