import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CronJobStep, CronJobStepState } from '../../../gql/graphql.js';
import { ROUTES } from '../../../router/routes.js';
import type { CronJobsRunEvent } from '../cron-jobs-events.js';
import { CronJobs } from '../index.js';

const { useRunCronJobsMock } = vi.hoisted(() => ({ useRunCronJobsMock: vi.fn() }));

vi.mock('../../../hooks/use-run-cron-jobs.js', () => ({
  useRunCronJobs: useRunCronJobsMock,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderCronJobs(state: { running: boolean; events: CronJobsRunEvent[] }) {
  useRunCronJobsMock.mockReturnValue({ ...state, error: undefined, runJobs: vi.fn() });
  container = document.createElement('div');
  document.body.append(container);
  await act(async () => {
    root = createRoot(container!);
    root.render(<MemoryRouter>{React.createElement(CronJobs)}</MemoryRouter>);
  });
  return container;
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const events: CronJobsRunEvent[] = [
  {
    __typename: 'CronJobStepStatus',
    step: CronJobStep.FlagForeignFees,
    state: CronJobStepState.Succeeded,
    affectedCount: 0,
    errors: null,
  },
  {
    __typename: 'CronJobStepStatus',
    step: CronJobStep.MergeChargesByReference,
    state: CronJobStepState.Running,
    affectedCount: null,
    errors: null,
  },
  {
    __typename: 'ChargesMergedByReference',
    reference: 'REF-123',
    baseCharge: {
      id: 'charge-a',
      userDescription: 'Supplier payment',
      minEventDate: '2026-01-10',
      totalAmount: { formatted: '₪ -100.00' },
      counterparty: { id: 'business-1', name: 'Acme Ltd' },
    },
    mergedCharges: [
      {
        id: 'charge-b',
        description: 'Transfer fee',
        date: '2026-01-10',
        amount: { formatted: '₪ -5.00' },
      },
    ],
  },
];

describe('CronJobs screen', () => {
  it('shows an empty state before the first run', async () => {
    const page = await renderCronJobs({ running: false, events: [] });

    expect(page.textContent).toContain('No run yet');
    expect(page.querySelectorAll('table')).toHaveLength(0);
  });

  it('renders each step as its events stream in', async () => {
    const page = await renderCronJobs({ running: true, events });

    // done, with nothing to do
    expect(page.textContent).toContain('Nothing to update');
    // the merge that already arrived, linked to the charge that was kept
    const chargeLink = page.querySelector(`a[href="${ROUTES.CHARGES.DETAIL('charge-a')}"]`);
    expect(chargeLink?.textContent).toContain('Acme Ltd');
    expect(page.textContent).toContain('REF-123');
    expect(page.textContent).toContain('+1');
    // not started yet
    expect(page.textContent).toContain('Waiting for previous steps');
    // no summary while running
    expect(page.textContent).not.toContain('fees flagged');
  });

  it('shows step errors and the run summary once done', async () => {
    const page = await renderCronJobs({
      running: false,
      events: [
        ...events,
        {
          __typename: 'CronJobStepStatus',
          step: CronJobStep.MergeChargesByReference,
          state: CronJobStepState.CompletedWithErrors,
          affectedCount: 1,
          errors: ['Failed to merge reference "REF-9"'],
        },
        {
          __typename: 'CronJobStepStatus',
          step: CronJobStep.FillCreditcardDebitDates,
          state: CronJobStepState.Failed,
          affectedCount: null,
          errors: ['DB is down'],
        },
      ],
    });

    expect(page.textContent).toContain('Some items failed');
    expect(page.textContent).toContain('Failed to merge reference "REF-9"');
    expect(page.textContent).toContain('Step failed');
    expect(page.textContent).toContain('DB is down');
    expect(page.textContent).toContain('1 charge merged · 0 fees flagged · 0 debit dates filled');
  });
});
