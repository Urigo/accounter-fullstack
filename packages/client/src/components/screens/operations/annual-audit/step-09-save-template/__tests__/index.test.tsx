// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── hoisted mocks ──────────────────────────────────────────────────────────

const {
  useQueryMock,
  setStep09StatusMock,
  useSetAnnualAuditStep09StatusMock,
} = vi.hoisted(() => {
  const setStep09StatusMock = vi.fn();
  const useSetAnnualAuditStep09StatusMock = vi.fn();

  return {
    useQueryMock: vi.fn(),
    setStep09StatusMock,
    useSetAnnualAuditStep09StatusMock,
  };
});

vi.mock('urql', () => ({
  useQuery: useQueryMock,
  useMutation: vi.fn(() => [{ fetching: false }, vi.fn()]),
}));

vi.mock('@/hooks/use-set-annual-audit-step09-status', () => ({
  useSetAnnualAuditStep09Status: useSetAnnualAuditStep09StatusMock,
}));

// Stub graphql documents so the module doesn't complain about missing codegen
vi.mock('../../../../../../gql/graphql.js', () => ({
  Step09SaveTemplateStatusDocument: {},
  AllDynamicReportsDocument: {},
  AnnualAuditReportType: {
    BalanceSheet: 'BALANCE_SHEET',
    ProfitAndLoss: 'PROFIT_AND_LOSS',
  },
  AnnualAuditStepStatus: {
    Completed: 'COMPLETED',
    InProgress: 'IN_PROGRESS',
    Pending: 'PENDING',
    Blocked: 'BLOCKED',
  },
}));

// Stub shadcn/ui Select to simpler elements for test
vi.mock('../../../../../ui/select.js', () => ({
  Select: ({ children, value, onValueChange, disabled }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
  }) =>
    React.createElement('div', { 'data-testid': 'select', 'data-value': value, 'data-disabled': disabled },
      React.createElement('select', {
        value: value,
        disabled,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(e.target.value),
        'data-testid': 'select-input',
      }, children),
    ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SelectValue: ({ placeholder }: { placeholder?: string }) =>
    React.createElement('span', { 'data-testid': 'select-value' }, placeholder),
  SelectContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'select-content' }, children),
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) =>
    React.createElement('option', { value, 'data-testid': `select-item-${value}` }, children),
}));

