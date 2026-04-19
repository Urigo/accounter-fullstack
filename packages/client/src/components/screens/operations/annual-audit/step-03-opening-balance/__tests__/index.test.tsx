// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('urql', () => ({
  useQuery: useQueryMock,
  useMutation: vi.fn(() => [{ fetching: false }, vi.fn()]),
}));

vi.mock('@/router/routes.js', () => ({
  ROUTES: {
    REPORTS: {
      TRIAL_BALANCE: () => '/trial-balance',
    },
  },
}));

vi.mock('../../../../../../gql/graphql.js', () => ({
  AnnualAuditOpeningBalanceStatusDocument: {},
  AnnualAuditOpeningBalanceUserType: {
    Continuing: 'CONTINUING',
    Migrating: 'MIGRATING',
    New: 'NEW',
    Error: 'ERROR',
  },
  AnnualAuditStepStatus: {
    Completed: 'COMPLETED',
    InProgress: 'IN_PROGRESS',
    Pending: 'PENDING',
    Blocked: 'BLOCKED',
  },
}));

vi.mock('../../../../../ui/alert.js', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  AlertTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  AlertDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

vi.mock('../../../../../ui/collapsible.js', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

vi.mock('../migrating-substep.js', () => ({
  MigratingSubsteps: () => React.createElement('div', { 'data-testid': 'migrating-substeps' }),
}));

vi.mock('../../step-base.js', () => ({
  BaseStepCard: ({
    status,
    children,
  }: {
    status: string;
    children?: React.ReactNode;
  }) =>
    React.createElement('div', { 'data-testid': 'base-step-card', 'data-status': status }, children),
  SubstepWrapper: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('../../approval-control.js', () => ({
  ApprovalControl: ({
    initialStatus,
    initialNotes,
  }: {
    initialStatus?: string;
    initialNotes?: string | null;
  }) =>
    React.createElement('div', {
      'data-testid': 'approval-control',
      'data-initial-status': initialStatus ?? '',
      'data-initial-notes': initialNotes ?? '',
    }),
  gqlStatusToStepStatus: (status: string) => status.toLowerCase(),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { Step03OpeningBalance } from '../index.js';

type QueryState = {
  data?: unknown;
  fetching?: boolean;
  error?: unknown;
};

type ManualStatusesQueryData = {
  annualAuditStepStatuses?: unknown[];
};

async function renderStep03(params: {
  openingState: QueryState;
  manualState: QueryState;
  adminBusinessId?: string;
}): Promise<{ container: HTMLDivElement; cleanup: () => Promise<void> }> {
  const { openingState, manualState, adminBusinessId = 'owner-1' } = params;

  useQueryMock.mockReturnValue([
    { data: openingState.data, fetching: !!openingState.fetching, error: openingState.error },
  ]);

  const manualData =
    Array.isArray(manualState.data)
      ? manualState.data
      : ((manualState.data as ManualStatusesQueryData | undefined)?.annualAuditStepStatuses ?? []);

  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(Step03OpeningBalance, {
        id: '3',
        title: 'Verify Opening Balance',
        description: 'desc',
        year: 2024,
        adminBusinessId,
        onStatusChange: vi.fn(),
        manualData,
      }),
    );
    await Promise.resolve();
  });

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { container, cleanup };
}

describe('Step03OpeningBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses persisted manual status for the base step and hydrates notes', async () => {
    const openingState = {
      data: {
        annualAuditOpeningBalanceStatus: {
          id: 'owner-1:2024',
          userType: 'CONTINUING',
          balanceChargeId: null,
          derivedStatus: 'PENDING',
          errorMessage: null,
        },
      },
      fetching: false,
    };

    const manualState = {
      data: {
        annualAuditStepStatuses: [
          { id: 'owner-1:2024:3', stepId: '3', status: 'COMPLETED', notes: 'already reviewed' },
        ],
      },
      fetching: false,
    };

    const { container, cleanup } = await renderStep03({ openingState, manualState });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('completed');

    const approval = container.querySelector('[data-testid="approval-control"]');
    expect(approval?.getAttribute('data-initial-status')).toBe('COMPLETED');
    expect(approval?.getAttribute('data-initial-notes')).toBe('already reviewed');

    await cleanup();
  });

  it('falls back to derived status when no persisted step record exists', async () => {
    const openingState = {
      data: {
        annualAuditOpeningBalanceStatus: {
          id: 'owner-1:2024',
          userType: 'CONTINUING',
          balanceChargeId: null,
          derivedStatus: 'PENDING',
          errorMessage: null,
        },
      },
      fetching: false,
    };

    const manualState = {
      data: {
        annualAuditStepStatuses: [],
      },
      fetching: false,
    };

    const { container, cleanup } = await renderStep03({ openingState, manualState });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('pending');

    await cleanup();
  });

  it('uses derived status while manual statuses are not provided yet', async () => {
    const openingState = {
      data: {
        annualAuditOpeningBalanceStatus: {
          id: 'owner-1:2024',
          userType: 'CONTINUING',
          balanceChargeId: null,
          derivedStatus: 'PENDING',
          errorMessage: null,
        },
      },
      fetching: false,
    };

    const manualState = {
      data: undefined,
      fetching: true,
    };

    const { container, cleanup } = await renderStep03({ openingState, manualState });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('pending');

    await cleanup();
  });
});
