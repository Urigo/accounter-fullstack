import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FinancialChargeEnum,
  useGenerateFinancialCharge,
} from '../use-generate-financial-charge.js';

const { toastMock, useMutationMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
  useMutationMock: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('urql', async importOriginal => ({
  ...(await importOriginal<typeof import('urql')>()),
  useMutation: useMutationMock,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Hook = ReturnType<typeof useGenerateFinancialCharge>;

/** Renders the hook with `mutate` behind every one of its `useMutation` calls. */
async function renderHook(mutate: ReturnType<typeof vi.fn>): Promise<() => Hook> {
  useMutationMock.mockReturnValue([{ fetching: false }, mutate]);
  let latest: Hook | null = null;
  function Harness(): null {
    latest = useGenerateFinancialCharge();
    return null;
  }
  const container = document.createElement('div');
  document.body.append(container);
  await act(async () => {
    createRoot(container).render(React.createElement(Harness));
  });
  return () => latest!;
}

/** A successful result for whichever `generate*Charge` field the hook reads. */
const anyChargeResult = {
  data: new Proxy({}, { get: () => ({ id: 'charge-1' }) }),
};

// The guard is module-level and keyed by variables, so every test uses its own owner id.
describe('useGenerateFinancialCharge dedupe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('generates one charge for a repeated call with the same type and variables', async () => {
    const mutate = vi.fn().mockResolvedValue(anyChargeResult);
    const hook = await renderHook(mutate);
    const variables = { ownerId: 'owner-1', date: '2026-10-31' as const };

    let second: boolean | undefined;
    await act(async () => {
      await hook().generateFinancialCharge({ type: FinancialChargeEnum.Revaluation, ...variables });
      second = await hook().generateFinancialCharge({
        type: FinancialChargeEnum.Revaluation,
        ...variables,
      });
    });

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(second).toBe(false);
    expect(toastMock.warning).toHaveBeenCalledWith(
      'Duplicate request blocked',
      expect.objectContaining({ id: 'generateFinancialCharge-Revaluation-duplicate' }),
    );
  });

  it('does not block a different charge type with the same variables', async () => {
    const mutate = vi.fn().mockResolvedValue(anyChargeResult);
    const hook = await renderHook(mutate);
    const variables = { ownerId: 'owner-2', date: '2026-10-31' as const };

    await act(async () => {
      await hook().generateFinancialCharge({ type: FinancialChargeEnum.Revaluation, ...variables });
      await hook().generateFinancialCharge({ type: FinancialChargeEnum.Depreciation, ...variables });
    });

    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('keeps the guard after a failure, since the charge may have been created', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const mutate = vi.fn().mockRejectedValue(new Error('offline'));
    const hook = await renderHook(mutate);
    const variables = { ownerId: 'owner-3', date: '2026-10-31' as const };

    await act(async () => {
      await hook().generateFinancialCharge({ type: FinancialChargeEnum.TaxExpenses, ...variables });
      await hook().generateFinancialCharge({ type: FinancialChargeEnum.TaxExpenses, ...variables });
    });

    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
