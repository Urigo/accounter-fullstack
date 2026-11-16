import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── hoisted mocks ──────────────────────────────────────────────────────────

const { useQueryMock, setWorkingTemplateMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  setWorkingTemplateMock: vi.fn(),
}));

vi.mock('urql', () => ({
  useQuery: useQueryMock,
  useMutation: vi.fn(() => [{ fetching: false }, vi.fn()]),
}));

vi.mock('@/hooks/use-set-annual-audit-working-template.js', () => ({
  useSetAnnualAuditWorkingTemplate: () => ({
    fetching: false,
    setWorkingTemplate: setWorkingTemplateMock,
  }),
}));

vi.mock('@/gql/graphql.js', () => ({
  Step05TemplatesDocument: {},
  AnnualAuditReportType: {
    BalanceSheet: 'BALANCE_SHEET',
    ProfitAndLoss: 'PROFIT_AND_LOSS',
  },
}));

vi.mock('../../approval-control.js', () => ({
  ApprovalControl: () => null,
  gqlStatusToStepStatus: (status: string) => status.toLowerCase(),
}));

// Stub shadcn/ui Select to a native <select>
vi.mock('../../../../../ui/select.js', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) =>
    React.createElement(
      'select',
      {
        value,
        'data-testid': 'select-input',
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(e.target.value),
      },
      children,
    ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) =>
    React.createElement('option', { value, 'data-testid': `select-item-${value}` }, children),
}));

