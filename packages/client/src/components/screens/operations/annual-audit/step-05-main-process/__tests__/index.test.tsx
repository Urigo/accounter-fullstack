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

vi.mock('@/gql/graphql.js', () => ({
  Step05PrevYearTemplateDocument: {},
}));

vi.mock('../../approval-control.js', () => ({
  ApprovalControl: () => null,
  gqlStatusToStepStatus: (status: string) => status.toLowerCase(),
}));

// Stub BaseStepCard: render actions as links, then children
vi.mock('../../step-base.js', () => ({
  BaseStepCard: ({
    children,
    actions,
  }: {
    children?: React.ReactNode;
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
      children,
    ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { Step05MainProcess } from '../index.js';

// ── helpers ────────────────────────────────────────────────────────────────

const OWNER = 'owner-1';

async function render(props: {
  /** Previous year's step 09 evidence (the baseline) */
  baseline?: Record<string, string> | null;
}) {
  const { baseline = null } = props;
  useQueryMock.mockReturnValue([
    {
      data: {
        annualAuditStepStatuses: baseline
          ? [{ id: `${OWNER}:9`, stepId: '9', status: 'COMPLETED', evidence: JSON.stringify(baseline) }]
          : [],
      },
      fetching: false,
    },
    vi.fn(),
  ]);

  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(Step05MainProcess, {
        id: '5',
        title: 'Audit Main Process',
        year: 2025,
        adminBusinessId: OWNER,
        manualData: [],
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

function linkParams(container: HTMLElement, testId: string) {
  const href = container.querySelector(`[data-testid="${testId}"]`)?.getAttribute('href');
  if (!href) return null;
  const params = new URL(href, 'http://localhost').searchParams;
  return { template: params.get('template'), from: params.get('from'), to: params.get('to') };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('Step05MainProcess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the previous year's final templates", async () => {
    const { cleanup } = await render({});
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { ownerId: OWNER, year: 2024 } }),
    );
    await cleanup();
  });

  it("opens each report with last year's final template for it", async () => {
    const { container, cleanup } = await render({
      baseline: { balanceSheetTemplateName: 'bs-2024', profitAndLossTemplateName: 'pnl-2024' },
    });

    expect(linkParams(container, 'action-Balance Sheet')).toEqual({
      template: 'bs-2024',
      from: '1900-01-01',
      to: '2025-12-31',
    });
    expect(linkParams(container, 'action-Profit and Loss')).toEqual({
      template: 'pnl-2024',
      from: '2025-01-01',
      to: '2025-12-31',
    });
    expect(
      container.querySelector('[data-testid="action-Balance Sheet"]')?.getAttribute('target'),
    ).toBe('_blank');

    await cleanup();
  });

  it('uses a legacy single final template for both reports', async () => {
    const { container, cleanup } = await render({
      baseline: { lockedTemplateName: 'final-2024' },
    });

    expect(linkParams(container, 'action-Balance Sheet')?.template).toBe('final-2024');
    expect(linkParams(container, 'action-Profit and Loss')?.template).toBe('final-2024');

    await cleanup();
  });

  it('offers to create a template when last year has none', async () => {
    const { container, cleanup } = await render({});

    expect(
      container.querySelector('[data-testid="action-Create Dynamic Report Template"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="action-Balance Sheet"]')).toBeNull();

    await cleanup();
  });
});
