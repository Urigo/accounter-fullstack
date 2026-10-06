import { useMemo, type ReactElement } from 'react';
import { Client, Provider, type Exchange, type OperationResult } from 'urql';
import { filter, make, mergeMap, pipe } from 'wonka';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CronJobStep, CronJobStepState } from '../../gql/graphql.js';
import type { TimelessDateString } from '../../helpers/index.js';
import { Toaster } from '../ui/sonner.js';
import type { CronJobsRunEvent } from './cron-jobs-events.js';
import { CronJobs, CronJobsView } from './index.js';

// --- fixtures -------------------------------------------------------------------------------

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

function transaction(
  id: string,
  {
    eventDate,
    amount,
    description,
    account,
  }: { eventDate: TimelessDateString; amount: string; description: string; account: string },
) {
  return {
    id,
    chargeId: `charge-of-${id}`,
    eventDate,
    sourceDescription: description,
    amount: { formatted: amount },
    account: { id: `account-${account}`, name: account },
  };
}

const flaggedFees: CronJobsRunEvent[] = [
  {
    __typename: 'ForeignFeeTransactionFlagged',
    transaction: transaction('fee-1', {
      eventDate: '2026-09-02',
      amount: '$ -12.00',
      description: 'העברת מט"ח - עמלה',
      account: 'Poalim USD ••1234',
    }),
  },
  {
    __typename: 'ForeignFeeTransactionFlagged',
    transaction: transaction('fee-2', {
      eventDate: '2026-09-15',
      amount: '€ -8.50',
      description: 'העברת מט"ח - עמלת תיווך',
      account: 'Poalim EUR ••5678',
    }),
  },
];

const mergedCharges: CronJobsRunEvent[] = [
  {
    __typename: 'ChargesMergedByReference',
    reference: '4471902',
    baseCharge: {
      id: 'charge-acme',
      userDescription: 'Monthly hosting',
      minEventDate: '2026-09-03',
      totalAmount: { formatted: '$ -1,212.00' },
      counterparty: { id: 'business-acme', name: 'Acme Cloud Ltd' },
    },
    mergedCharges: [
      {
        id: 'charge-acme-fee',
        description: 'העברת מט"ח - עמלה',
        date: '2026-09-03',
        amount: { formatted: '$ -12.00' },
      },
    ],
  },
  {
    __typename: 'ChargesMergedByReference',
    reference: '00918273',
    baseCharge: {
      id: 'charge-securities',
      userDescription: null,
      minEventDate: '2026-09-10',
      totalAmount: { formatted: '$ 25,000.00' },
      counterparty: { id: 'business-broker', name: 'Interactive Brokers' },
    },
    mergedCharges: [
      {
        id: 'charge-securities-1',
        description: 'FSEC 00918273',
        date: '2026-09-10',
        amount: { formatted: '$ 12,500.00' },
      },
      {
        id: 'charge-securities-2',
        description: 'ניע"ז 00918273',
        date: '2026-09-10',
        amount: null,
      },
    ],
  },
];

const filledDebitDates: CronJobsRunEvent[] = [
  {
    __typename: 'CreditcardDebitDateFilled',
    debitDate: '2026-10-02',
    transaction: transaction('cc-1', {
      eventDate: '2026-09-05',
      amount: '₪ -349.90',
      description: 'SUPER-PHARM TEL AVIV',
      account: 'Isracard ••4821',
    }),
  },
  {
    __typename: 'CreditcardDebitDateFilled',
    debitDate: '2026-10-02',
    transaction: transaction('cc-2', {
      eventDate: '2026-09-11',
      amount: '₪ -1,120.00',
      description: 'EL AL ISRAEL AIRLINES',
      account: 'Isracard ••4821',
    }),
  },
  {
    __typename: 'CreditcardDebitDateFilled',
    debitDate: '2026-10-10',
    transaction: transaction('cc-3', {
      eventDate: '2026-09-18',
      amount: '₪ -86.00',
      description: 'WOLT',
      account: 'Amex ••0917',
    }),
  },
];

