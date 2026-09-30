import { describe, expect, it } from 'vitest';
import { CronJobStep, CronJobStepState } from '../../../gql/graphql.js';
import {
  groupCronJobEvents,
  summarizeCronJobEvents,
  type CronJobsRunEvent,
} from '../cron-jobs-events.js';

function status(
  step: CronJobStep,
  state: CronJobStepState,
  extra: { affectedCount?: number; errors?: string[] } = {},
): CronJobsRunEvent {
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

const merge: CronJobsRunEvent = {
  __typename: 'ChargesMergedByReference',
  reference: 'REF-1',
  baseCharge: {
    id: 'charge-a',
    userDescription: null,
    minEventDate: new Date('2026-01-10'),
    totalAmount: { formatted: '₪ 10.00' },
    counterparty: null,
  },
  mergedCharges: [
    { id: 'charge-b', description: null, date: null, amount: null },
    { id: 'charge-c', description: null, date: null, amount: null },
  ],
};

describe('groupCronJobEvents', () => {
  it('reports steps without a status as pending', () => {
    const { steps } = groupCronJobEvents([]);

    expect(Object.values(steps).map(step => step.state)).toEqual(['PENDING', 'PENDING', 'PENDING']);
  });

  it('keeps the latest status of each step and collects the changes', () => {
    const events: CronJobsRunEvent[] = [
      status(CronJobStep.FlagForeignFees, CronJobStepState.Running),
      { __typename: 'ForeignFeeTransactionFlagged', transaction: transaction('fee-1') },
      status(CronJobStep.FlagForeignFees, CronJobStepState.Succeeded, { affectedCount: 1 }),
      status(CronJobStep.MergeChargesByReference, CronJobStepState.Running),
      merge,
    ];

    const view = groupCronJobEvents(events);

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
  });
});

describe('summarizeCronJobEvents', () => {
  it('counts merged-away charges, flagged fees and filled debit dates', () => {
    const summary = summarizeCronJobEvents([
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
    ]);

    expect(summary).toEqual({
      failed: false,
      withErrors: false,
      description: '2 charges merged · 1 fee flagged · 2 debit dates filled',
    });
  });

  it('flags failed and partially failed runs', () => {
    expect(
      summarizeCronJobEvents([
        status(CronJobStep.FlagForeignFees, CronJobStepState.Failed, { errors: ['boom'] }),
      ]),
    ).toMatchObject({ failed: true, withErrors: false });
    expect(
      summarizeCronJobEvents([
        status(CronJobStep.MergeChargesByReference, CronJobStepState.CompletedWithErrors, {
          errors: ['one merge failed'],
        }),
      ]),
    ).toMatchObject({ failed: false, withErrors: true });
  });
});
