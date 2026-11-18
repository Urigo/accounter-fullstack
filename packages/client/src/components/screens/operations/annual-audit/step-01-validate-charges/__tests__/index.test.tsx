import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── hoisted mocks ──────────────────────────────────────────────────────────

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('urql', () => ({
  useQuery: useQueryMock,
  useMutation: vi.fn(() => [{ fetching: false }, vi.fn()]),
}));

vi.mock('../../approval-control.js', () => ({
  ApprovalControl: () => null,
  gqlStatusToStepStatus: (status: string) => status.toLowerCase(),
}));

// Stub BaseStepCard: render actions as links, then the footer
vi.mock('../../step-base.js', () => ({
  BaseStepCard: ({
    footer,
    actions,
  }: {
    footer?: React.ReactNode;
    actions?: Array<{ label: string; href?: string; openInNewTab?: boolean }>;
  }) =>
    React.createElement(
      'div',
      null,
      ...(actions ?? []).map(action =>
        React.createElement(
          'a',
          {
            key: action.label,
            href: action.href,
            target: action.openInNewTab ? '_blank' : undefined,
            'data-testid': `action-${action.label}`,
          },
          action.label,
        ),
      ),
      React.createElement('div', { 'data-testid': 'footer' }, footer),
    ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { Step01ValidateCharges } from '../index.js';

// ── helpers ────────────────────────────────────────────────────────────────

const OWNER = 'owner-1';

type Counts = {
  totalCharges: number;
  approvedCount: number;
  pendingCount: number;
  unapprovedCount: number;
};

async function render(props: {
  /** Counts returned by the approval-status query; `null` = not fetched */
  counts: Counts | null;
  /** Persisted manual status for this step, if any */
  manualStatus?: string;
}) {
  const { counts, manualStatus } = props;
  useQueryMock.mockReturnValue([
    {
      data: counts ? { accountantApprovalStatus: counts } : undefined,
      fetching: false,
      error: undefined,
    },
    vi.fn(),
  ]);

  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(Step01ValidateCharges, {
        id: '1',
        title: 'Validate All Charges',
        year: 2025,
        adminBusinessId: OWNER,
        manualData: manualStatus
          ? ([{ id: `${OWNER}:1`, stepId: '1', status: manualStatus, notes: null }] as never)
          : [],
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

function footerText(container: HTMLElement) {
  return container.querySelector('[data-testid="footer"]')?.textContent ?? '';
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('Step01ValidateCharges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not report charges needing attention before the counts are fetched', async () => {
    const { container, cleanup } = await render({ counts: null, manualStatus: 'PENDING' });

    expect(footerText(container)).not.toContain('need attention');
    expect(footerText(container)).toContain('Not checked');

    await cleanup();
  });

  it('reports zero when every charge is approved', async () => {
    const { container, cleanup } = await render({
      counts: { totalCharges: 5, approvedCount: 5, pendingCount: 0, unapprovedCount: 0 },
    });

    expect(footerText(container)).toContain('0 need attention');

    await cleanup();
  });

  it('sums pending and unapproved charges', async () => {
    const { container, cleanup } = await render({
      counts: { totalCharges: 10, approvedCount: 7, pendingCount: 2, unapprovedCount: 1 },
    });

    expect(footerText(container)).toContain('3 need attention');

    await cleanup();
  });

  it('opens Review Charges in a new tab', async () => {
    for (const manualStatus of [undefined, 'PENDING']) {
      const { container, cleanup } = await render({ counts: null, manualStatus });

      const link = container.querySelector('[data-testid="action-Review Charges"]');
      expect(link?.getAttribute('target')).toBe('_blank');

      await cleanup();
    }
  });
});