// Stub BaseStepCard to render children + status badge
vi.mock('../../step-base.js', () => ({
  BaseStepCard: ({
    children,
    status,
    description,
  }: {
    children?: React.ReactNode;
    status?: string;
    description?: string;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'base-step-card', 'data-status': status },
      React.createElement('span', { 'data-testid': 'step-description' }, description),
      children,
    ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { Step09SaveTemplate } from '../index.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeTemplate(overrides: { name?: string; isLocked?: boolean } = {}) {
  return {
    id: `tpl-${Math.random()}`,
    name: overrides.name ?? 'template-A',
    isLocked: overrides.isLocked ?? false,
    updated: new Date(),
  };
}

async function render(props: {
  adminBusinessId?: string;
  year?: number;
  id?: string;
  stepStatuses?: Array<{ stepId: string; status: string; evidence?: string | null }>;
  templates?: Array<{ id: string; name: string; isLocked: boolean; updated: Date }>;
  /** The page's step-status rows — step 05's evidence holds the working templates */
  manualData?: Array<{ id: string; stepId: string; status: string; notes: null; evidence: string | null }>;
}): Promise<{ container: HTMLDivElement; cleanup: () => Promise<void> }> {
  const {
    year = 2024,
    id = '9',
    stepStatuses = [],
    templates = [],
  } = props;
  const adminBusinessId = props.adminBusinessId;

  // First useQuery call → Step09SaveTemplateStatus (step statuses)
  // Second useQuery call → AllDynamicReports (templates)
  let callCount = 0;
  useQueryMock.mockImplementation(() => {
    callCount++;
    if (callCount % 2 === 1) {
      return [{ data: { annualAuditStepStatuses: stepStatuses }, fetching: false }, vi.fn()];
    }
    return [{ data: { allDynamicReports: templates }, fetching: false }, vi.fn()];
  });

  useSetAnnualAuditStep09StatusMock.mockReturnValue({
    fetching: false,
    setStep09Status: setStep09StatusMock,
  });

  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(Step09SaveTemplate, {
        id,
        title: 'Save Final Dynamic Report Template',
        year,
        adminBusinessId: adminBusinessId,
        onStatusChange: vi.fn(),
        manualData: (props.manualData ?? []) as never,
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

// ── tests ──────────────────────────────────────────────────────────────────

const BS = 'BALANCE_SHEET';
const PNL = 'PROFIT_AND_LOSS';

function slot(container: HTMLElement, reportType: string) {
  return container.querySelector(`[data-testid="final-${reportType}"]`);
}

function slotItem(container: HTMLElement, reportType: string, name: string) {
  return slot(container, reportType)?.querySelector(`[data-testid="select-item-${name}"]`) ?? null;
}

function workingEvidence(evidence: Record<string, string>) {
  return [
    { id: 'w', stepId: '5', status: 'PENDING', notes: null, evidence: JSON.stringify(evidence) },
  ];
}

async function chooseInSlot(container: HTMLElement, reportType: string, value: string) {
  const selectInput = slot(container, reportType)?.querySelector(
    '[data-testid="select-input"]',
  ) as HTMLSelectElement | null;
  await act(async () => {
    if (selectInput) {
      selectInput.value = value;
      selectInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await Promise.resolve();
  });
}

describe('Step09SaveTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "blocked" status when no adminBusinessId is provided', async () => {
    useQueryMock.mockReturnValue([{ data: undefined, fetching: false }, vi.fn()]);
    useSetAnnualAuditStep09StatusMock.mockReturnValue({ fetching: false, setStep09Status: vi.fn() });

    const { container, cleanup } = await render({});

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('blocked');

    await cleanup();
  });

  it('shows "pending" and offers unlocked templates in both slots when nothing is locked', async () => {
    const templates = [
      makeTemplate({ name: 'template-A', isLocked: false }),
      makeTemplate({ name: 'template-B', isLocked: false }),
      makeTemplate({ name: 'template-C', isLocked: true }), // locked by another year — hidden
    ];

    const { container, cleanup } = await render({ adminBusinessId: 'owner-1', stepStatuses: [], templates });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('pending');

    for (const reportType of [BS, PNL]) {
      expect(slotItem(container, reportType, 'template-A')).toBeTruthy();
      expect(slotItem(container, reportType, 'template-B')).toBeTruthy();
      expect(slotItem(container, reportType, 'template-C')).toBeNull();
    }

    await cleanup();
  });

  it('treats legacy single-template evidence as locked for both reports', async () => {
    const stepStatuses = [
      {
        stepId: '9',
        status: 'COMPLETED',
        evidence: JSON.stringify({ lockedTemplateName: 'template-A' }),
      },
    ];
    const templates = [
      makeTemplate({ name: 'template-A', isLocked: true }),
      makeTemplate({ name: 'template-B', isLocked: false }),
    ];

    const { container, cleanup } = await render({ adminBusinessId: 'owner-1', stepStatuses, templates });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('completed');
    const description = container.querySelector('[data-testid="step-description"]');
    expect(description?.textContent).toBe('Final template: template-A');

    for (const reportType of [BS, PNL]) {
      expect(slot(container, reportType)?.querySelector('[data-testid="select"]')?.getAttribute('data-value')).toBe(
        'template-A',
      );
    }

    await cleanup();
  });

  it('describes separate Balance Sheet and Profit and Loss templates', async () => {
    const stepStatuses = [
      {
        stepId: '9',
        status: 'COMPLETED',
        evidence: JSON.stringify({ balanceSheetTemplateName: 'bs', profitAndLossTemplateName: 'pnl' }),
      },
    ];
    const templates = [
      makeTemplate({ name: 'bs', isLocked: true }),
      makeTemplate({ name: 'pnl', isLocked: true }),
      makeTemplate({ name: 'other-locked', isLocked: true }),
    ];

    const { container, cleanup } = await render({ adminBusinessId: 'owner-1', stepStatuses, templates });

    const description = container.querySelector('[data-testid="step-description"]');
    expect(description?.textContent).toBe(
      'Final templates: Balance Sheet bs · Profit and Loss pnl',
    );
    // Both of this year's locked templates are selectable in either slot; other locked ones aren't
    expect(slotItem(container, BS, 'pnl')).toBeTruthy();
    expect(slotItem(container, PNL, 'bs')).toBeTruthy();
    expect(slotItem(container, BS, 'other-locked')).toBeNull();

    await cleanup();
  });

  it('is in progress while only one report is locked', async () => {
    const stepStatuses = [
      {
        stepId: '9',
        status: 'IN_PROGRESS',
        evidence: JSON.stringify({ balanceSheetTemplateName: 'bs' }),
      },
    ];

    const { container, cleanup } = await render({
      adminBusinessId: 'owner-1',
      stepStatuses,
      templates: [makeTemplate({ name: 'bs', isLocked: true })],
    });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('in-progress');

    await cleanup();
  });

  it('leaves a report that is not locked yet empty, so its template can be picked', async () => {
    const stepStatuses = [
      {
        stepId: '9',
        status: 'IN_PROGRESS',
        evidence: JSON.stringify({ balanceSheetTemplateName: 'bs' }),
      },
    ];
    setStep09StatusMock.mockResolvedValue({ stepId: '9', status: 'COMPLETED' });

    const { container, cleanup } = await render({
      adminBusinessId: 'owner-1',
      stepStatuses,
      templates: [makeTemplate({ name: 'bs', isLocked: true })],
    });

    const selectValue = (reportType: string) =>
      slot(container, reportType)?.querySelector('[data-testid="select"]')?.getAttribute('data-value');
    expect(selectValue(BS)).toBe('bs');
    expect(selectValue(PNL)).toBe('');
    expect(slot(container, PNL)?.textContent).not.toContain('Locked:');

    // The Balance Sheet template can serve Profit and Loss too
    await chooseInSlot(container, PNL, 'bs');
    expect(setStep09StatusMock).toHaveBeenCalledWith({
      input: { ownerId: 'owner-1', year: 2024, templateName: 'bs', reportType: PNL },
    });

    await cleanup();
  });

  it('locks a template for the report whose picker changed', async () => {
    const templates = [makeTemplate({ name: 'template-A', isLocked: false })];
    setStep09StatusMock.mockResolvedValue({ stepId: '9', status: 'IN_PROGRESS' });

    const { container, cleanup } = await render({ adminBusinessId: 'owner-1', stepStatuses: [], templates });

    await chooseInSlot(container, PNL, 'template-A');

    expect(setStep09StatusMock).toHaveBeenCalledWith({
      input: { ownerId: 'owner-1', year: 2024, templateName: 'template-A', reportType: PNL },
    });

    await cleanup();
  });

  it('lists the working template first, tagged, in its own slot', async () => {
    const templates = [
      makeTemplate({ name: 'aaa', isLocked: false }),
      makeTemplate({ name: 'bs-wip', isLocked: false }),
    ];

    const { container, cleanup } = await render({
      adminBusinessId: 'owner-1',
      templates,
      manualData: workingEvidence({ balanceSheetTemplateName: 'bs-wip' }),
    });

    const bsItems = slot(container, BS)?.querySelectorAll('option');
    expect(bsItems?.[0]?.getAttribute('value')).toBe('bs-wip');
    expect(bsItems?.[0]?.textContent).toContain('(working)');
    expect(slotItem(container, PNL, 'bs-wip')?.textContent).not.toContain('(working)');

    await cleanup();
  });

  it('"Lock working templates" locks each report\'s working template', async () => {
    const templates = [
      makeTemplate({ name: 'bs-wip', isLocked: false }),
      makeTemplate({ name: 'pnl-wip', isLocked: false }),
    ];
    setStep09StatusMock.mockResolvedValue({ stepId: '9' });

    const { container, cleanup } = await render({
      adminBusinessId: 'owner-1',
      templates,
      manualData: workingEvidence({
        balanceSheetTemplateName: 'bs-wip',
        profitAndLossTemplateName: 'pnl-wip',
      }),
    });

    const button = container.querySelector('[data-testid="lock-working-templates"]') as HTMLButtonElement;
    expect(button.textContent).toBe('Lock working templates');
    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(setStep09StatusMock).toHaveBeenCalledTimes(2);
    expect(setStep09StatusMock).toHaveBeenNthCalledWith(1, {
      input: { ownerId: 'owner-1', year: 2024, templateName: 'bs-wip', reportType: BS },
    });
    expect(setStep09StatusMock).toHaveBeenNthCalledWith(2, {
      input: { ownerId: 'owner-1', year: 2024, templateName: 'pnl-wip', reportType: PNL },
    });

    await cleanup();
  });

  it('"Lock working template" uses one call when both reports share a working template', async () => {
    setStep09StatusMock.mockResolvedValue({ stepId: '9' });

    const { container, cleanup } = await render({
      adminBusinessId: 'owner-1',
      templates: [makeTemplate({ name: 'wip', isLocked: false })],
      manualData: workingEvidence({ balanceSheetTemplateName: 'wip', profitAndLossTemplateName: 'wip' }),
    });

    const button = container.querySelector('[data-testid="lock-working-templates"]') as HTMLButtonElement;
    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(setStep09StatusMock).toHaveBeenCalledTimes(1);
    expect(setStep09StatusMock).toHaveBeenCalledWith({
      input: { ownerId: 'owner-1', year: 2024, templateName: 'wip' },
    });

    await cleanup();
  });

  it('hides "Lock working templates" once the working templates are the locked ones', async () => {
    const { container, cleanup } = await render({
      adminBusinessId: 'owner-1',
      stepStatuses: [
        {
          stepId: '9',
          status: 'COMPLETED',
          evidence: JSON.stringify({ balanceSheetTemplateName: 'wip', profitAndLossTemplateName: 'wip' }),
        },
      ],
      templates: [makeTemplate({ name: 'wip', isLocked: true })],
      manualData: workingEvidence({ balanceSheetTemplateName: 'wip', profitAndLossTemplateName: 'wip' }),
    });

    expect(container.querySelector('[data-testid="lock-working-templates"]')).toBeNull();

    await cleanup();
  });
});
