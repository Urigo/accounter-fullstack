// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useWorkspaceMock, refetchMock } = vi.hoisted(() => ({
  useWorkspaceMock: vi.fn(),
  refetchMock: vi.fn(),
}));

const { useMutationMock, mutateMock } = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
  mutateMock: vi.fn(),
}));

vi.mock('../../providers/workspace-provider.js', () => ({
  useWorkspace: useWorkspaceMock,
}));

vi.mock('urql', () => ({
  useMutation: useMutationMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { FinancePreferences } from '../screens/settings/finance-preferences.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function setupMocks(workspace: Record<string, unknown> | null, mutationFetching = false) {
  useWorkspaceMock.mockReturnValue({
    workspace,
    isLoading: false,
    error: null,
    refetch: refetchMock,
  });
  mutateMock.mockResolvedValue({ data: { updateWorkspaceSettings: workspace } });
  useMutationMock.mockReturnValue([{ fetching: mutationFetching }, mutateMock]);
}

async function render() {
  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(FinancePreferences));
    await Promise.resolve();
  });

  const html = container.innerHTML;
  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { container, html, cleanup };
}

describe('FinancePreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', async () => {
    useWorkspaceMock.mockReturnValue({
      workspace: null,
      isLoading: true,
      error: null,
      refetch: refetchMock,
    });
    useMutationMock.mockReturnValue([{ fetching: false }, mutateMock]);

    const { html, cleanup } = await render();
    expect(html).toContain('animate-spin');
    await cleanup();
  });

  it('renders form with default values when no workspace', async () => {
    setupMocks(null);

    const { container, cleanup } = await render();
    const agingInput = container.querySelector('#agingThreshold') as HTMLInputElement;
    const toleranceInput = container.querySelector('#matchingTolerance') as HTMLInputElement;
    const termsInput = container.querySelector('#paymentTerms') as HTMLInputElement;

    expect(agingInput.value).toBe('30');
    expect(toleranceInput.value).toBe('0.01');
    expect(termsInput.value).toBe('30');
    await cleanup();
  });

  it('renders form with workspace values', async () => {
    setupMocks({
      id: '1',
      ownerId: 'o1',
      defaultCurrency: 'USD',
      agingThresholdDays: 45,
      matchingToleranceAmount: 0.5,
      billingCurrency: 'EUR',
      billingPaymentTermsDays: 60,
    });

    const { container, cleanup } = await render();
    const agingInput = container.querySelector('#agingThreshold') as HTMLInputElement;
    const toleranceInput = container.querySelector('#matchingTolerance') as HTMLInputElement;
    const termsInput = container.querySelector('#paymentTerms') as HTMLInputElement;

    expect(agingInput.value).toBe('45');
    expect(toleranceInput.value).toBe('0.5');
    expect(termsInput.value).toBe('60');
    await cleanup();
  });

  it('renders currency and accounting section', async () => {
    setupMocks(null);

    const { html, cleanup } = await render();
    expect(html).toContain('Currency and Accounting');
    expect(html).toContain('Default Currency');
    expect(html).toContain('Aging Threshold');
    expect(html).toContain('Matching Tolerance');
    await cleanup();
  });

  it('renders billing defaults section', async () => {
    setupMocks(null);

    const { html, cleanup } = await render();
    expect(html).toContain('Billing Defaults');
    expect(html).toContain('Billing Currency');
    expect(html).toContain('Payment Terms');
    await cleanup();
  });

  it('save button is disabled until form is dirty', async () => {
    setupMocks({
      id: '1',
      ownerId: 'o1',
      defaultCurrency: 'ILS',
      agingThresholdDays: 30,
      matchingToleranceAmount: 0.01,
      billingPaymentTermsDays: 30,
    });

    const { container, cleanup } = await render();
    const buttons = container.querySelectorAll('button');
    const saveBtn = Array.from(buttons).find(b => b.textContent?.includes('Save'));
    expect(saveBtn?.disabled).toBe(true);
    await cleanup();
  });

  it('calls mutation with correct values on save', async () => {
    mutateMock.mockResolvedValue({ data: { updateWorkspaceSettings: {} } });
    setupMocks({
      id: '1',
      ownerId: 'o1',
      defaultCurrency: 'ILS',
      agingThresholdDays: 30,
      matchingToleranceAmount: 0.01,
      billingCurrency: null,
      billingPaymentTermsDays: 30,
    });

    const { container, cleanup } = await render();
    const agingInput = container.querySelector('#agingThreshold') as HTMLInputElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(agingInput, '60');
      agingInput.dispatchEvent(new Event('input', { bubbles: true }));
      agingInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const buttons = container.querySelectorAll('button');
    const saveBtn = Array.from(buttons).find(b => b.textContent?.includes('Save'));

    await act(async () => {
      saveBtn?.click();
      await Promise.resolve();
    });

    expect(mutateMock).toHaveBeenCalledWith({
      input: expect.objectContaining({
        agingThresholdDays: 60,
        defaultCurrency: 'ILS',
        matchingToleranceAmount: 0.01,
      }),
    });
    await cleanup();
  });

  it('does not expose raw env keys', async () => {
    setupMocks({
      id: '1',
      ownerId: 'o1',
      defaultCurrency: 'ILS',
      agingThresholdDays: 30,
      matchingToleranceAmount: 0.01,
    });

    const { html, cleanup } = await render();
    expect(html).not.toContain('.env');
    expect(html).not.toContain('SETTINGS_ENCRYPTION_KEY');
    expect(html).not.toContain('POSTGRES_');
    expect(html).not.toContain('AUTH0_');
    await cleanup();
  });
});
