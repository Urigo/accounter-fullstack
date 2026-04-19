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
import type { StepStatus } from '../../step-base.js';
import type { AnnualAuditStepsStatusQuery } from '@/gql/graphql.js';

type QueryState = {
  data?: unknown;
  fetching?: boolean;
  error?: unknown;
};

async function renderStep03(params: {
  openingState: QueryState;
  manualData?: AnnualAuditStepsStatusQuery['annualAuditStepStatuses'];
  adminBusinessId?: string;
  onStatusChange?: (stepId: string, status: StepStatus) => void;
}): Promise<{ container: HTMLDivElement; cleanup: () => Promise<void> }> {
  const { openingState, manualData, adminBusinessId, onStatusChange = vi.fn() } = params;

  useQueryMock.mockReturnValue([
    { data: openingState.data, fetching: !!openingState.fetching, error: openingState.error },
  ]);

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
        onStatusChange,
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

const CONTINUING_STATUS_INFO = {
  id: 'owner-1:2024',
  userType: 'CONTINUING',
  balanceChargeId: null,
  derivedStatus: 'PENDING',
  errorMessage: null,
};

describe('Step03OpeningBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── status derivation ──────────────────────────────────────────────────────

  it('uses persisted manual status for the base step and hydrates notes', async () => {
    const { container, cleanup } = await renderStep03({
      openingState: {
        data: { annualAuditOpeningBalanceStatus: CONTINUING_STATUS_INFO },
        fetching: false,
      },
      adminBusinessId: 'owner-1',
      manualData: [{ id: 'owner-1:2024:3', stepId: '3', status: 'COMPLETED', notes: 'already reviewed' }],
    });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('completed');

    const approval = container.querySelector('[data-testid="approval-control"]');
    expect(approval?.getAttribute('data-initial-status')).toBe('COMPLETED');
    expect(approval?.getAttribute('data-initial-notes')).toBe('already reviewed');

    await cleanup();
  });

  it('falls back to derived status when no persisted step record exists', async () => {
    const { container, cleanup } = await renderStep03({
      openingState: {
        data: { annualAuditOpeningBalanceStatus: CONTINUING_STATUS_INFO },
        fetching: false,
      },
      adminBusinessId: 'owner-1',
      manualData: [],
    });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('pending');

    await cleanup();
  });

  it('uses derived status while manualData is not yet available', async () => {
    const { container, cleanup } = await renderStep03({
      openingState: {
        data: { annualAuditOpeningBalanceStatus: CONTINUING_STATUS_INFO },
        fetching: false,
      },
      adminBusinessId: 'owner-1',
      manualData: undefined,
    });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('pending');

    await cleanup();
  });

  it('shows blocked status when adminBusinessId is absent', async () => {
    const { container, cleanup } = await renderStep03({
      openingState: { fetching: false },
      manualData: [],
      adminBusinessId: undefined,
    });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('blocked');
    expect(container.querySelector('[data-testid="approval-control"]')).toBeNull();

    await cleanup();
  });

  it('shows loading status while the query is fetching', async () => {
    const { container, cleanup } = await renderStep03({
      openingState: { fetching: true },
      adminBusinessId: 'owner-1',
      manualData: [],
    });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('loading');

    await cleanup();
  });

  it('falls back to pending on query error', async () => {
    const { container, cleanup } = await renderStep03({
      openingState: { fetching: false, error: new Error('Network error') },
      adminBusinessId: 'owner-1',
      manualData: [],
    });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('pending');

    await cleanup();
  });

  it('calls onStatusChange with the final status on mount', async () => {
    const onStatusChange = vi.fn();
    const { cleanup } = await renderStep03({
      openingState: {
        fetching: false,
        data: {
          annualAuditOpeningBalanceStatus: {
            ...CONTINUING_STATUS_INFO,
            derivedStatus: 'COMPLETED',
          },
        },
      },
      adminBusinessId: 'owner-1',
      manualData: [],
      onStatusChange,
    });

    expect(onStatusChange).toHaveBeenCalledWith('3', 'completed');

    await cleanup();
  });

  // ── userType branch rendering ──────────────────────────────────────────────

  it('renders Configuration Incomplete alert when statusInfo is null after fetch', async () => {
    const { container, cleanup } = await renderStep03({
      openingState: { fetching: false, data: { annualAuditOpeningBalanceStatus: null } },
      adminBusinessId: 'owner-1',
      manualData: [],
    });

    expect(container.textContent).toContain('Configuration Incomplete');

    await cleanup();
  });

  it('renders No Opening Balance Required alert for NEW userType', async () => {
    const { container, cleanup } = await renderStep03({
      openingState: {
        fetching: false,
        data: {
          annualAuditOpeningBalanceStatus: {
            id: 'owner-1:2024',
            userType: 'NEW',
            balanceChargeId: null,
            derivedStatus: 'COMPLETED',
            errorMessage: null,
          },
        },
      },
      adminBusinessId: 'owner-1',
      manualData: [],
    });

    expect(container.textContent).toContain('No Opening Balance Required');

    await cleanup();
  });

  it('renders Configuration Error alert with message for ERROR userType', async () => {
    const { container, cleanup } = await renderStep03({
      openingState: {
        fetching: false,
        data: {
          annualAuditOpeningBalanceStatus: {
            id: 'owner-1:2024',
            userType: 'ERROR',
            balanceChargeId: null,
            derivedStatus: 'PENDING',
            errorMessage: 'Missing dateEstablished',
          },
        },
      },
      adminBusinessId: 'owner-1',
      manualData: [],
    });

    expect(container.textContent).toContain('Configuration Error');
    expect(container.textContent).toContain('Missing dateEstablished');

    await cleanup();
  });

  it('renders MigratingSubsteps and ApprovalControl for MIGRATING userType', async () => {
    const { container, cleanup } = await renderStep03({
      openingState: {
        fetching: false,
        data: {
          annualAuditOpeningBalanceStatus: {
            id: 'owner-1:2024',
            userType: 'MIGRATING',
            balanceChargeId: 'charge-abc',
            derivedStatus: 'IN_PROGRESS',
            errorMessage: null,
          },
        },
      },
      adminBusinessId: 'owner-1',
      manualData: [],
    });

    expect(container.querySelector('[data-testid="migrating-substeps"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="approval-control"]')).not.toBeNull();

    await cleanup();
  });

  it('renders ApprovalControl but not MigratingSubsteps for CONTINUING userType', async () => {
    const { container, cleanup } = await renderStep03({
      openingState: {
        fetching: false,
        data: { annualAuditOpeningBalanceStatus: CONTINUING_STATUS_INFO },
      },
      adminBusinessId: 'owner-1',
      manualData: [],
    });

    expect(container.querySelector('[data-testid="approval-control"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="migrating-substeps"]')).toBeNull();

    await cleanup();
  });
});