/** A full successful run, in the order the server streams it. */
const completedRun: CronJobsRunEvent[] = [
  status(CronJobStep.FlagForeignFees, CronJobStepState.Running),
  ...flaggedFees,
  status(CronJobStep.FlagForeignFees, CronJobStepState.Succeeded, { affectedCount: 2 }),
  status(CronJobStep.MergeChargesByReference, CronJobStepState.Running),
  ...mergedCharges,
  status(CronJobStep.MergeChargesByReference, CronJobStepState.Succeeded, { affectedCount: 2 }),
  status(CronJobStep.FillCreditcardDebitDates, CronJobStepState.Running),
  ...filledDebitDates,
  status(CronJobStep.FillCreditcardDebitDates, CronJobStepState.Succeeded, { affectedCount: 3 }),
];

// --- live stream harness --------------------------------------------------------------------

/**
 * Answers the `RunCronJobs` mutation the way the server does with `@stream`: one result per
 * event, each carrying everything received so far, with `hasNext` set until the last one.
 */
function streamingExchange(events: readonly CronJobsRunEvent[], delayMs: number): Exchange {
  return () => operations$ =>
    pipe(
      operations$,
      filter(operation => operation.kind === 'mutation'),
      mergeMap(operation =>
        make<OperationResult>(({ next, complete }) => {
          let received = 0;
          const timer = setInterval(() => {
            received++;
            next({
              operation,
              data: {
                runCronJobs: { __typename: 'CronJobsRun', events: events.slice(0, received) },
              },
              error: undefined,
              extensions: undefined,
              hasNext: received < events.length,
              stale: false,
            });
            if (received >= events.length) {
              clearInterval(timer);
              complete();
            }
          }, delayMs);
          return () => clearInterval(timer);
        }),
      ),
    );
}

function LiveStreamHarness({
  events,
  delayMs,
}: {
  events: readonly CronJobsRunEvent[];
  delayMs: number;
}): ReactElement {
  const client = useMemo(
    () => new Client({ url: '/graphql', exchanges: [streamingExchange(events, delayMs)] }),
    [events, delayMs],
  );
  return (
    <Provider value={client}>
      <CronJobs />
      <Toaster />
    </Provider>
  );
}

// --- stories --------------------------------------------------------------------------------

const meta = {
  title: 'Screens/CronJobs',
  component: CronJobsView,
  parameters: { layout: 'padded' },
  args: { running: false, events: [], onRun: () => void 0 },
} satisfies Meta<typeof CronJobsView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before the first run of the session. */
export const NotRunYet: Story = {};

/** Mid-run: fees are done, merges are streaming in, debit dates have not started. */
export const Running: Story = {
  args: {
    running: true,
    events: completedRun.slice(0, completedRun.indexOf(mergedCharges[0]) + 1),
  },
};

export const Completed: Story = {
  args: { events: completedRun },
};

export const NothingToUpdate: Story = {
  args: {
    events: [
      status(CronJobStep.FlagForeignFees, CronJobStepState.Succeeded, { affectedCount: 0 }),
      status(CronJobStep.MergeChargesByReference, CronJobStepState.Succeeded, {
        affectedCount: 0,
      }),
      status(CronJobStep.FillCreditcardDebitDates, CronJobStepState.Succeeded, {
        affectedCount: 0,
      }),
    ],
  },
};

/** One merge failed; the run carried on with the next step. */
export const CompletedWithErrors: Story = {
  args: {
    events: [
      status(CronJobStep.FlagForeignFees, CronJobStepState.Succeeded, { affectedCount: 2 }),
      ...flaggedFees,
      mergedCharges[0],
      status(CronJobStep.MergeChargesByReference, CronJobStepState.CompletedWithErrors, {
        affectedCount: 1,
        errors: [
          'Failed to merge reference "00918273" into charge ID=charge-securities: Charge is locked by ledger lock',
        ],
      }),
      ...filledDebitDates,
      status(CronJobStep.FillCreditcardDebitDates, CronJobStepState.Succeeded, {
        affectedCount: 3,
      }),
    ],
  },
};

/** The first step failed, so the others were skipped. */
export const StepFailed: Story = {
  args: {
    events: [
      status(CronJobStep.FlagForeignFees, CronJobStepState.Failed, {
        errors: ['Connection terminated unexpectedly'],
      }),
      status(CronJobStep.MergeChargesByReference, CronJobStepState.Skipped),
      status(CronJobStep.FillCreditcardDebitDates, CronJobStepState.Skipped),
    ],
  },
};

/**
 * The real screen against a mocked client that streams a full run: click "Run cron jobs",
 * confirm, and watch each step fill in as its events arrive.
 */
export const LiveStream: Story = {
  render: () => <LiveStreamHarness events={completedRun} delayMs={400} />,
};