// Stub BaseStepCard: render actions as links, then children
vi.mock('../../step-base.js', () => ({
  BaseStepCard: ({
    children,
    actions,
  }: {
    children?: React.ReactNode;
    actions?: Array<{ label: string; href?: string }>;
  }) =>
    React.createElement(
      'div',
      null,
      ...(actions ?? []).map(action =>
        React.createElement(
          'a',
          { key: action.label, href: action.href, 'data-testid': `action-${action.label}` },
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
const BS = 'BALANCE_SHEET';
const PNL = 'PROFIT_AND_LOSS';

function statusRow(stepId: string, evidence: Record<string, string> | null) {
  return {
    id: `${OWNER}:${stepId}`,
    stepId,
    status: 'PENDING',
    notes: null,
    evidence: evidence ? JSON.stringify(evidence) : null,
  };
}

async function render(props: {
  /** Previous year's step 09 evidence (the baseline) */
  baseline?: Record<string, string> | null;
  /** This year's step 05 evidence (the working templates) */
  working?: Record<string, string> | null;
  templates?: Array<{ name: string; isLocked?: boolean }>;
  refetchManualData?: () => void;
}) {
  const { baseline = null, working = null, templates = [] } = props;
  useQueryMock.mockReturnValue([
    {
      data: {
        annualAuditStepStatuses: baseline ? [statusRow('9', baseline)] : [],
        allDynamicReports: templates.map(t => ({
          id: t.name,
          name: t.name,
          isLocked: t.isLocked ?? false,
        })),
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
        manualData: (working ? [statusRow('5', working)] : []) as never,
        refetchManualData: props.refetchManualData,
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

function templateParam(container: HTMLElement, testId: string): string | null {
  const href = container.querySelector(`[data-testid="${testId}"]`)?.getAttribute('href');
  if (!href) return null;
  return new URL(href, 'http://localhost').searchParams.get('template');
}

function datesOf(container: HTMLElement, testId: string) {
  const href = container.querySelector(`[data-testid="${testId}"]`)?.getAttribute('href') ?? '';
  const params = new URL(href, 'http://localhost').searchParams;
  return { from: params.get('from'), to: params.get('to') };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('Step05MainProcess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks for the previous year as the baseline', async () => {
    const { cleanup } = await render({});
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { ownerId: OWNER, prevYear: 2024 } }),
    );
    await cleanup();
  });

  it('opens each report with its working template', async () => {
    const { container, cleanup } = await render({
      baseline: { balanceSheetTemplateName: 'bs-2024', profitAndLossTemplateName: 'pnl-2024' },
      working: { balanceSheetTemplateName: 'bs-2025', profitAndLossTemplateName: 'pnl-2025' },
      templates: [{ name: 'bs-2025' }, { name: 'pnl-2025' }],
    });

    expect(templateParam(container, 'action-Balance Sheet')).toBe('bs-2025');
    expect(templateParam(container, 'action-Profit and Loss')).toBe('pnl-2025');
    expect(datesOf(container, 'action-Balance Sheet')).toEqual({
      from: '1900-01-01',
      to: '2025-12-31',
    });
    expect(datesOf(container, 'action-Profit and Loss')).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    });
    // Baselines stay one click away
    expect(templateParam(container, `baseline-link-${BS}`)).toBe('bs-2024');
    expect(templateParam(container, `baseline-link-${PNL}`)).toBe('pnl-2024');

    await cleanup();
  });

  it("falls back per report to last year's final template", async () => {
    const { container, cleanup } = await render({
      baseline: { balanceSheetTemplateName: 'bs-2024', profitAndLossTemplateName: 'pnl-2024' },
      working: { balanceSheetTemplateName: 'bs-2025' },
      templates: [{ name: 'bs-2025' }],
    });

    expect(templateParam(container, 'action-Balance Sheet')).toBe('bs-2025');
    expect(templateParam(container, 'action-Profit and Loss')).toBe('pnl-2024');
    expect(container.querySelector(`[data-testid="working-link-${PNL}"]`)).toBeNull();

    await cleanup();
  });

  it('uses a legacy single baseline template for both reports', async () => {
    const { container, cleanup } = await render({
      baseline: { lockedTemplateName: 'final-2024' },
    });

    expect(templateParam(container, 'action-Balance Sheet')).toBe('final-2024');
    expect(templateParam(container, 'action-Profit and Loss')).toBe('final-2024');

    await cleanup();
  });

  it('offers to create a template when there is neither a baseline nor a working one', async () => {
    const { container, cleanup } = await render({});

    expect(container.querySelector('[data-testid="action-Create Dynamic Report Template"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="action-Balance Sheet"]')).toBeNull();

    await cleanup();
  });

  it('saves a working template change for that report and refreshes step data', async () => {
    const refetchManualData = vi.fn();
    setWorkingTemplateMock.mockResolvedValue({});
    const { container, cleanup } = await render({
      templates: [{ name: 'wip' }, { name: 'locked-elsewhere', isLocked: true }],
      refetchManualData,
    });

    const pnlRow = container.querySelector(`[data-testid="slot-${PNL}"]`)!;
    // Templates locked by a closed year aren't offered as working templates
    expect(pnlRow.querySelector('[data-testid="select-item-locked-elsewhere"]')).toBeNull();

    const select = pnlRow.querySelector('[data-testid="select-input"]') as HTMLSelectElement;
    await act(async () => {
      select.value = 'wip';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(setWorkingTemplateMock).toHaveBeenCalledWith({
      input: { ownerId: OWNER, year: 2025, templateName: 'wip', reportType: PNL },
    });
    expect(refetchManualData).toHaveBeenCalled();

    await cleanup();
  });

  it('clears a working template back to the baseline', async () => {
    setWorkingTemplateMock.mockResolvedValue({});
    const { container, cleanup } = await render({
      baseline: { balanceSheetTemplateName: 'bs-2024', profitAndLossTemplateName: 'pnl-2024' },
      working: { balanceSheetTemplateName: 'wip' },
      templates: [{ name: 'wip' }],
    });

    const bsRow = container.querySelector(`[data-testid="slot-${BS}"]`)!;
    const select = bsRow.querySelector('[data-testid="select-input"]') as HTMLSelectElement;
    await act(async () => {
      select.value = '__clear__';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(setWorkingTemplateMock).toHaveBeenCalledWith({
      input: { ownerId: OWNER, year: 2025, templateName: null, reportType: BS },
    });

    await cleanup();
  });
});
