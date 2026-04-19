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
  AllContoReportsDocument: {},
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
}): Promise<{ container: HTMLDivElement; cleanup: () => Promise<void> }> {
  const {
    year = 2024,
    id = '9',
    stepStatuses = [],
    templates = [],
  } = props;
  const adminBusinessId = props.adminBusinessId;

  // First useQuery call → Step09SaveTemplateStatus (step statuses)
  // Second useQuery call → AllContoReports (templates)
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

// ── tests ──────────────────────────────────────────────────────────────────

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

  it('shows "pending" status and select with unlocked templates when no evidence', async () => {
    const templates = [
      makeTemplate({ name: 'template-A', isLocked: false }),
      makeTemplate({ name: 'template-B', isLocked: false }),
      makeTemplate({ name: 'template-C', isLocked: true }), // locked by someone else — hidden
    ];

    const { container, cleanup } = await render({ adminBusinessId: 'owner-1', stepStatuses: [], templates });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('pending');

    // Only unlocked templates should be listed
    expect(container.querySelector('[data-testid="select-item-template-A"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="select-item-template-B"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="select-item-template-C"]')).toBeNull();

    await cleanup();
  });

  it('shows "completed" status and description when evidence has lockedTemplateName', async () => {
    const stepStatuses = [
      {
        stepId: '9',
        status: 'COMPLETED',
        evidence: JSON.stringify({ lockedTemplateName: 'template-A' }),
      },
    ];
    const templates = [
      makeTemplate({ name: 'template-A', isLocked: true }), // the locked one (visible)
      makeTemplate({ name: 'template-B', isLocked: false }),
    ];

    const { container, cleanup } = await render({ adminBusinessId: 'owner-1', stepStatuses, templates });

    const card = container.querySelector('[data-testid="base-step-card"]');
    expect(card?.getAttribute('data-status')).toBe('completed');

    const description = container.querySelector('[data-testid="step-description"]');
    expect(description?.textContent).toContain('template-A');

    // Locked template still appears in Select (it's the currently selected one)
    expect(container.querySelector('[data-testid="select-item-template-A"]')).toBeTruthy();

    await cleanup();
  });

  it('includes the currently-locked template in the select even if is_locked=true', async () => {
    const stepStatuses = [
      {
        stepId: '9',
        status: 'COMPLETED',
        evidence: JSON.stringify({ lockedTemplateName: 'locked-template' }),
      },
    ];
    const templates = [
      makeTemplate({ name: 'locked-template', isLocked: true }),
      makeTemplate({ name: 'other-locked', isLocked: true }), // other locked — hidden
      makeTemplate({ name: 'unlocked', isLocked: false }),
    ];

    const { container, cleanup } = await render({ adminBusinessId: 'owner-1', stepStatuses, templates });

    // Current locked template is shown
    expect(container.querySelector('[data-testid="select-item-locked-template"]')).toBeTruthy();
    // Other locked (not selected) is hidden
    expect(container.querySelector('[data-testid="select-item-other-locked"]')).toBeNull();
    // Unlocked is always shown
    expect(container.querySelector('[data-testid="select-item-unlocked"]')).toBeTruthy();

    await cleanup();
  });

  it('calls setStep09Status when a template is selected', async () => {
    const templates = [makeTemplate({ name: 'template-A', isLocked: false })];

    setStep09StatusMock.mockResolvedValue({
      stepId: '9',
      status: 'COMPLETED',
      evidence: JSON.stringify({ lockedTemplateName: 'template-A' }),
    });

    const { container, cleanup } = await render({ adminBusinessId: 'owner-1', stepStatuses: [], templates });

    const selectInput = container.querySelector(
      '[data-testid="select-input"]',
    ) as HTMLSelectElement | null;

    await act(async () => {
      if (selectInput) {
        selectInput.value = 'template-A';
        selectInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await Promise.resolve();
    });

    expect(setStep09StatusMock).toHaveBeenCalledWith({
      input: { ownerId: 'owner-1', year: 2024, templateName: 'template-A' },
    });

    await cleanup();
  });
});
